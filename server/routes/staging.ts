import { Router, Request, Response } from 'express';
import * as stagingStorage from '../storage/stagingStorage';
import type { StagingSearchParams } from '@shared/types/staging';

const router = Router();

// ============================================================================
// SEARCH & DISCOVERY
// ============================================================================

// GET /api/staging/search - Search available properties
router.get('/search', async (req: Request, res: Response) => {
  try {
    const params: StagingSearchParams = {
      checkIn: req.query.checkIn as string,
      checkOut: req.query.checkOut as string,
      vehicleLengthFt: req.query.vehicleLengthFt ? parseInt(req.query.vehicleLengthFt as string) : undefined,
      needsPower: req.query.needsPower === 'true',
      powerAmps: req.query.powerAmps ? parseInt(req.query.powerAmps as string) : undefined,
      needsWater: req.query.needsWater === 'true',
      needsSewer: req.query.needsSewer === 'true',
      needsPullThrough: req.query.needsPullThrough === 'true',
      isHorseFriendly: req.query.isHorseFriendly === 'true',
      acceptsSemi: req.query.acceptsSemi === 'true',
      hasMechanic: req.query.hasMechanic === 'true',
      dogsAllowed: req.query.dogsAllowed === 'true',
      region: req.query.region as string,
      city: req.query.city as string,
      propertyType: req.query.propertyType as any,
      maxNightlyRate: req.query.maxNightlyRate ? parseFloat(req.query.maxNightlyRate as string) : undefined,
      sortBy: req.query.sortBy as any || 'rv_score',
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    const properties = await stagingStorage.searchAvailableProperties(params);
    
    res.json({
      properties,
      total: properties.length,
      filters: params
    });
  } catch (error) {
    console.error('[Staging Search] Error:', error);
    res.status(500).json({ error: 'Failed to search properties' });
  }
});

// GET /api/staging/stats - Overall network statistics
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await stagingStorage.getOverallStats();
    res.json(stats);
  } catch (error) {
    console.error('[Staging Stats] Error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// ============================================================================
// PROPERTIES
// ============================================================================

// GET /api/staging/properties - List all properties
router.get('/properties', async (req: Request, res: Response) => {
  try {
    const filters: stagingStorage.PropertyFilters = {
      status: req.query.status as string,
      propertyType: req.query.propertyType as string,
      region: req.query.region as string,
      city: req.query.city as string,
      isVerified: req.query.isVerified === 'true' ? true : req.query.isVerified === 'false' ? false : undefined,
      hasOnsiteMechanic: req.query.hasOnsiteMechanic === 'true',
      isHorseFriendly: req.query.isHorseFriendly === 'true',
      acceptsSemiTrucks: req.query.acceptsSemiTrucks === 'true',
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    const properties = await stagingStorage.getAllProperties(filters);
    res.json({ properties, total: properties.length });
  } catch (error) {
    console.error('[Staging Properties] Error:', error);
    res.status(500).json({ error: 'Failed to get properties' });
  }
});

// GET /api/staging/properties/:id - Get property details
router.get('/properties/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      // Try by canvas_id
      const property = await stagingStorage.getPropertyByCanvasId(req.params.id);
      if (!property) {
        return res.status(404).json({ error: 'Property not found' });
      }
      return res.json(property);
    }

    const property = await stagingStorage.getPropertyById(id);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    res.json(property);
  } catch (error) {
    console.error('[Staging Property] Error:', error);
    res.status(500).json({ error: 'Failed to get property' });
  }
});

// GET /api/staging/properties/:id/spots - Get spots for property
router.get('/properties/:id/spots', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid property ID' });
    }

    const spots = await stagingStorage.getSpotsForProperty(id);
    res.json({ spots, total: spots.length });
  } catch (error) {
    console.error('[Staging Spots] Error:', error);
    res.status(500).json({ error: 'Failed to get spots' });
  }
});

// GET /api/staging/properties/:id/providers - Get service providers
router.get('/properties/:id/providers', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid property ID' });
    }

    const providers = await stagingStorage.getProvidersForProperty(id);
    res.json({ providers, total: providers.length });
  } catch (error) {
    console.error('[Staging Providers] Error:', error);
    res.status(500).json({ error: 'Failed to get providers' });
  }
});

