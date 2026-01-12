import { Router } from 'express';
import { 
  getLocations, getLocationByCode, getLocationById,
  getLocationTypes, getAuthorities 
} from '../services/locationService';
import {
  getOperators, getOperatorByCode, getOperatorById,
  getAssets, getAssetById, getOperatorRoutes, findOperatorsForRoute
} from '../services/operatorService';
import {
  getSchedules, getActiveScheduleForDate,
  getSailings, getSailingById, getSailingByNumber,
  updateSailingStatus, updatePortCallStatus,
  checkSailingAvailability
} from '../services/sailingService';
import {
  createTransportRequest, getTransportRequest, getTransportRequestByNumber,
  getRequestsForSailing, getRequestsForTrip,
  confirmRequest, checkInRequest, boardRequest, completeRequest, cancelRequest,
  markNoShow, getSailingManifest
} from '../services/transportRequestService';
import {
  createTransportAlert, getActiveAlerts, resolveAlert, acknowledgeAlert,
  getLiveDepartureBoard, checkCapacityAlerts
} from '../services/transportAlertService';
import {
  addTransportToCart,
  issueTransportConfirmation,
  getConfirmationByNumber,
  getConfirmationByQR,
  getConfirmationsForTrip,
  checkInByQR
} from '../services/transportIntegrationService';

const router = Router();

router.get('/portals/:slug/locations', async (req, res) => {
  const { slug } = req.params;
  const { type, authority, capability, q, lat, lon, radius, status } = req.query;
  
  try {
    const result = await getLocations({
      portalSlug: slug,
      locationType: type as string,
      authorityType: authority as string,
      capability: capability as string,
      query: q as string,
      nearLat: lat ? parseFloat(lat as string) : undefined,
      nearLon: lon ? parseFloat(lon as string) : undefined,
      radiusKm: radius ? parseFloat(radius as string) : undefined,
      status: status as string
    });
    
    res.json(result);
  } catch (e: any) {
    console.error('Get locations error:', e);
    res.status(500).json({ error: 'Failed to get locations' });
  }
});

router.get('/portals/:slug/locations/types', async (req, res) => {
  const { slug } = req.params;
  
  try {
    const types = await getLocationTypes(slug);
    res.json({ types });
  } catch (e: any) {
    console.error('Get location types error:', e);
    res.status(500).json({ error: 'Failed to get types' });
  }
});

router.get('/portals/:slug/locations/authorities', async (req, res) => {
  const { slug } = req.params;
  
  try {
    const authorities = await getAuthorities(slug);
    res.json({ authorities });
  } catch (e: any) {
    console.error('Get authorities error:', e);
    res.status(500).json({ error: 'Failed to get authorities' });
  }
});

router.get('/portals/:slug/locations/:code', async (req, res) => {
  const { slug, code } = req.params;
  
  try {
    const location = await getLocationByCode(slug, code);
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }
    res.json({ location });
  } catch (e: any) {
    console.error('Get location error:', e);
    res.status(500).json({ error: 'Failed to get location' });
  }
});

router.get('/locations/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const location = await getLocationById(id);
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }
    res.json({ location });
  } catch (e: any) {
    console.error('Get location error:', e);
    res.status(500).json({ error: 'Failed to get location' });
  }
});

// ============ OPERATOR ENDPOINTS ============

router.get('/portals/:slug/operators', async (req, res) => {
  const { slug } = req.params;
  const { type, status, q } = req.query;
  
  try {
    const result = await getOperators({
      portalSlug: slug,
      operatorType: type as string,
      status: status as string,
      query: q as string
    });
    
    res.json(result);
  } catch (e: any) {
    console.error('Get operators error:', e);
    res.status(500).json({ error: 'Failed to get operators' });
  }
});

router.get('/portals/:slug/operators/:code', async (req, res) => {
  const { slug, code } = req.params;
  
  try {
    const operator = await getOperatorByCode(slug, code);
    if (!operator) {
      return res.status(404).json({ error: 'Operator not found' });
    }
    res.json({ operator });
  } catch (e: any) {
    console.error('Get operator error:', e);
    res.status(500).json({ error: 'Failed to get operator' });
  }
});

router.get('/operators/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const operator = await getOperatorById(id);
    if (!operator) {
      return res.status(404).json({ error: 'Operator not found' });
    }
    res.json({ operator });
  } catch (e: any) {
    console.error('Get operator error:', e);
    res.status(500).json({ error: 'Failed to get operator' });
  }
});

