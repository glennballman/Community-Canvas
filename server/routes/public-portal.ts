import express, { Request, Response } from 'express';
import { serviceQuery, publicQuery } from '../db/tenantDb';
import { TenantRequest } from '../middleware/tenantContext';
import { 
  createCart, getCart, addItem, updateItem, removeItem, addAdjustment, updateCartGuest
} from '../services/cartService';
import { getRecommendations, getWeatherSummary } from '../services/recommendationService';
import { checkout, confirmQuote, abandonCart } from '../services/checkoutService';

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
      FROM cc_portals p
      LEFT JOIN cc_portal_theme pt ON pt.portal_id = p.id AND pt.is_live = true
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
 * For geographic data (accommodations, infrastructure, weather, cc_alerts), cc_portals must
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

router.get('/cc_portals/:slug', async (req: Request, res: Response) => {
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
      FROM cc_portals p
      LEFT JOIN cc_portal_theme pt ON pt.portal_id = p.id AND pt.is_live = true
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

router.get('/cc_portals/:slug/service-runs', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { status, limit = '20' } = req.query;

    const portalResult = await serviceQuery(`
      SELECT p.id, p.owning_tenant_id 
      FROM cc_portals p 
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
      FROM cc_shared_service_runs csr
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
      cc_service_runs: result.rows,
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

router.get('/cc_portals/:slug/businesses', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { category, search, limit = '50' } = req.query;

    const portalResult = await serviceQuery(`
      SELECT p.id, p.owning_tenant_id, p.settings 
      FROM cc_portals p 
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
      JOIN cc_tenant_sharing_settings tss ON tss.tenant_id = t.id
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

router.get('/cc_portals/:slug/accommodations', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { property_type, limit = '50' } = req.query;

    const portalResult = await serviceQuery(`
      SELECT p.id, p.owning_tenant_id, p.settings
      FROM cc_portals p 
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

router.get('/cc_portals/:slug/infrastructure', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { type, limit = '100' } = req.query;

    const portalResult = await serviceQuery(`
      SELECT p.id, p.owning_tenant_id, p.settings
      FROM cc_portals p 
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

router.get('/cc_portals/:slug/cc_alerts', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const portalResult = await serviceQuery(`
      SELECT p.id, p.owning_tenant_id, p.settings
      FROM cc_portals p 
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
        cc_alerts: [],
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
      FROM cc_alerts a
      WHERE a.is_active = true
        AND (a.effective_until IS NULL OR a.effective_until > now())
        AND (a.region_id ILIKE $1)
      ORDER BY a.severity DESC, a.created_at DESC 
      LIMIT 20
    `;

    const result = await serviceQuery(query, [`%${region}%`]);

    res.json({
      success: true,
      cc_alerts: result.rows,
      count: result.rows.length
    });

  } catch (error: any) {
    console.error('Public cc_alerts fetch error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch cc_alerts' 
    });
  }
});

router.get('/cc_portals/:slug/weather', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const portalResult = await serviceQuery(`
      SELECT p.id, p.owning_tenant_id, p.settings
      FROM cc_portals p 
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

router.get('/cc_portals/:slug/ferries', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const portalResult = await serviceQuery(`
      SELECT p.id, p.owning_tenant_id, p.settings
      FROM cc_portals p 
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

router.get('/cc_portals/:slug/good-news', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { limit = '20' } = req.query;

    const portalResult = await serviceQuery(`
      SELECT p.id, p.owning_tenant_id
      FROM cc_portals p 
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
 * GET /api/public/cc_portals/:slug/presentations
 * 
 * List published presentations for a portal.
 * Supports filtering by entity_type and presentation_type.
 */
router.get('/cc_portals/:slug/presentations', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { entity_type, presentation_type, tag, limit = '20', offset = '0' } = req.query;

    // Verify portal exists (serviceQuery bypasses RLS to find any portal by slug)
    const portalResult = await serviceQuery(`
      SELECT p.id FROM cc_portals p 
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
        ) FROM cc_presentation_blocks pb WHERE pb.presentation_id = ep.id) as blocks
      FROM cc_articles ep
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
 * GET /api/public/cc_portals/:slug/presentations/:presentationSlug
 * 
 * Get a single presentation with all blocks and metadata.
 */
router.get('/cc_portals/:slug/presentations/:presentationSlug', async (req: Request, res: Response) => {
  try {
    const { slug, presentationSlug } = req.params;

    // Verify portal exists (serviceQuery bypasses RLS to find any portal by slug)
    const portalResult = await serviceQuery(`
      SELECT p.id, p.name, p.slug FROM cc_portals p 
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
        ) FROM cc_presentation_blocks pb WHERE pb.presentation_id = ep.id) as blocks,
        (SELECT jsonb_agg(
          jsonb_build_object(
            'entity_type', pel.entity_type,
            'entity_id', pel.entity_id,
            'role', pel.role
          )
          ORDER BY pel.sort_order
        ) FROM cc_presentation_entity_links pel WHERE pel.presentation_id = ep.id) as cc_entity_links
      FROM cc_articles ep
      LEFT JOIN cc_voice_profiles vp ON vp.id = ep.voice_profile_id
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

/**
 * GET /api/public/cc_portals/:slug/site
 * 
 * Returns complete site configuration + initial data for public site rendering.
 * Includes brand info, sections config, theme, assets, and cc_articles.
 */
router.get('/cc_portals/:slug/site', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    
    const portalResult = await serviceQuery(`
      SELECT 
        p.id,
        p.name,
        p.slug,
        p.status,
        p.tagline,
        p.description,
        p.legal_dba_name,
        p.portal_type,
        p.base_url,
        p.settings,
        p.site_config,
        p.owning_tenant_id,
        pt.tokens as theme
      FROM cc_portals p
      LEFT JOIN cc_portal_theme pt ON pt.portal_id = p.id AND pt.is_live = true
      WHERE p.slug = $1 AND p.status = 'active'
    `, [slug]);
    
    if (portalResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Portal not found' });
    }
    
    const portal = portalResult.rows[0];
    const siteConfig = portal.site_config || {};
    const tenantId = portal.owning_tenant_id;
    
    // Get assets for this portal's tenant
    const assetsResult = await serviceQuery(`
      SELECT 
        a.id,
        a.name,
        a.description,
        a.asset_type,
        a.schema_type,
        a.slug,
        a.is_available,
        a.rate_hourly,
        a.rate_daily,
        a.rate_weekly,
        a.thumbnail_url,
        a.images,
        a.sleeps_total,
        a.bedrooms,
        a.bathrooms_full,
        a.overall_rating,
        a.review_count
      FROM cc_assets a
      WHERE a.owner_tenant_id = $1 
        AND a.status = 'active'
        AND a.is_available = true
      ORDER BY a.name
      LIMIT 50
    `, [tenantId]);
    
    // Get cc_media for assets
    const assetIds = assetsResult.rows.map(a => a.id);
    let assetsWithMedia = assetsResult.rows;
    
    if (assetIds.length > 0) {
      const mediaResult = await serviceQuery(`
        SELECT 
          em.entity_id as asset_id,
          em.role,
          em.sort_order,
          m.id as media_id,
          m.public_url,
          m.alt_text,
          m.variants
        FROM cc_entity_media em
        JOIN cc_media m ON m.id = em.media_id
        WHERE em.entity_type = 'asset' 
          AND em.entity_id = ANY($1::uuid[])
        ORDER BY em.sort_order
      `, [assetIds]);
      
      const mediaByAsset: Record<string, any[]> = {};
      for (const m of mediaResult.rows) {
        if (!mediaByAsset[m.asset_id]) mediaByAsset[m.asset_id] = [];
        mediaByAsset[m.asset_id].push(m);
      }
      
      assetsWithMedia = assetsResult.rows.map(asset => {
        const assetMedia = mediaByAsset[asset.id] || [];
        const hero = assetMedia.find(m => m.role === 'hero');
        const gallery = assetMedia.filter(m => m.role === 'gallery');
        return {
          ...asset,
          cc_media: {
            hero: hero ? { url: hero.public_url, thumbnail: hero.variants?.thumbnail, alt: hero.alt_text } : null,
            gallery: gallery.map(g => ({ url: g.public_url, thumbnail: g.variants?.thumbnail, alt: g.alt_text }))
          }
        };
      });
    }
    
    // Get latest cc_articles for this portal
    const articlesResult = await serviceQuery(`
      SELECT 
        id, slug, title, subtitle, summary, featured_image_url, published_at
      FROM cc_articles
      WHERE portal_id = $1 
        AND status = 'published'
        AND visibility = 'public'
      ORDER BY published_at DESC NULLS LAST
      LIMIT 6
    `, [portal.id]);
    
    // Build JSON-LD for SEO
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': siteConfig.schema_type || 'LocalBusiness',
      'name': siteConfig.brand_name || portal.name,
      'description': siteConfig.seo?.description || siteConfig.tagline || portal.tagline,
      'url': portal.base_url || `https://${slug}.communitycanvas.ca`,
      'telephone': siteConfig.contact?.telephone,
      'email': siteConfig.contact?.email,
    };
    
    res.json({
      success: true,
      portal: {
        id: portal.id,
        slug: portal.slug,
        name: portal.name,
        legal_dba_name: portal.legal_dba_name,
        portal_type: portal.portal_type,
        base_url: portal.base_url
      },
      site: siteConfig,
      theme: portal.theme || {},
      initial_data: {
        assets: assetsWithMedia,
        cc_articles: articlesResult.rows
      },
      json_ld: jsonLd
    });
    
  } catch (error: any) {
    console.error('Public site fetch error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch site' });
  }
});

/**
 * GET /api/public/cc_portals/:slug/assets
 * 
 * Returns public assets for a portal, optionally filtered by type.
 */
router.get('/cc_portals/:slug/assets', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { type } = req.query;
    
    const portalResult = await serviceQuery(`
      SELECT id, owning_tenant_id FROM cc_portals WHERE slug = $1 AND status = 'active'
    `, [slug]);
    
    if (portalResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Portal not found' });
    }
    
    const tenantId = portalResult.rows[0].owning_tenant_id;
    
    let assetsQuery = `
      SELECT 
        a.id,
        a.name,
        a.description,
        a.asset_type,
        a.schema_type,
        a.slug,
        a.is_available,
        a.rate_hourly,
        a.rate_daily,
        a.rate_weekly,
        a.thumbnail_url,
        a.images,
        a.sleeps_total,
        a.bedrooms,
        a.bathrooms_full,
        a.overall_rating,
        a.review_count
      FROM cc_assets a
      WHERE a.owner_tenant_id = $1 
        AND a.status = 'active'
        AND a.is_available = true
    `;
    const params: any[] = [tenantId];
    
    if (type) {
      assetsQuery += ` AND a.asset_type = $2`;
      params.push(type);
    }
    
    assetsQuery += ` ORDER BY a.name LIMIT 100`;
    
    const assetsResult = await serviceQuery(assetsQuery, params);
    
    // Get cc_media for assets
    const assetIds = assetsResult.rows.map(a => a.id);
    let assetsWithMedia = assetsResult.rows;
    
    if (assetIds.length > 0) {
      const mediaResult = await serviceQuery(`
        SELECT 
          em.entity_id as asset_id,
          em.role,
          m.public_url,
          m.alt_text,
          m.variants
        FROM cc_entity_media em
        JOIN cc_media m ON m.id = em.media_id
        WHERE em.entity_type = 'asset' 
          AND em.entity_id = ANY($1::uuid[])
        ORDER BY em.sort_order
      `, [assetIds]);
      
      const mediaByAsset: Record<string, any[]> = {};
      for (const m of mediaResult.rows) {
        if (!mediaByAsset[m.asset_id]) mediaByAsset[m.asset_id] = [];
        mediaByAsset[m.asset_id].push(m);
      }
      
      assetsWithMedia = assetsResult.rows.map(asset => {
        const assetMedia = mediaByAsset[asset.id] || [];
        const hero = assetMedia.find(m => m.role === 'hero');
        const gallery = assetMedia.filter(m => m.role === 'gallery');
        return {
          ...asset,
          cc_media: {
            hero: hero ? { url: hero.public_url, thumbnail: hero.variants?.thumbnail, alt: hero.alt_text } : null,
            gallery: gallery.map(g => ({ url: g.public_url, thumbnail: g.variants?.thumbnail, alt: g.alt_text }))
          }
        };
      });
    }
    
    res.json({ success: true, assets: assetsWithMedia });
    
  } catch (error: any) {
    console.error('Public assets fetch error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch assets' });
  }
});

/**
 * GET /api/public/cc_portals/:slug/availability
 * 
 * Check availability for assets within a date range.
 */
router.get('/cc_portals/:slug/availability', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { asset_id, asset_type, start, end } = req.query;
    
    if (!start || !end) {
      return res.status(400).json({ 
        success: false, 
        error: 'start and end query parameters are required (ISO format)' 
      });
    }
    
    const startDate = new Date(start as string);
    const endDate = new Date(end as string);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid date format' });
    }
    
    const portalResult = await serviceQuery(`
      SELECT id, name, slug, owning_tenant_id FROM cc_portals WHERE slug = $1 AND status = 'active'
    `, [slug]);
    
    if (portalResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Portal not found' });
    }
    
    const portal = portalResult.rows[0];
    const tenantId = portal.owning_tenant_id;
    
    // Get assets
    let assetsQuery = `
      SELECT id, name, asset_type, schema_type, description, thumbnail_url
      FROM cc_assets
      WHERE owner_tenant_id = $1 
        AND status = 'active'
        AND is_available = true
    `;
    const params: any[] = [tenantId];
    let paramIndex = 2;
    
    if (asset_type) {
      assetsQuery += ` AND asset_type = $${paramIndex}`;
      params.push(asset_type);
      paramIndex++;
    }
    
    if (asset_id) {
      assetsQuery += ` AND id = $${paramIndex}::uuid`;
      params.push(asset_id);
      paramIndex++;
    }
    
    const assetsResult = await serviceQuery(assetsQuery, params);
    
    // For each asset, check for conflicts
    const results = await Promise.all(assetsResult.rows.map(async (asset) => {
      // Check cc_reservations that overlap
      const conflictsResult = await serviceQuery(`
        SELECT id, start_date, end_date, status
        FROM cc_reservations
        WHERE asset_id = $1
          AND status NOT IN ('cancelled')
          AND (
            (start_date < $3 AND end_date > $2)
          )
      `, [asset.id, startDate, endDate]);
      
      // Also check cc_resource_schedule_events
      const scheduleResult = await serviceQuery(`
        SELECT id, start_date, end_date, status
        FROM cc_resource_schedule_events
        WHERE resource_id = $1
          AND status NOT IN ('cancelled')
          AND (
            (start_date < $3 AND end_date > $2)
          )
      `, [asset.id, startDate, endDate]);
      
      const busyPeriods = [
        ...conflictsResult.rows.map(r => ({ start: r.start_date, end: r.end_date, source: 'reservation' })),
        ...scheduleResult.rows.map(r => ({ start: r.start_date, end: r.end_date, source: 'schedule' }))
      ];
      
      const isAvailable = busyPeriods.length === 0;
      
      return {
        asset_id: asset.id,
        name: asset.name,
        asset_type: asset.asset_type,
        schema_type: asset.schema_type,
        description: asset.description,
        thumbnail_url: asset.thumbnail_url,
        busy_periods: busyPeriods,
        available: isAvailable
      };
    }));
    
    res.json({
      success: true,
      portal: { id: portal.id, slug: portal.slug, name: portal.name },
      query: { start, end },
      assets: results,
      summary: {
        total: results.length,
        available: results.filter(r => r.available).length,
        booked: results.filter(r => !r.available).length
      }
    });
    
  } catch (error: any) {
    console.error('Availability check error:', error);
    res.status(500).json({ success: false, error: 'Failed to check availability' });
  }
});

