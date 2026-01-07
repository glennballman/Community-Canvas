import express, { Request, Response } from 'express';
import { serviceQuery, publicQuery } from '../db/tenantDb';
import { TenantRequest } from '../middleware/tenantContext';

const router = express.Router();

/**
 * GET /api/public/portal-context
 * 
 * Returns the portal context derived from the request (domain or /b/:slug path).
 * This is useful for:
 * 1. Dev/QA testing of portal resolution
 * 2. Frontend bootstrapping to get portal theme/settings
 * 
 * SECURITY: Returns ONLY public portal info. Does NOT expose tenant internals.
 */
router.get('/portal-context', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  
  if (!ctx?.portal_id) {
    return res.status(404).json({
      success: false,
      error: 'PORTAL_NOT_FOUND',
      message: 'Unable to determine portal from request. Check domain or path.',
      host: req.headers.host,
      path: req.path
    });
  }
  
  try {
    // Fetch full portal details including theme
    const result = await serviceQuery(`
      SELECT 
        p.id as portal_id,
        p.slug,
        p.name,
        p.legal_dba_name,
        p.portal_type,
        p.tagline,
        p.description,
        p.primary_audience,
        p.default_locale,
        p.default_currency,
        p.supported_locales,
        p.default_route,
        p.terms_url,
        p.privacy_url,
        p.settings,
        pt.tokens as theme
      FROM portals p
      LEFT JOIN portal_theme pt ON pt.portal_id = p.id AND pt.is_live = true
      WHERE p.id = $1 AND p.status = 'active'
    `, [ctx.portal_id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'PORTAL_NOT_FOUND',
        message: 'Portal not found or not active'
      });
    }
    
    const portal = result.rows[0];
    
    res.json({
      success: true,
      portal: {
        portal_id: portal.portal_id,
        slug: portal.slug,
        name: portal.name,
        legal_dba_name: portal.legal_dba_name,
        portal_type: portal.portal_type,
        tagline: portal.tagline,
        description: portal.description,
        primary_audience: portal.primary_audience,
        default_locale: portal.default_locale,
        default_currency: portal.default_currency,
        supported_locales: portal.supported_locales,
        default_route: portal.default_route,
        terms_url: portal.terms_url,
        privacy_url: portal.privacy_url,
        settings: portal.settings,
        theme: portal.theme
      },
      resolution: {
        host: req.headers.host,
        path: req.path,
        tenant_id: ctx.tenant_id
      }
    });
  } catch (error: any) {
    console.error('Portal context fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch portal context'
    });
  }
});

/**
 * PUBLIC PORTAL ROUTES
 * 
 * These endpoints serve public community portal data without authentication.
 * 
 * PORTAL SETTINGS REQUIREMENTS:
 * For geographic data (accommodations, infrastructure, weather, alerts), portals must
 * have settings configured with region/city values. If not configured, these endpoints
 * return empty results to prevent cross-community data leakage.
 * 
 * Expected portal.settings structure:
 * {
 *   region: "Capital",                    // Regional district name
 *   city: "Sidney",                       // Municipality name (optional)
 *   ferry_routes: ["Swartz Bay-Tsawwassen", ...],  // Relevant ferry routes
 * }
 */

router.get('/portals/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const result = await serviceQuery(`
      SELECT 
        p.id,
        p.name,
        p.slug,
        p.status,
        p.tagline,
        p.description,
        p.primary_audience,
        p.default_locale,
        p.default_currency,
        p.supported_locales,
        p.default_route,
        p.terms_url,
        p.privacy_url,
        p.settings,
        pt.tokens as theme,
        t.id as tenant_id,
        t.name as tenant_name
      FROM portals p
      LEFT JOIN portal_theme pt ON pt.portal_id = p.id AND pt.is_live = true
      LEFT JOIN cc_tenants t ON t.id = p.owning_tenant_id
      WHERE p.slug = $1 AND p.status = 'active'
    `, [slug]);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Portal not found' 
      });
    }

    res.json({
      success: true,
      portal: result.rows[0]
    });

  } catch (error: any) {
    console.error('Public portal fetch error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch portal' 
    });
  }
});

router.get('/portals/:slug/service-runs', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { status, limit = '20' } = req.query;

    const portalResult = await serviceQuery(`
      SELECT p.id, p.owning_tenant_id 
      FROM portals p 
      WHERE p.slug = $1 AND p.status = 'active'
    `, [slug]);

    if (portalResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Portal not found' 
      });
    }

    const tenantId = portalResult.rows[0].owning_tenant_id;

    let query = `
      SELECT 
        csr.id,
        csr.title,
        csr.description,
        csr.service_type,
        csr.status,
        csr.scheduled_date,
        csr.route_summary,
        csr.participants_needed,
        csr.participants_confirmed,
        csr.estimated_savings_per_participant,
        csr.created_at
      FROM shared_service_runs csr
      WHERE csr.community_tenant_id = $1
        AND csr.visibility = 'public'
    `;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (status) {
      query += ` AND csr.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    } else {
      query += ` AND csr.status IN ('open', 'confirmed', 'in_progress')`;
    }

    query += ` ORDER BY csr.scheduled_date ASC LIMIT $${paramIndex}`;
    params.push(parseInt(limit as string));

    const result = await serviceQuery(query, params);

    res.json({
      success: true,
      service_runs: result.rows,
      count: result.rows.length
    });

  } catch (error: any) {
    console.error('Public service runs fetch error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch service runs' 
    });
  }
});

