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
// SERVICE RUNS MANAGEMENT
// =====================================================================

// GET /api/service-runs/runs - List all service runs
router.get('/runs', async (req: Request, res: Response) => {
  try {
    const pool = getPool(req);
    const { status, community } = req.query;
    
    let query = `
      SELECT 
        r.*,
        c.name as community_name,
        rt.name as run_type_name,
        b.name as bundle_name,
        (SELECT COUNT(*) FROM sr_service_slots s WHERE s.run_id = r.id) as slot_count,
        (SELECT COALESCE(SUM(s.estimated_cost), 0) FROM sr_service_slots s WHERE s.run_id = r.id) as total_estimated_revenue
      FROM sr_service_runs r
      LEFT JOIN sr_communities c ON c.id = r.community_id
      LEFT JOIN sr_run_types rt ON rt.id = r.run_type_id
      LEFT JOIN sr_bundles b ON b.id = r.bundle_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;
    
    if (status) {
      query += ` AND r.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (community) {
      query += ` AND c.id = $${paramIndex}`;
      params.push(community);
      paramIndex++;
    }
    
    query += ` ORDER BY r.target_start_date DESC, r.created_at DESC`;
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      runs: result.rows.map(row => ({
        id: row.id,
        title: row.title,
        slug: row.slug,
        description: row.description,
        communityId: row.community_id,
        communityName: row.community_name,
        runTypeName: row.run_type_name,
        bundleName: row.bundle_name,
        initiatorType: row.initiator_type,
        targetStartDate: row.target_start_date,
        targetEndDate: row.target_end_date,
        flexibleDates: row.flexible_dates,
        minSlots: row.min_slots,
        maxSlots: row.max_slots,
        currentSlots: parseInt(row.slot_count),
        status: row.status,
        biddingOpensAt: row.bidding_opens_at,
        biddingClosesAt: row.bidding_closes_at,
        estimatedMobilizationCost: row.estimated_mobilization_cost ? parseFloat(row.estimated_mobilization_cost) : null,
        totalEstimatedRevenue: parseFloat(row.total_estimated_revenue),
        allowResidentExclusions: row.allow_resident_exclusions,
        requirePhotos: row.require_photos,
        requireDeposit: row.require_deposit,
        depositAmount: row.deposit_amount ? parseFloat(row.deposit_amount) : null,
        cancellationPolicy: row.cancellation_policy,
        publishedAt: row.published_at,
        createdAt: row.created_at
      }))
    });
  } catch (err) {
    console.error('Failed to load service runs:', err);
    res.status(500).json({ success: false, error: 'Failed to load service runs' });
  }
});

