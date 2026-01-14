import { Router, Request, Response } from 'express';
import { submitTransferToRTR, ingestRTRWebhook, runReconciliation } from '../workers/rtr-worker';

const router = Router();

function requireServiceKey(req: Request, res: Response, next: Function) {
  const serviceKey = req.headers['x-service-key'];
  
  if (serviceKey !== process.env.INTERNAL_SERVICE_KEY && serviceKey !== process.env.SESSION_SECRET) {
    return res.status(403).json({ error: 'Service mode required', code: 'FORBIDDEN' });
  }
  
  next();
}

router.use(requireServiceKey);

router.post('/submit-transfer', async (req: Request, res: Response) => {
  const { tenant_id, transfer_id, rtr_profile_id, dry_run } = req.body;

  if (!tenant_id || !transfer_id || !rtr_profile_id) {
    return res.status(400).json({ error: 'Missing required fields', code: 'VALIDATION_ERROR' });
  }

  try {
    const result = await submitTransferToRTR(tenant_id, transfer_id, rtr_profile_id, dry_run || false);

    if (result.success) {
      const response: Record<string, any> = {
        transfer_id: transfer_id,
        submitted: !result.alreadySubmitted,
        status_before: result.statusBefore || 'created',
        status_after: result.statusAfter || 'submitted',
        idempotency: {
          client_request_id: result.clientRequestId || null,
          provider_idempotency_key: result.providerTransferId || null
        }
      };
      
      if (result.providerTransferId) {
        response.provider_transfer_id = result.providerTransferId;
      }
      
      if (result.alreadySubmitted) {
        response.reason = 'already_has_provider_transfer_id';
        response.current_status = result.statusAfter;
      }
      
      res.json(response);
    } else {
      res.status(400).json({ 
        success: false, 
        error: result.error,
        code: 'SUBMIT_FAILED'
      });
    }
  } catch (error) {
    console.error('Submit transfer failed:', error);
    res.status(500).json({ success: false, error: 'Internal error', code: 'INTERNAL_ERROR' });
  }
});

router.post('/webhook', async (req: Request, res: Response) => {
  const { tenant_id, rtr_profile_id, provider_event_id, received_at, headers, payload } = req.body;

  if (!tenant_id || !rtr_profile_id) {
    return res.status(400).json({ error: 'Missing tenant or profile', code: 'VALIDATION_ERROR' });
  }

  try {
    const rawPayload = JSON.stringify(payload);
    const result = await ingestRTRWebhook(tenant_id, rtr_profile_id, provider_event_id, headers || {}, rawPayload);

    if (result.success) {
      res.json({
        inbox_id: result.inboxId,
        accepted: true,
        idempotent_noop: result.duplicate || false,
        mapped_transfer_id: result.transferId || null,
        status_transition: result.statusTransition || null
      });
    } else {
      res.status(400).json({ 
        accepted: false, 
        error: result.error,
        code: 'WEBHOOK_FAILED'
      });
    }
  } catch (error) {
    console.error('Webhook ingestion failed:', error);
    res.status(500).json({ accepted: false, error: 'Internal error', code: 'INTERNAL_ERROR' });
  }
});

router.post('/reconcile', async (req: Request, res: Response) => {
  const { tenant_id, rtr_profile_id, since, limit } = req.body;

  if (!tenant_id || !rtr_profile_id) {
    return res.status(400).json({ error: 'Missing required fields', code: 'VALIDATION_ERROR' });
  }

  try {
    const result = await runReconciliation(tenant_id, rtr_profile_id, since, limit || 200);
    
    res.json({
      checked: result.checked || 0,
      updated: result.updated || 0,
      unchanged: result.unchanged || 0,
      errors: result.errors || 0
    });
  } catch (error) {
    console.error('Reconciliation failed:', error);
    res.status(500).json({ success: false, error: 'Internal error', code: 'INTERNAL_ERROR' });
  }
});

export default router;
