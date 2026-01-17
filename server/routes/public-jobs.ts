import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { serviceQuery, publicQuery } from '../db/tenantDb';
import { TenantRequest } from '../middleware/tenantContext';

const router = express.Router();

function toSchemaOrgJobPosting(job: any, posting: any): any {
  const hiringOrg: any = {
    "@type": "Organization",
    name: job.brand_name_snapshot || job.legal_name_snapshot || "Unknown Employer"
  };
  if (job.legal_trade_name_snapshot && job.legal_name_snapshot) {
    hiringOrg.legalName = job.legal_name_snapshot;
    hiringOrg.alternateName = job.legal_trade_name_snapshot;
  }

  const schema: any = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    identifier: {
      "@type": "PropertyValue",
      name: "Community Canvas Job ID",
      value: job.id
    },
    title: posting?.custom_title || job.title,
    description: posting?.custom_description || job.description,
    datePosted: posting?.posted_at || job.created_at,
    hiringOrganization: hiringOrg,
    employmentType: job.employment_type?.toUpperCase() || "FULL_TIME",
  };

  if (job.occupational_category || job.noc_code) {
    schema.occupationalCategory = job.occupational_category || `NOC ${job.noc_code}`;
  }

  if (job.location_text) {
    schema.jobLocation = {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: job.location_text
      }
    };
    if (job.latitude && job.longitude) {
      schema.jobLocation.geo = {
        "@type": "GeoCoordinates",
        latitude: parseFloat(job.latitude),
        longitude: parseFloat(job.longitude)
      };
    }
  }

  if (job.pay_min || job.pay_max) {
    schema.baseSalary = {
      "@type": "MonetaryAmount",
      currency: job.currency || "CAD",
      value: {
        "@type": "QuantitativeValue",
        minValue: job.pay_min ? parseFloat(job.pay_min) : undefined,
        maxValue: job.pay_max ? parseFloat(job.pay_max) : undefined,
        unitText: job.pay_type === "hourly" ? "HOUR" : job.pay_type === "salary" ? "YEAR" : "HOUR"
      }
    };
  }

  if (posting?.expires_at || job.expires_at) {
    schema.validThrough = posting?.expires_at || job.expires_at;
  }

  return schema;
}

