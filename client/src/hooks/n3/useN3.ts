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
  metadata: Record<string, unknown>;
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

export interface MonitorDetail {
  run: N3Run;
  segments: N3Segment[];
  monitorState: MonitorState | null;
  bundles: ReplanBundle[];
}

export interface MonitorStatus {
  isRunning: boolean;
  isEnabled: boolean;
}

export function useN3Attention(tenantId: string) {
  return useQuery<{ bundles: AttentionBundle[] }>({
    queryKey: ['/api/n3/attention', tenantId],
    queryFn: async () => {
      const res = await fetch('/api/n3/attention', {
        headers: { 'x-tenant-id': tenantId },
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

export function useN3DismissBundle(tenantId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ bundleId, reason }: { bundleId: string; reason?: string }) => {
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
