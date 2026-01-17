/**
 * Job Publication Accounting Service
 * 
 * Handles GL integration for cc_paid_publication_intents:
 * - Posts charge entries when intents are created
 * - Posts payment entries when marked paid
 * - Posts refund entries when refunds are processed
 * - Records all state transitions in append-only audit log
 * 
 * Single source of truth: cc_paid_publication_intents
 * Accounting view: cc_ledger_entries (linked via ledger_*_entry_id columns)
 */

import { PoolClient } from 'pg';
import { nanoid } from 'nanoid';

export interface IntentRecord {
  id: string;
  tenant_id: string;
  job_id: string;
  portal_id: string;
  amount_cents: number;
  tier_price_cents: number;
  currency: string;
  status: string;
  tier_metadata: Record<string, unknown>;
  attention_tier?: string;
  assistance_tier?: string;
  psp_provider?: string;
  psp_reference?: string;
  psp_metadata?: Record<string, unknown>;
  paid_at?: string;
  ledger_charge_entry_id?: string;
  ledger_payment_entry_id?: string;
  ledger_refund_entry_id?: string;
}

export interface PaymentInfo {
  pspProvider: string;
  pspReference?: string;
  pspMetadata?: Record<string, unknown>;
  note?: string;
  actorIndividualId?: string;
  actorIdentityId?: string;
}

export interface RefundInfo {
  reason: string;
  amountCents?: number;
  note?: string;
  actorIndividualId?: string;
  actorIdentityId?: string;
}

function computeTotalCents(intent: IntentRecord): number {
  return intent.amount_cents + (intent.tier_price_cents || 0);
}

function buildChargeDescription(intent: IntentRecord): string {
  const total = computeTotalCents(intent);
  const tierInfo = intent.tier_price_cents > 0 
    ? ` (base: ${intent.amount_cents}, tier: ${intent.tier_price_cents})`
    : '';
  return `Job placement charge - ${total} cents${tierInfo}`;
}

function buildPaymentDescription(intent: IntentRecord, paymentInfo: PaymentInfo): string {
  const total = computeTotalCents(intent);
  const provider = paymentInfo.pspProvider || 'manual';
  return `Job placement payment via ${provider} - ${total} cents`;
}

function buildRefundDescription(intent: IntentRecord, refundInfo: RefundInfo): string {
  const amount = refundInfo.amountCents ?? computeTotalCents(intent);
  return `Job placement refund - ${amount} cents: ${refundInfo.reason}`;
}

/**
 * Post a GL charge entry when an intent is created
 * This ensures every paid intent has a posted charge for audit
 */
export async function postIntentCharge(
  client: PoolClient,
  intent: IntentRecord
): Promise<string> {
  const totalCents = computeTotalCents(intent);
  
  if (totalCents <= 0) {
    throw new Error('Cannot post charge for zero or negative amount');
  }

  const chargeResult = await client.query(`
    INSERT INTO cc_ledger_entries (
      tenant_id,
      entry_type,
      amount,
      currency,
      description,
      line_item_code,
      source_type,
      source_id,
      status,
      metadata
    ) VALUES (
      $1,
      'charge',
      $2,
      $3,
      $4,
      'JOB_PLACEMENT_CHARGE',
      'paid_publication_intent',
      $5,
      'pending',
      $6
    )
    RETURNING id
  `, [
    intent.tenant_id,
    totalCents / 100,
    intent.currency || 'CAD',
    buildChargeDescription(intent),
    intent.id,
    JSON.stringify({
      job_id: intent.job_id,
      portal_id: intent.portal_id,
      base_amount_cents: intent.amount_cents,
      tier_price_cents: intent.tier_price_cents,
      tier_metadata: intent.tier_metadata
    })
  ]);

  const ledgerEntryId = chargeResult.rows[0].id;

  await client.query(`
    UPDATE cc_paid_publication_intents
    SET ledger_charge_entry_id = $1, updated_at = now()
    WHERE id = $2
  `, [ledgerEntryId, intent.id]);

  await client.query(`
    INSERT INTO cc_paid_publication_intent_events (
      tenant_id, intent_id, from_status, to_status,
      event_type, note, ledger_entry_id, metadata
    ) VALUES (
      $1, $2, NULL, $3,
      'charge_posted', 'GL charge entry created',
      $4, $5
    )
  `, [
    intent.tenant_id,
    intent.id,
    intent.status,
    ledgerEntryId,
    JSON.stringify({ amount_cents: totalCents })
  ]);

  return ledgerEntryId;
}

