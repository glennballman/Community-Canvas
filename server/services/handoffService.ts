import { db } from '../db';
import { eq, desc } from 'drizzle-orm';
import { ccTripHandoffs } from '@shared/schema';
import { getTrip, createInvitation } from './tripService';
import { aggregateNeeds } from './partyService';

interface CreateHandoffRequest {
  tripAccessCode: string;
  nextDestinationName: string;
  nextDestinationAddress?: string;
  nextDestinationPhone?: string;
  nextDestinationEmail?: string;
  nextDestinationPortalId?: string;
  plannedDepartureDate?: Date;
  plannedDepartureTime?: string;
  transportMode?: 'self_drive' | 'ferry' | 'seaplane' | 'water_taxi' | 'shuttle' | 'other';
  transportDetails?: string;
  transportBookingRef?: string;
  consentShareDietary?: boolean;
  consentShareAccessibility?: boolean;
  consentShareMedical?: boolean;
  consentSharePreferences?: boolean;
  notesForNext?: string;
  specialArrangements?: string;
  notifyNextProperty?: boolean;
}

interface HandoffResult {
  handoff: any;
  invitation?: any;
  inviteUrl?: string;
}

export async function createHandoff(req: CreateHandoffRequest): Promise<HandoffResult> {
  const trip = await getTrip(req.tripAccessCode);
  if (!trip) {
    throw new Error('Trip not found');
  }
  
  let needsSnapshot: Record<string, any> = {};
  
  if (req.consentShareDietary || req.consentShareAccessibility || req.consentShareMedical) {
    const aggregated = await aggregateNeeds(trip.id);
    
    if (req.consentShareDietary) {
      needsSnapshot.dietary = aggregated.dietary;
    }
    if (req.consentShareAccessibility) {
      needsSnapshot.accessibility = aggregated.accessibility;
    }
    if (req.consentShareMedical) {
      needsSnapshot.medical = {
        powerCritical: aggregated.medical.powerCritical,
      };
    }
    
    needsSnapshot.partyComposition = aggregated.partyComposition;
  }
  
  const [handoff] = await db.insert(ccTripHandoffs).values({
    tripId: trip.id,
    fromPortalId: trip.portal_id || trip.portalId,
    fromTenantId: trip.tenant_id || trip.tenantId,
    nextDestinationName: req.nextDestinationName,
    nextDestinationAddress: req.nextDestinationAddress,
    nextDestinationPhone: req.nextDestinationPhone,
    nextDestinationEmail: req.nextDestinationEmail,
    nextDestinationPortalId: req.nextDestinationPortalId,
    plannedDepartureDate: req.plannedDepartureDate ? req.plannedDepartureDate.toISOString().split('T')[0] : undefined,
    plannedDepartureTime: req.plannedDepartureTime,
    transportMode: req.transportMode,
    transportDetails: req.transportDetails,
    transportBookingRef: req.transportBookingRef,
    consentShareDietary: req.consentShareDietary || false,
    consentShareAccessibility: req.consentShareAccessibility || false,
    consentShareMedical: req.consentShareMedical || false,
    consentSharePreferences: req.consentSharePreferences || false,
    needsSnapshot,
    notesForNext: req.notesForNext,
    specialArrangements: req.specialArrangements,
    status: 'draft'
  }).returning();
  
  const result: HandoffResult = { handoff };
  
  if (req.notifyNextProperty && req.nextDestinationEmail) {
    const invitation = await createInvitation({
      tripId: trip.id,
      invitationType: 'handoff_recipient',
      recipientName: req.nextDestinationName,
      recipientEmail: req.nextDestinationEmail,
      recipientPhone: req.nextDestinationPhone,
      handoffId: handoff.id,
      nextDestinationName: req.nextDestinationName,
      senderName: trip.primary_contact_name || trip.primaryContactName,
      messageSubject: `Guest arriving from ${trip.group_name || trip.groupName}`,
      messageBody: `A guest party is heading your way! They've shared some details to help you prepare.`,
      expiresInDays: 14
    });
    
    await db.update(ccTripHandoffs)
      .set({
        partnerInvitationId: invitation.invitation.id,
        partnerInvitationSent: true,
        partnerInvitationSentAt: new Date(),
        status: 'sent',
        updatedAt: new Date()
      })
      .where(eq(ccTripHandoffs.id, handoff.id));
    
    result.invitation = invitation.invitation;
    result.inviteUrl = invitation.inviteUrl;
  }
  
  return result;
}

export async function getHandoff(handoffId: string): Promise<any | null> {
  const results = await db.select()
    .from(ccTripHandoffs)
    .where(eq(ccTripHandoffs.id, handoffId))
    .limit(1);
  return results[0] || null;
}

export async function getTripHandoffs(tripId: string): Promise<any[]> {
  return db.select()
    .from(ccTripHandoffs)
    .where(eq(ccTripHandoffs.tripId, tripId))
    .orderBy(desc(ccTripHandoffs.createdAt));
}

export async function acknowledgeHandoff(handoffId: string): Promise<any> {
  const [updated] = await db.update(ccTripHandoffs)
    .set({
      status: 'acknowledged',
      partnerAccepted: true,
      partnerAcceptedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(ccTripHandoffs.id, handoffId))
    .returning();
  
  return updated;
}

export async function completeHandoff(
  handoffId: string,
  actualDepartureAt?: Date
): Promise<any> {
  const [updated] = await db.update(ccTripHandoffs)
    .set({
      status: 'completed',
      actualDepartureAt: actualDepartureAt || new Date(),
      updatedAt: new Date()
    })
    .where(eq(ccTripHandoffs.id, handoffId))
    .returning();
  
  return updated;
}
