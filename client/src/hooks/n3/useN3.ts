/**
 * N3 Service Run Monitor Hooks
 * PATENT CC-01 INVENTOR GLENN BALLMAN
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface AttentionBundle {
  bundleId: string;
  runId: string;
  runName: string;
  startsAt: string;
  status: 'open' | 'dismissed' | 'actioned';
  reasonCodes: string[];
  summary: string;
  riskDelta: string;
  createdAt: string;
}

export interface N3Segment {
  id: string;
  runId: string;
  segmentKind: string;
  startsAt: string | null;
  endsAt: string | null;
  locationRef: string | null;
  constraints: Record<string, unknown> | null;
}

export interface N3Run {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  portal_id: string | null;
  zone_id: string | null;
  metadata: Record<string, unknown>;
}

export interface N3Zone {
  id: string;
  key: string;
  name: string;
  badge_label_resident: string | null;
  badge_label_contractor: string | null;
  badge_label_visitor: string | null;
  pricing_modifiers: Record<string, unknown> | null;
}

export interface MonitorState {
  id: string;
  runId: string;
  lastCheckedAt: string | null;
  nextCheckAt: string | null;
  lastRiskScore: string | null;
  lastRiskFingerprint: string | null;
  lastBundleId: string | null;
}

export interface ReplanOption {
  id: string;
  bundleId: string;
  rank: number;
  label: string;
  plan: {
    adjustments: Array<{
      segmentId: string;
      field: string;
      oldValue: unknown;
      newValue: unknown;
      reason: string;
    }>;
    summary: string;
  };
  validation: {
    isValid: boolean;
    constraintViolations: string[];
    dependencyViolations: string[];
  };
  estimatedImpact: {
    riskReduction: number;
    timeChange: number;
    costChange: number;
  };
}

export interface ReplanBundle extends AttentionBundle {
  bundle: {
    fingerprint: {
      hash: string;
      timestamp: string;
    };
    findings: Array<{
      signalType: string;
      segmentId: string;
      riskLevel: string;
      riskScore: number;
      isDeterministic: boolean;
      message: string;
    }>;
  };
  options: ReplanOption[];
}

export interface ZonePricingEstimate {
  base_estimate: number;
  zone_modifier_breakdown: Array<{
    type: 'multiplier' | 'flat';
    key: string;
    label: string;
    value: number;
    effect: number;
  }>;
  final_estimate: number;
  notes: string[];
}

export interface MonitorDetail {
  run: N3Run;
  segments: N3Segment[];
  monitorState: MonitorState | null;
  bundles: ReplanBundle[];
  zone_id: string | null;
  zone_name: string | null;
  zone_key: string | null;
  badge_label_resident: string | null;
  badge_label_contractor: string | null;
  badge_label_visitor: string | null;
  pricing_modifiers: Record<string, unknown> | null;
  zone_pricing_estimate: ZonePricingEstimate | null;
}

export interface MonitorStatus {
  isRunning: boolean;
  isEnabled: boolean;
}

export interface N3FilterPortal {
  id: string;
  name: string;
  slug: string | null;
}

export interface N3FilterZone {
  id: string;
  portal_id: string;
  key: string;
  name: string;
  badge_label_resident: string | null;
  badge_label_contractor: string | null;
  badge_label_visitor: string | null;
}

export interface N3FiltersData {
  portals: N3FilterPortal[];
  zones: N3FilterZone[];
}

export interface AttentionBundleWithZone extends AttentionBundle {
  portal_id: string | null;
  zone_id: string | null;
  zone_name: string | null;
  zone_key: string | null;
  badge_label_resident: string | null;
  badge_label_contractor: string | null;
  badge_label_visitor: string | null;
}

export interface N3RunWithZone {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  metadata: Record<string, unknown>;
  portal_id: string | null;
  zone_id: string | null;
  zone_name: string | null;
  zone_key: string | null;
  badge_label_resident: string | null;
  badge_label_contractor: string | null;
  badge_label_visitor: string | null;
}

export interface N3RunsFilters {
  portalId?: string | null;
  zoneId?: string | null;
}

export interface ZoneHeatData {
  zone_id: string | null;
  zone_key: string | null;
  zone_name: string | null;
  badge_label_resident: string | null;
  badge_label_contractor: string | null;
  badge_label_visitor: string | null;
  runs_count: number;
  attention_bundles_count: number;
  last_activity_at: string | null;
}

export interface ZoneHeatResponse {
  zones: ZoneHeatData[];
  rollups: {
    total_runs: number;
    total_attention_bundles: number;
    unzoned_runs: number;
    unzoned_attention_bundles: number;
  };
  window_days: number;
}

export function useN3ZoneHeat(
  tenantId: string | null, 
  portalId?: string | null, 
  windowDays?: number
) {
  return useQuery<ZoneHeatResponse>({
    queryKey: ['/api/n3/zone-heat', tenantId, portalId, windowDays],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (portalId) params.set('portalId', portalId);
      if (windowDays) params.set('windowDays', windowDays.toString());
      const url = `/api/n3/zone-heat${params.toString() ? `?${params}` : ''}`;
      const res = await fetch(url, {
        headers: { 'x-tenant-id': tenantId! },
      });
      if (!res.ok) throw new Error('Failed to fetch zone heat');
      return res.json();
    },
    enabled: !!tenantId,
    staleTime: 60000,
  });
}

export function useN3Filters(tenantId: string | null, portalId?: string | null) {
  return useQuery<N3FiltersData>({
    queryKey: ['/api/n3/filters', tenantId, portalId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (portalId) params.set('portalId', portalId);
      const url = `/api/n3/filters${params.toString() ? `?${params}` : ''}`;
      const res = await fetch(url, {
        headers: { 'x-tenant-id': tenantId! },
      });
      if (!res.ok) throw new Error('Failed to fetch filters');
      return res.json();
    },
    enabled: !!tenantId,
  });
}

export function useN3Runs(tenantId: string | null, filters?: N3RunsFilters) {
  return useQuery<N3RunWithZone[]>({
    queryKey: ['/api/n3/runs', tenantId, filters?.portalId, filters?.zoneId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.portalId) params.set('portalId', filters.portalId);
      if (filters?.zoneId) params.set('zoneId', filters.zoneId);
      const url = `/api/n3/runs${params.toString() ? `?${params}` : ''}`;
      const res = await fetch(url, {
        headers: { 'x-tenant-id': tenantId! },
      });
      if (!res.ok) throw new Error('Failed to fetch runs');
      return res.json();
    },
    enabled: !!tenantId,
  });
}

export function useN3Attention(tenantId: string | null, filters?: N3RunsFilters) {
  return useQuery<{ bundles: AttentionBundleWithZone[] }>({
    queryKey: ['/api/n3/attention', tenantId, filters?.portalId, filters?.zoneId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.portalId) params.set('portalId', filters.portalId);
      if (filters?.zoneId) params.set('zoneId', filters.zoneId);
      const url = `/api/n3/attention${params.toString() ? `?${params}` : ''}`;
      const res = await fetch(url, {
        headers: { 'x-tenant-id': tenantId! },
      });
      if (!res.ok) throw new Error('Failed to fetch attention queue');
      return res.json();
    },
    enabled: !!tenantId,
    refetchInterval: 60000,
  });
}

export function useN3MonitorDetail(runId: string, tenantId: string) {
  return useQuery<MonitorDetail>({
    queryKey: ['/api/n3/runs', runId, 'monitor'],
    queryFn: async () => {
      const res = await fetch(`/api/n3/runs/${runId}/monitor`, {
        headers: { 'x-tenant-id': tenantId },
      });
      if (!res.ok) throw new Error('Failed to fetch monitor detail');
      return res.json();
    },
    enabled: !!runId && !!tenantId,
  });
}

export function useN3DismissBundle(tenantId: string | null) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ bundleId, reason }: { bundleId: string; reason?: string }) => {
      if (!tenantId) throw new Error('Tenant ID is required');
      const res = await fetch(`/api/n3/bundles/${bundleId}/dismiss`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId 
        },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error('Failed to dismiss bundle');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/n3/attention'] });
      queryClient.invalidateQueries({ queryKey: ['/api/n3/runs'] });
    },
  });
}

export function useN3TakeAction(tenantId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      bundleId,
      optionId,
      actionKind,
      notes,
    }: {
      bundleId: string;
      optionId: string;
      actionKind: 'suggest' | 'request' | 'dictate';
      notes?: string;
    }) => {
      const res = await fetch(`/api/n3/bundles/${bundleId}/action`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId 
        },
        body: JSON.stringify({ optionId, actionKind, notes }),
      });
      if (!res.ok) throw new Error('Failed to take action');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/n3/attention'] });
      queryClient.invalidateQueries({ queryKey: ['/api/n3/runs'] });
    },
  });
}

export function useN3TriggerEvaluation(tenantId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ runId }: { runId: string }) => {
      const res = await fetch(`/api/n3/runs/${runId}/evaluate`, {
        method: 'POST',
        headers: { 'x-tenant-id': tenantId },
      });
      if (!res.ok) throw new Error('Failed to trigger evaluation');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/n3/attention'] });
      queryClient.invalidateQueries({ queryKey: ['/api/n3/runs'] });
    },
  });
}

export function useN3Status() {
  return useQuery<MonitorStatus>({
    queryKey: ['/api/n3/status'],
  });
}

export function useN3Zones(portalId: string | null, tenantId: string) {
  return useQuery<{ zones: N3Zone[] }>({
    queryKey: ['/api/n3/zones', portalId],
    queryFn: async () => {
      if (!portalId) return { zones: [] };
      const res = await fetch(`/api/n3/zones?portalId=${portalId}`, {
        headers: { 'x-tenant-id': tenantId },
      });
      if (!res.ok) throw new Error('Failed to fetch zones');
      return res.json();
    },
    enabled: !!portalId && !!tenantId,
  });
}

export function useN3AssignZone(tenantId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ runId, zoneId }: { runId: string; zoneId: string | null }) => {
      const res = await fetch(`/api/n3/runs/${runId}/zone`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId 
        },
        body: JSON.stringify({ zone_id: zoneId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to assign zone');
      }
      return res.json();
    },
    onSuccess: (_, { runId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/n3/runs', runId, 'monitor'] });
    },
  });
}

export interface N3Portal {
  id: string;
  name: string;
  slug: string;
  default_zone_id: string | null;
}

export function useN3Portals(tenantId: string) {
  return useQuery<{ portals: N3Portal[] }>({
    queryKey: ['/api/n3/portals', tenantId],
    queryFn: async () => {
      const res = await fetch('/api/n3/portals', {
        headers: { 'x-tenant-id': tenantId },
      });
      if (!res.ok) throw new Error('Failed to fetch portals');
      return res.json();
    },
    enabled: !!tenantId,
  });
}

export function useN3AssignPortal(tenantId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ runId, portalId }: { runId: string; portalId: string }) => {
      const res = await fetch(`/api/n3/runs/${runId}/portal`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId 
        },
        body: JSON.stringify({ portal_id: portalId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to assign portal');
      }
      return res.json();
    },
    onSuccess: (_, { runId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/n3/runs', runId, 'monitor'] });
      queryClient.invalidateQueries({ queryKey: ['/api/n3/zones'] });
    },
  });
}

// ============ PROMPT 28: Maintenance Request Attachments ============

export interface EligibleMaintenanceRequest {
  id: string;
  request_number: string;
  category: string;
  status: string;
  zone_id: string | null;
  portal_id: string | null;
  coordination_opt_in_set_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface EligibleMaintenanceRequestsResponse {
  ok: boolean;
  run: {
    id: string;
    portal_id: string | null;
    zone_id: string | null;
    status: string;
  };
  items: EligibleMaintenanceRequest[];
  warnings?: string[];
}

export interface AttachedMaintenanceRequest {
  id: string;
  maintenance_request_id: string;
  attached_at: string;
  request_number: string;
  category: string;
  status: string;
  zone_id: string | null;
  coordination_opt_in_set_at: string | null;
}

export interface AttachedMaintenanceRequestsResponse {
  ok: boolean;
  items: AttachedMaintenanceRequest[];
  total_attached: number;
  counts_by_category: Record<string, number>;
  counts_by_status: Record<string, number>;
}

export function useN3EligibleMaintenanceRequests(
  runId: string | undefined,
  tenantId: string,
  params: { category?: string; limit?: number; include_unzoned?: boolean } = {}
) {
  const queryParams = new URLSearchParams();
  if (params.category) queryParams.set('category', params.category);
  if (params.limit) queryParams.set('limit', String(params.limit));
  if (params.include_unzoned) queryParams.set('include_unzoned', 'true');
  
  return useQuery<EligibleMaintenanceRequestsResponse>({
    queryKey: ['/api/n3/runs', runId, 'eligible-maintenance-requests', params],
    queryFn: async () => {
      const url = `/api/n3/runs/${runId}/eligible-maintenance-requests?${queryParams.toString()}`;
      const res = await fetch(url, {
        headers: { 'x-tenant-id': tenantId },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to fetch eligible maintenance requests');
      }
      return res.json();
    },
    enabled: !!runId && !!tenantId,
  });
}

export function useN3AttachedMaintenanceRequests(
  runId: string | undefined,
  tenantId: string
) {
  return useQuery<AttachedMaintenanceRequestsResponse>({
    queryKey: ['/api/n3/runs', runId, 'maintenance-requests'],
    queryFn: async () => {
      const res = await fetch(`/api/n3/runs/${runId}/maintenance-requests`, {
        headers: { 'x-tenant-id': tenantId },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to fetch attached maintenance requests');
      }
      return res.json();
    },
    enabled: !!runId && !!tenantId,
  });
}

export function useN3AttachMaintenanceRequests(tenantId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ runId, maintenanceRequestIds }: { runId: string; maintenanceRequestIds: string[] }) => {
      const res = await fetch(`/api/n3/runs/${runId}/attach-maintenance-requests`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId 
        },
        body: JSON.stringify({ maintenance_request_ids: maintenanceRequestIds }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to attach maintenance requests');
      }
      return res.json();
    },
    onSuccess: (_, { runId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/n3/runs', runId, 'maintenance-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/n3/runs', runId, 'monitor'] });
      queryClient.invalidateQueries({ queryKey: ['/api/n3/runs', runId, 'eligible-maintenance-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/n3/runs', runId, 'readiness-drift'] });
    },
  });
}

export function useN3DetachMaintenanceRequests(tenantId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ runId, maintenanceRequestIds }: { runId: string; maintenanceRequestIds: string[] }) => {
      const res = await fetch(`/api/n3/runs/${runId}/detach-maintenance-requests`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId 
        },
        body: JSON.stringify({ maintenance_request_ids: maintenanceRequestIds }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to detach maintenance requests');
      }
      return res.json();
    },
    onSuccess: (_, { runId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/n3/runs', runId, 'maintenance-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/n3/runs', runId, 'monitor'] });
      queryClient.invalidateQueries({ queryKey: ['/api/n3/runs', runId, 'readiness-drift'] });
    },
  });
}

// ============ READINESS DRIFT (Prompt 29) ============

export interface ReadinessDriftResponse {
  run_id: string;
  status: string;
  evaluated_at: string;
  active_statuses: string[];
  totals: {
    attached: number;
    with_drift: number;
  };
  drift: {
    coordination_opt_out?: { count: number };
    zone_mismatch?: { count: number };
    inactive_status?: { count: number };
    age_exceeded?: { count: number; threshold_days: number };
  };
}

/**
 * Hook to fetch readiness drift for an N3 Service Run.
 * Returns advisory warnings (counts only) when attached maintenance requests
 * have drifted from planning assumptions.
 * 
 * Admin/owner only. Only applies to draft or scheduled runs.
 */
