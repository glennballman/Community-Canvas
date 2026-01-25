# STEP 11C Phase 2B-2: Already-on-Platform Fast Path (CC-13)

## Overview

This phase implements the "already on platform" fast path for stakeholder invitations:
- On-platform invitees receive in-app notifications immediately
- Policy-controlled option to skip email for on-platform invitees
- Off-platform behavior remains unchanged (email or link fallback)

## Implementation Summary

### A) DB Migration (182_invite_skip_email_policy.sql)

Added `skip_email_if_on_platform` column to policy tables:

```sql
-- Platform default (false = send both in-app and email)
ALTER TABLE cc_platform_invite_policy
ADD COLUMN IF NOT EXISTS skip_email_if_on_platform boolean NOT NULL DEFAULT false;

-- Tenant override (NULL = inherit platform default)
ALTER TABLE cc_tenant_invite_policy
ADD COLUMN IF NOT EXISTS skip_email_if_on_platform boolean NULL;
```

### B) Schema Update (shared/schema.ts)

Added `skipEmailIfOnPlatform` field to both policy table definitions:

```typescript
// Platform policy
skipEmailIfOnPlatform: boolean("skip_email_if_on_platform").notNull().default(false),

// Tenant policy (nullable for inheritance)
skipEmailIfOnPlatform: boolean("skip_email_if_on_platform"),
```

### C) Effective Policy Resolution (server/routes/provider.ts)

Extended `loadEffectivePolicy()` to include:

```typescript
skipEmailIfOnPlatform: tenantOverride.skip_email_if_on_platform ?? platform.skip_email_if_on_platform ?? false,
```

### D) On-Platform Detection & Invitee Notification

**Batch lookup individuals by email:**
```typescript
const individualsResult = await pool.query(
  `SELECT id, lower(email) AS email, full_name AS display_name
   FROM cc_individuals
   WHERE lower(email) = ANY($1::text[])`,
  [normalizedEmails]
);
const individualsByEmail = new Map<string, { id: string; displayName: string | null }>();
```

**For each invitee:**
1. Check if email exists in `individualsByEmail` map
2. If on-platform: create in-app notification via `createInviteNotification()`
3. Determine if email should be sent based on policy
4. Update `sent_via` field with delivery channel

### E) Delivery Channel Logic

| Scenario | In-App | Email | sent_via |
|----------|--------|-------|----------|
| On-platform + skip=true | ✅ | ❌ | `in_app` |
| On-platform + skip=false + email sent | ✅ | ✅ | `both` |
| On-platform + skip=false + email failed | ✅ | ❌ | `in_app` |
| Off-platform + email sent | ❌ | ✅ | `email` |
| Off-platform + email failed/disabled | ❌ | ❌ | `link` |

### F) API Response Enhancement

Response now includes per-invitation fields:
```json
{
  "ok": true,
  "invitations": [{
    "id": "uuid",
    "invitee_email": "user@example.com",
    "on_platform": true,
    "invitee_individual_id": "uuid",
    "delivery_channel": "in_app",
    "email_delivered": false
  }],
  "emails_sent": 0,
  "emails_skipped": 0,
  "in_app_sent": 1,
  "skip_email_if_on_platform": true
}
```

### G) UI Updates (NotifyStakeholdersModal.tsx)

Added delivery badges for invitations:
- **In-app** (blue) - Notified via in-app notification only
- **Email** (green) - Notified via email only  
- **In-app + Email** (purple) - Notified via both channels
- **Link** (muted) - Fallback link only

Added **On platform** badge for invitees with matching `cc_individuals` record.

### H) Copy Tokens Added

```typescript
'provider.notify.delivery.in_app': 'In-app',
'provider.notify.delivery.email': 'Email',
'provider.notify.delivery.both': 'In-app + Email',
'provider.notify.delivery.link': 'Link',
```

---

## Test Scenarios

### Scenario 1: Invitee ON platform, skip_email_if_on_platform = true

**Setup:**
```sql
UPDATE cc_platform_invite_policy SET skip_email_if_on_platform = true WHERE policy_key = 'default';
```

**Expected behavior:**
- Invitation created with `status = 'sent'`
- In-app notification created for invitee (`recipient_individual_id` set)
- No email sent
- `sent_via = 'in_app'`
- Response: `delivery_channel = 'in_app'`, `on_platform = true`

### Scenario 2: Invitee ON platform, skip_email_if_on_platform = false (default)

**Setup:**
```sql
UPDATE cc_platform_invite_policy SET skip_email_if_on_platform = false WHERE policy_key = 'default';
```

**Expected behavior:**
- Invitation created with `status = 'sent'`
- In-app notification created for invitee
- Email attempted (if EMAIL_ENABLED)
- If email sent: `sent_via = 'both'`, `delivery_channel = 'both'`
- If email failed: `sent_via = 'in_app'`, `delivery_channel = 'in_app'`
- Response: `on_platform = true`

### Scenario 3: Invitee OFF platform

**Expected behavior (unchanged from Phase 2A):**
- Invitation created with `status = 'sent'`
- No in-app notification to invitee (invitee has no individual ID)
- Email attempted (if EMAIL_ENABLED)
- If email sent: `sent_via = 'email'`, `delivery_channel = 'email'`
- If email failed: `sent_via = 'link'`, `delivery_channel = 'link'`
- Response: `on_platform = false`

---

## Files Modified

| File | Changes |
|------|---------|
| `server/migrations/182_invite_skip_email_policy.sql` | New migration for policy columns |
| `shared/schema.ts` | Added `skipEmailIfOnPlatform` to policy tables |
| `server/routes/provider.ts` | Policy loading, on-platform detection, invitee notifications |
| `client/src/copy/entryPointCopy.ts` | Delivery channel copy tokens |
| `client/src/components/provider/NotifyStakeholdersModal.tsx` | Delivery badges UI |

---

## Security Notes

- Individual lookup is by email only (no tenant filter) - acceptable for authenticated provider context
- In-app notification `action_url` points to `/i/:token` (not run detail) to ensure claim flow
- Policy inheritance: tenant NULL → platform default

## Terminology Compliance

- ✅ "service provider" (not "contractor")
- ✅ "reservation" (not "booking")
- ✅ No forbidden terms in copy tokens or UI
