import { db } from "../../db";
import { 
  ccFolioLedger, 
  ccFolioLedgerLinks, 
  ccRefundIncidents,
  cc_activity_ledger 
} from "@shared/schema";
import { eq, sql, and, desc } from "drizzle-orm";

export type ChargeCategory = 
  | "lodging"
  | "food_bev"
  | "activity_rental"
  | "parking"
  | "utility_usage"
  | "other";

export interface PostChargeInput {
  portalId: string;
  folioId: string;
  tenantId?: string;
  amountCents: number;
  currency?: string;
  category: ChargeCategory;
  description: string;
  effectiveAt?: Date;
  serviceDate?: string;
  surfaceClaimId?: string;
  surfaceUnitId?: string;
  postedBy?: string;
}

export interface PostReversalInput {
  portalId: string;
  folioId: string;
  tenantId?: string;
  amountCents: number;
  currency?: string;
  category: ChargeCategory;
  description: string;
  effectiveAt?: Date;
  serviceDate?: string;
  refFolioLedgerId: string;
  incidentId?: string;
  reasonCode?: "illness" | "staff_damage" | "goodwill" | "other";
  surfaceClaimId?: string;
  surfaceUnitId?: string;
  postedBy?: string;
}

async function getNextSequenceNumber(folioId: string): Promise<number> {
  const result = await db
    .select({ maxSeq: sql<number>`COALESCE(MAX(sequence_number), 0)` })
    .from(ccFolioLedger)
    .where(eq(ccFolioLedger.folioId, folioId));
  
  return (result[0]?.maxSeq ?? 0) + 1;
}

export async function postCharge(input: PostChargeInput): Promise<{ ledgerEntryId: string; linkId: string | null }> {
  const sequenceNumber = await getNextSequenceNumber(input.folioId);
  
  const [ledgerEntry] = await db
    .insert(ccFolioLedger)
    .values({
      tenantId: input.tenantId || input.portalId,
      folioId: input.folioId,
      entryType: "charge",
      referenceType: input.category,
      description: input.description,
      amountCents: input.amountCents,
      currency: input.currency || "CAD",
      serviceDate: input.serviceDate,
      postedBy: input.postedBy,
      sequenceNumber,
    })
    .returning({ id: ccFolioLedger.id });

  let linkId: string | null = null;

  if (input.surfaceClaimId || input.surfaceUnitId) {
    const [link] = await db
      .insert(ccFolioLedgerLinks)
      .values({
        portalId: input.portalId,
        tenantId: input.tenantId,
        folioLedgerId: ledgerEntry.id,
        surfaceClaimId: input.surfaceClaimId,
        surfaceUnitId: input.surfaceUnitId,
      })
      .returning({ id: ccFolioLedgerLinks.id });
    linkId = link.id;
  }

  await db.insert(cc_activity_ledger).values({
    tenantId: input.tenantId,
    action: "charge_posted",
    entityType: "folio_ledger",
    entityId: ledgerEntry.id,
    payload: {
      folioId: input.folioId,
      amountCents: input.amountCents,
      category: input.category,
      description: input.description,
    },
  });

  return { ledgerEntryId: ledgerEntry.id, linkId };
}

export async function postCreditReversal(input: PostReversalInput): Promise<{ ledgerEntryId: string; linkId: string }> {
  const sequenceNumber = await getNextSequenceNumber(input.folioId);
  
  const reversalAmount = input.amountCents < 0 ? input.amountCents : -input.amountCents;

  const [ledgerEntry] = await db
    .insert(ccFolioLedger)
    .values({
      tenantId: input.tenantId || input.portalId,
      folioId: input.folioId,
      entryType: "reversal",
      referenceType: input.category,
      referenceId: input.refFolioLedgerId,
      reversesEntryId: input.refFolioLedgerId,
      description: input.description,
      amountCents: reversalAmount,
      currency: input.currency || "CAD",
      serviceDate: input.serviceDate,
      postedBy: input.postedBy,
      sequenceNumber,
    })
    .returning({ id: ccFolioLedger.id });

  const [link] = await db
    .insert(ccFolioLedgerLinks)
    .values({
      portalId: input.portalId,
      tenantId: input.tenantId,
      folioLedgerId: ledgerEntry.id,
      surfaceClaimId: input.surfaceClaimId,
      surfaceUnitId: input.surfaceUnitId,
      incidentId: input.incidentId,
      refFolioLedgerId: input.refFolioLedgerId,
      metadata: { reasonCode: input.reasonCode },
    })
    .returning({ id: ccFolioLedgerLinks.id });

  await db.insert(cc_activity_ledger).values({
    tenantId: input.tenantId,
    action: "reversal_posted",
    entityType: "folio_ledger",
    entityId: ledgerEntry.id,
    payload: {
      folioId: input.folioId,
      amountCents: reversalAmount,
      category: input.category,
      description: input.description,
      refFolioLedgerId: input.refFolioLedgerId,
      incidentId: input.incidentId,
      reasonCode: input.reasonCode,
    },
  });

  return { ledgerEntryId: ledgerEntry.id, linkId: link.id };
}

