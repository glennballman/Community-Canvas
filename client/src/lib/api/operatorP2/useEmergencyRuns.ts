/**
 * Hook: List emergency runs for tenant
 * GET /api/operator/p2/emergency/runs
 */

import { useQuery } from '@tanstack/react-query';
import { operatorP2Get } from '../operatorP2';
import { operatorKeys } from './keys';

export interface EmergencyRun {
  id: string;
  scenario_type: string;
  title: string | null;
  notes: string | null;
  status: 'active' | 'resolved' | 'cancelled';
  created_at: string;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_by_user_id: string;
  tenant_id: string;
}

interface EmergencyRunsResponse {
  runs: EmergencyRun[];
}

export function useEmergencyRuns() {
  return useQuery({
    queryKey: operatorKeys.emergencyActiveRuns(),
    queryFn: async () => {
      const result = await operatorP2Get<EmergencyRunsResponse>('/emergency/runs');
      return result.runs;
    },
    staleTime: 30 * 1000,
  });
}

export function useEmergencyRunById(runId: string | undefined) {
  return useQuery({
    queryKey: operatorKeys.emergencyRun(runId || ''),
    queryFn: async () => {
      if (!runId) throw new Error('Run ID required');
      const result = await operatorP2Get<{ run: EmergencyRun }>(`/emergency/runs/${runId}`);
      return result.run;
    },
    enabled: !!runId,
    staleTime: 30 * 1000,
  });
}
