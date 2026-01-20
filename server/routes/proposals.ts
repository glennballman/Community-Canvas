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
    
    // Fetch portal if present
    let portal: { id: string; slug: string; name: string } | null = null;
    if (trip.portalId) {
      const portalResult = await db.execute(sql`
        SELECT id, slug, title as name FROM cc_portals WHERE id = ${trip.portalId} LIMIT 1
      `);
      if (portalResult.rows.length > 0) {
        const row = portalResult.rows[0] as { id: string; slug: string; name: string };
        portal = { id: row.id, slug: row.slug, name: row.name };
      }
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
      portal,
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

// ============================================================================
// P-UI-10: Availability → Proposal Handoff + Forward-to-Approver + N3 Risk
// ============================================================================

/**
 * POST /api/p2/public/proposals/from-cart
 * 
 * Create a proposal from cart selections with holds on atomic units
 * AVAILABILITY-FIRST: Creates holds, not confirmed reservations
 * NO PII: Creates anonymized planner until Confirm step
 */
const fromCartSchema = z.object({
  portal_id: z.string().uuid(),
  time_start: z.string(),
  time_end: z.string(),
  selections: z.array(z.object({
    container_id: z.string().uuid(),
    unit_type: z.string(),
    requested_units: z.number().positive(),
    time_start: z.string().optional(),
    time_end: z.string().optional(),
  })),
});

router.post('/from-cart', async (req, res) => {
  try {
    const body = fromCartSchema.parse(req.body);
    const portalId = body.portal_id;
    
    const portal = await db.execute(sql`
      SELECT id, owning_tenant_id, title FROM cc_portals WHERE id = ${portalId} LIMIT 1
    `);
    
    if (portal.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Portal not found' });
    }
    
    const tenantId = portal.rows[0].owning_tenant_id as string;
    const portalTitle = portal.rows[0].title as string;
    const holdToken = `hold_${nanoid(16)}`;
    const timeStart = new Date(body.time_start);
    const timeEnd = new Date(body.time_end);
    
    const startDateStr = timeStart.toISOString().split('T')[0];
    const endDateStr = timeEnd.toISOString().split('T')[0];
    
    const [trip] = await db.insert(ccTrips).values({
      portalId,
      tenantId,
      groupName: `Reservation at ${portalTitle}`,
      status: 'planning',
      startDate: startDateStr,
      endDate: endDateStr,
      groupSize: body.selections.reduce((sum, s) => sum + s.requested_units, 0),
      accessCode: nanoid(8),
    }).returning();
    
    const [primaryPlanner] = await db.insert(ccTripPartyProfiles).values({
      tripId: trip.id,
      displayName: 'Primary Planner',
      role: 'organizer',
      partyId: null,
    }).returning();
    
    const [folio] = await db.insert(ccFolios).values({
      tenantId,
      folioNumber: `F-${nanoid(8).toUpperCase()}`,
      guestName: 'Primary Planner',
      guestPartyId: trip.id,
      currency: 'CAD',
      status: 'open',
      checkInDate: startDateStr,
      checkOutDate: endDateStr,
      nightlyRateCents: 0,
    }).returning();
    
    await db.update(ccTripPartyProfiles)
      .set({ partyId: trip.id })
      .where(eq(ccTripPartyProfiles.id, primaryPlanner.id));
    
    const createdClaims: { claimId: string; unitIds: string[]; containerId: string }[] = [];
    
    for (const selection of body.selections) {
      const selectionStart = selection.time_start ? new Date(selection.time_start) : timeStart;
      const selectionEnd = selection.time_end ? new Date(selection.time_end) : timeEnd;
      
      const availableUnits = await db.execute(sql`
        SELECT su.id, su.label, su.unit_type, su.sort_order
        FROM cc_surface_units su
        JOIN cc_surface_container_members scm ON scm.surface_id = su.surface_id
        WHERE scm.container_id = ${selection.container_id}
        AND su.unit_type = ${selection.unit_type}
        AND su.status = 'available'
        AND su.id NOT IN (
          SELECT unnest(unit_ids) FROM cc_surface_claims
          WHERE portal_id = ${portalId}
          AND claim_status IN ('hold', 'confirmed')
          AND time_start < ${selectionEnd}
          AND time_end > ${selectionStart}
        )
        ORDER BY su.sort_order ASC, su.id ASC
        LIMIT ${selection.requested_units}
      `);
      
      if (availableUnits.rows.length < selection.requested_units) {
        await db.delete(ccTrips).where(eq(ccTrips.id, trip.id));
        return res.status(409).json({ 
          ok: false, 
          error: `Insufficient availability for ${selection.unit_type} in selected container. Requested ${selection.requested_units}, available ${availableUnits.rows.length}` 
        });
      }
      
      const unitIds = availableUnits.rows.map((r: any) => r.id as string);
      
      const [claim] = await db.insert(ccSurfaceClaims).values({
        portalId,
        tenantId,
        containerId: selection.container_id,
        holdToken,
        claimStatus: 'hold',
        timeStart: selectionStart,
        timeEnd: selectionEnd,
        unitIds,
        assignedParticipantId: primaryPlanner.id,
        metadata: { createdFromCart: true, unitType: selection.unit_type },
      }).returning();
      
      createdClaims.push({ claimId: claim.id, unitIds, containerId: selection.container_id });
    }
    
    res.json({
      ok: true,
      proposalId: trip.id,
      holdToken,
      viewUrl: `/p/proposal/${trip.id}`,
      claims: createdClaims,
      folio_id: folio.id,
    });
  } catch (error: any) {
    console.error('[Proposals] POST from-cart error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * POST /api/p2/public/proposals/:proposalId/release
 * 
 * Release held units and cancel/draft the proposal
 */
const releaseSchema = z.object({
  holdToken: z.string(),
});

router.post('/:proposalId/release', async (req, res) => {
  try {
    const { proposalId } = req.params;
    const body = releaseSchema.parse(req.body);
    
    const trip = await db.query.ccTrips.findFirst({
      where: eq(ccTrips.id, proposalId),
    });
    
    if (!trip) {
      return res.status(404).json({ ok: false, error: 'Proposal not found' });
    }
    
    const claims = await db
      .select()
      .from(ccSurfaceClaims)
      .where(
        and(
          eq(ccSurfaceClaims.portalId, trip.portalId!),
          eq(ccSurfaceClaims.holdToken, body.holdToken),
          eq(ccSurfaceClaims.claimStatus, 'hold')
        )
      );
    
    if (claims.length === 0) {
      return res.status(404).json({ ok: false, error: 'No holds found with this token' });
    }
    
    await db
      .update(ccSurfaceClaims)
      .set({ claimStatus: 'released', updatedAt: new Date() })
      .where(
        and(
          eq(ccSurfaceClaims.portalId, trip.portalId!),
          eq(ccSurfaceClaims.holdToken, body.holdToken)
        )
      );
    
    await db
      .update(ccTrips)
      .set({ status: 'draft' })
      .where(eq(ccTrips.id, proposalId));
    
    res.json({
      ok: true,
      released_claims: claims.length,
      proposal_status: 'draft',
    });
  } catch (error: any) {
    console.error('[Proposals] POST release error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * POST /api/p2/public/proposals/:proposalId/confirm
 * 
 * Confirm the proposal - now PII can be stored
 * Converts holds to confirmed claims
 */
const confirmSchema = z.object({
  holdToken: z.string(),
  contact: z.object({
    email: z.string().email().optional(),
    phone: z.string().optional(),
  }),
  primary_name: z.string().min(1),
});

router.post('/:proposalId/confirm', async (req, res) => {
  try {
    const { proposalId } = req.params;
    const body = confirmSchema.parse(req.body);
    
    const trip = await db.query.ccTrips.findFirst({
      where: eq(ccTrips.id, proposalId),
    });
    
    if (!trip) {
      return res.status(404).json({ ok: false, error: 'Proposal not found' });
    }
    
    const claims = await db
      .select()
      .from(ccSurfaceClaims)
      .where(
        and(
          eq(ccSurfaceClaims.portalId, trip.portalId!),
          eq(ccSurfaceClaims.holdToken, body.holdToken),
          eq(ccSurfaceClaims.claimStatus, 'hold')
        )
      );
    
    if (claims.length === 0) {
      return res.status(404).json({ ok: false, error: 'No holds found with this token' });
    }
    
    await db
      .update(ccSurfaceClaims)
      .set({ claimStatus: 'confirmed', updatedAt: new Date() })
      .where(
        and(
          eq(ccSurfaceClaims.portalId, trip.portalId!),
          eq(ccSurfaceClaims.holdToken, body.holdToken)
        )
      );
    
    await db
      .update(ccTrips)
      .set({ status: 'confirmed' })
      .where(eq(ccTrips.id, proposalId));
    
    const primaryPlanner = await db.query.ccTripPartyProfiles.findFirst({
      where: and(
        eq(ccTripPartyProfiles.tripId, proposalId),
        eq(ccTripPartyProfiles.role, 'organizer')
      ),
    });
    
    if (primaryPlanner) {
      await db
        .update(ccTripPartyProfiles)
        .set({ displayName: body.primary_name })
        .where(eq(ccTripPartyProfiles.id, primaryPlanner.id));
      
      const folio = await db.query.ccFolios.findFirst({
        where: eq(ccFolios.guestPartyId, trip.id),
      });
      
      if (folio) {
        await db
          .update(ccFolios)
          .set({ guestName: body.primary_name, guestEmail: body.contact.email })
          .where(eq(ccFolios.id, folio.id));
      }
    }
    
    res.json({
      ok: true,
      confirmed_claims: claims.length,
      proposal_status: 'confirmed',
      view_url: `/p/proposal/${proposalId}`,
    });
  } catch (error: any) {
    console.error('[Proposals] POST confirm error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * POST /api/p2/app/proposals/:proposalId/handoff
 * 
 * Forward proposal to approver (handoff recipient)
 * Separate from party_member invites - this is the "send to boss" flow
 */
const handoffSchema = z.object({
  role: z.literal('handoff_recipient').default('handoff_recipient'),
  email: z.string().email(),
  note: z.string().optional(),
});

router.post('/:proposalId/handoff', async (req, res) => {
  try {
    const { proposalId } = req.params;
    const body = handoffSchema.parse(req.body);
    
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
        invitationType: 'handoff_recipient',
        token,
        recipientEmail: body.email,
        messageBody: body.note || 'Please review and approve this reservation proposal.',
        status: 'pending',
      })
      .returning();
    
    const handoffUrl = `/p/proposal/${proposalId}?token=${token}`;
    
    res.json({
      ok: true,
      invitation_id: invitation.id,
      handoffUrl,
      token,
      recipient_email: body.email,
    });
  } catch (error: any) {
    console.error('[Proposals] POST handoff error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * GET /api/p2/public/proposals/:proposalId/risk
 * 
 * Get N3 risk advisories for the proposal
 * Returns top risk score and mitigations
 */
router.get('/:proposalId/risk', async (req, res) => {
  try {
    const { proposalId } = req.params;
    
    const trip = await db.query.ccTrips.findFirst({
      where: eq(ccTrips.id, proposalId),
    });
    
    if (!trip) {
      return res.status(404).json({ ok: false, error: 'Proposal not found' });
    }
    
    const n3Runs = await db.execute(sql`
      SELECT r.id, r.run_date, r.risk_score, r.fingerprint, r.created_at,
             s.id as segment_id, s.segment_kind, s.starts_at, s.ends_at, s.location_ref
      FROM cc_n3_runs r
      LEFT JOIN cc_n3_segments s ON s.run_id = r.id
      WHERE r.portal_id = ${trip.portalId}
      AND r.run_date >= ${trip.startDate}
      AND r.run_date <= ${trip.endDate}
      ORDER BY r.risk_score DESC
      LIMIT 10
    `);
    
    let topRiskScore = 0;
    const advisories: { reason: string; mitigation: string; severity: string }[] = [];
    
    if (n3Runs.rows.length > 0) {
      topRiskScore = Math.max(...n3Runs.rows.map((r: any) => r.risk_score || 0));
      
      for (const run of n3Runs.rows) {
        const riskScore = (run as any).risk_score || 0;
        const segmentKind = (run as any).segment_kind as string;
        
        if (riskScore >= 0.5 && segmentKind === 'arrival') {
          advisories.push({
            reason: 'Low tide during arrival window',
            mitigation: 'Consider shifting arrival to high tide window for easier ramp access',
            severity: riskScore >= 0.7 ? 'high' : 'medium',
          });
        }
        
        if (riskScore >= 0.4 && segmentKind === 'activity') {
          advisories.push({
            reason: 'Wind advisory during activity window',
            mitigation: 'Watercraft activities may require sheltered alternatives',
            severity: riskScore >= 0.6 ? 'high' : 'medium',
          });
        }
      }
    }
    
    if (advisories.length === 0 && topRiskScore < 0.25) {
      advisories.push({
        reason: 'No significant risk factors detected',
        mitigation: 'Conditions look favorable for your planned dates',
        severity: 'low',
      });
    }
    
    res.json({
      ok: true,
      riskScore: topRiskScore,
      advisories,
      evaluatedRuns: n3Runs.rows.length,
    });
  } catch (error: any) {
    console.error('[Proposals] GET risk error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;
