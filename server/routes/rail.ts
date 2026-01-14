import { Router, Request, Response } from 'express';
import { tenantQuery } from '../db/tenantDb';

const router = Router();

router.get('/transfers/:id', async (req: Request, res: Response) => {
  try {
    const transferId = req.params.id;

    const transferResult = await tenantQuery(req, `
      SELECT 
        id, client_request_id, direction, status,
        amount_cents, currency, memo, reference_text,
        from_rail_account_id, to_rail_account_id,
        provider_transfer_id, provider_status,
        requested_at, submitted_at, completed_at,
        created_at, updated_at
      FROM cc_rail_transfers
      WHERE id = $1
    `, [transferId]);

    if (transferResult.rows.length === 0) {
      return res.status(404).json({ error: 'Transfer not found' });
    }

    const eventsResult = await tenantQuery(req, `
      SELECT 
        id, event_type, previous_status, new_status,
        provider_status, provider_reason_code, provider_reason_message,
        event_data, created_at
      FROM cc_rail_transfer_events
      WHERE transfer_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `, [transferId]);

    res.json({
      transfer: transferResult.rows[0],
      events: eventsResult.rows
    });
  } catch (error) {
    console.error('Failed to get transfer:', error);
    res.status(500).json({ error: 'Failed to retrieve transfer' });
  }
});

router.get('/accounts', async (req: Request, res: Response) => {
  try {
    const result = await tenantQuery(req, `
      SELECT 
        id, account_type, account_name, currency,
        institution_number, transit_number,
        is_active, created_at
      FROM cc_rail_accounts
      WHERE is_active = true
      ORDER BY created_at DESC
    `, []);

    res.json({ accounts: result.rows });
  } catch (error) {
    console.error('Failed to get rail accounts:', error);
    res.status(500).json({ error: 'Failed to retrieve rail accounts' });
  }
});

router.get('/connectors', async (req: Request, res: Response) => {
  try {
    const result = await tenantQuery(req, `
      SELECT 
        id, connector_key, provider, environment,
        is_active, created_at
      FROM cc_rail_connectors
      WHERE is_active = true
      ORDER BY created_at DESC
    `, []);

    res.json({ connectors: result.rows });
  } catch (error) {
    console.error('Failed to get rail connectors:', error);
    res.status(500).json({ error: 'Failed to retrieve rail connectors' });
  }
});

export default router;
