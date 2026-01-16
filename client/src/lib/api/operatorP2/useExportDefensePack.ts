/**
 * useExportDefensePack - Export a defense pack as zip_json
 * POST /api/operator/p2/defense-packs/:defensePackId/export
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { operatorP2Post, P2ApiError } from '../operatorP2';
import { P2_KEYS } from './keys';

export interface ExportDefensePackInput {
  defensePackId: string;
  format?: 'zip_json';
}

export interface ExportDefensePackResult {
  exported: boolean;
  defensePack?: Record<string, unknown>;
  exportId?: string;
  r2Key?: string;
  url?: string;
}

export function useExportDefensePack() {
  const queryClient = useQueryClient();
  
  return useMutation<ExportDefensePackResult, P2ApiError, ExportDefensePackInput>({
    mutationFn: async ({ defensePackId, format = 'zip_json' }) => {
      return operatorP2Post<ExportDefensePackResult>(
        `/defense-packs/${defensePackId}/export`,
        { format }
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: P2_KEYS.defensePack(variables.defensePackId) });
    },
  });
}
