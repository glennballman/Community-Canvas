import { Router } from 'express';
import {
  getAuthorities, getAuthorityByCode, getAuthorityById,
  getPermitTypes, getPermitTypeByCode, calculatePermitFee,
  getRequiredPermits
} from '../services/authorityService';
import {
  createPermit, getPermit, getPermitByNumber, getPermitByQR,
  searchPermits, getPermitsForTrip,
  submitPermit, approvePermit, issuePermit, activatePermit,
  cancelPermit, rejectPermit
} from '../services/permitService';
import {
  analyzeTripPermitRequirements,
  createTripPermitRequirements,
  getTripPermitSummary,
  obtainPermitForTrip,
  waiveTripPermit
} from '../services/tripPermitService';
import {
  createTerritoryNotice, acknowledgeNotice, getNotice as getTerritoryNotice, getNoticeByNumber,
  getNoticesForTrip, searchNotices,
  getCulturalSites, getCulturalSite, getTerritoryAcknowledgment,
  activateNotice, completeNotice, cancelNotice
} from '../services/territoryNoticeService';

const router = Router();

// ============ AUTHORITY ENDPOINTS ============

// GET /api/permits/portals/:slug/authorities - List authorities
router.get('/portals/:slug/authorities', async (req, res) => {
  const { slug } = req.params;
  const { type, status, q } = req.query;
  
  try {
    const authorities = await getAuthorities(slug, {
      authorityType: type as string,
      status: status as string,
      query: q as string
    });
    
    res.json({ authorities, count: authorities.length });
  } catch (e: any) {
    console.error('Get authorities error:', e);
    res.status(500).json({ error: 'Failed to get authorities' });
  }
});

// GET /api/permits/portals/:slug/authorities/:code - Get authority with permit types
router.get('/portals/:slug/authorities/:code', async (req, res) => {
  const { slug, code } = req.params;
  
  try {
    const result = await getAuthorityByCode(slug, code);
    if (!result) {
      return res.status(404).json({ error: 'Authority not found' });
    }
    res.json(result);
  } catch (e: any) {
    console.error('Get authority error:', e);
    res.status(500).json({ error: 'Failed to get authority' });
  }
});

// ============ PERMIT TYPE ENDPOINTS ============

// GET /api/permits/portals/:slug/types - List permit types
router.get('/portals/:slug/types', async (req, res) => {
  const { slug } = req.params;
  const { authority, category } = req.query;
  
  try {
    const permitTypes = await getPermitTypes(slug, {
      authorityCode: authority as string,
      category: category as string
    });
    
    res.json({ permitTypes, count: permitTypes.length });
  } catch (e: any) {
    console.error('Get permit types error:', e);
    res.status(500).json({ error: 'Failed to get permit types' });
  }
});

// GET /api/permits/portals/:slug/types/:permitTypeId/calculate - Calculate permit fee
// Note: This route must be before /:authorityCode/:permitCode to avoid matching "calculate" as permitCode
router.get('/portals/:slug/types/:permitTypeId/calculate', async (req, res) => {
  const { permitTypeId } = req.params;
  const { persons, days, nights } = req.query;
  
  try {
    const result = await calculatePermitFee(permitTypeId, {
      persons: persons ? parseInt(persons as string) : undefined,
      days: days ? parseInt(days as string) : undefined,
      nights: nights ? parseInt(nights as string) : undefined
    });
    
    res.json(result);
  } catch (e: any) {
    console.error('Calculate permit fee error:', e);
    res.status(500).json({ error: 'Failed to calculate permit fee' });
  }
});

// GET /api/permits/portals/:slug/types/:authorityCode/:permitCode - Get specific permit type
router.get('/portals/:slug/types/:authorityCode/:permitCode', async (req, res) => {
  const { slug, authorityCode, permitCode } = req.params;
  
  try {
    const result = await getPermitTypeByCode(slug, authorityCode, permitCode);
    if (!result) {
      return res.status(404).json({ error: 'Permit type not found' });
    }
    res.json(result);
  } catch (e: any) {
    console.error('Get permit type error:', e);
    res.status(500).json({ error: 'Failed to get permit type' });
  }
});

// ============ LOCATION PERMIT REQUIREMENTS ============

