/**
 * useCreateLegalHold - Create a new legal hold
 * POST /api/operator/p2/legal/holds
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { operatorP2Post, P2ApiError } from '../operatorP2';
import { P2_KEYS } from './keys';

export interface CreateLegalHoldInput {
  hold_type?: 'class_action' | 'insurance' | 'dispute' | 'regulatory' | 'litigation' | 'other';
  title?: string;
  reason?: string;
  circleId?: string;
  portalId?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateLegalHoldResult {
  holdId: string;
}

export function useCreateLegalHold() {
  const queryClient = useQueryClient();
  
  return useMutation<CreateLegalHoldResult, P2ApiError, CreateLegalHoldInput>({
    mutationFn: async (input) => {
      return operatorP2Post<CreateLegalHoldResult>('/legal/holds', input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: P2_KEYS.legalHolds() });
    },
  });
}
