/**
 * Hook: Resolve an emergency run
 * POST /api/operator/p2/emergency/runs/:runId/resolve
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { operatorP2Post } from '../operatorP2';
import { operatorKeys } from './keys';

interface ResolveEmergencyRunParams {
  runId: string;
  resolution_notes?: string;
}

interface ResolveEmergencyRunResult {
  resolved: boolean;
}

export function useResolveEmergencyRun() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ runId, resolution_notes }: ResolveEmergencyRunParams) => {
      const result = await operatorP2Post<ResolveEmergencyRunResult>(
        `/emergency/runs/${runId}/resolve`,
        { resolution_notes }
      );
      return result;
    },
    onSuccess: (_, { runId }) => {
      queryClient.invalidateQueries({ queryKey: operatorKeys.emergencyRun(runId) });
      queryClient.invalidateQueries({ queryKey: operatorKeys.emergencyActiveRuns() });
    },
  });
}
