// server/services/identityService.ts

import { db } from '../db';
import { eq, and, asc, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import crypto from 'crypto';
import { 
  ccVerifiedIdentities, ccVesselRegistrations, ccVehicleRegistrations,
  ccVerificationRequests, ccPortals
} from '@shared/schema';

// ============ TYPES ============

interface CreateIdentityRequest {
  portalSlug: string;
  identityType: string;
  legalName: string;
  preferredName?: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
}

interface RegisterVesselRequest {
  portalSlug: string;
  ownerIdentityId?: string;
  vesselName: string;
  vesselType: string;
  tcRegistration?: string;
  hullId?: string;
  lengthFt?: number;
  beamFt?: number;
  propulsionType?: string;
  engineHp?: number;
  maxPassengers?: number;
  safetyEquipment?: string[];
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  insuranceExpiry?: Date;
  homePort?: string;
}

interface RegisterVehicleRequest {
  portalSlug: string;
  ownerIdentityId?: string;
  plateNumber: string;
  plateProvince?: string;
  vehicleType: string;
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  hasTrailer?: boolean;
  trailerPlate?: string;
  trailerType?: string;
  trailerLengthFt?: number;
  accessZones?: string[];
}

// ============ HELPERS ============

function generateRegistrationNumber(prefix: string, portalCode: string): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(2, 10).replace(/-/g, '');
  const suffix = nanoid(4).toUpperCase();
  return `${prefix}-${portalCode.substring(0, 3).toUpperCase()}-${dateStr}-${suffix}`;
}

function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function hashIdNumber(idNumber: string): string {
  return crypto.createHash('sha256').update(idNumber.toLowerCase()).digest('hex');
}

// ============ IDENTITY FUNCTIONS ============

export async function createIdentity(req: CreateIdentityRequest): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, req.portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  if (req.email) {
    const existing = await db.query.ccVerifiedIdentities.findFirst({
      where: and(
        eq(ccVerifiedIdentities.portalId, portal.id),
        eq(ccVerifiedIdentities.email, req.email.toLowerCase())
      )
    });
    
    if (existing) {
      throw new Error('Identity with this email already exists');
    }
  }
  
  const [identity] = await db.insert(ccVerifiedIdentities).values({
    portalId: portal.id,
    identityType: req.identityType,
    legalName: req.legalName,
    preferredName: req.preferredName,
    email: req.email?.toLowerCase(),
    phone: req.phone,
    addressLine1: req.addressLine1,
    city: req.city,
    province: req.province || 'BC',
    postalCode: req.postalCode,
    country: req.country || 'Canada',
    emergencyContactName: req.emergencyContactName,
    emergencyContactPhone: req.emergencyContactPhone,
    emergencyContactRelation: req.emergencyContactRelation,
    verificationStatus: 'unverified',
    verificationLevel: 'none',
    trustScore: 50
  }).returning();
  
  return identity;
}

export async function getIdentity(
  portalSlug: string,
  identityId: string
): Promise<any | null> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return null;
  
  const identity = await db.query.ccVerifiedIdentities.findFirst({
    where: and(
      eq(ccVerifiedIdentities.id, identityId),
      eq(ccVerifiedIdentities.portalId, portal.id)
    )
  });
  
  if (!identity) return null;
  
  const vessels = await db.query.ccVesselRegistrations.findMany({
    where: and(
      eq(ccVesselRegistrations.ownerIdentityId, identityId),
      eq(ccVesselRegistrations.portalId, portal.id)
    )
  });
  
  const vehicles = await db.query.ccVehicleRegistrations.findMany({
    where: and(
      eq(ccVehicleRegistrations.ownerIdentityId, identityId),
      eq(ccVehicleRegistrations.portalId, portal.id)
    )
  });
  
  return { identity, vessels, vehicles };
}

export async function getIdentityByEmail(
  portalSlug: string,
  email: string
): Promise<any | null> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return null;
  
  const identity = await db.query.ccVerifiedIdentities.findFirst({
    where: and(
      eq(ccVerifiedIdentities.portalId, portal.id),
      eq(ccVerifiedIdentities.email, email.toLowerCase())
    )
  });
  
  if (!identity) return null;
  
  return getIdentity(portalSlug, identity.id);
}

