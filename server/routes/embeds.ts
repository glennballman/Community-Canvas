import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { serviceQuery } from '../db/tenantDb';
import { TenantRequest } from '../middleware/tenantContext';

const router = express.Router();

function toSchemaOrgJobPosting(job: any): any {
  const hiringOrg: any = {
    "@type": "Organization",
    name: job.brand_name_snapshot || job.legal_name_snapshot || "Employer"
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
    title: job.title,
    description: job.description,
    datePosted: job.created_at,
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
  }

  if (job.pay_min || job.pay_max) {
    schema.baseSalary = {
      "@type": "MonetaryAmount",
      currency: job.currency || "CAD",
      value: {
        "@type": "QuantitativeValue",
        minValue: job.pay_min ? parseFloat(job.pay_min) : undefined,
        maxValue: job.pay_max ? parseFloat(job.pay_max) : undefined,
        unitText: job.pay_type === "hourly" ? "HOUR" : "YEAR"
      }
    };
  }

  return schema;
}

function verifyDomainAllowlist(origin: string | undefined, host: string | undefined, allowedDomains: string[]): boolean {
  if (!allowedDomains || allowedDomains.length === 0) {
    return true;
  }

  let domain = '';
  if (origin) {
    try {
      const url = new URL(origin);
      domain = url.hostname;
    } catch {
      return false;
    }
  } else if (host) {
    domain = host.split(':')[0];
  }

  if (!domain) {
    return false;
  }

  for (const allowed of allowedDomains) {
    if (allowed === '*') return true;
    if (allowed.startsWith('*.')) {
      const suffix = allowed.slice(1);
      if (domain === allowed.slice(2) || domain.endsWith(suffix)) {
        return true;
      }
    } else if (domain === allowed) {
      return true;
    }
  }

  return false;
}

router.get('/feed/:embedKey', async (req: Request, res: Response) => {
  const { embedKey } = req.params;
  const origin = req.headers.origin as string | undefined;
  const host = req.headers.host;

  if (!embedKey) {
    return res.status(400).json({
      ok: false,
      error: 'EMBED_KEY_REQUIRED'
    });
  }

  const embedKeyHash = crypto.createHash('sha256').update(embedKey).digest('hex');

  try {
    const surfaceResult = await serviceQuery(`
      SELECT id, tenant_id, label, allowed_domains, is_active
      FROM cc_embed_surfaces
      WHERE embed_key_hash = $1
    `, [embedKeyHash]);

    if (surfaceResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'EMBED_SURFACE_NOT_FOUND'
      });
    }

    const surface = surfaceResult.rows[0];

    if (!surface.is_active) {
      return res.status(403).json({
        ok: false,
        error: 'EMBED_SURFACE_INACTIVE'
      });
    }

    if (!verifyDomainAllowlist(origin, host, surface.allowed_domains)) {
      return res.status(403).json({
        ok: false,
        error: 'DOMAIN_NOT_ALLOWED',
        message: 'Request origin is not in the allowed domains list'
      });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;

    const jobsResult = await serviceQuery(`
      SELECT 
        j.id, j.title, j.slug, j.role_category, j.employment_type,
        j.location_text, j.latitude, j.longitude,
        j.description, j.responsibilities, j.requirements,
        j.start_date, j.end_date, j.hours_per_week,
        j.housing_provided, j.housing_type,
        j.pay_type, j.pay_min, j.pay_max, j.currency, j.show_pay,
        j.disclosed_pay_min, j.disclosed_pay_max,
        j.noc_code, j.soc_code, j.occupational_category,
        j.brand_name_snapshot, j.legal_name_snapshot, j.legal_trade_name_snapshot,
        j.created_at,
        jep.published_at
      FROM cc_job_embed_publications jep
      JOIN cc_jobs j ON j.id = jep.job_id
      WHERE jep.embed_surface_id = $1
        AND jep.publish_state = 'published'
        AND j.status = 'open'
        AND (j.expires_at IS NULL OR j.expires_at > now())
      ORDER BY jep.published_at DESC
      LIMIT $2 OFFSET $3
    `, [surface.id, limit, offset]);

    const countResult = await serviceQuery(`
      SELECT COUNT(*) as total
      FROM cc_job_embed_publications jep
      JOIN cc_jobs j ON j.id = jep.job_id
      WHERE jep.embed_surface_id = $1
        AND jep.publish_state = 'published'
        AND j.status = 'open'
    `, [surface.id]);

    const jobs = jobsResult.rows.map(job => ({
      ...job,
      showPay: job.show_pay,
      payMin: job.show_pay ? (job.disclosed_pay_min || job.pay_min) : null,
      payMax: job.show_pay ? (job.disclosed_pay_max || job.pay_max) : null,
      schemaOrg: toSchemaOrgJobPosting(job)
    }));

    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Cache-Control', 'private, max-age=60');

    res.json({
      ok: true,
      surfaceLabel: surface.label,
      jobs,
      pagination: {
        total: parseInt(countResult.rows[0]?.total || '0'),
        limit,
        offset
      }
    });

  } catch (error: any) {
    console.error('Embed feed error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch embed feed'
    });
  }
});

