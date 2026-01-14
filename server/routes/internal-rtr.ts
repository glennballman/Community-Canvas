import { Router, Request, Response } from 'express';
import { submitTransferToRTR, ingestRTRWebhook, runReconciliation } from '../workers/rtr-worker';

const router = Router();

function requireServiceKey(req: Request, res: Response, next: Function) {
  const serviceKey = req.headers['x-service-key'];
  
  if (serviceKey !== process.env.INTERNAL_SERVICE_KEY) {
    return res.status(403).json({ error: 'Service mode required' });
  }
  
  next();
}

router.use(requireServiceKey);

router.post('/submit-transfer', async (req: Request, res: Response) => {
  const { tenant_id, transfer_id, rtr_profile_id } = req.body;

  if (!tenant_id || !transfer_id || !rtr_profile_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = await submitTransferToRTR(tenant_id, transfer_id, rtr_profile_id);

    if (result.success) {
      res.json({
        success: true,
        provider_transfer_id: result.providerTransferId,
        message: result.error || 'Transfer submitted'
      });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Submit transfer failed:', error);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

router.post('/webhook', async (req: Request, res: Response) => {
  const tenantId = req.headers['x-tenant-id'] as string;
  const rtrProfileId = req.headers['x-rtr-profile-id'] as string;

  if (!tenantId || !rtrProfileId) {
    return res.status(400).json({ error: 'Missing tenant or profile headers' });
  }

  try {
    const rawPayload = JSON.stringify(req.body);
    const result = await ingestRTRWebhook(tenantId, rtrProfileId, req.headers, rawPayload);

    if (result.success) {
      res.json({
        success: true,
        inbox_id: result.inboxId,
        duplicate: result.duplicate
      });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Webhook ingestion failed:', error);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

router.post('/reconcile', async (req: Request, res: Response) => {
  const { tenant_id, rtr_profile_id } = req.body;

  if (!tenant_id || !rtr_profile_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    await runReconciliation(tenant_id, rtr_profile_id);
    res.json({ success: true, message: 'Reconciliation complete' });
  } catch (error) {
    console.error('Reconciliation failed:', error);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

export default router;
