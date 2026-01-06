import express, { Request, Response } from 'express';
import { serviceQuery } from '../db/tenantDb';

const router = express.Router();

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
        t.phone,
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
        n.phone,
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

export default router;
