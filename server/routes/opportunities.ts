import { Router, Request, Response } from 'express';
import { requireAuth, requireTenant } from '../middleware/guards';
import { TenantRequest } from '../middleware/tenantContext';

const router = Router();

const SORT_MAP: Record<string, string> = {
  created_at: 'o.created_at',
  title: 'o.title',
  bid_deadline: 'o.bid_deadline',
  expected_start_date: 'o.expected_start_date',
  estimated_value_high: 'o.estimated_value_high'
};

// IMPORTANT: /stats/summary MUST come before /:id
router.get('/stats/summary', async (req: Request, res: Response) => {
  try {
    const tenantReq = req as TenantRequest;
    const portalId = tenantReq.ctx?.portal_id;

    const whereClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Visibility only (authoritative) - NO status filter here
    if (portalId) {
      whereClauses.push(`(
        o.visibility_scope = 'public'::publish_visibility
        OR (o.visibility_scope = 'portal_only'::publish_visibility AND o.portal_id = $${paramIndex})
      )`);
      params.push(portalId);
      paramIndex++;
    } else {
      whereClauses.push(`o.visibility_scope = 'public'::publish_visibility`);
    }

    const whereClause = `WHERE ${whereClauses.join(' AND ')}`;

    const result = await tenantReq.tenantQuery(
      `
      SELECT
        COUNT(*) FILTER (WHERE status = 'published'::opportunity_status)  as published,
        COUNT(*) FILTER (WHERE status = 'evaluating'::opportunity_status) as evaluating,
        COUNT(*) FILTER (WHERE status = 'awarded'::opportunity_status)     as awarded,
        COUNT(*) as total
      FROM opportunities o
      ${whereClause}
      `,
      params
    );

    res.json(result.rows[0] || { published: 0, evaluating: 0, awarded: 0, total: 0 });
  } catch (error) {
    console.error('Error fetching opportunity stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/opportunities - List opportunities
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

    // Visibility only (authoritative)
    if (portalId) {
      whereClauses.push(`(
        o.visibility_scope = 'public'::publish_visibility
        OR (o.visibility_scope = 'portal_only'::publish_visibility AND o.portal_id = $${paramIndex})
      )`);
      params.push(portalId);
      paramIndex++;
    } else {
      whereClauses.push(`o.visibility_scope = 'public'::publish_visibility`);
    }

    // Default: only published opportunities (open for bidding)
    if (!status) {
      whereClauses.push(`o.status = 'published'::opportunity_status`);
    }

    if (community_id) {
      whereClauses.push(`o.community_id = $${paramIndex}::uuid`);
      params.push(community_id);
      paramIndex++;
    }

    if (service_bundle_id) {
      whereClauses.push(`o.service_bundle_id = $${paramIndex}::uuid`);
      params.push(service_bundle_id);
      paramIndex++;
    }

    if (work_category) {
      whereClauses.push(`o.work_category = $${paramIndex}`);
      params.push(work_category);
      paramIndex++;
    }

    if (status) {
      whereClauses.push(`o.status = $${paramIndex}::opportunity_status`);
      params.push(status);
      paramIndex++;
    }

    if (certifications) {
      const certsArray = (certifications as string).split(',');
      whereClauses.push(`o.required_certifications && $${paramIndex}::text[]`);
      params.push(certsArray);
      paramIndex++;
    }

    if (min_value) {
      whereClauses.push(`o.estimated_value_high >= $${paramIndex}`);
      params.push(parseFloat(min_value as string));
      paramIndex++;
    }

    if (max_value) {
      whereClauses.push(`o.estimated_value_low <= $${paramIndex}`);
      params.push(parseFloat(max_value as string));
      paramIndex++;
    }

    if (expected_start_after) {
      whereClauses.push(`o.expected_start_date >= $${paramIndex}::date`);
      params.push(expected_start_after);
      paramIndex++;
    }

    if (expected_start_before) {
      whereClauses.push(`o.expected_start_date <= $${paramIndex}::date`);
      params.push(expected_start_before);
      paramIndex++;
    }

    if (search) {
      whereClauses.push(`(
        o.title ILIKE $${paramIndex}
        OR o.description ILIKE $${paramIndex}
        OR o.work_category ILIKE $${paramIndex}
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
        o.id,
        o.opportunity_ref,
        o.title,
        o.description,
        o.work_category,
        o.site_address,
        o.site_latitude,
        o.site_longitude,
        o.estimated_value_low,
        o.estimated_value_high,
        o.budget_ceiling,
        o.bid_deadline,
        o.questions_deadline,
        o.expected_start_date,
        o.expected_duration_days,
        o.required_certifications,
        o.status,
        o.visibility_scope,
        o.published_at,
        o.created_at,
        c.name as community_name,
        c.region as community_region,
        sb.name as service_bundle_name,
        owner.trade_name as owner_name,
        (SELECT COUNT(*) FROM bids b WHERE b.opportunity_id = o.id) as bid_count,
        (SELECT COUNT(*) FROM opportunity_media om WHERE om.opportunity_id = o.id) as media_count
      FROM opportunities o
      LEFT JOIN sr_communities c ON c.id = o.community_id
      LEFT JOIN sr_bundles sb ON sb.id = o.service_bundle_id
      LEFT JOIN LATERAL (
        SELECT p.trade_name
        FROM parties p
        WHERE p.tenant_id = o.owner_tenant_id
        ORDER BY p.created_at ASC
        LIMIT 1
      ) owner ON true
      ${whereClause}
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(parseInt(limit as string), parseInt(offset as string));

    const result = await tenantReq.tenantQuery(query, params);

    const countParams = params.slice(0, -2);
    const countQuery = `
      SELECT COUNT(*) as total
      FROM opportunities o
      LEFT JOIN sr_communities c ON c.id = o.community_id
      ${whereClause}
    `;
    const countResult = await tenantReq.tenantQuery(countQuery, countParams);

    res.json({
      opportunities: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0]?.total || '0'),
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    });
  } catch (error) {
    console.error('Error fetching opportunities:', error);
    res.status(500).json({ error: 'Failed to fetch opportunities' });
  }
});

// GET /api/opportunities/:id - Single opportunity detail
router.get('/:id', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;
    const portalId = tenantReq.ctx?.portal_id;
    const tenantId = tenantReq.ctx?.tenant_id;

    const visibilityClauses: string[] = [
      `o.visibility_scope = 'public'::publish_visibility`
    ];
    const params: any[] = [id];
    let paramIndex = 2;

    if (portalId) {
      visibilityClauses.push(`(o.visibility_scope = 'portal_only'::publish_visibility AND o.portal_id = $${paramIndex})`);
      params.push(portalId);
      paramIndex++;
    }

    if (tenantId) {
      visibilityClauses.push(`o.owner_tenant_id = $${paramIndex}`);
      params.push(tenantId);
      paramIndex++;
    }

    const result = await tenantReq.tenantQuery(
      `
      SELECT 
        o.*,
        c.name as community_name,
        c.region as community_region,
        c.latitude as community_latitude,
        c.longitude as community_longitude,
        sb.name as service_bundle_name,
        sb.description as service_bundle_description,
        owner.trade_name as owner_name,
        owner.primary_contact_name as owner_contact_name,
        owner.primary_contact_email as owner_contact_email
      FROM opportunities o
      LEFT JOIN sr_communities c ON c.id = o.community_id
      LEFT JOIN sr_bundles sb ON sb.id = o.service_bundle_id
      LEFT JOIN LATERAL (
        SELECT p.trade_name, p.primary_contact_name, p.primary_contact_email
        FROM parties p
        WHERE p.tenant_id = o.owner_tenant_id
        ORDER BY p.created_at ASC
        LIMIT 1
      ) owner ON true
      WHERE o.id = $1::uuid
        AND (${visibilityClauses.join(' OR ')})
      `,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }

    const opportunity = result.rows[0];
    const isOwner = opportunity.owner_tenant_id === tenantId;

    const media = await tenantReq.tenantQuery(
      `SELECT id, media_type, url, thumbnail_url, caption, analysis, created_at
       FROM opportunity_media WHERE opportunity_id = $1 ORDER BY created_at`,
      [id]
    );

    const measurements = await tenantReq.tenantQuery(
      `SELECT id, measurement_type, value, unit, method, confidence_score, notes, created_at
       FROM opportunity_measurements WHERE opportunity_id = $1 ORDER BY created_at`,
      [id]
    );

    const bidCountResult = await tenantReq.tenantQuery(
      `SELECT COUNT(*) as count FROM bids WHERE opportunity_id = $1`,
      [id]
    );
    const bidCount = parseInt(bidCountResult.rows[0]?.count || '0');

    let userBid = null;
    if (tenantId) {
      const partyResult = await tenantReq.tenantQuery(
        `SELECT id FROM parties WHERE tenant_id = $1 ORDER BY created_at ASC LIMIT 1`,
        [tenantId]
      );

      if (partyResult.rows.length > 0) {
        const userBidResult = await tenantReq.tenantQuery(
          `SELECT id, bid_ref, status, bid_amount, proposed_start_date, submitted_at
           FROM bids WHERE opportunity_id = $1 AND party_id = $2 LIMIT 1`,
          [id, partyResult.rows[0].id]
        );
        userBid = userBidResult.rows[0] || null;
      }
    }

    const messagesQuery = isOwner
      ? `SELECT bm.*, p.trade_name as from_party_name
         FROM bid_messages bm LEFT JOIN parties p ON p.id = bm.from_party_id
         WHERE bm.opportunity_id = $1 ORDER BY bm.created_at`
      : `SELECT bm.*, p.trade_name as from_party_name
         FROM bid_messages bm LEFT JOIN parties p ON p.id = bm.from_party_id
         WHERE bm.opportunity_id = $1 AND bm.is_public = true ORDER BY bm.created_at`;

    const messages = await tenantReq.tenantQuery(messagesQuery, [id]);

    res.json({
      ...opportunity,
      media: media.rows,
      measurements: measurements.rows,
      bid_count: bidCount,
      user_bid: userBid,
      messages: messages.rows,
      is_owner: isOwner
    });
  } catch (error) {
    console.error('Error fetching opportunity:', error);
    res.status(500).json({ error: 'Failed to fetch opportunity' });
  }
});

// GET /api/opportunities/:id/bids - List bids (owner only)
router.get('/:id/bids', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;
    const tenantId = tenantReq.ctx!.tenant_id;

    const ownerCheck = await tenantReq.tenantQuery(
      `SELECT id FROM opportunities WHERE id = $1::uuid AND owner_tenant_id = $2`,
      [id, tenantId]
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized to view bids for this opportunity' });
    }

    const result = await tenantReq.tenantQuery(
      `SELECT b.*, p.trade_name as bidder_name, p.rating as bidder_rating,
              p.total_contracts as bidder_contracts, p.certifications as bidder_certifications,
              p.status as bidder_status
       FROM bids b JOIN parties p ON p.id = b.party_id
       WHERE b.opportunity_id = $1::uuid
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
