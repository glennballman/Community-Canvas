import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requirePlatformRole, isServiceKeyRequest } from '../middleware/guards';
import { db } from '../db';
import { eq, desc } from 'drizzle-orm';
import {
  scmModules,
  scmProofRuns,
  scmModuleOverrides,
  scmCertificationStates,
  scmProofRunTypeEnum,
  scmModuleStateEnum,
} from '@shared/schema';
import {
  recordProofRun,
  setModuleOverride,
  getCertificationStates,
  updateCertificationStates,
  generateCertDecisionReport,
  getLatestProofRun,
} from '../lib/scm/p2_emergency_legal_insurance';

const router = Router();

const requireAdminOrServiceKey = (req: Request, res: Response, next: NextFunction) => {
  if (isServiceKeyRequest(req)) {
    return next();
  }
  return requirePlatformRole('platform_admin')(req, res, next);
};

router.get('/modules', requireAdminOrServiceKey, async (req: Request, res: Response) => {
  try {
    const modules = await db
      .select()
      .from(scmModules)
      .orderBy(scmModules.moduleKey);
    res.json({ modules });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/modules/:moduleKey', requireAdminOrServiceKey, async (req: Request, res: Response) => {
  try {
    const { moduleKey } = req.params;
    const [module] = await db
      .select()
      .from(scmModules)
      .where(eq(scmModules.moduleKey, moduleKey));
    
    if (!module) {
      res.status(404).json({ error: 'Module not found' });
      return;
    }

    const [state] = await db
      .select()
      .from(scmCertificationStates)
      .where(eq(scmCertificationStates.moduleKey, moduleKey));

    const [latestOverride] = await db
      .select()
      .from(scmModuleOverrides)
      .where(eq(scmModuleOverrides.moduleKey, moduleKey))
      .orderBy(desc(scmModuleOverrides.setAt))
      .limit(1);

    res.json({ module, state, latestOverride });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/states', requireAdminOrServiceKey, async (req: Request, res: Response) => {
  try {
    const states = await getCertificationStates();
    res.json({ states });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/states/recompute', requireAdminOrServiceKey, async (req: Request, res: Response) => {
  try {
    await updateCertificationStates();
    const states = await getCertificationStates();
    res.json({ ok: true, states });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const proofRunSchema = z.object({
  run_type: scmProofRunTypeEnum,
  ok: z.boolean(),
  details: z.record(z.unknown()).default({}),
  artifact_refs: z.array(z.string()).default([]),
  module_key: z.string().optional(),
});

router.post('/proof-runs', requireAdminOrServiceKey, async (req: Request, res: Response) => {
  try {
    const parsed = proofRunSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request body', details: parsed.error.issues });
      return;
    }

    const { run_type, ok, details, artifact_refs, module_key } = parsed.data;

    const run = await recordProofRun({
      runType: run_type,
      ok,
      details,
      artifactRefs: artifact_refs,
      moduleKey: module_key,
    });

    res.status(201).json({ ok: true, run_id: run.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/proof-runs', requireAdminOrServiceKey, async (req: Request, res: Response) => {
  try {
    const runType = req.query.run_type as string | undefined;
    const limitVal = parseInt(req.query.limit as string) || 20;

    let runs;
    if (runType) {
      runs = await db
        .select()
        .from(scmProofRuns)
        .where(eq(scmProofRuns.runType, runType))
        .orderBy(desc(scmProofRuns.runAt))
        .limit(limitVal);
    } else {
      runs = await db
        .select()
        .from(scmProofRuns)
        .orderBy(desc(scmProofRuns.runAt))
        .limit(limitVal);
    }

    res.json({ runs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/proof-runs/latest/:runType', requireAdminOrServiceKey, async (req: Request, res: Response) => {
  try {
    const { runType } = req.params;
    const moduleKey = req.query.module_key as string | undefined;

    if (!['qa_status', 'smoke_test', 'sql_verification'].includes(runType)) {
      res.status(400).json({ error: 'Invalid run type' });
      return;
    }

    const run = await getLatestProofRun(runType as any, moduleKey);
    res.json({ run });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const setStateSchema = z.object({
  state: scmModuleStateEnum,
  reason: z.string().optional(),
});

router.post('/modules/:moduleKey/set-state', requireAdminOrServiceKey, async (req: Request, res: Response) => {
  try {
    const { moduleKey } = req.params;
    const parsed = setStateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request body', details: parsed.error.issues });
      return;
    }

    const [module] = await db
      .select()
      .from(scmModules)
      .where(eq(scmModules.moduleKey, moduleKey));

    if (!module) {
      res.status(404).json({ error: 'Module not found' });
      return;
    }

    await setModuleOverride({
      moduleKey,
      overrideState: parsed.data.state,
      overrideReason: parsed.data.reason,
    });

    const [state] = await db
      .select()
      .from(scmCertificationStates)
      .where(eq(scmCertificationStates.moduleKey, moduleKey));

    res.json({ ok: true, state });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/cert-decision-report', requireAdminOrServiceKey, async (req: Request, res: Response) => {
  try {
    const report = await generateCertDecisionReport();
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
