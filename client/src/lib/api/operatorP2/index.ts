/**
 * P2 Operator API Hooks - Re-exports
 * 
 * All hooks call /api/operator/p2/* endpoints with consistent { ok, ...data } response shape.
 */

export * from './keys';

// Role management (GET /p2/roles)
export * from './useOperatorRole';

// Emergency run lifecycle
export * from './useEmergencyRuns';        // useEmergencyRunDashboard (GET /p2/emergency/runs/:id/dashboard)
export * from './useStartEmergencyRun';    // POST /p2/emergency/runs/start
export * from './useEndEmergencyRun';      // POST /p2/emergency/runs/:id/resolve (alias)
export * from './useResolveEmergencyRun';  // POST /p2/emergency/runs/:id/resolve

// Emergency scope management
export * from './useGrantEmergencyScope';  // POST /p2/emergency/runs/:id/grant-scope
export * from './useRevokeEmergencyScope'; // POST /p2/emergency/runs/:id/revoke-scope

// Emergency exports
export * from './useExportEmergencyPlaybook';      // POST /p2/emergency/runs/:id/export-playbook
export * from './useGenerateEmergencyRecordPack';  // POST /p2/emergency/runs/:id/generate-record-pack
export * from './useShareEmergencyAuthority';      // POST /p2/emergency/runs/:id/share-authority

// Audit events (GET /p2/events)
export * from './useOperatorAuditEvents';

// Evidence/Defense hooks - PLACEHOLDER: Endpoints not yet implemented
// These call paths that don't exist yet and will need backend implementation
export * from './useAddEvidence';         // POST /p2/emergency/runs/:id/evidence (NOT YET IMPLEMENTED)
export * from './useCreateDefensePack';   // POST /p2/emergency/runs/:id/defense-pack (NOT YET IMPLEMENTED)

export { P2ApiError } from '../operatorP2';
