/**
 * Query key builders for P2 operator endpoints
 */

export const operatorKeys = {
  all: ['operator-p2'] as const,
  
  audit: (limit: number = 50) => [...operatorKeys.all, 'audit', { limit }] as const,
  
  emergencyRun: (runId: string) => [...operatorKeys.all, 'emergency-run', runId] as const,
  
  emergencyActiveRuns: () => [...operatorKeys.all, 'emergency-runs', 'active'] as const,
  
  roles: () => [...operatorKeys.all, 'roles'] as const,
  
  legalHolds: () => [...operatorKeys.all, 'legal-holds'] as const,
  legalHold: (holdId: string) => [...operatorKeys.all, 'legal-hold', holdId] as const,
  
  insuranceClaim: (claimId: string) => [...operatorKeys.all, 'insurance-claim', claimId] as const,
  insuranceDossier: (dossierId: string) => [...operatorKeys.all, 'insurance-dossier', dossierId] as const,
  
  dispute: (disputeId: string) => [...operatorKeys.all, 'dispute', disputeId] as const,
  defensePack: (defensePackId: string) => [...operatorKeys.all, 'defense-pack', defensePackId] as const,
};

export const P2_KEYS = operatorKeys;
