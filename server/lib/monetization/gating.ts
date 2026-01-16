/**
 * P2.15 Monetization Event Ledger - Gating Engine
 * 
 * Core module for:
 * - Checking event limits against tenant plan
 * - Recording events to append-only ledger
 * - Computing usage for reporting
 * - Enforcing hard/soft gates
 */

import { db } from "../../db";
import { sql } from "drizzle-orm";

// Event types that can be gated
export type MonetizationEventType =
  | 'emergency_run_started'
  | 'emergency_playbook_exported'
  | 'evidence_bundle_sealed'
  | 'insurance_dossier_assembled'
  | 'insurance_dossier_exported'
  | 'defense_pack_assembled'
  | 'defense_pack_exported'
  | 'authority_share_issued'
  | 'interest_group_triggered'
  | 'record_capture_created'
  | 'offline_sync_batch';

// Subject types for event context
export type MonetizationSubjectType =
  | 'emergency_run'
  | 'evidence_bundle'
  | 'claim'
  | 'dossier'
  | 'defense_pack'
  | 'authority_grant'
  | 'interest_group'
  | 'record_capture'
  | 'offline_batch';

// Plan entitlements structure
export interface PlanEntitlements {
  events: {
    [key: string]: {
      limit: number;
      period: 'day' | 'week' | 'month' | 'year';
    };
  };
  features: {
    [key: string]: boolean;
  };
  hard_gates: {
    [key: string]: boolean;
  };
}

// Event recording input
export interface MonetizationEventInput {
  tenantId: string;
  portalId?: string;
  circleId?: string;
  eventType: MonetizationEventType;
  actorIndividualId?: string;
  subjectType?: MonetizationSubjectType;
  subjectId?: string;
  quantity?: number;
  clientRequestId?: string;
  metadata?: Record<string, unknown>;
}

// Gate check result
export interface GateCheckResult {
  allowed: boolean;
  reason?: string;
  currentUsage?: number;
  limit?: number;
  periodKey?: string;
  isHardGate?: boolean;
  isSoftGate?: boolean;
}

// Usage summary for a tenant
export interface UsageSummary {
  tenantId: string;
  periodKey: string;
  planKey: string;
  events: {
    [eventType: string]: {
      count: number;
      limit: number;
      remaining: number;
      percentUsed: number;
    };
  };
  features: {
    [feature: string]: boolean;
  };
}

/**
 * Get ISO week number (ISO 8601 compliant)
 * Week 1 is the week containing the first Thursday of the year
 */
function getISOWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Set to nearest Thursday: current date + 4 - current day number (Monday = 1, Sunday = 7)
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  // Get first day of year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  // Calculate full weeks to nearest Thursday
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  // Return ISO week year (may differ from calendar year at year boundaries)
  return { year: d.getUTCFullYear(), week: weekNo };
}

/**
 * Generate period key based on period type and current date
 */
export function getPeriodKey(period: 'day' | 'week' | 'month' | 'year', date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  switch (period) {
    case 'day':
      return `${year}-${month}-${day}`;
    case 'week':
      // Use proper ISO week calculation
      const isoWeek = getISOWeek(date);
      return `${isoWeek.year}-W${String(isoWeek.week).padStart(2, '0')}`;
    case 'month':
      return `${year}-${month}`;
    case 'year':
      return `${year}`;
    default:
      return `${year}-${month}`;
  }
}

/**
 * Get the active plan for a tenant
 */
export async function getTenantPlan(tenantId: string): Promise<{ planKey: string; entitlements: PlanEntitlements } | null> {
  const result = await db.execute(sql`
    SELECT p.plan_key, p.entitlements
    FROM cc_monetization_plan_assignments pa
    JOIN cc_monetization_plans p ON pa.plan_id = p.id
    WHERE pa.tenant_id = ${tenantId}::uuid
      AND pa.status = 'active'
      AND pa.effective_from <= now()
      AND (pa.effective_to IS NULL OR pa.effective_to > now())
    ORDER BY pa.assigned_at DESC
    LIMIT 1
  `);
  
  if (!result.rows || result.rows.length === 0) {
    // Fall back to global free plan
    const freeResult = await db.execute(sql`
      SELECT plan_key, entitlements
      FROM cc_monetization_plans
      WHERE plan_key = 'free' AND tenant_id IS NULL AND status = 'active'
      LIMIT 1
    `);
    
    if (!freeResult.rows || freeResult.rows.length === 0) {
      return null;
    }
    
    const row = freeResult.rows[0] as { plan_key: string; entitlements: PlanEntitlements };
    return { planKey: row.plan_key, entitlements: row.entitlements };
  }
  
  const row = result.rows[0] as { plan_key: string; entitlements: PlanEntitlements };
  return { planKey: row.plan_key, entitlements: row.entitlements };
}

/**
 * Get current usage count for an event type in a period
 */
