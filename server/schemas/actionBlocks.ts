/**
 * V3.5 Message Action Blocks - Zod Schemas
 * 
 * Defines validation schemas for action blocks stored on cc_messages.action_block
 * Follows MESSAGE_ACTION_BLOCKS_SPEC v2.
 */

import { z } from 'zod';

export const BlockTypeEnum = z.enum([
  'summary',
  'question',
  'multi_question',
  'availability',
  'capacity',
  'offer',
  'deposit_request',
  'change_request',
  'signature_request',
  'cancellation'
]);

export const ActionBlockDomainEnum = z.enum([
  'job',
  'reservation', 
  'service_run',
  'incident'
]);

export const ActionBlockStatusEnum = z.enum([
  'pending',
  'accepted',
  'declined',
  'expired',
  'informational'
]);

export const ActionTypeEnum = z.enum([
  'accept',
  'decline',
  'answer',
  'acknowledge',
  'counter'
]);

export const ActionBlockV1Schema = z.object({
  version: z.literal(1),
  blockType: BlockTypeEnum,
  domain: ActionBlockDomainEnum,
  target_id: z.string().uuid(),
  status: ActionBlockStatusEnum,
  payload: z.record(z.unknown()),
  ctaUrl: z.string().url().optional(),
  linkedEntityType: z.string().optional(),
  linkedEntityId: z.string().uuid().optional(),
  created_at: z.string().datetime(),
  resolved_at: z.string().datetime().optional(),
  resolved_by: z.string().uuid().optional(),
  expires_at: z.string().datetime().optional(),
});

export type ActionBlockV1 = z.infer<typeof ActionBlockV1Schema>;
export type BlockType = z.infer<typeof BlockTypeEnum>;
export type ActionBlockDomain = z.infer<typeof ActionBlockDomainEnum>;
export type ActionBlockStatus = z.infer<typeof ActionBlockStatusEnum>;
export type ActionType = z.infer<typeof ActionTypeEnum>;

export const ActionRequestSchema = z.object({
  action: ActionTypeEnum,
  response: z.unknown().optional(),
  idempotencyKey: z.string().max(128).optional(),
});

export type ActionRequest = z.infer<typeof ActionRequestSchema>;

const BLOCK_TYPE_ALLOWED_ACTIONS: Record<BlockType, ActionType[]> = {
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

export function validateActionForBlockType(blockType: BlockType, action: ActionType): boolean {
  const allowed = BLOCK_TYPE_ALLOWED_ACTIONS[blockType];
  return allowed.includes(action);
}

export function getAllowedActionsForBlockType(blockType: BlockType): ActionType[] {
  return BLOCK_TYPE_ALLOWED_ACTIONS[blockType];
}

export function isBlockTypeActionable(blockType: BlockType): boolean {
  return BLOCK_TYPE_ALLOWED_ACTIONS[blockType].length > 0;
}

export function requiresResponse(action: ActionType): boolean {
  return action === 'answer';
}

export function isTerminalStatus(status: ActionBlockStatus): boolean {
  return status === 'accepted' || status === 'declined' || status === 'expired';
}

export function mapActionToStatus(action: ActionType): ActionBlockStatus {
  switch (action) {
    case 'accept':
      return 'accepted';
    case 'decline':
      return 'declined';
    case 'acknowledge':
      return 'informational';
    case 'answer':
      return 'informational';
    case 'counter':
      return 'pending';
    default:
      return 'pending';
  }
}

export function isActionBlockExpired(block: ActionBlockV1): boolean {
  if (!block.expires_at) return false;
  return new Date(block.expires_at) < new Date();
}