router.get('/portals/:slug/businesses', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { category, search, limit = '50' } = req.query;

    const portalResult = await serviceQuery(`
      SELECT p.id, p.owning_tenant_id, p.settings 
      FROM portals p 
      WHERE p.slug = $1 AND p.status = 'active'
    `, [slug]);

    if (portalResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Portal not found' 
      });
    }

    const settings = portalResult.rows[0].settings || {};
    const portalCity = settings.city;

    if (!portalCity) {
      return res.json({
        success: true,
        businesses: [],
        count: 0,
        message: 'Portal geographic settings not configured'
      });
    }

    let query = `
      SELECT 
        t.id,
        t.name as business_name,
        t.slug,
        t.business_type,
        t.website,
        t.telephone,
        t.city,
        t.province
      FROM cc_tenants t
      JOIN tenant_sharing_settings tss ON tss.tenant_id = t.id
      WHERE t.tenant_type = 'business'
        AND t.status = 'active'
        AND t.city ILIKE $1
        AND tss.share_availability = true
    `;
    const params: any[] = [portalCity];
    let paramIndex = 2;

    if (category) {
      query += ` AND t.business_type = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (search) {
      query += ` AND t.name ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY t.name ASC LIMIT $${paramIndex}`;
    params.push(parseInt(limit as string));

    const result = await serviceQuery(query, params);

    res.json({
      success: true,
      businesses: result.rows,
      count: result.rows.length
    });

  } catch (error: any) {
    console.error('Public businesses fetch error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch businesses' 
    });
  }
});

router.get('/portals/:slug/accommodations', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { property_type, limit = '50' } = req.query;

    const portalResult = await serviceQuery(`
      SELECT p.id, p.owning_tenant_id, p.settings
      FROM portals p 
      WHERE p.slug = $1 AND p.status = 'active'
    `, [slug]);

    if (portalResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Portal not found' 
      });
    }

    const settings = portalResult.rows[0].settings || {};
    const region = settings.region;
    const city = settings.city;

    if (!region && !city) {
      return res.json({
        success: true,
        accommodations: [],
        count: 0,
        message: 'Portal geographic settings not configured'
      });
    }

    let query = `
      SELECT 
        a.id,
        a.name,
        a.property_type,
        a.city,
        a.region,
        a.bedrooms,
        a.bathrooms,
        a.max_guests,
        a.amenities,
        a.photos,
        a.price_per_night,
        a.latitude,
        a.longitude
      FROM accommodations a
      WHERE a.status = 'active'
        AND a.is_public = true
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (region) {
      query += ` AND a.region = $${paramIndex}`;
      params.push(region);
      paramIndex++;
    }

    if (city) {
      query += ` AND a.city = $${paramIndex}`;
      params.push(city);
      paramIndex++;
    }

    if (property_type) {
      query += ` AND a.property_type = $${paramIndex}`;
      params.push(property_type);
      paramIndex++;
    }

    query += ` ORDER BY a.name ASC LIMIT $${paramIndex}`;
    params.push(parseInt(limit as string));

    const result = await serviceQuery(query, params);

    res.json({
      success: true,
      accommodations: result.rows,
      count: result.rows.length
    });

  } catch (error: any) {
    console.error('Public accommodations fetch error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch accommodations' 
    });
  }
});

router.get('/portals/:slug/infrastructure', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { type, limit = '100' } = req.query;

    const portalResult = await serviceQuery(`
      SELECT p.id, p.owning_tenant_id, p.settings
      FROM portals p 
      WHERE p.slug = $1 AND p.status = 'active'
    `, [slug]);

    if (portalResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Portal not found' 
      });
    }

    const settings = portalResult.rows[0].settings || {};
    const region = settings.region;
    const city = settings.city;

    if (!region && !city) {
      return res.json({
        success: true,
        infrastructure: [],
        count: 0,
        message: 'Portal geographic settings not configured'
      });
    }

    let query = `
      SELECT 
        n.id,
        n.name,
        n.node_type,
        n.category,
        n.address,
        n.city,
        n.region,
        n.latitude,
        n.longitude,
        n.telephone,
        n.hours,
        n.status
      FROM infrastructure_nodes n
      WHERE n.status = 'active'
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (region) {
      query += ` AND n.region = $${paramIndex}`;
      params.push(region);
      paramIndex++;
    }

    if (city) {
      query += ` AND n.city = $${paramIndex}`;
      params.push(city);
      paramIndex++;
    }

    if (type) {
      query += ` AND n.node_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    query += ` ORDER BY n.name ASC LIMIT $${paramIndex}`;
    params.push(parseInt(limit as string));

    const result = await serviceQuery(query, params);

    res.json({
      success: true,
      infrastructure: result.rows,
      count: result.rows.length
    });

  } catch (error: any) {
    console.error('Public infrastructure fetch error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch infrastructure' 
    });
  }
});