// GET /api/permits/portals/:slug/locations/:locationId/required - Get required permits for location
router.get('/portals/:slug/locations/:locationId/required', async (req, res) => {
  const { slug, locationId } = req.params;
  
  try {
    const result = await getRequiredPermits(slug, locationId);
    if (!result.location) {
      return res.status(404).json({ error: 'Location not found' });
    }
    res.json(result);
  } catch (e: any) {
    console.error('Get required permits error:', e);
    res.status(500).json({ error: 'Failed to get required permits' });
  }
});

// ============ VISITOR PERMIT ENDPOINTS ============

// POST /api/permits/portals/:slug/permits - Create permit
router.post('/portals/:slug/permits', async (req, res) => {
  const { slug } = req.params;
  const b = req.body || {};
  
  if (!b.permitTypeId || !b.applicantName || !b.validFrom || !b.validTo) {
    return res.status(400).json({ 
      error: 'permitTypeId, applicantName, validFrom, validTo required' 
    });
  }
  
  try {
    const result = await createPermit({
      portalSlug: slug,
      permitTypeId: b.permitTypeId,
      cartId: b.cartId,
      tripId: b.tripId,
      applicantName: b.applicantName,
      applicantEmail: b.applicantEmail,
      applicantPhone: b.applicantPhone,
      applicantAddress: b.applicantAddress,
      partySize: b.partySize,
      partyMembers: b.partyMembers,
      validFrom: new Date(b.validFrom),
      validTo: new Date(b.validTo),
      locationId: b.locationId,
      activityDescription: b.activityDescription,
      entryPoint: b.entryPoint,
      exitPoint: b.exitPoint,
      vesselName: b.vesselName,
      vesselRegistration: b.vesselRegistration,
      vesselLengthFt: b.vesselLengthFt,
      applicantNotes: b.applicantNotes
    });
    
    res.json(result);
  } catch (e: any) {
    console.error('Create permit error:', e);
    res.status(400).json({ error: e.message });
  }
});

