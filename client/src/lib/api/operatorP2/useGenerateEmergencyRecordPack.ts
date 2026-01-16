/**
 * Hook: Generate record pack from emergency run
 * POST /api/operator/p2/emergency/runs/:runId/generate-record-pack
 */

import { useMutation } from '@tanstack/react-query';
import { operatorP2Post } from '../operatorP2';

interface GenerateEmergencyRecordPackParams {
  runId: string;
  title?: string;
  includeTypes?: string[];
  sealBundle?: boolean;
}

interface GenerateEmergencyRecordPackResult {
  packId: string;
}

export function useGenerateEmergencyRecordPack() {
  return useMutation({
    mutationFn: async ({ runId, ...body }: GenerateEmergencyRecordPackParams) => {
      const result = await operatorP2Post<GenerateEmergencyRecordPackResult>(
        `/emergency/runs/${runId}/generate-record-pack`,
        body
      );
      return result;
    },
  });
}
