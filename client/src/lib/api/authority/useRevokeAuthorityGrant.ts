/**
 * useRevokeAuthorityGrant - Revoke a grant and all its tokens
 * POST /api/authority/grants/:id/revoke
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authorityGrantKeys } from './useGetAuthorityGrant';

export interface RevokeGrantInput {
  grantId: string;
  reason: string;
}

export interface RevokeGrantResult {
  success: boolean;
}

async function revokeAuthorityGrant(input: RevokeGrantInput): Promise<RevokeGrantResult> {
  const response = await fetch(`/api/authority/grants/${input.grantId}/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ reason: input.reason }),
  });
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Grant not found');
    }
    if (response.status === 401) {
      throw new Error('Unauthorized - please log in');
    }
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to revoke grant');
  }
  
  return response.json();
}

export function useRevokeAuthorityGrant() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: revokeAuthorityGrant,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: authorityGrantKeys.detail(variables.grantId) });
      queryClient.invalidateQueries({ queryKey: authorityGrantKeys.all });
    },
  });
}
