# Auth V3.5 Zero-Debt Canonicalization Audit

Created: 2026-01-23
Status: IN PROGRESS

## Phase 0: Baseline Audit

### A) Legacy Tables Inventory

**cc_staging_* tables (31 total):**
1. cc_staging_chamber_links
2. cc_staging_data_sources
3. cc_staging_revenue_daily
4. cc_staging_reviews
5. cc_staging_service_providers
6. cc_staging_reservations
7. cc_staging_sessions (AUTH - must drop)
8. cc_staging_spots
9. cc_staging_host_accounts (AUTH - must drop)
10. cc_staging_host_activity_log
11. cc_staging_ical_feeds
12. cc_staging_import_batches
13. cc_staging_import_raw
14. cc_staging_password_resets (AUTH - must drop)
15. cc_staging_pricing
16. cc_staging_pricing_overrides
17. cc_staging_properties
18. cc_staging_property_claims
19. cc_staging_property_hosts
20. cc_staging_calendar_blocks
21. cc_staging_host_notifications
22. cc_staging_host_sessions (AUTH - must drop)
23. cc_staging_trip_stops
24. cc_staging_trips
25. cc_staging_user_favorites
26. cc_staging_user_vehicles
27. cc_staging_users (AUTH - PRIMARY TARGET)
28. cc_staging_vehicle_profiles

**cc_legacy_* tables (4 total):**
1. cc_legacy_trailer_photos
2. cc_legacy_trailer_profiles
3. cc_legacy_vehicle_photos
4. cc_legacy_vehicle_profiles

### B) Code References Inventory

**Files with cc_staging references:**
1. `server/routes/auth.ts` - LOGIN/REGISTER fallback, /me, password reset, user vehicles
2. `server/routes/staging.ts` - Staging properties/spots API
3. `server/routes/host.ts` - Host property management
4. `server/routes/hostProperties.ts` - Host property endpoints
5. `server/routes/civos.ts` - Service providers
6. `server/routes/crew.ts` - Crew scheduling
7. `server/routes/import.ts` - Import batches
8. `server/services/hostAuthService.ts` - Host account auth (separate from user auth)
9. `server/storage/stagingStorage.ts` - All staging CRUD operations
10. `client/src/pages/crew/AccommodationSearch.tsx` - Client references

### C) Canonical Auth Tables Analysis

**cc_users (PRIMARY USER TABLE):**
- id: uuid (PK)
- email: varchar (NOT NULL, unique)
- password_hash: varchar
- email_verified, email_verified_at
- given_name, family_name, display_name, telephone
- avatar_url, status, is_platform_admin
- last_login_at, login_count
- legacy_staging_user_id: integer (migration reference - can be removed)
- created_at, updated_at

**cc_auth_accounts (IDENTITY/AUTH ACCOUNT):**
- id: uuid (PK)
- portal_id: uuid FK→cc_portals
- identity_id: uuid FK→cc_verified_identities
- tenant_id: uuid FK→cc_tenants
- auth_provider, auth_provider_id
- email (NOT NULL), password_hash
- phone, display_name, avatar_url, bio
- timezone, locale, preferences_json, notification_settings_json
- status, suspension_reason, suspended_until
- login tracking (last_login_at, last_active_at, login_count)
- onboarding fields
- signup tracking (source, utm_*)
- created_at, updated_at, deleted_at

**cc_auth_sessions:**
- id: uuid (PK)
- user_id: uuid FK→cc_auth_accounts (NOT cc_users!)
- token_hash, refresh_token_hash
- refresh_expires_at
- session metadata (device, browser, IP, location)
- status, revoked_at, revoked_reason
- created_at, last_used_at, expires_at
- mfa_verified, is_suspicious

### D) Current JWT/Refresh Flow Analysis

**Current Implementation (BROKEN):**
1. Login checks cc_users first (returns accessToken only, no refresh)
2. Falls back to cc_staging_users (returns both tokens, stores in cc_staging_sessions)
3. Refresh endpoint ONLY works with cc_staging_sessions
4. cc_auth_sessions table exists but is UNUSED

**Problems:**
1. cc_auth_sessions.user_id → cc_auth_accounts (not cc_users)
2. No link between cc_users and cc_auth_accounts
3. V3 users have no way to refresh tokens
4. Two separate session storage systems

### Resolution: Canonical Auth Architecture

**Decision: Simplify to cc_users + cc_auth_sessions (direct link)**

Rather than maintaining the cc_auth_accounts indirection, we will:
1. Keep cc_users as the ONLY user identity table
2. Modify cc_auth_sessions to FK directly to cc_users (not cc_auth_accounts)
3. Implement proper refresh token flow for all users
4. DROP all cc_staging_* auth tables

**Alternative considered (rejected):** Using cc_auth_accounts as the identity layer
- Would require migrating all cc_users to cc_auth_accounts
- Adds unnecessary complexity for current use case
- cc_auth_accounts is designed for portal-level identity, not needed now

---

## Canonical Auth Contract (Target State)

### Tables (FINAL):
- `cc_users` - Single user identity table (UUID PKs)
- `cc_tenants` - Tenant organizations
- `cc_tenant_users` - User-tenant memberships
- `cc_auth_sessions` - Session storage (FK to cc_users.id)

