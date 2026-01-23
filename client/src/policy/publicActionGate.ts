/**
 * V3.5 Public Portal Action Gate
 * 
 * Filters market actions for public portal views based on viewer identity.
 * Ensures unauthenticated visitors and non-owners see read-only views.
 */

import type { MarketAction } from './marketModePolicy';

export interface GateActionsInput {
  isAuthenticated: boolean;
  viewerTenantId?: string;
  viewerUserId?: string;
  requesterTenantId?: string;
  providerTenantId?: string;
  actions: MarketAction[];
}

const REQUESTER_ACTION_IDS = [
  'send_to_provider',
  'open_to_responses',
  'invite_another_provider',
  'review_proposal',
  'accept_proposal',
  'reject_proposal',
  'modify_request',
  'cancel_request',
  'withdraw_request',
  'publish',
];

const PROVIDER_ACTION_IDS = [
  'accept_request',
  'decline_request',
  'propose_change',
  'submit_response',
  'withdraw_from_run',
  'express_interest',
  'mark_complete',
];

const OPERATOR_ACTION_IDS = [
  'admin_reassign',
  'admin_cancel',
  'admin_force_status',
  'close_signups',
];

/**
 * Gate actions for public portal viewers.
 * 
 * Rules:
 * - Unauthenticated viewers: no actions (read-only)
 * - Authenticated viewer matching requesterTenantId: requester actions only
 * - Authenticated viewer matching providerTenantId: provider actions only
 * - Operator/admin actions: never allowed in public portal
 * - Cannot determine ownership: no actions
 * 
 * @example
 * const gatedActions = gateActionsForViewer({
 *   isAuthenticated: true,
 *   viewerTenantId: 'tenant-123',
 *   requesterTenantId: 'tenant-123',
 *   providerTenantId: 'tenant-456',
 *   actions: allActions,
 * });
 * // Returns only requester actions since viewer is requester
 */
export function gateActionsForViewer(input: GateActionsInput): MarketAction[] {
  const {
    isAuthenticated,
    viewerTenantId,
    viewerUserId,
    requesterTenantId,
    providerTenantId,
    actions,
  } = input;

  if (!isAuthenticated) {
    return [];
  }

  if (!viewerTenantId && !viewerUserId) {
    return [];
  }

  const isRequester = viewerTenantId && requesterTenantId && viewerTenantId === requesterTenantId;
  const isProvider = viewerTenantId && providerTenantId && viewerTenantId === providerTenantId;

  if (!isRequester && !isProvider) {
    return [];
  }

  return actions.filter(action => {
    if (OPERATOR_ACTION_IDS.includes(action.id)) {
      return false;
    }

    if (isRequester && REQUESTER_ACTION_IDS.includes(action.id)) {
      return true;
    }

    if (isProvider && PROVIDER_ACTION_IDS.includes(action.id)) {
      return true;
    }

    return false;
  });
}

/**
 * Check if viewer can see any actions for this object.
 */
export function hasAnyActions(input: GateActionsInput): boolean {
  return gateActionsForViewer(input).length > 0;
}

/**
 * Check if viewer is the requester of this object.
 */
export function isViewerRequester(
  viewerTenantId: string | undefined,
  requesterTenantId: string | undefined
): boolean {
  return Boolean(viewerTenantId && requesterTenantId && viewerTenantId === requesterTenantId);
}

/**
 * Check if viewer is the provider for this object.
 */
export function isViewerProvider(
  viewerTenantId: string | undefined,
  providerTenantId: string | undefined
): boolean {
  return Boolean(viewerTenantId && providerTenantId && viewerTenantId === providerTenantId);
}