// GET /api/staging/properties/:id/calendar - Get availability calendar
router.get('/properties/:id/calendar', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid property ID' });
    }

    const startDate = req.query.startDate as string || new Date().toISOString().split('T')[0];
    const endDate = req.query.endDate as string || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const blocks = await stagingStorage.getCalendar(id, startDate, endDate);
    res.json({ blocks, startDate, endDate });
  } catch (error) {
    console.error('[Staging Calendar] Error:', error);
    res.status(500).json({ error: 'Failed to get calendar' });
  }
});

// GET /api/staging/properties/:id/pricing - Get pricing details
router.get('/properties/:id/pricing', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid property ID' });
    }

    const pricing = await stagingStorage.getPricingForProperty(id);
    res.json({ pricing });
  } catch (error) {
    console.error('[Staging Pricing] Error:', error);
    res.status(500).json({ error: 'Failed to get pricing' });
  }
});

// GET /api/staging/properties/:id/reviews - Get reviews (placeholder)
router.get('/properties/:id/reviews', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid property ID' });
    }

    // Reviews table not yet created - return empty for now
    res.json({ reviews: [], total: 0 });
  } catch (error) {
    console.error('[Staging Reviews] Error:', error);
    res.status(500).json({ error: 'Failed to get reviews' });
  }
});

// POST /api/staging/properties/:id/check-availability - Check specific dates
router.post('/properties/:id/check-availability', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid property ID' });
    }

    const { checkIn, checkOut, vehicleLengthFt } = req.body;
    if (!checkIn || !checkOut) {
      return res.status(400).json({ error: 'checkIn and checkOut dates required' });
    }

    const availability = await stagingStorage.checkAvailability(id, checkIn, checkOut, vehicleLengthFt);
    res.json(availability);
  } catch (error) {
    console.error('[Staging Availability] Error:', error);
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

// POST /api/staging/properties/:id/calculate-price - Calculate price for dates
router.post('/properties/:id/calculate-price', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid property ID' });
    }

    const { checkIn, checkOut, spotId, vehicleLengthFt, numAdults, numPets } = req.body;
    if (!checkIn || !checkOut) {
      return res.status(400).json({ error: 'checkIn and checkOut dates required' });
    }

    const pricing = await stagingStorage.calculatePrice(id, checkIn, checkOut, {
      spotId,
      vehicleLengthFt,
      numAdults,
      numPets
    });
    res.json(pricing);
  } catch (error) {
    console.error('[Staging Price Calculation] Error:', error);
    res.status(500).json({ error: 'Failed to calculate price' });
  }
});

// ============================================================================
// SERVICE PROVIDERS
// ============================================================================

// GET /api/staging/providers - Search all providers
router.get('/providers', async (req: Request, res: Response) => {
  try {
    const filters: stagingStorage.ProviderFilters = {
      propertyId: req.query.propertyId ? parseInt(req.query.propertyId as string) : undefined,
      providerType: req.query.providerType as string,
      isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
      available24hr: req.query.available24hr === 'true',
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    const providers = await stagingStorage.searchProviders(filters);
    res.json({ providers, total: providers.length });
  } catch (error) {
    console.error('[Staging Providers Search] Error:', error);
    res.status(500).json({ error: 'Failed to search providers' });
  }
});

// GET /api/staging/providers/:id - Provider details
router.get('/providers/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid provider ID' });
    }

    const provider = await stagingStorage.getProviderById(id);
    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }
    res.json(provider);
  } catch (error) {
    console.error('[Staging Provider] Error:', error);
    res.status(500).json({ error: 'Failed to get provider' });
  }
});

// ============================================================================
// VEHICLE PROFILES (simplified - no auth required for now)
// ============================================================================

// GET /api/staging/vehicles - Get vehicles for host
router.get('/vehicles', async (req: Request, res: Response) => {
  try {
    const hostAccountId = req.query.hostAccountId ? parseInt(req.query.hostAccountId as string) : 0;
    if (!hostAccountId) {
      return res.json({ vehicles: [], total: 0 });
    }

    const vehicles = await stagingStorage.getVehicleProfiles(hostAccountId);
    res.json({ vehicles, total: vehicles.length });
  } catch (error) {
    console.error('[Staging Vehicles] Error:', error);
    res.status(500).json({ error: 'Failed to get vehicles' });
  }
});

