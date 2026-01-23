/**
 * V3.5 Universal Copy Hook
 * 
 * React hook for accessing copy tokens based on entry point context.
 */

import { useMemo } from 'react';
import {
  ep,
  createContext,
  resolveCopy,
  getNouns,
  getStateLabels,
  getUINotices,
  getCTAs,
  getMessageTemplates,
  type EntryPointType,
  type CopyContext,
} from './CopyResolver';

interface UseCopyOptions {
  entryPoint?: string | null;
  surfaceKind?: string;
  portalTone?: 'community' | 'company';
  actorRole?: 'requester' | 'provider' | 'operator';
}

interface UseCopyResult {
  ctx: CopyContext;
  resolve: (key: string, vars?: Record<string, string | number>) => string;
  nouns: ReturnType<typeof getNouns>;
  stateLabels: ReturnType<typeof getStateLabels>;
  uiNotices: (vars?: Record<string, string | number>) => ReturnType<typeof getUINotices>;
  ctas: ReturnType<typeof getCTAs>;
  messages: (vars?: Record<string, string | number>) => ReturnType<typeof getMessageTemplates>;
  entryPointType: EntryPointType;
}

/**
 * React hook for copy token resolution
 * 
 * @example
 * const { nouns, uiNotices, resolve } = useCopy({ entryPoint: 'lodging' });
 * 
 * return (
 *   <div>
 *     <p>Your {nouns.provider} will be notified.</p>
 *     <p>{uiNotices().marketLocked}</p>
 *     <Button>{resolve('cta.proposal.review')}</Button>
 *   </div>
 * );
 */
export function useCopy(options: UseCopyOptions = {}): UseCopyResult {
  const entryPointType = useMemo(() => ep(options.entryPoint), [options.entryPoint]);
  
  const ctx = useMemo<CopyContext>(() => createContext(
    options.entryPoint,
    {
      surfaceKind: options.surfaceKind,
      portalTone: options.portalTone,
      actorRole: options.actorRole,
    }
  ), [options.entryPoint, options.surfaceKind, options.portalTone, options.actorRole]);

  const resolve = useMemo(() => {
    return (key: string, vars?: Record<string, string | number>) => resolveCopy(key, ctx, vars);
  }, [ctx]);

  const nouns = useMemo(() => getNouns(ctx), [ctx]);
  const stateLabels = useMemo(() => getStateLabels(ctx), [ctx]);
  const ctas = useMemo(() => getCTAs(ctx), [ctx]);

  const uiNotices = useMemo(() => {
    return (vars?: Record<string, string | number>) => getUINotices(ctx, vars);
  }, [ctx]);

  const messages = useMemo(() => {
    return (vars?: Record<string, string | number>) => getMessageTemplates(ctx, vars);
  }, [ctx]);

  return {
    ctx,
    resolve,
    nouns,
    stateLabels,
    uiNotices,
    ctas,
    messages,
    entryPointType,
  };
}

export default useCopy;
