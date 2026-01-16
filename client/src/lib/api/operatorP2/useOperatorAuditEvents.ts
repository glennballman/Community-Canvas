/**
 * Hook: Fetch operator audit events
 * GET /api/operator/p2/events
 */

import { useQuery } from '@tanstack/react-query';
import { operatorP2Get } from '../operatorP2';
import { operatorKeys } from './keys';

interface AuditEvent {
  id: string;
  tenant_id: string;
  circle_id?: string;
  operator_individual_id: string;
  action_key: string;
  subject_type: string;
  subject_id: string;
  payload?: Record<string, unknown>;
  occurred_at: string;
}

interface AuditEventsResult {
  events: AuditEvent[];
}

export function useOperatorAuditEvents(limit: number = 50) {
  return useQuery({
    queryKey: operatorKeys.audit(limit),
    queryFn: async () => {
      const result = await operatorP2Get<AuditEventsResult>('/events', { limit });
      return result.events;
    },
  });
}
