/**
 * Hook: Revoke a scope grant
 * POST /api/operator/p2/emergency/runs/:runId/revoke-scope
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { operatorP2Post } from '../operatorP2';
import { operatorKeys } from './keys';

interface RevokeEmergencyScopeParams {
  runId: string;
  grant_id: string;
  reason?: string;
}

interface RevokeEmergencyScopeResult {
  revoked: boolean;
}

export function useRevokeEmergencyScope() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ runId, ...body }: RevokeEmergencyScopeParams) => {
      const result = await operatorP2Post<RevokeEmergencyScopeResult>(
        `/emergency/runs/${runId}/revoke-scope`,
        body
      );
      return result;
    },
    onSuccess: (_, { runId }) => {
      queryClient.invalidateQueries({ queryKey: operatorKeys.emergencyRun(runId) });
    },
  });
}