/**
 * Record a payment for an intent
 * Creates GL payment entry, updates intent status, publishes job posting
 */
export async function recordIntentPayment(
  client: PoolClient,
  intent: IntentRecord,
  paymentInfo: PaymentInfo
): Promise<{ ledgerEntryId: string; updatedIntent: IntentRecord }> {
  if (!['requires_action', 'pending_payment'].includes(intent.status)) {
    throw new Error(`Cannot record payment for intent in ${intent.status} status`);
  }

  const totalCents = computeTotalCents(intent);

  const paymentResult = await client.query(`
    INSERT INTO cc_ledger_entries (
      tenant_id,
      entry_type,
      amount,
      currency,
      description,
      line_item_code,
      source_type,
      source_id,
      payment_method,
      payment_reference,
      status,
      metadata
    ) VALUES (
      $1,
      'payment',
      $2,
      $3,
      $4,
      'JOB_PLACEMENT_PAYMENT',
      'paid_publication_intent',
      $5,
      $6,
      $7,
      'completed',
      $8
    )
    RETURNING id
  `, [
    intent.tenant_id,
    totalCents / 100,
    intent.currency || 'CAD',
    buildPaymentDescription(intent, paymentInfo),
    intent.id,
    paymentInfo.pspProvider,
    paymentInfo.pspReference || null,
    JSON.stringify({
      job_id: intent.job_id,
      portal_id: intent.portal_id,
      amount_cents: totalCents,
      psp_metadata: paymentInfo.pspMetadata
    })
  ]);

  const ledgerEntryId = paymentResult.rows[0].id;

  const updateResult = await client.query(`
    UPDATE cc_paid_publication_intents SET
      status = 'paid',
      psp_provider = COALESCE($3, psp_provider),
      psp_reference = COALESCE($4, psp_reference),
      psp_metadata = COALESCE($5, psp_metadata),
      ledger_payment_entry_id = $6,
      paid_at = now(),
      updated_at = now()
    WHERE id = $1 AND portal_id = $2
    RETURNING *
  `, [
    intent.id,
    intent.portal_id,
    paymentInfo.pspProvider || null,
    paymentInfo.pspReference || null,
    paymentInfo.pspMetadata ? JSON.stringify(paymentInfo.pspMetadata) : null,
    ledgerEntryId
  ]);

  const updatedIntent = updateResult.rows[0];

  await client.query(`
    UPDATE cc_job_postings SET
      publish_state = 'published',
      published_at = now(),
      is_hidden = false
    WHERE job_id = $1 AND portal_id = $2
  `, [intent.job_id, intent.portal_id]);

  await client.query(`
    UPDATE cc_ledger_entries SET status = 'completed'
    WHERE id = $1
  `, [intent.ledger_charge_entry_id]);

  await client.query(`
    INSERT INTO cc_paid_publication_intent_events (
      tenant_id, intent_id, from_status, to_status,
      actor_individual_id, actor_identity_id,
      event_type, note, ledger_entry_id, metadata
    ) VALUES (
      $1, $2, $3, 'paid',
      $4, $5,
      'payment_recorded', $6,
      $7, $8
    )
  `, [
    intent.tenant_id,
    intent.id,
    intent.status,
    paymentInfo.actorIndividualId || null,
    paymentInfo.actorIdentityId || null,
    paymentInfo.note || `Payment recorded via ${paymentInfo.pspProvider}`,
    ledgerEntryId,
    JSON.stringify({
      amount_cents: totalCents,
      psp_provider: paymentInfo.pspProvider,
      psp_reference: paymentInfo.pspReference
    })
  ]);

  return { ledgerEntryId, updatedIntent };
}

