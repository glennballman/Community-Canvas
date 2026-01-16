/**
 * useAssembleDefensePack - Assemble a defense pack for a dispute
 * POST /api/operator/p2/disputes/:disputeId/assemble-defense-pack
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { operatorP2Post, P2ApiError } from '../operatorP2';
import { P2_KEYS } from './keys';

export interface AssembleDefensePackInput {
  disputeId: string;
  versionLabel?: string;
}

export interface AssembleDefensePackResult {
  defensePackId: string;
}

export function useAssembleDefensePack() {
  const queryClient = useQueryClient();
  
  return useMutation<AssembleDefensePackResult, P2ApiError, AssembleDefensePackInput>({
    mutationFn: async ({ disputeId, versionLabel }) => {
      return operatorP2Post<AssembleDefensePackResult>(
        `/disputes/${disputeId}/assemble-defense-pack`,
        { versionLabel }
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: P2_KEYS.dispute(variables.disputeId) });
    },
  });
}