router.get('/jobs', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;

  if (!ctx?.portal_id) {
    return res.status(404).json({
      ok: false,
      error: 'PORTAL_NOT_FOUND',
      message: 'Unable to determine portal from request'
    });
  }

  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const roleCategory = req.query.roleCategory as string;
    const employmentType = req.query.employmentType as string;

    let whereClause = `
      WHERE jp.portal_id = $1
        AND jp.publish_state = 'published'
        AND jp.is_hidden = false
        AND (jp.expires_at IS NULL OR jp.expires_at > now())
        AND j.status = 'open'
    `;
    const params: any[] = [ctx.portal_id];

    if (roleCategory) {
      params.push(roleCategory);
      whereClause += ` AND j.role_category = $${params.length}`;
    }
    if (employmentType) {
      params.push(employmentType);
      whereClause += ` AND j.employment_type = $${params.length}`;
    }

    params.push(limit, offset);

    const result = await serviceQuery(`
      SELECT 
        j.id, j.title, j.slug, j.role_category, j.employment_type,
        j.location_text, j.latitude, j.longitude,
        j.description, j.responsibilities, j.requirements, j.nice_to_have,
        j.start_date, j.end_date, j.is_flexible_dates, j.hours_per_week, j.shift_details,
        j.urgency, j.housing_provided, j.housing_type, j.housing_description,
        j.rv_friendly, j.meals_provided, j.transport_assistance, j.relocation_assistance,
        j.pay_type, j.pay_min, j.pay_max, j.currency, j.benefits_description,
        j.disclosed_pay_min, j.disclosed_pay_max, j.show_pay,
        j.noc_code, j.soc_code, j.occupational_category, j.taxonomy,
        j.brand_name_snapshot, j.legal_name_snapshot, j.legal_trade_name_snapshot,
        j.status, j.view_count, j.application_count,
        j.created_at,
        jp.id as posting_id, jp.custom_title, jp.custom_description,
        jp.is_featured, jp.is_pinned, jp.pin_rank,
        jp.posted_at, jp.expires_at, jp.published_at
      FROM cc_job_postings jp
      JOIN cc_jobs j ON j.id = jp.job_id
      ${whereClause}
      ORDER BY jp.is_pinned DESC, jp.pin_rank ASC NULLS LAST, jp.is_featured DESC, jp.posted_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    const countResult = await serviceQuery(`
      SELECT COUNT(*) as total
      FROM cc_job_postings jp
      JOIN cc_jobs j ON j.id = jp.job_id
      ${whereClause}
    `, params.slice(0, -2));

    const jobs = result.rows.map(row => ({
      ...row,
      schemaOrg: toSchemaOrgJobPosting(row, row)
    }));

    res.json({
      ok: true,
      jobs,
      pagination: {
        total: parseInt(countResult.rows[0]?.total || '0'),
        limit,
        offset,
        hasMore: offset + jobs.length < parseInt(countResult.rows[0]?.total || '0')
      }
    });

  } catch (error: any) {
    console.error('Public jobs fetch error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch jobs'
    });
  }
});

router.get('/jobs/:id', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { id } = req.params;

  if (!ctx?.portal_id) {
    return res.status(404).json({
      ok: false,
      error: 'PORTAL_NOT_FOUND'
    });
  }

  try {
    const result = await serviceQuery(`
      SELECT 
        j.*, 
        jp.id as posting_id, jp.custom_title, jp.custom_description,
        jp.is_featured, jp.is_pinned, jp.pin_rank,
        jp.posted_at, jp.expires_at, jp.published_at, jp.publish_state
      FROM cc_job_postings jp
      JOIN cc_jobs j ON j.id = jp.job_id
      WHERE j.id = $1
        AND jp.portal_id = $2
        AND jp.publish_state = 'published'
        AND jp.is_hidden = false
        AND (jp.expires_at IS NULL OR jp.expires_at > now())
    `, [id, ctx.portal_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'JOB_NOT_FOUND'
      });
    }

    await serviceQuery(`
      UPDATE cc_jobs SET view_count = view_count + 1 WHERE id = $1
    `, [id]);

    const job = result.rows[0];

    res.json({
      ok: true,
      job,
      schemaOrg: toSchemaOrgJobPosting(job, job)
    });

  } catch (error: any) {
    console.error('Public job detail fetch error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch job'
    });
  }
});

router.post('/jobs/:id/start-apply', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { id } = req.params;

  if (!ctx?.portal_id) {
    return res.status(404).json({
      ok: false,
      error: 'PORTAL_NOT_FOUND'
    });
  }

  try {
    const jobResult = await serviceQuery(`
      SELECT j.id, j.tenant_id
      FROM cc_job_postings jp
      JOIN cc_jobs j ON j.id = jp.job_id
      WHERE j.id = $1
        AND jp.portal_id = $2
        AND jp.publish_state = 'published'
        AND jp.is_hidden = false
        AND (jp.expires_at IS NULL OR jp.expires_at > now())
    `, [id, ctx.portal_id]);

    if (jobResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'JOB_NOT_FOUND'
      });
    }

    const sessionToken = crypto.randomBytes(32).toString('hex');
    const sessionTokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await serviceQuery(`
      INSERT INTO cc_public_upload_sessions 
        (session_token_hash, purpose, portal_id, job_id, expires_at)
      VALUES ($1, 'job_application', $2, $3, $4)
    `, [sessionTokenHash, ctx.portal_id, id, expiresAt]);

    res.json({
      ok: true,
      sessionToken,
      expiresAt: expiresAt.toISOString()
    });

  } catch (error: any) {
    console.error('Start apply error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to start application'
    });
  }
});

router.post('/jobs/:id/apply', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { id } = req.params;
  const { sessionToken, ...applicationData } = req.body;

  if (!ctx?.portal_id) {
    return res.status(404).json({
      ok: false,
      error: 'PORTAL_NOT_FOUND'
    });
  }

  if (!sessionToken) {
    return res.status(400).json({
      ok: false,
      error: 'SESSION_TOKEN_REQUIRED'
    });
  }

  const sessionTokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');

  try {
    const sessionResult = await serviceQuery(`
      SELECT id, job_id, expires_at, consumed_at
      FROM cc_public_upload_sessions
      WHERE session_token_hash = $1
        AND purpose = 'job_application'
    `, [sessionTokenHash]);

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({
        ok: false,
        error: 'INVALID_SESSION'
      });
    }

    const session = sessionResult.rows[0];

    if (session.consumed_at) {
      return res.status(401).json({
        ok: false,
        error: 'SESSION_ALREADY_USED'
      });
    }

    if (new Date(session.expires_at) < new Date()) {
      return res.status(401).json({
        ok: false,
        error: 'SESSION_EXPIRED'
      });
    }

    if (session.job_id !== id) {
      return res.status(401).json({
        ok: false,
        error: 'SESSION_JOB_MISMATCH'
      });
    }

    const jobResult = await serviceQuery(`
      SELECT j.id, j.tenant_id, j.title
      FROM cc_job_postings jp
      JOIN cc_jobs j ON j.id = jp.job_id
      WHERE j.id = $1
        AND jp.portal_id = $2
        AND jp.publish_state = 'published'
    `, [id, ctx.portal_id]);

    if (jobResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'JOB_NOT_FOUND'
      });
    }

    const job = jobResult.rows[0];

    const uploadedMedia = await serviceQuery(`
      SELECT media_id, role FROM cc_public_upload_session_media WHERE session_id = $1
    `, [session.id]);

    const mediaByRole: Record<string, string> = {};
    for (const m of uploadedMedia.rows) {
      mediaByRole[m.role] = m.media_id;
    }

    const appResult = await serviceQuery(`
      INSERT INTO cc_job_applications (
        tenant_id, job_id, portal_id, status,
        applicant_first_name, applicant_last_name, applicant_email, applicant_phone,
        cover_letter, availability_start_date, work_authorization,
        submitted_at
      ) VALUES (
        $1, $2, $3, 'applied',
        $4, $5, $6, $7,
        $8, $9, $10,
        now()
      ) RETURNING id
    `, [
      job.tenant_id, id, ctx.portal_id,
      applicationData.firstName, applicationData.lastName,
      applicationData.email, applicationData.phone,
      applicationData.coverLetter, applicationData.availabilityStartDate,
      applicationData.workAuthorization
    ]);

    await serviceQuery(`
      UPDATE cc_public_upload_sessions SET consumed_at = now() WHERE id = $1
    `, [session.id]);

    await serviceQuery(`
      UPDATE cc_jobs SET application_count = application_count + 1 WHERE id = $1
    `, [id]);

    res.json({
      ok: true,
      applicationId: appResult.rows[0].id,
      message: 'Application submitted successfully'
    });

  } catch (error: any) {
    console.error('Submit application error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to submit application'
    });
  }
});

router.post('/jobs/upload', async (req: Request, res: Response) => {
  const { sessionToken, role } = req.body;

  if (!sessionToken) {
    return res.status(401).json({
      ok: false,
      error: 'SESSION_TOKEN_REQUIRED'
    });
  }

  const sessionTokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');

  try {
    const sessionResult = await serviceQuery(`
      SELECT id, expires_at, consumed_at
      FROM cc_public_upload_sessions
      WHERE session_token_hash = $1
        AND purpose = 'job_application'
    `, [sessionTokenHash]);

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({
        ok: false,
        error: 'INVALID_SESSION'
      });
    }

    const session = sessionResult.rows[0];

    if (session.consumed_at) {
      return res.status(401).json({
        ok: false,
        error: 'SESSION_ALREADY_USED'
      });
    }

    if (new Date(session.expires_at) < new Date()) {
      return res.status(401).json({
        ok: false,
        error: 'SESSION_EXPIRED'
      });
    }

    const mediaId = crypto.randomUUID();
    await serviceQuery(`
      INSERT INTO cc_public_upload_session_media (session_id, media_id, role)
      VALUES ($1, $2, $3)
    `, [session.id, mediaId, role || 'resume']);

    res.json({
      ok: true,
      mediaId,
      message: 'Upload placeholder created. File upload handling would go here.'
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to process upload'
    });
  }
});

export default router;
