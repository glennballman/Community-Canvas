# Auth/Tenant Tables Canonicalization (V3.5)

## Overview

This document describes the canonical (primary) and deprecated tables for authentication and tenant management in the Community Canvas platform.

## Canonical Tables (V3)

These are the **primary tables** that MUST be used for all new development:

### Users

| Table | ID Type | Purpose |
|-------|---------|---------|
| `cc_users` | UUID | Primary user identity table |

**Schema:**
- `id` (UUID) - Primary key
- `email` (varchar) - User email (unique, lowercase)
- `password_hash` (varchar) - bcrypt hashed password
- `given_name`, `family_name`, `display_name` - Name fields
- `telephone`, `avatar_url` - Contact info
- `status` (varchar) - 'active', 'suspended', etc.
- `is_platform_admin` (boolean) - Platform admin flag
- `email_verified` (boolean)
- `last_login_at`, `login_count` - Login tracking
- `legacy_staging_user_id` (integer) - Reference to migrated staging user

### Tenants

| Table | ID Type | Purpose |
|-------|---------|---------|
| `cc_tenants` | UUID | Primary tenant/organization table |
| `cc_tenant_users` | UUID | User-tenant membership |

### Sessions

For V3 users (UUID IDs), we use **stateless JWT authentication**. The JWT token contains:
- `userId` - User UUID
- `email` - User email
- `userType` - 'admin' or 'user'
- `exp` - Expiration timestamp

No server-side session storage is required for V3 users. The token is self-validating.

---

## Deprecated Tables (Legacy)

These tables are **deprecated** and should only be used for backward compatibility:

### Staging Users (Legacy)

| Table | ID Type | Status |
|-------|---------|--------|
| `cc_staging_users` | integer | **DEPRECATED** - Fallback only |
| `cc_staging_sessions` | integer | **DEPRECATED** - Legacy sessions |
| `cc_staging_password_resets` | integer | **DEPRECATED** |
| `cc_staging_user_favorites` | - | **DEPRECATED** |
| `cc_staging_user_vehicles` | - | **DEPRECATED** |
| `cc_staging_host_accounts` | - | **DEPRECATED** |

### Migration Status

Login and registration endpoints now:
1. **Check `cc_users` first** (canonical)
2. **Fallback to `cc_staging_users`** if not found (legacy)

New user registrations are **always created in `cc_users`**.

---

## Login Flow

```
POST /api/auth/login
  │
  ├─ Check cc_users (canonical)
  │   └─ Found? → Authenticate, return JWT, source: "cc_users"
  │
  └─ Check cc_staging_users (fallback)
      └─ Found? → Authenticate, return JWT, source: "cc_staging_users"
```

The response includes `source` field to indicate which table was used.

---

## API Endpoints Updated

| Endpoint | Status |
|----------|--------|
| `POST /api/auth/login` | Uses cc_users first, fallback to staging |
| `POST /api/auth/register` | Creates in cc_users only |
| `GET /api/auth/me` | Uses cc_users first, fallback to staging |
| `PUT /api/auth/me` | Still uses staging (to be migrated) |
| `POST /api/auth/password/*` | Still uses staging (to be migrated) |

---

## Migration Plan

### Phase 1: Hybrid Mode (Current)
- Login checks both tables, cc_users first
- Registration creates in cc_users only
- Existing staging users continue to work

### Phase 2: Migration Script (DEV-only)
- Run script to copy staging users to cc_users
- Set `legacy_staging_user_id` for reference
- Users can then login via cc_users

### Phase 3: Deprecation
- Remove fallback queries to staging tables
- Drop staging tables (after validation period)

---

## Safe Migration Script

For DEV environments only:

```sql
-- Copy staging users to cc_users (skip if already exists)
INSERT INTO cc_users (email, password_hash, given_name, family_name, display_name, telephone, avatar_url, status, legacy_staging_user_id)
SELECT 
  email,
  password_hash,
  given_name,
  family_name,
  COALESCE(CONCAT(given_name, ' ', family_name), email),
  telephone,
  avatar_url,
  COALESCE(status, 'active'),
  id
FROM cc_staging_users
WHERE email NOT IN (SELECT email FROM cc_users);
```

---

## Tenant Architecture

| Table | Purpose |
|-------|---------|
| `cc_tenants` | Organizations/businesses |
| `cc_tenant_users` | User membership in tenants |
| `cc_tenant_invitations` | Pending invitations |

Tenant selection uses **only** canonical tables. No staging equivalent exists for tenants.

---

## References

- `server/routes/auth.ts` - Login/register/me endpoints
- `server/routes/dev-login.ts` - Dev login (uses cc_users)
- `server/routes/dev-demo.ts` - Demo seed (uses cc_users)
- `server/middleware/auth.ts` - JWT authentication
