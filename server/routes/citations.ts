import { Router } from 'express';
import {
  createCitation, getCitation, getCitationByNumber, searchCitations,
  recordPayment, fileAppeal, getAppeal, updateAppealStatus, decideAppeal,
  checkViolatorStanding, updateViolatorStanding
} from '../services/citationService';

const router = Router();

router.post('/portals/:slug/citations', async (req, res) => {
  const { slug } = req.params;
  const b = req.body || {};
  
  if (!b.violatorName || !b.ruleName || !b.violationDescription || !b.violationDate || !b.issuedBy) {
    return res.status(400).json({ 
      error: 'violatorName, ruleName, violationDescription, violationDate, issuedBy required' 
    });
  }
  
  try {
    const result = await createCitation({
      portalSlug: slug,
      propertyId: b.propertyId,
      unitId: b.unitId,
      reservationId: b.reservationId,
      complianceRuleId: b.complianceRuleId,
      complianceCheckId: b.complianceCheckId,
      incidentReportId: b.incidentReportId,
      violatorType: b.violatorType,
      violatorName: b.violatorName,
      violatorEmail: b.violatorEmail,
      violatorPhone: b.violatorPhone,
      violatorAddress: b.violatorAddress,
      guestReservationId: b.guestReservationId,
      vesselName: b.vesselName,
      vesselRegistration: b.vesselRegistration,
      vehiclePlate: b.vehiclePlate,
      vehicleDescription: b.vehicleDescription,
      violationDate: new Date(b.violationDate),
      violationTime: b.violationTime,
      violationLocation: b.violationLocation,
      lat: b.lat,
      lon: b.lon,
      ruleCode: b.ruleCode,
      ruleName: b.ruleName,
      violationDescription: b.violationDescription,
      evidenceDescription: b.evidenceDescription,
      photos: b.photos,
      witnessNames: b.witnessNames,
      fineAmount: b.fineAmount,
      fineDueDate: b.fineDueDate ? new Date(b.fineDueDate) : undefined,
      additionalAction: b.additionalAction,
      actionNotes: b.actionNotes,
      issuedBy: b.issuedBy,
      issuerNotes: b.issuerNotes
    });
    
    res.json(result);
  } catch (e: any) {
    console.error('Create citation error:', e);
    res.status(400).json({ error: e.message });
  }
});

router.get('/portals/:slug/citations', async (req, res) => {
  const { slug } = req.params;
  const { property, status, payment, email, from, to, limit } = req.query;
  
  try {
    const citations = await searchCitations(slug, {
      propertyId: property as string,
      status: status as string,
      paymentStatus: payment as string,
      violatorEmail: email as string,
      fromDate: from ? new Date(from as string) : undefined,
      toDate: to ? new Date(to as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined
    });
    
    res.json({ citations, count: citations.length });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to search citations' });
  }
});

router.get('/portals/:slug/citations/by-number/:number', async (req, res) => {
  const { slug, number } = req.params;
  
  try {
    const result = await getCitationByNumber(slug, number);
    if (!result) {
      return res.status(404).json({ error: 'Citation not found' });
    }
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to get citation' });
  }
});

router.get('/portals/:slug/citations/:id', async (req, res) => {
  const { slug, id } = req.params;
  
  try {
    const result = await getCitation(slug, id);
    if (!result) {
      return res.status(404).json({ error: 'Citation not found' });
    }
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to get citation' });
  }
});

router.post('/portals/:slug/citations/:id/payment', async (req, res) => {
  const { slug, id } = req.params;
  const { amount, paymentReference } = req.body || {};
  
  if (!amount) {
    return res.status(400).json({ error: 'amount required' });
  }
  
  try {
    const citation = await recordPayment(slug, id, { amount, paymentReference });
    res.json({ citation });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/portals/:slug/citations/:id/appeal', async (req, res) => {
  const { slug, id } = req.params;
  const b = req.body || {};
  
  if (!b.appellantName || !b.grounds) {
    return res.status(400).json({ error: 'appellantName and grounds required' });
  }
  
  try {
    const result = await fileAppeal(slug, id, {
      appellantName: b.appellantName,
      appellantEmail: b.appellantEmail,
      appellantPhone: b.appellantPhone,
      grounds: b.grounds,
      supportingEvidence: b.supportingEvidence,
      documents: b.documents
    });
    
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/portals/:slug/appeals/:id', async (req, res) => {
  const { slug, id } = req.params;
  
  try {
    const result = await getAppeal(slug, id);
    if (!result) {
      return res.status(404).json({ error: 'Appeal not found' });
    }
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to get appeal' });
  }
});

router.post('/portals/:slug/appeals/:id/status', async (req, res) => {
  const { slug, id } = req.params;
  const b = req.body || {};
  
  if (!b.status) {
    return res.status(400).json({ error: 'status required' });
  }
  
  try {
    const appeal = await updateAppealStatus(slug, id, b.status, {
      assignedTo: b.assignedTo,
      hearingDate: b.hearingDate ? new Date(b.hearingDate) : undefined,
      hearingTime: b.hearingTime,
      hearingLocation: b.hearingLocation,
      hearingNotes: b.hearingNotes
    });
    
    res.json({ appeal });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/portals/:slug/appeals/:id/decide', async (req, res) => {
  const { slug, id } = req.params;
  const b = req.body || {};
  
  if (!b.decision || !b.decisionReason || !b.decidedBy) {
    return res.status(400).json({ error: 'decision, decisionReason, decidedBy required' });
  }
  
  try {
    const result = await decideAppeal(slug, id, {
      decision: b.decision,
      decisionReason: b.decisionReason,
      decidedBy: b.decidedBy,
      newFineAmount: b.newFineAmount,
      newDueDate: b.newDueDate ? new Date(b.newDueDate) : undefined
    });
    
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/portals/:slug/standing', async (req, res) => {
  const { slug } = req.params;
  const { type, value } = req.query;
  
  if (!type || !value) {
    return res.status(400).json({ error: 'type and value query params required' });
  }
  
  try {
    const result = await checkViolatorStanding(slug, type as string, value as string);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to check standing' });
  }
});

router.post('/portals/:slug/standing', async (req, res) => {
  const { slug } = req.params;
  const b = req.body || {};
  
  if (!b.identifierType || !b.identifierValue || !b.standing) {
    return res.status(400).json({ error: 'identifierType, identifierValue, standing required' });
  }
  
  try {
    const history = await updateViolatorStanding(slug, b.identifierType, b.identifierValue, b.standing, {
      banReason: b.banReason,
      banUntil: b.banUntil ? new Date(b.banUntil) : undefined,
      notes: b.notes
    });
    
    res.json({ history });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
