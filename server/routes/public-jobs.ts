import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { serviceQuery, publicQuery } from '../db/tenantDb';
import { TenantRequest } from '../middleware/tenantContext';

const router = express.Router();

const ALLOWED_UPLOAD_ROLES = ['resumeDocument', 'referenceDocument', 'photo', 'videoIntroduction'] as const;
type AllowedRole = typeof ALLOWED_UPLOAD_ROLES[number];

const ROLE_MIME_ALLOWLIST: Record<AllowedRole, string[]> = {
  resumeDocument: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
  referenceDocument: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
  photo: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
  videoIntroduction: ['video/mp4', 'video/webm', 'video/quicktime']
};

const ROLE_SIZE_LIMITS: Record<AllowedRole, number> = {
  resumeDocument: 10 * 1024 * 1024,
  referenceDocument: 10 * 1024 * 1024,
  photo: 5 * 1024 * 1024,
  videoIntroduction: 100 * 1024 * 1024
};

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

router.get('/portal-settings', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;

  if (!ctx?.portal_id) {
    return res.status(404).json({
      ok: false,
      error: 'PORTAL_NOT_FOUND'
    });
  }

  try {
    const result = await serviceQuery(`
      SELECT id, slug, name, settings
      FROM cc_portals
      WHERE id = $1
    `, [ctx.portal_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'PORTAL_NOT_FOUND'
      });
    }

    const portal = result.rows[0];
    const settings = portal.settings || {};

    res.json({
      ok: true,
      portal: {
        id: portal.id,
        slug: portal.slug,
        name: portal.name,
        ui_settings: settings.ui || {}
      }
    });

  } catch (error: any) {
    console.error('Portal settings fetch error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch portal settings'
    });
  }
});

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
        j.tenant_id as employer_id,
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

