/**
 * Participant API Routes
 * M-1B: Job Applications for applicants
 */

import express, { Request, Response } from 'express';
import { serviceQuery } from '../db/tenantDb';
import { TenantRequest } from '../middleware/tenantContext';

const router = express.Router();

/**
 * GET /api/participant/applications
 * List all job applications for the authenticated user
 */
router.get('/applications', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;

  if (!ctx?.individual_id) {
    return res.status(401).json({
      ok: false,
      error: { code: 'AUTH_REQUIRED', message: 'Authentication required' }
    });
  }

  try {
    const result = await serviceQuery(`
      SELECT 
        a.id,
        a.job_id,
        a.application_number,
        a.status,
        a.submitted_at,
        j.title as job_title,
        COALESCE(t.name, p.name) as company_name,
        p.name as portal_name,
        CASE 
          WHEN c.unread_contractor > 0 THEN true
          ELSE false
        END as has_unread_messages
      FROM cc_job_applications a
      JOIN cc_jobs j ON j.id = a.job_id
      JOIN cc_job_postings jp ON jp.id = a.job_posting_id
      JOIN cc_portals p ON p.id = jp.portal_id
      LEFT JOIN cc_tenants t ON t.id = j.tenant_id
      LEFT JOIN cc_conversations c ON c.job_application_id = a.id
      WHERE a.applicant_individual_id = $1
      ORDER BY a.submitted_at DESC NULLS LAST, a.created_at DESC
      LIMIT 100
    `, [ctx.individual_id]);

    res.json({
      ok: true,
      applications: result.rows
    });

  } catch (error: any) {
    console.error('Participant applications list error:', error);
    res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL', message: 'Failed to fetch applications' }
    });
  }
});

/**
 * GET /api/participant/applications/:appId
 * Get single application detail for the authenticated user
 */
router.get('/applications/:appId', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { appId } = req.params;

  if (!ctx?.individual_id) {
    return res.status(401).json({
      ok: false,
      error: { code: 'AUTH_REQUIRED', message: 'Authentication required' }
    });
  }

  try {
    const result = await serviceQuery(`
      SELECT 
        a.id,
        a.job_id,
        a.application_number,
        a.status,
        a.submitted_at,
        a.cover_letter,
        j.title as job_title,
        j.description as job_description,
        COALESCE(t.name, p.name) as company_name,
        p.name as portal_name,
        j.location_text as location,
        j.employment_type
      FROM cc_job_applications a
      JOIN cc_jobs j ON j.id = a.job_id
      JOIN cc_job_postings jp ON jp.id = a.job_posting_id
      JOIN cc_portals p ON p.id = jp.portal_id
      LEFT JOIN cc_tenants t ON t.id = j.tenant_id
      WHERE a.id = $1 AND a.applicant_individual_id = $2
    `, [appId, ctx.individual_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Application not found' }
      });
    }

    res.json({
      ok: true,
      application: result.rows[0]
    });

  } catch (error: any) {
    console.error('Participant application detail error:', error);
    res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL', message: 'Failed to fetch application' }
    });
  }
});

export default router;