// GET /api/permits/portals/:slug/permits - Search permits
router.get('/portals/:slug/permits', async (req, res) => {
  const { slug } = req.params;
  const { authority, type, status, email, validOn, limit } = req.query;
  
  try {
    const permits = await searchPermits(slug, {
      authorityId: authority as string,
      permitTypeId: type as string,
      status: status as string,
      applicantEmail: email as string,
      validOn: validOn ? new Date(validOn as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined
    });
    
    res.json({ permits, count: permits.length });
  } catch (e: any) {
    console.error('Search permits error:', e);
    res.status(500).json({ error: 'Failed to search permits' });
  }
});

// GET /api/permits/portals/:slug/permits/by-number/:number - Get by number
// Note: This route must be before /:id to avoid matching "by-number" as id
router.get('/portals/:slug/permits/by-number/:number', async (req, res) => {
  const { slug, number } = req.params;
  
  try {
    const result = await getPermitByNumber(slug, number);
    if (!result) {
      return res.status(404).json({ error: 'Permit not found' });
    }
    res.json(result);
  } catch (e: any) {
    console.error('Get permit error:', e);
    res.status(500).json({ error: 'Failed to get permit' });
  }
});

// GET /api/permits/portals/:slug/permits/verify/:qrToken - Verify by QR
router.get('/portals/:slug/permits/verify/:qrToken', async (req, res) => {
  const { slug, qrToken } = req.params;
  
  try {
    const result = await getPermitByQR(slug, qrToken);
    if (!result) {
      return res.status(404).json({ error: 'Permit not found' });
    }
    res.json(result);
  } catch (e: any) {
    console.error('Verify permit error:', e);
    res.status(500).json({ error: 'Failed to verify permit' });
  }
});

// GET /api/permits/portals/:slug/permits/:id - Get permit
router.get('/portals/:slug/permits/:id', async (req, res) => {
  const { slug, id } = req.params;
  
  try {
    const result = await getPermit(slug, id);
    if (!result) {
      return res.status(404).json({ error: 'Permit not found' });
    }
    res.json(result);
  } catch (e: any) {
    console.error('Get permit error:', e);
    res.status(500).json({ error: 'Failed to get permit' });
  }
});

// GET /api/permits/portals/:slug/trips/:tripId/permits - Get permits for trip
router.get('/portals/:slug/trips/:tripId/permits', async (req, res) => {
  const { slug, tripId } = req.params;
  
  try {
    const permits = await getPermitsForTrip(slug, tripId);
    res.json({ permits, count: permits.length });
  } catch (e: any) {
    console.error('Get trip permits error:', e);
    res.status(500).json({ error: 'Failed to get trip permits' });
  }
});

// ============ PERMIT STATUS TRANSITIONS ============

// POST /api/permits/portals/:slug/permits/:id/submit
router.post('/portals/:slug/permits/:id/submit', async (req, res) => {
  const { slug, id } = req.params;
  
  try {
    const result = await submitPermit(slug, id);
    res.json(result);
  } catch (e: any) {
    console.error('Submit permit error:', e);
    res.status(400).json({ error: e.message });
  }
});

// POST /api/permits/portals/:slug/permits/:id/approve
router.post('/portals/:slug/permits/:id/approve', async (req, res) => {
  const { slug, id } = req.params;
  const { approvedBy, conditions } = req.body || {};
  
  if (!approvedBy) {
    return res.status(400).json({ error: 'approvedBy required' });
  }
  
  try {
    const result = await approvePermit(slug, id, approvedBy, conditions);
    res.json(result);
  } catch (e: any) {
    console.error('Approve permit error:', e);
    res.status(400).json({ error: e.message });
  }
});

// POST /api/permits/portals/:slug/permits/:id/issue
router.post('/portals/:slug/permits/:id/issue', async (req, res) => {
  const { slug, id } = req.params;
  const { paymentReference } = req.body || {};
  
  try {
    const result = await issuePermit(slug, id, paymentReference);
    res.json(result);
  } catch (e: any) {
    console.error('Issue permit error:', e);
    res.status(400).json({ error: e.message });
  }
});

// POST /api/permits/portals/:slug/permits/:id/activate
router.post('/portals/:slug/permits/:id/activate', async (req, res) => {
  const { slug, id } = req.params;
  
  try {
    const result = await activatePermit(slug, id);
    res.json(result);
  } catch (e: any) {
    console.error('Activate permit error:', e);
    res.status(400).json({ error: e.message });
  }
});

// POST /api/permits/portals/:slug/permits/:id/cancel
router.post('/portals/:slug/permits/:id/cancel', async (req, res) => {
  const { slug, id } = req.params;
  const { reason } = req.body || {};
  
  try {
    const result = await cancelPermit(slug, id, reason);
    res.json(result);
  } catch (e: any) {
    console.error('Cancel permit error:', e);
    res.status(400).json({ error: e.message });
  }
});

// POST /api/permits/portals/:slug/permits/:id/reject
router.post('/portals/:slug/permits/:id/reject', async (req, res) => {
  const { slug, id } = req.params;
  const { reason, rejectedBy } = req.body || {};
  
  if (!reason || !rejectedBy) {
    return res.status(400).json({ error: 'reason and rejectedBy required' });
  }
  
  try {
    const result = await rejectPermit(slug, id, reason, rejectedBy);
    res.json(result);
  } catch (e: any) {
    console.error('Reject permit error:', e);
    res.status(400).json({ error: e.message });
  }
});

// ============ TRIP PERMIT ENDPOINTS ============

// GET /api/permits/portals/:slug/trips/:tripId/requirements - Analyze permit requirements
router.get('/portals/:slug/trips/:tripId/requirements', async (req, res) => {
  const { slug, tripId } = req.params;
  
  try {
    const requirements = await analyzeTripPermitRequirements(slug, tripId);
    res.json({
      tripId,
      requirements,
      count: requirements.length,
      totalEstimatedFees: requirements.reduce((sum, r) => sum + r.estimatedFee, 0)
    });
  } catch (e: any) {
    console.error('Analyze trip requirements error:', e);
    res.status(500).json({ error: 'Failed to analyze permit requirements' });
  }
});

// POST /api/permits/portals/:slug/trips/:tripId/requirements - Create trip permit records
router.post('/portals/:slug/trips/:tripId/requirements', async (req, res) => {
  const { slug, tripId } = req.params;
  
  try {
    const created = await createTripPermitRequirements(slug, tripId);
    res.json({
      tripId,
      created,
      count: created.length
    });
  } catch (e: any) {
    console.error('Create trip requirements error:', e);
    res.status(500).json({ error: 'Failed to create permit requirements' });
  }
});

// GET /api/permits/portals/:slug/trips/:tripId/summary - Get trip permit summary
router.get('/portals/:slug/trips/:tripId/summary', async (req, res) => {
  const { slug, tripId } = req.params;
  
  try {
    const summary = await getTripPermitSummary(slug, tripId);
    if (!summary) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    res.json(summary);
  } catch (e: any) {
    console.error('Get trip permit summary error:', e);
    res.status(500).json({ error: 'Failed to get permit summary' });
  }
});

// POST /api/permits/portals/:slug/trips/:tripId/obtain - Obtain permit for trip
router.post('/portals/:slug/trips/:tripId/obtain', async (req, res) => {
  const { slug, tripId } = req.params;
  const { permitTypeId, applicant, validFrom, validTo } = req.body;
  
  if (!permitTypeId || !applicant?.name || !validFrom || !validTo) {
    return res.status(400).json({ 
      error: 'permitTypeId, applicant.name, validFrom, validTo required' 
    });
  }
  
  try {
    const result = await obtainPermitForTrip(
      slug,
      tripId,
      permitTypeId,
      applicant,
      {
        validFrom: new Date(validFrom),
        validTo: new Date(validTo)
      }
    );
    res.json(result);
  } catch (e: any) {
    console.error('Obtain permit for trip error:', e);
    res.status(400).json({ error: e.message });
  }
});

// POST /api/permits/portals/:slug/trip-permits/:id/waive - Waive trip permit requirement
router.post('/portals/:slug/trip-permits/:id/waive', async (req, res) => {
  const { slug, id } = req.params;
  const { reason } = req.body || {};
  
  if (!reason) {
    return res.status(400).json({ error: 'reason required' });
  }
  
  try {
    const result = await waiveTripPermit(slug, id, reason);
    res.json(result);
  } catch (e: any) {
    console.error('Waive trip permit error:', e);
    res.status(400).json({ error: e.message });
  }
});

// ============ TERRITORY NOTICE ENDPOINTS ============

// POST /api/permits/portals/:slug/territory-notices - Create notice
router.post('/portals/:slug/territory-notices', async (req, res) => {
  const { slug } = req.params;
  const b = req.body || {};
  
  if (!b.authorityCode || !b.visitorName || !b.visitPurpose || !b.entryDate) {
    return res.status(400).json({ 
      error: 'authorityCode, visitorName, visitPurpose, entryDate required' 
    });
  }
  
  try {
    const result = await createTerritoryNotice({
      portalSlug: slug,
      authorityCode: b.authorityCode,
      tripId: b.tripId,
      visitorName: b.visitorName,
      visitorEmail: b.visitorEmail,
      visitorPhone: b.visitorPhone,
      partySize: b.partySize,
      partyMembers: b.partyMembers,
      visitPurpose: b.visitPurpose,
      visitDescription: b.visitDescription,
      entryDate: new Date(b.entryDate),
      exitDate: b.exitDate ? new Date(b.exitDate) : undefined,
      entryPoint: b.entryPoint,
      plannedAreas: b.plannedAreas,
      vesselName: b.vesselName,
      vesselType: b.vesselType,
      vesselRegistration: b.vesselRegistration,
      visitorNotes: b.visitorNotes
    });
    
    res.json(result);
  } catch (e: any) {
    console.error('Create notice error:', e);
    res.status(400).json({ error: e.message });
  }
});

// POST /api/permits/portals/:slug/territory-notices/:id/acknowledge - Acknowledge
router.post('/portals/:slug/territory-notices/:id/acknowledge', async (req, res) => {
  const { slug, id } = req.params;
  const b = req.body || {};
  
  try {
    const notice = await acknowledgeNotice(slug, id, {
      territoryAcknowledged: b.territoryAcknowledged === true,
      culturalRespectAgreed: b.culturalRespectAgreed === true,
      leaveNoTraceAgreed: b.leaveNoTraceAgreed === true,
      sacredSitesRespect: b.sacredSitesRespect === true
    });
    
    res.json({ notice });
  } catch (e: any) {
    console.error('Acknowledge notice error:', e);
    res.status(400).json({ error: e.message });
  }
});

// GET /api/permits/portals/:slug/territory-notices/by-number/:number - Get by number (before :id)
router.get('/portals/:slug/territory-notices/by-number/:number', async (req, res) => {
  const { slug, number } = req.params;
  
  try {
    const result = await getNoticeByNumber(slug, number);
    if (!result) {
      return res.status(404).json({ error: 'Notice not found' });
    }
    res.json(result);
  } catch (e: any) {
    console.error('Get notice error:', e);
    res.status(500).json({ error: 'Failed to get notice' });
  }
});

// GET /api/permits/portals/:slug/territory-notices - Search notices
router.get('/portals/:slug/territory-notices', async (req, res) => {
  const { slug } = req.params;
  const { authority, status, from, to, limit } = req.query;
  
  try {
    const notices = await searchNotices(slug, {
      authorityId: authority as string,
      status: status as string,
      entryDateFrom: from ? new Date(from as string) : undefined,
      entryDateTo: to ? new Date(to as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined
    });
    
    res.json({ notices, count: notices.length });
  } catch (e: any) {
    console.error('Search notices error:', e);
    res.status(500).json({ error: 'Failed to search notices' });
  }
});

// GET /api/permits/portals/:slug/territory-notices/:id - Get notice
router.get('/portals/:slug/territory-notices/:id', async (req, res) => {
  const { slug, id } = req.params;
  
  try {
    const result = await getTerritoryNotice(slug, id);
    if (!result) {
      return res.status(404).json({ error: 'Notice not found' });
    }
    res.json(result);
  } catch (e: any) {
    console.error('Get notice error:', e);
    res.status(500).json({ error: 'Failed to get notice' });
  }
});

// POST /api/permits/portals/:slug/territory-notices/:id/activate - Activate notice
router.post('/portals/:slug/territory-notices/:id/activate', async (req, res) => {
  const { slug, id } = req.params;
  
  try {
    const notice = await activateNotice(slug, id);
    res.json({ notice });
  } catch (e: any) {
    console.error('Activate notice error:', e);
    res.status(400).json({ error: e.message });
  }
});

// POST /api/permits/portals/:slug/territory-notices/:id/complete - Complete notice
router.post('/portals/:slug/territory-notices/:id/complete', async (req, res) => {
  const { slug, id } = req.params;
  
  try {
    const notice = await completeNotice(slug, id);
    res.json({ notice });
  } catch (e: any) {
    console.error('Complete notice error:', e);
    res.status(400).json({ error: e.message });
  }
});

// POST /api/permits/portals/:slug/territory-notices/:id/cancel - Cancel notice
router.post('/portals/:slug/territory-notices/:id/cancel', async (req, res) => {
  const { slug, id } = req.params;
  
  try {
    const notice = await cancelNotice(slug, id);
    res.json({ notice });
  } catch (e: any) {
    console.error('Cancel notice error:', e);
    res.status(400).json({ error: e.message });
  }
});

// GET /api/permits/portals/:slug/trips/:tripId/territory-notices - Get notices for trip
router.get('/portals/:slug/trips/:tripId/territory-notices', async (req, res) => {
  const { slug, tripId } = req.params;
  
  try {
    const notices = await getNoticesForTrip(slug, tripId);
    res.json({ notices, count: notices.length });
  } catch (e: any) {
    console.error('Get trip notices error:', e);
    res.status(500).json({ error: 'Failed to get notices' });
  }
});

// ============ CULTURAL SITES ENDPOINTS ============

// GET /api/permits/portals/:slug/cultural-sites - Get cultural sites
router.get('/portals/:slug/cultural-sites', async (req, res) => {
  const { slug } = req.params;
  const { authority } = req.query;
  
  try {
    const sites = await getCulturalSites(slug, authority as string);
    res.json({ sites, count: sites.length });
  } catch (e: any) {
    console.error('Get cultural sites error:', e);
    res.status(500).json({ error: 'Failed to get sites' });
  }
});

// GET /api/permits/portals/:slug/cultural-sites/:id - Get cultural site
router.get('/portals/:slug/cultural-sites/:id', async (req, res) => {
  const { slug, id } = req.params;
  
  try {
    const site = await getCulturalSite(slug, id);
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }
    res.json({ site });
  } catch (e: any) {
    console.error('Get cultural site error:', e);
    res.status(500).json({ error: 'Failed to get site' });
  }
});

// GET /api/permits/portals/:slug/territory-acknowledgment/:code - Get territory acknowledgment
router.get('/portals/:slug/territory-acknowledgment/:code', async (req, res) => {
  const { slug, code } = req.params;
  
  try {
    const result = await getTerritoryAcknowledgment(slug, code);
    if (!result) {
      return res.status(404).json({ error: 'Authority not found' });
    }
    res.json(result);
  } catch (e: any) {
    console.error('Get acknowledgment error:', e);
    res.status(500).json({ error: 'Failed to get acknowledgment' });
  }
});

export default router;
