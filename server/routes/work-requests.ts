import { Router, Request, Response } from 'express';
import { requireAuth, requireTenant } from '../middleware/guards';
import { TenantRequest } from '../middleware/tenantContext';
import { publicQuery } from '../db/tenantDb';

const router = Router();

async function runQuery(tenantReq: TenantRequest, sql: string, params: any[]) {
  if (tenantReq.tenantQuery) {
    return tenantReq.tenantQuery(sql, params);
  }
  return publicQuery(sql, params);
}

const SORT_MAP: Record<string, string> = {
  created_at: 'wr.created_at',
  title: 'wr.title',
  bid_deadline: 'wr.bid_deadline',
  expected_start_date: 'wr.expected_start_date',
  estimated_value_high: 'wr.estimated_value_high'
};

router.get('/stats/summary', async (req: Request, res: Response) => {
  try {
    const tenantReq = req as TenantRequest;
    const portalId = tenantReq.ctx?.portal_id;

    const whereClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (portalId) {
      whereClauses.push(`(
        wr.visibility_scope = 'public'::publish_visibility
        OR (wr.visibility_scope = 'portal_only'::publish_visibility AND wr.portal_id = $${paramIndex})
      )`);
      params.push(portalId);
      paramIndex++;
    } else {
      whereClauses.push(`wr.visibility_scope = 'public'::publish_visibility`);
    }

    const whereClause = `WHERE ${whereClauses.join(' AND ')}`;

    const result = await runQuery(tenantReq,
      `
      SELECT
        COUNT(*) FILTER (WHERE status = 'published'::work_request_status)  as published,
        COUNT(*) FILTER (WHERE status = 'evaluating'::work_request_status) as evaluating,
        COUNT(*) FILTER (WHERE status = 'awarded'::work_request_status)     as awarded,
        COUNT(*) as total
      FROM work_requests wr
      ${whereClause}
      `,
      params
    );

    res.json(result.rows[0] || { published: 0, evaluating: 0, awarded: 0, total: 0 });
  } catch (error) {
    console.error('Error fetching work request stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.post('/', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const tenantId = tenantReq.ctx!.tenant_id;

    const {
      title,
      description,
      scope_of_work,
      work_category,
      site_address,
      site_latitude,
      site_longitude,
      estimated_value_low,
      estimated_value_high,
      budget_ceiling,
      bid_deadline,
      questions_deadline,
      expected_start_date,
      expected_duration_days,
      required_certifications,
      visibility_scope = 'public',
      portal_id = null,
      status = 'draft',
      logistics_profile = null,
      available_tools_snapshot = null,
      local_resources = null,
      community_id = null,
      service_bundle_id = null
    } = req.body;

    if (!title || !work_category) {
      return res.status(400).json({ error: 'title and work_category are required' });
    }

    const refResult = await tenantReq.tenantQuery!(
      `SELECT 'WR-' || to_char(now(), 'YYMMDD') || '-' || lpad(nextval('work_request_ref_seq')::text, 4, '0') as ref`
    );
    const wrRef = refResult.rows[0].ref;

    const publishedAt = status === 'published' ? new Date() : null;

    const result = await tenantReq.tenantQuery!(
      `
      INSERT INTO work_requests (
        work_request_ref, owner_tenant_id, title, description, scope_of_work, work_category,
        site_address, site_latitude, site_longitude,
        estimated_value_low, estimated_value_high, budget_ceiling,
        bid_deadline, questions_deadline, expected_start_date, expected_duration_days,
        required_certifications, status, visibility_scope, portal_id, published_at,
        logistics_profile, available_tools_snapshot, local_resources,
        community_id, service_bundle_id
      ) VALUES (
        $1, $2::uuid, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17,
        $18::work_request_status, $19::publish_visibility, $20::uuid, $21,
        $22::jsonb, $23::jsonb, $24::jsonb,
        $25::uuid, $26::uuid
      )
      RETURNING id, work_request_ref, status, created_at
      `,
      [
        wrRef, tenantId, title, description || null, scope_of_work || null, work_category,
        site_address || null, site_latitude || null, site_longitude || null,
        estimated_value_low || null, estimated_value_high || null, budget_ceiling || null,
        bid_deadline || null, questions_deadline || null, expected_start_date || null, expected_duration_days || null,
        required_certifications || null, status, visibility_scope, portal_id, publishedAt,
        logistics_profile ? JSON.stringify(logistics_profile) : null,
        available_tools_snapshot ? JSON.stringify(available_tools_snapshot) : null,
        local_resources ? JSON.stringify(local_resources) : null,
        community_id || null, service_bundle_id || null
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (e: any) {
    console.error('Error creating work request:', e);
    res.status(500).json({ error: 'Failed to create work request', details: e.message });
  }
});

router.post('/:id/media', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;
    const tenantId = tenantReq.ctx!.tenant_id;
    const individualId = tenantReq.ctx!.individual_id;
    const { media_type, file_name, file_url, file_size, description, is_public } = req.body;

    if (!file_url || !media_type) {
      return res.status(400).json({ error: 'media_type and file_url are required' });
    }

    const ownerCheck = await tenantReq.tenantQuery!(
      `SELECT id FROM work_requests WHERE id = $1::uuid AND owner_tenant_id = $2`,
      [id, tenantId]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const result = await tenantReq.tenantQuery!(
      `INSERT INTO work_request_media (work_request_id, media_type, file_name, file_url, file_size, description, is_public, uploaded_by)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8::uuid)
       RETURNING *`,
      [id, media_type, file_name || null, file_url, file_size || null, description || null, is_public !== false, individualId || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (e: any) {
    console.error('Error adding media:', e);
    res.status(500).json({ error: 'Failed to add media', details: e.message });
  }
});

router.get('/', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const {
      community_id,
      service_bundle_id,
      work_category,
      status,
      certifications,
      min_value,
      max_value,
      expected_start_after,
      expected_start_before,
      search,
      limit = '20',
      offset = '0',
      sort = 'created_at',
      order = 'desc'
    } = req.query;

    const portalId = tenantReq.ctx?.portal_id;
    const whereClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (portalId) {
      whereClauses.push(`(
        wr.visibility_scope = 'public'::publish_visibility
        OR (wr.visibility_scope = 'portal_only'::publish_visibility AND wr.portal_id = $${paramIndex})
      )`);
      params.push(portalId);
      paramIndex++;
    } else {
      whereClauses.push(`wr.visibility_scope = 'public'::publish_visibility`);
    }

    if (!status) {
      whereClauses.push(`wr.status = 'published'::work_request_status`);
    }

    if (community_id) {
      whereClauses.push(`wr.community_id = $${paramIndex}::uuid`);
      params.push(community_id);
      paramIndex++;
    }

    if (service_bundle_id) {
      whereClauses.push(`wr.service_bundle_id = $${paramIndex}::uuid`);
      params.push(service_bundle_id);
      paramIndex++;
    }

    if (work_category) {
      whereClauses.push(`wr.work_category = $${paramIndex}`);
      params.push(work_category);
      paramIndex++;
    }

    if (status) {
      whereClauses.push(`wr.status = $${paramIndex}::work_request_status`);
      params.push(status);
      paramIndex++;
    }

    if (certifications) {
      const certsArray = (certifications as string).split(',');
      whereClauses.push(`wr.required_certifications && $${paramIndex}::text[]`);
      params.push(certsArray);
      paramIndex++;
    }

    if (min_value) {
      whereClauses.push(`wr.estimated_value_high >= $${paramIndex}`);
      params.push(parseFloat(min_value as string));
      paramIndex++;
    }

    if (max_value) {
      whereClauses.push(`wr.estimated_value_low <= $${paramIndex}`);
      params.push(parseFloat(max_value as string));
      paramIndex++;
    }

    if (expected_start_after) {
      whereClauses.push(`wr.expected_start_date >= $${paramIndex}::date`);
      params.push(expected_start_after);
      paramIndex++;
    }

    if (expected_start_before) {
      whereClauses.push(`wr.expected_start_date <= $${paramIndex}::date`);
      params.push(expected_start_before);
      paramIndex++;
    }

    if (search) {
      whereClauses.push(`(
        wr.title ILIKE $${paramIndex}
        OR wr.description ILIKE $${paramIndex}
        OR wr.work_category ILIKE $${paramIndex}
        OR c.name ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = `WHERE ${whereClauses.join(' AND ')}`;

    const sortColumn = SORT_MAP[sort as string] || SORT_MAP.created_at;
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

    const query = `
      SELECT 
        wr.id,
        wr.work_request_ref,
        wr.title,
        wr.description,
        wr.work_category,
        wr.site_address,
        wr.site_latitude,
        wr.site_longitude,
        wr.estimated_value_low,
        wr.estimated_value_high,
        wr.budget_ceiling,
        wr.bid_deadline,
        wr.questions_deadline,
        wr.expected_start_date,
        wr.expected_duration_days,
        wr.required_certifications,
        wr.status,
        wr.visibility_scope,
        wr.published_at,
        wr.created_at,
        c.name as community_name,
        c.region as community_region,
        sb.name as service_bundle_name,
        owner.trade_name as owner_name,
        (SELECT COUNT(*) FROM bids b WHERE b.work_request_id = wr.id) as bid_count,
        (SELECT COUNT(*) FROM work_request_media wrm WHERE wrm.work_request_id = wr.id) as media_count
      FROM work_requests wr
      LEFT JOIN sr_communities c ON c.id = wr.community_id
      LEFT JOIN sr_bundles sb ON sb.id = wr.service_bundle_id
      LEFT JOIN LATERAL (
        SELECT p.trade_name
        FROM parties p
        WHERE p.tenant_id = wr.owner_tenant_id
        ORDER BY p.created_at ASC
        LIMIT 1
      ) owner ON true
      ${whereClause}
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(parseInt(limit as string), parseInt(offset as string));

    const result = await runQuery(tenantReq, query, params);

    const countParams = params.slice(0, -2);
    const countQuery = `
      SELECT COUNT(*) as total
      FROM work_requests wr
      LEFT JOIN sr_communities c ON c.id = wr.community_id
      ${whereClause}
    `;
    const countResult = await runQuery(tenantReq, countQuery, countParams);

    res.json({
      workRequests: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0]?.total || '0'),
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    });
  } catch (error) {
    console.error('Error fetching work requests:', error);
    res.status(500).json({ error: 'Failed to fetch work requests' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;
    const portalId = tenantReq.ctx?.portal_id;
    const tenantId = tenantReq.ctx?.tenant_id;

    const visibilityClauses: string[] = [
      `wr.visibility_scope = 'public'::publish_visibility`
    ];
    const params: any[] = [id];
    let paramIndex = 2;

    if (portalId) {
      visibilityClauses.push(`(wr.visibility_scope = 'portal_only'::publish_visibility AND wr.portal_id = $${paramIndex})`);
      params.push(portalId);
      paramIndex++;
    }

    if (tenantId) {
      visibilityClauses.push(`wr.owner_tenant_id = $${paramIndex}`);
      params.push(tenantId);
      paramIndex++;
    }

    const result = await runQuery(tenantReq,
      `
      SELECT 
        wr.*,
        c.name as community_name,
        c.region as community_region,
        c.latitude as community_latitude,
        c.longitude as community_longitude,
        sb.name as service_bundle_name,
        sb.description as service_bundle_description,
        owner.trade_name as owner_name,
        owner.primary_contact_name as owner_contact_name,
        owner.primary_contact_email as owner_contact_email
      FROM work_requests wr
      LEFT JOIN sr_communities c ON c.id = wr.community_id
      LEFT JOIN sr_bundles sb ON sb.id = wr.service_bundle_id
      LEFT JOIN LATERAL (
        SELECT p.trade_name, p.primary_contact_name, p.primary_contact_email
        FROM parties p
        WHERE p.tenant_id = wr.owner_tenant_id
        ORDER BY p.created_at ASC
        LIMIT 1
      ) owner ON true
      WHERE wr.id = $1::uuid
        AND (${visibilityClauses.join(' OR ')})
      `,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Work request not found' });
    }

    const workRequest = result.rows[0];
    const isOwner = workRequest.owner_tenant_id === tenantId;

    const media = await runQuery(tenantReq,
      `SELECT id, media_type, file_name, file_url, file_size, description, is_public, created_at
       FROM work_request_media WHERE work_request_id = $1 ORDER BY created_at`,
      [id]
    );

    const measurements = await runQuery(tenantReq,
      `SELECT id, measurement_type, description, quantity, unit, notes, created_at
       FROM work_request_measurements WHERE work_request_id = $1 ORDER BY created_at`,
      [id]
    );

    const bidCountResult = await runQuery(tenantReq,
      `SELECT COUNT(*) as count FROM bids WHERE work_request_id = $1`,
      [id]
    );
    const bidCount = parseInt(bidCountResult.rows[0]?.count || '0');

    let userBid = null;
    if (tenantId) {
      const partyResult = await runQuery(tenantReq,
        `SELECT id FROM parties WHERE tenant_id = $1 ORDER BY created_at ASC LIMIT 1`,
        [tenantId]
      );

      if (partyResult.rows.length > 0) {
        const userBidResult = await runQuery(tenantReq,
          `SELECT id, bid_ref, status, bid_amount, proposed_start_date, submitted_at
           FROM bids WHERE work_request_id = $1 AND party_id = $2 LIMIT 1`,
          [id, partyResult.rows[0].id]
        );
        userBid = userBidResult.rows[0] || null;
      }
    }

    const messagesQuery = isOwner
      ? `SELECT bm.*, p.trade_name as from_party_name
         FROM bid_messages bm LEFT JOIN parties p ON p.id = bm.from_party_id
         WHERE bm.work_request_id = $1 ORDER BY bm.created_at`
      : `SELECT bm.*, p.trade_name as from_party_name
         FROM bid_messages bm LEFT JOIN parties p ON p.id = bm.from_party_id
         WHERE bm.work_request_id = $1 AND bm.is_public = true ORDER BY bm.created_at`;

    const messages = await runQuery(tenantReq, messagesQuery, [id]);

    res.json({
      ...workRequest,
      media: media.rows,
      measurements: measurements.rows,
      bid_count: bidCount,
      user_bid: userBid,
      messages: messages.rows,
      is_owner: isOwner
    });
  } catch (error) {
    console.error('Error fetching work request:', error);
    res.status(500).json({ error: 'Failed to fetch work request' });
  }
});

router.get('/:id/bids', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;
    const tenantId = tenantReq.ctx!.tenant_id;

    const ownerCheck = await tenantReq.tenantQuery(
      `SELECT id FROM work_requests WHERE id = $1::uuid AND owner_tenant_id = $2`,
      [id, tenantId]
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized to view bids for this work request' });
    }

    const result = await tenantReq.tenantQuery(
      `SELECT b.*, p.trade_name as bidder_name, p.rating as bidder_rating,
              p.total_contracts as bidder_contracts, p.certifications as bidder_certifications,
              p.status as bidder_status
       FROM bids b JOIN parties p ON p.id = b.party_id
       WHERE b.work_request_id = $1::uuid
       ORDER BY b.submitted_at DESC NULLS LAST, b.created_at DESC`,
      [id]
    );

    res.json({ bids: result.rows });
  } catch (error) {
    console.error('Error fetching bids:', error);
    res.status(500).json({ error: 'Failed to fetch bids' });
  }
});

export default router;
