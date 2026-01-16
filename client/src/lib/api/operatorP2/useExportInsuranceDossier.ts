/**
 * useExportInsuranceDossier - Export a dossier as zip_json
 * POST /api/operator/p2/insurance/dossiers/:dossierId/export
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { operatorP2Post, P2ApiError } from '../operatorP2';
import { P2_KEYS } from './keys';

export interface ExportInsuranceDossierInput {
  dossierId: string;
  format?: 'zip_json';
}

export interface ExportInsuranceDossierResult {
  exported: boolean;
  dossier?: Record<string, unknown>;
  exportId?: string;
  r2Key?: string;
  url?: string;
}

export function useExportInsuranceDossier() {
  const queryClient = useQueryClient();
  
  return useMutation<ExportInsuranceDossierResult, P2ApiError, ExportInsuranceDossierInput>({
    mutationFn: async ({ dossierId, format = 'zip_json' }) => {
      return operatorP2Post<ExportInsuranceDossierResult>(
        `/insurance/dossiers/${dossierId}/export`,
        { format }
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: P2_KEYS.insuranceDossier(variables.dossierId) });
    },
  });
}
