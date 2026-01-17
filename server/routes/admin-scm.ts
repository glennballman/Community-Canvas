/**
 * ADMIN SCM ROUTES
 * 
 * Endpoints:
 * - GET /api/admin/scm/latest-p2-operator-cert - Get latest P2 operator certification
 * 
 * All endpoints require platform admin access.
 */

import express, { Response } from 'express';
import fs from 'fs';
import path from 'path';
import { authenticateToken, requirePlatformAdmin, AuthRequest } from './foundation';

const router = express.Router();

router.use(authenticateToken, requirePlatformAdmin);

/**
 * GET /api/admin/scm/latest-p2-operator-cert
 * 
 * Returns the latest P2 operator certification artifact.
 * Reads from artifacts/qa/scm/p2-operator-cert.json if present.
 */
router.get('/latest-p2-operator-cert', async (_req: AuthRequest, res: Response) => {
  try {
    const certPath = path.resolve('artifacts/qa/scm/p2-operator-cert.json');
    
    if (!fs.existsSync(certPath)) {
      return res.json({
        ok: false,
        error: 'Certification artifact not available in this environment.'
      });
    }
    
    const raw = fs.readFileSync(certPath, 'utf8');
    const cert = JSON.parse(raw);
    
    return res.json({
      ok: true,
      cert
    });
  } catch (err: unknown) {
    console.error('Error reading cert:', err);
    return res.json({
      ok: false,
      error: 'Failed to read certification artifact.'
    });
  }
});

export default router;
