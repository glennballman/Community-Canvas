/**
 * V3.5 QA Runner Routes
 * DEV-only endpoint to run smoke test suites
 * 
 * POST /api/dev/qa/run
 * Body: { suite: "pre_demo_smoke" | "auth_only" | "calendar_only" | "workflows_only" | "critical_pages" }
 */

import { Router, Request, Response } from 'express';
import { runSuite, SuiteName } from '../dev/qa/runner';

const router = Router();

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const ALLOW_DEV_QA = process.env.ALLOW_DEV_QA === 'true';
const DEV_QA_SECRET = process.env.DEV_QA_SECRET;

const VALID_SUITES: SuiteName[] = [
  'pre_demo_smoke',
  'auth_only',
  'calendar_only',
  'workflows_only',
  'critical_pages'
];

/**
 * Check if QA runner is allowed
 */
function isQaRunnerAllowed(): boolean {
  if (IS_PRODUCTION) return false;
  if (!ALLOW_DEV_QA) return false;
  return true;
}

/**
 * POST /api/dev/qa/run
 * Run a QA test suite
 */
router.post('/run', async (req: Request, res: Response) => {
  // Guard: DEV-only
  if (!isQaRunnerAllowed()) {
    return res.status(404).json({ error: 'Not found' });
  }
  
  // Optional: Check DEV_QA_SECRET header if configured
  if (DEV_QA_SECRET) {
    const headerSecret = req.header('X-DEV-QA');
    if (headerSecret !== DEV_QA_SECRET) {
      return res.status(401).json({ ok: false, error: 'Invalid X-DEV-QA header' });
    }
  }
  
  const { suite } = req.body;
  
  if (!suite || !VALID_SUITES.includes(suite)) {
    return res.status(400).json({ 
      ok: false, 
      error: `Invalid suite. Valid suites: ${VALID_SUITES.join(', ')}` 
    });
  }
  
  try {
    console.log(`[QA RUNNER] Starting suite: ${suite}`);
    const result = await runSuite(suite);
    console.log(`[QA RUNNER] Completed ${suite}: ${result.ok ? 'PASS' : 'FAIL'} (${result.totalMs}ms)`);
    
    return res.json(result);
  } catch (e: any) {
    console.error(`[QA RUNNER] Suite ${suite} failed:`, e);
    return res.status(500).json({
      ok: false,
      error: e.message || 'Suite execution failed'
    });
  }
});

/**
 * GET /api/dev/qa/suites
 * List available suites
 */
router.get('/suites', (req: Request, res: Response) => {
  if (!isQaRunnerAllowed()) {
    return res.status(404).json({ error: 'Not found' });
  }
  
  return res.json({
    suites: VALID_SUITES.map(s => ({
      id: s,
      label: s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    }))
  });
});

export default router;