export function useN3ReadinessDrift(runId: string | undefined, tenantId: string, ageDays?: number) {
  return useQuery<ReadinessDriftResponse>({
    queryKey: ['/api/n3/runs', runId, 'readiness-drift', ageDays || 30],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (ageDays) {
        params.set('age_days', String(ageDays));
      }
      const url = `/api/n3/runs/${runId}/readiness-drift${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, {
        headers: { 'x-tenant-id': tenantId },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to fetch readiness drift');
      }
      return res.json();
    },
    enabled: !!runId && !!tenantId,
    staleTime: 60 * 1000, // 1 minute
    refetchOnWindowFocus: false,
  });
}

// ============ READINESS LOCK / SNAPSHOT (Prompt 30) ============

export interface ReadinessSnapshotPayload {
  run: {
    id: string;
    name: string;
    status: string;
    zone_id: string | null;
    portal_id: string | null;
    starts_at: string | null;
    ends_at: string | null;
  };
  attached_requests: Array<{
    maintenance_request_id: string;
    attached_at: string;
    status_at_lock: string;
    zone_id_at_lock: string | null;
    coordination_opt_in_at_lock: boolean;
    coordination_opt_in_set_at: string | null;
  }>;
  summary: {
    total_attached: number;
    opted_in_count: number;
    opted_out_count: number;
  };
}

export interface ReadinessSnapshot {
  id: string;
  run_id: string;
  locked_at: string;
  locked_by: string;
  note: string | null;
  payload: ReadinessSnapshotPayload;
}

export interface ReadinessLockResponse {
  locked: boolean;
  snapshot: ReadinessSnapshot | null;
}

/**
 * Hook to fetch readiness lock/snapshot for an N3 Service Run.
 * Returns locked status and snapshot payload if locked.
 * Admin/owner only.
 */
export function useN3ReadinessSnapshot(runId: string | undefined, tenantId: string) {
  return useQuery<ReadinessLockResponse>({
    queryKey: ['/api/n3/runs', runId, 'readiness-lock'],
    queryFn: async () => {
      const res = await fetch(`/api/n3/runs/${runId}/readiness-lock`, {
        headers: { 'x-tenant-id': tenantId },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to fetch readiness lock');
      }
      return res.json();
    },
    enabled: !!runId && !!tenantId,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to lock a run's readiness state by creating a snapshot.
 * Admin/owner only. Only draft or scheduled runs can be locked.
 */
export function useLockN3Readiness(runId: string, tenantId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (note?: string) => {
      const res = await fetch(`/api/n3/runs/${runId}/readiness-lock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify({ note }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to lock readiness');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/n3/runs', runId, 'readiness-lock'] });
    },
  });
}

