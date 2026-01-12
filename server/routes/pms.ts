import { Router } from 'express';
import {
  createProperty, getProperties, getProperty, getPropertyBySlug,
  createUnit, getUnit, updateUnitStatus,
  checkAvailability,
  createReservation, getReservation, getReservationByConfirmation,
  searchReservations,
  confirmReservation, checkInGuest, checkOutGuest, cancelReservation
} from '../services/pmsService';
import {
  getUnitCalendar, blockDates, unblockDates, syncReservationToCalendar,
  getPropertyAvailability, getSeasonalRules, createSeasonalRule,
  updateSeasonalRule, deleteSeasonalRule
} from '../services/unitCalendarService';

const router = Router();

// ============ PROPERTY ENDPOINTS ============

router.post('/portals/:slug/properties', async (req, res) => {
  const { slug } = req.params;
  const b = req.body || {};
  
  if (!b.name || !b.propertyType) {
    return res.status(400).json({ error: 'name and propertyType required' });
  }
  
  try {
    const property = await createProperty({
      portalSlug: slug,
      name: b.name,
      code: b.code,
      propertyType: b.propertyType,
      description: b.description,
      tagline: b.tagline,
      addressLine1: b.addressLine1,
      city: b.city,
      province: b.province,
      postalCode: b.postalCode,
      lat: b.lat,
      lon: b.lon,
      contactPhone: b.contactPhone,
      contactEmail: b.contactEmail,
      websiteUrl: b.websiteUrl,
      amenities: b.amenities,
      policies: b.policies,
      baseRateCad: b.baseRateCad,
      cleaningFeeCad: b.cleaningFeeCad
    });
    
    res.json({ property });
  } catch (e: any) {
    console.error('Create property error:', e);
    res.status(400).json({ error: e.message });
  }
});

router.get('/portals/:slug/properties', async (req, res) => {
  const { slug } = req.params;
  const { type, status, q } = req.query;
  
  try {
    const properties = await getProperties(slug, {
      propertyType: type as string,
      status: status as string,
      query: q as string
    });
    
    res.json({ properties, count: properties.length });
  } catch (e: any) {
    console.error('Get properties error:', e);
    res.status(500).json({ error: 'Failed to get properties' });
  }
});

router.get('/portals/:slug/properties/by-slug/:propertySlug', async (req, res) => {
  const { slug, propertySlug } = req.params;
  
  try {
    const result = await getPropertyBySlug(slug, propertySlug);
    if (!result) {
      return res.status(404).json({ error: 'Property not found' });
    }
    res.json(result);
  } catch (e: any) {
    console.error('Get property error:', e);
    res.status(500).json({ error: 'Failed to get property' });
  }
});

router.get('/portals/:slug/properties/:id', async (req, res) => {
  const { slug, id } = req.params;
  
  try {
    const result = await getProperty(slug, id);
    if (!result) {
      return res.status(404).json({ error: 'Property not found' });
    }
    res.json(result);
  } catch (e: any) {
    console.error('Get property error:', e);
    res.status(500).json({ error: 'Failed to get property' });
  }
});

// ============ UNIT ENDPOINTS ============

router.post('/portals/:slug/properties/:propertyId/units', async (req, res) => {
  const { slug, propertyId } = req.params;
  const b = req.body || {};
  
  if (!b.name || !b.unitType) {
    return res.status(400).json({ error: 'name and unitType required' });
  }
  
  try {
    const unit = await createUnit({
      portalSlug: slug,
      propertyId,
      name: b.name,
      code: b.code,
      unitNumber: b.unitNumber,
      unitType: b.unitType,
      description: b.description,
      maxOccupancy: b.maxOccupancy,
      bedrooms: b.bedrooms,
      bathrooms: b.bathrooms,
      amenities: b.amenities,
      baseRateCad: b.baseRateCad,
      weekendRateCad: b.weekendRateCad
    });
    
    res.json({ unit });
  } catch (e: any) {
    console.error('Create unit error:', e);
    res.status(400).json({ error: e.message });
  }
});

router.get('/portals/:slug/units/:id', async (req, res) => {
  const { slug, id } = req.params;
  
  try {
    const result = await getUnit(slug, id);
    if (!result) {
      return res.status(404).json({ error: 'Unit not found' });
    }
    res.json(result);
  } catch (e: any) {
    console.error('Get unit error:', e);
    res.status(500).json({ error: 'Failed to get unit' });
  }
});

router.post('/portals/:slug/units/:id/status', async (req, res) => {
  const { slug, id } = req.params;
  const { status, cleanStatus } = req.body || {};
  
  if (!status) {
    return res.status(400).json({ error: 'status required' });
  }
  
  try {
    const unit = await updateUnitStatus(slug, id, status, cleanStatus);
    res.json({ unit });
  } catch (e: any) {
    console.error('Update status error:', e);
    res.status(400).json({ error: e.message });
  }
});