export async function searchIdentities(
  portalSlug: string,
  options?: {
    identityType?: string;
    verificationStatus?: string;
    verificationLevel?: string;
    limit?: number;
  }
): Promise<any[]> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return [];
  
  const conditions: any[] = [eq(ccVerifiedIdentities.portalId, portal.id)];
  
  if (options?.identityType) {
    conditions.push(eq(ccVerifiedIdentities.identityType, options.identityType));
  }
  
  if (options?.verificationStatus) {
    conditions.push(eq(ccVerifiedIdentities.verificationStatus, options.verificationStatus));
  }
  
  if (options?.verificationLevel) {
    conditions.push(eq(ccVerifiedIdentities.verificationLevel, options.verificationLevel));
  }
  
  return db.query.ccVerifiedIdentities.findMany({
    where: and(...conditions),
    orderBy: [desc(ccVerifiedIdentities.trustScore), asc(ccVerifiedIdentities.legalName)],
    limit: options?.limit || 50
  });
}

// ============ VERIFICATION ============

export async function requestVerification(
  portalSlug: string,
  identityId: string,
  verificationType: string
): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const identity = await db.query.ccVerifiedIdentities.findFirst({
    where: and(
      eq(ccVerifiedIdentities.id, identityId),
      eq(ccVerifiedIdentities.portalId, portal.id)
    )
  });
  
  if (!identity) throw new Error('Identity not found');
  
  const requestNumber = `VRQ-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${nanoid(4).toUpperCase()}`;
  
  let verificationCode: string | undefined;
  let codeExpiresAt: Date | undefined;
  
  if (['email', 'phone'].includes(verificationType)) {
    verificationCode = generateVerificationCode();
    codeExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
  }
  
  const [request] = await db.insert(ccVerificationRequests).values({
    portalId: portal.id,
    identityId,
    requestNumber,
    verificationType,
    verificationCode,
    codeExpiresAt,
    status: 'pending',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
  }).returning();
  
  return { request, verificationCode };
}

export async function verifyCode(
  portalSlug: string,
  requestId: string,
  code: string
): Promise<{ success: boolean; message: string }> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return { success: false, message: 'Portal not found' };
  
  const request = await db.query.ccVerificationRequests.findFirst({
    where: and(
      eq(ccVerificationRequests.id, requestId),
      eq(ccVerificationRequests.portalId, portal.id)
    )
  });
  
  if (!request) return { success: false, message: 'Request not found' };
  
  if (request.status !== 'pending') {
    return { success: false, message: 'Request already processed' };
  }
  
  if (request.codeExpiresAt && new Date() > request.codeExpiresAt) {
    await db.update(ccVerificationRequests)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(eq(ccVerificationRequests.id, requestId));
    return { success: false, message: 'Code expired' };
  }
  
  const attempts = (request.codeAttempts || 0) + 1;
  
  if (attempts > 5) {
    await db.update(ccVerificationRequests)
      .set({ status: 'failed', codeAttempts: attempts, updatedAt: new Date() })
      .where(eq(ccVerificationRequests.id, requestId));
    return { success: false, message: 'Too many attempts' };
  }
  
  if (request.verificationCode !== code) {
    await db.update(ccVerificationRequests)
      .set({ codeAttempts: attempts, updatedAt: new Date() })
      .where(eq(ccVerificationRequests.id, requestId));
    return { success: false, message: 'Invalid code' };
  }
  
  await db.update(ccVerificationRequests)
    .set({
      status: 'completed',
      result: 'pass',
      reviewedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(ccVerificationRequests.id, requestId));
  
  const newLevel = request.verificationType === 'email' ? 'email' : 
                   request.verificationType === 'phone' ? 'phone' : 'basic';
  
  await db.update(ccVerifiedIdentities)
    .set({
      verificationLevel: newLevel,
      verificationStatus: 'verified',
      verifiedAt: new Date(),
      trustScore: 60,
      updatedAt: new Date()
    })
    .where(eq(ccVerifiedIdentities.id, request.identityId!));
  
  return { success: true, message: 'Verification successful' };
}