/**
 * Hook to unlock a run by deleting the readiness snapshot.
 * Admin/owner only.
 */
export function useUnlockN3Readiness(runId: string, tenantId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/n3/runs/${runId}/readiness-unlock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to unlock readiness');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/n3/runs', runId, 'readiness-lock'] });
    },
  });
}

// ============ EXECUTION ELIGIBILITY (Prompt 31) ============

export interface ExecutionEligibilityResponse {
  run_id: string;
  evaluated_at: string;
  snapshot: {
    locked_at: string;
    locked_by: string;
  };
  eligibility: {
    overall: 'unchanged' | 'improved' | 'degraded';
  };
  deltas: {
    attachments?: {
      attached_count_delta: number;
      category_deltas?: Record<string, number>;
    };
    coordination?: {
      coord_ready_count_delta: number;
      opt_in_ratio_delta: number;
    };
    readiness_drift?: {
      coordination_opt_out?: number;
      zone_mismatch?: number;
      inactive_status?: number;
      age_exceeded?: number;
    };
    zone_pricing?: {
      final_estimate_delta?: number;
    };
  };
}

/**
 * Hook to fetch execution eligibility comparison (snapshot vs live).
 * Returns advisory deltas only (no PII, no IDs).
 * Admin/owner only. Requires active snapshot.
 * 
 * Cache key includes snapshotLockedAt to force re-eval when relocked.
 */
