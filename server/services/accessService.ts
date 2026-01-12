// V3.3.1 Block 11: Access Credentials + Events Service
// Issue QR codes, gate codes, and track access events for check-in validation

import { db } from '../db';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';
import { logActivity } from './activityService';

// ============================================================================
// Types
// ============================================================================

export interface IssueCredentialRequest {
  tenantId: string;
  reservationId: string;
  reservationItemId?: string;
  credentialType: 'qr' | 'short_code' | 'gate_code' | 'dock_power_token' | 'key_code';
  scope: 'facility_access' | 'gate' | 'dock_power' | 'parking_entry' | 'parking_exit' | 'room';
  validFrom: Date;
  validUntil: Date;
  issuedBy?: string;
}

export interface CredentialResult {
  id: string;
  credentialType: string;
  qrToken?: string;
  shortCode?: string;
  gateCode?: string;
  validFrom: Date;
  validUntil: Date;
  scope: string;
  isRevoked: boolean;
}

export interface ValidationResult {
  valid: boolean;
  result: 'valid' | 'invalid' | 'expired' | 'revoked' | 'not_found' | 'wrong_facility';
  credential?: {
    id: string;
    reservationId: string;
    scope: string;
    validUntil: Date;
  };
  reservation?: {
    id: string;
    confirmationNumber: string;
    customerName: string;
    facilityName: string;
    unitLabel?: string;
  };
  message?: string;
}

// ============================================================================
// Short Code Generation
// ============================================================================

const SHORT_CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // No 0,1,I,O,L

function generateShortCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += SHORT_CODE_CHARS.charAt(Math.floor(Math.random() * SHORT_CODE_CHARS.length));
  }
  return code;
}

function generateQrToken(): string {
  return crypto.randomUUID();
}

function generateGateCode(): string {
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  return code;
}

// ============================================================================
// Issue Credential
// ============================================================================

export async function issueCredential(req: IssueCredentialRequest): Promise<CredentialResult> {
  let qrToken: string | null = null;
  let shortCode: string | null = null;
  let gateCode: string | null = null;
  
  switch (req.credentialType) {
    case 'qr':
      qrToken = generateQrToken();
      break;
    case 'short_code':
      shortCode = await generateUniqueShortCode(req.tenantId);
      break;
    case 'gate_code':
      gateCode = generateGateCode();
      break;
    case 'dock_power_token':
      qrToken = generateQrToken();
      break;
    case 'key_code':
      gateCode = generateGateCode();
      break;
  }
  
  const result = await db.execute(sql`
    INSERT INTO cc_access_credentials (
      tenant_id, reservation_id, reservation_item_id,
      credential_type, qr_token, short_code, gate_code,
      scope, valid_from, valid_until, issued_by
    ) VALUES (
      ${req.tenantId}::uuid,
      ${req.reservationId}::uuid,
      ${req.reservationItemId ? sql`${req.reservationItemId}::uuid` : sql`NULL`},
      ${req.credentialType},
      ${qrToken},
      ${shortCode},
      ${gateCode},
      ${req.scope},
      ${req.validFrom.toISOString()}::timestamptz,
      ${req.validUntil.toISOString()}::timestamptz,
      ${req.issuedBy ? sql`${req.issuedBy}::uuid` : sql`NULL`}
    )
    RETURNING id, credential_type, qr_token, short_code, gate_code, valid_from, valid_until, scope, is_revoked
  `);
  
  const row = result.rows[0] as any;
  
  await logActivity({
    tenantId: req.tenantId,
    actorId: req.issuedBy,
    action: 'credential.issued',
    resourceType: 'credential',
    resourceId: row.id,
    metadata: {
      credentialType: req.credentialType,
      scope: req.scope,
      reservationId: req.reservationId,
    },
  });
  
  return {
    id: row.id,
    credentialType: row.credential_type,
    qrToken: row.qr_token || undefined,
    shortCode: row.short_code || undefined,
    gateCode: row.gate_code || undefined,
    validFrom: new Date(row.valid_from),
    validUntil: new Date(row.valid_until),
    scope: row.scope,
    isRevoked: row.is_revoked,
  };
}

