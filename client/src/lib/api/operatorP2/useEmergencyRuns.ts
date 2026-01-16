/**
 * Hook: Get emergency run dashboard
 * GET /api/operator/p2/emergency/runs/:id/dashboard
 * 
 * Note: The backend implements per-run dashboard, not a list endpoint.
 * Use useEmergencyRunDashboard to get run details.
 * For listing runs, query cc_drill_sessions directly via a tenant endpoint.
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

export interface EmergencyRunDashboard {
  run: EmergencyRun;
  evidence_count: number;
  scope_grants: Array<{
    id: string;
    scope_key: string;
    granted_at: string;
  }>;
}

export function useEmergencyRunDashboard(runId: string | undefined) {
  return useQuery({
    queryKey: operatorKeys.emergencyRun(runId || ''),
    queryFn: async () => {
      if (!runId) throw new Error('Run ID required');
      const result = await operatorP2Get<EmergencyRunDashboard>(`/emergency/runs/${runId}/dashboard`);
      return result;
    },
    enabled: !!runId,
    staleTime: 30 * 1000,
  });
}