// GET /api/service-runs/runs/:slug - Get run details with slots
router.get('/runs/:slug', async (req: Request, res: Response) => {
  try {
    const pool = getPool(req);
    const { slug } = req.params;
    
    const runResult = await pool.query(`
      SELECT 
        r.*,
        c.name as community_name, c.remote_multiplier,
        rt.name as run_type_name, rt.description as run_type_description,
        b.name as bundle_name, b.slug as bundle_slug
      FROM sr_service_runs r
      LEFT JOIN sr_communities c ON c.id = r.community_id
      LEFT JOIN sr_run_types rt ON rt.id = r.run_type_id
      LEFT JOIN sr_bundles b ON b.id = r.bundle_id
      WHERE r.slug = $1
    `, [slug]);
    
    if (runResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Run not found' });
    }
    
    const run = runResult.rows[0];
    
    const slotsResult = await pool.query(`
      SELECT * FROM sr_service_slots
      WHERE run_id = $1
      ORDER BY created_at
    `, [run.id]);
    
    const bidsResult = await pool.query(`
      SELECT * FROM sr_contractor_bids
      WHERE run_id = $1
      ORDER BY submitted_at DESC
    `, [run.id]);
    
    const slots = slotsResult.rows;
    const totalEstimatedRevenue = slots.reduce((sum, s) => sum + (parseFloat(s.estimated_cost) || 0), 0);
    const waterAccessCount = slots.filter(s => s.property_access_type === 'water_only').length;
    const roadAccessCount = slots.filter(s => s.property_access_type === 'road').length;
    
    res.json({
      success: true,
      run: {
        id: run.id,
        title: run.title,
        slug: run.slug,
        description: run.description,
        communityId: run.community_id,
        communityName: run.community_name,
        remoteMultiplier: run.remote_multiplier ? parseFloat(run.remote_multiplier) : 1,
        runTypeId: run.run_type_id,
        runTypeName: run.run_type_name,
        runTypeDescription: run.run_type_description,
        bundleId: run.bundle_id,
        bundleName: run.bundle_name,
        bundleSlug: run.bundle_slug,
        serviceAreaDescription: run.service_area_description,
        initiatorType: run.initiator_type,
        targetStartDate: run.target_start_date,
        targetEndDate: run.target_end_date,
        flexibleDates: run.flexible_dates,
        minSlots: run.min_slots,
        maxSlots: run.max_slots,
        currentSlots: slots.length,
        status: run.status,
        biddingOpensAt: run.bidding_opens_at,
        biddingClosesAt: run.bidding_closes_at,
        winningBidId: run.winning_bid_id,
        estimatedMobilizationCost: run.estimated_mobilization_cost ? parseFloat(run.estimated_mobilization_cost) : null,
        mobilizationCostPerSlot: run.mobilization_cost_per_slot ? parseFloat(run.mobilization_cost_per_slot) : null,
        allowResidentExclusions: run.allow_resident_exclusions,
        requirePhotos: run.require_photos,
        requireDeposit: run.require_deposit,
        depositAmount: run.deposit_amount ? parseFloat(run.deposit_amount) : null,
        cancellationPolicy: run.cancellation_policy,
        publishedAt: run.published_at,
        confirmedAt: run.confirmed_at,
        completedAt: run.completed_at,
        createdAt: run.created_at
      },
      slots: slots.map(s => ({
        id: s.id,
        customerName: s.customer_name,
        customerEmail: s.customer_email,
        customerPhone: s.customer_phone,
        propertyAddress: s.property_address,
        propertyLat: s.property_lat ? parseFloat(s.property_lat) : null,
        propertyLng: s.property_lng ? parseFloat(s.property_lng) : null,
        propertyAccessNotes: s.property_access_notes,
        propertyAccessType: s.property_access_type,
        servicesRequested: s.services_requested,
        specialRequirements: s.special_requirements,
        photos: s.photos,
        measurements: s.measurements,
        excludedContractors: s.excluded_contractors,
        preferredContractors: s.preferred_contractors,
        preferredDates: s.preferred_dates,
        blackoutDates: s.blackout_dates,
        requiresOwnerPresent: s.requires_owner_present,
        status: s.status,
        optOutReason: s.opt_out_reason,
        estimatedCost: s.estimated_cost ? parseFloat(s.estimated_cost) : null,
        finalCost: s.final_cost ? parseFloat(s.final_cost) : null,
        mobilizationShare: s.mobilization_share ? parseFloat(s.mobilization_share) : null,
        scheduledDate: s.scheduled_date,
        scheduledTimeStart: s.scheduled_time_start,
        scheduledTimeEnd: s.scheduled_time_end,
        completedAt: s.completed_at,
        customerRating: s.customer_rating,
        customerReview: s.customer_review,
        createdAt: s.created_at
      })),
      bids: bidsResult.rows.map(b => ({
        id: b.id,
        contractorName: b.contractor_name,
        contractorEmail: b.contractor_email,
        bidType: b.bid_type,
        mobilizationCost: parseFloat(b.mobilization_cost),
        perSlotCostLow: b.per_slot_cost_low ? parseFloat(b.per_slot_cost_low) : null,
        perSlotCostHigh: b.per_slot_cost_high ? parseFloat(b.per_slot_cost_high) : null,
        bundleTotalCost: b.bundle_total_cost ? parseFloat(b.bundle_total_cost) : null,
        crewSize: b.crew_size,
        crewNeedsAccommodation: b.crew_needs_accommodation,
        proposedStartDate: b.proposed_start_date,
        proposedEndDate: b.proposed_end_date,
        estimatedDaysOnSite: b.estimated_days_on_site,
        status: b.status,
        bidNotes: b.bid_notes,
        submittedAt: b.submitted_at
      })),
      stats: {
        totalEstimatedRevenue,
        waterAccessCount,
        roadAccessCount,
        pendingCount: slots.filter(s => s.status === 'pending').length,
        confirmedCount: slots.filter(s => s.status === 'confirmed').length,
        bidCount: bidsResult.rows.length
      }
    });
  } catch (err) {
    console.error('Failed to load run details:', err);
    res.status(500).json({ success: false, error: 'Failed to load run details' });
  }
});

