import { Router } from 'express';
import {
  getComplianceRules, getRuleByCode, createComplianceRule,
  createComplianceCheck, getComplianceCheck, searchComplianceChecks,
  startComplianceCheck, updateCheckChecklist, completeComplianceCheck,
  createIncidentReport, getIncidentReport, searchIncidentReports,
  updateIncidentStatus
} from '../services/enforcementService';

const router = Router();

router.get('/portals/:slug/rules', async (req, res) => {
  const { slug } = req.params;
  const { category, property, status } = req.query;
  
  try {
    const rules = await getComplianceRules(slug, {
      category: category as string,
      propertyId: property as string,
      status: status as string
    });
    
    res.json({ rules, count: rules.length });
  } catch (e: any) {
    console.error('Get rules error:', e);
    res.status(500).json({ error: 'Failed to get rules' });
  }
});

router.get('/portals/:slug/rules/:code', async (req, res) => {
  const { slug, code } = req.params;
  
  try {
    const rule = await getRuleByCode(slug, code);
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    res.json({ rule });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to get rule' });
  }
});

router.post('/portals/:slug/rules', async (req, res) => {
  const { slug } = req.params;
  const b = req.body || {};
  
  if (!b.name || !b.category || !b.description) {
    return res.status(400).json({ error: 'name, category, description required' });
  }
  
  try {
    const rule = await createComplianceRule(slug, b);
    res.json({ rule });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/portals/:slug/checks', async (req, res) => {
  const { slug } = req.params;
  const b = req.body || {};
  
  if (!b.checkType) {
    return res.status(400).json({ error: 'checkType required' });
  }
  
  try {
    const result = await createComplianceCheck({
      portalSlug: slug,
      propertyId: b.propertyId,
      unitId: b.unitId,
      reservationId: b.reservationId,
      checkType: b.checkType,
      scheduledAt: b.scheduledAt ? new Date(b.scheduledAt) : undefined,
      scheduledBy: b.scheduledBy,
      assignedTo: b.assignedTo,
      locationDescription: b.locationDescription
    });
    
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/portals/:slug/checks', async (req, res) => {
  const { slug } = req.params;
  const { property, status, type, assignedTo, from, to, limit } = req.query;
  
  try {
    const checks = await searchComplianceChecks(slug, {
      propertyId: property as string,
      status: status as string,
      checkType: type as string,
      assignedTo: assignedTo as string,
      fromDate: from ? new Date(from as string) : undefined,
      toDate: to ? new Date(to as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined
    });
    
    res.json({ checks, count: checks.length });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to search checks' });
  }
});

router.get('/portals/:slug/checks/:id', async (req, res) => {
  const { slug, id } = req.params;
  
  try {
    const result = await getComplianceCheck(slug, id);
    if (!result) {
      return res.status(404).json({ error: 'Check not found' });
    }
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to get check' });
  }
});

router.post('/portals/:slug/checks/:id/start', async (req, res) => {
  const { slug, id } = req.params;
  try {
    const check = await startComplianceCheck(slug, id);
    res.json({ check });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/portals/:slug/checks/:id/checklist', async (req, res) => {
  const { slug, id } = req.params;
  const { checklist } = req.body || {};
  
  if (!checklist) {
    return res.status(400).json({ error: 'checklist required' });
  }
  
  try {
    const check = await updateCheckChecklist(slug, id, checklist);
    res.json({ check });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/portals/:slug/checks/:id/complete', async (req, res) => {
  const { slug, id } = req.params;
  const b = req.body || {};
  
  if (!b.overallResult) {
    return res.status(400).json({ error: 'overallResult required' });
  }
  
  try {
    const check = await completeComplianceCheck(slug, id, {
      overallResult: b.overallResult,
      findingsSummary: b.findingsSummary,
      actionsTaken: b.actionsTaken,
      warningsIssued: b.warningsIssued,
      citationsIssued: b.citationsIssued,
      requiresFollowup: b.requiresFollowup,
      followupDate: b.followupDate ? new Date(b.followupDate) : undefined,
      followupNotes: b.followupNotes,
      inspectorNotes: b.inspectorNotes,
      photos: b.photos
    });
    
    res.json({ check });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/portals/:slug/incidents', async (req, res) => {
  const { slug } = req.params;
  const b = req.body || {};
  
  if (!b.incidentType || !b.title || !b.incidentAt) {
    return res.status(400).json({ error: 'incidentType, title, incidentAt required' });
  }
  
  try {
    const result = await createIncidentReport({
      portalSlug: slug,
      propertyId: b.propertyId,
      unitId: b.unitId,
      reservationId: b.reservationId,
      locationId: b.locationId,
      incidentType: b.incidentType,
      severity: b.severity,
      incidentAt: new Date(b.incidentAt),
      locationDescription: b.locationDescription,
      lat: b.lat,
      lon: b.lon,
      reportedByType: b.reportedByType,
      reportedByName: b.reportedByName,
      reportedByContact: b.reportedByContact,
      reporterReservationId: b.reporterReservationId,
      title: b.title,
      description: b.description,
      involvedParties: b.involvedParties
    });
    
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/portals/:slug/incidents', async (req, res) => {
  const { slug } = req.params;
  const { property, type, severity, status, from, to, limit } = req.query;
  
  try {
    const reports = await searchIncidentReports(slug, {
      propertyId: property as string,
      incidentType: type as string,
      severity: severity as string,
      status: status as string,
      fromDate: from ? new Date(from as string) : undefined,
      toDate: to ? new Date(to as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined
    });
    
    res.json({ reports, count: reports.length });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to search incidents' });
  }
});

router.get('/portals/:slug/incidents/:id', async (req, res) => {
  const { slug, id } = req.params;
  
  try {
    const result = await getIncidentReport(slug, id);
    if (!result) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to get incident' });
  }
});

router.post('/portals/:slug/incidents/:id/status', async (req, res) => {
  const { slug, id } = req.params;
  const b = req.body || {};
  
  if (!b.status) {
    return res.status(400).json({ error: 'status required' });
  }
  
  try {
    const report = await updateIncidentStatus(slug, id, b.status, {
      respondedBy: b.respondedBy,
      investigatedBy: b.investigatedBy,
      investigationNotes: b.investigationNotes,
      resolutionType: b.resolutionType,
      resolutionNotes: b.resolutionNotes,
      resolvedBy: b.resolvedBy,
      damageEstimate: b.damageEstimate,
      repairCost: b.repairCost,
      requiresFollowup: b.requiresFollowup,
      followupDate: b.followupDate ? new Date(b.followupDate) : undefined
    });
    
    res.json({ report });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
