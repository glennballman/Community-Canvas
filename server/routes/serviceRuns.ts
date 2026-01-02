// =====================================================================
// SERVICE RUNS API ROUTES
// =====================================================================

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { authenticateToken } from './foundation';
import { calculateServicePrice, calculateBundlePrice, calculateMobilizationPerSlot } from '../lib/pricing';
import { 
  scoreServicePair, 
  buildCompatibilityGraph, 
  suggestBundles, 
  isServiceEligibleForWeek,
  getCurrentWeek,
  DEFAULT_COMPATIBILITY_WEIGHTS
} from '../lib/bundling';
import { 
  ServiceWithDetails, 
  Community, 
  BundleWithDetails,
  ServiceRunStatus
} from '../types/serviceRuns';

const router = Router();

// Get pool from app
function getPool(req: Request): Pool {
  return req.app.get('db');
}

// =====================================================================
// HELPER: Load service with all details
// =====================================================================

async function loadServiceWithDetails(pool: Pool, serviceId: string): Promise<ServiceWithDetails | null> {
  // Main service
  const serviceResult = await pool.query(`
    SELECT s.*, s.icon as service_icon, sc.name as category_name, sc.slug as category_slug, sc.icon as category_icon
    FROM sr_services s
    JOIN sr_service_categories sc ON sc.id = s.category_id
    WHERE s.id = $1
  `, [serviceId]);
  
  if (serviceResult.rows.length === 0) return null;
  
  const row = serviceResult.rows[0];
  
  // Seasonality
  const seasonalityResult = await pool.query(`
    SELECT ss.*, cr.name as climate_region_name
    FROM sr_service_seasonality ss
    JOIN sr_climate_regions cr ON cr.id = ss.climate_region_id
    WHERE ss.service_id = $1
  `, [serviceId]);
  
  // Pricing
  const pricingResult = await pool.query(`
    SELECT sp.*, pm.model as pricing_model
    FROM sr_service_pricing sp
    JOIN sr_pricing_models pm ON pm.id = sp.pricing_model_id
    WHERE sp.service_id = $1
  `, [serviceId]);
  
  // Certifications
  const certResult = await pool.query(`
    SELECT c.*, sc.is_required
    FROM sr_service_certifications sc
    JOIN sr_certifications c ON c.id = sc.certification_id
    WHERE sc.service_id = $1
  `, [serviceId]);
  
  // Access requirements
  const accessResult = await pool.query(`
    SELECT ar.*, sar.is_required
    FROM sr_service_access_requirements sar
    JOIN sr_access_requirements ar ON ar.id = sar.access_requirement_id
    WHERE sar.service_id = $1
  `, [serviceId]);
  
  // Mobilization class
  const mobResult = await pool.query(`
    SELECT mc.*
    FROM sr_service_mobilization sm
    JOIN sr_mobilization_classes mc ON mc.id = sm.mobilization_class_id
    WHERE sm.service_id = $1
  `, [serviceId]);
  
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    icon: row.service_icon || row.category_icon,
    typicalDurationMinHours: parseFloat(row.typical_duration_min_hours),
    typicalDurationMaxHours: parseFloat(row.typical_duration_max_hours),
    crewMin: row.crew_min,
    crewTypical: row.crew_typical,
    crewMax: row.crew_max,
    noise: row.noise,
    disruption: row.disruption,
    failureRiskIfDelayed: row.failure_risk_if_delayed,
    canBeEmergency: row.can_be_emergency,
    requiresOwnerPresent: row.requires_owner_present,
    canBeDoneVacant: row.can_be_done_vacant,
    weatherDependent: row.weather_dependent,
    defaultContext: row.default_context,
    revisitCycle: row.revisit_cycle,
    isActive: row.is_active,
    category: {
      id: row.category_id,
      parentId: null,
      name: row.category_name,
      slug: row.category_slug,
      description: '',
      icon: row.category_icon,
      sortOrder: 0,
      isActive: true
    },
    seasonality: seasonalityResult.rows.map(s => ({
      serviceId: s.service_id,
      climateRegionId: s.climate_region_id,
      climateRegionName: s.climate_region_name,
      earliestWeek: s.earliest_week,
      latestWeek: s.latest_week,
      hardStop: s.hard_stop,
      rainSensitive: s.rain_sensitive,
      snowSensitive: s.snow_sensitive,
      windSensitive: s.wind_sensitive,
      temperatureMinC: s.temperature_min_c,
      temperatureMaxC: s.temperature_max_c,
      notes: s.notes
    })),
    pricing: pricingResult.rows.length > 0 ? {
      serviceId: pricingResult.rows[0].service_id,
      pricingModelId: pricingResult.rows[0].pricing_model_id,
      pricingModel: pricingResult.rows[0].pricing_model,
      basePrice: parseFloat(pricingResult.rows[0].base_price),
      unitDescriptor: pricingResult.rows[0].unit_descriptor,
      remoteMultiplier: parseFloat(pricingResult.rows[0].remote_multiplier),
      accessDifficultyMultiplier: parseFloat(pricingResult.rows[0].access_difficulty_multiplier),
      seasonalMultiplier: parseFloat(pricingResult.rows[0].seasonal_multiplier),
      mobilizationSurcharge: parseFloat(pricingResult.rows[0].mobilization_surcharge),
      minimumCharge: parseFloat(pricingResult.rows[0].minimum_charge),
      notes: pricingResult.rows[0].notes
    } : null,
    certifications: certResult.rows.map(c => ({
      id: c.id,
      name: c.name,
      authority: c.authority,
      jurisdiction: c.jurisdiction,
      tradeCode: c.trade_code,
      description: c.description,
      isRequired: c.is_required
    })),
    accessRequirements: accessResult.rows.map(a => ({
      id: a.id,
      name: a.name,
      description: a.description,
      baseCostMultiplier: parseFloat(a.base_cost_multiplier)
    })),
    mobilizationClass: mobResult.rows.length > 0 ? {
      id: mobResult.rows[0].id,
      name: mobResult.rows[0].name,
      description: mobResult.rows[0].description,
      baseCost: parseFloat(mobResult.rows[0].base_cost)
    } : null
  };
}

