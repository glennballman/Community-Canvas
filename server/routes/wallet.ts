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
      memo,
      reference_text
    } = req.body;

    if (!wallet_account_id || !amount_cents || !to_rail_account_id || !client_request_id) {
      return res.status(422).json({ error: 'Missing required fields', code: 'VALIDATION_ERROR' });
    }

    if (amount_cents <= 0) {
      return res.status(422).json({ error: 'Amount must be positive', code: 'INVALID_AMOUNT' });
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
        $5::uuid,
        $6::text
      ) as transfer_id
    `, [client_request_id, amount_cents, to_rail_account_id, memo || '', wallet_account_id, reference_text || null]);

    const transferId = result.rows[0].transfer_id;

    res.status(201).json({
      transfer_id: transferId,
      status: 'created',
      direction: 'inbound',
      amount_cents: amount_cents,
      currency: 'CAD',
      client_request_id: client_request_id,
      created_at: new Date().toISOString()
    });
  } catch (error: any) {
    if (error.message?.includes('duplicate') || error.code === '23505') {
      try {
        const existing = await tenantQuery(req, `
          SELECT id FROM cc_rail_transfers 
          WHERE client_request_id = $1
        `, [req.body.client_request_id]);
        
        if (existing.rows.length > 0) {
          return res.status(409).json({ 
            error: 'Duplicate client_request_id',
            transfer_id: existing.rows[0].id,
            code: 'DUPLICATE_REQUEST'
          });
        }
      } catch {}
    }
    console.error('Top-up creation failed:', error);
    res.status(500).json({ error: 'Failed to create top-up', code: 'INTERNAL_ERROR' });
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
      memo,
      expires_at
    } = req.body;

    if (!wallet_account_id || !amount_cents || !from_rail_account_id || !to_rail_account_id || !client_request_id) {
      return res.status(422).json({ error: 'Missing required fields', code: 'VALIDATION_ERROR' });
    }

    if (amount_cents <= 0) {
      return res.status(422).json({ error: 'Amount must be positive', code: 'INVALID_AMOUNT' });
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
          $3::timestamptz
        ) as hold_id
      `, [wallet_account_id, amount_cents, expires_at || null]);

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
          $6::uuid,
          NULL
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
      transfer_id: result.transfer_id,
      hold_id: result.hold_id,
      transfer_status: 'created',
      hold_status: 'active',
      amount_cents: amount_cents,
      currency: 'CAD',
      client_request_id: client_request_id,
      created_at: new Date().toISOString()
    });
  } catch (error: any) {
    if (error.message?.includes('Insufficient available balance')) {
      return res.status(402).json({ 
        error: 'Insufficient available balance', 
        code: 'INSUFFICIENT_BALANCE' 
      });
    }
    if (error.message?.includes('duplicate') || error.code === '23505') {
      try {
        const existing = await tenantQuery(req, `
          SELECT rt.id as transfer_id, wh.id as hold_id
          FROM cc_rail_transfers rt
          LEFT JOIN cc_wallet_holds wh ON wh.reference_id = rt.id
          WHERE rt.client_request_id = $1
        `, [req.body.client_request_id]);
        
        if (existing.rows.length > 0) {
          return res.status(409).json({ 
            error: 'Duplicate client_request_id',
            transfer_id: existing.rows[0].transfer_id,
            hold_id: existing.rows[0].hold_id,
            code: 'DUPLICATE_REQUEST'
          });
        }
      } catch {}
    }
    console.error('Cash-out creation failed:', error);
    res.status(500).json({ error: 'Failed to create cash-out', code: 'INTERNAL_ERROR' });
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
      return res.status(404).json({ error: 'Wallet account not found', code: 'NOT_FOUND' });
    }

    const entriesResult = await tenantQuery(req, `
      SELECT 
        id, entry_type, status, amount_cents, currency,
        reference_type, reference_id, description,
        sequence_number, posted_at
      FROM cc_wallet_entries
      WHERE wallet_account_id = $1
      ORDER BY sequence_number DESC
      LIMIT 50
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
      entries: entriesResult.rows,
      holds: holdsResult.rows
    });
  } catch (error) {
    console.error('Failed to get wallet account:', error);
    res.status(500).json({ error: 'Failed to retrieve wallet account', code: 'INTERNAL_ERROR' });
  }
});

router.post('/accounts', async (req: Request, res: Response) => {
  try {
    const { account_name, party_id, individual_id, currency, metadata } = req.body;

    if (!account_name) {
      return res.status(422).json({ error: 'account_name is required', code: 'VALIDATION_ERROR' });
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
      status: 'active',
      currency: currency || 'CAD',
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to create wallet account:', error);
    res.status(500).json({ error: 'Failed to create wallet account', code: 'INTERNAL_ERROR' });
  }
});

export default router;
