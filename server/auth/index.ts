/**
 * Authorization Module - Single Entry Point
 * AUTH_CONSTITUTION.md governs all exports
 */

// Principal Resolution
export { 
  resolvePrincipalFromSession, 
  getOrCreatePrincipal,
  type PrincipalContext 
} from './principal';

// Scope Resolution
export {
  resolvePlatformScopeId,
  resolveOrganizationScopeId,
  resolveTenantScopeId,
  resolveResourceTypeScopeId,
  resolveResourceScopeId,
} from './scope';

// Auth Context Middleware
export {
  authContextMiddleware,
  hasAuthContext,
  type AuthContext,
  type AuthenticatedRequest,
} from './context';

// Authorization Helper
export {
  authorize,
  can,
  requireCapability,
  requirePlatformAdmin,
  requireTenantAdmin,
  NotAuthorizedError,
  type AuthorizeOptions,
  type AuthorizeResult,
} from './authorize';

// Capability Snapshot (PROMPT-6)
export {
  getCapabilitySnapshot,
  hasCapability,
  type CapabilitySnapshot,
} from './capabilities';
