/**
 * Query key builders for P2 operator endpoints
 */

export const operatorKeys = {
  all: ['operator-p2'] as const,
  
  audit: (limit: number = 50) => [...operatorKeys.all, 'audit', { limit }] as const,
  
  emergencyRun: (runId: string) => [...operatorKeys.all, 'emergency-run', runId] as const,
  
  emergencyActiveRuns: () => [...operatorKeys.all, 'emergency-runs', 'active'] as const,
  
  roles: () => [...operatorKeys.all, 'roles'] as const,
};
