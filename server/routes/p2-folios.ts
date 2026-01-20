/**
 * P-UI-17: Folios API
 * 
 * Read-only endpoints for viewing folios and ledger entries.
 * All endpoints enforce tenant access.
 */

import { Router } from 'express';
import { db } from '../db';
import { 
  ccFolios,
  ccFolioLedger,
  ccFolioLedgerLinks,
  ccTenantIndividuals,
} from '@shared/schema';
import { eq, and, sql, desc, gte, lte, ilike, or, inArray } from 'drizzle-orm';
import { getFolioSummary } from '../lib/ledger/folioLedger';

const router = Router();

async function requireTenantAccess(req: any, res: any): Promise<{ tenantId: string; userId: string } | null> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ ok: false, error: 'Authentication required' });
    return null;
  }
  
  const tenantId = req.headers['x-tenant-id'] as string;
  if (!tenantId) {
    res.status(400).json({ ok: false, error: 'Tenant context required' });
    return null;
  }
  
  const membership = await db.query.ccTenantIndividuals.findFirst({
    where: and(
      eq(ccTenantIndividuals.tenantId, tenantId),
      eq(ccTenantIndividuals.individualId, userId),
      eq(ccTenantIndividuals.status, 'active')
    ),
  });
  
  if (!membership) {
    const isPlatformAdmin = req.user?.isPlatformAdmin === true;
    if (!isPlatformAdmin) {
      res.status(403).json({ ok: false, error: 'Access denied' });
      return null;
    }
  }
  
  return { tenantId, userId };
}

/**
 * GET /api/p2/folios
 * List folios with filters
 */
