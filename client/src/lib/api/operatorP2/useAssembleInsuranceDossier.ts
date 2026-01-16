/**
 * useAssembleInsuranceDossier - Assemble a dossier from claim inputs
 * POST /api/operator/p2/insurance/claims/:claimId/assemble
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { operatorP2Post, P2ApiError } from '../operatorP2';
import { P2_KEYS } from './keys';

export interface AssembleInsuranceDossierInput {
  claimId: string;
  versionLabel?: string;
}

export interface AssembleInsuranceDossierResult {
  dossierId: string;
}

export function useAssembleInsuranceDossier() {
  const queryClient = useQueryClient();
  
  return useMutation<AssembleInsuranceDossierResult, P2ApiError, AssembleInsuranceDossierInput>({
    mutationFn: async ({ claimId, versionLabel }) => {
      return operatorP2Post<AssembleInsuranceDossierResult>(
        `/insurance/claims/${claimId}/assemble`,
        { versionLabel }
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: P2_KEYS.insuranceClaim(variables.claimId) });
    },
  });
}
