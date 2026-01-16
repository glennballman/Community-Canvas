/**
 * useReleaseLegalHold - Release a legal hold
 * POST /api/operator/p2/legal/holds/:holdId/release
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { operatorP2Post, P2ApiError } from '../operatorP2';
import { P2_KEYS } from './keys';

export interface ReleaseLegalHoldInput {
  holdId: string;
  reason?: string;
}

export interface ReleaseLegalHoldResult {
  released: boolean;
}

export function useReleaseLegalHold() {
  const queryClient = useQueryClient();
  
  return useMutation<ReleaseLegalHoldResult, P2ApiError, ReleaseLegalHoldInput>({
    mutationFn: async ({ holdId, reason }) => {
      return operatorP2Post<ReleaseLegalHoldResult>(`/legal/holds/${holdId}/release`, { reason });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: P2_KEYS.legalHold(variables.holdId) });
      queryClient.invalidateQueries({ queryKey: P2_KEYS.legalHolds() });
    },
  });
}
