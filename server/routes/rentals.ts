import { Router, Request, Response } from 'express';
import { db, pool } from '../db';
import { sql } from 'drizzle-orm';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

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

router.get('/browse', async (req: Request, res: Response) => {
  try {
    const parsed = browseQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid query parameters' });
    }
    
    const { category, community, search } = parsed.data;
    
    const categoriesResult = await pool.query(`
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
        ri.owner_name
      FROM cc_rental_items ri
      JOIN cc_rental_categories rc ON rc.id = ri.category_id
      LEFT JOIN sr_communities c ON c.id = ri.home_community_id
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
    
    const itemsResult = await pool.query(itemsQuery, params);
    
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
      ownerName: row.owner_name || 'Owner'
    }));
    
    res.json({ success: true, categories, items });
  } catch (error) {
    console.error('Error browsing rentals:', error);
    res.status(500).json({ success: false, error: 'Failed to load rentals' });
  }
});

router.get('/:id/eligibility', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const idParsed = uuidSchema.safeParse(req.params.id);
    if (!idParsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid item ID' });
    }
    
    const itemId = idParsed.data;
    const userEmail = req.user?.email;
    
    if (!userEmail) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    const itemResult = await pool.query(`
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
    
    const individualResult = await pool.query(
      `SELECT id FROM cc_individuals WHERE email = $1`,
      [userEmail]
    );
    
    if (individualResult.rows.length === 0) {
      return res.json({
        success: true,
        eligibility: {
          ready: false,
          hasWaiver: false,
          hasDocument: false,
          hasPayment: false,
          blockers: ['profile'],
          requiredWaiver: item.required_waiver_slug,
          requiredDocument: item.required_document_type
        }
      });
    }
    
    const individualId = individualResult.rows[0].id;
    
    let hasWaiver = true;
    if (item.required_waiver_slug) {
      const waiverResult = await pool.query(`
        SELECT EXISTS(
          SELECT 1 FROM cc_signed_waivers sw
          JOIN cc_waiver_templates wt ON wt.id = sw.waiver_template_id
          WHERE sw.individual_id = $1
          AND wt.slug = $2
          AND sw.is_expired = false
        ) as has_waiver
      `, [individualId, item.required_waiver_slug]);
      hasWaiver = waiverResult.rows[0].has_waiver;
    }
    
    let hasDocument = true;
    if (item.required_document_type) {
      const docResult = await pool.query(`
        SELECT EXISTS(
          SELECT 1 FROM cc_identity_documents
          WHERE individual_id = $1
          AND document_type = $2
          AND verified = true
          AND is_expired = false
        ) as has_document
      `, [individualId, item.required_document_type]);
      hasDocument = docResult.rows[0].has_document;
    }
    
    const paymentResult = await pool.query(`
      SELECT EXISTS(
        SELECT 1 FROM cc_payment_methods
        WHERE individual_id = $1
        AND verified = true
        AND is_expired = false
      ) as has_payment
    `, [individualId]);
    const hasPayment = paymentResult.rows[0].has_payment;
    
    const blockers: string[] = [];
    if (!hasWaiver) blockers.push(`waiver:${item.required_waiver_slug}`);
    if (!hasDocument) blockers.push(`document:${item.required_document_type}`);
    if (!hasPayment) blockers.push('payment_method');
    
    res.json({
      success: true,
      eligibility: {
        ready: hasWaiver && hasDocument && hasPayment,
        hasWaiver,
        hasDocument,
        hasPayment,
        blockers,
        requiredWaiver: item.required_waiver_slug,
        requiredDocument: item.required_document_type
      }
    });
  } catch (error) {
    console.error('Error checking eligibility:', error);
    res.status(500).json({ success: false, error: 'Failed to check eligibility' });
  }
});

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
    
    const itemResult = await pool.query(`
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

router.post('/:id/book', authenticateToken, async (req: AuthRequest, res: Response) => {
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
    const userEmail = req.user?.email;
    
    if (!userEmail) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    const individualResult = await pool.query(
      `SELECT id FROM cc_individuals WHERE email = $1`,
      [userEmail]
    );
    
    if (individualResult.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Profile required to book' });
    }
    
    const individualId = individualResult.rows[0].id;
    
    const itemResult = await pool.query(
      `SELECT id, buffer_minutes FROM cc_rental_items WHERE id = $1`,
      [itemId]
    );
    
    if (itemResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    
    const bufferMinutes = itemResult.rows[0].buffer_minutes || 15;
    
    const conflictResult = await pool.query(`
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
      return res.status(409).json({ success: false, error: 'Time slot not available' });
    }
    
    const start = new Date(startTs);
    const end = new Date(endTs);
    const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    const durationDays = Math.ceil(durationHours / 24);
    
    const priceResult = await pool.query(
      `SELECT rate_daily, rate_hourly, damage_deposit FROM cc_rental_items WHERE id = $1`,
      [itemId]
    );
    const priceRow = priceResult.rows[0];
    const rateDaily = parseFloat(priceRow.rate_daily) || 0;
    const rateHourly = parseFloat(priceRow.rate_hourly) || 0;
    const damageDeposit = parseFloat(priceRow.damage_deposit) || 0;
    
    let subtotal = rateDaily ? rateDaily * durationDays : rateHourly * durationHours;
    const tax = subtotal * 0.12;
    const total = subtotal + tax + damageDeposit;
    
    const bookingResult = await pool.query(`
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
    
    res.json({
      success: true,
      booking: {
        id: bookingId,
        total
      }
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ success: false, error: 'Failed to create booking' });
  }
});

router.get('/my-bookings', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userEmail = req.user?.email;
    
    if (!userEmail) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    const result = await pool.query(`
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
      JOIN cc_individuals i ON i.id = b.renter_individual_id
      WHERE i.email = $1
      ORDER BY b.starts_at DESC
    `, [userEmail]);
    
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

router.get('/bookings', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userEmail = req.user?.email;
    
    if (!userEmail) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    const indResult = await pool.query(
      'SELECT id FROM cc_individuals WHERE email = $1',
      [userEmail]
    );
    
    if (indResult.rows.length === 0) {
      return res.json({ success: true, bookings: [] });
    }
    
    const individualId = indResult.rows[0].id;
    
    const result = await pool.query(`
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
      LEFT JOIN sr_communities c ON c.id = ri.home_community_id
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

router.post('/bookings/:id/cancel', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userEmail = req.user?.email;
    const bookingIdParsed = uuidSchema.safeParse(req.params.id);
    
    if (!bookingIdParsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid booking ID' });
    }
    
    if (!userEmail) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    const bookingId = bookingIdParsed.data;
    
    const indResult = await pool.query(
      'SELECT id FROM cc_individuals WHERE email = $1',
      [userEmail]
    );
    
    if (indResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const individualId = indResult.rows[0].id;
    
    const bookingResult = await pool.query(`
      SELECT id, status, starts_at 
      FROM cc_rental_bookings 
      WHERE id = $1 AND renter_individual_id = $2
    `, [bookingId, individualId]);
    
    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }
    
    const booking = bookingResult.rows[0];
    
    if (!['pending', 'confirmed'].includes(booking.status)) {
      return res.status(400).json({ 
        success: false, 
        error: `Cannot cancel booking with status: ${booking.status}` 
      });
    }
    
    await pool.query(`
      UPDATE cc_rental_bookings 
      SET status = 'cancelled', updated_at = NOW()
      WHERE id = $1
    `, [bookingId]);
    
    res.json({ success: true, message: 'Booking cancelled' });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel booking' });
  }
});

router.get('/bookings/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userEmail = req.user?.email;
    const bookingIdParsed = uuidSchema.safeParse(req.params.id);
    
    if (!bookingIdParsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid booking ID' });
    }
    
    if (!userEmail) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    const bookingId = bookingIdParsed.data;
    
    const indResult = await pool.query(
      'SELECT id FROM cc_individuals WHERE email = $1',
      [userEmail]
    );
    
    if (indResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const individualId = indResult.rows[0].id;
    
    const result = await pool.query(`
      SELECT 
        b.*,
        ri.name as item_name,
        ri.description as item_description,
        ri.location_name,
        ri.owner_name,
        ri.included_items,
        rc.name as category_name,
        rc.icon as category_icon,
        c.name as community_name
      FROM cc_rental_bookings b
      JOIN cc_rental_items ri ON ri.id = b.rental_item_id
      JOIN cc_rental_categories rc ON rc.id = ri.category_id
      LEFT JOIN sr_communities c ON c.id = ri.home_community_id
      WHERE b.id = $1 AND b.renter_individual_id = $2
    `, [bookingId, individualId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }
    
    res.json({ success: true, booking: result.rows[0] });
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch booking' });
  }
});

export default router;