/**
 * Record a refund for an intent
 * Creates GL refund entry, updates intent status, archives job posting
 */
export async function recordIntentRefund(
  client: PoolClient,
  intent: IntentRecord,
  refundInfo: RefundInfo
): Promise<{ ledgerEntryId: string; updatedIntent: IntentRecord }> {
  if (intent.status !== 'paid') {
    throw new Error(`Cannot refund intent in ${intent.status} status - must be paid`);
  }

  const totalCents = computeTotalCents(intent);
  const refundCents = refundInfo.amountCents ?? totalCents;

  if (refundCents > totalCents) {
    throw new Error(`Refund amount ${refundCents} exceeds total ${totalCents}`);
  }

  const refundResult = await client.query(`
    INSERT INTO cc_ledger_entries (
      tenant_id,
      entry_type,
      amount,
      currency,
      description,
      line_item_code,
      source_type,
      source_id,
      status,
      metadata
    ) VALUES (
      $1,
      'refund',
      $2,
      $3,
      $4,
      'JOB_PLACEMENT_REFUND',
      'paid_publication_intent',
      $5,
      'completed',
      $6
    )
    RETURNING id
  `, [
    intent.tenant_id,
    refundCents / 100,
    intent.currency || 'CAD',
    buildRefundDescription(intent, refundInfo),
    intent.id,
    JSON.stringify({
      job_id: intent.job_id,
      portal_id: intent.portal_id,
      refund_amount_cents: refundCents,
      original_amount_cents: totalCents,
      reason: refundInfo.reason,
      is_partial: refundCents < totalCents
    })
  ]);

  const ledgerEntryId = refundResult.rows[0].id;

  const updateResult = await client.query(`
    UPDATE cc_paid_publication_intents SET
      status = 'refunded',
      ledger_refund_entry_id = $3,
      updated_at = now()
    WHERE id = $1 AND portal_id = $2
    RETURNING *
  `, [intent.id, intent.portal_id, ledgerEntryId]);

  const updatedIntent = updateResult.rows[0];

  await client.query(`
    UPDATE cc_job_postings SET
      publish_state = 'archived',
      is_hidden = true
    WHERE job_id = $1 AND portal_id = $2
  `, [intent.job_id, intent.portal_id]);

  await client.query(`
    INSERT INTO cc_paid_publication_intent_events (
      tenant_id, intent_id, from_status, to_status,
      actor_individual_id, actor_identity_id,
      event_type, note, ledger_entry_id, metadata
    ) VALUES (
      $1, $2, 'paid', 'refunded',
      $3, $4,
      'refund_processed', $5,
      $6, $7
    )
  `, [
    intent.tenant_id,
    intent.id,
    refundInfo.actorIndividualId || null,
    refundInfo.actorIdentityId || null,
    refundInfo.note || refundInfo.reason,
    ledgerEntryId,
    JSON.stringify({
      refund_amount_cents: refundCents,
      reason: refundInfo.reason,
      is_partial: refundCents < totalCents
    })
  ]);

  return { ledgerEntryId, updatedIntent };
}

/**
 * Get full audit trail for an intent
 * Returns intent + linked ledger entries + state events
 */
export async function getIntentAuditTrail(
  client: PoolClient,
  intentId: string,
  tenantId: string
): Promise<{
  intent: IntentRecord;
  ledgerEntries: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
}> {
  const intentResult = await client.query(`
    SELECT * FROM cc_paid_publication_intents
    WHERE id = $1 AND tenant_id = $2
  `, [intentId, tenantId]);

  if (intentResult.rows.length === 0) {
    throw new Error('Intent not found or access denied');
  }

  const intent = intentResult.rows[0] as IntentRecord;

  const ledgerResult = await client.query(`
    SELECT * FROM cc_ledger_entries
    WHERE source_type = 'paid_publication_intent'
      AND source_id = $1
      AND tenant_id = $2
    ORDER BY created_at ASC
  `, [intentId, tenantId]);

  const eventsResult = await client.query(`
    SELECT * FROM cc_paid_publication_intent_events
    WHERE intent_id = $1
      AND tenant_id = $2
    ORDER BY created_at ASC
  `, [intentId, tenantId]);

  return {
    intent,
    ledgerEntries: ledgerResult.rows,
    events: eventsResult.rows
  };
}

