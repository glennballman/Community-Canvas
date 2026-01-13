// server/routes/identity.ts

import { Router } from 'express';
import {
  createIdentity, getIdentity, getIdentityByEmail, searchIdentities,
  requestVerification, verifyCode, verifyIdentityDocument,
  registerVessel, getVessel, searchVessels,
  registerVehicle, getVehicle, getVehicleByPlate, searchVehicles
} from '../services/identityService';

const router = Router();

// ============ IDENTITY ENDPOINTS ============

router.post('/portals/:slug/identities', async (req, res) => {
  const { slug } = req.params;
  const b = req.body || {};
  
  if (!b.identityType || !b.legalName) {
    return res.status(400).json({ error: 'identityType and legalName required' });
  }
  
  try {
    const identity = await createIdentity({
      portalSlug: slug,
      identityType: b.identityType,
      legalName: b.legalName,
      preferredName: b.preferredName,
      email: b.email,
      phone: b.phone,
      addressLine1: b.addressLine1,
      city: b.city,
      province: b.province,
      postalCode: b.postalCode,
      country: b.country,
      emergencyContactName: b.emergencyContactName,
      emergencyContactPhone: b.emergencyContactPhone,
      emergencyContactRelation: b.emergencyContactRelation
    });
    
    res.json({ identity });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/portals/:slug/identities', async (req, res) => {
  const { slug } = req.params;
  const { type, status, level, limit } = req.query;
  
  try {
    const identities = await searchIdentities(slug, {
      identityType: type as string,
      verificationStatus: status as string,
      verificationLevel: level as string,
      limit: limit ? parseInt(limit as string) : undefined
    });
    
    res.json({ identities, count: identities.length });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to search identities' });
  }
});

router.get('/portals/:slug/identities/by-email/:email', async (req, res) => {
  const { slug, email } = req.params;
  
  try {
    const result = await getIdentityByEmail(slug, email);
    if (!result) {
      return res.status(404).json({ error: 'Identity not found' });
    }
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to get identity' });
  }
});

router.get('/portals/:slug/identities/:id', async (req, res) => {
  const { slug, id } = req.params;
  
  try {
    const result = await getIdentity(slug, id);
    if (!result) {
      return res.status(404).json({ error: 'Identity not found' });
    }
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to get identity' });
  }
});

// ============ VERIFICATION ENDPOINTS ============

router.post('/portals/:slug/identities/:id/verify', async (req, res) => {
  const { slug, id } = req.params;
  const { verificationType } = req.body || {};
  
  if (!verificationType) {
    return res.status(400).json({ error: 'verificationType required' });
  }
  
  try {
    const result = await requestVerification(slug, id, verificationType);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/portals/:slug/verify-code', async (req, res) => {
  const { slug } = req.params;
  const { requestId, code } = req.body || {};
  
  if (!requestId || !code) {
    return res.status(400).json({ error: 'requestId and code required' });
  }
  
  try {
    const result = await verifyCode(slug, requestId, code);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/portals/:slug/identities/:id/verify-document', async (req, res) => {
  const { slug, id } = req.params;
  const b = req.body || {};
  
  if (!b.idType || !b.idNumber || !b.verifiedBy) {
    return res.status(400).json({ error: 'idType, idNumber, verifiedBy required' });
  }
  
  try {
    const identity = await verifyIdentityDocument(slug, id, {
      idType: b.idType,
      idNumber: b.idNumber,
      idIssuingAuthority: b.idIssuingAuthority,
      idExpiryDate: b.idExpiryDate ? new Date(b.idExpiryDate) : undefined,
      verifiedBy: b.verifiedBy
    });
    
    res.json({ identity });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// ============ VESSEL ENDPOINTS ============

router.post('/portals/:slug/vessels', async (req, res) => {
  const { slug } = req.params;
  const b = req.body || {};
  
  if (!b.vesselName || !b.vesselType) {
    return res.status(400).json({ error: 'vesselName and vesselType required' });
  }
  
  try {
    const vessel = await registerVessel({
      portalSlug: slug,
      ownerIdentityId: b.ownerIdentityId,
      vesselName: b.vesselName,
      vesselType: b.vesselType,
      tcRegistration: b.tcRegistration,
      hullId: b.hullId,
      lengthFt: b.lengthFt,
      beamFt: b.beamFt,
      propulsionType: b.propulsionType,
      engineHp: b.engineHp,
      maxPassengers: b.maxPassengers,
      safetyEquipment: b.safetyEquipment,
      insuranceProvider: b.insuranceProvider,
      insurancePolicyNumber: b.insurancePolicyNumber,
      insuranceExpiry: b.insuranceExpiry ? new Date(b.insuranceExpiry) : undefined,
      homePort: b.homePort
    });
    
    res.json({ vessel });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/portals/:slug/vessels', async (req, res) => {
  const { slug } = req.params;
  const { type, status, owner, limit } = req.query;
  
  try {
    const vessels = await searchVessels(slug, {
      vesselType: type as string,
      status: status as string,
      ownerIdentityId: owner as string,
      limit: limit ? parseInt(limit as string) : undefined
    });
    
    res.json({ vessels, count: vessels.length });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to search vessels' });
  }
});

router.get('/portals/:slug/vessels/:id', async (req, res) => {
  const { slug, id } = req.params;
  
  try {
    const result = await getVessel(slug, id);
    if (!result) {
      return res.status(404).json({ error: 'Vessel not found' });
    }
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to get vessel' });
  }
});

// ============ VEHICLE ENDPOINTS ============

router.post('/portals/:slug/vehicles', async (req, res) => {
  const { slug } = req.params;
  const b = req.body || {};
  
  if (!b.plateNumber || !b.vehicleType) {
    return res.status(400).json({ error: 'plateNumber and vehicleType required' });
  }
  
  try {
    const vehicle = await registerVehicle({
      portalSlug: slug,
      ownerIdentityId: b.ownerIdentityId,
      plateNumber: b.plateNumber,
      plateProvince: b.plateProvince,
      vehicleType: b.vehicleType,
      make: b.make,
      model: b.model,
      year: b.year,
      color: b.color,
      hasTrailer: b.hasTrailer,
      trailerPlate: b.trailerPlate,
      trailerType: b.trailerType,
      trailerLengthFt: b.trailerLengthFt,
      accessZones: b.accessZones
    });
    
    res.json({ vehicle });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/portals/:slug/vehicles', async (req, res) => {
  const { slug } = req.params;
  const { type, status, owner, limit } = req.query;
  
  try {
    const vehicles = await searchVehicles(slug, {
      vehicleType: type as string,
      status: status as string,
      ownerIdentityId: owner as string,
      limit: limit ? parseInt(limit as string) : undefined
    });
    
    res.json({ vehicles, count: vehicles.length });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to search vehicles' });
  }
});

router.get('/portals/:slug/vehicles/by-plate/:plate', async (req, res) => {
  const { slug, plate } = req.params;
  const { province } = req.query;
  
  try {
    const result = await getVehicleByPlate(slug, plate, province as string);
    if (!result) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to get vehicle' });
  }
});

router.get('/portals/:slug/vehicles/:id', async (req, res) => {
  const { slug, id } = req.params;
  
  try {
    const result = await getVehicle(slug, id);
    if (!result) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to get vehicle' });
  }
});

export default router;
