/**
 * P2.11: Trigger Evaluation Engine
 * 
 * Evaluates trigger conditions for interest groups.
 * On trigger, creates:
 * - Legal Hold (P2.7)
 * - Sealed Evidence Bundle (P2.5)
 * - Authority Grant (P2.9) if auto_share enabled
 */

import { pool } from '../../db';
import { serviceQuery } from '../../db/tenantDb';
import { sha256Hex, canonicalizeJson } from '../evidence/custody';

export interface TriggerParams {
  min_count?: number;
  geo_key?: string;
  hours?: number;
  all?: TriggerParams[];
}

export interface Trigger {
  id: string;
  triggerType: 'headcount' | 'geo_quorum' | 'time_window' | 'composite';
  params: TriggerParams;
  enabled: boolean;
}

export interface GroupAggregates {
  totalSignals: number;
  activeSignals: number;
  geoBuckets: Map<string, Map<string, number>>;
  oldestSignal: Date | null;
  newestSignal: Date | null;
  proofBundleIds: string[];
}

export interface TriggerResult {
  triggered: boolean;
  reason: string | null;
  aggregates: GroupAggregates;
}

/**
 * Compute aggregates for a group
 */
async function computeAggregates(tenantId: string, groupId: string): Promise<GroupAggregates> {
  // Get signal counts and timestamps
  const statsResult = await serviceQuery<{
    total: string;
    active: string;
    oldest: Date | null;
    newest: Date | null;
  }>(
    `SELECT 
       COUNT(*) as total,
       COUNT(*) FILTER (WHERE signal_status = 'active') as active,
       MIN(submitted_at) FILTER (WHERE signal_status = 'active') as oldest,
       MAX(submitted_at) FILTER (WHERE signal_status = 'active') as newest
     FROM cc_interest_group_signals
     WHERE tenant_id = $1::uuid AND group_id = $2::uuid`,
    [tenantId, groupId]
  );

  const stats = statsResult.rows[0];

  // Get geo buckets
  const geoResult = await serviceQuery<{
    geo_key: string;
    geo_value: string;
    cnt: string;
  }>(
    `SELECT geo_key, geo_value, COUNT(*) as cnt
     FROM cc_interest_group_signals
     WHERE tenant_id = $1::uuid AND group_id = $2::uuid
       AND signal_status = 'active'
       AND geo_key IS NOT NULL
     GROUP BY geo_key, geo_value`,
    [tenantId, groupId]
  );

  const geoBuckets = new Map<string, Map<string, number>>();
  for (const row of geoResult.rows) {
    if (!geoBuckets.has(row.geo_key)) {
      geoBuckets.set(row.geo_key, new Map());
    }
    geoBuckets.get(row.geo_key)!.set(row.geo_value, parseInt(row.cnt));
  }

  // Get proof bundle IDs
  const proofResult = await serviceQuery<{ proof_evidence_bundle_id: string }>(
    `SELECT DISTINCT proof_evidence_bundle_id
     FROM cc_interest_group_signals
     WHERE tenant_id = $1::uuid AND group_id = $2::uuid
       AND signal_status = 'active'
       AND proof_evidence_bundle_id IS NOT NULL`,
    [tenantId, groupId]
  );

  return {
    totalSignals: parseInt(stats.total),
    activeSignals: parseInt(stats.active),
    geoBuckets,
    oldestSignal: stats.oldest,
    newestSignal: stats.newest,
    proofBundleIds: proofResult.rows.map(r => r.proof_evidence_bundle_id),
  };
}

/**
 * Check if a single trigger is satisfied
 */
function checkTrigger(trigger: Trigger, aggregates: GroupAggregates): { satisfied: boolean; reason: string } {
  switch (trigger.triggerType) {
    case 'headcount': {
      const minCount = trigger.params.min_count || 0;
      const satisfied = aggregates.activeSignals >= minCount;
      return {
        satisfied,
        reason: satisfied 
          ? `Headcount threshold met: ${aggregates.activeSignals} >= ${minCount}`
          : `Headcount not met: ${aggregates.activeSignals} < ${minCount}`,
      };
    }

    case 'geo_quorum': {
      const minCount = trigger.params.min_count || 0;
      const geoKey = trigger.params.geo_key || 'postal_fsa';
      
      const keyBuckets = aggregates.geoBuckets.get(geoKey);
      if (!keyBuckets) {
        return { satisfied: false, reason: `No signals with geo_key: ${geoKey}` };
      }

      // Find any bucket that meets the quorum
      for (const entry of Array.from(keyBuckets.entries())) {
        const [value, count] = entry;
        if (count >= minCount) {
          return {
            satisfied: true,
            reason: `Geo quorum met: ${geoKey}=${value} has ${count} >= ${minCount} signals`,
          };
        }
      }
      return { satisfied: false, reason: `No geo bucket meets quorum of ${minCount}` };
    }

    case 'time_window': {
      const hours = trigger.params.hours || 72;
      if (!aggregates.oldestSignal || !aggregates.newestSignal) {
        return { satisfied: false, reason: 'No signals to evaluate time window' };
      }

      const windowMs = hours * 60 * 60 * 1000;
      const signalSpanMs = aggregates.newestSignal.getTime() - aggregates.oldestSignal.getTime();
      const satisfied = signalSpanMs <= windowMs;
      
      return {
        satisfied,
        reason: satisfied
          ? `Time window satisfied: all signals within ${hours}h`
          : `Time window exceeded: signals span ${Math.round(signalSpanMs / 3600000)}h > ${hours}h`,
      };
    }

    case 'composite': {
      const subTriggers = trigger.params.all || [];
      const results = subTriggers.map((params, i) => {
        const subTrigger: Trigger = {
          id: `${trigger.id}_sub_${i}`,
          triggerType: inferTriggerType(params),
          params,
          enabled: true,
        };
        return checkTrigger(subTrigger, aggregates);
      });

      const allSatisfied = results.every(r => r.satisfied);
      return {
        satisfied: allSatisfied,
        reason: allSatisfied
          ? `Composite trigger satisfied: all ${results.length} conditions met`
          : `Composite trigger not met: ${results.filter(r => !r.satisfied).length}/${results.length} conditions failed`,
      };
    }

    default:
      return { satisfied: false, reason: `Unknown trigger type: ${trigger.triggerType}` };
  }
}