// =====================================================================
// SERVICE CATEGORIES
// =====================================================================

// GET /api/service-runs/categories - List all categories
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const pool = getPool(req);
    
    const result = await pool.query(`
      SELECT sc.*, 
             COUNT(s.id) as service_count
      FROM sr_service_categories sc
      LEFT JOIN sr_services s ON s.category_id = sc.id AND s.is_active = true
      WHERE sc.is_active = true
      GROUP BY sc.id
      ORDER BY sc.sort_order
    `);
    
    res.json({
      success: true,
      categories: result.rows.map(row => ({
        id: row.id,
        parentId: row.parent_id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        icon: row.icon,
        sortOrder: row.sort_order,
        serviceCount: parseInt(row.service_count)
      }))
    });
  } catch (err) {
    console.error('Failed to load categories:', err);
    res.status(500).json({ success: false, error: 'Failed to load categories' });
  }
});

// =====================================================================
// SERVICES
// =====================================================================

// GET /api/service-runs/services - List services with filtering
router.get('/services', async (req: Request, res: Response) => {
  try {
    const pool = getPool(req);
    const { category, search, emergency, climateRegion, week } = req.query;
    
    let query = `
      SELECT s.*, 
             s.icon as service_icon,
             sc.name as category_name, 
             sc.slug as category_slug,
             sc.icon as category_icon
      FROM sr_services s
      JOIN sr_service_categories sc ON sc.id = s.category_id
      WHERE s.is_active = true
    `;
    const params: any[] = [];
    let paramIndex = 1;
    
    if (category) {
      query += ` AND sc.slug = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }
    
    if (search) {
      query += ` AND (s.name ILIKE $${paramIndex} OR s.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    if (emergency === 'true') {
      query += ` AND s.can_be_emergency = true`;
    }
    
    query += ` ORDER BY sc.sort_order, s.name`;
    
    const result = await pool.query(query, params);
    
    // If climate region and week specified, check eligibility
    let services = result.rows.map(row => ({
      id: row.id,
      categoryId: row.category_id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      icon: row.service_icon || row.category_icon,
      typicalDurationMinHours: parseFloat(row.typical_duration_min_hours),
      typicalDurationMaxHours: parseFloat(row.typical_duration_max_hours),
      crewMin: row.crew_min,
      crewTypical: row.crew_typical,
      crewMax: row.crew_max,
      canBeEmergency: row.can_be_emergency,
      weatherDependent: row.weather_dependent,
      revisitCycle: row.revisit_cycle,
      category: {
        name: row.category_name,
        slug: row.category_slug,
        icon: row.category_icon
      }
    }));
    
    res.json({
      success: true,
      services,
      total: services.length
    });
  } catch (err) {
    console.error('Failed to load services:', err);
    res.status(500).json({ success: false, error: 'Failed to load services' });
  }
});

// GET /api/service-runs/services/:slug - Get service details
router.get('/services/:slug', async (req: Request, res: Response) => {
  try {
    const pool = getPool(req);
    const { slug } = req.params;
    
    // Get service ID first
    const idResult = await pool.query(
      'SELECT id FROM sr_services WHERE slug = $1',
      [slug]
    );
    
    if (idResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Service not found' });
    }
    
    const service = await loadServiceWithDetails(pool, idResult.rows[0].id);
    
    res.json({
      success: true,
      service
    });
  } catch (err) {
    console.error('Failed to load service:', err);
    res.status(500).json({ success: false, error: 'Failed to load service' });
  }
});

// =====================================================================
// REFERENCE DATA
// =====================================================================

// GET /api/service-runs/climate-regions
router.get('/climate-regions', async (req: Request, res: Response) => {
  try {
    const pool = getPool(req);
    const result = await pool.query('SELECT * FROM sr_climate_regions ORDER BY name');
    
    res.json({
      success: true,
      climateRegions: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        koppenCodes: row.koppen_codes,
        description: row.description,
        typicalFreezeWeek: row.typical_freeze_week,
        typicalThawWeek: row.typical_thaw_week
      }))
    });
  } catch (err) {
    console.error('Failed to load climate regions:', err);
    res.status(500).json({ success: false, error: 'Failed to load climate regions' });
  }
});