router.get('/employers/:employerId', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { employerId } = req.params;

  if (!ctx?.portal_id) {
    return res.status(404).json({
      ok: false,
      error: 'PORTAL_NOT_FOUND'
    });
  }

  try {
    const tenantResult = await serviceQuery(`
      SELECT 
        t.id, t.name, t.legal_dba_name, t.contact_email,
        t.settings
      FROM tenants t
      WHERE t.id = $1
    `, [employerId]);

    if (tenantResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'EMPLOYER_NOT_FOUND'
      });
    }

    const tenant = tenantResult.rows[0];
    const settings = tenant.settings || {};

    const jobsResult = await serviceQuery(`
      SELECT 
        j.id, j.title, j.slug, j.role_category, j.employment_type,
        j.location_text, j.description,
        j.pay_type, j.pay_min, j.pay_max, j.currency,
        j.housing_provided,
        j.brand_name_snapshot, j.legal_name_snapshot,
        j.tenant_id as employer_id,
        jp.id as posting_id,
        jp.posted_at, jp.published_at
      FROM cc_job_postings jp
      JOIN cc_jobs j ON j.id = jp.job_id
      WHERE jp.portal_id = $1
        AND j.tenant_id = $2
        AND jp.publish_state = 'published'
        AND jp.is_hidden = false
        AND (jp.expires_at IS NULL OR jp.expires_at > now())
        AND j.status = 'open'
      ORDER BY jp.posted_at DESC
    `, [ctx.portal_id, employerId]);

    res.json({
      ok: true,
      employer: {
        id: tenant.id,
        name: tenant.name,
        legal_name: tenant.legal_dba_name,
        description: settings.about || settings.description || null,
        website: settings.website || null,
        logo_url: settings.logo_url || null
      },
      jobs: jobsResult.rows
    });

  } catch (error: any) {
    console.error('Employer page fetch error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch employer'
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
      SELECT id, job_id, portal_id, expires_at, used_at
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

    if (session.used_at) {
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

    if (session.portal_id !== ctx.portal_id) {
      return res.status(401).json({
        ok: false,
        error: 'SESSION_PORTAL_MISMATCH'
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
      UPDATE cc_public_upload_sessions SET used_at = now() WHERE id = $1
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

router.post('/jobs/upload-url', async (req: Request, res: Response) => {
  const { sessionToken, role, mimeType, fileSize } = req.body;

  if (!sessionToken) {
    return res.status(401).json({
      ok: false,
      error: 'SESSION_TOKEN_REQUIRED'
    });
  }

  if (!role || !ALLOWED_UPLOAD_ROLES.includes(role as AllowedRole)) {
    return res.status(400).json({
      ok: false,
      error: 'INVALID_ROLE',
      message: `Role must be one of: ${ALLOWED_UPLOAD_ROLES.join(', ')}`
    });
  }

  const typedRole = role as AllowedRole;

  if (!mimeType) {
    return res.status(400).json({
      ok: false,
      error: 'MIME_TYPE_REQUIRED'
    });
  }

  const allowedMimes = ROLE_MIME_ALLOWLIST[typedRole];
  if (!allowedMimes.includes(mimeType)) {
    return res.status(400).json({
      ok: false,
      error: 'MIME_TYPE_NOT_ALLOWED',
      message: `For role '${role}', allowed MIME types are: ${allowedMimes.join(', ')}`
    });
  }

  if (fileSize) {
    const sizeLimit = ROLE_SIZE_LIMITS[typedRole];
    if (fileSize > sizeLimit) {
      return res.status(400).json({
        ok: false,
        error: 'FILE_TOO_LARGE',
        message: `For role '${role}', maximum file size is ${Math.floor(sizeLimit / 1024 / 1024)}MB`
      });
    }
  }

  const sessionTokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');

  try {
    const sessionResult = await serviceQuery(`
      SELECT id, expires_at, used_at
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

    if (session.used_at) {
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
      INSERT INTO cc_public_upload_session_media (session_id, media_id, role, mime_type)
      VALUES ($1, $2, $3, $4)
    `, [session.id, mediaId, role, mimeType]);

    res.json({
      ok: true,
      mediaId,
      uploadUrl: `/api/cc_media/upload/${mediaId}`,
      expiresIn: 300
    });

  } catch (error: any) {
    console.error('Upload URL error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to generate upload URL'
    });
  }
});

router.post('/jobs/attach', async (req: Request, res: Response) => {
  const { sessionToken, mediaId, role } = req.body;

  if (!sessionToken) {
    return res.status(401).json({
      ok: false,
      error: 'SESSION_TOKEN_REQUIRED'
    });
  }

  if (!mediaId) {
    return res.status(400).json({
      ok: false,
      error: 'MEDIA_ID_REQUIRED'
    });
  }

  if (!role || !ALLOWED_UPLOAD_ROLES.includes(role as AllowedRole)) {
    return res.status(400).json({
      ok: false,
      error: 'INVALID_ROLE',
      message: `Role must be one of: ${ALLOWED_UPLOAD_ROLES.join(', ')}`
    });
  }

  const sessionTokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');

  try {
    const sessionResult = await serviceQuery(`
      SELECT id, expires_at, used_at
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

    if (session.used_at) {
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

    await serviceQuery(`
      INSERT INTO cc_public_upload_session_media (session_id, media_id, role)
      VALUES ($1, $2, $3)
      ON CONFLICT (session_id, role) DO UPDATE SET media_id = EXCLUDED.media_id
    `, [session.id, mediaId, role]);

    res.json({
      ok: true,
      attached: true
    });

  } catch (error: any) {
    console.error('Attach error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to attach media'
    });
  }
});

// Campaign definitions - v1 supported campaigns
const CAMPAIGN_DEFINITIONS: Record<string, {
  name: string;
  description: string;
  roleCategories: string[];
}> = {
  hospitality_all: {
    name: 'All Hospitality Roles',
    description: 'Apply to all hospitality positions including servers, bartenders, and hotel staff',
    roleCategories: ['hospitality', 'food_service', 'accommodation']
  },
  trades_all: {
    name: 'All Trades Roles',
    description: 'Apply to all trades positions including construction, maintenance, and skilled labor',
    roleCategories: ['trades', 'construction', 'maintenance', 'skilled_labor']
  },
  crew_all: {
    name: 'All Crew Roles',
    description: 'Apply to all crew and general labor positions',
    roleCategories: ['crew', 'general_labor', 'outdoor', 'marine']
  },
  all_roles: {
    name: 'All Available Roles',
    description: 'Apply to all currently available positions',
    roleCategories: []
  }
};

router.get('/jobs/campaigns', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;

  if (!ctx?.portal_id) {
    return res.status(404).json({
      ok: false,
      error: 'PORTAL_NOT_FOUND'
    });
  }

  try {
    const portalResult = await serviceQuery(`
      SELECT id, slug, name, settings
      FROM cc_portals
      WHERE id = $1
    `, [ctx.portal_id]);

    if (portalResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'PORTAL_NOT_FOUND'
      });
    }

    const portal = portalResult.rows[0];
    const portalSettings = portal.settings || {};
    const enabledCampaigns = portalSettings.enabled_campaigns || ['hospitality_all', 'trades_all', 'crew_all', 'all_roles'];

    const jobCountsResult = await serviceQuery(`
      SELECT j.role_category, COUNT(*)::int as count
      FROM cc_job_postings jp
      JOIN cc_jobs j ON j.id = jp.job_id
      WHERE jp.portal_id = $1
        AND jp.publish_state = 'published'
        AND jp.is_hidden = false
      GROUP BY j.role_category
    `, [ctx.portal_id]);

    const categoryCounts: Record<string, number> = {};
    let totalJobs = 0;
    for (const row of jobCountsResult.rows) {
      categoryCounts[row.role_category] = row.count;
      totalJobs += row.count;
    }

    const campaigns = enabledCampaigns
      .filter((key: string) => CAMPAIGN_DEFINITIONS[key])
      .map((key: string) => {
        const def = CAMPAIGN_DEFINITIONS[key];
        let jobCount = 0;
        if (def.roleCategories.length === 0) {
          jobCount = totalJobs;
        } else {
          for (const cat of def.roleCategories) {
            jobCount += categoryCounts[cat] || 0;
          }
        }
        return {
          key,
          name: def.name,
          description: def.description,
          jobCount
        };
      })
      .filter((c: any) => c.jobCount > 0);

    res.json({
      ok: true,
      campaigns,
      portalName: portal.name,
      portalSlug: portal.slug
    });

  } catch (error: any) {
    console.error('Get campaigns error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to get campaigns'
    });
  }
});

router.post('/jobs/campaign-apply', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const {
    campaignKey,
    applicantName,
    applicantEmail,
    applicantPhone,
    applicantLocation,
    housingNeeded,
    workPermitQuestion,
    message,
    selectedJobPostingIds,
    uploadSessionToken,
    consentGiven
  } = req.body;

  if (!ctx?.portal_id) {
    return res.status(404).json({
      ok: false,
      error: 'PORTAL_NOT_FOUND'
    });
  }

  if (!campaignKey || !applicantName || !applicantEmail) {
    return res.status(400).json({
      ok: false,
      error: 'VALIDATION_ERROR',
      message: 'campaignKey, applicantName, and applicantEmail are required'
    });
  }

  if (!consentGiven) {
    return res.status(400).json({
      ok: false,
      error: 'CONSENT_REQUIRED',
      message: 'You must consent to sending your application to multiple employers'
    });
  }

  const campaignDef = CAMPAIGN_DEFINITIONS[campaignKey];
  if (!campaignDef) {
    return res.status(400).json({
      ok: false,
      error: 'INVALID_CAMPAIGN',
      message: `Unknown campaign: ${campaignKey}`
    });
  }

  try {
    let jobPostingsToApply: any[] = [];

    if (selectedJobPostingIds && selectedJobPostingIds.length > 0) {
      const selectedResult = await serviceQuery(`
        SELECT jp.id as posting_id, jp.job_id, j.tenant_id, j.title
        FROM cc_job_postings jp
        JOIN cc_jobs j ON j.id = jp.job_id
        WHERE jp.id = ANY($1)
          AND jp.portal_id = $2
          AND jp.publish_state = 'published'
          AND jp.is_hidden = false
      `, [selectedJobPostingIds, ctx.portal_id]);
      jobPostingsToApply = selectedResult.rows;
    } else {
      const categoryFilter = campaignDef.roleCategories.length > 0
        ? `AND j.role_category = ANY($2)`
        : '';
      const params = campaignDef.roleCategories.length > 0
        ? [ctx.portal_id, campaignDef.roleCategories]
        : [ctx.portal_id];
      
      const jobsResult = await serviceQuery(`
        SELECT jp.id as posting_id, jp.job_id, j.tenant_id, j.title
        FROM cc_job_postings jp
        JOIN cc_jobs j ON j.id = jp.job_id
        WHERE jp.portal_id = $1
          AND jp.publish_state = 'published'
          AND jp.is_hidden = false
          ${categoryFilter}
        ORDER BY jp.published_at DESC
        LIMIT 50
      `, params);
      jobPostingsToApply = jobsResult.rows;
    }

    if (jobPostingsToApply.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'NO_JOBS_AVAILABLE',
        message: 'No jobs available for this campaign'
      });
    }

    const bundleResult = await serviceQuery(`
      INSERT INTO cc_job_application_bundles (
        portal_id, campaign_key, applicant_name, applicant_email, applicant_phone,
        applicant_location, housing_needed, work_permit_question, message,
        consent_given, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'submitted')
      RETURNING id
    `, [
      ctx.portal_id, campaignKey, applicantName, applicantEmail, applicantPhone || null,
      applicantLocation || null, housingNeeded || false, workPermitQuestion || null, message || null,
      true
    ]);

    const bundleId = bundleResult.rows[0].id;

    let individualId: string;
    const existingIndividual = await serviceQuery(`
      SELECT id FROM cc_individuals WHERE email = $1
    `, [applicantEmail.toLowerCase()]);

    if (existingIndividual.rows.length > 0) {
      individualId = existingIndividual.rows[0].id;
    } else {
      const newIndividual = await serviceQuery(`
        INSERT INTO cc_individuals (full_name, email, telephone)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [applicantName, applicantEmail.toLowerCase(), applicantPhone || '']);
      individualId = newIndividual.rows[0].id;
    }

    const applicationIds: string[] = [];
    const appliedJobs: { jobId: string; title: string; tenantId: string }[] = [];

    for (const posting of jobPostingsToApply) {
      try {
        const existingApp = await serviceQuery(`
          SELECT id FROM cc_job_applications
          WHERE job_posting_id = $1 AND applicant_individual_id = $2
        `, [posting.posting_id, individualId]);

        let applicationId: string;

        if (existingApp.rows.length > 0) {
          applicationId = existingApp.rows[0].id;
        } else {
          const appNumberResult = await serviceQuery(`
            SELECT 'APP-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                   LPAD(COALESCE(
                     (SELECT COUNT(*) + 1 FROM cc_job_applications 
                      WHERE tenant_id = $1 
                      AND created_at::date = CURRENT_DATE), 1
                   )::text, 4, '0') as app_number
          `, [posting.tenant_id]);

          const appResult = await serviceQuery(`
            INSERT INTO cc_job_applications (
              tenant_id, job_id, job_posting_id, applicant_individual_id,
              application_number, status, source_channel,
              needs_accommodation, accommodation_notes,
              submitted_at
            ) VALUES (
              $1, $2, $3, $4, $5, 'submitted', 'campaign_apply',
              $6, $7, now()
            ) RETURNING id
          `, [
            posting.tenant_id, posting.job_id, posting.posting_id, individualId,
            appNumberResult.rows[0].app_number,
            housingNeeded || false, message || null
          ]);
          applicationId = appResult.rows[0].id;

          await serviceQuery(`
            UPDATE cc_jobs SET application_count = application_count + 1 WHERE id = $1
          `, [posting.job_id]);
        }

        await serviceQuery(`
          INSERT INTO cc_job_application_bundle_items (
            bundle_id, job_posting_id, job_id, tenant_id, application_id
          ) VALUES ($1, $2, $3, $4, $5)
        `, [bundleId, posting.posting_id, posting.job_id, posting.tenant_id, applicationId]);

        applicationIds.push(applicationId);
        appliedJobs.push({
          jobId: posting.job_id,
          title: posting.title,
          tenantId: posting.tenant_id
        });

      } catch (appError: any) {
        console.error(`Failed to create application for job ${posting.job_id}:`, appError);
      }
    }

    if (uploadSessionToken) {
      const sessionTokenHash = crypto.createHash('sha256').update(uploadSessionToken).digest('hex');
      await serviceQuery(`
        UPDATE cc_public_upload_sessions SET used_at = now() WHERE session_token_hash = $1
      `, [sessionTokenHash]);
    }

    res.json({
      ok: true,
      bundleId,
      applicationIds,
      appliedCount: appliedJobs.length,
      appliedJobs: appliedJobs.map(j => ({ jobId: j.jobId, title: j.title }))
    });

  } catch (error: any) {
    console.error('Campaign apply error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to submit campaign application'
    });
  }
});

router.post('/jobs/campaign-apply/start-session', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { campaignKey } = req.body;

  if (!ctx?.portal_id) {
    return res.status(404).json({
      ok: false,
      error: 'PORTAL_NOT_FOUND'
    });
  }

  if (!campaignKey) {
    return res.status(400).json({
      ok: false,
      error: 'CAMPAIGN_KEY_REQUIRED'
    });
  }

  try {
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const sessionTokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await serviceQuery(`
      INSERT INTO cc_public_upload_sessions 
        (session_token_hash, purpose, portal_id, expires_at)
      VALUES ($1, 'campaign_apply', $2, $3)
    `, [sessionTokenHash, ctx.portal_id, expiresAt]);

    res.json({
      ok: true,
      sessionToken,
      expiresAt: expiresAt.toISOString()
    });

  } catch (error: any) {
    console.error('Start campaign session error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to start session'
    });
  }
});

export default router;