/**
 * Infer trigger type from params
 */
function inferTriggerType(params: TriggerParams): Trigger['triggerType'] {
  if (params.all) return 'composite';
  if (params.geo_key) return 'geo_quorum';
  if (params.hours) return 'time_window';
  return 'headcount';
}

/**
 * Evaluate all triggers for a group
 */
export async function evaluateGroupTriggers(
  tenantId: string,
  groupId: string
): Promise<TriggerResult> {
  // Get group status
  const groupResult = await serviceQuery<{ status: string }>(
    `SELECT status FROM cc_interest_groups WHERE tenant_id = $1::uuid AND id = $2::uuid`,
    [tenantId, groupId]
  );

  if (groupResult.rows.length === 0) {
    throw new Error('Group not found');
  }

  if (groupResult.rows[0].status !== 'open') {
    return {
      triggered: false,
      reason: null,
      aggregates: {
        totalSignals: 0,
        activeSignals: 0,
        geoBuckets: new Map(),
        oldestSignal: null,
        newestSignal: null,
        proofBundleIds: [],
      },
    };
  }

  // Get triggers
  const triggersResult = await serviceQuery<{
    id: string;
    trigger_type: string;
    params: TriggerParams;
    enabled: boolean;
  }>(
    `SELECT id, trigger_type, params, enabled
     FROM cc_interest_group_triggers
     WHERE tenant_id = $1::uuid AND group_id = $2::uuid AND enabled = true`,
    [tenantId, groupId]
  );

  const triggers: Trigger[] = triggersResult.rows.map(r => ({
    id: r.id,
    triggerType: r.trigger_type as Trigger['triggerType'],
    params: r.params,
    enabled: r.enabled,
  }));

  // Compute aggregates
  const aggregates = await computeAggregates(tenantId, groupId);

  // Log evaluation event
  await serviceQuery(
    `INSERT INTO cc_interest_group_events (tenant_id, group_id, event_type, event_payload)
     VALUES ($1::uuid, $2::uuid, 'trigger_evaluated', $3::jsonb)`,
    [tenantId, groupId, JSON.stringify({ trigger_count: triggers.length, active_signals: aggregates.activeSignals })]
  );

  // Check each trigger
  for (const trigger of triggers) {
    const result = checkTrigger(trigger, aggregates);
    if (result.satisfied) {
      // Trigger fired!
      await onGroupTriggered(tenantId, groupId, result.reason, aggregates);
      return {
        triggered: true,
        reason: result.reason,
        aggregates,
      };
    }
  }

  return {
    triggered: false,
    reason: null,
    aggregates,
  };
}

/**
 * Handle group trigger event
 * Creates legal hold, evidence bundle, and optionally authority grant
 */