async function generateUniqueShortCode(tenantId: string): Promise<string> {
  const maxAttempts = 10;
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateShortCode();
    const existing = await db.execute(sql`
      SELECT 1 FROM cc_access_credentials
      WHERE short_code = ${code}
        AND tenant_id = ${tenantId}::uuid
        AND NOT is_revoked
        AND valid_until > NOW()
      LIMIT 1
    `);
    if (existing.rows.length === 0) {
      return code;
    }
  }
  throw new Error('Failed to generate unique short code after maximum attempts');
}

// ============================================================================
// Validate Credentials
// ============================================================================

export async function validateQrToken(
  qrToken: string,
  facilityId?: string
): Promise<ValidationResult> {
  const result = await db.execute(sql`
    SELECT 
      c.id, c.reservation_id, c.scope, c.valid_from, c.valid_until, c.is_revoked, c.tenant_id,
      r.confirmation_number, r.customer_name,
      f.name as facility_name,
      ra.display_label as unit_label,
      r.facility_id as reservation_facility_id
    FROM cc_access_credentials c
    JOIN cc_reservations r ON r.id = c.reservation_id
    LEFT JOIN cc_facilities f ON f.id = r.facility_id
    LEFT JOIN cc_reservation_items ri ON ri.id = c.reservation_item_id
    LEFT JOIN cc_reservation_allocations ra ON ra.reservation_item_id = ri.id
    WHERE c.qr_token = ${qrToken}
    LIMIT 1
  `);
  
  if (result.rows.length === 0) {
    return { valid: false, result: 'not_found', message: 'Credential not found' };
  }
  
  const cred = result.rows[0] as any;
  return validateCredentialRow(cred, facilityId);
}

export async function validateShortCode(
  shortCode: string,
  facilityId?: string
): Promise<ValidationResult> {
  const normalizedCode = shortCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
  
  const result = await db.execute(sql`
    SELECT 
      c.id, c.reservation_id, c.scope, c.valid_from, c.valid_until, c.is_revoked, c.tenant_id,
      r.confirmation_number, r.customer_name,
      f.name as facility_name,
      ra.display_label as unit_label,
      r.facility_id as reservation_facility_id
    FROM cc_access_credentials c
    JOIN cc_reservations r ON r.id = c.reservation_id
    LEFT JOIN cc_facilities f ON f.id = r.facility_id
    LEFT JOIN cc_reservation_items ri ON ri.id = c.reservation_item_id
    LEFT JOIN cc_reservation_allocations ra ON ra.reservation_item_id = ri.id
    WHERE c.short_code = ${normalizedCode}
      AND c.valid_until > NOW() - interval '24 hours'
    ORDER BY c.created_at DESC
    LIMIT 1
  `);
  
  if (result.rows.length === 0) {
    return { valid: false, result: 'not_found', message: 'Code not found' };
  }
  
  const cred = result.rows[0] as any;
  return validateCredentialRow(cred, facilityId);
}

export async function validatePlate(
  plate: string,
  facilityId: string
): Promise<ValidationResult> {
  const normalizedPlate = plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
  
  const result = await db.execute(sql`
    SELECT 
      c.id, c.reservation_id, c.scope, c.valid_from, c.valid_until, c.is_revoked, c.tenant_id,
      r.confirmation_number, r.customer_name,
      f.name as facility_name,
      ra.display_label as unit_label,
      r.facility_id as reservation_facility_id
    FROM cc_access_credentials c
    JOIN cc_reservations r ON r.id = c.reservation_id
    LEFT JOIN cc_facilities f ON f.id = r.facility_id
    LEFT JOIN cc_reservation_items ri ON ri.id = c.reservation_item_id
    LEFT JOIN cc_reservation_allocations ra ON ra.reservation_item_id = ri.id
    WHERE r.vehicle_plate = ${normalizedPlate}
      AND c.scope IN ('parking_entry', 'parking_exit', 'facility_access')
      AND c.valid_until > NOW()
      AND NOT c.is_revoked
    ORDER BY c.valid_from DESC
    LIMIT 1
  `);
  
  if (result.rows.length === 0) {
    return { valid: false, result: 'not_found', message: 'No active reservation for this plate' };
  }
  
  const cred = result.rows[0] as any;
  return validateCredentialRow(cred, facilityId);
}

