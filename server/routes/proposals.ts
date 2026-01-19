/**
 * P-UI-08 Proposal API
 * 
 * Read/write endpoints to support the proposal/approver flow.
 * Uses existing cc_trips as the proposal container.
 * 
 * Key rules:
 * - Never use "book/booking" terminology
 * - Availability-first invariant
 * - No PII until Confirm (public) unless user is already authenticated
 * - Supports 10 participants, each paying their own folio
 * - Atomic drill-down to unit level
 */

import { Router } from 'express';
import { db } from '../db';
import { 
  ccTrips,
  ccTripPartyProfiles,
  cc_trip_invitations,
  ccFolios,
  ccFolioLedger,
  ccFolioLedgerLinks,
  ccSurfaceClaims,
  ccSurfaceUnits,
  ccSurfaceContainers,
  ccSurfaces,
  ccSurfaceContainerMembers,
} from '@shared/schema';
import { eq, and, sql, inArray, gte, lte } from 'drizzle-orm';
import { getFolioSummary, postCreditReversal, createIncident, type ChargeCategory } from '../lib/ledger/folioLedger';
import { nanoid } from 'nanoid';
import { z } from 'zod';

const router = Router();

/**
 * Helper to anonymize participant names for public view
 */
function anonymizeName(index: number): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return `Guest ${letters[index % 26]}`;
}

/**
 * Build container path for a surface (breadcrumb trail via container members)
 */
async function getContainerPath(surfaceId: string): Promise<string[]> {
  const member = await db.query.ccSurfaceContainerMembers.findFirst({
    where: eq(ccSurfaceContainerMembers.surfaceId, surfaceId),
  });
  
  if (!member?.containerId) return [];
  
  const path: string[] = [];
  let nextId: string | null = member.containerId;
  
  while (nextId) {
    const rows = await db.execute(sql`
      SELECT title, container_type, parent_container_id 
      FROM cc_surface_containers 
      WHERE id = ${nextId}
      LIMIT 1
    `);
    
    const row = rows.rows[0] as { title: string; container_type: string; parent_container_id: string | null } | undefined;
    if (!row) break;
    path.unshift(row.title || row.container_type || 'Container');
    nextId = row.parent_container_id;
  }
  
  return path;
}

/**
 * GET /api/p2/app/proposals/:proposalId
 * 
 * Returns full proposal detail including:
 * - Proposal summary (dates, status)
 * - Participants list (anonymized for public pre-confirm)
 * - Allocations per participant with unit details
 * - Folio summaries per participant
 * - N3 advisories (optional)
 */
