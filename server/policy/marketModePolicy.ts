/**
 * V3.5 MarketMode Policy - Server-side enforcement
 * 
 * Canonical policy module for server-side validation of market mode actions.
 * Mirrors client-side policy logic for server enforcement.
 */

export type ActorRole = 'requester' | 'provider' | 'operator';
export type ObjectType = 'service_request' | 'service_run' | 'job' | 'incident';
export type MarketMode = 'TARGETED' | 'INVITE_ONLY' | 'OPEN' | 'CLOSED';
export type VisibilityScope = 'PRIVATE' | 'PORTAL' | 'PORTAL_SET' | 'COMPANY' | 'MIXED';

export type ServiceRequestStatus = 
  | 'DRAFT'
  | 'SENT'
  | 'AWAITING_RESPONSE'
  | 'PROPOSED_CHANGE'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'UNASSIGNED'
  | 'CANCELLED'
  | 'EXPIRED';

export type ActionId = 
  | 'accept_request'
  | 'decline_request'
  | 'propose_change'
  | 'accept_proposal'
  | 'reject_proposal'
  | 'submit_response'
  | 'cancel_request'
  | 'ack'
  | 'confirm';

export interface EnsureMarketActionInput {
  actorRole: ActorRole;
  marketMode: MarketMode;
  visibility: VisibilityScope;
  actionId: ActionId;
  objectType: ObjectType;
  objectStatus?: ServiceRequestStatus;
  hasTargetProvider?: boolean;
  hasActiveProposal?: boolean;
}

export interface MarketActionResult {
  allowed: boolean;
  reason?: string;
}

export function ensureMarketActionAllowed(input: EnsureMarketActionInput): MarketActionResult {
  const { 
    actorRole, 
    marketMode, 
    visibility, 
    actionId, 
    objectType,
    objectStatus,
    hasTargetProvider = false,
    hasActiveProposal = false,
  } = input;

  if (objectType === 'service_request') {
    return checkServiceRequestAction({
      actorRole,
      marketMode,
      visibility,
      actionId,
      status: objectStatus ?? 'DRAFT',
      hasTargetProvider,
      hasActiveProposal,
    });
  }

  if (objectType === 'job') {
    return checkJobAction({ actorRole, actionId, objectStatus });
  }

  if (objectType === 'incident') {
    return { allowed: true };
  }

  return { allowed: false, reason: 'unknown_object_type' };
}

interface ServiceRequestInput {
  actorRole: ActorRole;
  marketMode: MarketMode;
  visibility: VisibilityScope;
  actionId: ActionId;
  status: ServiceRequestStatus;
  hasTargetProvider: boolean;
  hasActiveProposal: boolean;
}

function checkServiceRequestAction(input: ServiceRequestInput): MarketActionResult {
  const { actorRole, marketMode, status, actionId, hasTargetProvider, hasActiveProposal } = input;

  if (actorRole === 'provider') {
    switch (status) {
      case 'SENT':
      case 'AWAITING_RESPONSE':
        if (marketMode === 'TARGETED' && hasTargetProvider) {
          if (['accept_request', 'propose_change', 'decline_request'].includes(actionId)) {
            return { allowed: true };
          }
        }
        if (marketMode === 'OPEN' || marketMode === 'INVITE_ONLY') {
          if (actionId === 'submit_response') {
            return { allowed: true };
          }
        }
        return { allowed: false, reason: 'action_not_available_in_current_state' };

      case 'ACCEPTED':
        if (actionId === 'ack' || actionId === 'confirm') {
          return { allowed: true };
        }
        return { allowed: false, reason: 'request_already_accepted' };

      case 'DRAFT':
      case 'DECLINED':
      case 'UNASSIGNED':
      case 'CANCELLED':
      case 'EXPIRED':
        return { allowed: false, reason: 'request_not_actionable' };

      case 'PROPOSED_CHANGE':
        return { allowed: false, reason: 'waiting_for_requester_response' };

      default:
        return { allowed: false, reason: 'unknown_status' };
    }
  }

  if (actorRole === 'requester') {
    switch (status) {
      case 'PROPOSED_CHANGE':
        if (hasActiveProposal && (actionId === 'accept_proposal' || actionId === 'reject_proposal')) {
          return { allowed: true };
        }
        return { allowed: false, reason: 'no_active_proposal' };

      case 'SENT':
      case 'AWAITING_RESPONSE':
        if (actionId === 'cancel_request') {
          return { allowed: true };
        }
        return { allowed: false, reason: 'action_not_available' };

      default:
        return { allowed: false, reason: 'action_not_available_in_current_state' };
    }
  }

  return { allowed: false, reason: 'invalid_actor_role' };
}

interface JobActionInput {
  actorRole: ActorRole;
  actionId: ActionId;
  objectStatus?: ServiceRequestStatus;
}

function checkJobAction(input: JobActionInput): MarketActionResult {
  const { actorRole, actionId } = input;

  if (actorRole === 'operator') {
    if (['accept_request', 'decline_request', 'ack', 'confirm'].includes(actionId)) {
      return { allowed: true };
    }
  }

  if (actorRole === 'provider') {
    if (['ack', 'confirm'].includes(actionId)) {
      return { allowed: true };
    }
  }

  return { allowed: false, reason: 'action_not_allowed_for_role' };
}
