import { Router, Response } from 'express';
import { requireHostAuth, HostAuthRequest } from './hostAuth';
import * as stagingStorage from '../storage/stagingStorage';
import { logActivity } from '../services/hostAuthService';
import { db } from '../db';
import { sql } from 'drizzle-orm';

const router = Router();

// Apply auth to all routes
router.use(requireHostAuth as any);

// ============================================================================
// HELPER: Verify Property Ownership
// ============================================================================

async function verifyOwnership(hostId: number, propertyId: number): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT id FROM cc_staging_properties 
    WHERE id = ${propertyId} AND host_account_id = ${hostId}
  `);
  return result.rows.length > 0;
}

async function getHostProperties(hostId: number): Promise<number[]> {
  const result = await db.execute(sql`
    SELECT id FROM cc_staging_properties WHERE host_account_id = ${hostId}
  `);
  return (result.rows as any[]).map(r => r.id);
}

// ============================================================================
// MY PROPERTIES
// ============================================================================

// GET /api/host/properties - List host's claimed properties
router.get('/properties', async (req: HostAuthRequest, res: Response) => {
  try {
    const hostId = req.hostAccount!.id;
    
    const result = await db.execute(sql`
      SELECT sp.*, 
             pr.nightly_rate as base_nightly_rate,
             (SELECT COUNT(*) FROM cc_staging_reservations WHERE property_id = sp.id AND status NOT IN ('cancelled', 'no_show')) as reservation_count
      FROM cc_staging_properties sp
      LEFT JOIN cc_staging_pricing pr ON pr.property_id = sp.id 
        AND pr.pricing_type = 'base_nightly' AND pr.is_active = true
      WHERE sp.host_account_id = ${hostId}
      ORDER BY sp.updated_at DESC
    `);

    res.json({ properties: result.rows, total: result.rows.length });
  } catch (error) {
    console.error('[HostProperties] List error:', error);
    res.status(500).json({ error: 'Failed to get properties' });
  }
});

// GET /api/host/properties/:id - Get property details (verify ownership)
router.get('/properties/:id', async (req: HostAuthRequest, res: Response) => {
  try {
    const hostId = req.hostAccount!.id;
    const propertyId = parseInt(req.params.id);

    if (isNaN(propertyId)) {
      return res.status(400).json({ error: 'Invalid property ID' });
    }

    if (!await verifyOwnership(hostId, propertyId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const property = await stagingStorage.getPropertyById(propertyId);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    res.json(property);
  } catch (error) {
    console.error('[HostProperties] Get error:', error);
    res.status(500).json({ error: 'Failed to get property' });
  }
});

// PUT /api/host/properties/:id - Update property details
router.put('/properties/:id', async (req: HostAuthRequest, res: Response) => {
  try {
    const hostId = req.hostAccount!.id;
    const propertyId = parseInt(req.params.id);

    if (isNaN(propertyId)) {
      return res.status(400).json({ error: 'Invalid property ID' });
    }

    if (!await verifyOwnership(hostId, propertyId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Remove fields that shouldn't be updated directly
    const { id, canvasId, hostAccountId, ...updateData } = req.body;

    const property = await stagingStorage.updateProperty(propertyId, updateData);
    
    await logActivity(hostId, 'property_updated', `Updated property ${propertyId}`, propertyId);

    res.json(property);
  } catch (error) {
    console.error('[HostProperties] Update error:', error);
    res.status(500).json({ error: 'Failed to update property' });
  }
});

// PUT /api/host/properties/:id/photos - Update photos
router.put('/properties/:id/photos', async (req: HostAuthRequest, res: Response) => {
  try {
    const hostId = req.hostAccount!.id;
    const propertyId = parseInt(req.params.id);

    if (!await verifyOwnership(hostId, propertyId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { thumbnailUrl, images } = req.body;

    const property = await stagingStorage.updateProperty(propertyId, {
      thumbnailUrl,
      images
    });

    await logActivity(hostId, 'photos_updated', `Updated photos for property ${propertyId}`, propertyId);

    res.json(property);
  } catch (error) {
    console.error('[HostProperties] Update photos error:', error);
    res.status(500).json({ error: 'Failed to update photos' });
  }
});

// PUT /api/host/properties/:id/status - Change status
router.put('/properties/:id/status', async (req: HostAuthRequest, res: Response) => {
  try {
    const hostId = req.hostAccount!.id;
    const propertyId = parseInt(req.params.id);

    if (!await verifyOwnership(hostId, propertyId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { status } = req.body;
    const validStatuses = ['active', 'inactive', 'seasonal'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const property = await stagingStorage.updateProperty(propertyId, { status });
    
    await logActivity(hostId, 'status_changed', `Changed property ${propertyId} to ${status}`, propertyId);

    res.json(property);
  } catch (error) {
    console.error('[HostProperties] Update status error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// ============================================================================
// CLAIMING
// ============================================================================

// GET /api/host/properties/search - Search unclaimed properties
router.get('/properties/search', async (req: HostAuthRequest, res: Response) => {
  try {
    const q = req.query.q as string;
    const region = req.query.region as string;

    if (!q && !region) {
      return res.status(400).json({ error: 'Search query or region required' });
    }

    let query = `
      SELECT id, canvas_id, name, city, region, property_type, total_spots,
             crew_score, rv_score, thumbnail_url, status
      FROM cc_staging_properties 
      WHERE host_account_id IS NULL
    `;

    if (q) {
      query += ` AND (name ILIKE '%${q.replace(/'/g, "''")}%' OR city ILIKE '%${q.replace(/'/g, "''")}%')`;
    }
    if (region) {
      query += ` AND region = '${region.replace(/'/g, "''")}'`;
    }

    query += ` ORDER BY name LIMIT 50`;

    const result = await db.execute(sql.raw(query));
    res.json({ properties: result.rows, total: result.rows.length });
  } catch (error) {
    console.error('[HostProperties] Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// GET /api/host/properties/unclaimed - Browse unclaimed by region
router.get('/properties/unclaimed', async (req: HostAuthRequest, res: Response) => {
  try {
    const region = req.query.region as string;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    let query = `
      SELECT id, canvas_id, name, city, region, property_type, total_spots,
             crew_score, rv_score, thumbnail_url, status
      FROM cc_staging_properties 
      WHERE host_account_id IS NULL
    `;

    if (region) {
      query += ` AND region = '${region.replace(/'/g, "''")}'`;
    }

    query += ` ORDER BY name LIMIT ${limit} OFFSET ${offset}`;

    const result = await db.execute(sql.raw(query));
    res.json({ properties: result.rows, total: result.rows.length });
  } catch (error) {
    console.error('[HostProperties] Unclaimed error:', error);
    res.status(500).json({ error: 'Failed to get unclaimed properties' });
  }
});

// POST /api/host/properties/claim - Initiate claim
router.post('/properties/claim', async (req: HostAuthRequest, res: Response) => {
  try {
    const hostId = req.hostAccount!.id;
    const { propertyId, verificationMethod } = req.body;

    if (!propertyId) {
      return res.status(400).json({ error: 'Property ID required' });
    }

    // Check if property exists and is unclaimed
    const result = await db.execute(sql`
      SELECT id, name, host_account_id FROM cc_staging_properties WHERE id = ${propertyId}
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const property = result.rows[0] as any;
    if (property.host_account_id) {
      return res.status(400).json({ error: 'Property already claimed' });
    }

    // Generate verification code
    const verificationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Store claim request
    await db.execute(sql`
      INSERT INTO cc_staging_property_claims (
        property_id, host_account_id, verification_code, verification_method, 
        status, expires_at
      ) VALUES (
        ${propertyId}, ${hostId}, ${verificationCode}, ${verificationMethod || 'email'},
        'pending', ${expiresAt}
      )
    `);

    await logActivity(hostId, 'claim_initiated', `Initiated claim for property ${propertyId}`, propertyId);

    res.json({ 
      message: 'Claim initiated. Verification code sent.',
      propertyName: property.name,
      expiresAt,
      // In production, don't return this - send via email/SMS
      verificationCode
    });
  } catch (error) {
    console.error('[HostProperties] Claim error:', error);
    res.status(500).json({ error: 'Failed to initiate claim' });
  }
});

// POST /api/host/properties/verify-claim - Verify with code
router.post('/properties/verify-claim', async (req: HostAuthRequest, res: Response) => {
  try {
    const hostId = req.hostAccount!.id;
    const { propertyId, code } = req.body;

    if (!propertyId || !code) {
      return res.status(400).json({ error: 'Property ID and verification code required' });
    }

    // Find pending claim
    const claimResult = await db.execute(sql`
      SELECT * FROM cc_staging_property_claims 
      WHERE property_id = ${propertyId} 
        AND host_account_id = ${hostId}
        AND verification_code = ${code}
        AND status = 'pending'
        AND expires_at > CURRENT_TIMESTAMP
    `);

    if (claimResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired verification code' });
    }

    // Update claim status
    await db.execute(sql`
      UPDATE cc_staging_property_claims 
      SET status = 'verified', verified_at = CURRENT_TIMESTAMP
      WHERE property_id = ${propertyId} AND host_account_id = ${hostId}
    `);

    // Assign property to host
    await db.execute(sql`
      UPDATE cc_staging_properties 
      SET host_account_id = ${hostId}, status = 'active', updated_at = CURRENT_TIMESTAMP
      WHERE id = ${propertyId}
    `);

    await logActivity(hostId, 'claim_verified', `Verified claim for property ${propertyId}`, propertyId);

    res.json({ message: 'Property claimed successfully' });
  } catch (error) {
    console.error('[HostProperties] Verify claim error:', error);
    res.status(500).json({ error: 'Failed to verify claim' });
  }
});

// POST /api/host/properties - Create new property
router.post('/properties', async (req: HostAuthRequest, res: Response) => {
  try {
    const hostId = req.hostAccount!.id;
    
    const property = await stagingStorage.createProperty({
      ...req.body,
      hostAccountId: hostId,
      status: 'active'
    });

    await logActivity(hostId, 'property_created', `Created new property ${property.id}`, property.id);

    res.status(201).json(property);
  } catch (error) {
    console.error('[HostProperties] Create error:', error);
    res.status(500).json({ error: 'Failed to create property' });
  }
});

// ============================================================================
// SPOTS
// ============================================================================

// GET /api/host/properties/:id/spots
router.get('/properties/:id/spots', async (req: HostAuthRequest, res: Response) => {
  try {
    const hostId = req.hostAccount!.id;
    const propertyId = parseInt(req.params.id);

    if (!await verifyOwnership(hostId, propertyId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const spots = await stagingStorage.getSpotsForProperty(propertyId);
    res.json({ spots, total: spots.length });
  } catch (error) {
    console.error('[HostProperties] Get spots error:', error);
    res.status(500).json({ error: 'Failed to get spots' });
  }
});

// POST /api/host/properties/:id/spots
router.post('/properties/:id/spots', async (req: HostAuthRequest, res: Response) => {
  try {
    const hostId = req.hostAccount!.id;
    const propertyId = parseInt(req.params.id);

    if (!await verifyOwnership(hostId, propertyId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const spot = await stagingStorage.createSpot({ ...req.body, propertyId });
    
    await logActivity(hostId, 'spot_created', `Added spot to property ${propertyId}`, propertyId);

    res.status(201).json(spot);
  } catch (error) {
    console.error('[HostProperties] Create spot error:', error);
    res.status(500).json({ error: 'Failed to create spot' });
  }
});

// PUT /api/host/properties/:id/spots/:spotId
router.put('/properties/:id/spots/:spotId', async (req: HostAuthRequest, res: Response) => {
  try {
    const hostId = req.hostAccount!.id;
    const propertyId = parseInt(req.params.id);
    const spotId = parseInt(req.params.spotId);

    if (!await verifyOwnership(hostId, propertyId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const spot = await stagingStorage.updateSpot(spotId, req.body);
    if (!spot) {
      return res.status(404).json({ error: 'Spot not found' });
    }

    res.json(spot);
  } catch (error) {
    console.error('[HostProperties] Update spot error:', error);
    res.status(500).json({ error: 'Failed to update spot' });
  }
});

// DELETE /api/host/properties/:id/spots/:spotId
router.delete('/properties/:id/spots/:spotId', async (req: HostAuthRequest, res: Response) => {
  try {
    const hostId = req.hostAccount!.id;
    const propertyId = parseInt(req.params.id);
    const spotId = parseInt(req.params.spotId);

    if (!await verifyOwnership(hostId, propertyId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await db.execute(sql`DELETE FROM cc_staging_spots WHERE id = ${spotId} AND property_id = ${propertyId}`);
    
    await logActivity(hostId, 'spot_deleted', `Removed spot from property ${propertyId}`, propertyId);

    res.json({ success: true });
  } catch (error) {
    console.error('[HostProperties] Delete spot error:', error);
    res.status(500).json({ error: 'Failed to delete spot' });
  }
});

// ============================================================================
// PRICING
// ============================================================================

// GET /api/host/properties/:id/pricing
router.get('/properties/:id/pricing', async (req: HostAuthRequest, res: Response) => {
  try {
    const hostId = req.hostAccount!.id;
    const propertyId = parseInt(req.params.id);

    if (!await verifyOwnership(hostId, propertyId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const pricing = await stagingStorage.getPricingForProperty(propertyId);
    res.json({ pricing });
  } catch (error) {
    console.error('[HostProperties] Get pricing error:', error);
    res.status(500).json({ error: 'Failed to get pricing' });
  }
});

// POST /api/host/properties/:id/pricing
router.post('/properties/:id/pricing', async (req: HostAuthRequest, res: Response) => {
  try {
    const hostId = req.hostAccount!.id;
    const propertyId = parseInt(req.params.id);

    if (!await verifyOwnership(hostId, propertyId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { pricingType, nightlyRate, weeklyRate, monthlyRate, seasonName, startDate, endDate, spotId } = req.body;

    const result = await db.execute(sql`
      INSERT INTO cc_staging_pricing (
        property_id, spot_id, pricing_type, nightly_rate, weekly_rate, monthly_rate,
        season_name, start_date, end_date, is_active
      ) VALUES (
        ${propertyId}, ${spotId || null}, ${pricingType}, ${nightlyRate || null}, 
        ${weeklyRate || null}, ${monthlyRate || null}, ${seasonName || null},
        ${startDate || null}, ${endDate || null}, true
      )
      RETURNING *
    `);

    await logActivity(hostId, 'pricing_added', `Added pricing rule to property ${propertyId}`, propertyId);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('[HostProperties] Create pricing error:', error);
    res.status(500).json({ error: 'Failed to create pricing' });
  }
});

// PUT /api/host/properties/:id/pricing/:ruleId
router.put('/properties/:id/pricing/:ruleId', async (req: HostAuthRequest, res: Response) => {
  try {
    const hostId = req.hostAccount!.id;
    const propertyId = parseInt(req.params.id);
    const ruleId = parseInt(req.params.ruleId);

    if (!await verifyOwnership(hostId, propertyId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { nightlyRate, weeklyRate, monthlyRate, seasonName, startDate, endDate, isActive } = req.body;

    const result = await db.execute(sql`
      UPDATE cc_staging_pricing 
      SET nightly_rate = COALESCE(${nightlyRate}, nightly_rate),
          weekly_rate = COALESCE(${weeklyRate}, weekly_rate),
          monthly_rate = COALESCE(${monthlyRate}, monthly_rate),
          season_name = COALESCE(${seasonName}, season_name),
          start_date = COALESCE(${startDate}, start_date),
          end_date = COALESCE(${endDate}, end_date),
          is_active = COALESCE(${isActive}, is_active)
      WHERE id = ${ruleId} AND property_id = ${propertyId}
      RETURNING *
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pricing rule not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('[HostProperties] Update pricing error:', error);
    res.status(500).json({ error: 'Failed to update pricing' });
  }
});

// DELETE /api/host/properties/:id/pricing/:ruleId
router.delete('/properties/:id/pricing/:ruleId', async (req: HostAuthRequest, res: Response) => {
  try {
    const hostId = req.hostAccount!.id;
    const propertyId = parseInt(req.params.id);
    const ruleId = parseInt(req.params.ruleId);

    if (!await verifyOwnership(hostId, propertyId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await db.execute(sql`DELETE FROM cc_staging_pricing WHERE id = ${ruleId} AND property_id = ${propertyId}`);

    res.json({ success: true });
  } catch (error) {
    console.error('[HostProperties] Delete pricing error:', error);
    res.status(500).json({ error: 'Failed to delete pricing' });
  }
});

// ============================================================================
// SERVICE PROVIDERS
// ============================================================================

// GET /api/host/properties/:id/providers
router.get('/properties/:id/providers', async (req: HostAuthRequest, res: Response) => {
  try {
    const hostId = req.hostAccount!.id;
    const propertyId = parseInt(req.params.id);

    if (!await verifyOwnership(hostId, propertyId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const providers = await stagingStorage.getProvidersForProperty(propertyId);
    res.json({ providers, total: providers.length });
  } catch (error) {
    console.error('[HostProperties] Get providers error:', error);
    res.status(500).json({ error: 'Failed to get providers' });
  }
});

// POST /api/host/properties/:id/providers
router.post('/properties/:id/providers', async (req: HostAuthRequest, res: Response) => {
  try {
    const hostId = req.hostAccount!.id;
    const propertyId = parseInt(req.params.id);

    if (!await verifyOwnership(hostId, propertyId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const provider = await stagingStorage.createProvider({ ...req.body, propertyId });
    
    await logActivity(hostId, 'provider_added', `Added service provider to property ${propertyId}`, propertyId);

    res.status(201).json(provider);
  } catch (error) {
    console.error('[HostProperties] Create provider error:', error);
    res.status(500).json({ error: 'Failed to create provider' });
  }
});

// PUT /api/host/properties/:id/providers/:providerId
router.put('/properties/:id/providers/:providerId', async (req: HostAuthRequest, res: Response) => {
  try {
    const hostId = req.hostAccount!.id;
    const propertyId = parseInt(req.params.id);
    const providerId = parseInt(req.params.providerId);

    if (!await verifyOwnership(hostId, propertyId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const provider = await stagingStorage.updateProvider(providerId, req.body);
    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    res.json(provider);
  } catch (error) {
    console.error('[HostProperties] Update provider error:', error);
    res.status(500).json({ error: 'Failed to update provider' });
  }
});

// DELETE /api/host/properties/:id/providers/:providerId
router.delete('/properties/:id/providers/:providerId', async (req: HostAuthRequest, res: Response) => {
  try {
    const hostId = req.hostAccount!.id;
    const propertyId = parseInt(req.params.id);
    const providerId = parseInt(req.params.providerId);

    if (!await verifyOwnership(hostId, propertyId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await db.execute(sql`
      DELETE FROM cc_staging_service_providers 
      WHERE id = ${providerId} AND property_id = ${propertyId}
    `);

    await logActivity(hostId, 'provider_removed', `Removed service provider from property ${propertyId}`, propertyId);

    res.json({ success: true });
  } catch (error) {
    console.error('[HostProperties] Delete provider error:', error);
    res.status(500).json({ error: 'Failed to delete provider' });
  }
});

// ============================================================================
// CALENDAR
// ============================================================================

// GET /api/host/calendar/:propertyId
router.get('/calendar/:propertyId', async (req: HostAuthRequest, res: Response) => {
  try {
    const hostId = req.hostAccount!.id;
    const propertyId = parseInt(req.params.propertyId);

    if (!await verifyOwnership(hostId, propertyId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const startDate = req.query.startDate as string || new Date().toISOString().split('T')[0];
    const endDate = req.query.endDate as string || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const blocks = await stagingStorage.getCalendar(propertyId, startDate, endDate);
    
    // Also get reservations for the period
    const reservations = await stagingStorage.getReservations({
      propertyId,
      checkInFrom: startDate,
      checkInTo: endDate
    });

    res.json({ blocks, reservations, startDate, endDate });
  } catch (error) {
    console.error('[HostProperties] Get calendar error:', error);
    res.status(500).json({ error: 'Failed to get calendar' });
  }
});

// POST /api/host/calendar/:propertyId/block
router.post('/calendar/:propertyId/block', async (req: HostAuthRequest, res: Response) => {
  try {
    const hostId = req.hostAccount!.id;
    const propertyId = parseInt(req.params.propertyId);

    if (!await verifyOwnership(hostId, propertyId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { startDate, endDate, blockType, spotId, notes } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start and end date required' });
    }

    const block = await stagingStorage.createBlock({
      propertyId,
      spotId,
      startDate,
      endDate,
      blockType: blockType || 'blocked',
      notes
    });

    await logActivity(hostId, 'calendar_blocked', `Added calendar block for property ${propertyId}`, propertyId);

    res.status(201).json(block);
  } catch (error) {
    console.error('[HostProperties] Create block error:', error);
    res.status(500).json({ error: 'Failed to create block' });
  }
});

// PUT /api/host/calendar/block/:blockId
router.put('/calendar/block/:blockId', async (req: HostAuthRequest, res: Response) => {
  try {
    const hostId = req.hostAccount!.id;
    const blockId = parseInt(req.params.blockId);

    // Get block and verify ownership
    const blockResult = await db.execute(sql`
      SELECT cb.*, sp.host_account_id 
      FROM cc_staging_calendar_blocks cb
      JOIN cc_staging_properties sp ON sp.id = cb.property_id
      WHERE cb.id = ${blockId}
    `);

    if (blockResult.rows.length === 0) {
      return res.status(404).json({ error: 'Block not found' });
    }

    if ((blockResult.rows[0] as any).host_account_id !== hostId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const block = await stagingStorage.updateBlock(blockId, req.body);
    res.json(block);
  } catch (error) {
    console.error('[HostProperties] Update block error:', error);
    res.status(500).json({ error: 'Failed to update block' });
  }
});

// DELETE /api/host/calendar/block/:blockId
router.delete('/calendar/block/:blockId', async (req: HostAuthRequest, res: Response) => {
  try {
    const hostId = req.hostAccount!.id;
    const blockId = parseInt(req.params.blockId);

    // Get block and verify ownership
    const blockResult = await db.execute(sql`
      SELECT cb.*, sp.host_account_id 
      FROM cc_staging_calendar_blocks cb
      JOIN cc_staging_properties sp ON sp.id = cb.property_id
      WHERE cb.id = ${blockId}
    `);

    if (blockResult.rows.length === 0) {
      return res.status(404).json({ error: 'Block not found' });
    }

    if ((blockResult.rows[0] as any).host_account_id !== hostId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await stagingStorage.deleteBlock(blockId);
    res.json({ success: true });
  } catch (error) {
    console.error('[HostProperties] Delete block error:', error);
    res.status(500).json({ error: 'Failed to delete block' });
  }
});

// POST /api/host/calendar/:propertyId/import - Import iCal (placeholder)
router.post('/calendar/:propertyId/import', async (req: HostAuthRequest, res: Response) => {
  try {
    const hostId = req.hostAccount!.id;
    const propertyId = parseInt(req.params.propertyId);

    if (!await verifyOwnership(hostId, propertyId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // TODO: Implement iCal import
    res.json({ message: 'iCal import not yet implemented' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to import calendar' });
  }
});

// GET /api/host/calendar/:propertyId/export - Export iCal (placeholder)
router.get('/calendar/:propertyId/export', async (req: HostAuthRequest, res: Response) => {
  try {
    const hostId = req.hostAccount!.id;
    const propertyId = parseInt(req.params.propertyId);

    if (!await verifyOwnership(hostId, propertyId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // TODO: Implement iCal export
    res.set('Content-Type', 'text/calendar');
    res.send('BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR');
  } catch (error) {
    res.status(500).json({ error: 'Failed to export calendar' });
  }
});

// ============================================================================
// ICAL FEEDS (placeholders)
// ============================================================================

// GET /api/host/properties/:id/feeds
router.get('/properties/:id/feeds', async (req: HostAuthRequest, res: Response) => {
  try {
    const hostId = req.hostAccount!.id;
    const propertyId = parseInt(req.params.id);

    if (!await verifyOwnership(hostId, propertyId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // TODO: Implement feeds table
    res.json({ feeds: [] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get feeds' });
  }
});

// POST /api/host/properties/:id/feeds
router.post('/properties/:id/feeds', async (req: HostAuthRequest, res: Response) => {
  try {
    const hostId = req.hostAccount!.id;
    const propertyId = parseInt(req.params.id);

    if (!await verifyOwnership(hostId, propertyId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // TODO: Implement feed creation
    res.json({ message: 'iCal feeds not yet implemented' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create feed' });
  }
});

// ============================================================================
// RESERVATIONS
// ============================================================================

// GET /api/host/reservations - All reservations for host's properties
router.get('/reservations', async (req: HostAuthRequest, res: Response) => {
  try {
    const hostId = req.hostAccount!.id;
    const propertyIds = await getHostProperties(hostId);

    if (propertyIds.length === 0) {
      return res.json({ reservations: [], total: 0 });
    }

    const status = req.query.status as string;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    let query = `
      SELECT b.*, sp.name as property_name, sp.canvas_id as property_canvas_id
      FROM cc_staging_reservations b
      JOIN cc_staging_properties sp ON sp.id = b.property_id
      WHERE b.property_id IN (${propertyIds.join(',')})
    `;

    if (status) {
      query += ` AND b.status = '${status}'`;
    }

    query += ` ORDER BY b.check_in_date DESC LIMIT ${limit} OFFSET ${offset}`;

    const result = await db.execute(sql.raw(query));
    res.json({ reservations: result.rows, total: result.rows.length });
  } catch (error) {
    console.error('[HostProperties] Get reservations error:', error);
    res.status(500).json({ error: 'Failed to get reservations' });
  }
});

// GET /api/host/reservations/:id
router.get('/reservations/:id', async (req: HostAuthRequest, res: Response) => {
  try {
    const hostId = req.hostAccount!.id;
    const reservationId = parseInt(req.params.id);

    const reservation = await stagingStorage.getReservationById(reservationId);
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    // Verify host owns the property
    if (!await verifyOwnership(hostId, reservation.propertyId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(reservation);
  } catch (error) {
    console.error('[HostProperties] Get reservation error:', error);
    res.status(500).json({ error: 'Failed to get reservation' });
  }
});

// PUT /api/host/reservations/:id/status
router.put('/reservations/:id/status', async (req: HostAuthRequest, res: Response) => {
  try {
    const hostId = req.hostAccount!.id;
    const reservationId = parseInt(req.params.id);
    const { status } = req.body;

    const validStatuses = ['pending', 'confirmed', 'checked_in', 'checked_out', 'completed', 'cancelled', 'no_show'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const reservation = await stagingStorage.getReservationById(reservationId);
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    if (!await verifyOwnership(hostId, reservation.propertyId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = await stagingStorage.updateReservation(reservationId, { status });
    
    await logActivity(hostId, 'reservation.status_changed', `Changed reservation ${reservationId} to ${status}`, reservation.propertyId);

    res.json(updated);
  } catch (error) {
    console.error('[HostProperties] Update reservation status error:', error);
    res.status(500).json({ error: 'Failed to update reservation status' });
  }
});

export default router;