export async function getEventUsage(
  tenantId: string,
  eventType: MonetizationEventType,
  periodKey: string
): Promise<number> {
  const result = await db.execute(sql`
    SELECT COALESCE(SUM(quantity), 0) as count
    FROM cc_monetization_events
    WHERE tenant_id = ${tenantId}::uuid
      AND event_type = ${eventType}
      AND period_key = ${periodKey}
      AND blocked = false
  `);
  
  const row = result.rows?.[0] as { count: string } | undefined;
  return row ? parseInt(row.count, 10) : 0;
}

/**
 * Check if an event is allowed based on plan limits
 */
export async function checkGate(
  tenantId: string,
  eventType: MonetizationEventType,
  quantity = 1
): Promise<GateCheckResult> {
  const plan = await getTenantPlan(tenantId);
  
  if (!plan) {
    return {
      allowed: false,
      reason: 'No active plan found for tenant',
    };
  }
  
  const { entitlements } = plan;
  
  // Check hard gates first
  if (entitlements.hard_gates?.[eventType]) {
    return {
      allowed: false,
      reason: `Event type "${eventType}" is blocked by hard gate`,
      isHardGate: true,
    };
  }
  
  // Check event limits
  const eventLimit = entitlements.events?.[eventType];
  if (!eventLimit) {
    // No limit defined = unlimited
    return {
      allowed: true,
    };
  }
  
  const periodKey = getPeriodKey(eventLimit.period);
  const currentUsage = await getEventUsage(tenantId, eventType, periodKey);
  
  if (currentUsage + quantity > eventLimit.limit) {
    return {
      allowed: false,
      reason: `Event limit exceeded: ${currentUsage + quantity} > ${eventLimit.limit} for period ${periodKey}`,
      currentUsage,
      limit: eventLimit.limit,
      periodKey,
      isSoftGate: true,
    };
  }
  
  return {
    allowed: true,
    currentUsage,
    limit: eventLimit.limit,
    periodKey,
  };
}

/**
 * Check if a feature is enabled for a tenant
 */
export async function checkFeature(
  tenantId: string,
  featureKey: string
): Promise<{ enabled: boolean; reason?: string }> {
  const plan = await getTenantPlan(tenantId);
  
  if (!plan) {
    return {
      enabled: false,
      reason: 'No active plan found for tenant',
    };
  }
  
  const enabled = plan.entitlements.features?.[featureKey] ?? false;
  
  return {
    enabled,
    reason: enabled ? undefined : `Feature "${featureKey}" not included in plan "${plan.planKey}"`,
  };
}

/**
 * Record a monetization event to the ledger
 * Returns the event ID or null if blocked
 * Supports idempotency via client_request_id
 */
export async function recordEvent(
  input: MonetizationEventInput,
  options: { checkGate?: boolean; blockIfExceeded?: boolean } = {}
): Promise<{ eventId: string | null; blocked: boolean; reason?: string; idempotent?: boolean }> {
  const { checkGate: shouldCheck = true, blockIfExceeded = true } = options;
  
  // Check for idempotent request first
  if (input.clientRequestId) {
    const existingResult = await db.execute(sql`
      SELECT id, blocked, block_reason
      FROM cc_monetization_events
      WHERE tenant_id = ${input.tenantId}::uuid
        AND client_request_id = ${input.clientRequestId}
      LIMIT 1
    `);
    
    if (existingResult.rows && existingResult.rows.length > 0) {
      const existing = existingResult.rows[0] as { id: string; blocked: boolean; block_reason: string | null };
      return {
        eventId: existing.id,
        blocked: existing.blocked,
        reason: existing.block_reason ?? undefined,
        idempotent: true,
      };
    }
  }
  
  // Get plan for period key
  const plan = await getTenantPlan(input.tenantId);
  const periodType = plan?.entitlements.events?.[input.eventType]?.period ?? 'month';
  const periodKey = getPeriodKey(periodType);
  
  let blocked = false;
  let blockReason: string | undefined;
  
  if (shouldCheck) {
    const gateResult = await checkGate(input.tenantId, input.eventType, input.quantity ?? 1);
    
    if (!gateResult.allowed) {
      if (blockIfExceeded) {
        blocked = true;
        blockReason = gateResult.reason;
      }
    }
  }
  
  // Record event (even if blocked, for audit trail)
  const result = await db.execute(sql`
    INSERT INTO cc_monetization_events (
      tenant_id,
      portal_id,
      circle_id,
      event_type,
      actor_individual_id,
      subject_type,
      subject_id,
      quantity,
      plan_key,
      period_key,
      blocked,
      block_reason,
      client_request_id,
      metadata
    ) VALUES (
      ${input.tenantId}::uuid,
      ${input.portalId ?? null}::uuid,
      ${input.circleId ?? null}::uuid,
      ${input.eventType},
      ${input.actorIndividualId ?? null}::uuid,
      ${input.subjectType ?? null},
      ${input.subjectId ?? null}::uuid,
      ${input.quantity ?? 1},
      ${plan?.planKey ?? 'free'},
      ${periodKey},
      ${blocked},
      ${blockReason ?? null},
      ${input.clientRequestId ?? null},
      ${JSON.stringify(input.metadata ?? {})}::jsonb
    )
    RETURNING id
  `);
  
  const eventId = (result.rows?.[0] as { id: string } | undefined)?.id ?? null;
  
  return {
    eventId,
    blocked,
    reason: blockReason,
  };
}