### Endpoints (cc_users ONLY):
- POST /api/auth/register - Creates cc_users row
- POST /api/auth/login - Validates cc_users, creates session
- POST /api/auth/refresh - Rotates refresh token
- POST /api/auth/logout - Invalidates session
- GET /api/auth/me - Returns cc_users data
- PUT /api/auth/me - Updates cc_users data
- POST /api/auth/change-password
- POST /api/auth/forgot-password
- POST /api/auth/reset-password

### Response Envelope (FINAL):
```json
{
  "ok": true,
  "user": { ... },
  "accessToken": "...",
  "refreshToken": "..."
}
```
OR
```json
{
  "ok": false,
  "error": "message"
}
```

NO "source" field. NO staging fallback.

---

## Tables to DROP

### Phase 3 Migration (AUTH PURGE):
```sql
-- Drop FKs first
ALTER TABLE cc_staging_sessions DROP CONSTRAINT IF EXISTS cc_staging_sessions_user_id_fkey;
ALTER TABLE cc_staging_password_resets DROP CONSTRAINT IF EXISTS cc_staging_password_resets_user_id_fkey;
ALTER TABLE cc_staging_host_sessions DROP CONSTRAINT IF EXISTS cc_staging_host_sessions_host_account_id_fkey;
ALTER TABLE cc_staging_user_favorites DROP CONSTRAINT IF EXISTS cc_staging_user_favorites_user_id_fkey;
ALTER TABLE cc_staging_user_vehicles DROP CONSTRAINT IF EXISTS cc_staging_user_vehicles_user_id_fkey;

-- Drop auth-related staging tables
DROP TABLE IF EXISTS cc_staging_sessions CASCADE;
DROP TABLE IF EXISTS cc_staging_password_resets CASCADE;
DROP TABLE IF EXISTS cc_staging_host_sessions CASCADE;
DROP TABLE IF EXISTS cc_staging_host_accounts CASCADE;
DROP TABLE IF EXISTS cc_staging_host_activity_log CASCADE;
DROP TABLE IF EXISTS cc_staging_host_notifications CASCADE;
DROP TABLE IF EXISTS cc_staging_user_favorites CASCADE;
DROP TABLE IF EXISTS cc_staging_user_vehicles CASCADE;
DROP TABLE IF EXISTS cc_staging_users CASCADE;

-- Drop legacy tables
DROP TABLE IF EXISTS cc_legacy_trailer_photos CASCADE;
DROP TABLE IF EXISTS cc_legacy_trailer_profiles CASCADE;
DROP TABLE IF EXISTS cc_legacy_vehicle_photos CASCADE;
DROP TABLE IF EXISTS cc_legacy_vehicle_profiles CASCADE;

-- Non-auth staging tables (keep for now or drop based on usage)
-- These don't affect auth flow but may have business data:
-- cc_staging_properties, cc_staging_spots, cc_staging_reservations, etc.
```

---

## Phase 8: Calendar Purge & Host Tables Drop (2026-01-23)

### A) Calendar Components Purged

**Apple-style calendar components moved to _deprecated/:**
- `CalendarGrid.tsx` → `client/src/_deprecated/`
- `CalendarRunCard.tsx` → `client/src/_deprecated/`
- `ContractorCalendarPage.tsx` → `client/src/_deprecated/`
- `ResidentCalendarPage.tsx` → `client/src/_deprecated/`
- `PortalCalendarPage.tsx` → `client/src/_deprecated/`

**Sole Calendar Source:**
- `OpsCalendarBoardPage.tsx` - Uses ScheduleBoard time spine
- DEV-only route identity banner shows "mode" and "ScheduleBoard" source

### B) Host Auth Tables Dropped

**Tables dropped (0 rows each, no data loss):**
```sql
DROP TABLE cc_host_sessions CASCADE;  -- FK removed from cc_host_accounts
DROP TABLE cc_host_accounts CASCADE;  -- FKs removed from cc_rental_inventory, cc_staging_ical_feeds
```

**Orphaned columns dropped:**
```sql
ALTER TABLE cc_rental_inventory DROP COLUMN owner_host_id;
ALTER TABLE cc_staging_ical_feeds DROP COLUMN host_account_id;
```

### C) Lint Gate Updated

`scripts/auth-purge-lint.ts` now catches:
- All legacy auth table references
- Host auth tables: `cc_host_accounts`, `cc_host_sessions`
- Deprecated calendar components: `CalendarGrid`, `CalendarRunCard`, `ContractorCalendarPage`, `ResidentCalendarPage`, `PortalCalendarPage`

### D) Verification Results

**Lint check: PASSED**
```
✅ No forbidden staging/legacy auth patterns found!
AUTH PURGE LINT: PASSED
```

**Auth response envelope: CLEAN**
- `ok: true` - 11 instances in auth.ts
- `success: true` - 0 instances in auth.ts

---

## Status: COMPLETE

Auth V3.5 zero-debt canonicalization complete:
- 13 legacy auth tables dropped
- 2 host auth tables dropped  
- cc_users is sole identity table
- Apple-style calendar purged
- Lint gate prevents regression
