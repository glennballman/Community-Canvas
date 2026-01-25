# STEP 11C Phase 2A: Email Delivery & Invitation Lifecycle Management

## Overview

Phase 2A extends the STEP 11C stakeholder notification system with:
1. **Email delivery infrastructure** via nodemailer SMTP
2. **Configurable invitation policies** with platform defaults and tenant overrides
3. **Rate limiting** with hierarchical enforcement (tenant daily, individual hourly, per-request)
4. **Lifecycle management** with revoke/resend endpoints
5. **Enhanced UI** with status badges and inline actions

## Database Schema

### cc_platform_invite_policy (Singleton Defaults)
```sql
CREATE TABLE cc_platform_invite_policy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key text NOT NULL UNIQUE DEFAULT 'default',
  tenant_daily_cap integer NOT NULL DEFAULT 500,
  individual_hourly_cap integer NOT NULL DEFAULT 200,
  per_request_cap integer NOT NULL DEFAULT 50,
  email_send_per_minute integer NOT NULL DEFAULT 60,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### cc_tenant_invite_policy (Per-Tenant Overrides)
```sql
CREATE TABLE cc_tenant_invite_policy (
  tenant_id uuid PRIMARY KEY REFERENCES cc_tenants(id) ON DELETE CASCADE,
  tenant_daily_cap integer NULL,       -- NULL = inherit platform default
  individual_hourly_cap integer NULL,  -- NULL = inherit platform default
  per_request_cap integer NULL,        -- NULL = inherit platform default
  email_send_per_minute integer NULL,  -- NULL = inherit platform default
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

## Email Service

### Configuration
- `EMAIL_ENABLED=true` - Master switch for email delivery
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` - SMTP credentials
- Falls back gracefully to copy/paste link strategy if disabled

### Templates (server/services/emailTemplates/invitationTemplates.ts)
- `invitationCreated` - Initial invitation email
- `invitationResent` - Resend notification
- `invitationRevoked` - Revocation notification (non-silent only)
- `invitationClaimed` - Confirmation to inviter

### Email Service API (server/services/emailService.ts)
```typescript
interface SendEmailResult {
  sent: boolean;
  skipped: boolean;
  messageId?: string;
  error?: string;
}

sendEmail(to, subject, html, text): Promise<SendEmailResult>
```
- Never throws - returns result object
- Logs all send attempts with messageId or error

## Rate Limiting

### In-Memory Tracking
```typescript
// Tenant daily counts (reset at midnight UTC)
tenantDailyCounts: Map<string, { count: number; date: string }>

// Individual hourly counts (reset each hour)
individualHourlyCounts: Map<string, { count: number; hour: string }>
```

### Enforcement Order
1. Per-request cap checked first (immediate reject)
2. Tenant daily cap checked second
3. Individual hourly cap checked third
4. Email throttle checked per-invitation

### Policy Resolution
Tenant overrides > Platform defaults. NULL values inherit from platform.

## API Endpoints

### POST /api/provider/runs/:runId/stakeholder-invites
Creates invitations with rate limit enforcement:
```json
Request:
{
  "invitees": [
    { "email": "...", "name": "...", "message": "..." }
  ]
}

Response (success):
{
  "ok": true,
  "invitations": [...],
  "emails_sent": 3,
  "emails_skipped": 0,
  "email_enabled": true
}

Response (rate limited):
{
  "ok": false,
  "error": "error.invite.rate_limit",
  "scope": "tenant_daily",
  "limit": 500
}
```

### GET /api/provider/runs/:runId/stakeholder-invites
Lists invitations for a run with full details:
```json
Response:
{
  "ok": true,
  "invitations": [
    {
      "id": "uuid",
      "invitee_email": "...",
      "invitee_name": "...",
      "status": "sent|viewed|claimed|expired|revoked",
      "sent_at": "...",
      "sent_via": "email|link",
      "viewed_at": "...",
      "claimed_at": "...",
      "revoked_at": "...",
      "revocation_reason": "...",
      "claim_url": "/i/abc123...",
      "claim_token_expires_at": "..."
    }
  ]
}
```

### POST /api/provider/runs/:runId/stakeholder-invites/:inviteId/resend
Refreshes token (if expired), resets status to 'sent', sends email:
```json
Response:
{
  "ok": true,
  "claim_url": "/i/abc123...",
  "email_delivered": true
}
```

### POST /api/provider/runs/:runId/stakeholder-invites/:inviteId/revoke
Revokes invitation with optional reason and silent flag:
```json
Request:
{
  "reason": "Optional revocation reason",
  "silent": true  // Default: true (no email to invitee)
}

Response:
{
  "ok": true,
  "revoked_at": "2024-01-15T..."
}
```

### GET /api/i/:token
Public invitation view. Returns:
- Valid invitation: `status: 'valid'` with context details
- Revoked invitation: `status: 'revoked'` with revocation details
- Invalid/expired: `status: 'invalid'` or 404

Notifies inviter on first view (in-app notification).

### POST /api/i/:token/claim
Claims invitation by signing in or registering. Notifies inviter when claimed.

## Frontend Enhancements

### NotifyStakeholdersModal
- **Status badges**: pending, sent, viewed, claimed, expired, revoked
- **Copy link button**: For each active invitation
- **Resend button**: Refreshes token and resends (sent/viewed/expired statuses)
- **Revoke button**: Opens inline dialog with reason input and silent checkbox
- **Email status indicators**: Shows when email delivery is unavailable

### Invitation Status Flow
```
pending → sent → viewed → claimed
                    ↓
                 expired
pending/sent/viewed → revoked
```

## Notifications

### In-App Notifications (cc_notifications)
- Invitation created (to invitee if registered)
- Invitation viewed (to inviter)
- Invitation claimed (to inviter)
- Invitation resent (to invitee if registered)
- Invitation revoked (to invitee if not silent and registered)

### Email Notifications (when EMAIL_ENABLED=true)
- Invitation created email (to invitee)
- Invitation resent email (to invitee)
- Invitation revoked email (to invitee, non-silent only)
- Invitation claimed email (to inviter)

## Security Considerations

1. **RLS**: Both policy tables protected with service_mode bypass
2. **Token security**: 32-byte hex tokens (randomBytes(16))
3. **Email masking**: Invitee emails masked in public view responses
4. **Rate limits**: Defense against invitation spam
5. **Silent revocation**: Default to protect invitee privacy

## Files Modified/Created

### Created
- `server/services/emailService.ts`
- `server/services/emailTemplates/invitationTemplates.ts`
- `server/migrations/181_invite_policies.sql`

### Modified
- `server/routes/provider.ts` - Rate limits, email delivery, revoke/resend endpoints
- `server/routes/public-invitations.ts` - Revoked handling, claim notifications
- `client/src/components/provider/NotifyStakeholdersModal.tsx` - Enhanced UI
