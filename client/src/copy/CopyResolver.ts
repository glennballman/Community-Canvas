/**
 * V3.5 Universal Copy Resolver
 * 
 * Single canonical resolver for all copy tokens.
 * Looks up entry-point-specific wording with generic fallback.
 */

import { ENTRY_POINT_COPY, type EntryPointType, type CopyContext } from './entryPointCopy';

/**
 * Safe mapping of string to EntryPointType with fallback to 'generic'
 */
export function ep(entryPoint?: string | null): EntryPointType {
  if (!entryPoint) return 'generic';
  
  const normalized = entryPoint.toLowerCase().trim();
  
  const validTypes: EntryPointType[] = [
    'lodging', 'parking', 'marina', 'restaurant', 
    'equipment', 'service', 'activity', 'generic'
  ];
  
  if (validTypes.includes(normalized as EntryPointType)) {
    return normalized as EntryPointType;
  }
  
  return 'generic';
}

/**
 * Create a CopyContext with defaults
 */
export function createContext(
  entryPoint?: string | null,
  options?: Partial<Omit<CopyContext, 'entryPoint'>>
): CopyContext {
  return {
    entryPoint: ep(entryPoint),
    ...options,
  };
}

/**
 * Resolve copy token with variable interpolation
 * 
 * @param key - Token key (e.g., 'label.noun.provider', 'msg.invite.sent.subject')
 * @param ctx - Copy context containing entry point type
 * @param vars - Optional variables for interpolation (e.g., { requestTitle: 'My Request' })
 * @returns Resolved string or [[key]] placeholder if not found
 */
export function resolveCopy(
  key: string,
  ctx: CopyContext,
  vars?: Record<string, string | number>
): string {
  const entryPointCopy = ENTRY_POINT_COPY[ctx.entryPoint];
  const genericCopy = ENTRY_POINT_COPY.generic;
  
  let value = entryPointCopy?.[key] ?? genericCopy?.[key];
  
  if (!value) {
    const placeholder = `[[${key}]]`;
    
    // DEV-only warning for missing tokens
    if (import.meta.env.DEV) {
      console.warn(
        `[CopyResolver] Missing token: "${key}" for entry point "${ctx.entryPoint}"\n` +
        `  → Returned placeholder: ${placeholder}\n` +
        `  → Add this token to client/src/copy/entryPointCopy.ts`
      );
    }
    
    return placeholder;
  }
  
  if (vars) {
    for (const [varName, varValue] of Object.entries(vars)) {
      value = value.replace(new RegExp(`\\{${varName}\\}`, 'g'), String(varValue));
    }
  }
  
  return value;
}

/**
 * Create a bound resolver for a specific context
 * Useful when you need to resolve multiple tokens with the same context
 */
export function createResolver(ctx: CopyContext) {
  return (key: string, vars?: Record<string, string | number>) => 
    resolveCopy(key, ctx, vars);
}

/**
 * Resolve multiple tokens at once
 */
export function resolveMultiple(
  keys: string[],
  ctx: CopyContext,
  vars?: Record<string, string | number>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of keys) {
    result[key] = resolveCopy(key, ctx, vars);
  }
  return result;
}

/**
 * Hook-friendly helper: get noun labels for display
 */
export function getNouns(ctx: CopyContext) {
  return {
    provider: resolveCopy('label.noun.provider', ctx),
    requester: resolveCopy('label.noun.requester', ctx),
    request: resolveCopy('label.noun.request', ctx),
    run: resolveCopy('label.noun.run', ctx),
    community: resolveCopy('label.noun.community', ctx),
    company: resolveCopy('label.noun.company', ctx),
    reservation: resolveCopy('label.noun.reservation', ctx),
  };
}

/**
 * Hook-friendly helper: get state labels
 */
export function getStateLabels(ctx: CopyContext) {
  return {
    marketTargeted: resolveCopy('state.market.TARGETED.label', ctx),
    marketOpen: resolveCopy('state.market.OPEN.label', ctx),
    marketInviteOnly: resolveCopy('state.market.INVITE_ONLY.label', ctx),
    visibilityPrivate: resolveCopy('state.visibility.PRIVATE.label', ctx),
    requestUnassigned: resolveCopy('state.request.UNASSIGNED.label', ctx),
  };
}

/**
 * Hook-friendly helper: get UI notices
 */
export function getUINotices(ctx: CopyContext, vars?: Record<string, string | number>) {
  return {
    marketLocked: resolveCopy('ui.market.locked_notice', ctx, vars),
    askRequesterTitle: resolveCopy('ui.publish.ask_requester.title', ctx, vars),
    askRequesterBody: resolveCopy('ui.publish.ask_requester.body', ctx, vars),
    justPublishNotice: resolveCopy('ui.publish.just_publish.notice', ctx, vars),
    aiRouteZonesTitle: resolveCopy('ui.ai.suggestion.route_zones.title', ctx, vars),
    aiRouteZonesBody: resolveCopy('ui.ai.suggestion.route_zones.body', ctx, vars),
  };
}

/**
 * Hook-friendly helper: get CTAs
 */
export function getCTAs(ctx: CopyContext) {
  return {
    proposalReview: resolveCopy('cta.proposal.review', ctx),
    requestOpenToBids: resolveCopy('cta.request.open_to_bids', ctx),
    inviteAnotherProvider: resolveCopy('cta.request.invite_another_provider', ctx),
  };
}

/**
 * Hook-friendly helper: get message templates
 */
export function getMessageTemplates(ctx: CopyContext, vars?: Record<string, string | number>) {
  return {
    inviteSent: {
      subject: resolveCopy('msg.invite.sent.subject', ctx, vars),
      body: resolveCopy('msg.invite.sent.body', ctx, vars),
    },
    requestAccepted: {
      subject: resolveCopy('msg.request.accepted.subject', ctx, vars),
      body: resolveCopy('msg.request.accepted.body', ctx, vars),
    },
    proposalCreated: {
      subject: resolveCopy('msg.proposal.created.subject', ctx, vars),
      body: resolveCopy('msg.proposal.created.body', ctx, vars),
    },
    requestDeclined: {
      subject: resolveCopy('msg.request.declined.subject', ctx, vars),
      body: resolveCopy('msg.request.declined.body', ctx, vars),
    },
    requestUnassigned: {
      subject: resolveCopy('msg.request.unassigned.subject', ctx, vars),
      body: resolveCopy('msg.request.unassigned.body', ctx, vars),
    },
  };
}

export { type EntryPointType, type CopyContext } from './entryPointCopy';