router.get('/operators/:id/assets', async (req, res) => {
  const { id } = req.params;
  
  try {
    const assets = await getAssets(id);
    res.json({ assets });
  } catch (e: any) {
    console.error('Get assets error:', e);
    res.status(500).json({ error: 'Failed to get assets' });
  }
});

router.get('/operators/:id/routes', async (req, res) => {
  const { id } = req.params;
  
  try {
    const routes = await getOperatorRoutes(id);
    res.json({ routes });
  } catch (e: any) {
    console.error('Get routes error:', e);
    res.status(500).json({ error: 'Failed to get routes' });
  }
});

router.get('/assets/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const asset = await getAssetById(id);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    res.json({ asset });
  } catch (e: any) {
    console.error('Get asset error:', e);
    res.status(500).json({ error: 'Failed to get asset' });
  }
});

router.get('/portals/:slug/route-options', async (req, res) => {
  const { slug } = req.params;
  const { from, to } = req.query;
  
  if (!from || !to) {
    return res.status(400).json({ error: 'from and to location codes required' });
  }
  
  try {
    const operators = await findOperatorsForRoute(slug, from as string, to as string);
    res.json({ 
      from, 
      to, 
      operators,
      count: operators.length 
    });
  } catch (e: any) {
    console.error('Find route options error:', e);
    res.status(500).json({ error: 'Failed to find route options' });
  }
});

// ============ SCHEDULE ENDPOINTS ============

router.get('/operators/:id/schedules', async (req, res) => {
  const { id } = req.params;
  
  try {
    const schedules = await getSchedules(id);
    res.json({ schedules });
  } catch (e: any) {
    console.error('Get schedules error:', e);
    res.status(500).json({ error: 'Failed to get schedules' });
  }
});

router.get('/operators/:id/schedules/for-date', async (req, res) => {
  const { id } = req.params;
  const { date } = req.query;
  
  try {
    const targetDate = date ? new Date(date as string) : new Date();
    const schedules = await getActiveScheduleForDate(id, targetDate);
    res.json({ date: targetDate.toISOString().split('T')[0], schedules });
  } catch (e: any) {
    console.error('Get schedules for date error:', e);
    res.status(500).json({ error: 'Failed to get schedules' });
  }
});

// ============ SAILING ENDPOINTS ============

router.get('/sailings', async (req, res) => {
  const { operator, from, to, origin, destination, status, limit } = req.query;
  
  try {
    const result = await getSailings({
      operatorId: operator as string,
      fromDate: from ? new Date(from as string) : undefined,
      toDate: to ? new Date(to as string) : undefined,
      originLocationId: origin as string,
      destinationLocationId: destination as string,
      status: status as string,
      limit: limit ? parseInt(limit as string) : undefined
    });
    
    res.json(result);
  } catch (e: any) {
    console.error('Get sailings error:', e);
    res.status(500).json({ error: 'Failed to get sailings' });
  }
});

router.get('/portals/:slug/sailings', async (req, res) => {
  const { slug } = req.params;
  const { operator, from, to, limit } = req.query;
  
  try {
    const result = await getSailings({
      portalSlug: slug,
      operatorCode: operator as string,
      fromDate: from ? new Date(from as string) : new Date(),
      toDate: to ? new Date(to as string) : undefined,
      limit: limit ? parseInt(limit as string) : 20
    });
    
    res.json(result);
  } catch (e: any) {
    console.error('Get portal sailings error:', e);
    res.status(500).json({ error: 'Failed to get sailings' });
  }
});

router.get('/sailings/by-number/:number', async (req, res) => {
  const { number } = req.params;
  
  try {
    const result = await getSailingByNumber(number);
    if (!result) {
      return res.status(404).json({ error: 'Sailing not found' });
    }
    res.json(result);
  } catch (e: any) {
    console.error('Get sailing error:', e);
    res.status(500).json({ error: 'Failed to get sailing' });
  }
});

router.get('/sailings/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await getSailingById(id);
    if (!result) {
      return res.status(404).json({ error: 'Sailing not found' });
    }
    res.json(result);
  } catch (e: any) {
    console.error('Get sailing error:', e);
    res.status(500).json({ error: 'Failed to get sailing' });
  }
});