async function onGroupTriggered(
  tenantId: string,
  groupId: string,
  reason: string,
  aggregates: GroupAggregates
): Promise<void> {
  const now = new Date();

  // Get group details
  const groupResult = await serviceQuery<{
    id: string;
    title: string;
    group_type: string;
    description: string;
    portal_id: string | null;
    circle_id: string | null;
    metadata: { auto_share?: boolean };
  }>(
    `SELECT id, title, group_type, description, portal_id, circle_id, metadata
     FROM cc_interest_groups
     WHERE tenant_id = $1::uuid AND id = $2::uuid`,
    [tenantId, groupId]
  );

  const group = groupResult.rows[0];

  // 1. Create Legal Hold (P2.7)
  const holdResult = await serviceQuery<{ id: string }>(
    `INSERT INTO cc_legal_holds (
       tenant_id, hold_type, title, hold_status, metadata
     )
     VALUES ($1::uuid, 'class_action', $2, 'active', $3::jsonb)
     RETURNING id`,
    [
      tenantId,
      `Legal Hold: ${group.title}`,
      JSON.stringify({ group_id: groupId, group_type: group.group_type, reason }),
    ]
  );
  const holdId = holdResult.rows[0].id;

  // Add hold targets for the group and proof bundles
  await serviceQuery(
    `INSERT INTO cc_legal_hold_targets (tenant_id, hold_id, target_type, table_name, scope_filter)
     VALUES ($1::uuid, $2::uuid, 'table_scope', 'cc_interest_group_signals', $3::jsonb)`,
    [tenantId, holdId, JSON.stringify({ group_id: groupId })]
  );

  for (const bundleId of aggregates.proofBundleIds) {
    await serviceQuery(
      `INSERT INTO cc_legal_hold_targets (tenant_id, hold_id, target_type, target_id)
       VALUES ($1::uuid, $2::uuid, 'evidence_bundle', $3::uuid)`,
      [tenantId, holdId, bundleId]
    );
  }

  // Log hold event
  await serviceQuery(
    `INSERT INTO cc_legal_hold_events (tenant_id, hold_id, event_type, event_payload)
     VALUES ($1::uuid, $2::uuid, 'created', $3::jsonb)`,
    [tenantId, holdId, JSON.stringify({ reason, group_id: groupId })]
  );

  // 2. Create sealed Evidence Bundle (P2.5)
  const bundleManifest = {
    algorithm_version: 'interest_group_v1',
    group_id: groupId,
    group_type: group.group_type,
    title: group.title,
    trigger_reason: reason,
    triggered_at: now.toISOString(),
    aggregates: {
      total_signals: aggregates.activeSignals,
      geo_buckets: Object.fromEntries(
        Array.from(aggregates.geoBuckets.entries()).map(([k, v]) => [
          k,
          Object.fromEntries(v.entries()),
        ])
      ),
      proof_bundle_count: aggregates.proofBundleIds.length,
      proof_bundle_ids: aggregates.proofBundleIds,
    },
    legal_hold_id: holdId,
  };

  const manifestSha = sha256Hex(canonicalizeJson(bundleManifest));

  const bundleResult = await serviceQuery<{ id: string }>(
    `INSERT INTO cc_evidence_bundles (
       tenant_id, bundle_type, title,
       bundle_status, manifest_json, manifest_sha256, sealed_at
     )
     VALUES ($1::uuid, 'class_action', $2,
             'sealed', $3::jsonb, $4, $5)
     RETURNING id`,
    [
      tenantId,
      `Coordination Bundle: ${group.title}`,
      JSON.stringify(bundleManifest),
      manifestSha,
      now.toISOString(),
    ]
  );
  const bundleId = bundleResult.rows[0].id;

  // 3. Optionally create Authority Grant (P2.9)
  let grantId: string | null = null;
  if (group.metadata?.auto_share) {
    const grantResult = await serviceQuery<{ id: string }>(
      `INSERT INTO cc_authority_access_grants (
         tenant_id, grant_type, recipient_name, recipient_organization,
         expires_at, max_views, created_by_individual_id
       )
       VALUES ($1::uuid, 'generic', 'Auto-Share Recipient', 'Counsel/Authority',
               $2, 1000, NULL)
       RETURNING id`,
      [tenantId, new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()] // 30 days
    );
    grantId = grantResult.rows[0].id;

    // Add scope for the bundle
    await serviceQuery(
      `INSERT INTO cc_authority_access_scopes (tenant_id, grant_id, scope_type, scope_id)
       VALUES ($1::uuid, $2::uuid, 'evidence_bundle', $3::uuid)`,
      [tenantId, grantId, bundleId]
    );
  }

  // 4. Update group status
  await serviceQuery(
    `UPDATE cc_interest_groups
     SET status = 'triggered',
         triggered_at = $3,
         trigger_reason = $4,
         triggered_bundle_id = $5::uuid,
         triggered_hold_id = $6::uuid,
         triggered_grant_id = $7
     WHERE tenant_id = $1::uuid AND id = $2::uuid`,
    [tenantId, groupId, now.toISOString(), reason, bundleId, holdId, grantId]
  );

  // 5. Log triggered event
  await serviceQuery(
    `INSERT INTO cc_interest_group_events (tenant_id, group_id, event_type, event_payload)
     VALUES ($1::uuid, $2::uuid, 'triggered', $3::jsonb)`,
    [
      tenantId,
      groupId,
      JSON.stringify({
        reason,
        hold_id: holdId,
        bundle_id: bundleId,
        grant_id: grantId,
        total_signals: aggregates.activeSignals,
      }),
    ]
  );
}

/**
 * Close a group
 */
export async function closeGroup(tenantId: string, groupId: string): Promise<void> {
  await serviceQuery(
    `UPDATE cc_interest_groups SET status = 'closed' WHERE tenant_id = $1::uuid AND id = $2::uuid`,
    [tenantId, groupId]
  );

  await serviceQuery(
    `INSERT INTO cc_interest_group_events (tenant_id, group_id, event_type, event_payload)
     VALUES ($1::uuid, $2::uuid, 'closed', '{}'::jsonb)`,
    [tenantId, groupId]
  );
}