export function useN3ExecutionEligibility(
  runId: string | undefined, 
  tenantId: string,
  snapshotLockedAt?: string | null
) {
  return useQuery<ExecutionEligibilityResponse>({
    queryKey: ['/api/n3/runs', runId, 'execution-eligibility', snapshotLockedAt],
    queryFn: async () => {
      const res = await fetch(`/api/n3/runs/${runId}/execution-eligibility`, {
        headers: { 'x-tenant-id': tenantId },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to fetch execution eligibility');
      }
      return res.json();
    },
    enabled: !!runId && !!tenantId && !!snapshotLockedAt,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: false,
  });
}

// ============ EXECUTION HANDOFF (Prompt 32) ============

export interface ExecutionHandoffPayload {
  run: {
    id: string;
    status: string;
    portal_id: string | null;
    zone_id: string | null;
    starts_at: string | null;
    ends_at: string | null;
  };
  readiness_snapshot: {
    locked_at: string;
    locked_by: string;
    summary: {
      total_attached: number;
      opted_in_count: number;
      opted_out_count: number;
    };
  };
  execution_eligibility: {
    evaluated_at: string;
    overall: 'unchanged' | 'improved' | 'degraded';
    deltas: Record<string, any>;
  };
  captured_at: string;
}

export interface ExecutionHandoffResponse {
  id: string;
  run_id: string;
  created_at: string;
  created_by: string;
  note: string | null;
  payload: ExecutionHandoffPayload;
}

/**
 * Hook to fetch the execution handoff for a run.
 * Returns 404 if none exists.
 * Admin/owner only.
 */
export function useN3ExecutionHandoff(runId: string | undefined, tenantId: string) {
  return useQuery<ExecutionHandoffResponse>({
    queryKey: ['/api/n3/runs', runId, 'execution-handoff'],
    queryFn: async () => {
      const res = await fetch(`/api/n3/runs/${runId}/execution-handoff`, {
        headers: { 'x-tenant-id': tenantId },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to fetch execution handoff');
      }
      return res.json();
    },
    enabled: !!runId && !!tenantId,
    retry: false, // Don't retry 404s
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Hook to create an execution handoff for a run.
 * Requires active readiness snapshot.
 * Admin/owner only.
 */
export function useCreateN3ExecutionHandoff(runId: string, tenantId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (note?: string) => {
      const res = await fetch(`/api/n3/runs/${runId}/execution-handoff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify({ note }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create execution handoff');
      }
      return res.json();
    },
    onSuccess: () => {
      // Invalidate handoff query and related monitor queries
      queryClient.invalidateQueries({ queryKey: ['/api/n3/runs', runId, 'execution-handoff'] });
      queryClient.invalidateQueries({ queryKey: ['/api/n3/runs', runId, 'monitor'] });
      queryClient.invalidateQueries({ queryKey: ['/api/n3/runs', runId] });
    },
  });
}