router.options('/feed/:embedKey', (req: Request, res: Response) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Cache-Control', 'private, max-age=60');
  res.status(204).send();
});

router.get('/surfaces', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;

  if (!ctx?.tenant_id) {
    return res.status(401).json({
      ok: false,
      error: 'TENANT_REQUIRED'
    });
  }

  try {
    const result = await serviceQuery(`
      SELECT 
        es.id, es.label, es.allowed_domains, es.is_active, es.created_at,
        (SELECT COUNT(*) FROM cc_job_embed_publications jep WHERE jep.embed_surface_id = es.id AND jep.publish_state = 'published') as active_jobs
      FROM cc_embed_surfaces es
      WHERE es.tenant_id = $1
      ORDER BY es.created_at DESC
    `, [ctx.tenant_id]);

    res.json({
      ok: true,
      surfaces: result.rows
    });

  } catch (error: any) {
    console.error('List embed surfaces error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to list embed surfaces'
    });
  }
});

router.post('/surfaces', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { label, allowedDomains } = req.body;

  if (!ctx?.tenant_id) {
    return res.status(401).json({
      ok: false,
      error: 'TENANT_REQUIRED'
    });
  }

  if (!label || typeof label !== 'string') {
    return res.status(400).json({
      ok: false,
      error: 'VALIDATION_ERROR',
      message: 'label is required'
    });
  }

  try {
    const embedKey = crypto.randomBytes(24).toString('base64url');
    const embedKeyHash = crypto.createHash('sha256').update(embedKey).digest('hex');

    const result = await serviceQuery(`
      INSERT INTO cc_embed_surfaces (tenant_id, label, embed_key_hash, allowed_domains)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [ctx.tenant_id, label, embedKeyHash, allowedDomains || []]);

    res.status(201).json({
      ok: true,
      surfaceId: result.rows[0].id,
      embedKey,
      message: 'Store this embed key securely. It cannot be retrieved again.'
    });

  } catch (error: any) {
    console.error('Create embed surface error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to create embed surface'
    });
  }
});

router.patch('/surfaces/:id', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { id } = req.params;
  const { label, allowedDomains, isActive } = req.body;

  if (!ctx?.tenant_id) {
    return res.status(401).json({
      ok: false,
      error: 'TENANT_REQUIRED'
    });
  }

  try {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (label !== undefined) {
      updates.push(`label = $${paramIndex++}`);
      values.push(label);
    }
    if (allowedDomains !== undefined) {
      updates.push(`allowed_domains = $${paramIndex++}`);
      values.push(allowedDomains);
    }
    if (isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(isActive);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'NO_FIELDS_TO_UPDATE'
      });
    }

    updates.push(`updated_at = now()`);
    values.push(id, ctx.tenant_id);

    const result = await serviceQuery(`
      UPDATE cc_embed_surfaces SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
      RETURNING id
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'SURFACE_NOT_FOUND'
      });
    }

    res.json({
      ok: true,
      message: 'Embed surface updated'
    });

  } catch (error: any) {
    console.error('Update embed surface error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to update embed surface'
    });
  }
});

router.post('/surfaces/:id/publish-jobs', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { id } = req.params;
  const { jobIds } = req.body;

  if (!ctx?.tenant_id) {
    return res.status(401).json({
      ok: false,
      error: 'TENANT_REQUIRED'
    });
  }

  if (!jobIds || !Array.isArray(jobIds) || jobIds.length === 0) {
    return res.status(400).json({
      ok: false,
      error: 'VALIDATION_ERROR',
      message: 'jobIds array is required'
    });
  }

  try {
    const surfaceCheck = await serviceQuery(`
      SELECT id FROM cc_embed_surfaces WHERE id = $1 AND tenant_id = $2 AND is_active = true
    `, [id, ctx.tenant_id]);

    if (surfaceCheck.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'SURFACE_NOT_FOUND'
      });
    }

    const jobCheck = await serviceQuery(`
      SELECT id FROM cc_jobs WHERE id = ANY($1) AND tenant_id = $2
    `, [jobIds, ctx.tenant_id]);

    const validJobIds = jobCheck.rows.map((r: any) => r.id);

    for (const jobId of validJobIds) {
      await serviceQuery(`
        INSERT INTO cc_job_embed_publications (job_id, embed_surface_id, publish_state, published_at)
        VALUES ($1, $2, 'published', now())
        ON CONFLICT (job_id, embed_surface_id) DO UPDATE SET
          publish_state = 'published',
          published_at = now()
      `, [jobId, id]);
    }

    res.json({
      ok: true,
      publishedCount: validJobIds.length
    });

  } catch (error: any) {
    console.error('Publish jobs to embed error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to publish jobs to embed surface'
    });
  }
});

export default router;