// POST /api/staging/vehicles - Add vehicle
router.post('/vehicles', async (req: Request, res: Response) => {
  try {
    const vehicle = await stagingStorage.createVehicleProfile(req.body);
    res.status(201).json(vehicle);
  } catch (error) {
    console.error('[Staging Create Vehicle] Error:', error);
    res.status(500).json({ error: 'Failed to create vehicle' });
  }
});

// PUT /api/staging/vehicles/:id - Update vehicle
router.put('/vehicles/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid vehicle ID' });
    }

    const vehicle = await stagingStorage.updateVehicleProfile(id, req.body);
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    res.json(vehicle);
  } catch (error) {
    console.error('[Staging Update Vehicle] Error:', error);
    res.status(500).json({ error: 'Failed to update vehicle' });
  }
});

// ============================================================================
// BOOKINGS
// ============================================================================

// GET /api/staging/bookings - Get bookings
router.get('/bookings', async (req: Request, res: Response) => {
  try {
    const filters: stagingStorage.BookingFilters = {
      propertyId: req.query.propertyId ? parseInt(req.query.propertyId as string) : undefined,
      status: req.query.status as string,
      guestEmail: req.query.guestEmail as string,
      checkInFrom: req.query.checkInFrom as string,
      checkInTo: req.query.checkInTo as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    const bookings = await stagingStorage.getBookings(filters);
    res.json({ bookings, total: bookings.length });
  } catch (error) {
    console.error('[Staging Bookings] Error:', error);
    res.status(500).json({ error: 'Failed to get bookings' });
  }
});

// GET /api/staging/bookings/:id - Get booking details
router.get('/bookings/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    // Check if it's a booking reference (CC-STG-...) or numeric ID
    if (isNaN(id)) {
      const booking = await stagingStorage.getBookingByRef(req.params.id);
      if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }
      return res.json(booking);
    }

    const booking = await stagingStorage.getBookingById(id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    res.json(booking);
  } catch (error) {
    console.error('[Staging Booking] Error:', error);
    res.status(500).json({ error: 'Failed to get booking' });
  }
});

// POST /api/staging/bookings - Create booking
router.post('/bookings', async (req: Request, res: Response) => {
  try {
    const {
      propertyId,
      spotId,
      guestName,
      guestEmail,
      guestPhone,
      guestType,
      checkInDate,
      checkOutDate,
      vehicleProfileId,
      vehicleDescription,
      vehicleLengthFt,
      vehicleType,
      numHorses,
      numAdults,
      numChildren,
      numPets,
      numVehicles,
      specialRequests
    } = req.body;

    if (!propertyId || !guestName || !checkInDate || !checkOutDate) {
      return res.status(400).json({ error: 'propertyId, guestName, checkInDate, and checkOutDate are required' });
    }

    // Check availability first
    const availability = await stagingStorage.checkAvailability(propertyId, checkInDate, checkOutDate, vehicleLengthFt);
    if (!availability.isAvailable) {
      return res.status(400).json({ error: 'Property not available for selected dates', availability });
    }

    // Calculate pricing
    const pricing = await stagingStorage.calculatePrice(propertyId, checkInDate, checkOutDate, {
      spotId,
      vehicleLengthFt,
      numAdults,
      numPets
    });

    const numNights = Math.ceil((new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) / (1000 * 60 * 60 * 24));

    const booking = await stagingStorage.createBooking({
      propertyId,
      spotId,
      guestType: guestType || 'individual',
      guestName,
      guestEmail,
      guestPhone,
      vehicleProfileId,
      vehicleDescription,
      vehicleLengthFt,
      vehicleType,
      numHorses: numHorses || 0,
      checkInDate,
      checkOutDate,
      numNights,
      numAdults: numAdults || 1,
      numChildren: numChildren || 0,
      numPets: numPets || 0,
      numVehicles: numVehicles || 1,
      nightlyRate: pricing.nightly,
      subtotal: pricing.subtotal,
      totalCost: pricing.total,
      status: 'pending',
      paymentStatus: 'pending',
      specialRequests
    });

    res.status(201).json(booking);
  } catch (error) {
    console.error('[Staging Create Booking] Error:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// PUT /api/staging/bookings/:id - Update booking
router.put('/bookings/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid booking ID' });
    }

    const booking = await stagingStorage.updateBooking(id, req.body);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    res.json(booking);
  } catch (error) {
    console.error('[Staging Update Booking] Error:', error);
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

// POST /api/staging/bookings/:id/cancel - Cancel booking
router.post('/bookings/:id/cancel', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid booking ID' });
    }

    const { reason } = req.body;
    const booking = await stagingStorage.cancelBooking(id, reason);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    res.json(booking);
  } catch (error) {
    console.error('[Staging Cancel Booking] Error:', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

// ============================================================================
// ADMIN ENDPOINTS (for property management)
// ============================================================================

// POST /api/staging/properties - Create property (admin)
router.post('/properties', async (req: Request, res: Response) => {
  try {
    const property = await stagingStorage.createProperty(req.body);
    res.status(201).json(property);
  } catch (error) {
    console.error('[Staging Create Property] Error:', error);
    res.status(500).json({ error: 'Failed to create property' });
  }
});

// PUT /api/staging/properties/:id - Update property (admin)
router.put('/properties/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid property ID' });
    }

    const property = await stagingStorage.updateProperty(id, req.body);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    res.json(property);
  } catch (error) {
    console.error('[Staging Update Property] Error:', error);
    res.status(500).json({ error: 'Failed to update property' });
  }
});

