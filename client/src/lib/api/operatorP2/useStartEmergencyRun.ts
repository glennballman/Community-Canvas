/**
 * Hook: Start a new emergency run
 * POST /api/operator/p2/emergency/runs/start
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { operatorP2Post } from '../operatorP2';
import { operatorKeys } from './keys';

interface StartEmergencyRunParams {
  scenario_type: string;
  title?: string;
  notes?: string;
  templateId?: string;
  propertyProfileId?: string;
  circleId?: string;
  portalId?: string;
}

interface StartEmergencyRunResult {
  runId: string;
}

export function useStartEmergencyRun() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: StartEmergencyRunParams) => {
      const result = await operatorP2Post<StartEmergencyRunResult>(
        '/emergency/runs/start',
        params
      );
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: operatorKeys.emergencyActiveRuns() });
    },
  });
}