/**
 * Record event and throw if blocked (convenience wrapper)
 */
export async function recordEventOrThrow(input: MonetizationEventInput): Promise<string> {
  const result = await recordEvent(input, { checkGate: true, blockIfExceeded: true });
  
  if (result.blocked) {
    const error = new Error(result.reason || 'Event blocked by plan limit');
    (error as any).code = 'PLAN_LIMIT_EXCEEDED';
    (error as any).eventType = input.eventType;
    throw error;
  }
  
  return result.eventId!;
}

/**
 * Get usage summary for a tenant
 */
export async function getUsageSummary(tenantId: string): Promise<UsageSummary | null> {
  const plan = await getTenantPlan(tenantId);
  
  if (!plan) {
    return null;
  }
  
  const periodKey = getPeriodKey('month'); // Default to monthly view
  
  // Get usage for all event types in current period
  const usageResult = await db.execute(sql`
    SELECT event_type, COALESCE(SUM(quantity), 0) as count
    FROM cc_monetization_events
    WHERE tenant_id = ${tenantId}::uuid
      AND period_key = ${periodKey}
      AND blocked = false
    GROUP BY event_type
  `);
  
  const usageMap: Record<string, number> = {};
  for (const row of usageResult.rows ?? []) {
    const r = row as { event_type: string; count: string };
    usageMap[r.event_type] = parseInt(r.count, 10);
  }
  
  const events: UsageSummary['events'] = {};
  for (const [eventType, config] of Object.entries(plan.entitlements.events ?? {})) {
    const count = usageMap[eventType] ?? 0;
    const limit = config.limit;
    events[eventType] = {
      count,
      limit,
      remaining: Math.max(0, limit - count),
      percentUsed: limit > 0 ? Math.round((count / limit) * 100) : 0,
    };
  }
  
  return {
    tenantId,
    periodKey,
    planKey: plan.planKey,
    events,
    features: plan.entitlements.features ?? {},
  };
}

/**
 * Assign a plan to a tenant
 */
export async function assignPlan(
  tenantId: string,
  planKey: string,
  assignedByIndividualId?: string,
  effectiveFrom?: Date,
  effectiveTo?: Date
): Promise<{ assignmentId: string }> {
  // First, get the plan ID
  const planResult = await db.execute(sql`
    SELECT id FROM cc_monetization_plans
    WHERE plan_key = ${planKey}
      AND (tenant_id IS NULL OR tenant_id = ${tenantId}::uuid)
      AND status = 'active'
    ORDER BY tenant_id DESC NULLS LAST
    LIMIT 1
  `);
  
  if (!planResult.rows || planResult.rows.length === 0) {
    throw new Error(`Plan "${planKey}" not found`);
  }
  
  const planId = (planResult.rows[0] as { id: string }).id;
  
  // Deactivate existing assignments
  await db.execute(sql`
    UPDATE cc_monetization_plan_assignments
    SET status = 'inactive', effective_to = now()
    WHERE tenant_id = ${tenantId}::uuid
      AND status = 'active'
  `);
  
  // Create new assignment
  const result = await db.execute(sql`
    INSERT INTO cc_monetization_plan_assignments (
      tenant_id,
      plan_id,
      effective_from,
      effective_to,
      assigned_by_individual_id,
      status
    ) VALUES (
      ${tenantId}::uuid,
      ${planId}::uuid,
      ${effectiveFrom?.toISOString() ?? new Date().toISOString()}::timestamptz,
      ${effectiveTo?.toISOString() ?? null}::timestamptz,
      ${assignedByIndividualId ?? null}::uuid,
      'active'
    )
    RETURNING id
  `);
  
  return {
    assignmentId: (result.rows?.[0] as { id: string })?.id,
  };
}

/**
 * Get all available plans
 */
export async function getAvailablePlans(tenantId?: string): Promise<Array<{
  id: string;
  planKey: string;
  title: string;
  description: string | null;
  entitlements: PlanEntitlements;
  isGlobal: boolean;
}>> {
  const result = await db.execute(sql`
    SELECT id, plan_key, title, description, entitlements, tenant_id IS NULL as is_global
    FROM cc_monetization_plans
    WHERE status = 'active'
      AND (tenant_id IS NULL ${tenantId ? sql`OR tenant_id = ${tenantId}::uuid` : sql``})
    ORDER BY is_global DESC, plan_key
  `);
  
  return (result.rows ?? []).map((row: any) => ({
    id: row.id,
    planKey: row.plan_key,
    title: row.title,
    description: row.description,
    entitlements: row.entitlements,
    isGlobal: row.is_global,
  }));
}

export default {
  checkGate,
  checkFeature,
  recordEvent,
  recordEventOrThrow,
  getUsageSummary,
  getTenantPlan,
  assignPlan,
  getAvailablePlans,
  getPeriodKey,
};
