/**
 * useShareInsuranceDossierAuthority - Share dossier with external authority
 * POST /api/operator/p2/insurance/dossiers/:dossierId/share-authority
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { operatorP2Post, P2ApiError } from '../operatorP2';
import { P2_KEYS } from './keys';

export interface ShareInsuranceDossierAuthorityInput {
  dossierId: string;
  expiresAt?: string;
  scope?: string;
}

export interface ShareInsuranceDossierAuthorityResult {
  grantId?: string;
  accessUrl?: string;
}

export function useShareInsuranceDossierAuthority() {
  const queryClient = useQueryClient();
  
  return useMutation<ShareInsuranceDossierAuthorityResult, P2ApiError, ShareInsuranceDossierAuthorityInput>({
    mutationFn: async ({ dossierId, expiresAt, scope }) => {
      return operatorP2Post<ShareInsuranceDossierAuthorityResult>(
        `/insurance/dossiers/${dossierId}/share-authority`,
        { expiresAt, scope }
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: P2_KEYS.insuranceDossier(variables.dossierId) });
    },
  });
}