router.get('/portals/:slug/alerts', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const portalResult = await serviceQuery(`
      SELECT p.id, p.owning_tenant_id, p.settings
      FROM portals p 
      WHERE p.slug = $1 AND p.status = 'active'
    `, [slug]);

    if (portalResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Portal not found' 
      });
    }

    const settings = portalResult.rows[0].settings || {};
    const region = settings.region;

    if (!region) {
      return res.json({
        success: true,
        alerts: [],
        count: 0,
        message: 'Portal geographic settings not configured'
      });
    }

    let query = `
      SELECT 
        a.id,
        a.title,
        a.summary,
        a.message,
        a.severity,
        a.alert_type,
        a.affected_area,
        a.effective_from,
        a.effective_until,
        a.source_url,
        a.created_at
      FROM alerts a
      WHERE a.is_active = true
        AND (a.effective_until IS NULL OR a.effective_until > now())
        AND (a.region_id ILIKE $1)
      ORDER BY a.severity DESC, a.created_at DESC 
      LIMIT 20
    `;

    const result = await serviceQuery(query, [`%${region}%`]);

    res.json({
      success: true,
      alerts: result.rows,
      count: result.rows.length
    });

  } catch (error: any) {
    console.error('Public alerts fetch error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch alerts' 
    });
  }
});

router.get('/portals/:slug/weather', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const portalResult = await serviceQuery(`
      SELECT p.id, p.owning_tenant_id, p.settings
      FROM portals p 
      WHERE p.slug = $1 AND p.status = 'active'
    `, [slug]);

    if (portalResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Portal not found' 
      });
    }

    const settings = portalResult.rows[0].settings || {};
    const region = settings.region;

    if (!region) {
      return res.json({
        success: true,
        weather: [],
        count: 0,
        message: 'Portal geographic settings not configured'
      });
    }

    res.json({
      success: true,
      weather: [],
      count: 0,
      message: 'Weather data not available'
    });

  } catch (error: any) {
    console.error('Public weather fetch error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch weather' 
    });
  }
});

router.get('/portals/:slug/ferries', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const portalResult = await serviceQuery(`
      SELECT p.id, p.owning_tenant_id, p.settings
      FROM portals p 
      WHERE p.slug = $1 AND p.status = 'active'
    `, [slug]);

    if (portalResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Portal not found' 
      });
    }

    const settings = portalResult.rows[0].settings || {};
    const ferryRoutes = settings.ferry_routes;

    if (!ferryRoutes || !Array.isArray(ferryRoutes) || ferryRoutes.length === 0) {
      return res.json({
        success: true,
        ferries: [],
        count: 0,
        message: 'Portal ferry routes not configured'
      });
    }

    res.json({
      success: true,
      ferries: [],
      count: 0,
      message: 'Ferry schedule data not available'
    });

  } catch (error: any) {
    console.error('Public ferries fetch error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch ferries' 
    });
  }
});

router.get('/portals/:slug/good-news', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { limit = '20' } = req.query;

    const portalResult = await serviceQuery(`
      SELECT p.id, p.owning_tenant_id
      FROM portals p 
      WHERE p.slug = $1 AND p.status = 'active'
    `, [slug]);

    if (portalResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Portal not found' 
      });
    }

    const tenantId = portalResult.rows[0].owning_tenant_id;

    const result = await serviceQuery(`
      SELECT 
        a.id,
        a.message,
        a.category,
        a.is_public,
        a.created_at,
        tu.display_name as author_name
      FROM appreciations a
      LEFT JOIN cc_users tu ON tu.id = a.from_user_id
      WHERE a.tenant_id = $1
        AND a.is_public = true
        AND a.status = 'approved'
      ORDER BY a.created_at DESC
      LIMIT $2
    `, [tenantId, parseInt(limit as string)]);

    res.json({
      success: true,
      good_news: result.rows,
      count: result.rows.length
    });

  } catch (error: any) {
    console.error('Public good news fetch error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch good news' 
    });
  }
});

// ============================================================================
// ENTITY PRESENTATIONS - Public Read Endpoints
// ============================================================================