function validateCredentialRow(cred: any, facilityId?: string): ValidationResult {
  const now = new Date();
  const validFrom = new Date(cred.valid_from);
  const validUntil = new Date(cred.valid_until);
  
  if (cred.is_revoked) {
    return {
      valid: false,
      result: 'revoked',
      message: 'Credential has been revoked',
      credential: {
        id: cred.id,
        reservationId: cred.reservation_id,
        scope: cred.scope,
        validUntil,
      },
    };
  }
  
  if (now < validFrom || now > validUntil) {
    return {
      valid: false,
      result: 'expired',
      message: now < validFrom ? 'Credential not yet valid' : 'Credential has expired',
      credential: {
        id: cred.id,
        reservationId: cred.reservation_id,
        scope: cred.scope,
        validUntil,
      },
    };
  }
  
  if (facilityId && cred.reservation_facility_id && cred.reservation_facility_id !== facilityId) {
    return {
      valid: false,
      result: 'wrong_facility',
      message: 'Credential is for a different facility',
      credential: {
        id: cred.id,
        reservationId: cred.reservation_id,
        scope: cred.scope,
        validUntil,
      },
    };
  }
  
  return {
    valid: true,
    result: 'valid',
    credential: {
      id: cred.id,
      reservationId: cred.reservation_id,
      scope: cred.scope,
      validUntil,
    },
    reservation: {
      id: cred.reservation_id,
      confirmationNumber: cred.confirmation_number,
      customerName: cred.customer_name,
      facilityName: cred.facility_name,
      unitLabel: cred.unit_label || undefined,
    },
  };
}

// ============================================================================
// Record Access Event
// ============================================================================

export async function recordAccessEvent(
  tenantId: string,
  credentialId: string | null,
  facilityId: string | null,
  eventType: string,
  result: string,
  actorId?: string,
  deviceId?: string,
  metadata?: Record<string, any>
): Promise<string> {
  const insertResult = await db.execute(sql`
    INSERT INTO cc_access_events (
      tenant_id, credential_id, facility_id, event_type, result,
      validation_method, actor_id, device_id, metadata
    ) VALUES (
      ${tenantId}::uuid,
      ${credentialId ? sql`${credentialId}::uuid` : sql`NULL`},
      ${facilityId ? sql`${facilityId}::uuid` : sql`NULL`},
      ${eventType},
      ${result},
      ${metadata?.method || null},
      ${actorId ? sql`${actorId}::uuid` : sql`NULL`},
      ${deviceId || null},
      ${JSON.stringify(metadata || {})}::jsonb
    )
    RETURNING id
  `);
  
  return (insertResult.rows[0] as any).id;
}

// ============================================================================
// Credential Management
// ============================================================================

export async function revokeCredential(
  credentialId: string,
  reason: string,
  revokedBy: string
): Promise<void> {
  const result = await db.execute(sql`
    UPDATE cc_access_credentials
    SET is_revoked = true, revoked_at = NOW(), revoked_by = ${revokedBy}::uuid, revoked_reason = ${reason}
    WHERE id = ${credentialId}::uuid
    RETURNING tenant_id, reservation_id
  `);
  
  if (result.rows.length === 0) {
    throw new Error('Credential not found');
  }
  
  const row = result.rows[0] as any;
  
  await logActivity({
    tenantId: row.tenant_id,
    actorId: revokedBy,
    action: 'credential.revoked',
    resourceType: 'credential',
    resourceId: credentialId,
    metadata: { reason, reservationId: row.reservation_id },
  });
}

