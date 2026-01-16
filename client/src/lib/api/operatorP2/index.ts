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

// Legal Holds (POST /p2/legal/holds/*)
export * from './useCreateLegalHold';      // POST /p2/legal/holds
export * from './useAddLegalHoldTarget';   // POST /p2/legal/holds/:id/targets
export * from './useReleaseLegalHold';     // POST /p2/legal/holds/:id/release

// Insurance Dossiers (POST /p2/insurance/*)
export * from './useAssembleInsuranceDossier';      // POST /p2/insurance/claims/:id/assemble
export * from './useExportInsuranceDossier';        // POST /p2/insurance/dossiers/:id/export
export * from './useShareInsuranceDossierAuthority'; // POST /p2/insurance/dossiers/:id/share-authority

// Disputes / Defense Packs (POST /p2/disputes/* and /p2/defense-packs/*)
export * from './useAssembleDefensePack';           // POST /p2/disputes/:id/assemble-defense-pack
export * from './useExportDefensePack';             // POST /p2/defense-packs/:id/export
export * from './useShareDefensePackAuthority';     // POST /p2/defense-packs/:id/share-authority

// Monetization (GET /p2/monetization/*)
export * from './useMonetizationUsage';             // GET /p2/monetization/usage

export { P2ApiError } from '../operatorP2';
