/**
 * V3.5 MarketMode UI Policy
 * 
 * Canonical policy module for computing allowed actions (CTAs) for 
 * ServiceRequest and ServiceRun objects based on state, market mode,
 * visibility, and actor role.
 * 
 * All button labels must use copy tokens via useCopy/resolveCopy.
 */

export type ActorRole = 'requester' | 'provider' | 'operator';

export type ObjectType = 'service_request' | 'service_run';

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

export type ServiceRunStatus = 
  | 'collecting'
  | 'bidding'
  | 'bid_review'
  | 'confirmed'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type ActionKind = 'primary' | 'secondary' | 'danger' | 'link';

export interface MarketAction {
  id: string;
  tokenKey: string;
  kind: ActionKind;
  requiresConfirm?: boolean;
}

export interface GetMarketActionsInput {
  objectType: ObjectType;
  actorRole: ActorRole;
  marketMode: MarketMode;
  visibility: VisibilityScope;
  requestStatus?: ServiceRequestStatus;
  runStatus?: ServiceRunStatus;
  hasTargetProvider?: boolean;
  hasActiveProposal?: boolean;
  isPublished?: boolean;
}

/**
 * Compute allowed actions for a ServiceRequest or ServiceRun
 * based on current state, market mode, visibility, and actor role.
 */
export function getMarketActions(input: GetMarketActionsInput): MarketAction[] {
  const {
    objectType,
    actorRole,
    marketMode,
    visibility,
    requestStatus,
    runStatus,
    hasTargetProvider = false,
    hasActiveProposal = false,
    isPublished = false,
  } = input;

  const actions: MarketAction[] = [];

  if (objectType === 'service_request') {
    return getServiceRequestActions({
      actorRole,
      marketMode,
      visibility,
      status: requestStatus ?? 'DRAFT',
      hasTargetProvider,
      hasActiveProposal,
    });
  }

  if (objectType === 'service_run') {
    return getServiceRunActions({
      actorRole,
      marketMode,
      visibility,
      status: runStatus ?? 'collecting',
      isPublished,
      hasActiveProposal,
    });
  }

  return actions;
}

interface ServiceRequestInput {
  actorRole: ActorRole;
  marketMode: MarketMode;
  visibility: VisibilityScope;
  status: ServiceRequestStatus;
  hasTargetProvider: boolean;
  hasActiveProposal: boolean;
}

function getServiceRequestActions(input: ServiceRequestInput): MarketAction[] {
  const { actorRole, marketMode, visibility, status, hasTargetProvider, hasActiveProposal } = input;
  const actions: MarketAction[] = [];

  if (actorRole === 'requester') {
    switch (status) {
      case 'DRAFT':
        if (visibility === 'PRIVATE') {
          actions.push({
            id: 'send_to_provider',
            tokenKey: 'cta.request.send',
            kind: 'primary',
          });
        } else {
          actions.push({
            id: 'publish',
            tokenKey: 'cta.publish',
            kind: 'primary',
          });
        }
        break;

      case 'SENT':
      case 'AWAITING_RESPONSE':
        actions.push({
          id: 'cancel_request',
          tokenKey: 'cta.request.cancel',
          kind: 'danger',
          requiresConfirm: true,
        });
        break;

      case 'PROPOSED_CHANGE':
        if (hasActiveProposal) {
          actions.push({
            id: 'accept_proposal',
            tokenKey: 'cta.proposal.accept',
            kind: 'primary',
          });
          actions.push({
            id: 'reject_proposal',
            tokenKey: 'cta.proposal.reject',
            kind: 'secondary',
          });
        }
        break;

      case 'ACCEPTED':
        break;

      case 'DECLINED':
      case 'UNASSIGNED':
        if (marketMode === 'TARGETED' || marketMode === 'INVITE_ONLY') {
          actions.push({
            id: 'invite_another_provider',
            tokenKey: 'cta.request.invite_another_provider',
            kind: 'primary',
          });
        }
        if (marketMode === 'OPEN' || marketMode === 'INVITE_ONLY') {
          actions.push({
            id: 'open_to_responses',
            tokenKey: 'cta.request.open_to_bids',
            kind: 'secondary',
          });
        }
        actions.push({
          id: 'modify_request',
          tokenKey: 'cta.request.modify',
          kind: 'link',
        });
        actions.push({
          id: 'cancel_request',
          tokenKey: 'cta.request.cancel',
          kind: 'danger',
          requiresConfirm: true,
        });
        break;

      case 'CANCELLED':
      case 'EXPIRED':
        break;
    }
  }

  if (actorRole === 'provider') {
    switch (status) {
      case 'SENT':
      case 'AWAITING_RESPONSE':
        if (marketMode === 'TARGETED' && hasTargetProvider) {
          actions.push({
            id: 'accept_request',
            tokenKey: 'cta.request.accept',
            kind: 'primary',
          });
          actions.push({
            id: 'propose_change',
            tokenKey: 'cta.proposal.propose_change',
            kind: 'secondary',
          });
          actions.push({
            id: 'decline_request',
            tokenKey: 'cta.request.decline',
            kind: 'danger',
            requiresConfirm: true,
          });
        } else if (marketMode === 'OPEN' || marketMode === 'INVITE_ONLY') {
          actions.push({
            id: 'submit_response',
            tokenKey: 'cta.proposal.submit',
            kind: 'primary',
          });
        }
        break;

      case 'PROPOSED_CHANGE':
        break;

      case 'ACCEPTED':
        actions.push({
          id: 'withdraw_acceptance',
          tokenKey: 'cta.request.withdraw',
          kind: 'danger',
          requiresConfirm: true,
        });
        break;

      case 'DRAFT':
      case 'DECLINED':
      case 'UNASSIGNED':
      case 'CANCELLED':
      case 'EXPIRED':
        break;
    }
  }

  if (actorRole === 'operator') {
    if (status !== 'CANCELLED' && status !== 'EXPIRED' && status !== 'COMPLETED' as any) {
      actions.push({
        id: 'admin_reassign',
        tokenKey: 'cta.admin.reassign',
        kind: 'secondary',
      });
      actions.push({
        id: 'admin_cancel',
        tokenKey: 'cta.admin.cancel',
        kind: 'danger',
        requiresConfirm: true,
      });
    }
  }

  return actions;
}

