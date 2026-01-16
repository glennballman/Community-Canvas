/**
 * Hook: End/resolve an emergency run
 * POST /api/operator/p2/emergency/runs/:id/resolve
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { operatorP2Post } from '../operatorP2';
import { operatorKeys } from './keys';

interface EndEmergencyRunParams {
  runId: string;
  resolution_notes?: string;
}

export function useEndEmergencyRun() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ runId, resolution_notes }: EndEmergencyRunParams) => {
      const result = await operatorP2Post<{ resolved: boolean }>(
        `/emergency/runs/${runId}/resolve`,
        { resolution_notes }
      );
      return result;
    },
    onSuccess: (_, { runId }) => {
      queryClient.invalidateQueries({ queryKey: operatorKeys.emergencyActiveRuns() });
      queryClient.invalidateQueries({ queryKey: operatorKeys.emergencyRun(runId) });
    },
  });
}
