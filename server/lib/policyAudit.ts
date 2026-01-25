import { pool } from '../db';
import type { NegotiationPolicyTrace, NegotiationType } from '@shared/schema';

export type AuditActorType = 'provider' | 'stakeholder' | 'tenant_admin' | 'platform_admin';

export interface PolicyAuditParams {
  tenantId: string;
  portalId?: string | null;
  runId: string;
  actorIndividualId?: string | null;
  actorType: AuditActorType;
  trace: NegotiationPolicyTrace;
}

export function buildRequestFingerprint(
  runId: string,
  actorType: string,
  policyHash: string
): string {
  return `${runId}:${actorType}:${policyHash}`;
}

export async function recordPolicyAuditEvent(params: PolicyAuditParams): Promise<void> {
  const { tenantId, portalId, runId, actorIndividualId, actorType, trace } = params;

  const fingerprint = buildRequestFingerprint(runId, actorType, trace.effective_policy_hash);

  try {
    await pool.query(
      `INSERT INTO cc_negotiation_policy_audit_events (
        tenant_id, portal_id, run_id, actor_individual_id, actor_type,
        negotiation_type, effective_source, effective_policy_id,
        effective_policy_updated_at, effective_policy_hash, request_fingerprint
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (request_fingerprint) DO NOTHING`,
      [
        tenantId,
        portalId || null,
        runId,
        actorIndividualId || null,
        actorType,
        trace.negotiation_type,
        trace.effective_source,
        trace.effective_policy_id,
        trace.effective_policy_updated_at,
        trace.effective_policy_hash,
        fingerprint
      ]
    );
  } catch (error) {
    console.error('Failed to record policy audit event:', error);
  }
}