// ============ AVAILABILITY ============

router.get('/portals/:slug/availability', async (req, res) => {
  const { slug } = req.params;
  const { property, unit, checkIn, checkOut, guests } = req.query;
  
  if (!checkIn || !checkOut) {
    return res.status(400).json({ error: 'checkIn and checkOut dates required' });
  }
  
  try {
    const result = await checkAvailability(slug, {
      propertyId: property as string,
      unitId: unit as string,
      checkInDate: new Date(checkIn as string),
      checkOutDate: new Date(checkOut as string),
      guestCount: guests ? parseInt(guests as string) : undefined
    });
    
    res.json(result);
  } catch (e: any) {
    console.error('Check availability error:', e);
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

// ============ RESERVATION ENDPOINTS ============

router.post('/portals/:slug/reservations', async (req, res) => {
  const { slug } = req.params;
  const b = req.body || {};
  
  if (!b.propertyId || !b.unitId || !b.guestName || !b.checkInDate || !b.checkOutDate) {
    return res.status(400).json({ 
      error: 'propertyId, unitId, guestName, checkInDate, checkOutDate required' 
    });
  }
  
  try {
    const result = await createReservation({
      portalSlug: slug,
      propertyId: b.propertyId,
      unitId: b.unitId,
      cartId: b.cartId,
      tripId: b.tripId,
      guestName: b.guestName,
      guestEmail: b.guestEmail,
      guestPhone: b.guestPhone,
      guestCount: b.guestCount,
      checkInDate: new Date(b.checkInDate),
      checkOutDate: new Date(b.checkOutDate),
      expectedArrivalTime: b.expectedArrivalTime,
      source: b.source,
      sourceReference: b.sourceReference,
      specialRequests: b.specialRequests
    });
    
    res.json(result);
  } catch (e: any) {
    console.error('Create reservation error:', e);
    res.status(400).json({ error: e.message });
  }
});

router.get('/portals/:slug/reservations', async (req, res) => {
  const { slug } = req.params;
  const { property, unit, status, from, to, email, limit } = req.query;
  
  try {
    const reservations = await searchReservations(slug, {
      propertyId: property as string,
      unitId: unit as string,
      status: status as string,
      checkInFrom: from ? new Date(from as string) : undefined,
      checkInTo: to ? new Date(to as string) : undefined,
      guestEmail: email as string,
      limit: limit ? parseInt(limit as string) : undefined
    });
    
    res.json({ reservations, count: reservations.length });
  } catch (e: any) {
    console.error('Search reservations error:', e);
    res.status(500).json({ error: 'Failed to search reservations' });
  }
});

router.get('/portals/:slug/reservations/by-confirmation/:number', async (req, res) => {
  const { slug, number } = req.params;
  
  try {
    const result = await getReservationByConfirmation(slug, number);
    if (!result) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    res.json(result);
  } catch (e: any) {
    console.error('Get reservation error:', e);
    res.status(500).json({ error: 'Failed to get reservation' });
  }
});

router.get('/portals/:slug/reservations/:id', async (req, res) => {
  const { slug, id } = req.params;
  
  try {
    const result = await getReservation(slug, id);
    if (!result) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    res.json(result);
  } catch (e: any) {
    console.error('Get reservation error:', e);
    res.status(500).json({ error: 'Failed to get reservation' });
  }
});

router.post('/portals/:slug/reservations/:id/confirm', async (req, res) => {
  const { slug, id } = req.params;
  try {
    const reservation = await confirmReservation(slug, id);
    res.json({ reservation });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/portals/:slug/reservations/:id/check-in', async (req, res) => {
  const { slug, id } = req.params;
  const { arrivalTime } = req.body || {};
  try {
    const reservation = await checkInGuest(slug, id, arrivalTime);
    res.json({ reservation });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/portals/:slug/reservations/:id/check-out', async (req, res) => {
  const { slug, id } = req.params;
  try {
    const reservation = await checkOutGuest(slug, id);
    res.json({ reservation });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/portals/:slug/reservations/:id/cancel', async (req, res) => {
  const { slug, id } = req.params;
  const { reason } = req.body || {};
  try {
    const reservation = await cancelReservation(slug, id, reason);
    res.json({ reservation });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// ============ CALENDAR ENDPOINTS ============

router.get('/portals/:slug/units/:unitId/calendar', async (req, res) => {
  const { slug, unitId } = req.params;
  const { startDate, endDate } = req.query;
  
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'startDate and endDate required' });
  }
  
  try {
    const calendar = await getUnitCalendar(
      slug,
      unitId,
      new Date(startDate as string),
      new Date(endDate as string)
    );
    res.json({ calendar });
  } catch (e: any) {
    console.error('Get calendar error:', e);
    if (e.message?.includes('not found') || e.message?.includes('access denied')) {
      return res.status(404).json({ error: e.message });
    }
    res.status(500).json({ error: 'Failed to get calendar' });
  }
});

router.post('/portals/:slug/units/:unitId/block', async (req, res) => {
  const { slug, unitId } = req.params;
  const { startDate, endDate, availability, reason, blockedBy } = req.body || {};
  
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'startDate and endDate required' });
  }
  
  try {
    const blocked = await blockDates({
      portalSlug: slug,
      unitId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      availability: availability || 'blocked',
      reason,
      blockedBy
    });
    res.json({ blocked, daysBlocked: blocked.length });
  } catch (e: any) {
    console.error('Block dates error:', e);
    res.status(400).json({ error: e.message });
  }
});

router.post('/portals/:slug/units/:unitId/unblock', async (req, res) => {
  const { slug, unitId } = req.params;
  const { startDate, endDate } = req.body || {};
  
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'startDate and endDate required' });
  }
  
  try {
    const daysUnblocked = await unblockDates(
      slug,
      unitId,
      new Date(startDate),
      new Date(endDate)
    );
    res.json({ daysUnblocked });
  } catch (e: any) {
    console.error('Unblock dates error:', e);
    res.status(400).json({ error: e.message });
  }
});

