/**
 * Hook: Share emergency run with authority
 * POST /api/operator/p2/emergency/runs/:runId/share-authority
 */

import { useMutation } from '@tanstack/react-query';
import { operatorP2Post } from '../operatorP2';

interface ShareEmergencyAuthorityParams {
  runId: string;
  scope?: 'run' | 'record_pack' | 'all';
  authority_email?: string;
  expires_at?: string;
}

interface ShareEmergencyAuthorityResult {
  grantId: string;
  token: string;
}

export function useShareEmergencyAuthority() {
  return useMutation({
    mutationFn: async ({ runId, ...body }: ShareEmergencyAuthorityParams) => {
      const result = await operatorP2Post<ShareEmergencyAuthorityResult>(
        `/emergency/runs/${runId}/share-authority`,
        body
      );
      return result;
    },
  });
}
