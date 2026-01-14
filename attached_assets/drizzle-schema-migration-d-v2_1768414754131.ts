// ============================================================================
// DRIZZLE SCHEMA: Migration D v2 - Community Identity (CORRECTED)
// cc_community_identities, cc_community_charges, cc_settlement_batches
//
// Security model aligned with ChatGPT review:
// - cc_community_identities: issuer-only (merchants use verify function)
// - cc_settlement_batches: verb-specific RLS (merchant can SELECT only)
// - Ledger integration via issuer_folio_ledger_entry_ids
// ============================================================================

import { 
  pgTable, 
  uuid, 
  text, 
  integer, 
  boolean, 
  timestamp, 
  numeric, 
  jsonb,
  pgEnum,
  uniqueIndex,
  index
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// ENUMS - Migration D (Community Identity)
// ============================================================================

export const communityIdentityStatusEnum = pgEnum('community_identity_status', [
  'active',
  'suspended',
  'expired',
  'revoked'
]);

export const communityChargeStatusEnum = pgEnum('community_charge_status', [
  'pending',
  'authorized',
  'settled',
  'disputed',
  'refunded',
  'void'
]);

export const settlementBatchStatusEnum = pgEnum('settlement_batch_status', [
  'open',
  'calculating',
  'pending_approval',
  'approved',
  'processing',
  'completed',
  'failed',
  'void'
]);

export const chargeCategoryEnum = pgEnum('charge_category', [
  'accommodation',
  'parking',
  'marina',
  'food_beverage',
  'retail',
  'service',
  'activity',
  'transport',
  'damage',
  'fee',
  'other'
]);

// ============================================================================
// TABLES - Migration D: Community Identity ("Community Wallet")
// ============================================================================

export const ccCommunityIdentities = pgTable('cc_community_identities', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Issuing tenant (who created - accommodation provider)
  issuingTenantId: uuid('issuing_tenant_id').notNull(),
  
  // Identity holder
  partyId: uuid('party_id').notNull(),
  individualId: uuid('individual_id'),
  
  // Display info
  displayName: text('display_name').notNull(),
  
  // Credentials
  identityCode: text('identity_code').notNull(),
  pinHash: text('pin_hash'),
  qrCodeData: text('qr_code_data'),
  
  // Link to accommodation
  folioId: uuid('folio_id'),
  reservationId: uuid('reservation_id'),
  
  // Status
  status: communityIdentityStatusEnum('status').notNull().default('active'),
  
  // Validity
  validFrom: timestamp('valid_from', { withTimezone: true }).notNull().defaultNow(),
  validUntil: timestamp('valid_until', { withTimezone: true }).notNull(),
  
  // Spending controls
  spendingLimitCents: integer('spending_limit_cents'),
  dailyLimitCents: integer('daily_limit_cents'),
  singleChargeLimitCents: integer('single_charge_limit_cents'),
  allowedCategories: text('allowed_categories').array(),
  blockedTenantIds: text('blocked_tenant_ids').array(),
  
  // Running totals
  totalChargesCents: integer('total_charges_cents').notNull().default(0),
  totalSettledCents: integer('total_settled_cents').notNull().default(0),
  pendingChargesCents: integer('pending_charges_cents').notNull().default(0),
  
  // Verification settings
  requirePin: boolean('require_pin').default(false),
  requirePinAboveCents: integer('require_pin_above_cents'),
  
  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by'),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedBy: uuid('revoked_by'),
  revokeReason: text('revoke_reason'),
}, (table) => ({
  codeIdx: uniqueIndex('uq_community_identity_code').on(table.identityCode),
  issuerIdx: index('idx_community_identities_issuer').on(table.issuingTenantId, table.status),
  partyIdx: index('idx_community_identities_party').on(table.partyId),
  folioIdx: index('idx_community_identities_folio').on(table.folioId),
}));