export async function verifyIdentityDocument(
  portalSlug: string,
  identityId: string,
  data: {
    idType: string;
    idNumber: string;
    idIssuingAuthority?: string;
    idExpiryDate?: Date;
    verifiedBy: string;
  }
): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const identity = await db.query.ccVerifiedIdentities.findFirst({
    where: and(
      eq(ccVerifiedIdentities.id, identityId),
      eq(ccVerifiedIdentities.portalId, portal.id)
    )
  });
  
  if (!identity) throw new Error('Identity not found');
  
  const idNumberHash = hashIdNumber(data.idNumber);
  
  const [updated] = await db.update(ccVerifiedIdentities)
    .set({
      idType: data.idType,
      idNumberHash,
      idIssuingAuthority: data.idIssuingAuthority,
      idExpiryDate: data.idExpiryDate?.toISOString().split('T')[0],
      idVerified: true,
      idVerifiedAt: new Date(),
      idVerifiedBy: data.verifiedBy,
      verificationLevel: 'basic',
      verificationStatus: 'verified',
      verifiedAt: new Date(),
      verificationExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      trustScore: 70,
      updatedAt: new Date()
    })
    .where(and(
      eq(ccVerifiedIdentities.id, identityId),
      eq(ccVerifiedIdentities.portalId, portal.id)
    ))
    .returning();
  
  return updated;
}

// ============ VESSEL REGISTRATION ============

export async function registerVessel(req: RegisterVesselRequest): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, req.portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  if (req.ownerIdentityId) {
    const owner = await db.query.ccVerifiedIdentities.findFirst({
      where: and(
        eq(ccVerifiedIdentities.id, req.ownerIdentityId),
        eq(ccVerifiedIdentities.portalId, portal.id)
      )
    });
    if (!owner) throw new Error('Owner identity not found in portal');
  }
  
  const registrationNumber = generateRegistrationNumber('VES', portal.slug);
  
  const [vessel] = await db.insert(ccVesselRegistrations).values({
    portalId: portal.id,
    ownerIdentityId: req.ownerIdentityId,
    registrationNumber,
    vesselName: req.vesselName,
    vesselType: req.vesselType,
    tcRegistration: req.tcRegistration,
    hullId: req.hullId,
    lengthFt: req.lengthFt?.toString(),
    beamFt: req.beamFt?.toString(),
    propulsionType: req.propulsionType,
    engineHp: req.engineHp,
    maxPassengers: req.maxPassengers,
    safetyEquipmentJson: req.safetyEquipment || [],
    insuranceProvider: req.insuranceProvider,
    insurancePolicyNumber: req.insurancePolicyNumber,
    insuranceExpiry: req.insuranceExpiry?.toISOString().split('T')[0],
    homePort: req.homePort,
    verificationStatus: 'pending',
    status: 'active'
  }).returning();
  
  return vessel;
}

export async function getVessel(
  portalSlug: string,
  vesselId: string
): Promise<any | null> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return null;
  
  const vessel = await db.query.ccVesselRegistrations.findFirst({
    where: and(
      eq(ccVesselRegistrations.id, vesselId),
      eq(ccVesselRegistrations.portalId, portal.id)
    )
  });
  
  if (!vessel) return null;
  
  let owner = null;
  if (vessel.ownerIdentityId) {
    owner = await db.query.ccVerifiedIdentities.findFirst({
      where: and(
        eq(ccVerifiedIdentities.id, vessel.ownerIdentityId),
        eq(ccVerifiedIdentities.portalId, portal.id)
      )
    });
  }
  
  return { vessel, owner };
}

export async function searchVessels(
  portalSlug: string,
  options?: {
    vesselType?: string;
    status?: string;
    ownerIdentityId?: string;
    limit?: number;
  }
): Promise<any[]> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return [];
  
  const conditions: any[] = [eq(ccVesselRegistrations.portalId, portal.id)];
  
  if (options?.vesselType) {
    conditions.push(eq(ccVesselRegistrations.vesselType, options.vesselType));
  }
  
  if (options?.status) {
    conditions.push(eq(ccVesselRegistrations.status, options.status));
  }
  
  if (options?.ownerIdentityId) {
    conditions.push(eq(ccVesselRegistrations.ownerIdentityId, options.ownerIdentityId));
  }
  
  return db.query.ccVesselRegistrations.findMany({
    where: and(...conditions),
    orderBy: [asc(ccVesselRegistrations.vesselName)],
    limit: options?.limit || 50
  });
}