router.post('/portals/:slug/reservations/:id/sync-calendar', async (req, res) => {
  const { id } = req.params;
  try {
    await syncReservationToCalendar(id);
    res.json({ success: true });
  } catch (e: any) {
    console.error('Sync calendar error:', e);
    res.status(400).json({ error: e.message });
  }
});

router.get('/portals/:slug/properties/:propertyId/calendar', async (req, res) => {
  const { slug, propertyId } = req.params;
  const { startDate, endDate } = req.query;
  
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'startDate and endDate required' });
  }
  
  try {
    const result = await getPropertyAvailability(
      slug,
      propertyId,
      new Date(startDate as string),
      new Date(endDate as string)
    );
    res.json(result);
  } catch (e: any) {
    console.error('Get property availability error:', e);
    res.status(500).json({ error: 'Failed to get property availability' });
  }
});

// ============ SEASONAL RULES ENDPOINTS ============

router.get('/portals/:slug/seasonal-rules', async (req, res) => {
  const { slug } = req.params;
  const { propertyId } = req.query;
  
  try {
    const rules = await getSeasonalRules(slug, propertyId as string | undefined);
    res.json({ rules, count: rules.length });
  } catch (e: any) {
    console.error('Get seasonal rules error:', e);
    res.status(500).json({ error: 'Failed to get seasonal rules' });
  }
});

router.post('/portals/:slug/seasonal-rules', async (req, res) => {
  const { slug } = req.params;
  const b = req.body || {};
  
  if (!b.name || !b.rateType || b.rateValue === undefined) {
    return res.status(400).json({ error: 'name, rateType, and rateValue required' });
  }
  
  try {
    const rule = await createSeasonalRule(slug, {
      propertyId: b.propertyId,
      unitId: b.unitId,
      name: b.name,
      code: b.code,
      startDate: b.startDate,
      endDate: b.endDate,
      startMonth: b.startMonth,
      startDay: b.startDay,
      endMonth: b.endMonth,
      endDay: b.endDay,
      rateType: b.rateType,
      rateValue: b.rateValue,
      minStayNights: b.minStayNights,
      priority: b.priority
    });
    res.json({ rule });
  } catch (e: any) {
    console.error('Create seasonal rule error:', e);
    res.status(400).json({ error: e.message });
  }
});

router.patch('/portals/:slug/seasonal-rules/:ruleId', async (req, res) => {
  const { slug, ruleId } = req.params;
  const b = req.body || {};
  
  try {
    const rule = await updateSeasonalRule(slug, ruleId, b);
    res.json({ rule });
  } catch (e: any) {
    console.error('Update seasonal rule error:', e);
    res.status(400).json({ error: e.message });
  }
});

router.delete('/portals/:slug/seasonal-rules/:ruleId', async (req, res) => {
  const { slug, ruleId } = req.params;
  
  try {
    const deleted = await deleteSeasonalRule(slug, ruleId);
    res.json({ deleted });
  } catch (e: any) {
    console.error('Delete seasonal rule error:', e);
    res.status(400).json({ error: e.message });
  }
});

export default router;