// GET /api/service-runs/access-requirements
router.get('/access-requirements', async (req: Request, res: Response) => {
  try {
    const pool = getPool(req);
    const result = await pool.query('SELECT * FROM sr_access_requirements ORDER BY sort_order');
    
    res.json({
      success: true,
      accessRequirements: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        baseCostMultiplier: parseFloat(row.base_cost_multiplier)
      }))
    });
  } catch (err) {
    console.error('Failed to load access requirements:', err);
    res.status(500).json({ success: false, error: 'Failed to load access requirements' });
  }
});

// GET /api/service-runs/mobilization-classes
router.get('/mobilization-classes', async (req: Request, res: Response) => {
  try {
    const pool = getPool(req);
    const result = await pool.query('SELECT * FROM sr_mobilization_classes ORDER BY sort_order');
    
    res.json({
      success: true,
      mobilizationClasses: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        baseCost: parseFloat(row.base_cost)
      }))
    });
  } catch (err) {
    console.error('Failed to load mobilization classes:', err);
    res.status(500).json({ success: false, error: 'Failed to load mobilization classes' });
  }
});

// GET /api/service-runs/certifications
router.get('/certifications', async (req: Request, res: Response) => {
  try {
    const pool = getPool(req);
    const result = await pool.query('SELECT * FROM sr_certifications ORDER BY name');
    
    res.json({
      success: true,
      certifications: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        authority: row.authority,
        jurisdiction: row.jurisdiction,
        tradeCode: row.trade_code,
        description: row.description
      }))
    });
  } catch (err) {
    console.error('Failed to load certifications:', err);
    res.status(500).json({ success: false, error: 'Failed to load certifications' });
  }
});

