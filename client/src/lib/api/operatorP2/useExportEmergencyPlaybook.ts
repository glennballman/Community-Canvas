/**
 * Hook: Export emergency playbook
 * POST /api/operator/p2/emergency/runs/:runId/export-playbook
 */

import { useMutation } from '@tanstack/react-query';
import { operatorP2Post } from '../operatorP2';

interface ExportEmergencyPlaybookParams {
  runId: string;
  format?: 'zip_json';
}

interface ExportEmergencyPlaybookResult {
  exported: boolean;
  url?: string;
}

export function useExportEmergencyPlaybook() {
  return useMutation({
    mutationFn: async ({ runId, format = 'zip_json' }: ExportEmergencyPlaybookParams) => {
      const result = await operatorP2Post<ExportEmergencyPlaybookResult>(
        `/emergency/runs/${runId}/export-playbook`,
        { format }
      );
      return result;
    },
  });
}