router.get('/', async (req, res) => {
  try {
    const auth = await requireTenantAccess(req, res);
    if (!auth) return;

    const { status, search, from_date, to_date, limit = '50', offset = '0' } = req.query;

    const conditions = [eq(ccFolios.tenantId, auth.tenantId)];
    
    if (status && typeof status === 'string') {
      conditions.push(eq(ccFolios.status, status as any));
    }
    
    if (from_date && typeof from_date === 'string') {
      conditions.push(gte(ccFolios.checkInDate, from_date));
    }
    
    if (to_date && typeof to_date === 'string') {
      conditions.push(lte(ccFolios.checkOutDate, to_date));
    }

    let folios = await db
      .select()
      .from(ccFolios)
      .where(and(...conditions))
      .orderBy(desc(ccFolios.createdAt))
      .limit(parseInt(limit as string, 10))
      .offset(parseInt(offset as string, 10));

    if (search && typeof search === 'string') {
      const s = search.toLowerCase();
      folios = folios.filter(f =>
        f.folioNumber.toLowerCase().includes(s) ||
        f.guestName.toLowerCase().includes(s) ||
        f.guestEmail?.toLowerCase().includes(s)
      );
    }

    const folioSummaries = await Promise.all(
      folios.map(f => getFolioSummary(f.id, f.guestName))
    );

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(ccFolios)
      .where(and(...conditions));

    res.json({
      ok: true,
      folios: folios.map((f, idx) => ({
        id: f.id,
        folio_number: f.folioNumber,
        status: f.status,
        guest_name: f.guestName,
        guest_email: f.guestEmail,
        guest_phone: f.guestPhone,
        check_in_date: f.checkInDate,
        check_out_date: f.checkOutDate,
        actual_check_in: f.actualCheckIn,
        actual_check_out: f.actualCheckOut,
        nights_stayed: f.nightsStayed,
        nightly_rate_cents: f.nightlyRateCents,
        currency: f.currency,
        balance_due_cents: f.balanceDueCents,
        summary: folioSummaries[idx],
        created_at: f.createdAt,
      })),
      total: countResult[0]?.count ?? 0,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });
  } catch (error: any) {
    console.error('[Folios] GET list error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * GET /api/p2/folios/:folioId
 * Get folio summary
 */
router.get('/:folioId', async (req, res) => {
  try {
    const auth = await requireTenantAccess(req, res);
    if (!auth) return;

    const { folioId } = req.params;

    const folio = await db.query.ccFolios.findFirst({
      where: and(
        eq(ccFolios.id, folioId),
        eq(ccFolios.tenantId, auth.tenantId)
      ),
    });

    if (!folio) {
      return res.status(404).json({ ok: false, error: 'Folio not found' });
    }

    const summary = await getFolioSummary(folio.id, folio.guestName);

    res.json({
      ok: true,
      folio: {
        id: folio.id,
        folio_number: folio.folioNumber,
        status: folio.status,
        guest_party_id: folio.guestPartyId,
        guest_name: folio.guestName,
        guest_email: folio.guestEmail,
        guest_phone: folio.guestPhone,
        reservation_id: folio.reservationId,
        asset_id: folio.assetId,
        facility_id: folio.facilityId,
        rate_plan_id: folio.ratePlanId,
        nightly_rate_cents: folio.nightlyRateCents,
        currency: folio.currency,
        check_in_date: folio.checkInDate,
        check_out_date: folio.checkOutDate,
        actual_check_in: folio.actualCheckIn,
        actual_check_out: folio.actualCheckOut,
        nights_stayed: folio.nightsStayed,
        balance_due_cents: folio.balanceDueCents,
        created_at: folio.createdAt,
        updated_at: folio.updatedAt,
      },
      summary,
    });
  } catch (error: any) {
    console.error('[Folios] GET detail error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * GET /api/p2/folios/:folioId/ledger
 * Get folio ledger entries (paginated)
 */
router.get('/:folioId/ledger', async (req, res) => {
  try {
    const auth = await requireTenantAccess(req, res);
    if (!auth) return;

    const { folioId } = req.params;
    const { limit = '100', offset = '0', entry_type } = req.query;

    const folio = await db.query.ccFolios.findFirst({
      where: and(
        eq(ccFolios.id, folioId),
        eq(ccFolios.tenantId, auth.tenantId)
      ),
    });

    if (!folio) {
      return res.status(404).json({ ok: false, error: 'Folio not found' });
    }

    const conditions = [eq(ccFolioLedger.folioId, folioId)];
    
    if (entry_type && typeof entry_type === 'string') {
      conditions.push(eq(ccFolioLedger.entryType, entry_type as any));
    }

    const entries = await db
      .select()
      .from(ccFolioLedger)
      .where(and(...conditions))
      .orderBy(desc(ccFolioLedger.postedAt))
      .limit(parseInt(limit as string, 10))
      .offset(parseInt(offset as string, 10));

    const entryIds = entries.map(e => e.id);
    const links = entryIds.length > 0 
      ? await db
          .select()
          .from(ccFolioLedgerLinks)
          .where(inArray(ccFolioLedgerLinks.folioLedgerId, entryIds))
      : [];

    const linksByEntryId = links.reduce((acc, l) => {
      acc[l.folioLedgerId] = l;
      return acc;
    }, {} as Record<string, typeof links[0]>);

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(ccFolioLedger)
      .where(and(...conditions));

    res.json({
      ok: true,
      entries: entries.map(e => {
        const link = linksByEntryId[e.id];
        return {
          id: e.id,
          entry_type: e.entryType,
          reference_type: e.referenceType,
          reference_id: e.referenceId,
          reverses_entry_id: e.reversesEntryId,
          description: e.description,
          amount_cents: e.amountCents,
          currency: e.currency,
          tax_rate_pct: e.taxRatePct,
          service_date: e.serviceDate,
          posted_by: e.postedBy,
          posted_at: e.postedAt,
          payment_method: e.paymentMethod,
          payment_reference: e.paymentReference,
          sequence_number: e.sequenceNumber,
          linked_surface_claim_id: link?.surfaceClaimId || null,
          linked_surface_unit_id: link?.surfaceUnitId || null,
          linked_incident_id: link?.incidentId || null,
        };
      }),
      total: countResult[0]?.count ?? 0,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });
  } catch (error: any) {
    console.error('[Folios] GET ledger error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * GET /api/p2/folios/stats
 * Get folio statistics for dashboard
 */
router.get('/stats/summary', async (req, res) => {
  try {
    const auth = await requireTenantAccess(req, res);
    if (!auth) return;

    const stats = await db
      .select({
        status: ccFolios.status,
        count: sql<number>`count(*)`,
        total_balance: sql<number>`COALESCE(SUM(balance_due_cents), 0)`,
      })
      .from(ccFolios)
      .where(eq(ccFolios.tenantId, auth.tenantId))
      .groupBy(ccFolios.status);

    const totals = stats.reduce((acc, s) => {
      acc.by_status[s.status] = { count: Number(s.count), total_balance_cents: Number(s.total_balance) };
      acc.total_count += Number(s.count);
      acc.total_balance_cents += Number(s.total_balance);
      return acc;
    }, { 
      by_status: {} as Record<string, { count: number; total_balance_cents: number }>, 
      total_count: 0, 
      total_balance_cents: 0 
    });

    res.json({ ok: true, stats: totals });
  } catch (error: any) {
    console.error('[Folios] GET stats error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;