export const ccCommunityCharges = pgTable('cc_community_charges', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Identity being charged
  communityIdentityId: uuid('community_identity_id').notNull(),
  
  // Merchant
  merchantTenantId: uuid('merchant_tenant_id').notNull(),
  
  // Charge identity
  chargeNumber: text('charge_number').notNull(),
  status: communityChargeStatusEnum('status').notNull().default('pending'),
  category: chargeCategoryEnum('category').notNull().default('other'),
  
  // Details
  description: text('description').notNull(),
  lineItems: jsonb('line_items'),
  
  // Amounts
  subtotalCents: integer('subtotal_cents').notNull(),
  taxCents: integer('tax_cents').notNull().default(0),
  tipCents: integer('tip_cents').notNull().default(0),
  totalCents: integer('total_cents').notNull(),
  currency: text('currency').notNull().default('CAD'),
  
  // Tax breakdown
  taxBreakdown: jsonb('tax_breakdown'),
  
  // Verification
  pinVerified: boolean('pin_verified').default(false),
  verifiedByStaff: boolean('verified_by_staff').default(false),
  staffId: uuid('staff_id'),
  
  // Location
  facilityId: uuid('facility_id'),
  assetId: uuid('asset_id'),
  locationDescription: text('location_description'),
  
  // POS reference
  terminalId: text('terminal_id'),
  posReference: text('pos_reference'),
  
  // Settlement
  settlementBatchId: uuid('settlement_batch_id'),
  settledAt: timestamp('settled_at', { withTimezone: true }),
  
  // Dispute
  disputedAt: timestamp('disputed_at', { withTimezone: true }),
  disputeReason: text('dispute_reason'),
  disputeResolvedAt: timestamp('dispute_resolved_at', { withTimezone: true }),
  disputeResolution: text('dispute_resolution'),
  
  // Refund
  refundedAt: timestamp('refunded_at', { withTimezone: true }),
  refundAmountCents: integer('refund_amount_cents'),
  refundReason: text('refund_reason'),
  
  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by'),
  voidedAt: timestamp('voided_at', { withTimezone: true }),
  voidedBy: uuid('voided_by'),
  voidReason: text('void_reason'),
}, (table) => ({
  merchantNumberIdx: uniqueIndex('uq_charge_merchant_number').on(table.merchantTenantId, table.chargeNumber),
  identityIdx: index('idx_community_charges_identity').on(table.communityIdentityId),
  merchantIdx: index('idx_community_charges_merchant').on(table.merchantTenantId, table.status),
  settlementIdx: index('idx_community_charges_settlement').on(table.settlementBatchId),
}));

export const ccSettlementBatches = pgTable('cc_settlement_batches', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Identity
  batchNumber: text('batch_number').notNull(),
  status: settlementBatchStatusEnum('status').notNull().default('open'),
  
  // Period
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
  
  // Tenants
  issuingTenantId: uuid('issuing_tenant_id').notNull(),
  merchantTenantId: uuid('merchant_tenant_id').notNull(),
  
  // Aggregated amounts
  grossChargesCents: integer('gross_charges_cents').notNull().default(0),
  chargeCount: integer('charge_count').notNull().default(0),
  
  // Fees
  platformFeeCents: integer('platform_fee_cents').notNull().default(0),
  platformFeePct: numeric('platform_fee_pct', { precision: 5, scale: 2 }).default('0'),
  interchangeFeeCents: integer('interchange_fee_cents').notNull().default(0),
  
  // Net settlement
  netSettlementCents: integer('net_settlement_cents').notNull().default(0),
  
  // Tax summary
  totalTaxCollectedCents: integer('total_tax_collected_cents').notNull().default(0),
  taxSummary: jsonb('tax_summary'),
  
  // Approval
  calculatedAt: timestamp('calculated_at', { withTimezone: true }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvedBy: uuid('approved_by'),
  
  // Payment
  paymentInitiatedAt: timestamp('payment_initiated_at', { withTimezone: true }),
  paymentCompletedAt: timestamp('payment_completed_at', { withTimezone: true }),
  paymentReference: text('payment_reference'),
  paymentMethod: text('payment_method'),
  
  // Ledger integration (CORRECTED: UUID[] for actual ledger entry IDs)
  issuerFolioLedgerEntryIds: text('issuer_folio_ledger_entry_ids').array(), // UUID[] in Postgres
  issuerFolioEntries: jsonb('issuer_folio_entries'), // Backward compat JSONB
  
  // Reconciliation
  merchantReceivedConfirmation: boolean('merchant_received_confirmation').default(false),
  
  // Failure
  failureReason: text('failure_reason'),
  retryCount: integer('retry_count').default(0),
  lastRetryAt: timestamp('last_retry_at', { withTimezone: true }),
  
  // Notes
  internalNotes: text('internal_notes'),
  
  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  batchNumberIdx: uniqueIndex('uq_settlement_batch_number').on(table.batchNumber),
  periodTenantsIdx: uniqueIndex('uq_settlement_period_tenants').on(
    table.periodStart, table.periodEnd, table.issuingTenantId, table.merchantTenantId
  ),
  issuerIdx: index('idx_settlement_batches_issuer').on(table.issuingTenantId, table.status),
  merchantIdx: index('idx_settlement_batches_merchant').on(table.merchantTenantId, table.status),
}));

// ============================================================================
// RELATIONS
// ============================================================================

export const ccCommunityIdentitiesRelations = relations(ccCommunityIdentities, ({ many }) => ({
  charges: many(ccCommunityCharges),
}));

export const ccCommunityChargesRelations = relations(ccCommunityCharges, ({ one }) => ({
  identity: one(ccCommunityIdentities, {
    fields: [ccCommunityCharges.communityIdentityId],
    references: [ccCommunityIdentities.id],
  }),
  settlementBatch: one(ccSettlementBatches, {
    fields: [ccCommunityCharges.settlementBatchId],
    references: [ccSettlementBatches.id],
  }),
}));

export const ccSettlementBatchesRelations = relations(ccSettlementBatches, ({ many }) => ({
  charges: many(ccCommunityCharges),
}));
