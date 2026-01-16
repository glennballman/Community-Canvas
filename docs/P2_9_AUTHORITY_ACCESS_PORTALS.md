# P2.9 Authority/Adjuster Read-Only Portals

## Overview

Authority/Adjuster Read-Only Portals provide a secure mechanism for sharing evidence bundles, insurance claims, and dossiers with external parties such as insurance adjusters, legal authorities, and auditors. The system uses time-limited, revocable access tokens with optional passcode protection.

## Architecture

### Database Tables (Migration 135)

| Table | Purpose |
|-------|---------|
| `cc_authority_access_grants` | Grant containers defining access parameters (recipient, expiry, max views) |
| `cc_authority_access_scopes` | What a grant can access (evidence_bundle, insurance_claim, claim_dossier) |
| `cc_authority_access_tokens` | Shareable tokens tied to grants with usage tracking |
| `cc_authority_access_events` | Append-only audit log for all access events (FORCE RLS) |

### Key Security Features

1. **Token Hashing**: Raw tokens are never stored; only SHA-256 hashes are persisted
2. **Passcode Protection**: Optional bcrypt-hashed passcode requirement per grant
3. **Session Tokens**: JWT with 15-minute expiry after successful token+passcode validation
4. **Rate Limiting**: 30 requests/minute per IP+token hash combination
5. **Signed Downloads**: R2 pre-signed URLs with 60-second expiry
6. **Append-Only Events**: Database trigger prevents UPDATE/DELETE on events table

### SECURITY DEFINER Functions

All public data access goes through these PostgreSQL functions that bypass RLS:

| Function | Purpose |
|----------|---------|
| `cc_authority_validate_token` | Validate token, return scopes (passcode verified in Node.js) |
| `cc_authority_check_scope` | Verify scope access for a grant |
| `cc_authority_get_bundle_manifest` | Get sealed bundle manifest if scoped |
| `cc_authority_get_dossier` | Get dossier data if scoped |
| `cc_authority_get_evidence_object_summary` | Get evidence object metadata if scoped |
| `cc_authority_list_scope_index` | List all accessible scopes for a grant |
| `cc_authority_log_event` | Insert audit event |

## API Routes

### Public Routes (No Authentication)

These routes are accessed by external parties with a share token:

| Method | Path | Description |
|--------|------|-------------|
| POST | `/p/authority/validate` | Validate token + optional passcode, get session |
| GET | `/p/authority/session/scopes` | List accessible scopes (requires session) |
| GET | `/p/authority/session/bundle/:bundleId` | Get bundle manifest (requires session) |
| GET | `/p/authority/session/dossier/:dossierId` | Get dossier data (requires session) |
| GET | `/p/authority/session/evidence/:evidenceId` | Get evidence metadata (requires session) |
| GET | `/p/authority/session/download/:evidenceId` | Get signed download URL (requires session) |

### Authenticated Admin Routes

These routes are used by tenant members to manage access:

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/authority/grants` | Create access grant |
| GET | `/api/authority/grants` | List grants for tenant |
| GET | `/api/authority/grants/:grantId` | Get grant details |
| PUT | `/api/authority/grants/:grantId` | Update grant |
| DELETE | `/api/authority/grants/:grantId` | Revoke grant |
| POST | `/api/authority/grants/:grantId/scopes` | Add scope to grant |
| GET | `/api/authority/grants/:grantId/scopes` | List scopes for grant |
| DELETE | `/api/authority/grants/:grantId/scopes/:scopeId` | Remove scope |
| POST | `/api/authority/grants/:grantId/tokens` | Issue token |
| GET | `/api/authority/grants/:grantId/tokens` | List tokens |
| DELETE | `/api/authority/grants/:grantId/tokens/:tokenId` | Revoke token |
| GET | `/api/authority/grants/:grantId/events` | View access events |

## Access Flow

```
1. Admin creates grant with recipient info, expiry, and optional passcode
2. Admin adds scopes (which bundles/claims/dossiers are accessible)
3. Admin issues token (generates 32-byte random token)
4. Admin shares URL (e.g., /p/authority?t=<base64-token>)
5. External party opens URL, enters passcode if required
6. System validates token + passcode, issues 15-min session JWT
7. External party views allowed data, downloads via signed URLs
8. All access logged to append-only events table
```

## Token Lifecycle

| State | Description |
|-------|-------------|
| active | Token is valid and can be used |
| expired | Token has passed expiry date (auto-set by validation) |
| revoked | Token was manually revoked by admin |

## Grant Types

| Type | Description |
|------|-------------|
| insurance_adjuster | Insurance company claim adjusters |
| legal_authority | Law enforcement, courts |
| regulator | Regulatory bodies |
| auditor | External auditors |
| other | Custom recipient type |

## Scope Types

| Type | Description |
|------|-------------|
| evidence_bundle | Access to a specific sealed evidence bundle |
| insurance_claim | Access to a specific insurance claim |
| claim_dossier | Access to a specific claim dossier |

## Rate Limiting

- Limit: 30 requests per minute
- Key: IP address + token hash
- Window: 60 seconds (sliding)
- Cleanup: Expired entries removed on check

## Session Tokens

- Algorithm: HS256 JWT
- Expiry: 15 minutes
- Payload: `{ tenantId, grantId, tokenId, scopes, type: 'authority_session' }`
- Secret: Uses SESSION_SECRET environment variable

## Signed Downloads

- Provider: Cloudflare R2
- Expiry: 60 seconds
- Scope Check: Validates evidence is part of an accessible bundle

## Testing

All 28 tests pass covering:

- Token generation and hashing
- Passcode hashing and verification
- Session token creation and verification
- Rate limiting (allow, block, cleanup)
- Grant CRUD operations
- Scope management
- Token management
- Token validation (valid, invalid, expired)
- Passcode enforcement
- Token revocation
- Grant revocation with cascading token revocation
- Events append-only enforcement

## Files

| File | Purpose |
|------|---------|
| `server/migrations/135_authority_access_portals.sql` | Database schema and functions |
| `server/lib/authority/access.ts` | Core access module |
| `server/routes/authority.ts` | Express routes |
| `tests/authority/access.test.ts` | Test suite |

## Dependencies

- `bcryptjs`: Passcode hashing/verification
- `jsonwebtoken`: Session token generation/verification
- `@aws-sdk/s3-request-presigner`: R2 signed URLs
- `crypto`: Token generation and SHA-256 hashing
