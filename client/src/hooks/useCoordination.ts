/**
 * Coordination Signal Hooks
 * 
 * Pre-incentive coordination signals for Work Requests.
 * Shows counts of similar work in the same zone (advisory only).
 */

import { useQuery } from '@tanstack/react-query';

export interface SimilarityKey {
  subsystem_id?: string | null;
  work_area_id?: string | null;
  category?: string | null;
}

export interface CoordinationTotals {
  similar_active_count: number;
  similar_new_count: number;
  unzoned_similar_count?: number;
}

export interface WorkRequestCoordinationData {
  ok: boolean;
  window_days: number;
  portal_id: string | null;
  zone_id: string | null;
  similarity_key: SimilarityKey;
  totals: CoordinationTotals;
  message?: string;
}

export interface CoordinationBucket {
  label: string;
  key: SimilarityKey;
  active_count: number;
  new_count: number;
}

export interface ZoneCoordinationRollupData {
  ok: boolean;
  window_days: number;
  portal_id: string;
  zone_id: string | null;
  buckets: CoordinationBucket[];
}

/**
 * Hook for fetching coordination signals for a single work request.
 * Returns counts of similar active work requests in the same zone.
 */
export function useWorkRequestCoordination(
  workRequestId: string | null | undefined,
  windowDays: number = 14,
  tenantId: string | null | undefined
) {
  return useQuery<WorkRequestCoordinationData>({
    queryKey: ['/api/work-requests', workRequestId, 'coordination', { windowDays }],
    queryFn: async () => {
      const res = await fetch(
        `/api/work-requests/${workRequestId}/coordination?windowDays=${windowDays}`,
        { credentials: 'include' }
      );
      if (!res.ok) {
        throw new Error('Failed to fetch coordination data');
      }
      return res.json();
    },
    enabled: !!workRequestId && !!tenantId,
    staleTime: 60 * 1000,
  });
}

/**
 * Hook for fetching zone coordination rollups.
 * Returns buckets of similar work grouped by category/subsystem.
 */
export function useZoneCoordinationRollup(
  portalId: string | null | undefined,
  zoneId: string | null | undefined,
  windowDays: number = 14,
  tenantId: string | null | undefined
) {
  return useQuery<ZoneCoordinationRollupData>({
    queryKey: ['/api/work-requests/coordination/zone-rollup', { portalId, zoneId, windowDays }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (portalId) params.set('portalId', portalId);
      if (zoneId) params.set('zoneId', zoneId);
      params.set('windowDays', windowDays.toString());
      
      const res = await fetch(
        `/api/work-requests/coordination/zone-rollup?${params.toString()}`,
        { credentials: 'include' }
      );
      if (!res.ok) {
        throw new Error('Failed to fetch zone coordination rollup');
      }
      return res.json();
    },
    enabled: !!portalId && !!tenantId,
    staleTime: 60 * 1000,
  });
}