// POST /api/service-runs/runs - Create new run
router.post('/runs', authenticateToken, async (req: Request, res: Response) => {
  try {
    const pool = getPool(req);
    const {
      title, description, runTypeId, bundleId, communityId,
      serviceAreaDescription, targetStartDate, targetEndDate,
      minSlots, maxSlots, biddingOpensAt, biddingClosesAt,
      estimatedMobilizationCost, requirePhotos, requireDeposit,
      depositAmount, cancellationPolicy
    } = req.body;
    
    const slug = title.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    
    const result = await pool.query(`
      INSERT INTO sr_service_runs (
        title, slug, description, run_type_id, bundle_id, community_id,
        service_area_description, target_start_date, target_end_date,
        min_slots, max_slots, bidding_opens_at, bidding_closes_at,
        estimated_mobilization_cost, require_photos, require_deposit,
        deposit_amount, cancellation_policy, status, published_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'collecting', NOW())
      RETURNING *
    `, [
      title, slug, description, runTypeId, bundleId, communityId,
      serviceAreaDescription, targetStartDate, targetEndDate,
      minSlots || 5, maxSlots || 25, biddingOpensAt, biddingClosesAt,
      estimatedMobilizationCost, requirePhotos !== false, requireDeposit || false,
      depositAmount, cancellationPolicy || 'Full refund if cancelled 7+ days before scheduled date'
    ]);
    
    res.json({
      success: true,
      run: result.rows[0]
    });
  } catch (err: any) {
    console.error('Failed to create run:', err);
    if (err.code === '23505') {
      res.status(400).json({ success: false, error: 'A run with that title already exists' });
    } else {
      res.status(500).json({ success: false, error: 'Failed to create run' });
    }
  }
});

// PATCH /api/service-runs/runs/:id/status - Update run status
router.patch('/runs/:id/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const pool = getPool(req);
    const { id } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['draft', 'collecting', 'bidding', 'bid_review', 'confirmed', 'scheduled', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }
    
    const result = await pool.query(`
      UPDATE sr_service_runs 
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [status, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Run not found' });
    }
    
    res.json({ success: true, run: result.rows[0] });
  } catch (err) {
    console.error('Failed to update run status:', err);
    res.status(500).json({ success: false, error: 'Failed to update status' });
  }
});

// POST /api/service-runs/runs/:id/slots - Add slot to run
router.post('/runs/:id/slots', async (req: Request, res: Response) => {
  try {
    const pool = getPool(req);
    const { id } = req.params;
    const {
      customerName, customerEmail, customerPhone,
      propertyAddress, propertyLat, propertyLng,
      propertyAccessNotes, propertyAccessType,
      servicesRequested, specialRequirements,
      requiresOwnerPresent, estimatedCost
    } = req.body;
    
    const runCheck = await pool.query(
      `SELECT id, status, current_slots, max_slots FROM sr_service_runs WHERE id = $1`,
      [id]
    );
    
    if (runCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Run not found' });
    }
    
    const run = runCheck.rows[0];
    if (run.status !== 'collecting') {
      return res.status(400).json({ success: false, error: 'Run is not accepting signups' });
    }
    
    if (run.current_slots >= run.max_slots) {
      return res.status(400).json({ success: false, error: 'Run is full' });
    }
    
    const result = await pool.query(`
      INSERT INTO sr_service_slots (
        run_id, customer_name, customer_email, customer_phone,
        property_address, property_lat, property_lng,
        property_access_notes, property_access_type,
        services_requested, special_requirements,
        requires_owner_present, estimated_cost, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending')
      RETURNING *
    `, [
      id, customerName, customerEmail, customerPhone,
      propertyAddress, propertyLat, propertyLng,
      propertyAccessNotes, propertyAccessType || 'road',
      JSON.stringify(servicesRequested || []), specialRequirements,
      requiresOwnerPresent || false, estimatedCost
    ]);
    
    await pool.query(`
      UPDATE sr_service_runs 
      SET current_slots = current_slots + 1, updated_at = NOW()
      WHERE id = $1
    `, [id]);
    
    res.json({
      success: true,
      slot: result.rows[0]
    });
  } catch (err) {
    console.error('Failed to add slot:', err);
    res.status(500).json({ success: false, error: 'Failed to add slot' });
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