export async function extendCredential(
  credentialId: string,
  newValidUntil: Date,
  extendedBy: string
): Promise<CredentialResult> {
  const result = await db.execute(sql`
    UPDATE cc_access_credentials
    SET valid_until = ${newValidUntil.toISOString()}::timestamptz
    WHERE id = ${credentialId}::uuid AND NOT is_revoked
    RETURNING id, tenant_id, credential_type, qr_token, short_code, gate_code, valid_from, valid_until, scope, is_revoked
  `);
  
  if (result.rows.length === 0) {
    throw new Error('Credential not found or is revoked');
  }
  
  const row = result.rows[0] as any;
  
  await logActivity({
    tenantId: row.tenant_id,
    actorId: extendedBy,
    action: 'credential.extended',
    resourceType: 'credential',
    resourceId: credentialId,
    metadata: { newValidUntil: newValidUntil.toISOString() },
  });
  
  return {
    id: row.id,
    credentialType: row.credential_type,
    qrToken: row.qr_token || undefined,
    shortCode: row.short_code || undefined,
    gateCode: row.gate_code || undefined,
    validFrom: new Date(row.valid_from),
    validUntil: new Date(row.valid_until),
    scope: row.scope,
    isRevoked: row.is_revoked,
  };
}

export async function getCredentialsForReservation(
  reservationId: string
): Promise<CredentialResult[]> {
  const result = await db.execute(sql`
    SELECT id, credential_type, qr_token, short_code, gate_code, valid_from, valid_until, scope, is_revoked
    FROM cc_access_credentials
    WHERE reservation_id = ${reservationId}::uuid
    ORDER BY created_at ASC
  `);
  
  return result.rows.map((row: any) => ({
    id: row.id,
    credentialType: row.credential_type,
    qrToken: row.qr_token || undefined,
    shortCode: row.short_code || undefined,
    gateCode: row.gate_code || undefined,
    validFrom: new Date(row.valid_from),
    validUntil: new Date(row.valid_until),
    scope: row.scope,
    isRevoked: row.is_revoked,
  }));
}

// ============================================================================
// Auto-Issue Credentials on Reservation Confirmation
// ============================================================================

export async function issueCredentialsForReservation(
  tenantId: string,
  reservationId: string,
  startAt: Date,
  endAt: Date,
  issuedBy?: string
): Promise<CredentialResult[]> {
  const credentials: CredentialResult[] = [];
  
  const qrCredential = await issueCredential({
    tenantId,
    reservationId,
    credentialType: 'qr',
    scope: 'facility_access',
    validFrom: startAt,
    validUntil: endAt,
    issuedBy,
  });
  credentials.push(qrCredential);
  
  const shortCodeCredential = await issueCredential({
    tenantId,
    reservationId,
    credentialType: 'short_code',
    scope: 'facility_access',
    validFrom: startAt,
    validUntil: endAt,
    issuedBy,
  });
  credentials.push(shortCodeCredential);
  
  return credentials;
}

// ============================================================================
// Test Function
// ============================================================================

export async function testAccessCredentials(): Promise<{
  success: boolean;
  credentialId?: string;
  shortCode?: string;
  validationResult?: ValidationResult;
  error?: string;
}> {
  try {
    const tenantResult = await db.execute(sql`
      SELECT id FROM cc_tenants LIMIT 1
    `);
    if (tenantResult.rows.length === 0) {
      return { success: false, error: 'No tenant found' };
    }
    const tenantId = (tenantResult.rows[0] as any).id;
    
    const reservationResult = await db.execute(sql`
      SELECT id, start_at, end_at FROM cc_reservations WHERE tenant_id = ${tenantId}::uuid LIMIT 1
    `);
    if (reservationResult.rows.length === 0) {
      return { success: false, error: 'No reservation found for testing' };
    }
    
    const reservation = reservationResult.rows[0] as any;
    
    const credential = await issueCredential({
      tenantId,
      reservationId: reservation.id,
      credentialType: 'short_code',
      scope: 'facility_access',
      validFrom: new Date(reservation.start_at),
      validUntil: new Date(reservation.end_at),
    });
    
    const validationResult = await validateShortCode(credential.shortCode!);
    
    return {
      success: validationResult.valid,
      credentialId: credential.id,
      shortCode: credential.shortCode,
      validationResult,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
