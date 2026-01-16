/**
 * Hook: Get operator roles for tenant
 * GET /api/operator/p2/roles
 * 
 * Note: This returns the roles list for the tenant.
 * Use this to check if the current user has operator access.
 */

import { useQuery } from '@tanstack/react-query';
import { operatorP2Get } from '../operatorP2';
import { operatorKeys } from './keys';

export interface OperatorRoleEntry {
  user_id: string;
  role: 'owner' | 'admin' | 'operator' | 'responder';
  assigned_at: string;
  assigned_by: string | null;
}

interface OperatorRolesResponse {
  roles: OperatorRoleEntry[];
}

export function useOperatorRoles() {
  return useQuery({
    queryKey: operatorKeys.roles(),
    queryFn: async () => {
      const result = await operatorP2Get<OperatorRolesResponse>('/roles');
      return result.roles;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
