/**
 * P2.12 Emergency Scope Enforcement
 * Authorization helper for temporary emergency privilege escalation
 */

import { serviceQuery } from '../../db/tenantDb.js';

export type GrantType =
  | 'asset_control'
  | 'tool_access'
  | 'vehicle_access'
  | 'lodging_access'
  | 'communications_interrupt'
  | 'procurement_override'
  | 'gate_access'
  | 'other';

export interface ScopeJson {
  asset_ids?: string[];
  tool_ids?: string[];
  location_ids?: string[];
  vehicle_ids?: string[];
  [key: string]: unknown;
}

export interface ActiveGrant {
  id: string;
  run_id: string;
  grant_type: GrantType;
  scope_json: ScopeJson;
  expires_at: Date;
}

/**
 * Check if an individual has an active emergency grant of a specific type
 * with optional scope matching
 */
export async function hasActiveEmergencyGrant(
  tenantId: string,
  individualId: string,
  grantType: GrantType,
  scopeMatcher?: (scope: ScopeJson) => boolean
): Promise<boolean> {
  const result = await serviceQuery<{
    id: string;
    run_id: string;
    grant_type: string;
    scope_json: ScopeJson;
    expires_at: Date;
  }>(
    `SELECT g.id, g.run_id, g.grant_type, g.scope_json, g.expires_at
     FROM cc_emergency_scope_grants g
     JOIN cc_emergency_runs r ON r.id = g.run_id
     WHERE g.tenant_id = $1::uuid
       AND g.grantee_individual_id = $2::uuid
       AND g.grant_type = $3
       AND g.status = 'active'
       AND g.expires_at > now()
       AND r.status = 'active'`,
    [tenantId, individualId, grantType]
  );

  if (result.rows.length === 0) {
    return false;
  }

  if (!scopeMatcher) {
    return true;
  }

  return result.rows.some((row) => scopeMatcher(row.scope_json));
}

/**
 * Get all active emergency grants for an individual
 */
export async function getActiveEmergencyGrants(
  tenantId: string,
  individualId: string
): Promise<ActiveGrant[]> {
  const result = await serviceQuery<{
    id: string;
    run_id: string;
    grant_type: GrantType;
    scope_json: ScopeJson;
    expires_at: Date;
  }>(
    `SELECT g.id, g.run_id, g.grant_type, g.scope_json, g.expires_at
     FROM cc_emergency_scope_grants g
     JOIN cc_emergency_runs r ON r.id = g.run_id
     WHERE g.tenant_id = $1::uuid
       AND g.grantee_individual_id = $2::uuid
       AND g.status = 'active'
       AND g.expires_at > now()
       AND r.status = 'active'
     ORDER BY g.expires_at ASC`,
    [tenantId, individualId]
  );

  return result.rows;
}

/**
 * Check if individual has access to a specific asset via emergency grant
 */
export async function hasEmergencyAssetAccess(
  tenantId: string,
  individualId: string,
  assetId: string
): Promise<boolean> {
  return hasActiveEmergencyGrant(tenantId, individualId, 'asset_control', (scope) => {
    return scope.asset_ids?.includes(assetId) ?? false;
  });
}

/**
 * Check if individual has access to a specific vehicle via emergency grant
 */
export async function hasEmergencyVehicleAccess(
  tenantId: string,
  individualId: string,
  vehicleId: string
): Promise<boolean> {
  return hasActiveEmergencyGrant(tenantId, individualId, 'vehicle_access', (scope) => {
    return scope.vehicle_ids?.includes(vehicleId) ?? false;
  });
}

/**
 * Check if individual has emergency procurement override
 */
export async function hasEmergencyProcurementOverride(
  tenantId: string,
  individualId: string
): Promise<boolean> {
  return hasActiveEmergencyGrant(tenantId, individualId, 'procurement_override');
}

/**
 * Expire all grants that have passed their expires_at time
 * Returns count of expired grants
 */
export async function expireEmergencyGrants(tenantId?: string): Promise<number> {
  const whereClause = tenantId ? 'AND tenant_id = $1::uuid' : '';
  const params = tenantId ? [tenantId] : [];

  const result = await serviceQuery<{ id: string; run_id: string }>(
    `UPDATE cc_emergency_scope_grants
     SET status = 'expired', revoked_at = now(), revoke_reason = 'TTL expired'
     WHERE status = 'active' AND expires_at <= now() ${whereClause}
     RETURNING id, run_id`,
    params
  );

  for (const row of result.rows) {
    await serviceQuery(
      `INSERT INTO cc_emergency_run_events (tenant_id, run_id, event_type, event_payload)
       SELECT tenant_id, $1::uuid, 'scope_revoked', $2::jsonb
       FROM cc_emergency_runs WHERE id = $1::uuid`,
      [row.run_id, JSON.stringify({ grant_id: row.id, reason: 'TTL expired' })]
    );
  }

  return result.rows.length;
}

/**
 * Revoke a specific grant
 */
export async function revokeEmergencyGrant(
  tenantId: string,
  grantId: string,
  revokedByIndividualId: string | null,
  reason: string
): Promise<void> {
  const result = await serviceQuery<{ run_id: string }>(
    `UPDATE cc_emergency_scope_grants
     SET status = 'revoked', revoked_at = now(), revoked_by_individual_id = $3, revoke_reason = $4
     WHERE tenant_id = $1::uuid AND id = $2::uuid AND status = 'active'
     RETURNING run_id`,
    [tenantId, grantId, revokedByIndividualId, reason]
  );

  if (result.rows.length > 0) {
    await serviceQuery(
      `INSERT INTO cc_emergency_run_events (tenant_id, run_id, event_type, actor_individual_id, event_payload)
       VALUES ($1::uuid, $2::uuid, 'scope_revoked', $3, $4::jsonb)`,
      [tenantId, result.rows[0].run_id, revokedByIndividualId, JSON.stringify({ grant_id: grantId, reason })]
    );
  }
}

const MAX_GRANT_HOURS = 72;

/**
 * Validate grant expiration is within allowed bounds
 */
export function validateGrantExpiration(expiresAt: Date): { valid: boolean; error?: string } {
  const now = new Date();
  const maxExpiry = new Date(now.getTime() + MAX_GRANT_HOURS * 60 * 60 * 1000);

  if (expiresAt <= now) {
    return { valid: false, error: 'expires_at must be in the future' };
  }

  if (expiresAt > maxExpiry) {
    return { valid: false, error: `expires_at must be within ${MAX_GRANT_HOURS} hours` };
  }

  return { valid: true };
}