/**
 * GET /api/public/portals/:slug/presentations
 * 
 * List published presentations for a portal.
 * Supports filtering by entity_type and presentation_type.
 */
router.get('/portals/:slug/presentations', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { entity_type, presentation_type, tag, limit = '20', offset = '0' } = req.query;

    // Verify portal exists (serviceQuery bypasses RLS to find any portal by slug)
    const portalResult = await serviceQuery(`
      SELECT p.id FROM portals p 
      WHERE p.slug = $1 AND p.status = 'active'
    `, [slug]);

    if (portalResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Portal not found' 
      });
    }

    const portalId = portalResult.rows[0].id;

    // Build query with optional filters (publicQuery for RLS to see only published/public)
    let query = `
      SELECT 
        ep.id,
        ep.slug,
        ep.title,
        ep.subtitle,
        ep.entity_type,
        ep.presentation_type,
        ep.tags,
        ep.seasonality,
        ep.cta,
        ep.created_at,
        ep.updated_at,
        (SELECT jsonb_agg(
          jsonb_build_object('block_type', pb.block_type, 'block_data', pb.block_data)
          ORDER BY pb.block_order
        ) FROM presentation_blocks pb WHERE pb.presentation_id = ep.id) as blocks
      FROM articles ep
      WHERE ep.portal_id = $1
        AND ep.status = 'published'
        AND ep.visibility IN ('public', 'unlisted')
    `;
    const params: any[] = [portalId];
    let paramIndex = 2;

    if (entity_type) {
      query += ` AND ep.entity_type = $${paramIndex}`;
      params.push(entity_type);
      paramIndex++;
    }

    if (presentation_type) {
      query += ` AND ep.presentation_type = $${paramIndex}`;
      params.push(presentation_type);
      paramIndex++;
    }

    if (tag) {
      query += ` AND $${paramIndex} = ANY(ep.tags)`;
      params.push(tag);
      paramIndex++;
    }

    query += ` ORDER BY ep.updated_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit as string), parseInt(offset as string));

    const result = await serviceQuery(query, params);

    res.json({
      success: true,
      presentations: result.rows,
      count: result.rows.length
    });

  } catch (error: any) {
    console.error('Public presentations list error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch presentations' 
    });
  }
});

/**
 * GET /api/public/portals/:slug/presentations/:presentationSlug
 * 
 * Get a single presentation with all blocks and metadata.
 */
router.get('/portals/:slug/presentations/:presentationSlug', async (req: Request, res: Response) => {
  try {
    const { slug, presentationSlug } = req.params;

    // Verify portal exists (serviceQuery bypasses RLS to find any portal by slug)
    const portalResult = await serviceQuery(`
      SELECT p.id, p.name, p.slug FROM portals p 
      WHERE p.slug = $1 AND p.status = 'active'
    `, [slug]);

    if (portalResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Portal not found' 
      });
    }

    const portalId = portalResult.rows[0].id;

    // Fetch presentation with blocks and voice profile (serviceQuery - RLS handles visibility)
    const result = await serviceQuery(`
      SELECT 
        ep.id,
        ep.slug,
        ep.title,
        ep.subtitle,
        ep.entity_type,
        ep.entity_id,
        ep.presentation_type,
        ep.tags,
        ep.seasonality,
        ep.cta,
        ep.layout,
        ep.created_at,
        ep.updated_at,
        vp.name as voice_profile_name,
        vp.guidance as voice_guidance,
        (SELECT jsonb_agg(
          jsonb_build_object(
            'id', pb.id,
            'block_order', pb.block_order,
            'block_type', pb.block_type,
            'block_data', pb.block_data
          )
          ORDER BY pb.block_order
        ) FROM presentation_blocks pb WHERE pb.presentation_id = ep.id) as blocks,
        (SELECT jsonb_agg(
          jsonb_build_object(
            'entity_type', pel.entity_type,
            'entity_id', pel.entity_id,
            'role', pel.role
          )
          ORDER BY pel.sort_order
        ) FROM presentation_entity_links pel WHERE pel.presentation_id = ep.id) as entity_links
      FROM articles ep
      LEFT JOIN voice_profiles vp ON vp.id = ep.voice_profile_id
      WHERE ep.portal_id = $1
        AND ep.slug = $2
        AND ep.status = 'published'
        AND ep.visibility IN ('public', 'unlisted')
    `, [portalId, presentationSlug]);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Presentation not found' 
      });
    }

    const presentation = result.rows[0];

    res.json({
      success: true,
      presentation: {
        ...presentation,
        portal: {
          id: portalResult.rows[0].id,
          name: portalResult.rows[0].name,
          slug: portalResult.rows[0].slug
        }
      }
    });

  } catch (error: any) {
    console.error('Public presentation detail error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch presentation' 
    });
  }
});

export default router;
