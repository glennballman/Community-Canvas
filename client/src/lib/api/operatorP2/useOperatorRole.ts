/**
 * Hook: Get current operator role
 * GET /api/operator/p2/role
 */

import { useQuery } from '@tanstack/react-query';
import { operatorP2Get } from '../operatorP2';
import { operatorKeys } from './keys';

export interface OperatorRole {
  role: 'owner' | 'admin' | 'operator' | 'responder' | null;
  tenantId: string;
  userId: string;
}

export function useOperatorRole() {
  return useQuery({
    queryKey: operatorKeys.roles(),
    queryFn: async () => {
      const result = await operatorP2Get<OperatorRole>('/role');
      return result;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
