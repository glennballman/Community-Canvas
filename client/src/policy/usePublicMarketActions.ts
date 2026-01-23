/**
 * V3.5 Public Portal Market Actions Hook
 * 
 * React hook for consuming market actions in public portal views.
 * Automatically gates actions based on viewer authentication and ownership.
 */

import { useMemo } from 'react';
import { useCopy } from '../copy/useCopy';
import { getMarketActions, type GetMarketActionsInput, type MarketAction } from './marketModePolicy';
import { gateActionsForViewer, isViewerRequester, isViewerProvider } from './publicActionGate';
import type { EntryPointType } from '../copy/entryPointCopy';

export interface ResolvedPublicAction extends MarketAction {
  label: string;
}

export interface UsePublicMarketActionsResult {
  actions: ResolvedPublicAction[];
  hasActions: boolean;
  isOwner: boolean;
  isRequester: boolean;
  isProvider: boolean;
  primaryAction: ResolvedPublicAction | undefined;
  secondaryActions: ResolvedPublicAction[];
  dangerActions: ResolvedPublicAction[];
}

interface UsePublicMarketActionsOptions extends GetMarketActionsInput {
  entryPoint?: EntryPointType;
  isAuthenticated: boolean;
  viewerTenantId?: string;
  viewerUserId?: string;
  requesterTenantId?: string;
  providerTenantId?: string;
}

/**
 * Hook for consuming market actions in public portal views.
 * Automatically applies viewer gating to ensure unauthenticated visitors
 * and non-owners see read-only views.
 * 
 * @example
 * const { actions, hasActions, isOwner } = usePublicMarketActions({
 *   objectType: 'service_request',
 *   actorRole: 'requester',
 *   marketMode: 'TARGETED',
 *   visibility: 'PUBLIC',
 *   requestStatus: 'AWAITING_RESPONSE',
 *   entryPoint: 'service',
 *   isAuthenticated: true,
 *   viewerTenantId: 'tenant-123',
 *   requesterTenantId: 'tenant-123',
 *   providerTenantId: 'tenant-456',
 * });
 * 
 * // Only show CTAs if viewer is owner
 * {hasActions && actions.map(action => (
 *   <Button key={action.id}>{action.label}</Button>
 * ))}
 */
export function usePublicMarketActions(options: UsePublicMarketActionsOptions): UsePublicMarketActionsResult {
  const { 
    entryPoint = 'generic', 
    isAuthenticated,
    viewerTenantId,
    viewerUserId,
    requesterTenantId,
    providerTenantId,
    ...policyInput 
  } = options;
  
  const copy = useCopy({ entryPoint });
  
  const allActions = useMemo(() => {
    return getMarketActions(policyInput);
  }, [
    policyInput.objectType,
    policyInput.actorRole,
    policyInput.marketMode,
    policyInput.visibility,
    policyInput.requestStatus,
    policyInput.runStatus,
    policyInput.hasTargetProvider,
    policyInput.hasActiveProposal,
    policyInput.isPublished,
  ]);

  const gatedActions = useMemo(() => {
    return gateActionsForViewer({
      isAuthenticated,
      viewerTenantId,
      viewerUserId,
      requesterTenantId,
      providerTenantId,
      actions: allActions,
    });
  }, [allActions, isAuthenticated, viewerTenantId, viewerUserId, requesterTenantId, providerTenantId]);

  const resolvedActions = useMemo((): ResolvedPublicAction[] => {
    return gatedActions.map(action => ({
      ...action,
      label: copy.resolve(action.tokenKey),
    }));
  }, [gatedActions, copy]);

  const result = useMemo((): UsePublicMarketActionsResult => {
    const isRequester = isViewerRequester(viewerTenantId, requesterTenantId);
    const isProvider = isViewerProvider(viewerTenantId, providerTenantId);
    const isOwner = isAuthenticated && (isRequester || isProvider);
    
    const primaryAction = resolvedActions.find(a => a.kind === 'primary');
    const secondaryActions = resolvedActions.filter(a => a.kind === 'secondary');
    const dangerActions = resolvedActions.filter(a => a.kind === 'danger');

    return {
      actions: resolvedActions,
      hasActions: resolvedActions.length > 0,
      isOwner,
      isRequester,
      isProvider,
      primaryAction,
      secondaryActions,
      dangerActions,
    };
  }, [resolvedActions, isAuthenticated, viewerTenantId, requesterTenantId, providerTenantId]);

  return result;
}
