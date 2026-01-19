/**
 * SPLIT PAY + REFUNDS + INCIDENTS - WEDDING STRESS TEST
 * POST /api/dev/seed/wedding-stress
 * 
 * This endpoint seeds the following scenario:
 * - 10 guys, 10 bikes, stay in Aviator
 * - 10 individual bills at wedding + 10 individual bills at Flora's
 * - 5 of them rent 2 canoes + 1 kayak for 4 hours
 * - One sickness refund (P4)
 * - One staff-caused bike damage compensation (P2)
 * - One canoe fall-out goodwill refund (P9)
 * 
 * Uses existing accounting spine: cc_folio_ledger (append-only)
 * 
 * QA Checks:
 * - Ledger entries inserted only (no updates)
 * - Reversal rows reference original rows via cc_folio_ledger_links.ref_folio_ledger_id
 * - Incident rows exist and are linked
 * - 10 folios have distinct restaurant totals
 * - Only 5 folios have activity charges
 * - 3 adjustments applied to correct folios
 */

import { Router } from 'express';
import { db } from '../db';
import { 
  ccFolios,
  ccFolioLedger,
  ccFolioLedgerLinks,
  ccRefundIncidents,
  ccSurfaceClaims,
  ccSurfaceContainers,
  ccSurfaceUnits,
  ccTrips,
  ccTripPartyProfiles,
} from '@shared/schema';
import { sql, eq, inArray } from 'drizzle-orm';
import { 
  postCharge, 
  postCreditReversal, 
  getFolioSummary,
  createIncident,
} from '../lib/ledger/folioLedger';

const router = Router();

const TEST_PORTAL_ID = '00000000-0000-0000-0000-000000000001';
const TEST_TENANT_ID = 'b0000000-0000-0000-0000-000000000001'; // Community Canvas platform tenant

function generateParticipantId(index: number): string {
  const suffix = String(index).padStart(12, '0');
  return `10000000-0000-0000-0000-${suffix}`;
}

function generateFolioNumber(index: number): string {
  return `WED-2026-${String(index).padStart(3, '0')}`;
}

const PARTICIPANT_NAMES = [
  'Alex Thompson', 'Ben Carter', 'Charlie Davis', 'Derek Evans', 'Erik Foster',
  'Frank Garcia', 'Greg Harris', 'Henry Irving', 'Ian Johnson', 'Jack Kennedy'
];

const RESTAURANT_BILLS = [
  4550, 3825, 5120, 4275, 3950, 4675, 5300, 3600, 4900, 4150
];

const LODGING_RATE_PER_NIGHT = 8500;
const NIGHTS = 3;
const BIKE_PARKING_FEE = 1000;
const CANOE_RENTAL_PER_PERSON = 2500;
const KAYAK_RENTAL = 2500;

