/**
 * V3.3.1 Community Routes
 * Cross-tenant Chamber operations for federated reservations
 * "Bamfield as one resort" - unified search and reservation across all providers
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  FederationContext,
  searchFederatedAvailability,
  hasScope,
  logFederatedAccess,
  getFederatedFacilities,
} from '../services/federationService';
import { createReservation } from '../services/reservationService';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

const router = Router();

// Schema for availability search
const availabilitySearchSchema = z.object({
  communityId: z.string().uuid(),
  startDate: z.string().transform(s => new Date(s)),
  endDate: z.string().transform(s => new Date(s)),
  requirements: z.object({
    boatLengthFt: z.number().optional(),
    vehicleLengthFt: z.number().optional(),
    partySize: z.number().optional(),
    facilityTypes: z.array(z.string()).optional(),
  }).optional(),
});

// Schema for bundle reservation
const bundleReservationSchema = z.object({
  communityId: z.string().uuid(),
  customer: z.object({
    name: z.string().min(1),
    email: z.string().email().optional(),
    phone: z.string().optional(),
  }),
  items: z.array(z.object({
    facilityId: z.string().uuid(),
    offerId: z.string().uuid(),
    startDate: z.string().transform(s => new Date(s)),
    endDate: z.string().transform(s => new Date(s)),
    vesselLengthFt: z.number().optional(),
    vehicleLengthFt: z.number().optional(),
  })),
  notes: z.string().optional(),
});

/**
 * POST /api/community/availability/search
 * Cross-tenant availability search
 */
router.post('/availability/search', async (req: Request, res: Response) => {
  try {
    const parsed = availabilitySearchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
    }
    
    const { communityId, startDate, endDate, requirements } = parsed.data;
    
    // Get actor tenant ID from auth context (for now, use Chamber as default)
    const actorTenantId = (req as any).tenantId || 'ca000000-0000-0000-0000-000000000001';
    const actorIndividualId = (req as any).userId;
    
    const ctx: FederationContext = {
      actorTenantId,
      actorIndividualId,
      communityId,
    };
    
    const results = await searchFederatedAvailability(ctx, startDate, endDate, requirements);
    
    // Build bundle suggestions based on what's available
    const bundleSuggestions: string[] = [];
    if (results.accommodations.length > 0 && results.parking.length > 0) {
      bundleSuggestions.push('Lodge + Parking Bundle Available');
    }
    if (results.moorage.length > 0 && results.parking.length > 0) {
      bundleSuggestions.push('Marina + Parking Bundle Available');
    }
    if (results.accommodations.length > 0 && results.moorage.length > 0) {
      bundleSuggestions.push('Lodge + Marina Bundle Available');
    }
    
    res.json({
      results: {
        accommodations: { items: results.accommodations },
        moorage: { items: results.moorage },
        parking: { items: results.parking },
      },
      bundleSuggestions,
      dateRange: { startDate, endDate },
    });
  } catch (error) {
    console.error('Availability search error:', error);
    res.status(500).json({ error: 'Failed to search availability' });
  }
});

/**
 * POST /api/community/reservations/bundle
 * Create cross-tenant bundle reservation
 */
router.post('/reservations/bundle', async (req: Request, res: Response) => {
  try {
    const parsed = bundleReservationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
    }
    
    const { communityId, customer, items, notes } = parsed.data;
    
    // Get actor tenant ID
    const actorTenantId = (req as any).tenantId || 'ca000000-0000-0000-0000-000000000001';
    const actorIndividualId = (req as any).userId;
    
    const ctx: FederationContext = {
      actorTenantId,
      actorIndividualId,
      communityId,
    };
    
    // Generate bundle ID
    const bundleId = crypto.randomUUID();
    const reservations: any[] = [];
    
    for (const item of items) {
      // Get facility's tenant
      const facilityResult = await db.execute(sql`
        SELECT tenant_id FROM cc_facilities WHERE id = ${item.facilityId}
      `);
      
      if (facilityResult.rows.length === 0) {
        return res.status(400).json({ error: `Facility not found: ${item.facilityId}` });
      }
      
      const providerTenantId = facilityResult.rows[0].tenant_id as string;
      
      // Verify federation scope
      const canBook = await hasScope(ctx, providerTenantId, 'reservation:create');
      if (!canBook) {
        return res.status(403).json({ 
          error: `No reservation permission for facility ${item.facilityId}` 
        });
      }
      
      // Create reservation
      const reservation = await createReservation({
        tenantId: providerTenantId,
        facilityId: item.facilityId,
        offerId: item.offerId,
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        startAt: item.startDate,
        endAt: item.endDate,
        vesselLengthFt: item.vesselLengthFt,
        vehicleLengthFt: item.vehicleLengthFt,
        idempotencyKey: `${bundleId}-${item.facilityId}`,
        source: 'chamber',
      });
      
      // Update bundle_id on reservation
      await db.execute(sql`
        UPDATE cc_reservations SET bundle_id = ${bundleId} WHERE id = ${reservation.reservationId}
      `);
      
      // Log federated access
      await logFederatedAccess(
        ctx,
        providerTenantId,
        'reservation.create',
        'reservation',
        reservation.reservationId
      );
      
      reservations.push({
        facilityId: item.facilityId,
        ...reservation,
      });
    }
    
    res.json({
      bundleId,
      reservations,
      totalItems: reservations.length,
      grandTotal: reservations.reduce((sum, r) => sum + r.grandTotalCents, 0),
      customer,
      notes,
    });
  } catch (error) {
    console.error('Bundle reservation error:', error);
    res.status(500).json({ error: 'Failed to create bundle reservation' });
  }
});

/**
 * GET /api/community/facilities
 * List all federated facilities for a community
 */
router.get('/facilities', async (req: Request, res: Response) => {
  try {
    const communityId = (req.query.communityId as string) || 'c0000000-0000-0000-0000-000000000001';
    const actorTenantId = (req as any).tenantId || 'ca000000-0000-0000-0000-000000000001';
    
    const ctx: FederationContext = {
      actorTenantId,
      communityId,
    };
    
    const facilities = await getFederatedFacilities(ctx);
    
    res.json({ facilities });
  } catch (error) {
    console.error('List facilities error:', error);
    res.status(500).json({ error: 'Failed to list facilities' });
  }
});

export default router;