// =====================================================================
// COMMUNITIES
// =====================================================================

// GET /api/service-runs/communities - List communities
router.get('/communities', async (req: Request, res: Response) => {
  try {
    const pool = getPool(req);
    
    const result = await pool.query(`
      SELECT c.*, cr.name as climate_region_name
      FROM sr_communities c
      JOIN sr_climate_regions cr ON cr.id = c.climate_region_id
      ORDER BY c.name
    `);
    
    res.json({
      success: true,
      communities: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        region: row.region,
        country: row.country,
        latitude: row.latitude ? parseFloat(row.latitude) : null,
        longitude: row.longitude ? parseFloat(row.longitude) : null,
        climateRegionId: row.climate_region_id,
        climateRegionName: row.climate_region_name,
        remoteMultiplier: parseFloat(row.remote_multiplier),
        notes: row.notes
      }))
    });
  } catch (err) {
    console.error('Failed to load communities:', err);
    res.status(500).json({ success: false, error: 'Failed to load communities' });
  }
});

// POST /api/service-runs/communities - Create community
router.post('/communities', authenticateToken, async (req: Request, res: Response) => {
  try {
    const pool = getPool(req);
    const { 
      name, region, country, latitude, longitude, 
      climateRegionId, remoteMultiplier, notes 
    } = req.body;
    
    const result = await pool.query(`
      INSERT INTO sr_communities 
        (name, region, country, latitude, longitude, climate_region_id, remote_multiplier, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [name, region || 'BC', country || 'Canada', latitude, longitude, climateRegionId, remoteMultiplier || 1.0, notes || '']);
    
    res.json({
      success: true,
      community: result.rows[0]
    });
  } catch (err) {
    console.error('Failed to create community:', err);
    res.status(500).json({ success: false, error: 'Failed to create community' });
  }
});

// =====================================================================
// BUNDLES
// =====================================================================

// GET /api/service-runs/bundles - List bundles
router.get('/bundles', async (req: Request, res: Response) => {
  try {
    const pool = getPool(req);
    const { climateRegion, week, community } = req.query;
    
    let query = `
      SELECT b.*, 
             bp.base_price, bp.discount_factor, bp.mobilization_surcharge, bp.remote_multiplier,
             (SELECT COUNT(*) FROM sr_bundle_items bi WHERE bi.bundle_id = b.id) as item_count
      FROM sr_bundles b
      LEFT JOIN sr_bundle_pricing bp ON bp.bundle_id = b.id
      WHERE b.is_active = true
    `;
    
    // TODO: Add seasonality filtering if climateRegion and week provided
    
    query += ' ORDER BY b.name';
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      bundles: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        context: row.context,
        isSubscription: row.is_subscription,
        billingPeriod: row.billing_period,
        itemCount: parseInt(row.item_count),
        pricing: row.base_price ? {
          basePrice: parseFloat(row.base_price),
          discountFactor: parseFloat(row.discount_factor),
          mobilizationSurcharge: parseFloat(row.mobilization_surcharge),
          remoteMultiplier: parseFloat(row.remote_multiplier)
        } : null
      }))
    });
  } catch (err) {
    console.error('Failed to load bundles:', err);
    res.status(500).json({ success: false, error: 'Failed to load bundles' });
  }
});

// GET /api/service-runs/bundles/:slug - Get bundle details
router.get('/bundles/:slug', async (req: Request, res: Response) => {
  try {
    const pool = getPool(req);
    const { slug } = req.params;
    
    // Get bundle
    const bundleResult = await pool.query(`
      SELECT b.*, bp.base_price, bp.discount_factor, bp.mobilization_surcharge, bp.remote_multiplier, bp.notes as pricing_notes
      FROM sr_bundles b
      LEFT JOIN sr_bundle_pricing bp ON bp.bundle_id = b.id
      WHERE b.slug = $1
    `, [slug]);
    
    if (bundleResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Bundle not found' });
    }
    
    const bundle = bundleResult.rows[0];
    
    // Get bundle items with services
    const itemsResult = await pool.query(`
      SELECT bi.*, s.name as service_name, s.slug as service_slug, s.description as service_description
      FROM sr_bundle_items bi
      JOIN sr_services s ON s.id = bi.service_id
      WHERE bi.bundle_id = $1
      ORDER BY bi.sort_order
    `, [bundle.id]);
    
    // Get bundle seasonality
    const seasonalityResult = await pool.query(`
      SELECT bs.*, cr.name as climate_region_name
      FROM sr_bundle_seasonality bs
      JOIN sr_climate_regions cr ON cr.id = bs.climate_region_id
      WHERE bs.bundle_id = $1
    `, [bundle.id]);
    
    res.json({
      success: true,
      bundle: {
        id: bundle.id,
        name: bundle.name,
        slug: bundle.slug,
        description: bundle.description,
        context: bundle.context,
        isSubscription: bundle.is_subscription,
        billingPeriod: bundle.billing_period,
        items: itemsResult.rows.map(row => ({
          serviceId: row.service_id,
          serviceName: row.service_name,
          serviceSlug: row.service_slug,
          serviceDescription: row.service_description,
          quantity: parseFloat(row.quantity),
          sortOrder: row.sort_order
        })),
        pricing: bundle.base_price ? {
          basePrice: parseFloat(bundle.base_price),
          discountFactor: parseFloat(bundle.discount_factor),
          mobilizationSurcharge: parseFloat(bundle.mobilization_surcharge),
          remoteMultiplier: parseFloat(bundle.remote_multiplier),
          notes: bundle.pricing_notes
        } : null,
        seasonality: seasonalityResult.rows.map(row => ({
          climateRegionId: row.climate_region_id,
          climateRegionName: row.climate_region_name,
          earliestWeek: row.earliest_week,
          latestWeek: row.latest_week,
          hardStop: row.hard_stop,
          notes: row.notes
        }))
      }
    });
  } catch (err) {
    console.error('Failed to load bundle:', err);
    res.status(500).json({ success: false, error: 'Failed to load bundle' });
  }
});

// =====================================================================
// RUN TYPES (Seasonal run templates)
// =====================================================================

// GET /api/service-runs/run-types - List run types
router.get('/run-types', async (req: Request, res: Response) => {
  try {
    const pool = getPool(req);
    const { climateRegion, week } = req.query;
    
    let query = `
      SELECT rt.*, cr.name as climate_region_name,
             (SELECT COUNT(*) FROM sr_run_type_services rts WHERE rts.run_type_id = rt.id) as service_count
      FROM sr_run_types rt
      JOIN sr_climate_regions cr ON cr.id = rt.climate_region_id
    `;
    const params: any[] = [];
    
    if (climateRegion) {
      query += ' WHERE cr.name = $1';
      params.push(climateRegion);
    }
    
    query += ' ORDER BY rt.priority_weight DESC, rt.name';
    
    const result = await pool.query(query, params);
    
    // Filter by week eligibility if specified
    let runTypes = result.rows.map(row => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      climateRegionId: row.climate_region_id,
      climateRegionName: row.climate_region_name,
      earliestWeek: row.earliest_week,
      latestWeek: row.latest_week,
      hardStop: row.hard_stop,
      isEmergency: row.is_emergency,
      priorityWeight: row.priority_weight,
      serviceCount: parseInt(row.service_count)
    }));
    
    if (week) {
      const weekNum = parseInt(week as string);
      runTypes = runTypes.filter(rt => {
        if (rt.earliestWeek <= rt.latestWeek) {
          return weekNum >= rt.earliestWeek && weekNum <= rt.latestWeek;
        } else {
          // Wrap around year
          return weekNum >= rt.earliestWeek || weekNum <= rt.latestWeek;
        }
      });
    }
    
    res.json({
      success: true,
      runTypes,
      currentWeek: getCurrentWeek()
    });
  } catch (err) {
    console.error('Failed to load run types:', err);
    res.status(500).json({ success: false, error: 'Failed to load run types' });
  }
});

// =====================================================================
// BUNDLING SUGGESTIONS
// =====================================================================

// POST /api/service-runs/suggest-bundles - Get bundle suggestions for selected services
router.post('/suggest-bundles', async (req: Request, res: Response) => {
  try {
    const pool = getPool(req);
    const { serviceSlugs, climateRegionId, week } = req.body;
    
    if (!serviceSlugs || serviceSlugs.length === 0) {
      return res.status(400).json({ success: false, error: 'serviceSlugs required' });
    }
    
    // Load all specified services with details
    const services: ServiceWithDetails[] = [];
    for (const slug of serviceSlugs) {
      const idResult = await pool.query('SELECT id FROM sr_services WHERE slug = $1', [slug]);
      if (idResult.rows.length > 0) {
        const service = await loadServiceWithDetails(pool, idResult.rows[0].id);
        if (service) services.push(service);
      }
    }
    
    if (services.length < 2) {
      return res.json({
        success: true,
        suggestions: [],
        message: 'Need at least 2 services for bundle suggestions'
      });
    }
    
    // Build compatibility graph
    const edges = buildCompatibilityGraph(services, DEFAULT_COMPATIBILITY_WEIGHTS, 40);
    
    // Get suggested bundles
    const suggestions = suggestBundles(services, edges, 8, 2);
    
    // Check seasonality if provided
    let eligibilityNotes: string[] = [];
    if (climateRegionId && week) {
      for (const service of services) {
        const eligibility = isServiceEligibleForWeek(service, climateRegionId, parseInt(week));
        if (!eligibility.eligible) {
          eligibilityNotes.push(`${service.name}: ${eligibility.reason}`);
        }
      }
    }
    
    res.json({
      success: true,
      suggestions,
      compatibilityEdges: edges.slice(0, 20), // Return top 20 edges
      eligibilityNotes,
      currentWeek: getCurrentWeek()
    });
  } catch (err) {
    console.error('Failed to suggest bundles:', err);
    res.status(500).json({ success: false, error: 'Failed to suggest bundles' });
  }
});

// =====================================================================
// STATS
// =====================================================================

// GET /api/service-runs/stats - Get overall stats
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const pool = getPool(req);
    
    const [categories, services, bundles, communities, climateRegions] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM sr_service_categories WHERE is_active = true'),
      pool.query('SELECT COUNT(*) FROM sr_services WHERE is_active = true'),
      pool.query('SELECT COUNT(*) FROM sr_bundles WHERE is_active = true'),
      pool.query('SELECT COUNT(*) FROM sr_communities'),
      pool.query('SELECT COUNT(*) FROM sr_climate_regions')
    ]);
    
    res.json({
      success: true,
      stats: {
        categories: parseInt(categories.rows[0].count),
        services: parseInt(services.rows[0].count),
        bundles: parseInt(bundles.rows[0].count),
        communities: parseInt(communities.rows[0].count),
        climateRegions: parseInt(climateRegions.rows[0].count),
        currentWeek: getCurrentWeek()
      }
    });
  } catch (err) {
    console.error('Failed to load stats:', err);
    res.status(500).json({ success: false, error: 'Failed to load stats' });
  }
});

export default router;