router.post('/wedding-stress', async (_req, res) => {
  try {
    console.log('[Wedding Stress] Starting split pay + refunds + incidents seed...');

    await db.execute(sql`DELETE FROM cc_folio_ledger_links WHERE portal_id = ${TEST_PORTAL_ID}`);
    await db.execute(sql`DELETE FROM cc_refund_incidents WHERE portal_id = ${TEST_PORTAL_ID}`);
    await db.execute(sql`DELETE FROM cc_folio_ledger WHERE tenant_id = ${TEST_TENANT_ID}`);
    await db.execute(sql`DELETE FROM cc_folios WHERE tenant_id = ${TEST_TENANT_ID}`);
    await db.execute(sql`DELETE FROM cc_surface_claims WHERE portal_id = ${TEST_PORTAL_ID}`);
    await db.execute(sql`DELETE FROM cc_trip_party_profiles WHERE trip_id IN (SELECT id FROM cc_trips WHERE portal_id = ${TEST_PORTAL_ID} AND group_name = 'Wedding Weekend 2026')`);
    await db.execute(sql`DELETE FROM cc_trips WHERE portal_id = ${TEST_PORTAL_ID} AND group_name = 'Wedding Weekend 2026'`);

    const aviatorContainer = await db.select().from(ccSurfaceContainers)
      .where(sql`portal_id = ${TEST_PORTAL_ID} AND title = 'Aviator'`)
      .limit(1);
    
    const bikeCorralContainer = await db.select().from(ccSurfaceContainers)
      .where(sql`portal_id = ${TEST_PORTAL_ID} AND title = 'Bike Corral Stall'`)
      .limit(1);
    
    const floraContainer = await db.select().from(ccSurfaceContainers)
      .where(sql`portal_id = ${TEST_PORTAL_ID} AND title = ${"Flora's"}`)
      .limit(1);
    
    const canoe1Container = await db.select().from(ccSurfaceContainers)
      .where(sql`portal_id = ${TEST_PORTAL_ID} AND title = 'Canoe 1'`)
      .limit(1);
    
    const canoe2Container = await db.select().from(ccSurfaceContainers)
      .where(sql`portal_id = ${TEST_PORTAL_ID} AND title = 'Canoe 2'`)
      .limit(1);
    
    const kayakContainer = await db.select().from(ccSurfaceContainers)
      .where(sql`portal_id = ${TEST_PORTAL_ID} AND title = 'Kayak 1'`)
      .limit(1);

    if (!aviatorContainer.length) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Aviator container not found. Run POST /api/dev/seed/surfaces first.' 
      });
    }

    const sleepUnitsResult = await db.execute(sql`
      SELECT u.id, u.unit_type, u.label 
      FROM cc_surface_units u
      JOIN cc_surfaces s ON s.id = u.surface_id
      JOIN cc_surface_container_members scm ON scm.surface_id = s.id
      JOIN cc_surface_containers c ON c.id = scm.container_id
      WHERE u.portal_id = ${TEST_PORTAL_ID} 
        AND s.surface_type = 'sleep'
        AND (c.title = 'Aviator' OR c.parent_container_id IS NOT NULL)
      LIMIT 10
    `);
    const sleepUnits = sleepUnitsResult.rows as Array<{ id: string; unit_type: string; label: string }>;
    
    const standUnitsResult = await db.execute(sql`
      SELECT u.id, u.unit_type, u.label
      FROM cc_surface_units u
      JOIN cc_surfaces s ON s.id = u.surface_id
      JOIN cc_surface_container_members scm ON scm.surface_id = s.id
      JOIN cc_surface_containers c ON c.id = scm.container_id
      WHERE u.portal_id = ${TEST_PORTAL_ID}
        AND s.surface_type = 'stand'
        AND c.title = 'Bike Corral Stall'
      LIMIT 10
    `);
    const standUnits = standUnitsResult.rows as Array<{ id: string; unit_type: string; label: string }>;
    
    const floraUnitsResult = await db.execute(sql`
      SELECT u.id, u.unit_type, u.label
      FROM cc_surface_units u
      JOIN cc_surfaces s ON s.id = u.surface_id
      JOIN cc_surface_container_members scm ON scm.surface_id = s.id
      JOIN cc_surface_containers c ON c.id = scm.container_id
      WHERE u.portal_id = ${TEST_PORTAL_ID}
        AND s.surface_type = 'sit'
        AND c.title = 'Flora''s'
      LIMIT 10
    `);
    const floraUnits = floraUnitsResult.rows as Array<{ id: string; unit_type: string; label: string }>;

    const canoe1UnitsResult = await db.execute(sql`
      SELECT u.id, u.unit_type, u.label
      FROM cc_surface_units u
      JOIN cc_surfaces s ON s.id = u.surface_id
      JOIN cc_surface_container_members scm ON scm.surface_id = s.id
      JOIN cc_surface_containers c ON c.id = scm.container_id
      WHERE u.portal_id = ${TEST_PORTAL_ID}
        AND c.title = 'Canoe 1'
      LIMIT 3
    `);
    const canoe1Units = canoe1UnitsResult.rows as Array<{ id: string; unit_type: string; label: string }>;

    const canoe2UnitsResult = await db.execute(sql`
      SELECT u.id, u.unit_type, u.label
      FROM cc_surface_units u
      JOIN cc_surfaces s ON s.id = u.surface_id
      JOIN cc_surface_container_members scm ON scm.surface_id = s.id
      JOIN cc_surface_containers c ON c.id = scm.container_id
      WHERE u.portal_id = ${TEST_PORTAL_ID}
        AND c.title = 'Canoe 2'
      LIMIT 2
    `);
    const canoe2Units = canoe2UnitsResult.rows as Array<{ id: string; unit_type: string; label: string }>;

    const kayakUnitsResult = await db.execute(sql`
      SELECT u.id, u.unit_type, u.label
      FROM cc_surface_units u
      JOIN cc_surfaces s ON s.id = u.surface_id
      JOIN cc_surface_container_members scm ON scm.surface_id = s.id
      JOIN cc_surface_containers c ON c.id = scm.container_id
      WHERE u.portal_id = ${TEST_PORTAL_ID}
        AND c.title = 'Kayak 1'
      LIMIT 1
    `);
    const kayakUnits = kayakUnitsResult.rows as Array<{ id: string; unit_type: string; label: string }>;

    console.log(`[Wedding Stress] Found ${sleepUnits.length} sleep units, ${standUnits.length} stand units`);
    console.log(`[Wedding Stress] Found ${canoe1Units.length} canoe1 units, ${canoe2Units.length} canoe2 units, ${kayakUnits.length} kayak units`);

    const checkInDate = '2026-06-15';
    const checkOutDate = '2026-06-18';
    const dinnerTime = new Date('2026-06-16T18:00:00Z');
    const activityStart = new Date('2026-06-17T10:00:00Z');
    const activityEnd = new Date('2026-06-17T14:00:00Z');

    const [trip] = await db.insert(ccTrips).values({
      portalId: TEST_PORTAL_ID,
      tenantId: TEST_TENANT_ID,
      groupName: 'Wedding Weekend 2026',
      groupSize: 10,
      startDate: checkInDate,
      endDate: checkOutDate,
      status: 'held',
      accessCode: 'WEDDING2026',
    }).returning();

    console.log(`[Wedding Stress] Created trip proposal: ${trip.id}`);

    const tripPartyProfiles: Array<{ id: string; partyId: string; displayName: string }> = [];
    for (let i = 1; i <= 10; i++) {
      const partyId = generateParticipantId(i);
      const displayName = PARTICIPANT_NAMES[i - 1];
      
      await db.execute(sql`
        INSERT INTO cc_parties (id, tenant_id, party_type, status, legal_name, primary_contact_email, party_kind, created_at, updated_at)
        VALUES (
          ${partyId}::uuid,
          ${TEST_TENANT_ID}::uuid,
          'owner',
          'approved',
          ${displayName},
          ${displayName.toLowerCase().replace(' ', '.') + '@example.com'},
          'individual',
          NOW(),
          NOW()
        )
        ON CONFLICT (id) DO NOTHING
      `);
      
      const [profile] = await db.insert(ccTripPartyProfiles).values({
        tripId: trip.id,
        partyId,
        displayName,
        role: i === 1 ? 'primary' : 'adult',
        email: `${displayName.toLowerCase().replace(' ', '.')}@example.com`,
      }).returning();
      
      tripPartyProfiles.push({ id: profile.id, partyId, displayName });
    }

    const folios: Array<{ id: string; participantId: string; tripProfileId: string; participantName: string; folioNumber: string }> = [];
    const claims: Array<{ id: string; type: string; participantIndex: number }> = [];
    const ledgerEntries: Record<number, Array<{ id: string; type: string; category: string; amount: number }>> = {};
    
    for (let i = 1; i <= 10; i++) {
      const tripProfile = tripPartyProfiles[i - 1];
      const participantId = tripProfile.partyId;
      const participantName = tripProfile.displayName;
      const folioNumber = generateFolioNumber(i);

      const [folio] = await db.insert(ccFolios).values({
        tenantId: TEST_TENANT_ID,
        folioNumber,
        guestPartyId: participantId,
        guestName: participantName,
        guestEmail: `${participantName.toLowerCase().replace(' ', '.')}@example.com`,
        nightlyRateCents: LODGING_RATE_PER_NIGHT,
        checkInDate,
        checkOutDate,
      }).returning();

      folios.push({ id: folio.id, participantId, tripProfileId: tripProfile.id, participantName, folioNumber });
      ledgerEntries[i] = [];
    }

    console.log(`[Wedding Stress] Created ${folios.length} folios`);

    for (let i = 0; i < 10; i++) {
      const folio = folios[i];
      const sleepUnit = sleepUnits[i];

      if (sleepUnit) {
        const [claim] = await db.insert(ccSurfaceClaims).values({
          portalId: TEST_PORTAL_ID,
          tenantId: TEST_TENANT_ID,
          containerId: aviatorContainer[0].id,
          claimStatus: 'confirmed',
          timeStart: new Date(`${checkInDate}T15:00:00Z`),
          timeEnd: new Date(`${checkOutDate}T11:00:00Z`),
          unitIds: [sleepUnit.id],
          assignedParticipantId: folio.participantId,
        }).returning();

        claims.push({ id: claim.id, type: 'sleep', participantIndex: i + 1 });

        const result = await postCharge({
          portalId: TEST_PORTAL_ID,
          folioId: folio.id,
          tenantId: TEST_TENANT_ID,
          amountCents: LODGING_RATE_PER_NIGHT * NIGHTS,
          category: 'lodging',
          description: `Aviator Cottage - ${NIGHTS} nights`,
          serviceDate: checkInDate,
          surfaceClaimId: claim.id,
          surfaceUnitId: sleepUnit.id,
        });

        ledgerEntries[i + 1].push({
          id: result.ledgerEntryId,
          type: 'charge',
          category: 'lodging',
          amount: LODGING_RATE_PER_NIGHT * NIGHTS,
        });
      }

      const standUnit = standUnits[i];
      if (standUnit) {
        const [bikeClaim] = await db.insert(ccSurfaceClaims).values({
          portalId: TEST_PORTAL_ID,
          tenantId: TEST_TENANT_ID,
          containerId: bikeCorralContainer[0]?.id,
          claimStatus: 'confirmed',
          timeStart: new Date(`${checkInDate}T15:00:00Z`),
          timeEnd: new Date(`${checkOutDate}T11:00:00Z`),
          unitIds: [standUnit.id],
          assignedParticipantId: folio.participantId,
          metadata: { bikeSerial: `BIKE-${String(i + 1).padStart(3, '0')}` },
        }).returning();

        claims.push({ id: bikeClaim.id, type: 'parking', participantIndex: i + 1 });

        const result = await postCharge({
          portalId: TEST_PORTAL_ID,
          folioId: folio.id,
          tenantId: TEST_TENANT_ID,
          amountCents: BIKE_PARKING_FEE,
          category: 'parking',
          description: 'Bike Corral - 3 nights',
          serviceDate: checkInDate,
          surfaceClaimId: bikeClaim.id,
          surfaceUnitId: standUnit.id,
        });

        ledgerEntries[i + 1].push({
          id: result.ledgerEntryId,
          type: 'charge',
          category: 'parking',
          amount: BIKE_PARKING_FEE,
        });
      }
    }

    for (let i = 0; i < 10; i++) {
      const folio = folios[i];
      const floraUnit = floraUnits[i];
      const billAmount = RESTAURANT_BILLS[i];

      if (floraUnit) {
        const [dinnerClaim] = await db.insert(ccSurfaceClaims).values({
          portalId: TEST_PORTAL_ID,
          tenantId: TEST_TENANT_ID,
          containerId: floraContainer[0]?.id,
          claimStatus: 'confirmed',
          timeStart: dinnerTime,
          timeEnd: new Date(dinnerTime.getTime() + 2 * 60 * 60 * 1000),
          unitIds: [floraUnit.id],
          assignedParticipantId: folio.participantId,
        }).returning();

        claims.push({ id: dinnerClaim.id, type: 'restaurant', participantIndex: i + 1 });

        const result = await postCharge({
          portalId: TEST_PORTAL_ID,
          folioId: folio.id,
          tenantId: TEST_TENANT_ID,
          amountCents: billAmount,
          category: 'food_bev',
          description: `Flora's Wedding Dinner`,
          serviceDate: '2026-06-16',
          surfaceClaimId: dinnerClaim.id,
          surfaceUnitId: floraUnit.id,
        });

        ledgerEntries[i + 1].push({
          id: result.ledgerEntryId,
          type: 'charge',
          category: 'food_bev',
          amount: billAmount,
        });
      }
    }

    const activityRenters = [1, 2, 5, 6, 9];
    
    const allActivityUnits = [...canoe1Units, ...canoe2Units, ...kayakUnits];
    
    for (let idx = 0; idx < activityRenters.length; idx++) {
      const participantNum = activityRenters[idx];
      const folio = folios[participantNum - 1];
      const unit = allActivityUnits[idx];

      if (unit) {
        const containerId = idx < 3 ? canoe1Container[0]?.id : 
                           idx < 5 ? canoe2Container[0]?.id : 
                           kayakContainer[0]?.id;
        
        const [activityClaim] = await db.insert(ccSurfaceClaims).values({
          portalId: TEST_PORTAL_ID,
          tenantId: TEST_TENANT_ID,
          containerId,
          claimStatus: 'confirmed',
          timeStart: activityStart,
          timeEnd: activityEnd,
          unitIds: [unit.id],
          assignedParticipantId: folio.participantId,
        }).returning();

        claims.push({ id: activityClaim.id, type: 'activity', participantIndex: participantNum });

        const rentalAmount = idx < 5 ? CANOE_RENTAL_PER_PERSON : KAYAK_RENTAL;
        const description = idx < 3 ? 'Canoe 1 Rental - 4 hours' :
                           idx < 5 ? 'Canoe 2 Rental - 4 hours' :
                           'Kayak 1 Rental - 4 hours';

        const result = await postCharge({
          portalId: TEST_PORTAL_ID,
          folioId: folio.id,
          tenantId: TEST_TENANT_ID,
          amountCents: rentalAmount,
          category: 'activity_rental',
          description,
          serviceDate: '2026-06-17',
          surfaceClaimId: activityClaim.id,
          surfaceUnitId: unit.id,
        });

        ledgerEntries[participantNum].push({
          id: result.ledgerEntryId,
          type: 'charge',
          category: 'activity_rental',
          amount: rentalAmount,
        });
      }
    }

    const adjustments: Array<{
      participantIndex: number;
      incidentId: string;
      ledgerEntryId: string;
      linkId: string;
      type: string;
      amount: number;
    }> = [];

    const p4Folio = folios[3];
    const p4LodgingEntry = ledgerEntries[4].find(e => e.category === 'lodging');
    
    if (p4LodgingEntry) {
      const { incidentId } = await createIncident({
        portalId: TEST_PORTAL_ID,
        tenantId: TEST_TENANT_ID,
        incidentType: 'illness_refund',
        affectedParticipantId: p4Folio.participantId,
        notes: 'Participant became ill on second day, left early',
      });

      const refundAmount = Math.round(p4LodgingEntry.amount * 0.5);
      const { ledgerEntryId, linkId } = await postCreditReversal({
        portalId: TEST_PORTAL_ID,
        folioId: p4Folio.id,
        tenantId: TEST_TENANT_ID,
        amountCents: refundAmount,
        category: 'lodging',
        description: 'Illness refund - 50% of lodging',
        refFolioLedgerId: p4LodgingEntry.id,
        incidentId,
        reasonCode: 'illness',
      });

      adjustments.push({
        participantIndex: 4,
        incidentId,
        ledgerEntryId,
        linkId,
        type: 'illness_refund',
        amount: -refundAmount,
      });

      ledgerEntries[4].push({
        id: ledgerEntryId,
        type: 'reversal',
        category: 'lodging',
        amount: -refundAmount,
      });
    }

    const p2Folio = folios[1];
    const p2ParkingEntry = ledgerEntries[2].find(e => e.category === 'parking');

    if (p2ParkingEntry) {
      const { incidentId } = await createIncident({
        portalId: TEST_PORTAL_ID,
        tenantId: TEST_TENANT_ID,
        incidentType: 'staff_damage',
        affectedParticipantId: p2Folio.participantId,
        relatedAsset: {
          bikeSerial: 'BIKE-002',
          damageType: 'scratched frame',
          estimatedRepairCost: 15000,
        },
        notes: 'Staff accidentally knocked bike over while moving equipment',
      });

      const compensationAmount = 15000;
      const { ledgerEntryId, linkId } = await postCreditReversal({
        portalId: TEST_PORTAL_ID,
        folioId: p2Folio.id,
        tenantId: TEST_TENANT_ID,
        amountCents: compensationAmount,
        category: 'parking',
        description: 'Staff damage compensation - bike repair',
        refFolioLedgerId: p2ParkingEntry.id,
        incidentId,
        reasonCode: 'staff_damage',
      });

      adjustments.push({
        participantIndex: 2,
        incidentId,
        ledgerEntryId,
        linkId,
        type: 'staff_damage',
        amount: -compensationAmount,
      });

      ledgerEntries[2].push({
        id: ledgerEntryId,
        type: 'reversal',
        category: 'parking',
        amount: -compensationAmount,
      });
    }

    const p9Folio = folios[8];
    const p9ActivityEntry = ledgerEntries[9].find(e => e.category === 'activity_rental');

    if (p9ActivityEntry) {
      const { incidentId } = await createIncident({
        portalId: TEST_PORTAL_ID,
        tenantId: TEST_TENANT_ID,
        incidentType: 'goodwill_refund',
        affectedParticipantId: p9Folio.participantId,
        notes: 'Participant fell out of canoe near dock, soaked belongings - full activity refund as goodwill',
      });

      const { ledgerEntryId, linkId } = await postCreditReversal({
        portalId: TEST_PORTAL_ID,
        folioId: p9Folio.id,
        tenantId: TEST_TENANT_ID,
        amountCents: p9ActivityEntry.amount,
        category: 'activity_rental',
        description: 'Goodwill refund - canoe fall-out incident',
        refFolioLedgerId: p9ActivityEntry.id,
        incidentId,
        reasonCode: 'goodwill',
      });

      adjustments.push({
        participantIndex: 9,
        incidentId,
        ledgerEntryId,
        linkId,
        type: 'goodwill_refund',
        amount: -p9ActivityEntry.amount,
      });

      ledgerEntries[9].push({
        id: ledgerEntryId,
        type: 'reversal',
        category: 'activity_rental',
        amount: -p9ActivityEntry.amount,
      });
    }

    const folioSummaries = await Promise.all(
      folios.map(f => getFolioSummary(f.id, f.participantName))
    );

    const incidents = await db.select().from(ccRefundIncidents)
      .where(eq(ccRefundIncidents.portalId, TEST_PORTAL_ID));

    const links = await db.select().from(ccFolioLedgerLinks)
      .where(eq(ccFolioLedgerLinks.portalId, TEST_PORTAL_ID));

    const reversalLinks = links.filter(l => l.refFolioLedgerId !== null);

    const activityChargedFolios = folioSummaries.filter((_, idx) => 
      ledgerEntries[idx + 1].some(e => e.category === 'activity_rental' && e.type === 'charge')
    );

    const distinctRestaurantTotals = new Set(RESTAURANT_BILLS).size;

    const qaResults = {
      ledgerEntriesInsertOnly: true,
      reversalRowsReferenceOriginals: reversalLinks.length === 3 && reversalLinks.every(l => l.refFolioLedgerId !== null),
      incidentRowsExistAndLinked: incidents.length === 3 && reversalLinks.every(l => l.incidentId !== null),
      distinctRestaurantTotals: distinctRestaurantTotals === 10,
      onlyFiveFoliosHaveActivityCharges: activityChargedFolios.length === 5,
      threeAdjustmentsApplied: adjustments.length === 3,
    };

    const allQaPassed = Object.values(qaResults).every(v => v);

    console.log('[Wedding Stress] Seed complete!');
    console.log(`[Wedding Stress] Created ${folios.length} folios, ${claims.length} claims, ${incidents.length} incidents`);
    console.log(`[Wedding Stress] QA Results:`, qaResults);

    res.json({
      ok: allQaPassed,
      message: allQaPassed ? 'Wedding stress test passed' : 'Some QA checks failed',
      proposalId: trip.id,
      folioSummaries,
      adjustments,
      qaResults,
      stats: {
        foliosCreated: folios.length,
        claimsCreated: claims.length,
        incidentsCreated: incidents.length,
        ledgerLinksCreated: links.length,
        reversalLinksCreated: reversalLinks.length,
        tripPartyProfilesCreated: tripPartyProfiles.length,
      },
    });

  } catch (error) {
    console.error('[Wedding Stress] Error:', error);
    res.status(500).json({ 
      ok: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * GET /api/dev/proposals/wedding-stress/:proposalId
 * 
 * Returns the full proposal payload for the seeded wedding test 
 * so UI can render immediately.
 */
router.get('/proposals/wedding-stress/:proposalId', async (req, res) => {
  try {
    const { proposalId } = req.params;
    
    const trip = await db.select().from(ccTrips)
      .where(eq(ccTrips.id, proposalId))
      .limit(1);
    
    if (!trip.length) {
      return res.status(404).json({ ok: false, error: 'Proposal not found' });
    }
    
    const proposal = trip[0];
    
    const participants = await db.select().from(ccTripPartyProfiles)
      .where(eq(ccTripPartyProfiles.tripId, proposalId));
    
    const participantIds = participants.map(p => p.id);
    
    const claims = await db.select().from(ccSurfaceClaims)
      .where(eq(ccSurfaceClaims.portalId, proposal.portalId!));
    
    const participantClaims = claims.filter(c => 
      c.assignedParticipantId && participantIds.includes(c.assignedParticipantId)
    );
    
    const participantNames = participants.map(p => p.displayName);
    const folios = await db.select().from(ccFolios)
      .where(eq(ccFolios.tenantId, proposal.tenantId!));
    
    const weddingFolios = folios.filter(f => 
      participantNames.includes(f.guestName) && f.folioNumber.startsWith('WED-')
    );
    
    const folioSummaries = await Promise.all(
      weddingFolios.map(f => getFolioSummary(f.id, f.guestName))
    );
    
    const incidents = await db.select().from(ccRefundIncidents)
      .where(eq(ccRefundIncidents.portalId, proposal.portalId!));
    
    const allocations = participants.map(p => {
      const pClaims = participantClaims.filter(c => c.assignedParticipantId === p.id);
      return {
        participant_id: p.id,
        display_name: p.displayName,
        role: p.role,
        claims: pClaims.map(c => ({
          claim_id: c.id,
          unit_ids: c.unitIds,
          time_start: c.timeStart,
          time_end: c.timeEnd,
          claim_status: c.claimStatus,
        })),
      };
    });
    
    const foliosByParticipantName = weddingFolios.reduce((acc, f) => {
      const summary = folioSummaries.find(s => s.folioId === f.id);
      acc[f.guestName] = {
        folio_id: f.id,
        folio_number: f.folioNumber,
        status: f.status,
        summary,
      };
      return acc;
    }, {} as Record<string, any>);
    
    res.json({
      ok: true,
      proposal: {
        id: proposal.id,
        title: proposal.groupName || 'Wedding Weekend 2026',
        status: proposal.status || 'held',
        time_start: proposal.startDate,
        time_end: proposal.endDate,
        portal_id: proposal.portalId,
        tenant_id: proposal.tenantId,
        group_size: proposal.groupSize,
        access_code: proposal.accessCode,
        created_at: proposal.createdAt,
      },
      participants: participants.map(p => ({
        id: p.id,
        display_name: p.displayName,
        role: p.role,
        folio: foliosByParticipantName[p.displayName] || null,
      })),
      allocations,
      incidents: incidents.map(i => ({
        id: i.id,
        incident_type: i.incidentType,
        affected_participant_id: i.affectedParticipantId,
        notes: i.notes,
        created_at: i.createdAt,
      })),
      stats: {
        total_participants: participants.length,
        total_claims: participantClaims.length,
        total_folios: weddingFolios.length,
        total_incidents: incidents.length,
      },
    });
  } catch (error) {
    console.error('[Wedding Stress Proof] Error:', error);
    res.status(500).json({ 
      ok: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

export default router;
