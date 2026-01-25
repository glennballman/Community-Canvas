/**
 * STEP 11C Phase 2C-6: Proposal Context Source Hardening
 * Server-side sanitization and validation for proposal_context
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_UUID_KEYS = ['quote_draft_id', 'estimate_id', 'bid_id', 'trip_id'] as const;
const ALLOWED_STRING_KEYS = ['selected_scope_option'] as const;
const ALL_ALLOWED_KEYS = [...ALLOWED_UUID_KEYS, ...ALLOWED_STRING_KEYS] as const;

const MAX_SCOPE_OPTION_LENGTH = 32;

export interface SanitizedProposalContext {
  quote_draft_id?: string;
  estimate_id?: string;
  bid_id?: string;
  trip_id?: string;
  selected_scope_option?: string;
}

export function isValidUUID(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Sanitize proposal_context to only allowed keys with valid values
 * - UUID keys: must match UUID regex
 * - selected_scope_option: must be a string with length <= 32
 * - Unknown keys are dropped
 * - Returns null if no valid keys remain
 */
export function sanitizeProposalContext(
  input: unknown,
  opts?: { allowSelectedScopeOption?: boolean }
): SanitizedProposalContext | null {
  if (!isPlainObject(input)) {
    return null;
  }

  const result: SanitizedProposalContext = {};
  const allowScopeOption = opts?.allowSelectedScopeOption ?? true;

  for (const key of ALLOWED_UUID_KEYS) {
    const value = input[key];
    if (isValidUUID(value)) {
      result[key] = value;
    }
  }

  if (allowScopeOption) {
    const scopeValue = input.selected_scope_option;
    if (
      typeof scopeValue === 'string' &&
      scopeValue.trim().length > 0 &&
      scopeValue.trim().length <= MAX_SCOPE_OPTION_LENGTH
    ) {
      result.selected_scope_option = scopeValue.trim();
    }
  }

  const hasAnyKey = Object.keys(result).length > 0;
  return hasAnyKey ? result : null;
}

/**
 * Extract proposal_context from event metadata and sanitize
 */
export function extractAndSanitizeProposalContext(
  metadata: unknown
): SanitizedProposalContext | null {
  if (!isPlainObject(metadata)) {
    return null;
  }
  const raw = metadata.proposal_context;
  return sanitizeProposalContext(raw);
}

/**
 * Apply policy gate: return null if allow_proposal_context is false
 */
export function applyProposalContextPolicyGate(
  sanitized: SanitizedProposalContext | null,
  allow: boolean
): SanitizedProposalContext | null {
  if (!allow) {
    return null;
  }
  return sanitized;
}

/**
 * Full pipeline for write path: sanitize input and apply policy gate
 * Returns the sanitized context or null (which means don't persist)
 */
export function sanitizeAndGateProposalContextForWrite(
  input: unknown,
  allowProposalContext: boolean
): SanitizedProposalContext | null {
  const sanitized = sanitizeProposalContext(input);
  return applyProposalContextPolicyGate(sanitized, allowProposalContext);
}

/**
 * Full pipeline for read path: extract from metadata, sanitize, and apply policy gate
 */
export function sanitizeAndGateProposalContextForRead(
  metadata: unknown,
  allowProposalContext: boolean
): SanitizedProposalContext | null {
  const sanitized = extractAndSanitizeProposalContext(metadata);
  return applyProposalContextPolicyGate(sanitized, allowProposalContext);
}