// ============ VEHICLE REGISTRATION ============

export async function registerVehicle(req: RegisterVehicleRequest): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, req.portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  if (req.ownerIdentityId) {
    const owner = await db.query.ccVerifiedIdentities.findFirst({
      where: and(
        eq(ccVerifiedIdentities.id, req.ownerIdentityId),
        eq(ccVerifiedIdentities.portalId, portal.id)
      )
    });
    if (!owner) throw new Error('Owner identity not found in portal');
  }
  
  const existing = await db.query.ccVehicleRegistrations.findFirst({
    where: and(
      eq(ccVehicleRegistrations.portalId, portal.id),
      eq(ccVehicleRegistrations.plateNumber, req.plateNumber.toUpperCase()),
      eq(ccVehicleRegistrations.plateProvince, req.plateProvince || 'BC')
    )
  });
  
  if (existing) {
    throw new Error('Vehicle with this plate already registered');
  }
  
  const registrationNumber = generateRegistrationNumber('VEH', portal.slug);
  
  const [vehicle] = await db.insert(ccVehicleRegistrations).values({
    portalId: portal.id,
    ownerIdentityId: req.ownerIdentityId,
    registrationNumber,
    plateNumber: req.plateNumber.toUpperCase(),
    plateProvince: req.plateProvince || 'BC',
    vehicleType: req.vehicleType,
    make: req.make,
    model: req.model,
    year: req.year,
    color: req.color,
    hasTrailer: req.hasTrailer || false,
    trailerPlate: req.trailerPlate?.toUpperCase(),
    trailerType: req.trailerType,
    trailerLengthFt: req.trailerLengthFt?.toString(),
    accessZones: req.accessZones,
    verificationStatus: 'pending',
    status: 'active'
  }).returning();
  
  return vehicle;
}

export async function getVehicle(
  portalSlug: string,
  vehicleId: string
): Promise<any | null> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return null;
  
  const vehicle = await db.query.ccVehicleRegistrations.findFirst({
    where: and(
      eq(ccVehicleRegistrations.id, vehicleId),
      eq(ccVehicleRegistrations.portalId, portal.id)
    )
  });
  
  if (!vehicle) return null;
  
  let owner = null;
  if (vehicle.ownerIdentityId) {
    owner = await db.query.ccVerifiedIdentities.findFirst({
      where: and(
        eq(ccVerifiedIdentities.id, vehicle.ownerIdentityId),
        eq(ccVerifiedIdentities.portalId, portal.id)
      )
    });
  }
  
  return { vehicle, owner };
}

export async function getVehicleByPlate(
  portalSlug: string,
  plateNumber: string,
  plateProvince?: string
): Promise<any | null> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return null;
  
  const vehicle = await db.query.ccVehicleRegistrations.findFirst({
    where: and(
      eq(ccVehicleRegistrations.portalId, portal.id),
      eq(ccVehicleRegistrations.plateNumber, plateNumber.toUpperCase()),
      eq(ccVehicleRegistrations.plateProvince, plateProvince || 'BC')
    )
  });
  
  if (!vehicle) return null;
  
  return getVehicle(portalSlug, vehicle.id);
}

export async function searchVehicles(
  portalSlug: string,
  options?: {
    vehicleType?: string;
    status?: string;
    ownerIdentityId?: string;
    limit?: number;
  }
): Promise<any[]> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return [];
  
  const conditions: any[] = [eq(ccVehicleRegistrations.portalId, portal.id)];
  
  if (options?.vehicleType) {
    conditions.push(eq(ccVehicleRegistrations.vehicleType, options.vehicleType));
  }
  
  if (options?.status) {
    conditions.push(eq(ccVehicleRegistrations.status, options.status));
  }
  
  if (options?.ownerIdentityId) {
    conditions.push(eq(ccVehicleRegistrations.ownerIdentityId, options.ownerIdentityId));
  }
  
  return db.query.ccVehicleRegistrations.findMany({
    where: and(...conditions),
    orderBy: [asc(ccVehicleRegistrations.plateNumber)],
    limit: options?.limit || 50
  });
}