// POST /api/staging/properties/:id/spots - Add spot to property
router.post('/properties/:id/spots', async (req: Request, res: Response) => {
  try {
    const propertyId = parseInt(req.params.id);
    if (isNaN(propertyId)) {
      return res.status(400).json({ error: 'Invalid property ID' });
    }

    const spot = await stagingStorage.createSpot({ ...req.body, propertyId });
    res.status(201).json(spot);
  } catch (error) {
    console.error('[Staging Create Spot] Error:', error);
    res.status(500).json({ error: 'Failed to create spot' });
  }
});

// PUT /api/staging/spots/:id - Update spot
router.put('/spots/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid spot ID' });
    }

    const spot = await stagingStorage.updateSpot(id, req.body);
    if (!spot) {
      return res.status(404).json({ error: 'Spot not found' });
    }
    res.json(spot);
  } catch (error) {
    console.error('[Staging Update Spot] Error:', error);
    res.status(500).json({ error: 'Failed to update spot' });
  }
});

// POST /api/staging/properties/:id/providers - Add service provider
router.post('/properties/:id/providers', async (req: Request, res: Response) => {
  try {
    const propertyId = parseInt(req.params.id);
    if (isNaN(propertyId)) {
      return res.status(400).json({ error: 'Invalid property ID' });
    }

    const provider = await stagingStorage.createProvider({ ...req.body, propertyId });
    res.status(201).json(provider);
  } catch (error) {
    console.error('[Staging Create Provider] Error:', error);
    res.status(500).json({ error: 'Failed to create provider' });
  }
});

// PUT /api/staging/providers/:id - Update provider
router.put('/providers/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid provider ID' });
    }

    const provider = await stagingStorage.updateProvider(id, req.body);
    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }
    res.json(provider);
  } catch (error) {
    console.error('[Staging Update Provider] Error:', error);
    res.status(500).json({ error: 'Failed to update provider' });
  }
});

// POST /api/staging/properties/:id/calendar/block - Add calendar block
router.post('/properties/:id/calendar/block', async (req: Request, res: Response) => {
  try {
    const propertyId = parseInt(req.params.id);
    if (isNaN(propertyId)) {
      return res.status(400).json({ error: 'Invalid property ID' });
    }

    const { startDate, endDate, blockType, spotId, notes } = req.body;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate required' });
    }

    const block = await stagingStorage.createBlock({
      propertyId,
      spotId,
      startDate,
      endDate,
      blockType: blockType || 'blocked',
      notes
    });
    res.status(201).json(block);
  } catch (error) {
    console.error('[Staging Create Block] Error:', error);
    res.status(500).json({ error: 'Failed to create block' });
  }
});

// DELETE /api/staging/calendar/:id - Delete calendar block
router.delete('/calendar/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid block ID' });
    }

    const deleted = await stagingStorage.deleteBlock(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Block not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('[Staging Delete Block] Error:', error);
    res.status(500).json({ error: 'Failed to delete block' });
  }
});

// ============================================================================
// 404 CATCH-ALL (must be last)
// ============================================================================
router.use('*', (_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Staging endpoint not found' });
});

export default router;
