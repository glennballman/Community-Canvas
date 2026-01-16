/**
 * Hook: Create a defense pack from an emergency run
 * POST /api/operator/p2/emergency/runs/:id/defense-pack
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { operatorP2Post } from '../operatorP2';
import { operatorKeys } from './keys';

interface CreateDefensePackParams {
  runId: string;
  pack_type?: string;
  notes?: string;
}

interface CreateDefensePackResult {
  packId: string;
}

export function useCreateDefensePack() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ runId, ...body }: CreateDefensePackParams) => {
      const result = await operatorP2Post<CreateDefensePackResult>(
        `/emergency/runs/${runId}/defense-pack`,
        body
      );
      return result;
    },
    onSuccess: (_, { runId }) => {
      queryClient.invalidateQueries({ queryKey: operatorKeys.emergencyRun(runId) });
      queryClient.invalidateQueries({ queryKey: operatorKeys.audit() });
    },
  });
}
