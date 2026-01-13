import { Router } from 'express';
import {
  createApplication, getApplication, getUserApplications, searchApplications,
  updateApplication, submitApplication, reviewApplication,
  getBusinessOperator, getBusinessOperatorByNumber, searchBusinessOperators,
  updateBusinessOperator, verifyBusinessOperator,
  addOperatorDocument, verifyDocument, getExpiringDocuments
} from '../services/businessOperatorService';

const router = Router();

router.post('/portals/:slug/applications', async (req, res) => {
  const { slug } = req.params;
  const b = req.body || {};
  
  if (!b.userId || !b.operatorType || !b.businessName || !b.contactName || !b.contactEmail) {
    return res.status(400).json({ 
      error: 'userId, operatorType, businessName, contactName, contactEmail required' 
    });
  }
  
  try {
    const application = await createApplication({
      portalSlug: slug,
      userId: b.userId,
      operatorType: b.operatorType,
      businessName: b.businessName,
      businessLegalName: b.businessLegalName,
      businessNumber: b.businessNumber,
      gstNumber: b.gstNumber,
      businessStructure: b.businessStructure,
      contactName: b.contactName,
      contactEmail: b.contactEmail,
      contactPhone: b.contactPhone,
      businessAddress: b.businessAddress,
      businessDescription: b.businessDescription,
      servicesOffered: b.servicesOffered,
      serviceAreas: b.serviceAreas,
      yearsInBusiness: b.yearsInBusiness,
      employeeCount: b.employeeCount,
      seasonalOperation: b.seasonalOperation,
      operatingMonths: b.operatingMonths
    });
    
    res.json({ application });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/portals/:slug/applications', async (req, res) => {
  const { slug } = req.params;
  const { status, type, limit } = req.query;
  
  try {
    const applications = await searchApplications(slug, {
      status: status as string,
      operatorType: type as string,
      limit: limit ? parseInt(limit as string) : undefined
    });
    
    res.json({ applications, count: applications.length });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to search applications' });
  }
});

router.get('/portals/:slug/applications/:id', async (req, res) => {
  const { slug, id } = req.params;
  
  try {
    const result = await getApplication(slug, id);
    if (!result) {
      return res.status(404).json({ error: 'Application not found' });
    }
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to get application' });
  }
});

router.get('/portals/:slug/users/:userId/applications', async (req, res) => {
  const { slug, userId } = req.params;
  
  try {
    const applications = await getUserApplications(slug, userId);
    res.json({ applications, count: applications.length });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to get applications' });
  }
});

router.put('/portals/:slug/applications/:id', async (req, res) => {
  const { slug, id } = req.params;
  const b = req.body || {};
  
  try {
    const application = await updateApplication(slug, id, b);
    res.json({ application });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/portals/:slug/applications/:id/submit', async (req, res) => {
  const { slug, id } = req.params;
  const { termsAccepted, codeOfConductAccepted } = req.body || {};
  
  try {
    const application = await submitApplication(slug, id, termsAccepted, codeOfConductAccepted);
    res.json({ application });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/portals/:slug/applications/:id/review', async (req, res) => {
  const { slug, id } = req.params;
  const { reviewerId, action, notes, rejectionReason } = req.body || {};
  
  if (!reviewerId || !action) {
    return res.status(400).json({ error: 'reviewerId and action required' });
  }
  
  if (!['approve', 'reject', 'request_info'].includes(action)) {
    return res.status(400).json({ error: 'action must be approve, reject, or request_info' });
  }
  
  try {
    const result = await reviewApplication(slug, id, reviewerId, action, notes, rejectionReason);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/portals/:slug/operators', async (req, res) => {
  const { slug } = req.params;
  const { type, status, verification, featured, limit } = req.query;
  
  try {
    const operators = await searchBusinessOperators(slug, {
      operatorType: type as string,
      status: status as string,
      verificationStatus: verification as string,
      featured: featured === 'true' ? true : featured === 'false' ? false : undefined,
      limit: limit ? parseInt(limit as string) : undefined
    });
    
    res.json({ operators, count: operators.length });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to search operators' });
  }
});

router.get('/portals/:slug/operators/:id', async (req, res) => {
  const { slug, id } = req.params;
  
  try {
    const result = await getBusinessOperator(slug, id);
    if (!result) {
      return res.status(404).json({ error: 'Operator not found' });
    }
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to get operator' });
  }
});

router.get('/portals/:slug/operators/by-number/:number', async (req, res) => {
  const { slug, number } = req.params;
  
  try {
    const result = await getBusinessOperatorByNumber(slug, number);
    if (!result) {
      return res.status(404).json({ error: 'Operator not found' });
    }
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to get operator' });
  }
});

router.put('/portals/:slug/operators/:id', async (req, res) => {
  const { slug, id } = req.params;
  const b = req.body || {};
  
  try {
    const operator = await updateBusinessOperator(slug, id, b);
    res.json({ operator });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/portals/:slug/operators/:id/verify', async (req, res) => {
  const { slug, id } = req.params;
  const { verifiedBy } = req.body || {};
  
  if (!verifiedBy) {
    return res.status(400).json({ error: 'verifiedBy required' });
  }
  
  try {
    const operator = await verifyBusinessOperator(slug, id, verifiedBy);
    res.json({ operator });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/operators/:id/documents', async (req, res) => {
  const { id } = req.params;
  const b = req.body || {};
  
  if (!b.documentType || !b.documentName || !b.fileUrl) {
    return res.status(400).json({ error: 'documentType, documentName, fileUrl required' });
  }
  
  try {
    const document = await addOperatorDocument(id, {
      documentType: b.documentType,
      documentName: b.documentName,
      documentNumber: b.documentNumber,
      fileUrl: b.fileUrl,
      fileType: b.fileType,
      fileSizeBytes: b.fileSizeBytes,
      issueDate: b.issueDate ? new Date(b.issueDate) : undefined,
      expiryDate: b.expiryDate ? new Date(b.expiryDate) : undefined
    });
    
    res.json({ document });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/documents/:id/verify', async (req, res) => {
  const { id } = req.params;
  const { verifiedBy, approved, rejectionReason } = req.body || {};
  
  if (!verifiedBy || approved === undefined) {
    return res.status(400).json({ error: 'verifiedBy and approved required' });
  }
  
  try {
    const document = await verifyDocument(id, verifiedBy, approved, rejectionReason);
    res.json({ document });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/portals/:slug/documents/expiring', async (req, res) => {
  const { slug } = req.params;
  const { days } = req.query;
  
  try {
    const documents = await getExpiringDocuments(slug, days ? parseInt(days as string) : 30);
    res.json({ documents, count: documents.length });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to get expiring documents' });
  }
});

export default router;
