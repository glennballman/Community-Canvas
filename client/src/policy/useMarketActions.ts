/**
 * V3.5 MarketMode UI Policy Hook
 * 
 * React hook for consuming market actions with copy tokens.
 * Integrates marketModePolicy with useCopy for complete CTA rendering.
 */

import { useMemo } from 'react';
import { useCopy } from '../copy/useCopy';
import { 
  getMarketActions, 
  type GetMarketActionsInput, 
  type MarketAction,
  type ActionKind,
  hasAction,
  getAction,
  getPrimaryAction,
  getSecondaryActions,
  getDangerActions,
} from './marketModePolicy';
import type { EntryPointType } from '../copy/entryPointCopy';

export interface ResolvedAction extends MarketAction {
  label: string;
}

export interface UseMarketActionsResult {
  actions: ResolvedAction[];
  hasAction: (actionId: string) => boolean;
  getAction: (actionId: string) => ResolvedAction | undefined;
  primaryAction: ResolvedAction | undefined;
  secondaryActions: ResolvedAction[];
  dangerActions: ResolvedAction[];
  renderActions: (
    renderFn: (action: ResolvedAction, index: number) => React.ReactNode
  ) => React.ReactNode[];
}

interface UseMarketActionsOptions extends GetMarketActionsInput {
  entryPoint?: EntryPointType;
}

/**
 * Hook for consuming market actions with resolved copy tokens.
 * 
 * @example
 * const { primaryAction, secondaryActions, dangerActions } = useMarketActions({
 *   objectType: 'service_request',
 *   actorRole: 'requester',
 *   marketMode: 'TARGETED',
 *   visibility: 'PRIVATE',
 *   requestStatus: 'UNASSIGNED',
 *   entryPoint: 'service',
 * });
 * 
 * // Render primary CTA
 * {primaryAction && (
 *   <Button onClick={() => handleAction(primaryAction.id)}>
 *     {primaryAction.label}
 *   </Button>
 * )}
 */
export function useMarketActions(options: UseMarketActionsOptions): UseMarketActionsResult {
  const { entryPoint = 'generic', ...policyInput } = options;
  
  const copy = useCopy({ entryPoint });
  
  const actions = useMemo(() => {
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

  const resolvedActions = useMemo((): ResolvedAction[] => {
    return actions.map(action => ({
      ...action,
      label: copy.resolve(action.tokenKey),
    }));
  }, [actions, copy]);

  const result = useMemo((): UseMarketActionsResult => {
    const hasActionById = (actionId: string) => 
      resolvedActions.some(a => a.id === actionId);
    
    const getActionById = (actionId: string) => 
      resolvedActions.find(a => a.id === actionId);
    
    const primaryAction = resolvedActions.find(a => a.kind === 'primary');
    const secondaryActions = resolvedActions.filter(a => a.kind === 'secondary');
    const dangerActions = resolvedActions.filter(a => a.kind === 'danger');
    
    const renderActions = (
      renderFn: (action: ResolvedAction, index: number) => React.ReactNode
    ) => resolvedActions.map(renderFn);

    return {
      actions: resolvedActions,
      hasAction: hasActionById,
      getAction: getActionById,
      primaryAction,
      secondaryActions,
      dangerActions,
      renderActions,
    };
  }, [resolvedActions]);

  return result;
}

/**
 * Get variant for Button component based on action kind
 */
export function getButtonVariant(kind: ActionKind): 'default' | 'secondary' | 'destructive' | 'link' | 'outline' {
  switch (kind) {
    case 'primary':
      return 'default';
    case 'secondary':
      return 'secondary';
    case 'danger':
      return 'destructive';
    case 'link':
      return 'link';
    default:
      return 'outline';
  }
}

export { type MarketAction, type ActionKind } from './marketModePolicy';
