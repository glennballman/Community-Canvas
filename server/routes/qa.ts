import { Router, Request, Response, NextFunction } from 'express';
import { runAllChecks, runSingleCheck } from '../lib/qa/runtimeChecks';
import { requirePlatformRole, isServiceKeyRequest } from '../middleware/guards';
import { recordProofRun } from '../lib/scm/p2_emergency_legal_insurance';

const router = Router();

const requireAdminOrServiceKey = (req: Request, res: Response, next: NextFunction) => {
  if (isServiceKeyRequest(req)) {
    return next();
  }
  return requirePlatformRole('platform_admin')(req, res, next);
};

router.get('/status', requireAdminOrServiceKey, async (req: Request, res: Response) => {
  try {
    const result = await runAllChecks();
    const shouldRecord = req.query.record === '1' || req.query.record === 'true';

    if (shouldRecord) {
      await recordProofRun({
        runType: 'qa_status',
        ok: result.ok,
        details: result as unknown as Record<string, unknown>,
        artifactRefs: [],
      });
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({
      ok: false,
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

router.get('/check/:name', requireAdminOrServiceKey, async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const result = await runSingleCheck(name);

    if (!result) {
      res.status(404).json({
        ok: false,
        error: `Unknown check: ${name}`,
        available_checks: [
          'rls_enabled_critical_tables',
          'legal_hold_triggers_present',
          'idempotency_constraints_present',
          'authority_token_hash_only',
          'emergency_scope_grant_ttl',
          'evidence_chain_integrity',
          'offline_queue_schema',
          'anonymous_groups_k_anonymity',
          'record_capture_schema',
          'claim_dossier_schema',
        ],
      });
      return;
    }

    res.json({
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({
      ok: false,
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
