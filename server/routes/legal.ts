import { Router, Request, Response } from 'express';
import {
  createLegalHold,
  addHoldTarget,
  releaseHold,
  getHold,
  listHolds,
  getHoldTargets,
  getHoldEvents,
  HoldType,
  HoldTargetType,
} from '../lib/legal/holds';
import {
  createRetentionPolicy,
  listRetentionPolicies,
  RetentionScope,
} from '../lib/legal/retention';

const router = Router();

const SERVICE_TENANT_ID = 'b0000000-0000-0000-0000-000000000001';

function getTenantId(req: Request): string {
  return (req as any).tenantId || SERVICE_TENANT_ID;
}

function getIndividualId(req: Request): string | undefined {
  return (req as any).individualId;
}

router.post('/holds', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const {
      hold_type,
      title,
      description,
      circle_id,
      portal_id,
      client_request_id,
      metadata,
    } = req.body;
    
    if (!hold_type || !title) {
      return res.status(400).json({ error: 'hold_type and title are required' });
    }
    
    const hold = await createLegalHold({
      tenantId,
      holdType: hold_type as HoldType,
      title,
      description,
      circleId: circle_id,
      portalId: portal_id,
      clientRequestId: client_request_id,
      createdByIndividualId: getIndividualId(req),
      metadata,
    });
    
    res.status(201).json(hold);
  } catch (error: any) {
    console.error('Error creating legal hold:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/holds', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const status = req.query.status as 'active' | 'released' | undefined;
    
    const holds = await listHolds(tenantId, status);
    res.json(holds);
  } catch (error: any) {
    console.error('Error listing holds:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/holds/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const holdId = req.params.id;
    
    const hold = await getHold(holdId, tenantId);
    if (!hold) {
      return res.status(404).json({ error: 'Hold not found' });
    }
    
    const [targets, events] = await Promise.all([
      getHoldTargets(holdId, tenantId),
      getHoldEvents(holdId, tenantId),
    ]);
    
    res.json({ ...hold, targets, events });
  } catch (error: any) {
    console.error('Error getting hold:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/holds/:id/targets', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const holdId = req.params.id;
    const {
      target_type,
      target_id,
      table_name,
      scope_filter,
      notes,
    } = req.body;
    
    if (!target_type) {
      return res.status(400).json({ error: 'target_type is required' });
    }
    
    const hold = await getHold(holdId, tenantId);
    if (!hold) {
      return res.status(404).json({ error: 'Hold not found' });
    }
    
    if (hold.holdStatus !== 'active') {
      return res.status(400).json({ error: 'Cannot add targets to a released hold' });
    }
    
    const target = await addHoldTarget({
      holdId,
      tenantId,
      targetType: target_type as HoldTargetType,
      targetId: target_id,
      tableName: table_name,
      scopeFilter: scope_filter,
      addedByIndividualId: getIndividualId(req),
      notes,
    });
    
    res.status(201).json(target);
  } catch (error: any) {
    console.error('Error adding hold target:', error);
    if (error.message.includes('does not exist')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

router.post('/holds/:id/release', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const holdId = req.params.id;
    const { reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({ error: 'reason is required' });
    }
    
    const hold = await releaseHold({
      holdId,
      tenantId,
      reason,
      releasedByIndividualId: getIndividualId(req),
    });
    
    res.json(hold);
  } catch (error: any) {
    console.error('Error releasing hold:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

router.post('/retention-policies', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const {
      circle_id,
      policy_scope,
      retain_days,
      min_severity,
      metadata,
    } = req.body;
    
    if (!policy_scope) {
      return res.status(400).json({ error: 'policy_scope is required' });
    }
    
    const policy = await createRetentionPolicy({
      tenantId,
      circleId: circle_id,
      policyScope: policy_scope as RetentionScope,
      retainDays: retain_days,
      minSeverity: min_severity,
      createdByIndividualId: getIndividualId(req),
      metadata,
    });
    
    res.status(201).json(policy);
  } catch (error: any) {
    console.error('Error creating retention policy:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/retention-policies', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const policies = await listRetentionPolicies(tenantId);
    res.json(policies);
  } catch (error: any) {
    console.error('Error listing retention policies:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