/**
 * GET /api/public/cc_portals/:slug/availability/calendar
 * 
 * Get availability calendar for a specific asset for a month.
 */
router.get('/cc_portals/:slug/availability/calendar', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { asset_id, month } = req.query;
    
    if (!asset_id || !month) {
      return res.status(400).json({ 
        success: false, 
        error: 'asset_id and month (YYYY-MM) query parameters are required' 
      });
    }
    
    const [year, monthNum] = (month as string).split('-').map(Number);
    if (!year || !monthNum || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ success: false, error: 'Invalid month format. Use YYYY-MM' });
    }
    
    // Verify portal and asset
    const portalResult = await serviceQuery(`
      SELECT p.id, p.owning_tenant_id 
      FROM cc_portals p WHERE p.slug = $1 AND p.status = 'active'
    `, [slug]);
    
    if (portalResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Portal not found' });
    }
    
    const assetResult = await serviceQuery(`
      SELECT id, name FROM cc_assets 
      WHERE id = $1::uuid AND owner_tenant_id = $2 AND status = 'active'
    `, [asset_id, portalResult.rows[0].owning_tenant_id]);
    
    if (assetResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Asset not found' });
    }
    
    const startOfMonth = new Date(year, monthNum - 1, 1);
    const endOfMonth = new Date(year, monthNum, 0, 23, 59, 59);
    
    // Get all cc_reservations for this month
    const reservationsResult = await serviceQuery(`
      SELECT start_date, end_date
      FROM cc_reservations
      WHERE asset_id = $1::uuid
        AND status NOT IN ('cancelled')
        AND start_date <= $3
        AND end_date >= $2
    `, [asset_id, startOfMonth, endOfMonth]);
    
    // Get schedule cc_events
    const scheduleResult = await serviceQuery(`
      SELECT start_date, end_date
      FROM cc_resource_schedule_events
      WHERE resource_id = $1::uuid
        AND status NOT IN ('cancelled')
        AND start_date <= $3
        AND end_date >= $2
    `, [asset_id, startOfMonth, endOfMonth]);
    
    const cc_events = [...reservationsResult.rows, ...scheduleResult.rows];
    
    // Build day-by-day status
    const daysInMonth = endOfMonth.getDate();
    const days = [];
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStart = new Date(year, monthNum - 1, day, 0, 0, 0);
      const dayEnd = new Date(year, monthNum - 1, day, 23, 59, 59);
      
      const dayEvents = cc_events.filter(e => {
        const eStart = new Date(e.start_date || e.start_date);
        const eEnd = new Date(e.end_date || e.end_date);
        return eStart <= dayEnd && eEnd >= dayStart;
      });
      
      days.push({
        date: `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        status: dayEvents.length > 0 ? 'booked' : 'available',
        events_count: dayEvents.length
      });
    }
    
    res.json({
      success: true,
      asset_id,
      asset_name: assetResult.rows[0].name,
      month: month as string,
      days
    });
    
  } catch (error: any) {
    console.error('Availability calendar error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch calendar' });
  }
});

/**
 * POST /api/public/cc_portals/:slug/cc_reservations
 * 
 * Create a public reservation for an asset.
 */
router.post('/cc_portals/:slug/cc_reservations', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { asset_id, start, end, customer, notes, consents } = req.body;
    
    // Validate required fields
    if (!asset_id || !start || !end || !customer?.name || !customer?.email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Required fields: asset_id, start, end, customer.name, customer.email' 
      });
    }
    
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid date format' });
    }
    
    if (endDate <= startDate) {
      return res.status(400).json({ success: false, error: 'End date must be after start date' });
    }
    
    // Get portal
    const portalResult = await serviceQuery(`
      SELECT id, name, slug, owning_tenant_id 
      FROM cc_portals WHERE slug = $1 AND status = 'active'
    `, [slug]);
    
    if (portalResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Portal not found' });
    }
    
    const portal = portalResult.rows[0];
    const tenantId = portal.owning_tenant_id;
    
    // Verify asset belongs to this tenant
    const assetResult = await serviceQuery(`
      SELECT id, name, asset_type, rate_daily, rate_hourly
      FROM cc_assets
      WHERE id = $1::uuid AND owner_tenant_id = $2 AND status = 'active'
    `, [asset_id, tenantId]);
    
    if (assetResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Asset not found' });
    }
    
    const asset = assetResult.rows[0];
    
    // Check for conflicts
    const conflictsResult = await serviceQuery(`
      SELECT id, start_date, end_date
      FROM cc_reservations
      WHERE asset_id = $1::uuid
        AND status NOT IN ('cancelled')
        AND (start_date < $3 AND end_date > $2)
    `, [asset_id, startDate, endDate]);
    
    const scheduleConflicts = await serviceQuery(`
      SELECT id, start_date, end_date
      FROM cc_resource_schedule_events
      WHERE resource_id = $1::uuid
        AND status NOT IN ('cancelled')
        AND (start_date < $3 AND end_date > $2)
    `, [asset_id, startDate, endDate]);
    
    if (conflictsResult.rows.length > 0 || scheduleConflicts.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'RESOURCE_TIME_CONFLICT',
        message: 'This time slot is no longer available',
        conflicts: [
          ...conflictsResult.rows.map(c => ({ start: c.start_date, end: c.end_date })),
          ...scheduleConflicts.rows.map(c => ({ start: c.start_date, end: c.end_date }))
        ]
      });
    }
    
    // For public guest reservations, we don't require a cc_individuals record
    // Guest info is stored in primary_guest_* fields on the reservation
    // customer_id will be NULL for anonymous public reservations
    
    // Generate confirmation number
    const prefix = slug.substring(0, 3).toUpperCase().replace(/-/g, '');
    const year = new Date().getFullYear();
    const seq = Math.random().toString(36).substring(2, 8).toUpperCase();
    const confirmationNumber = `${prefix}-${year}-${seq}`;
    
    // Create reservation (customer_id is NULL for public guest reservations)
    const reservationResult = await serviceQuery(`
      INSERT INTO cc_reservations (
        confirmation_number, asset_id, provider_id,
        primary_guest_name, primary_guest_email, primary_guest_telephone,
        start_date, end_date, status, payment_status, portal_id,
        special_requests, schema_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', 'unpaid', $9, $10, 'Reservation')
      RETURNING id, confirmation_number
    `, [
      confirmationNumber, asset_id, tenantId,
      customer.name, customer.email, customer.telephone || null,
      startDate, endDate, portal.id, notes || null
    ]);
    
    const reservation = reservationResult.rows[0];
    
    // Snap times to 15-minute boundaries for schedule event (required by check constraint)
    const snapTo15Min = (date: Date): Date => {
      const d = new Date(date);
      d.setMinutes(Math.floor(d.getMinutes() / 15) * 15);
      d.setSeconds(0);
      d.setMilliseconds(0);
      return d;
    };
    const scheduleStart = snapTo15Min(startDate);
    const scheduleEnd = snapTo15Min(endDate);
    
    // Create schedule event to block time
    await serviceQuery(`
      INSERT INTO cc_resource_schedule_events (
        tenant_id, resource_id, event_type, start_date, end_date, 
        status, title, related_entity_type, related_entity_id
      ) VALUES ($1, $2, 'booked', $3, $4, 'active', $5, 'reservation', $6)
    `, [tenantId, asset_id, scheduleStart, scheduleEnd, `${customer.name} - ${asset.name}`, reservation.id]);
    
    res.status(201).json({
      success: true,
      reservation_id: reservation.id,
      confirmation_number: confirmationNumber,
      status: 'pending',
      payment_status: 'unpaid',
      asset: {
        id: asset.id,
        name: asset.name,
        type: asset.asset_type
      },
      dates: { start, end },
      customer: { name: customer.name, email: customer.email },
      next_steps: 'A confirmation email will be sent shortly. Payment can be completed upon arrival or via link.'
    });
    
  } catch (error: any) {
    console.error('Create reservation error:', error);
    res.status(500).json({ success: false, error: 'Failed to create reservation' });
  }
});

// ============================================================================
// EXPEDITION ENGINE - Public Trip Portal Endpoints
// ============================================================================

// GET /api/public/trips/:accessCode - Get trip by access code (public guest view)
router.get('/trips/:accessCode', async (req: Request, res: Response) => {
  const { accessCode } = req.params;
  
  try {
    const tripResult = await serviceQuery(`
      SELECT 
        t.id,
        t.access_code,
        t.status,
        t.start_date,
        t.end_date,
        t.group_name,
        t.group_size,
        t.origin_name,
        t.origin_type,
        t.has_vehicle,
        t.has_trailer,
        t.trailer_type,
        t.boat_length_ft,
        t.next_destination_name,
        t.coordinate_handoff,
        t.current_alert_level,
        t.last_conditions_check,
        t.portal_id,
        t.tenant_id
      FROM cc_trips t
      WHERE t.access_code = $1
    `, [accessCode]);
    
    if (tripResult.rows.length === 0) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    
    const tripRow = tripResult.rows[0];
    
    let portal = null;
    if (tripRow.portal_id) {
      const portalResult = await serviceQuery(`
        SELECT id, name, slug FROM cc_portals WHERE id = $1
      `, [tripRow.portal_id]);
      if (portalResult.rows.length > 0) {
        portal = portalResult.rows[0];
      }
    }
    
    const itineraryResult = await serviceQuery(`
      SELECT 
        id, trip_id, item_type, title, description, is_reserved, status,
        day_date, start_time, end_time, all_day, everyone, location_name,
        location_lat, location_lng, weather_sensitive, photo_moment,
        suggested_caption, icon, color, sort_order
      FROM cc_trip_itinerary_items
      WHERE trip_id = $1
      ORDER BY day_date, sort_order
    `, [tripRow.id]);
    
    const timepointsResult = await serviceQuery(`
      SELECT 
        id, trip_id, kind, time_exact, time_window_start, time_window_end,
        time_confidence, location_name, location_lat, location_lng,
        guest_notes, itinerary_item_id
      FROM cc_trip_timepoints
      WHERE trip_id = $1
      ORDER BY COALESCE(time_exact, time_window_start)
    `, [tripRow.id]);
    
    const participantsResult = await serviceQuery(`
      SELECT id, trip_id, participant_id, role, skills_verified, equipment_verified FROM cc_trip_participants
      WHERE trip_id = $1
    `, [tripRow.id]);
    
    const passengersResult = await serviceQuery(`
      SELECT id, trip_id, name, age_category, exact_age, needs_car_seat FROM cc_trip_passengers
      WHERE trip_id = $1
    `, [tripRow.id]);
    
    const routePointsResult = await serviceQuery(`
      SELECT 
        id, trip_id, segment_order, segment_type, provider_name, provider_type,
        scheduled_date, scheduled_time, duration_minutes, location_name,
        location_lat, location_lng, confirmation_number, status
      FROM cc_trip_route_points
      WHERE trip_id = $1
      ORDER BY segment_order
    `, [tripRow.id]);
    
    const startDate = new Date(tripRow.start_date);
    const endDate = tripRow.end_date ? new Date(tripRow.end_date) : startDate;
    const tripDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const daysUntilTrip = Math.ceil((startDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    
    const calendar = [];
    for (let i = 0; i < tripDays; i++) {
      const dayDate = new Date(startDate);
      dayDate.setDate(dayDate.getDate() + i);
      const dateStr = dayDate.toISOString().split('T')[0];
      
      const dayItems = itineraryResult.rows.filter((item: any) => {
        const itemDate = typeof item.day_date === 'string' ? item.day_date : item.day_date?.toISOString?.()?.split('T')[0];
        return itemDate === dateStr;
      });
      const dayTimepoints = timepointsResult.rows.filter((tp: any) => {
        const tpDate = tp.time_exact || tp.time_window_start;
        return tpDate && new Date(tpDate).toISOString().split('T')[0] === dateStr;
      });
      
      calendar.push({
        date: dateStr,
        dayNumber: i + 1,
        isArrivalDay: i === 0,
        isDepartureDay: i === tripDays - 1,
        items: dayItems,
        timepoints: dayTimepoints,
      });
    }
    
    return res.json({
      trip: {
        id: tripRow.id,
        accessCode: tripRow.access_code,
        status: tripRow.status,
        startDate: tripRow.start_date,
        endDate: tripRow.end_date,
        groupName: tripRow.group_name,
        groupSize: tripRow.group_size,
        originName: tripRow.origin_name,
        originType: tripRow.origin_type,
        hasVehicle: tripRow.has_vehicle,
        hasTrailer: tripRow.has_trailer,
        trailerType: tripRow.trailer_type,
        boatLengthFt: tripRow.boat_length_ft,
        nextDestinationName: tripRow.next_destination_name,
        coordinateHandoff: tripRow.coordinate_handoff,
        currentAlertLevel: tripRow.current_alert_level,
        lastConditionsCheck: tripRow.last_conditions_check,
      },
      portal: portal ? {
        id: portal.id,
        name: portal.name,
        slug: portal.slug,
      } : null,
      tripDays,
      daysUntilTrip,
      calendar,
      itineraryItems: itineraryResult.rows,
      timepoints: timepointsResult.rows,
      participants: participantsResult.rows,
      passengers: passengersResult.rows,
      routePoints: routePointsResult.rows,
    });
    
  } catch (error) {
    console.error('Error fetching trip:', error);
    return res.status(500).json({ error: 'Failed to fetch trip' });
  }
});

// GET /api/public/portals/:portalSlug/moments - Get curated moments for a portal
// NOTE: Handled by new momentService routes below - this route replaced

// POST /api/public/trips/:accessCode/itinerary - Add itinerary item
router.post('/trips/:accessCode/itinerary', async (req: Request, res: Response) => {
  const { accessCode } = req.params;
  const { 
    momentId,
    title, 
    description,
    itemType,
    dayDate, 
    startTime, 
    endTime,
    allDay,
    locationName,
    photoMoment,
  } = req.body;
  
  try {
    const tripResult = await serviceQuery(`
      SELECT id FROM cc_trips WHERE access_code = $1
    `, [accessCode]);
    
    if (tripResult.rows.length === 0) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    
    const tripId = tripResult.rows[0].id;
    
    let itemData: any = {
      trip_id: tripId,
      day_date: dayDate,
      start_time: startTime,
      end_time: endTime,
      all_day: allDay || false,
      status: 'planned',
      created_by: 'organizer',
    };
    
    if (momentId) {
      const momentResult = await serviceQuery(`
        SELECT 
          id, portal_id, title, description, moment_type, best_time_of_day,
          best_weather, location_name, location_lat, location_lng, kid_friendly,
          pro_tip, safety_note, photo_moment, suggested_caption, image_url, icon
        FROM cc_portal_moments WHERE id = $1
      `, [momentId]);
      
      if (momentResult.rows.length > 0) {
        const moment = momentResult.rows[0];
        itemData = {
          ...itemData,
          title: moment.title,
          description: moment.description,
          item_type: moment.moment_type === 'rainy_day' ? 'activity' : moment.moment_type,
          location_name: moment.location_name,
          location_lat: moment.location_lat,
          location_lng: moment.location_lng,
          photo_moment: moment.photo_moment,
          suggested_caption: moment.suggested_caption,
          icon: moment.icon,
          weather_sensitive: moment.best_weather === 'clear',
        };
      }
    } else {
      itemData = {
        ...itemData,
        title,
        description,
        item_type: itemType || 'activity',
        location_name: locationName,
        photo_moment: photoMoment || false,
      };
    }
    
    const insertResult = await serviceQuery(`
      INSERT INTO cc_trip_itinerary_items (
        trip_id, item_type, title, description, is_reserved, status,
        day_date, start_time, end_time, all_day, location_name,
        location_lat, location_lng, weather_sensitive, photo_moment,
        suggested_caption, icon, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING id, trip_id, item_type, title, description, is_reserved, status,
        day_date, start_time, end_time, all_day, everyone, location_name,
        location_lat, location_lng, weather_sensitive, photo_moment,
        suggested_caption, icon, color, sort_order
    `, [
      itemData.trip_id,
      itemData.item_type || 'activity',
      itemData.title,
      itemData.description,
      false,
      itemData.status,
      itemData.day_date,
      itemData.start_time,
      itemData.end_time,
      itemData.all_day,
      itemData.location_name,
      itemData.location_lat,
      itemData.location_lng,
      itemData.weather_sensitive || false,
      itemData.photo_moment || false,
      itemData.suggested_caption,
      itemData.icon,
      itemData.created_by,
    ]);
    
    return res.json({ success: true, item: insertResult.rows[0] });
  } catch (error) {
    console.error('Error adding itinerary item:', error);
    return res.status(500).json({ error: 'Failed to add item' });
  }
});

// PATCH /api/public/trips/:accessCode/itinerary/:itemId - Update itinerary item
router.patch('/trips/:accessCode/itinerary/:itemId', async (req: Request, res: Response) => {
  const { accessCode, itemId } = req.params;
  const updates = req.body;
  
  try {
    const tripResult = await serviceQuery(`
      SELECT id FROM cc_trips WHERE access_code = $1
    `, [accessCode]);
    
    if (tripResult.rows.length === 0) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    
    const tripId = tripResult.rows[0].id;
    
    const allowedFields = ['title', 'description', 'item_type', 'day_date', 'start_time', 'end_time', 
                           'all_day', 'status', 'location_name', 'photo_moment', 'weather_sensitive'];
    const setClause: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    for (const [key, value] of Object.entries(updates)) {
      const dbKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      if (allowedFields.includes(dbKey)) {
        setClause.push(`${dbKey} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }
    
    if (setClause.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    setClause.push(`updated_at = NOW()`);
    values.push(itemId, tripId);
    
    const updateResult = await serviceQuery(`
      UPDATE cc_trip_itinerary_items 
      SET ${setClause.join(', ')}
      WHERE id = $${paramIndex} AND trip_id = $${paramIndex + 1}
      RETURNING id, trip_id, item_type, title, description, is_reserved, status,
        day_date, start_time, end_time, all_day, everyone, location_name,
        location_lat, location_lng, weather_sensitive, photo_moment,
        suggested_caption, icon, color, sort_order
    `, values);
    
    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    return res.json({ success: true, item: updateResult.rows[0] });
  } catch (error) {
    console.error('Error updating itinerary item:', error);
    return res.status(500).json({ error: 'Failed to update item' });
  }
});

// DELETE /api/public/trips/:accessCode/itinerary/:itemId - Delete itinerary item
router.delete('/trips/:accessCode/itinerary/:itemId', async (req: Request, res: Response) => {
  const { accessCode, itemId } = req.params;
  
  try {
    const tripResult = await serviceQuery(`
      SELECT id FROM cc_trips WHERE access_code = $1
    `, [accessCode]);
    
    if (tripResult.rows.length === 0) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    
    const tripId = tripResult.rows[0].id;
    
    await serviceQuery(`
      DELETE FROM cc_trip_itinerary_items 
      WHERE id = $1 AND trip_id = $2
    `, [itemId, tripId]);
    
    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting itinerary item:', error);
    return res.status(500).json({ error: 'Failed to delete item' });
  }
});

// ============ CART ENDPOINTS ============

// POST /api/public/portals/:slug/carts - Create cart from portal
router.post('/portals/:slug/carts', async (req: Request, res: Response) => {
  const { slug } = req.params;
  const b = req.body || {};
  
  try {
    const result = await createCart({
      portalSlug: slug,
      source: 'portal',
      sourceRef: slug,
      entryPoint: b.entryPoint || slug,
      primaryGuestName: b.primaryGuestName,
      primaryGuestEmail: b.primaryGuestEmail,
      primaryGuestPhone: b.primaryGuestPhone,
      partyAdults: b.partyAdults,
      partyChildren: b.partyChildren,
      partyInfants: b.partyInfants,
      intent: b.intent,
      needs: b.needs,
      payment: b.payment,
      travel: b.travel
    });
    
    res.json(result);
  } catch (e: any) {
    console.error('Create cart error:', e);
    res.status(500).json({ error: 'Failed to create cart' });
  }
});

// GET /api/public/carts/:cartId - Get cart by ID (requires X-Cart-Token)
router.get('/carts/:cartId', async (req: Request, res: Response) => {
  const { cartId } = req.params;
  const token = req.headers['x-cart-token'] as string;
  
  if (!token) {
    return res.status(401).json({ error: 'X-Cart-Token header required' });
  }
  
  try {
    const result = await getCart(cartId, token);
    if (!result) {
      return res.status(404).json({ error: 'Cart not found or invalid token' });
    }
    res.json(result);
  } catch (e: any) {
    console.error('Get cart error:', e);
    res.status(500).json({ error: 'Failed to get cart' });
  }
});

// POST /api/public/carts/:cartId/items - Add item to cart (requires X-Cart-Token)
router.post('/carts/:cartId/items', async (req: Request, res: Response) => {
  const { cartId } = req.params;
  const token = req.headers['x-cart-token'] as string;
  const b = req.body || {};
  
  if (!token) {
    return res.status(401).json({ error: 'X-Cart-Token header required' });
  }
  
  try {
    const cart = await getCart(cartId, token);
    if (!cart) {
      return res.status(404).json({ error: 'Cart not found or invalid token' });
    }
    
    if (cart.cart.status !== 'draft') {
      return res.status(400).json({ error: 'Cart is not in draft status' });
    }
    
    const result = await addItem({
      cartId,
      itemType: b.itemType,
      title: b.title,
      description: b.description,
      reservationMode: b.reservationMode || 'internal',
      facilityId: b.facilityId,
      offerId: b.offerId,
      unitId: b.unitId,
      providerTenantId: b.providerTenantId,
      externalUrl: b.externalUrl,
      providerName: b.providerName,
      providerEmail: b.providerEmail,
      providerPhone: b.providerPhone,
      startAt: new Date(b.startAt),
      endAt: new Date(b.endAt),
      preferredTime: b.preferredTime,
      flexibleWindowMinutes: b.flexibleWindowMinutes,
      quantity: b.quantity,
      partySize: b.partySize,
      vesselLengthFt: b.vesselLengthFt,
      vehicleLengthFt: b.vehicleLengthFt,
      subtotalCents: b.subtotalCents,
      taxesCents: b.taxesCents,
      totalCents: b.totalCents,
      depositRequiredCents: b.depositRequiredCents,
      dietaryRequirements: b.dietaryRequirements,
      specialRequests: b.specialRequests,
      needsJson: b.needs,
      intentJson: b.intent
    });
    
    res.json(result);
  } catch (e: any) {
    console.error('Add item error:', e);
    res.status(500).json({ error: 'Failed to add item' });
  }
});

// PATCH /api/public/carts/:cartId/items/:itemId - Update item (requires X-Cart-Token)
router.patch('/carts/:cartId/items/:itemId', async (req: Request, res: Response) => {
  const { cartId, itemId } = req.params;
  const token = req.headers['x-cart-token'] as string;
  const b = req.body || {};
  
  if (!token) {
    return res.status(401).json({ error: 'X-Cart-Token header required' });
  }
  
  try {
    const cart = await getCart(cartId, token);
    if (!cart) {
      return res.status(404).json({ error: 'Cart not found or invalid token' });
    }
    
    const result = await updateItem({
      itemId,
      startAt: b.startAt ? new Date(b.startAt) : undefined,
      endAt: b.endAt ? new Date(b.endAt) : undefined,
      quantity: b.quantity,
      partySize: b.partySize,
      specialRequests: b.specialRequests
    });
    
    res.json(result);
  } catch (e: any) {
    console.error('Update item error:', e);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// DELETE /api/public/carts/:cartId/items/:itemId - Remove item (requires X-Cart-Token)
router.delete('/carts/:cartId/items/:itemId', async (req: Request, res: Response) => {
  const { cartId, itemId } = req.params;
  const token = req.headers['x-cart-token'] as string;
  
  if (!token) {
    return res.status(401).json({ error: 'X-Cart-Token header required' });
  }
  
  try {
    const cart = await getCart(cartId, token);
    if (!cart) {
      return res.status(404).json({ error: 'Cart not found or invalid token' });
    }
    
    const result = await removeItem(itemId);
    res.json(result);
  } catch (e: any) {
    console.error('Remove item error:', e);
    res.status(500).json({ error: 'Failed to remove item' });
  }
});

// POST /api/public/carts/:cartId/adjustments - Add adjustment (requires X-Cart-Token)
router.post('/carts/:cartId/adjustments', async (req: Request, res: Response) => {
  const { cartId } = req.params;
  const token = req.headers['x-cart-token'] as string;
  const b = req.body || {};
  
  if (!token) {
    return res.status(401).json({ error: 'X-Cart-Token header required' });
  }
  
  try {
    const cart = await getCart(cartId, token);
    if (!cart) {
      return res.status(404).json({ error: 'Cart not found or invalid token' });
    }
    
    const result = await addAdjustment(
      cartId,
      b.label,
      b.adjustmentType || 'discount',
      b.amountCents,
      b.itemId
    );
    
    res.json(result);
  } catch (e: any) {
    console.error('Add adjustment error:', e);
    res.status(500).json({ error: 'Failed to add adjustment' });
  }
});

// POST /api/public/carts/:cartId/update-guest - Update guest info (requires X-Cart-Token)
router.post('/carts/:cartId/update-guest', async (req: Request, res: Response) => {
  const { cartId } = req.params;
  const token = req.headers['x-cart-token'] as string;
  const b = req.body || {};
  
  if (!token) {
    return res.status(401).json({ error: 'X-Cart-Token header required' });
  }
  
  try {
    const cart = await getCart(cartId, token);
    if (!cart) {
      return res.status(404).json({ error: 'Cart not found or invalid token' });
    }
    
    const result = await updateCartGuest(cartId, {
      primaryGuestName: b.primaryGuestName,
      primaryGuestEmail: b.primaryGuestEmail,
      primaryGuestPhone: b.primaryGuestPhone,
      partyAdults: b.partyAdults,
      partyChildren: b.partyChildren,
      partyInfants: b.partyInfants,
      needs: b.needs
    });
    
    res.json(result);
  } catch (e: any) {
    console.error('Update guest error:', e);
    res.status(500).json({ error: 'Failed to update guest info' });
  }
});

// ============ RECOMMENDATION ENDPOINTS ============

// GET /api/public/portals/:slug/recommendations - Get weather-aware recommendations
router.get('/portals/:slug/recommendations', async (req: Request, res: Response) => {
  const { slug } = req.params;
  const { 
    date, 
    partyAdults, 
    partyChildren, 
    partyInfants,
    interests,
    budget,
    limit 
  } = req.query;
  
  try {
    const portalResult = await serviceQuery(`
      SELECT id FROM cc_portals WHERE slug = $1
    `, [slug]);
    
    if (portalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Portal not found' });
    }
    
    const result = await getRecommendations({
      portalId: portalResult.rows[0].id,
      locationCode: 'BAMFIELD',
      targetDate: date ? new Date(date as string) : new Date(),
      partyAdults: partyAdults ? parseInt(partyAdults as string) : 1,
      partyChildren: partyChildren ? parseInt(partyChildren as string) : 0,
      partyInfants: partyInfants ? parseInt(partyInfants as string) : 0,
      intent: {
        interests: interests ? (interests as string).split(',') : undefined,
        budget: budget as any
      },
      limit: limit ? parseInt(limit as string) : 10
    });
    
    res.json(result);
  } catch (e: any) {
    console.error('Recommendations error:', e);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

// GET /api/public/portals/:slug/weather - Get weather summary for date range
router.get('/portals/:slug/weather', async (req: Request, res: Response) => {
  const { start, end } = req.query;
  
  try {
    const startDate = start ? new Date(start as string) : new Date();
    const endDate = end ? new Date(end as string) : startDate;
    
    const result = await getWeatherSummary('BAMFIELD', startDate, endDate);
    
    res.json(result);
  } catch (e: any) {
    console.error('Weather error:', e);
    res.status(500).json({ error: 'Failed to get weather' });
  }
});

// POST /api/public/carts/:cartId/recommend - Get recommendations based on cart context
router.post('/carts/:cartId/recommend', async (req: Request, res: Response) => {
  const { cartId } = req.params;
  const token = req.headers['x-cart-token'] as string;
  
  if (!token) {
    return res.status(401).json({ error: 'X-Cart-Token header required' });
  }
  
  try {
    const cartResult = await getCart(cartId, token);
    if (!cartResult) {
      return res.status(404).json({ error: 'Cart not found or invalid token' });
    }
    
    const { cart, items } = cartResult;
    
    let targetDate = new Date();
    if (items.length > 0 && items[0].startAt) {
      targetDate = new Date(items[0].startAt);
    } else if (req.body.date) {
      targetDate = new Date(req.body.date);
    }
    
    const addedTypes = items.map((i: any) => i.itemType);
    
    const result = await getRecommendations({
      portalId: cart.portalId,
      locationCode: 'BAMFIELD',
      targetDate,
      partyAdults: cart.partyAdults,
      partyChildren: cart.partyChildren,
      partyInfants: cart.partyInfants,
      needs: cart.needsJson,
      intent: cart.intentJson,
      excludeItemTypes: req.body.excludeAdded ? addedTypes : undefined,
      limit: req.body.limit || 5
    });
    
    res.json(result);
  } catch (e: any) {
    console.error('Cart recommend error:', e);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

// ============ CHECKOUT ROUTES ============

// POST /api/public/carts/:cartId/checkout - Process cart checkout
router.post('/carts/:cartId/checkout', async (req: Request, res: Response) => {
  const { cartId } = req.params;
  const token = req.headers['x-cart-token'] as string;
  
  if (!token) {
    return res.status(401).json({ error: 'Cart token required' });
  }
  
  const b = req.body || {};
  
  try {
    const result = await checkout({
      cartId,
      accessToken: token,
      primaryGuestName: b.primaryGuestName,
      primaryGuestEmail: b.primaryGuestEmail,
      primaryGuestPhone: b.primaryGuestPhone,
      paymentMethod: b.paymentMethod,
      paymentReference: b.paymentReference,
      isQuote: b.isQuote,
      quoteValidDays: b.quoteValidDays
    });
    
    if (result.errors.length > 0 && result.reservations.length === 0) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (e: any) {
    console.error('Checkout error:', e);
    res.status(400).json({ error: e.message });
  }
});

// POST /api/public/carts/:cartId/confirm-quote - Convert quote to booking
router.post('/carts/:cartId/confirm-quote', async (req: Request, res: Response) => {
  const { cartId } = req.params;
  const token = req.headers['x-cart-token'] as string;
  
  if (!token) {
    return res.status(401).json({ error: 'Cart token required' });
  }
  
  try {
    const result = await confirmQuote(cartId, token);
    res.json(result);
  } catch (e: any) {
    console.error('Confirm quote error:', e);
    res.status(400).json({ error: e.message });
  }
});

// POST /api/public/carts/:cartId/abandon - Cancel/abandon cart
router.post('/carts/:cartId/abandon', async (req: Request, res: Response) => {
  const { cartId } = req.params;
  const token = req.headers['x-cart-token'] as string;
  
  if (!token) {
    return res.status(401).json({ error: 'Cart token required' });
  }
  
  try {
    await abandonCart(cartId, token, req.body?.reason);
    res.json({ success: true, status: 'cancelled' });
  } catch (e: any) {
    console.error('Abandon cart error:', e);
    res.status(400).json({ error: e.message });
  }
});

// GET /api/public/carts/:cartId/receipt - Get receipt for completed cart
router.get('/carts/:cartId/receipt', async (req: Request, res: Response) => {
  const { cartId } = req.params;
  const token = req.headers['x-cart-token'] as string;
  
  if (!token) {
    return res.status(401).json({ error: 'Cart token required' });
  }
  
  try {
    const cartResult = await getCart(cartId, token);
    if (!cartResult) {
      return res.status(404).json({ error: 'Cart not found or invalid token' });
    }
    
    if (cartResult.cart.status !== 'completed' && cartResult.cart.status !== 'submitted') {
      return res.status(400).json({ error: 'Cart has not been checked out' });
    }
    
    // Load reservation details for items
    const reservationDetails = [];
    for (const item of cartResult.items) {
      if (item.reservationId) {
        const resResult = await serviceQuery(`
          SELECT id, confirmation_number, status, start_date, end_date
          FROM cc_reservations WHERE id = $1
        `, [item.reservationId]);
        
        if (resResult.rows[0]) {
          const r = resResult.rows[0];
          reservationDetails.push({
            itemTitle: item.title,
            confirmationNumber: r.confirmation_number,
            status: r.status,
            startAt: r.start_date,
            endAt: r.end_date
          });
        }
      }
    }
    
    res.json({
      cart: cartResult.cart,
      items: cartResult.items,
      adjustments: cartResult.adjustments,
      totals: cartResult.totals,
      reservations: reservationDetails
    });
  } catch (e: any) {
    console.error('Receipt error:', e);
    res.status(500).json({ error: 'Failed to get receipt' });
  }
});

// ============ MOMENT ENDPOINTS ============

import { 
  getMoments, getMomentBySlug, getMomentAvailability, 
  getCategories, addMomentToCart 
} from '../services/momentService';

router.get('/portals/:slug/moments', async (req: Request, res: Response) => {
  const { slug } = req.params;
  const { type, category, date, partySize, featured, limit, offset } = req.query;
  
  try {
    const result = await getMoments({
      portalSlug: slug,
      momentType: type as string,
      category: category as string,
      targetDate: date ? new Date(date as string) : undefined,
      partySize: partySize ? parseInt(partySize as string) : undefined,
      includeWeatherFit: !!date,
      featuredOnly: featured === 'true',
      limit: limit ? parseInt(limit as string) : 20,
      offset: offset ? parseInt(offset as string) : 0
    });
    
    res.json(result);
  } catch (e: any) {
    console.error('Get moments error:', e);
    res.status(500).json({ error: 'Failed to get moments' });
  }
});

router.get('/portals/:slug/moments/categories', async (req: Request, res: Response) => {
  const { slug } = req.params;
  
  try {
    const categories = await getCategories(slug);
    res.json({ categories });
  } catch (e: any) {
    console.error('Get categories error:', e);
    res.status(500).json({ error: 'Failed to get categories' });
  }
});

router.get('/portals/:slug/moments/:momentSlug', async (req: Request, res: Response) => {
  const { slug, momentSlug } = req.params;
  
  try {
    const result = await getMomentBySlug(slug, momentSlug);
    if (!result) {
      return res.status(404).json({ error: 'Moment not found' });
    }
    res.json(result);
  } catch (e: any) {
    console.error('Get moment error:', e);
    res.status(500).json({ error: 'Failed to get moment' });
  }
});

router.get('/portals/:slug/moments/:momentSlug/availability', async (req: Request, res: Response) => {
  const { slug, momentSlug } = req.params;
  const { start, end } = req.query;
  
  try {
    const momentResult = await getMomentBySlug(slug, momentSlug);
    if (!momentResult) {
      return res.status(404).json({ error: 'Moment not found' });
    }
    
    const startDate = start ? new Date(start as string) : new Date();
    const endDate = end ? new Date(end as string) : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const availability = await getMomentAvailability(momentResult.moment.id, startDate, endDate);
    
    res.json({ moment: momentResult.moment, availability });
  } catch (e: any) {
    console.error('Get availability error:', e);
    res.status(500).json({ error: 'Failed to get availability' });
  }
});

router.post('/carts/:cartId/moments', async (req: Request, res: Response) => {
  const { cartId } = req.params;
  const token = req.headers['x-cart-token'] as string;
  const b = req.body || {};
  
  if (!token) {
    return res.status(401).json({ error: 'Cart token required' });
  }
  
  if (!b.momentId || !b.startAt) {
    return res.status(400).json({ error: 'momentId and startAt required' });
  }
  
  try {
    const { getCart } = await import('../services/cartService');
    const cart = await getCart(cartId, token);
    if (!cart) {
      return res.status(404).json({ error: 'Cart not found or invalid token' });
    }
    
    const result = await addMomentToCart(cartId, b.momentId, {
      startAt: new Date(b.startAt),
      endAt: b.endAt ? new Date(b.endAt) : undefined,
      partySize: b.partySize,
      specialRequests: b.specialRequests
    });
    
    res.json(result);
  } catch (e: any) {
    console.error('Add moment to cart error:', e);
    res.status(400).json({ error: e.message });
  }
});

// ============ TRIP ENDPOINTS ============

import { 
  createTrip, getTrip, updateTrip, getTripCarts, createTripCart,
  createInvitation, getInvitation, acceptInvitation, declineInvitation, getTripInvitations
} from '../services/tripService';

router.post('/portals/:slug/trips', async (req: Request, res: Response) => {
  const { slug } = req.params;
  const b = req.body || {};
  
  if (!b.groupName || !b.primaryContactName) {
    return res.status(400).json({ error: 'groupName and primaryContactName required' });
  }
  
  try {
    const result = await createTrip({
      portalSlug: slug,
      groupName: b.groupName,
      tripType: b.tripType,
      startDate: b.startDate ? new Date(b.startDate) : undefined,
      endDate: b.endDate ? new Date(b.endDate) : undefined,
      primaryContactName: b.primaryContactName,
      primaryContactEmail: b.primaryContactEmail,
      primaryContactPhone: b.primaryContactPhone,
      expectedAdults: b.expectedAdults,
      expectedChildren: b.expectedChildren,
      expectedInfants: b.expectedInfants,
      intent: b.intent,
      needs: b.needs,
      budget: b.budget,
      viralSource: b.viralSource,
      referrerTripId: b.referrerTripId
    });
    
    res.json(result);
  } catch (e: any) {
    console.error('Create trip error:', e);
    res.status(500).json({ error: 'Failed to create trip' });
  }
});

router.get('/trips/:accessCode', async (req: Request, res: Response) => {
  const { accessCode } = req.params;
  
  try {
    const trip = await getTrip(accessCode);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    
    const carts = await getTripCarts(trip.id);
    
    res.json({ 
      trip, 
      carts, 
      shareUrl: `${process.env.PUBLIC_URL || 'https://communitycanvas.ca'}/trip/${accessCode}` 
    });
  } catch (e: any) {
    console.error('Get trip error:', e);
    res.status(500).json({ error: 'Failed to get trip' });
  }
});

router.patch('/trips/:accessCode', async (req: Request, res: Response) => {
  const { accessCode } = req.params;
  const b = req.body || {};
  
  try {
    const updated = await updateTrip(accessCode, {
      groupName: b.groupName,
      startDate: b.startDate ? new Date(b.startDate) : undefined,
      endDate: b.endDate ? new Date(b.endDate) : undefined,
      expectedAdults: b.expectedAdults,
      expectedChildren: b.expectedChildren,
      expectedInfants: b.expectedInfants,
      status: b.status,
      intentJson: b.intent,
      needsJson: b.needs,
      budgetJson: b.budget
    });
    
    if (!updated) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    
    res.json({ trip: updated });
  } catch (e: any) {
    console.error('Update trip error:', e);
    res.status(500).json({ error: 'Failed to update trip' });
  }
});

router.post('/trips/:accessCode/carts', async (req: Request, res: Response) => {
  const { accessCode } = req.params;
  const b = req.body || {};
  
  try {
    const result = await createTripCart(accessCode, {
      primaryGuestName: b.primaryGuestName,
      primaryGuestEmail: b.primaryGuestEmail
    });
    
    res.json(result);
  } catch (e: any) {
    console.error('Create trip cart error:', e);
    res.status(400).json({ error: e.message });
  }
});

// ============ INVITATION ENDPOINTS ============

router.post('/trips/:accessCode/invitations', async (req: Request, res: Response) => {
  const { accessCode } = req.params;
  const b = req.body || {};
  
  if (!b.invitationType) {
    return res.status(400).json({ error: 'invitationType required' });
  }
  
  try {
    const trip = await getTrip(accessCode);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    
    const result = await createInvitation({
      tripId: trip.id,
      invitationType: b.invitationType,
      recipientName: b.recipientName,
      recipientEmail: b.recipientEmail,
      recipientPhone: b.recipientPhone,
      messageSubject: b.messageSubject,
      messageBody: b.messageBody,
      senderName: b.senderName || trip.primary_contact_name,
      handoffId: b.handoffId,
      nextDestinationName: b.nextDestinationName,
      expiresInDays: b.expiresInDays
    });
    
    res.json(result);
  } catch (e: any) {
    console.error('Create invitation error:', e);
    res.status(500).json({ error: 'Failed to create invitation' });
  }
});

router.get('/trips/:accessCode/invitations', async (req: Request, res: Response) => {
  const { accessCode } = req.params;
  
  try {
    const trip = await getTrip(accessCode);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    
    const invitations = await getTripInvitations(trip.id);
    res.json({ invitations });
  } catch (e: any) {
    console.error('Get invitations error:', e);
    res.status(500).json({ error: 'Failed to get invitations' });
  }
});

router.get('/invite/:token', async (req: Request, res: Response) => {
  const { token } = req.params;
  
  try {
    const result = await getInvitation(token);
    if (!result) {
      return res.status(404).json({ error: 'Invitation not found' });
    }
    
    res.json(result);
  } catch (e: any) {
    console.error('Get invitation error:', e);
    res.status(500).json({ error: 'Failed to get invitation' });
  }
});

router.post('/invite/:token/accept', async (req: Request, res: Response) => {
  const { token } = req.params;
  const b = req.body || {};
  
  try {
    const result = await acceptInvitation(token, b.name, b.email);
    
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }
    
    res.json(result);
  } catch (e: any) {
    console.error('Accept invitation error:', e);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

router.post('/invite/:token/decline', async (req: Request, res: Response) => {
  const { token } = req.params;
  
  try {
    await declineInvitation(token);
    res.json({ success: true });
  } catch (e: any) {
    console.error('Decline invitation error:', e);
    res.status(500).json({ error: 'Failed to decline invitation' });
  }
});

// ============ PARTY PROFILE ENDPOINTS ============

import { 
  createProfile, getProfile, getTripProfiles, updateProfile, deleteProfile,
  aggregateNeeds, getDietaryTerms
} from '../services/partyService';

router.get('/trips/:accessCode/party', async (req: Request, res: Response) => {
  const { accessCode } = req.params;
  
  try {
    const trip = await getTrip(accessCode);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    
    const profiles = await getTripProfiles(trip.id);
    const aggregatedNeeds = await aggregateNeeds(trip.id);
    
    res.json({ profiles, aggregatedNeeds });
  } catch (e: any) {
    console.error('Get party error:', e);
    res.status(500).json({ error: 'Failed to get party' });
  }
});

router.post('/trips/:accessCode/party', async (req: Request, res: Response) => {
  const { accessCode } = req.params;
  const b = req.body || {};
  
  if (!b.displayName) {
    return res.status(400).json({ error: 'displayName required' });
  }
  
  try {
    const trip = await getTrip(accessCode);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    
    const profile = await createProfile({
      tripId: trip.id,
      displayName: b.displayName,
      role: b.role,
      ageGroup: b.ageGroup,
      birthDate: b.birthDate ? new Date(b.birthDate) : undefined,
      email: b.email,
      phone: b.phone,
      dietaryRestrictions: b.dietaryRestrictions,
      dietaryPreferences: b.dietaryPreferences,
      dietarySeverity: b.dietarySeverity,
      dietaryNotes: b.dietaryNotes,
      accessibility: b.accessibility,
      medical: b.medical,
      needs: b.needs,
      preferences: b.preferences,
      surprises: b.surprises
    });
    
    res.json({ profile });
  } catch (e: any) {
    console.error('Create profile error:', e);
    res.status(500).json({ error: 'Failed to create profile' });
  }
});

router.get('/trips/:accessCode/party/:profileId', async (req: Request, res: Response) => {
  const { profileId } = req.params;
  
  try {
    const profile = await getProfile(profileId);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    res.json({ profile });
  } catch (e: any) {
    console.error('Get profile error:', e);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

router.patch('/trips/:accessCode/party/:profileId', async (req: Request, res: Response) => {
  const { profileId } = req.params;
  const b = req.body || {};
  
  try {
    const updated = await updateProfile(profileId, {
      displayName: b.displayName,
      role: b.role,
      ageGroup: b.ageGroup,
      birthDate: b.birthDate ? new Date(b.birthDate) : undefined,
      dietaryRestrictions: b.dietaryRestrictions,
      dietaryPreferences: b.dietaryPreferences,
      dietarySeverity: b.dietarySeverity,
      dietaryNotes: b.dietaryNotes,
      accessibility: b.accessibility,
      medical: b.medical,
      needs: b.needs,
      preferences: b.preferences
    });
    
    res.json({ profile: updated });
  } catch (e: any) {
    console.error('Update profile error:', e);
    res.status(400).json({ error: e.message });
  }
});

router.delete('/trips/:accessCode/party/:profileId', async (req: Request, res: Response) => {
  const { profileId } = req.params;
  
  try {
    await deleteProfile(profileId);
    res.json({ success: true });
  } catch (e: any) {
    console.error('Delete profile error:', e);
    res.status(500).json({ error: 'Failed to delete profile' });
  }
});

router.get('/trips/:accessCode/needs', async (req: Request, res: Response) => {
  const { accessCode } = req.params;
  
  try {
    const trip = await getTrip(accessCode);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    
    const aggregated = await aggregateNeeds(trip.id);
    res.json(aggregated);
  } catch (e: any) {
    console.error('Get needs error:', e);
    res.status(500).json({ error: 'Failed to get needs' });
  }
});

router.get('/dietary-terms', async (req: Request, res: Response) => {
  try {
    const terms = await getDietaryTerms();
    res.json({ terms });
  } catch (e: any) {
    console.error('Get dietary terms error:', e);
    res.status(500).json({ error: 'Failed to get dietary terms' });
  }
});

export default router;
