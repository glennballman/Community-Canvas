/**
 * useGetAuthorityGrant - Fetch grant details including scopes and tokens
 * GET /api/authority/grants/:id
 */

import { useQuery } from '@tanstack/react-query';

export interface AuthorityScope {
  id: string;
  tenant_id: string;
  grant_id: string;
  scope_type: 'evidence_bundle' | 'claim' | 'claim_dossier' | 'evidence_object';
  scope_id: string;
  added_at: string;
  added_by_individual_id: string | null;
  label: string | null;
  notes: string | null;
}

export interface AuthorityToken {
  id: string;
  tenant_id: string;
  grant_id: string;
  issued_at: string;
  issued_by_individual_id: string | null;
  last_accessed_at: string | null;
  access_count: number;
  status: 'active' | 'revoked' | 'expired';
  revoked_at: string | null;
  expires_at: string;
}

export interface AuthorityGrant {
  id: string;
  tenant_id: string;
  circle_id: string | null;
  portal_id: string | null;
  grant_type: 'adjuster' | 'insurer' | 'regulator' | 'legal' | 'contractor_third_party' | 'generic';
  title: string;
  description: string | null;
  created_at: string;
  created_by_individual_id: string | null;
  status: 'active' | 'revoked' | 'expired';
  revoked_at: string | null;
  revoke_reason: string | null;
  expires_at: string;
  max_views: number | null;
  require_passcode: boolean;
  metadata: Record<string, unknown>;
  scopes: AuthorityScope[];
  tokens: AuthorityToken[];
}

export const authorityGrantKeys = {
  all: ['authority-grants'] as const,
  detail: (grantId: string) => [...authorityGrantKeys.all, grantId] as const,
};

async function fetchAuthorityGrant(grantId: string): Promise<AuthorityGrant> {
  const response = await fetch(`/api/authority/grants/${grantId}`, {
    credentials: 'include',
  });
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Grant not found');
    }
    if (response.status === 401) {
      throw new Error('Unauthorized - please log in');
    }
    throw new Error('Failed to fetch grant');
  }
  
  return response.json();
}

export function useGetAuthorityGrant(grantId: string | undefined) {
  return useQuery({
    queryKey: authorityGrantKeys.detail(grantId || ''),
    queryFn: () => fetchAuthorityGrant(grantId!),
    enabled: !!grantId,
  });
}
