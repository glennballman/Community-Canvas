/**
 * useShareDefensePackAuthority - Share defense pack with external authority
 * POST /api/operator/p2/defense-packs/:defensePackId/share-authority
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { operatorP2Post, P2ApiError } from '../operatorP2';
import { P2_KEYS } from './keys';

export interface ShareDefensePackAuthorityInput {
  defensePackId: string;
  expiresAt?: string;
  scope?: string;
}

export interface ShareDefensePackAuthorityResult {
  grantId?: string;
  accessUrl?: string;
}

export function useShareDefensePackAuthority() {
  const queryClient = useQueryClient();
  
  return useMutation<ShareDefensePackAuthorityResult, P2ApiError, ShareDefensePackAuthorityInput>({
    mutationFn: async ({ defensePackId, expiresAt, scope }) => {
      return operatorP2Post<ShareDefensePackAuthorityResult>(
        `/defense-packs/${defensePackId}/share-authority`,
        { expiresAt, scope }
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: P2_KEYS.defensePack(variables.defensePackId) });
    },
  });
}
