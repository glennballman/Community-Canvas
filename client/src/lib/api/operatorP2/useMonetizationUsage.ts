/**
 * useMonetizationUsage - Fetch usage counts for a period
 * 
 * GET /api/operator/p2/monetization/usage?period=YYYY-MM&includeDrills=0|1
 */

import { useQuery } from '@tanstack/react-query';
import { operatorP2Get, P2Ok } from '../operatorP2';
import { operatorKeys } from './keys';

export interface UsageCount {
  eventType: string;
  count: number;
}

export interface MonetizationUsageResponse {
  period: string;
  counts: UsageCount[];
}

export function useMonetizationUsage(period: string, includeDrills: boolean = false) {
  return useQuery({
    queryKey: operatorKeys.usage(period, includeDrills),
    queryFn: async () => {
      const response = await operatorP2Get<MonetizationUsageResponse>(
        `/monetization/usage`,
        { period, includeDrills: includeDrills ? 1 : 0 }
      );
      return response;
    },
    staleTime: 60_000, // 1 minute
  });
}
