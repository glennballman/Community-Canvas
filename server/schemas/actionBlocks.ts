/**
 * V3.5 Message Action Blocks - Zod Schemas
 * 
 * Defines validation schemas for action blocks stored on cc_messages
 * and action request payloads.
 */

import { z } from 'zod';

export const ActionBlockDomainEnum = z.enum([
  'job',
  'reservation', 
  'service_run',
  'incident'
]);

export const ActionBlockTypeEnum = z.enum([
  'accept',
  'propose', 
  'decline',
  'ack',
  'confirm'
]);

export const ActionBlockStateEnum = z.enum([
  'pending',
  'accepted',
  'declined',
  'expired'
]);

export const ActionBlockV1Schema = z.object({
  version: z.literal(1),
  domain: ActionBlockDomainEnum,
  type: ActionBlockTypeEnum,
  target_id: z.string().uuid(),
  attestable: z.literal(true),
  state: ActionBlockStateEnum,
  created_at: z.string().datetime(),
  expires_at: z.string().datetime().optional(),
  meta: z.record(z.unknown()).optional(),
});

export type ActionBlockV1 = z.infer<typeof ActionBlockV1Schema>;
export type ActionBlockDomain = z.infer<typeof ActionBlockDomainEnum>;
export type ActionBlockType = z.infer<typeof ActionBlockTypeEnum>;
export type ActionBlockState = z.infer<typeof ActionBlockStateEnum>;

export const ActionRequestSchema = z.object({
  action: ActionBlockTypeEnum,
  payload: z.record(z.unknown()).optional(),
  idempotencyKey: z.string().max(128).optional(),
});

export type ActionRequest = z.infer<typeof ActionRequestSchema>;

export const ACTION_STATE_TRANSITIONS: Record<ActionBlockState, ActionBlockState[]> = {
  pending: ['accepted', 'declined', 'expired'],
  accepted: [],
  declined: [],
  expired: [],
};

export function isValidStateTransition(
  from: ActionBlockState,
  to: ActionBlockState
): boolean {
  const allowedTransitions = ACTION_STATE_TRANSITIONS[from];
  return allowedTransitions.includes(to);
}

export function mapActionToState(action: ActionBlockType): ActionBlockState {
  switch (action) {
    case 'accept':
    case 'ack':
    case 'confirm':
      return 'accepted';
    case 'decline':
      return 'declined';
    case 'propose':
      return 'pending';
    default:
      return 'pending';
  }
}

export function isActionBlockExpired(block: ActionBlockV1): boolean {
  if (!block.expires_at) return false;
  return new Date(block.expires_at) < new Date();
}
