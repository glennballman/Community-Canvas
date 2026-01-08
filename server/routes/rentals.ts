import { Router, Request, Response } from 'express';
import { serviceQuery } from '../db/tenantDb';
import { requireAuth } from '../middleware/guards';
import { z } from 'zod';
import { checkMaintenanceConflict } from './schedule';

const router = Router();

/**
 * P0-C: Rental Routes - Assets, availability, and bookings
 * 
 * Security model:
 * - /browse, /quote: Public reads, use serviceQuery (global inventory)
 * - Authenticated endpoints: Use tenantQuery/tenantTransaction for user-scoped data
 * - Bookings: User can only see/modify their own bookings
 */

interface RentalCategory {
  id: string;
  name: string;
  slug: string;
  icon: string;
  itemCount: number;
}

interface RentalItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  categorySlug: string;
  categoryIcon: string;
  communityId: string | null;
  communityName: string | null;
  locationName: string;
  pricingModel: string;
  rateHourly: number | null;
  rateHalfDay: number | null;
  rateDaily: number | null;
  rateWeekly: number | null;
  damageDeposit: number;
  capacity: number;
  brand: string | null;
  model: string | null;
  includedItems: string[];
  photos: string[];
  requiredWaiverSlug: string | null;
  requiredDocumentType: string | null;
  minimumAge: number;
  isAvailable: boolean;
  ownerName: string;
  bookingMode: 'check_in_out' | 'arrive_depart' | 'pickup_return';
  defaultDurationPreset: string | null;
  defaultStartTimeLocal: string;
  defaultEndTimeLocal: string;
  turnoverBufferMinutes: number;
}

const browseQuerySchema = z.object({
  category: z.string().optional(),
  community: z.string().uuid().optional(),
  search: z.string().max(100).optional()
});

const quoteBodySchema = z.object({
  startTs: z.string(),
  endTs: z.string()
});

const uuidSchema = z.string().uuid();

// GET /api/rentals/browse - Browse rental items (PUBLIC)
// SERVICE MODE: Rental inventory is public inventory
router.get('/browse', async (req: Request, res: Response) => {
  try {
    const parsed = browseQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid query parameters' });
    }
    
    const { category, community, search } = parsed.data;
    
    const categoriesResult = await serviceQuery(`
      SELECT 
        rc.id,
        rc.name,
        rc.slug,
        rc.icon,
        COUNT(ri.id) as item_count
      FROM cc_rental_categories rc
      LEFT JOIN cc_rental_items ri ON ri.category_id = rc.id AND ri.status = 'active'
      GROUP BY rc.id, rc.name, rc.slug, rc.icon, rc.sort_order
      ORDER BY rc.sort_order
    `);
    
    let itemsQuery = `
      SELECT 
        ri.id,
        ri.name,
        ri.slug,
        ri.description,
        rc.name as category,
        rc.slug as category_slug,
        rc.icon as category_icon,
        ri.home_community_id as community_id,
        c.name as community_name,
        ri.location_name,
        ri.pricing_model,
        ri.rate_hourly,
        ri.rate_half_day,
        ri.rate_daily,
        ri.rate_weekly,
        ri.damage_deposit,
        ri.capacity,
        ri.brand,
        ri.model,
        ri.included_items,
        ri.photos,
        rc.required_waiver_slug,
        rc.required_document_type,
        rc.minimum_age,
        ri.is_available,
        ri.owner_name,
        ri.booking_mode,
        ri.default_duration_preset,
        ri.default_start_time_local,
        ri.default_end_time_local,
        ri.turnover_buffer_minutes
      FROM cc_rental_items ri
      JOIN cc_rental_categories rc ON rc.id = ri.category_id
      LEFT JOIN cc_sr_communities c ON c.id = ri.home_community_id
      WHERE ri.status = 'active'
    `;
    
    const params: any[] = [];
    let paramIndex = 1;
    
    if (category && category !== 'all') {
      itemsQuery += ` AND rc.slug = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }
    if (community) {
      itemsQuery += ` AND c.id = $${paramIndex}`;
      params.push(community);
      paramIndex++;
    }
    if (search) {
      itemsQuery += ` AND (ri.name ILIKE $${paramIndex} OR ri.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    itemsQuery += ` ORDER BY rc.sort_order, ri.name`;
    
    const itemsResult = await serviceQuery(itemsQuery, params);
    
    const categories: RentalCategory[] = categoriesResult.rows.map(row => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      icon: row.icon,
      itemCount: parseInt(row.item_count) || 0
    }));
    
    const items: RentalItem[] = itemsResult.rows.map(row => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description || '',
      category: row.category,
      categorySlug: row.category_slug,
      categoryIcon: row.category_icon,
      communityId: row.community_id,
      communityName: row.community_name,
      locationName: row.location_name || '',
      pricingModel: row.pricing_model,
      rateHourly: row.rate_hourly ? parseFloat(row.rate_hourly) : null,
      rateHalfDay: row.rate_half_day ? parseFloat(row.rate_half_day) : null,
      rateDaily: row.rate_daily ? parseFloat(row.rate_daily) : null,
      rateWeekly: row.rate_weekly ? parseFloat(row.rate_weekly) : null,
      damageDeposit: parseFloat(row.damage_deposit) || 0,
      capacity: row.capacity || 1,
      brand: row.brand || null,
      model: row.model || null,
      includedItems: row.included_items || [],
      photos: row.photos || [],
      requiredWaiverSlug: row.required_waiver_slug,
      requiredDocumentType: row.required_document_type,
      minimumAge: row.minimum_age || 18,
      isAvailable: row.is_available,
      ownerName: row.owner_name || 'Owner',
      bookingMode: row.booking_mode || 'pickup_return',
      defaultDurationPreset: row.default_duration_preset || null,
      defaultStartTimeLocal: row.default_start_time_local || '09:00',
      defaultEndTimeLocal: row.default_end_time_local || '17:00',
      turnoverBufferMinutes: row.turnover_buffer_minutes || 0
    }));
    
    res.json({ success: true, categories, items });
  } catch (error) {
    console.error('Error browsing rentals:', error);
    res.status(500).json({ success: false, error: 'Failed to load rentals' });
  }
});

