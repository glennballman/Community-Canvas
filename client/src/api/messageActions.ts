/**
 * V3.5 Message Action Blocks - API Client
 * 
 * Client-side API helper for interacting with message action blocks.
 */

import { apiRequest } from '@/lib/queryClient';

export interface ActionBlockV1 {
  version: 1;
  blockType: 
    | 'summary'
    | 'question'
    | 'multi_question'
    | 'availability'
    | 'capacity'
    | 'offer'
    | 'deposit_request'
    | 'change_request'
    | 'signature_request'
    | 'cancellation';
  domain: 'job' | 'reservation' | 'service_run' | 'incident';
  target_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'informational';
  payload: Record<string, unknown>;
  ctaUrl?: string;
  linkedEntityType?: string;
  linkedEntityId?: string;
  created_at: string;
  resolved_at?: string;
  resolved_by?: string;
  expires_at?: string;
}

export type ActionType = 'accept' | 'decline' | 'answer' | 'acknowledge' | 'counter';

export interface ActionRequest {
  action: ActionType;
  response?: unknown;
  idempotencyKey?: string;
}

export interface ActionResponse {
  ok: boolean;
  message_id: string;
  conversation_id: string;
  action_block: ActionBlockV1;
  idempotent?: boolean;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Stable hash for idempotency keys (fallback).
 * NOTE: Not cryptographic; just deterministic for retry semantics.
 */
export const stableHash16 = (obj: unknown): string => {
  try {
    const s = JSON.stringify(obj ?? null);
    return btoa(unescape(encodeURIComponent(s))).slice(0, 16);
  } catch {
    return 'unhashable_payload';
  }
};

/**
 * Generate a stable idempotency key for an action
 */
export function generateIdempotencyKey(
  messageId: string, 
  action: ActionType, 
  response?: unknown
): string {
  if (response !== undefined) {
    return `${messageId}:${action}:${stableHash16(response)}`;
  }
  return `${messageId}:${action}`;
}

/**
 * Execute an action on a message's action block
 * 
 * POST /api/messages/:messageId/action
 */
export async function postMessageAction(
  messageId: string,
  body: ActionRequest
): Promise<ActionResponse> {
  const response = await apiRequest('POST', `/api/messages/${messageId}/action`, body);
  const data = await response.json();
  
  if (!data.ok) {
    const error = new Error(data.error?.message || 'Action failed') as Error & { 
      code?: string; 
      details?: unknown;
    };
    error.code = data.error?.code;
    error.details = data.error?.details;
    throw error;
  }
  
  return data;
}

/**
 * Get allowed actions for a block type
 */
export function getAllowedActionsForBlockType(blockType: ActionBlockV1['blockType']): ActionType[] {
  const mapping: Record<ActionBlockV1['blockType'], ActionType[]> = {
    summary: [],
    deposit_request: [],
    signature_request: [],
    question: ['answer'],
    multi_question: ['answer'],
    offer: ['accept', 'decline'],
    availability: ['accept', 'counter'],
    change_request: ['accept', 'decline', 'counter'],
    capacity: ['acknowledge'],
    cancellation: ['acknowledge'],
  };
  return mapping[blockType];
}

/**
 * Check if a block type has any inline actions (vs link-out only)
 */
export function isBlockTypeActionable(blockType: ActionBlockV1['blockType']): boolean {
  return getAllowedActionsForBlockType(blockType).length > 0;
}

/**
 * Check if a block type is link-out only
 */
export function isLinkOutOnly(blockType: ActionBlockV1['blockType']): boolean {
  return blockType === 'deposit_request' || blockType === 'signature_request';
}

/**
 * Check if a block status is terminal (resolved)
 */
export function isTerminalStatus(status: ActionBlockV1['status']): boolean {
  return status === 'accepted' || status === 'declined' || status === 'expired';
}