/**
 * Generate receipt payload for an intent
 * Returns stable, evidence-grade receipt data
 */
export async function generateReceiptPayload(
  client: PoolClient,
  intentId: string,
  tenantId: string
): Promise<{
  receiptId: string;
  issuedAt: string;
  seller: Record<string, unknown>;
  buyer: Record<string, unknown>;
  lineItems: Array<Record<string, unknown>>;
  totals: Record<string, unknown>;
  paymentInfo: Record<string, unknown>;
  ledgerEntryIds: Record<string, string | null>;
}> {
  const auditTrail = await getIntentAuditTrail(client, intentId, tenantId);
  const intent = auditTrail.intent;

  const portalResult = await client.query(`
    SELECT p.*, le.legal_name, le.dba_name, le.tax_id
    FROM cc_portals p
    LEFT JOIN cc_legal_entities le ON le.id = p.legal_entity_id
    WHERE p.id = $1
  `, [intent.portal_id]);

  const portal = portalResult.rows[0] || {};

  const tenantResult = await client.query(`
    SELECT t.name, t.slug, le.legal_name, le.dba_name
    FROM cc_tenants t
    LEFT JOIN cc_legal_entities le ON le.tenant_id = t.id
    WHERE t.id = $1
  `, [intent.tenant_id]);

  const tenant = tenantResult.rows[0] || {};

  const jobResult = await client.query(`
    SELECT title, brand_name_snapshot FROM cc_jobs WHERE id = $1
  `, [intent.job_id]);

  const job = jobResult.rows[0] || {};

  const tierMetadata = intent.tier_metadata || {};
  const breakdown = (tierMetadata as any).breakdown || {};

  const lineItems: Array<Record<string, unknown>> = [];

  lineItems.push({
    description: `Job placement: ${job.title || 'Untitled'}`,
    quantity: 1,
    unitPriceCents: intent.amount_cents,
    totalCents: intent.amount_cents,
    code: 'JOB_BASE_PLACEMENT'
  });

  if (breakdown.attentionPriceCents && breakdown.attentionPriceCents > 0) {
    lineItems.push({
      description: `Attention tier: ${intent.attention_tier || 'featured'}`,
      quantity: 1,
      unitPriceCents: breakdown.attentionPriceCents,
      totalCents: breakdown.attentionPriceCents,
      code: 'JOB_ATTENTION_TIER'
    });
  }

  if (breakdown.assistancePriceCents && breakdown.assistancePriceCents > 0) {
    lineItems.push({
      description: `Assistance tier: ${intent.assistance_tier || 'assisted'}`,
      quantity: 1,
      unitPriceCents: breakdown.assistancePriceCents,
      totalCents: breakdown.assistancePriceCents,
      code: 'JOB_ASSISTANCE_TIER'
    });
  }

  const totalCents = computeTotalCents(intent);

  return {
    receiptId: intent.id,
    issuedAt: intent.paid_at || new Date().toISOString(),
    seller: {
      portalId: intent.portal_id,
      portalName: portal.name || 'Portal',
      legalName: portal.legal_name,
      dbaName: portal.dba_name,
      taxId: portal.tax_id
    },
    buyer: {
      tenantId: intent.tenant_id,
      tenantName: tenant.name || 'Tenant',
      legalName: tenant.legal_name,
      dbaName: tenant.dba_name,
      brandSnapshot: job.brand_name_snapshot
    },
    lineItems,
    totals: {
      subtotalCents: totalCents,
      taxCents: 0,
      grandTotalCents: totalCents,
      currency: intent.currency || 'CAD'
    },
    paymentInfo: {
      status: intent.status,
      pspProvider: intent.psp_provider,
      pspReference: intent.psp_reference,
      paidAt: intent.paid_at
    },
    ledgerEntryIds: {
      charge: intent.ledger_charge_entry_id || null,
      payment: intent.ledger_payment_entry_id || null,
      refund: intent.ledger_refund_entry_id || null
    }
  };
}
