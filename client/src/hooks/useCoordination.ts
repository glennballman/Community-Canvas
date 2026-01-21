/**
 * Coordination Signal Hooks
 * 
 * Pre-incentive coordination signals for Work Requests.
 * Shows counts of similar work in the same zone (advisory only).
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';

export interface SimilarityKey {
  subsystem_id?: string | null;
  work_area_id?: string | null;
  category?: string | null;
}

export interface CoordinationTotals {
  similar_active_count: number;
  similar_new_count: number;
  unzoned_similar_count?: number;
  coordination_ready_similar_count?: number;
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

export interface CoordinationIntentPayload {
  coordination_intent: boolean;
  note?: string | null;
}

export interface CoordinationIntentResponse {
  ok: boolean;
  work_request_id: string;
  coordination_intent: boolean;
  coordination_intent_set_at: string | null;
  coordination_intent_note: string | null;
  portal_required_for_matching?: boolean;
}

// =====================================
// Coordination Readiness Dashboard Hooks (Admin/Ops)
// =====================================

export interface CoordinationReadinessRollups {
  total_active: number;
  total_coord_ready: number;
  unzoned_active: number;
  unzoned_coord_ready: number;
}

export interface CoordinationReadinessZone {
  zone_id: string | null;
  zone_key: string | null;
  zone_name: string | null;
  badge_label_resident: string | null;
  badge_label_contractor: string | null;
  badge_label_visitor: string | null;
  active_count: number;
  coord_ready_count: number;
  coord_ready_ratio: number;
  last_activity_at: string | null;
}

export interface CoordinationReadinessData {
  ok: boolean;
  portal_id: string;
  window_days: number;
  rollups: CoordinationReadinessRollups;
  zones: CoordinationReadinessZone[];
}

export interface CoordinationReadinessBucket {
  category: string;
  active_count: number;
  coord_ready_count: number;
  coord_ready_ratio: number;
}

export interface CoordinationReadinessBucketsData {
  ok: boolean;
  portal_id: string;
  zone_id: string | null;
  window_days: number;
  buckets: CoordinationReadinessBucket[];
}

/**
 * Hook for fetching coordination readiness heat map by zone.
 * Admin/owner access only.
 */
export function useCoordinationReadiness(
  portalId: string | null | undefined,
  zoneId: string | null | undefined,
  windowDays: number = 14
) {
  return useQuery<CoordinationReadinessData>({
    queryKey: ['/api/work-requests/coordination/readiness', { portalId, zoneId, windowDays }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (portalId) params.set('portalId', portalId);
      if (zoneId) params.set('zoneId', zoneId);
      params.set('windowDays', windowDays.toString());
      
      const res = await fetch(
        `/api/work-requests/coordination/readiness?${params.toString()}`,
        { credentials: 'include' }
      );
      if (!res.ok) {
        throw new Error('Failed to fetch coordination readiness');
      }
      return res.json();
    },
    enabled: !!portalId,
    staleTime: 60 * 1000,
  });
}

/**
 * Hook for fetching category buckets for coordination drill-down.
 * Admin/owner access only.
 */
export function useCoordinationReadinessBuckets(
  portalId: string | null | undefined,
  zoneId: string | null | undefined,
  windowDays: number = 14,
  limit: number = 10
) {
  return useQuery<CoordinationReadinessBucketsData>({
    queryKey: ['/api/work-requests/coordination/readiness/buckets', { portalId, zoneId, windowDays, limit }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (portalId) params.set('portalId', portalId);
      if (zoneId) params.set('zoneId', zoneId);
      params.set('windowDays', windowDays.toString());
      params.set('limit', limit.toString());
      
      const res = await fetch(
        `/api/work-requests/coordination/readiness/buckets?${params.toString()}`,
        { credentials: 'include' }
      );
      if (!res.ok) {
        throw new Error('Failed to fetch coordination buckets');
      }
      return res.json();
    },
    enabled: !!portalId,
    staleTime: 60 * 1000,
  });
}

/**
 * Hook for setting/clearing coordination intent on a work request.
 * Invalidates both the work request detail and coordination queries.
 */
export function useWorkRequestCoordinationIntent(workRequestId: string) {
  return useMutation<CoordinationIntentResponse, Error, CoordinationIntentPayload>({
    mutationFn: async (payload) => {
      const res = await apiRequest(
        'PUT',
        `/api/work-requests/${workRequestId}/coordination-intent`,
        payload
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/work-requests', workRequestId] 
      });
    },
  });
}

// =====================================
// Suggested Windows (Advisory Only)
// =====================================

export interface SuggestWindowsParams {
  portal_id: string;
  zone_id?: string | null;
  category?: string | null;
  lookahead_days?: number;
  window_size_days?: number;
  desired_windows?: number;
}

export interface SuggestedWindow {
  start_date: string;
  end_date: string;
  coord_ready_count: number;
  active_count: number;
  readiness_ratio: number;
  confidence: number;
  explanation: string;
}

export interface SuggestWindowsResponse {
  ok: boolean;
  portal_id: string;
  zone_id: string | null;
  category: string | null;
  params: {
    lookahead_days: number;
    window_size_days: number;
    desired_windows: number;
  };
  windows: SuggestedWindow[];
  notes: string[];
}

/**
 * Hook for requesting advisory suggested schedule windows.
 * Admin/owner access only. No persistence, no auto-creation.
 */
export function useSuggestCoordinationWindows() {
  return useMutation<SuggestWindowsResponse, Error, SuggestWindowsParams>({
    mutationFn: async (params) => {
      const res = await apiRequest(
        'POST',
        '/api/work-requests/coordination/suggest-windows',
        params
      );
      return res.json();
    },
  });
}