router.post('/sailings/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, delayMinutes, reason } = req.body;
  
  if (!status) {
    return res.status(400).json({ error: 'status required' });
  }
  
  try {
    const updated = await updateSailingStatus(id, status, { delayMinutes, reason });
    res.json({ sailing: updated });
  } catch (e: any) {
    console.error('Update sailing status error:', e);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

router.post('/sailings/:id/port-calls/:callId/status', async (req, res) => {
  const { callId } = req.params;
  const { status, operations } = req.body;
  
  if (!status) {
    return res.status(400).json({ error: 'status required' });
  }
  
  try {
    const updated = await updatePortCallStatus(callId, status, operations);
    res.json({ portCall: updated });
  } catch (e: any) {
    console.error('Update port call status error:', e);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

router.get('/sailings/:id/availability', async (req, res) => {
  const { id } = req.params;
  const { passengers, freight, kayaks } = req.query;
  
  try {
    const result = await checkSailingAvailability(id, {
      passengers: passengers ? parseInt(passengers as string) : undefined,
      freightLbs: freight ? parseInt(freight as string) : undefined,
      kayaks: kayaks ? parseInt(kayaks as string) : undefined
    });
    res.json(result);
  } catch (e: any) {
    console.error('Check availability error:', e);
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

// ============ TRANSPORT REQUEST ROUTES ============

router.post('/requests', async (req, res) => {
  const b = req.body || {};
  
  if (!b.contactName || !b.requestedDate) {
    return res.status(400).json({ error: 'contactName and requestedDate required' });
  }
  
  try {
    const result = await createTransportRequest({
      portalSlug: b.portalSlug,
      operatorId: b.operatorId,
      sailingId: b.sailingId,
      cartId: b.cartId,
      cartItemId: b.cartItemId,
      tripId: b.tripId,
      requestType: b.requestType || 'scheduled',
      originLocationId: b.originLocationId,
      destinationLocationId: b.destinationLocationId,
      requestedDate: new Date(b.requestedDate),
      requestedTime: b.requestedTime,
      flexibleWindowMinutes: b.flexibleWindowMinutes,
      passengerCount: b.passengerCount,
      passengerNames: b.passengerNames,
      freightDescription: b.freightDescription,
      freightWeightLbs: b.freightWeightLbs,
      freightPieces: b.freightPieces,
      freightSpecialHandling: b.freightSpecialHandling,
      kayakCount: b.kayakCount,
      bikeCount: b.bikeCount,
      contactName: b.contactName,
      contactPhone: b.contactPhone,
      contactEmail: b.contactEmail,
      needs: b.needs,
      specialRequests: b.specialRequests
    });
    
    res.json(result);
  } catch (e: any) {
    console.error('Create transport request error:', e);
    res.status(400).json({ error: e.message });
  }
});

router.get('/requests/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await getTransportRequest(id);
    if (!result) {
      return res.status(404).json({ error: 'Request not found' });
    }
    res.json(result);
  } catch (e: any) {
    console.error('Get request error:', e);
    res.status(500).json({ error: 'Failed to get request' });
  }
});

router.get('/requests/by-number/:number', async (req, res) => {
  const { number } = req.params;
  
  try {
    const result = await getTransportRequestByNumber(number);
    if (!result) {
      return res.status(404).json({ error: 'Request not found' });
    }
    res.json(result);
  } catch (e: any) {
    console.error('Get request error:', e);
    res.status(500).json({ error: 'Failed to get request' });
  }
});

router.get('/sailings/:id/requests', async (req, res) => {
  const { id } = req.params;
  
  try {
    const requests = await getRequestsForSailing(id);
    res.json({ requests, count: requests.length });
  } catch (e: any) {
    console.error('Get sailing requests error:', e);
    res.status(500).json({ error: 'Failed to get requests' });
  }
});

router.get('/sailings/:id/manifest', async (req, res) => {
  const { id } = req.params;
  
  try {
    const manifest = await getSailingManifest(id);
    res.json(manifest);
  } catch (e: any) {
    console.error('Get manifest error:', e);
    res.status(500).json({ error: 'Failed to get manifest' });
  }
});

router.get('/trips/:tripId/requests', async (req, res) => {
  const { tripId } = req.params;
  
  try {
    const requests = await getRequestsForTrip(tripId);
    res.json({ requests });
  } catch (e: any) {
    console.error('Get trip requests error:', e);
    res.status(500).json({ error: 'Failed to get requests' });
  }
});

router.post('/requests/:id/confirm', async (req, res) => {
  const { id } = req.params;
  const { confirmedBy } = req.body || {};
  
  try {
    const updated = await confirmRequest(id, confirmedBy);
    res.json({ request: updated });
  } catch (e: any) {
    console.error('Confirm request error:', e);
    res.status(400).json({ error: e.message });
  }
});

router.post('/requests/:id/check-in', async (req, res) => {
  const { id } = req.params;
  
  try {
    const updated = await checkInRequest(id);
    res.json({ request: updated });
  } catch (e: any) {
    console.error('Check-in request error:', e);
    res.status(400).json({ error: e.message });
  }
});

router.post('/requests/:id/board', async (req, res) => {
  const { id } = req.params;
  
  try {
    const updated = await boardRequest(id);
    res.json({ request: updated });
  } catch (e: any) {
    console.error('Board request error:', e);
    res.status(400).json({ error: e.message });
  }
});

router.post('/requests/:id/complete', async (req, res) => {
  const { id } = req.params;
  
  try {
    const updated = await completeRequest(id);
    res.json({ request: updated });
  } catch (e: any) {
    console.error('Complete request error:', e);
    res.status(400).json({ error: e.message });
  }
});

router.post('/requests/:id/cancel', async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body || {};
  
  try {
    const updated = await cancelRequest(id, reason);
    res.json({ request: updated });
  } catch (e: any) {
    console.error('Cancel request error:', e);
    res.status(400).json({ error: e.message });
  }
});

router.post('/requests/:id/no-show', async (req, res) => {
  const { id } = req.params;
  
  try {
    const updated = await markNoShow(id);
    res.json({ request: updated });
  } catch (e: any) {
    console.error('No-show request error:', e);
    res.status(400).json({ error: e.message });
  }
});

// ============ ALERT ENDPOINTS ============

router.post('/alerts', async (req, res) => {
  const b = req.body || {};
  
  if (!b.operatorId || !b.alertType || !b.title || !b.message) {
    return res.status(400).json({ error: 'operatorId, alertType, title, message required' });
  }
  
  try {
    const alert = await createTransportAlert({
      portalSlug: b.portalSlug,
      operatorId: b.operatorId,
      sailingId: b.sailingId,
      locationId: b.locationId,
      alertType: b.alertType,
      severity: b.severity || 'info',
      title: b.title,
      message: b.message,
      affectedDate: b.affectedDate ? new Date(b.affectedDate) : undefined,
      affectedSailings: b.affectedSailings,
      delayMinutes: b.delayMinutes,
      actionRequired: b.actionRequired,
      actionUrl: b.actionUrl,
      actionLabel: b.actionLabel,
      source: b.source,
      sourceRef: b.sourceRef,
      expiresAt: b.expiresAt ? new Date(b.expiresAt) : undefined
    });
    
    res.json({ alert });
  } catch (e: any) {
    console.error('Create alert error:', e);
    res.status(500).json({ error: 'Failed to create alert' });
  }
});

router.get('/alerts', async (req, res) => {
  const { portal, operator, sailing, severity } = req.query;
  
  try {
    const alerts = await getActiveAlerts({
      portalSlug: portal as string,
      operatorId: operator as string,
      sailingId: sailing as string,
      severity: severity as string
    });
    
    res.json({ alerts, count: alerts.length });
  } catch (e: any) {
    console.error('Get alerts error:', e);
    res.status(500).json({ error: 'Failed to get alerts' });
  }
});

router.get('/portals/:slug/alerts', async (req, res) => {
  const { slug } = req.params;
  const { severity } = req.query;
  
  try {
    const alerts = await getActiveAlerts({
      portalSlug: slug,
      severity: severity as string
    });
    
    res.json({ alerts, count: alerts.length });
  } catch (e: any) {
    console.error('Get portal alerts error:', e);
    res.status(500).json({ error: 'Failed to get alerts' });
  }
});

router.post('/alerts/:id/resolve', async (req, res) => {
  const { id } = req.params;
  
  try {
    const updated = await resolveAlert(id);
    res.json({ alert: updated });
  } catch (e: any) {
    console.error('Resolve alert error:', e);
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
});

router.post('/alerts/:id/acknowledge', async (req, res) => {
  const { id } = req.params;
  
  try {
    const updated = await acknowledgeAlert(id);
    res.json({ alert: updated });
  } catch (e: any) {
    console.error('Acknowledge alert error:', e);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

// ============ LIVE DEPARTURE BOARD ============

router.get('/portals/:slug/departures', async (req, res) => {
  const { slug } = req.params;
  const { date, limit } = req.query;
  
  try {
    const board = await getLiveDepartureBoard(slug, {
      date: date ? new Date(date as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined
    });
    
    res.json(board);
  } catch (e: any) {
    console.error('Get departure board error:', e);
    res.status(500).json({ error: 'Failed to get departure board' });
  }
});

router.post('/sailings/:id/check-capacity', async (req, res) => {
  const { id } = req.params;
  
  try {
    const alert = await checkCapacityAlerts(id);
    res.json({ 
      alert,
      message: alert ? 'Capacity alert created' : 'No alert needed'
    });
  } catch (e: any) {
    console.error('Check capacity error:', e);
    res.status(500).json({ error: 'Failed to check capacity' });
  }
});

// ============ CART INTEGRATION ENDPOINTS ============

router.post('/carts/:cartId/transport', async (req, res) => {
  const { cartId } = req.params;
  const b = req.body || {};
  
  if (!b.portalSlug) {
    return res.status(400).json({ error: 'portalSlug required' });
  }
  
  if (!b.sailingId && !b.operatorCode) {
    return res.status(400).json({ error: 'Either sailingId or operatorCode required' });
  }
  
  try {
    const result = await addTransportToCart({
      cartId,
      portalSlug: b.portalSlug,
      sailingId: b.sailingId,
      operatorCode: b.operatorCode,
      originCode: b.originCode,
      destinationCode: b.destinationCode,
      requestedDate: b.requestedDate ? new Date(b.requestedDate) : undefined,
      requestedTime: b.requestedTime,
      passengerCount: b.passengerCount,
      passengerNames: b.passengerNames,
      kayakCount: b.kayakCount,
      bikeCount: b.bikeCount,
      freightDescription: b.freightDescription,
      freightWeightLbs: b.freightWeightLbs,
      contactName: b.contactName,
      contactPhone: b.contactPhone,
      contactEmail: b.contactEmail,
      specialRequests: b.specialRequests
    });
    
    res.json(result);
  } catch (e: any) {
    console.error('Add transport to cart error:', e);
    res.status(400).json({ error: e.message });
  }
});

// ============ CONFIRMATION ENDPOINTS ============

router.post('/requests/:id/issue-confirmation', async (req, res) => {
  const { id } = req.params;
  const { reservationId, tripId } = req.body || {};
  
  try {
    const confirmation = await issueTransportConfirmation(id, { reservationId, tripId });
    res.json({ confirmation });
  } catch (e: any) {
    console.error('Issue confirmation error:', e);
    res.status(400).json({ error: e.message });
  }
});

router.get('/confirmations/:number', async (req, res) => {
  const { number } = req.params;
  
  try {
    const confirmation = await getConfirmationByNumber(number);
    if (!confirmation) {
      return res.status(404).json({ error: 'Confirmation not found' });
    }
    res.json({ confirmation });
  } catch (e: any) {
    console.error('Get confirmation error:', e);
    res.status(500).json({ error: 'Failed to get confirmation' });
  }
});

router.get('/confirmations/qr/:token', async (req, res) => {
  const { token } = req.params;
  
  try {
    const confirmation = await getConfirmationByQR(token);
    if (!confirmation) {
      return res.status(404).json({ error: 'Confirmation not found' });
    }
    res.json({ confirmation });
  } catch (e: any) {
    console.error('Get confirmation error:', e);
    res.status(500).json({ error: 'Failed to get confirmation' });
  }
});

router.get('/trips/:tripId/confirmations', async (req, res) => {
  const { tripId } = req.params;
  
  try {
    const confirmations = await getConfirmationsForTrip(tripId);
    res.json({ confirmations });
  } catch (e: any) {
    console.error('Get trip confirmations error:', e);
    res.status(500).json({ error: 'Failed to get confirmations' });
  }
});

router.post('/check-in/qr', async (req, res) => {
  const { token } = req.body || {};
  
  if (!token) {
    return res.status(400).json({ error: 'token required' });
  }
  
  try {
    const result = await checkInByQR(token);
    res.json(result);
  } catch (e: any) {
    console.error('QR check-in error:', e);
    res.status(400).json({ error: e.message });
  }
});

export default router;
