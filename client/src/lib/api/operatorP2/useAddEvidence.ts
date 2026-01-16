/**
 * Hook: Add evidence to an emergency run
 * POST /api/operator/p2/emergency/runs/:id/evidence
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { operatorP2Post } from '../operatorP2';
import { operatorKeys } from './keys';

interface AddEvidenceParams {
  runId: string;
  evidence_type: string;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

interface AddEvidenceResult {
  evidenceId: string;
}

export function useAddEvidence() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ runId, ...body }: AddEvidenceParams) => {
      const result = await operatorP2Post<AddEvidenceResult>(
        `/emergency/runs/${runId}/evidence`,
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
