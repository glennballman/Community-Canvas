/**
 * useAddLegalHoldTarget - Add a target to a legal hold
 * POST /api/operator/p2/legal/holds/:holdId/targets
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { operatorP2Post, P2ApiError } from '../operatorP2';
import { P2_KEYS } from './keys';

export type LegalHoldTargetType = 
  | 'evidence_object' 
  | 'evidence_bundle' 
  | 'emergency_run' 
  | 'claim' 
  | 'dossier' 
  | 'defense_pack';

export interface AddLegalHoldTargetInput {
  holdId: string;
  targetType: LegalHoldTargetType;
  targetId: string;
  note?: string;
}

export interface AddLegalHoldTargetResult {
  targetId: string;
}

export function useAddLegalHoldTarget() {
  const queryClient = useQueryClient();
  
  return useMutation<AddLegalHoldTargetResult, P2ApiError, AddLegalHoldTargetInput>({
    mutationFn: async ({ holdId, ...body }) => {
      return operatorP2Post<AddLegalHoldTargetResult>(`/legal/holds/${holdId}/targets`, body);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: P2_KEYS.legalHold(variables.holdId) });
    },
  });
}