// GET /api/rentals/:id/eligibility - Check rental eligibility (SELF)
router.get('/:id/eligibility', requireAuth, async (req: Request, res: Response) => {
  try {
    const idParsed = uuidSchema.safeParse(req.params.id);
    if (!idParsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid item ID' });
    }
    
    const itemId = idParsed.data;
    const tenantReq = req as any;
    const individualId = tenantReq.ctx?.individual_id;
    
    if (!individualId) {
      return res.status(401).json({ success: false, error: 'Individual profile required' });
    }
    
    // SERVICE MODE: Item details are public inventory data
    const itemResult = await serviceQuery(`
      SELECT 
        ri.id,
        rc.required_waiver_slug,
        rc.required_document_type,
        rc.minimum_age
      FROM cc_rental_items ri
      JOIN cc_rental_categories rc ON rc.id = ri.category_id
      WHERE ri.id = $1
    `, [itemId]);
    
    if (itemResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    
    const item = itemResult.rows[0];
    
    // SERVICE MODE: Platform eligibility function
    const eligibilityResult = await serviceQuery(
      `SELECT can_checkout_unified($1, 'equipment', $2) as eligibility`,
      [individualId, itemId]
    );
    
    const elig = eligibilityResult.rows[0].eligibility;
    
    res.json({
      success: true,
      eligibility: {
        ready: elig.ready,
        hasWaiver: elig.has_waiver,
        hasDocument: elig.has_document,
        hasPayment: elig.has_payment,
        blockers: elig.blockers || [],
        warnings: elig.warnings || [],
        requirements: elig.requirements || { waiver: 'at_checkout', document: 'at_checkout', payment: 'at_booking' },
        requiredWaiver: elig.required_waiver,
        requiredDocument: elig.required_document
      }
    });
  } catch (error) {
    console.error('Error checking eligibility:', error);
    res.status(500).json({ success: false, error: 'Failed to check eligibility' });
  }
});

// POST /api/rentals/:id/quote - Get price quote (PUBLIC)
// SERVICE MODE: Pricing calculation is public
router.post('/:id/quote', async (req: Request, res: Response) => {
  try {
    const idParsed = uuidSchema.safeParse(req.params.id);
    if (!idParsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid item ID' });
    }
    
    const bodyParsed = quoteBodySchema.safeParse(req.body);
    if (!bodyParsed.success) {
      return res.status(400).json({ success: false, error: 'Start and end times required' });
    }
    
    const itemId = idParsed.data;
    const { startTs, endTs } = bodyParsed.data;
    
    const itemResult = await serviceQuery(`
      SELECT 
        pricing_model,
        rate_hourly,
        rate_half_day,
        rate_daily,
        rate_weekly,
        damage_deposit
      FROM cc_rental_items
      WHERE id = $1
    `, [itemId]);
    
    if (itemResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    
    const item = itemResult.rows[0];
    const start = new Date(startTs);
    const end = new Date(endTs);
    const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    const durationDays = Math.ceil(durationHours / 24);
    
    const rateHourly = item.rate_hourly ? parseFloat(item.rate_hourly) : null;
    const rateHalfDay = item.rate_half_day ? parseFloat(item.rate_half_day) : null;
    const rateDaily = item.rate_daily ? parseFloat(item.rate_daily) : null;
    const rateWeekly = item.rate_weekly ? parseFloat(item.rate_weekly) : null;
    const damageDeposit = parseFloat(item.damage_deposit) || 0;
    
    let subtotal = 0;
    let pricingModel = 'daily';
    let rateApplied = 0;
    
    if (durationHours <= 4 && rateHourly) {
      subtotal = rateHourly * durationHours;
      pricingModel = 'hourly';
      rateApplied = rateHourly;
    } else if (durationHours <= 5 && rateHalfDay) {
      subtotal = rateHalfDay;
      pricingModel = 'half_day';
      rateApplied = rateHalfDay;
    } else if (durationDays <= 6 && rateDaily) {
      subtotal = rateDaily * durationDays;
      pricingModel = 'daily';
      rateApplied = rateDaily;
    } else if (rateWeekly) {
      subtotal = rateWeekly * Math.ceil(durationDays / 7);
      pricingModel = 'weekly';
      rateApplied = rateWeekly;
    } else if (rateDaily) {
      subtotal = rateDaily * durationDays;
      pricingModel = 'daily';
      rateApplied = rateDaily;
    } else if (rateHourly) {
      subtotal = rateHourly * durationHours;
      pricingModel = 'hourly';
      rateApplied = rateHourly;
    }
    
    const tax = subtotal * 0.12;
    const total = subtotal + tax + damageDeposit;
    
    res.json({
      success: true,
      quote: {
        duration_hours: Math.round(durationHours * 100) / 100,
        duration_days: durationDays,
        pricing_model: pricingModel,
        rate_applied: rateApplied,
        subtotal: Math.round(subtotal * 100) / 100,
        damage_deposit: damageDeposit,
        tax: Math.round(tax * 100) / 100,
        total: Math.round(total * 100) / 100
      }
    });
  } catch (error) {
    console.error('Error calculating quote:', error);
    res.status(500).json({ success: false, error: 'Failed to calculate quote' });
  }
});

// POST /api/rentals/:id/book - Create booking (SELF)
router.post('/:id/book', requireAuth, async (req: Request, res: Response) => {
  try {
    const idParsed = uuidSchema.safeParse(req.params.id);
    if (!idParsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid item ID' });
    }
    
    const bodyParsed = quoteBodySchema.safeParse(req.body);
    if (!bodyParsed.success) {
      return res.status(400).json({ success: false, error: 'Start and end times required' });
    }
    
    const itemId = idParsed.data;
    const { startTs, endTs } = bodyParsed.data;
    const tenantReq = req as any;
    const individualId = tenantReq.ctx?.individual_id;
    
    if (!individualId) {
      return res.status(401).json({ success: false, error: 'Individual profile required to book' });
    }
    
    // Use tenantTransaction for booking creation - user can only book for themselves
    const result = await req.tenantTransaction(async (client) => {
      // Check item exists (service mode for inventory data)
      const itemCheck = await client.query(
        `SELECT id, turnover_buffer_minutes FROM cc_rental_items WHERE id = $1`,
        [itemId]
      );
      
      if (itemCheck.rows.length === 0) {
        return { error: 'Item not found', status: 404 };
      }
      
      const bufferMinutes = itemCheck.rows[0].turnover_buffer_minutes ?? 0;
      
      // Check for maintenance blocks on unified_asset (if linked)
      const assetLookup = await client.query(
        `SELECT id FROM cc_assets WHERE source_table = 'cc_rental_items' AND source_id = $1`,
        [itemId]
      );
      
      if (assetLookup.rows.length > 0) {
        const assetId = assetLookup.rows[0].id;
        const maintenance = await checkMaintenanceConflict(
          assetId,
          new Date(startTs),
          new Date(endTs)
        );
        if (maintenance.hasConflict) {
          return { 
            error: 'This item is under maintenance during the requested time', 
            status: 409,
            code: 'MAINTENANCE_CONFLICT'
          };
        }
        
        // Check blocking constraints on the asset (asset-level and capability-level)
        const constraintCheck = await client.query(`
          SELECT ac.constraint_type, ac.details, acu.name as capability_name
          FROM cc_asset_constraints ac
          LEFT JOIN cc_asset_capability_units acu ON ac.capability_unit_id = acu.id
          WHERE ac.asset_id = $1
            AND ac.severity = 'blocking'
            AND ac.active = true
            AND (ac.starts_at IS NULL OR ac.starts_at <= $3::timestamptz)
            AND (ac.ends_at IS NULL OR ac.ends_at >= $2::timestamptz)
          LIMIT 1
        `, [assetId, startTs, endTs]);
        
        if (constraintCheck.rows.length > 0) {
          const constraint = constraintCheck.rows[0];
          const capInfo = constraint.capability_name ? ` (${constraint.capability_name})` : '';
          return {
            error: `Not bookable: ${constraint.constraint_type.replace(/_/g, ' ')}${capInfo}${constraint.details ? ` - ${constraint.details}` : ''}`,
            status: 409,
            code: 'BLOCKING_CONSTRAINT'
          };
        }
        
        // Check if any capability units are inoperable (blocking condition)
        const capabilityCheck = await client.query(`
          SELECT name, status
          FROM cc_asset_capability_units
          WHERE asset_id = $1
            AND status = 'inoperable'
          LIMIT 1
        `, [assetId]);
        
        if (capabilityCheck.rows.length > 0) {
          const cap = capabilityCheck.rows[0];
          return {
            error: `Not bookable: ${cap.name} is ${cap.status}`,
            status: 409,
            code: 'CAPABILITY_INOPERABLE'
          };
        }
      }
      
      // Check conflicts
      const conflictResult = await client.query(`
        SELECT COUNT(*) as conflicts
        FROM cc_rental_bookings
        WHERE rental_item_id = $1
        AND status NOT IN ('cancelled', 'completed')
        AND (
          (starts_at < $2::timestamptz + ($4 || ' minutes')::interval)
          AND
          (ends_at + ($4 || ' minutes')::interval > $3::timestamptz)
        )
      `, [itemId, endTs, startTs, bufferMinutes.toString()]);
      
      const conflicts = parseInt(conflictResult.rows[0].conflicts);
      if (conflicts > 0) {
        return { error: 'Time slot not available', status: 409 };
      }
      
      const start = new Date(startTs);
      const end = new Date(endTs);
      const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      const durationDays = Math.ceil(durationHours / 24);
      
      const priceResult = await client.query(
        `SELECT rate_hourly, rate_half_day, rate_daily, rate_weekly, damage_deposit FROM cc_rental_items WHERE id = $1`,
        [itemId]
      );
      const priceRow = priceResult.rows[0];
      const rateHourly = priceRow.rate_hourly ? parseFloat(priceRow.rate_hourly) : null;
      const rateHalfDay = priceRow.rate_half_day ? parseFloat(priceRow.rate_half_day) : null;
      const rateDaily = priceRow.rate_daily ? parseFloat(priceRow.rate_daily) : null;
      const rateWeekly = priceRow.rate_weekly ? parseFloat(priceRow.rate_weekly) : null;
      const damageDeposit = parseFloat(priceRow.damage_deposit) || 0;
      
      let subtotal = 0;
      if (durationHours <= 4 && rateHourly) {
        subtotal = rateHourly * durationHours;
      } else if (durationHours <= 5 && rateHalfDay) {
        subtotal = rateHalfDay;
      } else if (durationDays <= 6 && rateDaily) {
        subtotal = rateDaily * durationDays;
      } else if (rateWeekly) {
        subtotal = rateWeekly * Math.ceil(durationDays / 7);
      } else if (rateDaily) {
        subtotal = rateDaily * durationDays;
      } else if (rateHourly) {
        subtotal = rateHourly * durationHours;
      }
      
      const tax = subtotal * 0.12;
      const total = subtotal + tax + damageDeposit;
      
      const bookingResult = await client.query(`
        INSERT INTO cc_rental_bookings (
          rental_item_id,
          renter_individual_id,
          starts_at,
          ends_at,
          subtotal,
          tax,
          damage_deposit_held,
          total,
          status
        ) VALUES ($1, $2, $3::timestamptz, $4::timestamptz, $5, $6, $7, $8, 'confirmed')
        RETURNING id
      `, [itemId, individualId, startTs, endTs, subtotal, tax, damageDeposit, total]);
      
      const bookingId = bookingResult.rows[0].id;
      
      // E5: Auto-create turnover buffer event if turnover_buffer_minutes > 0
      const itemMeta = await client.query(
        `SELECT turnover_buffer_minutes FROM cc_rental_items WHERE id = $1`,
        [itemId]
      );
      const turnoverMinutes = itemMeta.rows[0]?.turnover_buffer_minutes || 0;
      
      if (turnoverMinutes > 0 && assetLookup.rows.length > 0) {
        const bufferStart = new Date(endTs);
        const bufferEnd = new Date(bufferStart.getTime() + turnoverMinutes * 60 * 1000);
        
        await client.query(`
          INSERT INTO cc_resource_schedule_events 
            (resource_id, event_type, starts_at, ends_at, title, notes, related_entity_type, related_entity_id)
          VALUES ($1, 'buffer', $2, $3, 'Turnover', 'Auto-generated cleanup buffer', 'booking', $4)
        `, [assetLookup.rows[0].id, bufferStart, bufferEnd, bookingId]);
      }
      
      return { bookingId, total };
    });
    
    if (result.error) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    
    res.json({
      success: true,
      booking: {
        id: result.bookingId,
        total: result.total
      }
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ success: false, error: 'Failed to create booking' });
  }
});

// GET /api/rentals/my-bookings - Get user's bookings (SELF)
router.get('/my-bookings', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantReq = req as any;
    const individualId = tenantReq.ctx?.individual_id;
    
    if (!individualId) {
      return res.status(401).json({ success: false, error: 'Individual profile required' });
    }
    
    // Use tenantQuery - user can only see their own bookings
    const result = await req.tenantQuery(`
      SELECT 
        b.id,
        b.starts_at,
        b.ends_at,
        b.total,
        b.status,
        ri.name as item_name,
        ri.location_name,
        rc.name as category,
        rc.icon as category_icon
      FROM cc_rental_bookings b
      JOIN cc_rental_items ri ON ri.id = b.rental_item_id
      JOIN cc_rental_categories rc ON rc.id = ri.category_id
      WHERE b.renter_individual_id = $1
      ORDER BY b.starts_at DESC
    `, [individualId]);
    
    res.json({
      success: true,
      bookings: result.rows.map((row: any) => ({
        id: row.id,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        priceTotal: parseFloat(row.total),
        status: row.status,
        itemName: row.item_name,
        locationName: row.location_name,
        category: row.category,
        categoryIcon: row.category_icon
      }))
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch bookings' });
  }
});

// GET /api/rentals/bookings - Get user's detailed bookings (SELF)
router.get('/bookings', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantReq = req as any;
    const individualId = tenantReq.ctx?.individual_id;
    
    if (!individualId) {
      return res.status(401).json({ success: false, error: 'Individual profile required' });
    }
    
    const result = await req.tenantQuery(`
      SELECT 
        b.id,
        b.status,
        b.starts_at,
        b.ends_at,
        b.actual_checkout_at,
        b.actual_checkin_at,
        b.pricing_model,
        b.rate_applied,
        b.duration_hours,
        b.subtotal,
        b.tax,
        b.damage_deposit_held,
        b.total,
        b.payment_status,
        b.condition_at_checkout,
        b.condition_at_return,
        b.damage_reported,
        b.damage_notes,
        b.notes,
        b.created_at,
        
        ri.id as item_id,
        ri.name as item_name,
        ri.slug as item_slug,
        ri.description as item_description,
        ri.location_name,
        ri.owner_name,
        ri.photos as item_photos,
        
        rc.name as category_name,
        rc.slug as category_slug,
        rc.icon as category_icon,
        
        c.name as community_name
        
      FROM cc_rental_bookings b
      JOIN cc_rental_items ri ON ri.id = b.rental_item_id
      JOIN cc_rental_categories rc ON rc.id = ri.category_id
      LEFT JOIN cc_sr_communities c ON c.id = ri.home_community_id
      WHERE b.renter_individual_id = $1
      ORDER BY 
        CASE b.status 
          WHEN 'active' THEN 1
          WHEN 'checked_out' THEN 2
          WHEN 'confirmed' THEN 3
          WHEN 'pending' THEN 4
          ELSE 5
        END,
        b.starts_at DESC
    `, [individualId]);
    
    res.json({ 
      success: true, 
      bookings: result.rows.map(row => ({
        id: row.id,
        status: row.status,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        actualCheckoutAt: row.actual_checkout_at,
        actualCheckinAt: row.actual_checkin_at,
        pricingModel: row.pricing_model,
        rateApplied: row.rate_applied ? parseFloat(row.rate_applied) : null,
        durationHours: row.duration_hours ? parseFloat(row.duration_hours) : null,
        subtotal: row.subtotal ? parseFloat(row.subtotal) : 0,
        tax: row.tax ? parseFloat(row.tax) : 0,
        damageDepositHeld: row.damage_deposit_held ? parseFloat(row.damage_deposit_held) : 0,
        total: row.total ? parseFloat(row.total) : 0,
        paymentStatus: row.payment_status,
        conditionAtCheckout: row.condition_at_checkout,
        conditionAtReturn: row.condition_at_return,
        damageReported: row.damage_reported,
        damageNotes: row.damage_notes,
        notes: row.notes,
        createdAt: row.created_at,
        item: {
          id: row.item_id,
          name: row.item_name,
          slug: row.item_slug,
          description: row.item_description || '',
          locationName: row.location_name || '',
          ownerName: row.owner_name || 'Owner',
          photos: row.item_photos || [],
          category: row.category_name,
          categorySlug: row.category_slug,
          categoryIcon: row.category_icon,
          communityName: row.community_name
        }
      }))
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch bookings' });
  }
});

// POST /api/rentals/bookings/:id/cancel - Cancel booking (SELF)
router.post('/bookings/:id/cancel', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantReq = req as any;
    const individualId = tenantReq.ctx?.individual_id;
    const bookingIdParsed = uuidSchema.safeParse(req.params.id);
    
    if (!bookingIdParsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid booking ID' });
    }
    
    if (!individualId) {
      return res.status(401).json({ success: false, error: 'Individual profile required' });
    }
    
    const bookingId = bookingIdParsed.data;
    
    // Use tenantTransaction - user can only cancel their own bookings
    const result = await req.tenantTransaction(async (client) => {
      const bookingResult = await client.query(`
        SELECT id, status, starts_at 
        FROM cc_rental_bookings 
        WHERE id = $1 AND renter_individual_id = $2
      `, [bookingId, individualId]);
      
      if (bookingResult.rows.length === 0) {
        return { error: 'Booking not found', status: 404 };
      }
      
      const booking = bookingResult.rows[0];
      
      if (!['pending', 'confirmed'].includes(booking.status)) {
        return { error: `Cannot cancel booking with status: ${booking.status}`, status: 400 };
      }
      
      await client.query(`
        UPDATE cc_rental_bookings 
        SET status = 'cancelled', updated_at = NOW()
        WHERE id = $1
      `, [bookingId]);
      
      return { success: true };
    });
    
    if (result.error) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    
    res.json({ success: true, message: 'Booking cancelled' });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel booking' });
  }
});

export default router;
