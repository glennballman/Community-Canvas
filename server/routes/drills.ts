import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  startDrillSession,
  completeDrillSession,
  cancelDrillSession,
  generateSyntheticRecords,
  getDrillSession,
  listDrillSessions,
  createDrillScript,
  getDrillScript,
  listDrillScripts,
  getDrillRecordCounts,
  purgeDrillRecords,
  DrillScenarioType,
} from '../lib/drills/generate';

const router = Router();

const scenarioTypeSchema = z.enum([
  'tsunami', 'wildfire', 'power_outage', 'storm', 'evacuation', 'multi_hazard', 'other'
]);

const startDrillSchema = z.object({
  tenantId: z.string().uuid(),
  scenarioType: scenarioTypeSchema,
  title: z.string().optional(),
  portalId: z.string().uuid().optional(),
  circleId: z.string().uuid().optional(),
  startedByIndividualId: z.string().uuid().optional(),
  clientRequestId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const completeDrillSchema = z.object({
  completedByIndividualId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

const createScriptSchema = z.object({
  tenantId: z.string().uuid(),
  title: z.string(),
  scenarioType: scenarioTypeSchema,
  scriptJson: z.record(z.unknown()),
  createdByIndividualId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

router.post('/sessions', async (req: Request, res: Response) => {
  try {
    const body = startDrillSchema.parse(req.body);
    const drillId = await startDrillSession(body);
    res.json({ ok: true, drillId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ ok: false, error: 'Validation error', details: error.errors });
    } else {
      console.error('Error starting drill session:', error);
      res.status(500).json({ ok: false, error: 'Failed to start drill session' });
    }
  }
});

router.get('/sessions/:id', async (req: Request, res: Response) => {
  try {
    const session = await getDrillSession(req.params.id);
    if (!session) {
      res.status(404).json({ ok: false, error: 'Drill session not found' });
      return;
    }
    res.json({ ok: true, session });
  } catch (error) {
    console.error('Error getting drill session:', error);
    res.status(500).json({ ok: false, error: 'Failed to get drill session' });
  }
});

router.get('/sessions', async (req: Request, res: Response) => {
  try {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) {
      res.status(400).json({ ok: false, error: 'tenantId query parameter is required' });
      return;
    }
    
    const status = req.query.status as 'active' | 'completed' | 'cancelled' | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    
    const sessions = await listDrillSessions(tenantId, status, limit);
    res.json({ ok: true, sessions });
  } catch (error) {
    console.error('Error listing drill sessions:', error);
    res.status(500).json({ ok: false, error: 'Failed to list drill sessions' });
  }
});

router.post('/sessions/:id/complete', async (req: Request, res: Response) => {
  try {
    const body = completeDrillSchema.parse(req.body);
    await completeDrillSession(req.params.id, body.completedByIndividualId, body.notes);
    res.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ ok: false, error: 'Validation error', details: error.errors });
    } else {
      console.error('Error completing drill session:', error);
      res.status(500).json({ ok: false, error: 'Failed to complete drill session' });
    }
  }
});

router.post('/sessions/:id/cancel', async (req: Request, res: Response) => {
  try {
    await cancelDrillSession(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    console.error('Error cancelling drill session:', error);
    res.status(500).json({ ok: false, error: 'Failed to cancel drill session' });
  }
});

router.post('/sessions/:id/generate', async (req: Request, res: Response) => {
  try {
    const session = await getDrillSession(req.params.id);
    if (!session) {
      res.status(404).json({ ok: false, error: 'Drill session not found' });
      return;
    }
    
    if (session.status !== 'active') {
      res.status(400).json({ ok: false, error: 'Cannot generate records for non-active drill session' });
      return;
    }
    
    const records = await generateSyntheticRecords(
      req.params.id,
      session.tenant_id as string,
      session.scenario_type as DrillScenarioType
    );
    
    res.json({ ok: true, records });
  } catch (error) {
    console.error('Error generating synthetic records:', error);
    res.status(500).json({ ok: false, error: 'Failed to generate synthetic records' });
  }
});

router.get('/sessions/:id/counts', async (req: Request, res: Response) => {
  try {
    const counts = await getDrillRecordCounts(req.params.id);
    res.json({ ok: true, counts });
  } catch (error) {
    console.error('Error getting drill record counts:', error);
    res.status(500).json({ ok: false, error: 'Failed to get drill record counts' });
  }
});

router.delete('/sessions/:id/records', async (req: Request, res: Response) => {
  try {
    const session = await getDrillSession(req.params.id);
    if (!session) {
      res.status(404).json({ ok: false, error: 'Drill session not found' });
      return;
    }
    
    const counts = await purgeDrillRecords(req.params.id);
    res.json({ ok: true, purged: counts });
  } catch (error) {
    console.error('Error purging drill records:', error);
    res.status(500).json({ ok: false, error: 'Failed to purge drill records' });
  }
});

router.post('/scripts', async (req: Request, res: Response) => {
  try {
    const body = createScriptSchema.parse(req.body);
    const scriptId = await createDrillScript(body);
    res.json({ ok: true, scriptId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ ok: false, error: 'Validation error', details: error.errors });
    } else {
      console.error('Error creating drill script:', error);
      res.status(500).json({ ok: false, error: 'Failed to create drill script' });
    }
  }
});

router.get('/scripts/:id', async (req: Request, res: Response) => {
  try {
    const script = await getDrillScript(req.params.id);
    if (!script) {
      res.status(404).json({ ok: false, error: 'Drill script not found' });
      return;
    }
    res.json({ ok: true, script });
  } catch (error) {
    console.error('Error getting drill script:', error);
    res.status(500).json({ ok: false, error: 'Failed to get drill script' });
  }
});

router.get('/scripts', async (req: Request, res: Response) => {
  try {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) {
      res.status(400).json({ ok: false, error: 'tenantId query parameter is required' });
      return;
    }
    
    const scenarioType = req.query.scenarioType as DrillScenarioType | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    
    const scripts = await listDrillScripts(tenantId, scenarioType, limit);
    res.json({ ok: true, scripts });
  } catch (error) {
    console.error('Error listing drill scripts:', error);
    res.status(500).json({ ok: false, error: 'Failed to list drill scripts' });
  }
});

export default router;
