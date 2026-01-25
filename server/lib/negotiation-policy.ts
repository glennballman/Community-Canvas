import { pool } from '../db';
import type { NegotiationType, ResolvedNegotiationPolicy } from '@shared/schema';

const VALID_NEGOTIATION_TYPES = ['schedule', 'scope', 'pricing'] as const;

export async function loadNegotiationPolicy(
  tenantId: string,
  negotiationType: NegotiationType
): Promise<ResolvedNegotiationPolicy> {
  if (!VALID_NEGOTIATION_TYPES.includes(negotiationType)) {
    throw new Error(`Invalid negotiation type: ${negotiationType}`);
  }

  const platformResult = await pool.query(
    `SELECT 
      negotiation_type,
      max_turns,
      allow_counter,
      close_on_accept,
      close_on_decline,
      provider_can_initiate,
      stakeholder_can_initiate,
      allow_proposal_context
     FROM cc_platform_negotiation_policy
     WHERE negotiation_type = $1`,
    [negotiationType]
  );

  if (platformResult.rows.length === 0) {
    throw new Error(`No platform policy found for negotiation type: ${negotiationType}`);
  }

  const platform = platformResult.rows[0];

  const tenantResult = await pool.query(
    `SELECT 
      max_turns,
      allow_counter,
      close_on_accept,
      close_on_decline,
      provider_can_initiate,
      stakeholder_can_initiate,
      allow_proposal_context
     FROM cc_tenant_negotiation_policy
     WHERE tenant_id = $1 AND negotiation_type = $2`,
    [tenantId, negotiationType]
  );

  const tenant = tenantResult.rows[0] ?? {};

  return {
    negotiationType,
    maxTurns: tenant.max_turns ?? platform.max_turns,
    allowCounter: tenant.allow_counter ?? platform.allow_counter,
    closeOnAccept: tenant.close_on_accept ?? platform.close_on_accept,
    closeOnDecline: tenant.close_on_decline ?? platform.close_on_decline,
    providerCanInitiate: tenant.provider_can_initiate ?? platform.provider_can_initiate,
    stakeholderCanInitiate: tenant.stakeholder_can_initiate ?? platform.stakeholder_can_initiate,
    allowProposalContext: tenant.allow_proposal_context ?? platform.allow_proposal_context,
  };
}

export function validatePolicyEnforcement(
  policy: ResolvedNegotiationPolicy,
  actorRole: 'tenant' | 'stakeholder',
  eventType: 'proposed' | 'countered' | 'accepted' | 'declined',
  turnsUsed: number,
  isClosed: boolean
): { valid: boolean; error?: string } {
  if (isClosed) {
    return { valid: false, error: 'error.negotiation.closed' };
  }

  if ((eventType === 'proposed' || eventType === 'countered') && turnsUsed >= policy.maxTurns) {
    return { valid: false, error: 'error.negotiation.turn_limit_reached' };
  }

  if (eventType === 'countered' && !policy.allowCounter) {
    return { valid: false, error: 'error.negotiation.counter_not_allowed' };
  }

  if (eventType === 'proposed') {
    if (actorRole === 'tenant' && !policy.providerCanInitiate) {
      return { valid: false, error: 'error.negotiation.provider_cannot_initiate' };
    }
    if (actorRole === 'stakeholder' && !policy.stakeholderCanInitiate) {
      return { valid: false, error: 'error.negotiation.stakeholder_cannot_initiate' };
    }
  }

  return { valid: true };
}

export function shouldCloseNegotiation(
  policy: ResolvedNegotiationPolicy,
  eventType: 'proposed' | 'countered' | 'accepted' | 'declined'
): boolean {
  if (eventType === 'accepted' && policy.closeOnAccept) {
    return true;
  }
  if (eventType === 'declined' && policy.closeOnDecline) {
    return true;
  }
  return false;
}
