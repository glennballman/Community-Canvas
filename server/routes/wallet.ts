import { Router, Request, Response } from 'express';
import { tenantQuery, withTenantTransaction, serviceQuery } from '../db/tenantDb';

const router = Router();

router.post('/topups', async (req: Request, res: Response) => {
  try {
    const {
      wallet_account_id,
      amount_cents,
      to_rail_account_id,
      client_request_id,
      memo
    } = req.body;

    if (!wallet_account_id || !amount_cents || !to_rail_account_id || !client_request_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (amount_cents <= 0) {
      return res.status(400).json({ error: 'Amount must be positive' });
    }

    const result = await tenantQuery(req, `
      SELECT cc_create_rail_transfer(
        current_tenant_id(),
        $1::text,
        'inbound'::rail_direction,
        $2::bigint,
        'CAD',
        NULL::uuid,
        $3::uuid,
        $4::text,
        'wallet_topup',
        $5::uuid
      ) as transfer_id
    `, [client_request_id, amount_cents, to_rail_account_id, memo || '', wallet_account_id]);

    res.status(201).json({
      transfer_id: result.rows[0].transfer_id,
      status: 'created',
      message: 'Top-up transfer created. Awaiting RTR submission.'
    });
  } catch (error: any) {
    if (error.message?.includes('duplicate')) {
      return res.status(409).json({ error: 'Duplicate client_request_id' });
    }
    console.error('Top-up creation failed:', error);
    res.status(500).json({ error: 'Failed to create top-up' });
  }
});

router.post('/cashouts', async (req: Request, res: Response) => {
  try {
    const {
      wallet_account_id,
      amount_cents,
      from_rail_account_id,
      to_rail_account_id,
      client_request_id,
      memo
    } = req.body;

    if (!wallet_account_id || !amount_cents || !from_rail_account_id || !to_rail_account_id || !client_request_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (amount_cents <= 0) {
      return res.status(400).json({ error: 'Amount must be positive' });
    }

    const result = await withTenantTransaction(req, async (client) => {
      const holdResult = await client.query(`
        SELECT cc_place_wallet_hold(
          current_tenant_id(),
          $1::uuid,
          $2::bigint,
          'cashout',
          'rail_transfer_intent',
          NULL::uuid,
          NULL::timestamptz
        ) as hold_id
      `, [wallet_account_id, amount_cents]);

      const holdId = holdResult.rows[0].hold_id;

      const transferResult = await client.query(`
        SELECT cc_create_rail_transfer(
          current_tenant_id(),
          $1::text,
          'outbound'::rail_direction,
          $2::bigint,
          'CAD',
          $3::uuid,
          $4::uuid,
          $5::text,
          'wallet_cashout',
          $6::uuid
        ) as transfer_id
      `, [client_request_id, amount_cents, from_rail_account_id, to_rail_account_id, memo || '', holdId]);

      const transferId = transferResult.rows[0].transfer_id;

      await client.query(`
        UPDATE cc_wallet_holds 
        SET reference_id = $1, metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('transfer_id', $1::text)
        WHERE id = $2
      `, [transferId, holdId]);

      return { transfer_id: transferId, hold_id: holdId };
    });

    res.status(201).json({
      ...result,
      status: 'created',
      message: 'Cash-out transfer created with hold. Awaiting RTR submission.'
    });
  } catch (error: any) {
    if (error.message?.includes('Insufficient available balance')) {
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }
    if (error.message?.includes('duplicate')) {
      return res.status(409).json({ error: 'Duplicate client_request_id' });
    }
    console.error('Cash-out creation failed:', error);
    res.status(500).json({ error: 'Failed to create cash-out' });
  }
});

router.get('/accounts/:id', async (req: Request, res: Response) => {
  try {
    const walletAccountId = req.params.id;

    const accountResult = await tenantQuery(req, `
      SELECT 
        id, account_name, currency, status,
        posted_balance_cents, available_balance_cents, active_holds_cents,
        created_at, updated_at
      FROM cc_wallet_accounts
      WHERE id = $1
    `, [walletAccountId]);

    if (accountResult.rows.length === 0) {
      return res.status(404).json({ error: 'Wallet account not found' });
    }

    const entriesResult = await tenantQuery(req, `
      SELECT 
        id, entry_type, status, amount_cents, currency,
        reference_type, reference_id, description,
        sequence_number, posted_at
      FROM cc_wallet_entries
      WHERE wallet_account_id = $1
      ORDER BY sequence_number DESC
      LIMIT 20
    `, [walletAccountId]);

    const holdsResult = await tenantQuery(req, `
      SELECT 
        id, status, amount_cents, reason, expires_at, created_at
      FROM cc_wallet_holds
      WHERE wallet_account_id = $1 AND status = 'active'
      ORDER BY created_at DESC
    `, [walletAccountId]);

    res.json({
      account: accountResult.rows[0],
      recent_entries: entriesResult.rows,
      active_holds: holdsResult.rows
    });
  } catch (error) {
    console.error('Failed to get wallet account:', error);
    res.status(500).json({ error: 'Failed to retrieve wallet account' });
  }
});

router.post('/accounts', async (req: Request, res: Response) => {
  try {
    const { account_name, party_id, individual_id, currency, metadata } = req.body;

    if (!account_name) {
      return res.status(400).json({ error: 'account_name is required' });
    }

    const result = await tenantQuery(req, `
      SELECT cc_create_wallet_account(
        current_tenant_id(),
        $1::text,
        $2::uuid,
        $3::uuid,
        $4::text,
        $5::jsonb
      ) as wallet_id
    `, [account_name, party_id || null, individual_id || null, currency || 'CAD', metadata ? JSON.stringify(metadata) : null]);

    res.status(201).json({
      wallet_id: result.rows[0].wallet_id,
      message: 'Wallet account created'
    });
  } catch (error) {
    console.error('Failed to create wallet account:', error);
    res.status(500).json({ error: 'Failed to create wallet account' });
  }
});

export default router;