export async function getFolioBalanceCents(folioId: string): Promise<number> {
  const result = await db
    .select({
      totalCharges: sql<number>`COALESCE(SUM(CASE WHEN entry_type = 'charge' THEN amount_cents ELSE 0 END), 0)`,
      totalPayments: sql<number>`COALESCE(SUM(CASE WHEN entry_type = 'payment' THEN amount_cents ELSE 0 END), 0)`,
      totalReversals: sql<number>`COALESCE(SUM(CASE WHEN entry_type = 'reversal' THEN amount_cents ELSE 0 END), 0)`,
      totalAdjustments: sql<number>`COALESCE(SUM(CASE WHEN entry_type = 'adjustment' THEN amount_cents ELSE 0 END), 0)`,
      totalRefunds: sql<number>`COALESCE(SUM(CASE WHEN entry_type = 'refund' THEN amount_cents ELSE 0 END), 0)`,
    })
    .from(ccFolioLedger)
    .where(eq(ccFolioLedger.folioId, folioId));

  const row = result[0];
  const totalCharges = Number(row?.totalCharges ?? 0);
  const totalPayments = Number(row?.totalPayments ?? 0);
  const totalReversals = Number(row?.totalReversals ?? 0);
  const totalAdjustments = Number(row?.totalAdjustments ?? 0);
  const totalRefunds = Number(row?.totalRefunds ?? 0);

  return totalCharges + totalPayments + totalReversals + totalAdjustments + totalRefunds;
}

export interface FolioSummary {
  folioId: string;
  participantName: string;
  totalCharges: number;
  totalReversals: number;
  netBalance: number;
  entryCount: number;
}

export async function getFolioSummary(folioId: string, participantName: string): Promise<FolioSummary> {
  const result = await db
    .select({
      totalCharges: sql<number>`COALESCE(SUM(CASE WHEN entry_type = 'charge' THEN amount_cents ELSE 0 END), 0)`,
      totalReversals: sql<number>`COALESCE(SUM(CASE WHEN entry_type IN ('reversal', 'refund') THEN amount_cents ELSE 0 END), 0)`,
      entryCount: sql<number>`COUNT(*)`,
    })
    .from(ccFolioLedger)
    .where(eq(ccFolioLedger.folioId, folioId));

  const row = result[0];
  const totalCharges = Number(row?.totalCharges ?? 0);
  const totalReversals = Number(row?.totalReversals ?? 0);
  const entryCount = Number(row?.entryCount ?? 0);

  return {
    folioId,
    participantName,
    totalCharges,
    totalReversals,
    netBalance: totalCharges + totalReversals,
    entryCount,
  };
}

export async function createIncident(input: {
  portalId: string;
  tenantId?: string;
  incidentType: "illness_refund" | "staff_damage" | "goodwill_refund" | "injury" | "other";
  affectedParticipantId?: string;
  relatedAsset?: Record<string, any>;
  notes?: string;
}): Promise<{ incidentId: string }> {
  const [incident] = await db
    .insert(ccRefundIncidents)
    .values({
      portalId: input.portalId,
      tenantId: input.tenantId,
      incidentType: input.incidentType,
      affectedParticipantId: input.affectedParticipantId,
      relatedAsset: input.relatedAsset || {},
      notes: input.notes,
    })
    .returning({ id: ccRefundIncidents.id });

  return { incidentId: incident.id };
}