router.get('/:proposalId', async (req, res) => {
  try {
    const { proposalId } = req.params;
    const isAuthenticated = !!(req as any).user?.id;
    
    const trip = await db.query.ccTrips.findFirst({
      where: eq(ccTrips.id, proposalId),
    });
    
    if (!trip) {
      return res.status(404).json({ ok: false, error: 'Proposal not found' });
    }
    
    const participants = await db
      .select()
      .from(ccTripPartyProfiles)
      .where(eq(ccTripPartyProfiles.tripId, proposalId));
    
    const participantIds = participants.map(p => p.id);
    const partyIds = participants.map(p => p.partyId).filter((id): id is string => !!id);
    
    const claims = participantIds.length > 0 
      ? await db
          .select()
          .from(ccSurfaceClaims)
          .where(
            and(
              eq(ccSurfaceClaims.portalId, trip.portalId!),
              inArray(ccSurfaceClaims.assignedParticipantId, participantIds)
            )
          )
      : [];
    
    const unassignedClaims = trip.portalId ? await db
      .select()
      .from(ccSurfaceClaims)
      .where(
        and(
          eq(ccSurfaceClaims.portalId, trip.portalId),
          sql`${ccSurfaceClaims.assignedParticipantId} IS NULL`,
          gte(ccSurfaceClaims.timeStart, trip.startDate ? new Date(trip.startDate) : new Date()),
          lte(ccSurfaceClaims.timeEnd, trip.endDate ? new Date(trip.endDate) : new Date())
        )
      ) : [];
    
    const allUnitIds: string[] = [];
    for (const c of claims) {
      if (c.unitIds) allUnitIds.push(...c.unitIds.filter(Boolean) as string[]);
    }
    for (const c of unassignedClaims) {
      if (c.unitIds) allUnitIds.push(...c.unitIds.filter(Boolean) as string[]);
    }
    const uniqueUnitIds = Array.from(new Set(allUnitIds));
    
    const units = uniqueUnitIds.length > 0
      ? await db
          .select()
          .from(ccSurfaceUnits)
          .where(inArray(ccSurfaceUnits.id, uniqueUnitIds))
      : [];
    
    const unitMap = new Map(units.map(u => [u.id, u]));
    
    const folios = partyIds.length > 0 && trip.tenantId
      ? await db
          .select()
          .from(ccFolios)
          .where(
            and(
              eq(ccFolios.tenantId, trip.tenantId),
              inArray(ccFolios.guestPartyId, partyIds)
            )
          )
      : [];
    
    const folioSummaries = await Promise.all(
      folios.map(f => getFolioSummary(f.id, f.guestName))
    );
    
    const allocations = await Promise.all(
      participants.map(async (p, idx) => {
        const participantClaims = claims.filter(c => c.assignedParticipantId === p.id);
        const allocationUnits = await Promise.all(
          participantClaims.map(async (claim) => {
            const claimUnits = (claim.unitIds || []).filter(Boolean) as string[];
            const unitDetails = claimUnits.map(uid => {
              const unit = unitMap.get(uid);
              return {
                unit_id: uid,
                unit_type: unit?.unitType || 'unknown',
                unit_label: unit?.label || null,
              };
            });
            
            const firstUnit = claimUnits[0] ? unitMap.get(claimUnits[0]) : null;
            const containerPath = firstUnit?.surfaceId 
              ? await getContainerPath(firstUnit.surfaceId) 
              : [];
            
            return {
              claim_id: claim.id,
              units: unitDetails,
              container_path: containerPath,
              time_start: claim.timeStart,
              time_end: claim.timeEnd,
              claim_status: claim.claimStatus,
            };
          })
        );
        
        return {
          participant_id: p.id,
          display_name: isAuthenticated || trip.status === 'confirmed' 
            ? p.displayName 
            : anonymizeName(idx),
          role: p.role,
          allocations: allocationUnits,
        };
      })
    );
    
    const unassignedAllocations = await Promise.all(
      unassignedClaims.map(async (claim) => {
        const claimUnits = (claim.unitIds || []).filter(Boolean) as string[];
        const unitDetails = claimUnits.map(uid => {
          const unit = unitMap.get(uid);
          return {
            unit_id: uid,
            unit_type: unit?.unitType || 'unknown',
            unit_label: unit?.label || null,
          };
        });
        
        const firstUnit = claimUnits[0] ? unitMap.get(claimUnits[0]) : null;
        const containerPath = firstUnit?.surfaceId 
          ? await getContainerPath(firstUnit.surfaceId) 
          : [];
        
        return {
          claim_id: claim.id,
          units: unitDetails,
          container_path: containerPath,
          time_start: claim.timeStart,
          time_end: claim.timeEnd,
          claim_status: claim.claimStatus,
        };
      })
    );
    
    const foliosByParticipant = folios.reduce((acc, f) => {
      acc[f.guestPartyId] = {
        folio_id: f.id,
        folio_number: f.folioNumber,
        status: f.status,
        summary: folioSummaries.find(s => s.folioId === f.id) || null,
      };
      return acc;
    }, {} as Record<string, any>);
    
    const response = {
      ok: true,
      proposal: {
        id: trip.id,
        title: trip.groupName || 'Untitled Proposal',
        status: trip.status || 'draft',
        time_start: trip.startDate,
        time_end: trip.endDate,
        portal_id: trip.portalId,
        tenant_id: trip.tenantId,
        group_size: trip.groupSize,
        created_at: trip.createdAt,
      },
      participants: participants.map((p, idx) => ({
        id: p.id,
        display_name: isAuthenticated || trip.status === 'confirmed'
          ? p.displayName
          : anonymizeName(idx),
        role: p.role,
        folio: p.partyId ? (foliosByParticipant[p.partyId] || null) : null,
      })),
      allocations,
      unassigned_units: unassignedAllocations,
      n3_advisories: [],
    };
    
    res.json(response);
  } catch (error: any) {
    console.error('[Proposals] GET detail error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * POST /api/p2/app/proposals/:proposalId/invite
 * 
 * Create an invitation record with secure token
 */
const inviteSchema = z.object({
  contact: z.object({
    email: z.string().email().optional(),
    phone: z.string().optional(),
    display_name: z.string().optional(),
  }),
  role: z.enum(['party_member', 'co_planner', 'kid_planner', 'handoff_recipient', 'partner_invite']).default('party_member'),
  note: z.string().optional(),
});

router.post('/:proposalId/invite', async (req, res) => {
  try {
    const { proposalId } = req.params;
    const body = inviteSchema.parse(req.body);
    
    const trip = await db.query.ccTrips.findFirst({
      where: eq(ccTrips.id, proposalId),
    });
    
    if (!trip) {
      return res.status(404).json({ ok: false, error: 'Proposal not found' });
    }
    
    const token = nanoid(24);
    
    const [invitation] = await db
      .insert(cc_trip_invitations)
      .values({
        tripId: proposalId,
        invitationType: body.role,
        token,
        recipientEmail: body.contact.email,
        recipientPhone: body.contact.phone,
        messageBody: body.note,
        status: 'pending',
      })
      .returning();
    
    res.json({
      ok: true,
      invitation: {
        id: invitation.id,
        token,
        role: body.role,
        view_url: `/trip/${trip.accessCode || proposalId}/invite/${token}`,
      },
    });
  } catch (error: any) {
    console.error('[Proposals] POST invite error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * POST /api/p2/app/proposals/:proposalId/assign
 * 
 * Assign units to a participant
 */
const assignSchema = z.object({
  participant_id: z.string().uuid(),
  unit_ids: z.array(z.string().uuid()),
});

router.post('/:proposalId/assign', async (req, res) => {
  try {
    const { proposalId } = req.params;
    const body = assignSchema.parse(req.body);
    
    const trip = await db.query.ccTrips.findFirst({
      where: eq(ccTrips.id, proposalId),
    });
    
    if (!trip) {
      return res.status(404).json({ ok: false, error: 'Proposal not found' });
    }
    
    const participant = await db.query.ccTripPartyProfiles.findFirst({
      where: and(
        eq(ccTripPartyProfiles.id, body.participant_id),
        eq(ccTripPartyProfiles.tripId, proposalId)
      ),
    });
    
    if (!participant) {
      return res.status(404).json({ ok: false, error: 'Participant not found in this proposal' });
    }
    
    const claimsWithUnits = trip.portalId 
      ? await db.execute(sql`
          SELECT id FROM cc_surface_claims 
          WHERE portal_id = ${trip.portalId}
          AND unit_ids && ARRAY[${sql.join(body.unit_ids.map(id => sql`${id}::uuid`), sql`, `)}]
        `)
      : { rows: [] };
    
    if (claimsWithUnits.rows.length === 0) {
      return res.status(400).json({ ok: false, error: 'No claims found containing specified units' });
    }
    
    const claimIds = claimsWithUnits.rows.map((r: any) => r.id);
    await db
      .update(ccSurfaceClaims)
      .set({ assignedParticipantId: body.participant_id })
      .where(inArray(ccSurfaceClaims.id, claimIds));
    
    const updatedClaims = await db
      .select()
      .from(ccSurfaceClaims)
      .where(eq(ccSurfaceClaims.assignedParticipantId, body.participant_id));
    
    res.json({
      ok: true,
      assigned: {
        participant_id: body.participant_id,
        claim_ids: claimIds,
        total_claims: updatedClaims.length,
      },
    });
  } catch (error: any) {
    console.error('[Proposals] POST assign error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * POST /api/p2/app/folios/:folioId/pay
 * 
 * Test payment stub - adds payment entry to folio ledger
 */
const paySchema = z.object({
  amount_cents: z.number().positive(),
  method: z.enum(['test', 'stripe']).default('test'),
  note: z.string().optional(),
});

router.post('/folios/:folioId/pay', async (req, res) => {
  try {
    const { folioId } = req.params;
    const body = paySchema.parse(req.body);
    
    const folio = await db.query.ccFolios.findFirst({
      where: eq(ccFolios.id, folioId),
    });
    
    if (!folio) {
      return res.status(404).json({ ok: false, error: 'Folio not found' });
    }
    
    const referenceId = `PAY-${nanoid(8)}`;
    const sequenceResult = await db
      .select({ maxSeq: sql<number>`COALESCE(MAX(sequence_number), 0)` })
      .from(ccFolioLedger)
      .where(eq(ccFolioLedger.folioId, folioId));
    const sequenceNumber = (sequenceResult[0]?.maxSeq ?? 0) + 1;
    
    const [entry] = await db
      .insert(ccFolioLedger)
      .values({
        tenantId: folio.tenantId,
        folioId,
        entryType: 'payment',
        amountCents: -body.amount_cents,
        referenceType: 'payment',
        paymentMethod: body.method,
        paymentReference: referenceId,
        description: body.note || `${body.method.toUpperCase()} payment`,
        sequenceNumber,
        currency: 'CAD',
      })
      .returning();
    
    const summary = await getFolioSummary(folioId, folio.guestName);
    
    res.json({
      ok: true,
      payment: {
        entry_id: entry.id,
        reference_id: referenceId,
        amount_cents: body.amount_cents,
        method: body.method,
      },
      folio_summary: summary,
    });
  } catch (error: any) {
    console.error('[Proposals] POST pay error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * POST /api/p2/app/folios/:folioId/credit
 * 
 * Issue incident credit (operator only)
 */
const creditSchema = z.object({
  ref_ledger_id: z.string().uuid(),
  amount_cents: z.number().positive(),
  incident_type: z.enum(['illness_refund', 'staff_damage', 'goodwill_refund', 'injury', 'other']),
  notes: z.string().optional(),
});

router.post('/folios/:folioId/credit', async (req, res) => {
  try {
    const { folioId } = req.params;
    const body = creditSchema.parse(req.body);
    
    const folio = await db.query.ccFolios.findFirst({
      where: eq(ccFolios.id, folioId),
    });
    
    if (!folio) {
      return res.status(404).json({ ok: false, error: 'Folio not found' });
    }
    
    const originalEntry = await db.query.ccFolioLedger.findFirst({
      where: eq(ccFolioLedger.id, body.ref_ledger_id),
    });
    
    if (!originalEntry) {
      return res.status(404).json({ ok: false, error: 'Referenced ledger entry not found' });
    }
    
    const portal = await db.execute(sql`
      SELECT id FROM cc_portals WHERE owning_tenant_id = ${folio.tenantId} LIMIT 1
    `);
    const portalId = portal.rows[0]?.id as string;
    
    if (!portalId) {
      return res.status(400).json({ ok: false, error: 'No portal found for tenant' });
    }
    
    const { incidentId } = await createIncident({
      portalId,
      tenantId: folio.tenantId,
      incidentType: body.incident_type,
      affectedParticipantId: folio.guestPartyId,
      notes: body.notes,
    });
    
    const reasonCodeMap: Record<string, "illness" | "staff_damage" | "goodwill" | "other"> = {
      illness_refund: 'illness',
      staff_damage: 'staff_damage',
      goodwill_refund: 'goodwill',
      injury: 'other',
      other: 'other',
    };
    
    const { ledgerEntryId, linkId } = await postCreditReversal({
      folioId,
      tenantId: folio.tenantId,
      amountCents: body.amount_cents,
      description: `${body.incident_type.replace(/_/g, ' ')} credit`,
      refFolioLedgerId: body.ref_ledger_id,
      portalId,
      incidentId,
      category: (originalEntry.referenceType || 'other') as ChargeCategory,
      reasonCode: reasonCodeMap[body.incident_type],
    });
    
    const summary = await getFolioSummary(folioId, folio.guestName);
    
    res.json({
      ok: true,
      credit: {
        incident_id: incidentId,
        ledger_entry_id: ledgerEntryId,
        link_id: linkId,
        amount_cents: body.amount_cents,
        incident_type: body.incident_type,
      },
      folio_summary: summary,
    });
  } catch (error: any) {
    console.error('[Proposals] POST credit error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;
