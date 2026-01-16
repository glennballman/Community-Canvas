/**
 * Hook: Grant scope during an emergency run
 * POST /api/operator/p2/emergency/runs/:runId/grant-scope
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { operatorP2Post } from '../operatorP2';
import { operatorKeys } from './keys';

interface GrantEmergencyScopeParams {
  runId: string;
  grantee_individual_id: string;
  grant_type: string;
  scope_json?: string;
  expires_at?: string;
}

interface GrantEmergencyScopeResult {
  grantId?: string;
  granted: boolean;
}

export function useGrantEmergencyScope() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ runId, ...body }: GrantEmergencyScopeParams) => {
      const result = await operatorP2Post<GrantEmergencyScopeResult>(
        `/emergency/runs/${runId}/grant-scope`,
        body
      );
      return result;
    },
    onSuccess: (_, { runId }) => {
      queryClient.invalidateQueries({ queryKey: operatorKeys.emergencyRun(runId) });
    },
  });
}