interface ServiceRunInput {
  actorRole: ActorRole;
  marketMode: MarketMode;
  visibility: VisibilityScope;
  status: ServiceRunStatus;
  isPublished: boolean;
  hasActiveProposal: boolean;
}

function getServiceRunActions(input: ServiceRunInput): MarketAction[] {
  const { actorRole, marketMode, visibility, status, isPublished, hasActiveProposal } = input;
  const actions: MarketAction[] = [];

  if (actorRole === 'requester') {
    switch (status) {
      case 'collecting':
        if (!isPublished && visibility !== 'PRIVATE') {
          actions.push({
            id: 'publish',
            tokenKey: 'cta.publish',
            kind: 'primary',
          });
        }
        if (isPublished) {
          actions.push({
            id: 'close_signups',
            tokenKey: 'cta.run.close_signups',
            kind: 'secondary',
          });
        }
        break;

      case 'bidding':
      case 'bid_review':
        break;

      case 'confirmed':
      case 'scheduled':
        break;

      case 'in_progress':
        break;

      case 'completed':
      case 'cancelled':
        break;
    }
  }

  if (actorRole === 'provider') {
    switch (status) {
      case 'collecting':
        if (marketMode === 'OPEN' || marketMode === 'INVITE_ONLY') {
          actions.push({
            id: 'express_interest',
            tokenKey: 'cta.run.express_interest',
            kind: 'primary',
          });
        }
        break;

      case 'bidding':
        actions.push({
          id: 'submit_response',
          tokenKey: 'cta.proposal.submit',
          kind: 'primary',
        });
        break;

      case 'bid_review':
        break;

      case 'confirmed':
      case 'scheduled':
        actions.push({
          id: 'withdraw_run',
          tokenKey: 'cta.run.withdraw',
          kind: 'danger',
          requiresConfirm: true,
        });
        break;

      case 'in_progress':
        actions.push({
          id: 'mark_complete',
          tokenKey: 'cta.run.mark_complete',
          kind: 'primary',
        });
        break;

      case 'completed':
      case 'cancelled':
        break;
    }
  }

  if (actorRole === 'operator') {
    if (status !== 'completed' && status !== 'cancelled') {
      actions.push({
        id: 'admin_force_status',
        tokenKey: 'cta.admin.force_status',
        kind: 'secondary',
      });
      actions.push({
        id: 'admin_cancel',
        tokenKey: 'cta.admin.cancel',
        kind: 'danger',
        requiresConfirm: true,
      });
    }
  }

  return actions;
}

/**
 * Helper to check if an action is available
 */
export function hasAction(actions: MarketAction[], actionId: string): boolean {
  return actions.some(a => a.id === actionId);
}

/**
 * Helper to get a specific action
 */
export function getAction(actions: MarketAction[], actionId: string): MarketAction | undefined {
  return actions.find(a => a.id === actionId);
}

/**
 * Filter actions by kind
 */
export function filterActionsByKind(actions: MarketAction[], kind: ActionKind): MarketAction[] {
  return actions.filter(a => a.kind === kind);
}

/**
 * Get primary action (first primary action)
 */
export function getPrimaryAction(actions: MarketAction[]): MarketAction | undefined {
  return actions.find(a => a.kind === 'primary');
}

/**
 * Get secondary actions
 */
export function getSecondaryActions(actions: MarketAction[]): MarketAction[] {
  return actions.filter(a => a.kind === 'secondary');
}

/**
 * Get danger actions (require confirmation)
 */
export function getDangerActions(actions: MarketAction[]): MarketAction[] {
  return actions.filter(a => a.kind === 'danger');
}
