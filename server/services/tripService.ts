import { pool } from '../db';
import { nanoid } from 'nanoid';
import { logActivity } from './activityService';

interface CreateTripRequest {
  portalSlug?: string;
  portalId?: string;
  groupName: string;
  tripType?: 'leisure' | 'business' | 'wedding' | 'reunion' | 'corporate' | 'expedition' | 'other';
  startDate?: Date;
  endDate?: Date;
  primaryContactName: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  expectedAdults?: number;
  expectedChildren?: number;
  expectedInfants?: number;
  intent?: Record<string, any>;
  needs?: Record<string, any>;
  budget?: Record<string, any>;
  viralSource?: string;
  referrerTripId?: string;
}

interface TripResult {
  trip: any;
  accessCode: string;
  shareUrl: string;
}

interface InvitationRequest {
  tripId: string;
  invitationType: 'party_member' | 'co_planner' | 'kid_planner' | 'handoff_recipient' | 'partner_invite';
  recipientName?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  messageSubject?: string;
  messageBody?: string;
  senderName?: string;
  handoffId?: string;
  nextDestinationName?: string;
  expiresInDays?: number;
}

interface InvitationResult {
  invitation: any;
  inviteUrl: string;
  token: string;
}

function generateAccessCode(): string {
  const chars = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += '-';
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function generateInviteToken(): string {
  return nanoid(24);
}

function getShareUrl(accessCode: string): string {
  const baseUrl = process.env.PUBLIC_URL || 'https://communitycanvas.ca';
  return `${baseUrl}/trip/${accessCode}`;
}

function getInviteUrl(token: string): string {
  const baseUrl = process.env.PUBLIC_URL || 'https://communitycanvas.ca';
  return `${baseUrl}/invite/${token}`;
}

export async function createTrip(req: CreateTripRequest): Promise<TripResult> {
  let portalId = req.portalId || null;
  let tenantId: string | null = null;
  
  if (req.portalSlug && !portalId) {
    const portalResult = await pool.query(
      `SELECT id, owning_tenant_id FROM cc_portals WHERE slug = $1`,
      [req.portalSlug]
    );
    if (portalResult.rows[0]) {
      portalId = portalResult.rows[0].id;
      tenantId = portalResult.rows[0].owning_tenant_id;
    }
  }
  
  const accessCode = generateAccessCode();
  
  const result = await pool.query(`
    INSERT INTO cc_trips (
      portal_id, tenant_id, access_code, group_name, trip_type,
      start_date, end_date, primary_contact_name, primary_contact_email, primary_contact_phone,
      expected_adults, expected_children, expected_infants,
      intent_json, needs_json, budget_json, viral_json, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'planning')
    RETURNING *
  `, [
    portalId,
    tenantId,
    accessCode,
    req.groupName,
    req.tripType || 'leisure',
    req.startDate || null,
    req.endDate || null,
    req.primaryContactName,
    req.primaryContactEmail || null,
    req.primaryContactPhone || null,
    req.expectedAdults || 1,
    req.expectedChildren || 0,
    req.expectedInfants || 0,
    JSON.stringify(req.intent || {}),
    JSON.stringify(req.needs || {}),
    JSON.stringify(req.budget || {}),
    JSON.stringify({
      source: req.viralSource || 'direct',
      referrerTripId: req.referrerTripId || null
    })
  ]);
  
  const trip = result.rows[0];
  
  await logActivity({
    tenantId: tenantId || '__SERVICE__',
    actorId: undefined,
    action: 'trip.created',
    resourceType: 'trip',
    resourceId: trip.id,
    metadata: { accessCode, groupName: req.groupName, guestAction: true }
  });
  
  return {
    trip,
    accessCode,
    shareUrl: getShareUrl(accessCode)
  };
}

export async function getTrip(accessCode: string): Promise<any | null> {
  const result = await pool.query(
    `SELECT * FROM cc_trips WHERE access_code = $1`,
    [accessCode]
  );
  return result.rows[0] || null;
}

export async function getTripById(tripId: string): Promise<any | null> {
  const result = await pool.query(
    `SELECT * FROM cc_trips WHERE id = $1`,
    [tripId]
  );
  return result.rows[0] || null;
}

export async function updateTrip(
  accessCode: string,
  updates: Partial<{
    groupName: string;
    startDate: Date;
    endDate: Date;
    expectedAdults: number;
    expectedChildren: number;
    expectedInfants: number;
    status: string;
    intentJson: Record<string, any>;
    needsJson: Record<string, any>;
    budgetJson: Record<string, any>;
  }>
): Promise<any> {
  const setClauses: string[] = ['updated_at = now()'];
  const values: any[] = [];
  let paramIndex = 1;
  
  if (updates.groupName !== undefined) {
    setClauses.push(`group_name = $${paramIndex++}`);
    values.push(updates.groupName);
  }
  if (updates.startDate !== undefined) {
    setClauses.push(`start_date = $${paramIndex++}`);
    values.push(updates.startDate);
  }
  if (updates.endDate !== undefined) {
    setClauses.push(`end_date = $${paramIndex++}`);
    values.push(updates.endDate);
  }
  if (updates.expectedAdults !== undefined) {
    setClauses.push(`expected_adults = $${paramIndex++}`);
    values.push(updates.expectedAdults);
  }
  if (updates.expectedChildren !== undefined) {
    setClauses.push(`expected_children = $${paramIndex++}`);
    values.push(updates.expectedChildren);
  }
  if (updates.expectedInfants !== undefined) {
    setClauses.push(`expected_infants = $${paramIndex++}`);
    values.push(updates.expectedInfants);
  }
  if (updates.status !== undefined) {
    setClauses.push(`status = $${paramIndex++}`);
    values.push(updates.status);
  }
  if (updates.intentJson !== undefined) {
    setClauses.push(`intent_json = $${paramIndex++}`);
    values.push(JSON.stringify(updates.intentJson));
  }
  if (updates.needsJson !== undefined) {
    setClauses.push(`needs_json = $${paramIndex++}`);
    values.push(JSON.stringify(updates.needsJson));
  }
  if (updates.budgetJson !== undefined) {
    setClauses.push(`budget_json = $${paramIndex++}`);
    values.push(JSON.stringify(updates.budgetJson));
  }
  
  values.push(accessCode);
  
  const result = await pool.query(`
    UPDATE cc_trips SET ${setClauses.join(', ')}
    WHERE access_code = $${paramIndex}
    RETURNING *
  `, values);
  
  return result.rows[0];
}

export async function getTripCarts(tripId: string): Promise<any[]> {
  const result = await pool.query(
    `SELECT * FROM cc_reservation_carts WHERE trip_id = $1 ORDER BY created_at DESC`,
    [tripId]
  );
  return result.rows;
}

export async function createInvitation(req: InvitationRequest): Promise<InvitationResult> {
  const token = generateInviteToken();
  const expiresAt = new Date(Date.now() + (req.expiresInDays || 7) * 24 * 60 * 60 * 1000);
  
  const trip = await getTripById(req.tripId);
  
  let subject = req.messageSubject;
  if (!subject) {
    switch (req.invitationType) {
      case 'party_member':
        subject = `You're invited to join ${trip?.group_name || 'our trip'}!`;
        break;
      case 'co_planner':
        subject = `Help plan ${trip?.group_name || 'our trip'}`;
        break;
      case 'kid_planner':
        subject = `Add your activities to ${trip?.group_name || 'our trip'}!`;
        break;
      case 'handoff_recipient':
        subject = `Guest arriving from ${trip?.group_name || 'a trip'}`;
        break;
      case 'partner_invite':
        subject = `Join Community Canvas`;
        break;
    }
  }
  
  const result = await pool.query(`
    INSERT INTO cc_trip_invitations (
      trip_id, invitation_type, token,
      recipient_name, recipient_email, recipient_phone,
      handoff_id, next_destination_name,
      message_subject, message_body, sender_name,
      status, expires_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', $12)
    RETURNING *
  `, [
    req.tripId,
    req.invitationType,
    token,
    req.recipientName || null,
    req.recipientEmail || null,
    req.recipientPhone || null,
    req.handoffId || null,
    req.nextDestinationName || null,
    subject,
    req.messageBody || null,
    req.senderName || null,
    expiresAt
  ]);
  
  const invitation = result.rows[0];
  
  await logActivity({
    tenantId: trip?.tenant_id || '__SERVICE__',
    actorId: undefined,
    action: 'invitation.created',
    resourceType: 'invitation',
    resourceId: invitation.id,
    metadata: { 
      tripId: req.tripId, 
      type: req.invitationType,
      recipientEmail: req.recipientEmail 
    }
  });
  
  return {
    invitation,
    inviteUrl: getInviteUrl(token),
    token
  };
}

export async function getInvitation(token: string): Promise<any | null> {
  const result = await pool.query(
    `SELECT * FROM cc_trip_invitations WHERE token = $1`,
    [token]
  );
  
  const invitation = result.rows[0];
  if (!invitation) return null;
  
  if (invitation.status === 'pending' || invitation.status === 'sent') {
    await pool.query(
      `UPDATE cc_trip_invitations SET status = 'viewed', viewed_at = now() WHERE id = $1`,
      [invitation.id]
    );
    invitation.status = 'viewed';
    invitation.viewed_at = new Date();
  }
  
  const trip = await getTripById(invitation.trip_id);
  
  return { invitation, trip };
}

export async function acceptInvitation(
  token: string,
  accepterName?: string,
  accepterEmail?: string
): Promise<{ success: boolean; trip?: any; message: string }> {
  const result = await pool.query(
    `SELECT * FROM cc_trip_invitations WHERE token = $1`,
    [token]
  );
  
  const invitation = result.rows[0];
  
  if (!invitation) {
    return { success: false, message: 'Invitation not found' };
  }
  
  if (invitation.status === 'accepted') {
    const trip = await getTripById(invitation.trip_id);
    return { success: true, trip, message: 'Already accepted' };
  }
  
  if (invitation.status === 'expired' || (invitation.expires_at && new Date(invitation.expires_at) < new Date())) {
    return { success: false, message: 'Invitation has expired' };
  }
  
  if (invitation.status === 'declined') {
    return { success: false, message: 'Invitation was declined' };
  }
  
  await pool.query(`
    UPDATE cc_trip_invitations SET 
      status = 'accepted',
      accepted_at = now(),
      result_json = $1
    WHERE id = $2
  `, [
    JSON.stringify({
      accepterName,
      accepterEmail,
      acceptedAt: new Date().toISOString()
    }),
    invitation.id
  ]);
  
  const trip = await getTripById(invitation.trip_id);
  
  await logActivity({
    tenantId: trip?.tenant_id || '__SERVICE__',
    actorId: undefined,
    action: 'invitation.accepted',
    resourceType: 'invitation',
    resourceId: invitation.id,
    metadata: { 
      tripId: invitation.trip_id, 
      type: invitation.invitation_type,
      accepterEmail,
      guestAction: true
    }
  });
  
  return { 
    success: true, 
    trip, 
    message: `Welcome to ${trip?.group_name || 'the trip'}!` 
  };
}

export async function declineInvitation(token: string): Promise<{ success: boolean }> {
  await pool.query(
    `UPDATE cc_trip_invitations SET status = 'declined', declined_at = now() WHERE token = $1`,
    [token]
  );
  return { success: true };
}

export async function getTripInvitations(tripId: string): Promise<any[]> {
  const result = await pool.query(
    `SELECT * FROM cc_trip_invitations WHERE trip_id = $1 ORDER BY created_at DESC`,
    [tripId]
  );
  return result.rows;
}

export async function createTripCart(
  accessCode: string,
  cartOptions?: {
    primaryGuestName?: string;
    primaryGuestEmail?: string;
  }
): Promise<any> {
  const trip = await getTrip(accessCode);
  if (!trip) {
    throw new Error('Trip not found');
  }
  
  const { createCart } = await import('./cartService');
  
  return createCart({
    portalId: trip.portal_id,
    tenantId: trip.tenant_id,
    tripId: trip.id,
    source: 'trip',
    sourceRef: accessCode,
    primaryGuestName: cartOptions?.primaryGuestName || trip.primary_contact_name,
    primaryGuestEmail: cartOptions?.primaryGuestEmail || trip.primary_contact_email,
    partyAdults: trip.expected_adults,
    partyChildren: trip.expected_children,
    partyInfants: trip.expected_infants,
    needs: trip.needs_json,
    intent: trip.intent_json
  });
}
