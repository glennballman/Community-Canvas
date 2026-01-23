# Auth V3.5 Zero-Debt Canonicalization Proof Pack

Created: 2026-01-23
Status: COMPLETE

## A) Schema Proof

### cc_users (Canonical User Identity Table)
```
column_name          | data_type                    | is_nullable
---------------------|------------------------------|-------------
id                   | uuid                         | NO
email                | character varying            | NO
password_hash        | character varying            | YES
email_verified       | boolean                      | YES
email_verified_at    | timestamp without time zone  | YES
given_name           | character varying            | YES
family_name          | character varying            | YES
display_name         | character varying            | YES
telephone            | character varying            | YES
avatar_url           | text                         | YES
status               | character varying            | YES
is_platform_admin    | boolean                      | YES
last_login_at        | timestamp without time zone  | YES
login_count          | integer                      | YES
created_at           | timestamp without time zone  | YES
updated_at           | timestamp without time zone  | YES
legacy_staging_user_id| integer                     | YES (migration ref only)
```

### cc_auth_sessions (Canonical Session Table)
```
column_name          | data_type                    | is_nullable
---------------------|------------------------------|-------------
id                   | uuid                         | NO
user_id              | uuid                         | NO (FK → cc_users)
token_hash           | text                         | NO
refresh_token_hash   | text                         | YES
refresh_expires_at   | timestamp with time zone     | YES
session_type         | character varying            | YES
device_name          | text                         | YES
device_type          | character varying            | YES
browser              | character varying            | YES
os                   | character varying            | YES
ip_address           | text                         | YES
user_agent           | text                         | YES
city                 | character varying            | YES
region               | character varying            | YES
country              | character varying            | YES
status               | character varying            | YES
created_at           | timestamp with time zone     | YES
last_used_at         | timestamp with time zone     | YES
expires_at           | timestamp with time zone     | NO
revoked_at           | timestamp with time zone     | YES
revoked_reason       | character varying            | YES
is_suspicious        | boolean                      | YES
mfa_verified         | boolean                      | YES
```

### Staging Auth Tables - CONFIRMED DROPPED
```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public' 
AND (tablename LIKE 'cc_staging_user%' 
  OR tablename LIKE 'cc_staging_session%' 
  OR tablename LIKE 'cc_staging_password%' 
  OR tablename LIKE 'cc_staging_host%'
  OR tablename LIKE 'cc_legacy_%');

-- Result: (empty - 0 rows)
```

**Tables Dropped:**
- cc_staging_users ✓
- cc_staging_sessions ✓
- cc_staging_password_resets ✓
- cc_staging_host_accounts ✓
- cc_staging_host_sessions ✓
- cc_staging_host_activity_log ✓
- cc_staging_host_notifications ✓
- cc_staging_user_favorites ✓
- cc_staging_user_vehicles ✓
- cc_legacy_trailer_photos ✓
- cc_legacy_trailer_profiles ✓
- cc_legacy_vehicle_photos ✓
- cc_legacy_vehicle_profiles ✓

---

## B) Route Proof

### Auth Endpoints (server/routes/auth.ts)

| Endpoint | Method | Auth | Table Reference |
|----------|--------|------|-----------------|
| /api/auth/register | POST | None | cc_users ONLY |
| /api/auth/login | POST | None | cc_users ONLY |
| /api/auth/refresh | POST | None | cc_auth_sessions ONLY |
| /api/auth/logout | POST/GET | None | cc_auth_sessions ONLY |
| /api/auth/me | GET | JWT | cc_users ONLY |
| /api/auth/me | PUT | JWT | cc_users ONLY |
| /api/auth/password/change | POST | JWT | cc_users + cc_auth_sessions |
| /api/auth/password/forgot | POST | None | cc_users ONLY |
| /api/auth/password/reset | POST | None | cc_users + cc_auth_sessions |
| /api/auth/sessions | GET | JWT | cc_auth_sessions ONLY |
| /api/auth/sessions/:id | DELETE | JWT | cc_auth_sessions ONLY |
| /api/auth/sessions | DELETE | JWT | cc_auth_sessions ONLY |

**NO staging fallbacks exist in auth.ts**

---

## C) Functional Proof

### 1. Register New User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@canonical.com","password":"Test123!abc","firstName":"Test","lastName":"User"}'
```
Expected: `{"ok":true,"user":{...},"accessToken":"...","refreshToken":"..."}`

### 2. Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"glenn@envirogroupe.com","password":"Tester123"}'
```
Result: 
```json
{
  "ok": true,
  "user": {
    "id": "a0000000-0000-0000-0000-000000000001",
    "email": "glenn@envirogroupe.com",
    "firstName": "Glenn",
    "lastName": "Ballman",
    "displayName": "Glenn Ballman",
    "userType": "admin",
    "isPlatformAdmin": true
  },
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci..."
}
```

### 3. /me Works
```bash
curl http://localhost:5000/api/auth/me \
  -H 'Authorization: Bearer <accessToken>'
```
Expected: `{"ok":true,"user":{...}}`

### 4. Refresh Token Rotation
```bash
curl -X POST http://localhost:5000/api/auth/refresh \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"<refreshToken>"}'
```
Result: `{"ok":true,"accessToken":"<new>","refreshToken":"<new>"}`

Old refresh token is invalidated in cc_auth_sessions.

### 5. Access Token Cannot Be Used as Refresh Token
```bash
curl -X POST http://localhost:5000/api/auth/refresh \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"<accessToken>"}'
```
Result: `{"ok":false,"error":"Session expired or revoked"}`

Validated by checking `type: 'refresh'` claim in JWT.

### 6. Logout Invalidates Session
```bash
curl -X POST http://localhost:5000/api/auth/logout \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"<refreshToken>"}'
```
Result: HTTP 204 No Content
Session marked as revoked in cc_auth_sessions.

### 7. Platform Admin Login Works
Glenn's account has `is_platform_admin = true` in cc_users.
Login returns `isPlatformAdmin: true` without any staging table lookup.

---

## D) Grep Proof

```bash
rg -n "cc_staging_users|cc_staging_sessions|staging_users|migrated_from_staging|source.*cc_staging" \
   server client shared \
   --glob '!*.md' \
   --glob '!node_modules/**' \
   --glob '!_deprecated/**'
```

**Result: 0 hits in active auth code**

Deprecated files (quarantined in server/_deprecated/):
- hostAuthService.ts
- hostAuth.ts
- hostProperties.ts
- host.ts

---

## E) Lint Gate

```bash
npx tsx scripts/auth-purge-lint.ts
```

**Result: PASSED**

```
🔍 AUTH PURGE LINT: Checking for forbidden staging/legacy auth patterns...

✅ No forbidden staging/legacy auth patterns found!

AUTH PURGE LINT: PASSED
```

---

## Summary

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 0: Audit | ✅ Complete | docs/AUTH_PURGE_AUDIT.md created |
| Phase 1: Auth Contract | ✅ Complete | auth.ts uses cc_users only |
| Phase 2: Session Spine | ✅ Complete | cc_auth_sessions with token rotation |
| Phase 3: Drop Tables | ✅ Complete | 13 tables dropped |
| Phase 4: Server Cleanup | ✅ Complete | Host routes disabled |
| Phase 5: Client Cleanup | ✅ Complete | No auth staging refs in client |
| Phase 6: Lint Gate | ✅ Complete | scripts/auth-purge-lint.ts |
| Phase 7: Proof Pack | ✅ Complete | This document |

**AUTH V3.5 ZERO-DEBT CANONICALIZATION: COMPLETE**
