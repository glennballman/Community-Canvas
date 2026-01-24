# STEP 11C Proof: Directed Operational Presence

**Date**: 2026-01-24  
**Status**: IMPLEMENTED  
**Terminology**: Uses "service provider", "reservation", "notify", "invitation", "stakeholders"  
**Forbidden terms verified**: No "booking", "contractor", or "calendar" in implementation  
**Routing**: Uses Wouter (consistent with app), icons use Hourglass/Timer (not Calendar/Clock)

---

## Implementation Summary

STEP 11C implements Directed Operational Presence for service runs:
- Service providers can create private stakeholder invitations
- System generates copy/paste claim links (no email send required for MVP)
- Public `/i/:token` page shows run context read-only
- Provider run detail has "Notify stakeholders" action with modal

---

## 1) POST /api/provider/runs/:id/stakeholder-invites - Create Invitations

### Request
```json
POST /api/provider/runs/550e8400-e29b-41d4-a716-446655440000/stakeholder-invites
Authorization: Bearer <jwt>

{
  "invitees": [
    {
      "email": "john.stakeholder@example.com",
      "name": "John Stakeholder",
      "message": "Sharing details about our upcoming service run."
    },
    {
      "email": "jane.partner@example.com"
    }
  ]
}
```

### Response
```json
{
  "ok": true,
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "invitations": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "invitee_email": "john.stakeholder@example.com",
      "invitee_name": "John Stakeholder",
      "status": "sent",
      "claim_token_expires_at": "2026-02-23T21:15:00.000Z",
      "claim_url": "/i/a1b2c3d4e5f67890a1b2c3d4e5f67890"
    },
    {
      "id": "223e4567-e89b-12d3-a456-426614174001",
      "invitee_email": "jane.partner@example.com",
      "invitee_name": null,
      "status": "sent",
      "claim_token_expires_at": "2026-02-23T21:15:00.000Z",
      "claim_url": "/i/b2c3d4e5f67890a1b2c3d4e5f6789012"
    }
  ]
}
```

### Validation Rules
- 1-50 invitees per request
- Valid email format required
- Name max 200 chars
- Message max 1000 chars
- Run ownership enforced (tenant_id check)

---

## 2) GET /api/provider/runs/:id/stakeholder-invites - List Invitations

### Request
```
GET /api/provider/runs/550e8400-e29b-41d4-a716-446655440000/stakeholder-invites
Authorization: Bearer <jwt>
```

### Response
```json
{
  "ok": true,
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "invitations": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "invitee_email": "john.stakeholder@example.com",
      "invitee_name": "John Stakeholder",
      "status": "viewed",
      "sent_at": "2026-01-24T21:15:00.000Z",
      "viewed_at": "2026-01-24T22:30:00.000Z",
      "claimed_at": null,
      "claim_token_expires_at": "2026-02-23T21:15:00.000Z"
    },
    {
      "id": "223e4567-e89b-12d3-a456-426614174001",
      "invitee_email": "jane.partner@example.com",
      "invitee_name": null,
      "status": "sent",
      "sent_at": "2026-01-24T21:15:00.000Z",
      "viewed_at": null,
      "claimed_at": null,
      "claim_token_expires_at": "2026-02-23T21:15:00.000Z"
    }
  ]
}
```

**Security note**: claim_token is NOT exposed in list endpoint (only returned at creation time).

---

## 3) GET /api/i/:token - Public Invitation View

### Request
```
GET /api/i/a1b2c3d4e5f67890a1b2c3d4e5f67890
(No authentication required)
```

### Success Response
```json
{
  "ok": true,
  "invitation": {
    "status": "viewed",
    "invitee_name": "John Stakeholder",
    "invitee_email_masked": "j***r@example.com",
    "expires_at": "2026-02-23T21:15:00.000Z",
    "message": "Sharing details about our upcoming service run."
  },
  "run": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Bamfield Equipment Maintenance",
    "starts_at": "2026-02-15T09:00:00.000Z",
    "ends_at": "2026-02-15T17:00:00.000Z",
    "market_mode": "TARGETED"
  },
  "copy": {
    "title": "You've been invited to view a service run",
    "disclaimer": "This link provides read-only access."
  }
}
```

### Invalid/Expired Response
```json
{
  "ok": false,
  "error": "error.invite.invalid_or_expired"
}
```

### Security Features
- Email is masked (j***r@example.com)
- No tenant_id, portal_id, or addresses exposed
- Status updated to 'viewed' on first access (idempotent)
- Token format validated (hex, minimum length)

---

## 4) UI Components

### Provider Run Detail - Actions Section
**Location**: `/app/provider/runs/:id`

Actions available:
1. **Publish to Portals** - Opens PublishRunModal (portal visibility)
2. **Attach Requests** - Opens AddRequestsModal (work management)
3. **Notify stakeholders** - Opens NotifyStakeholdersModal (private ops)

### NotifyStakeholdersModal Features
- Rule block explaining "Publishing ≠ Notify" separation
- Email input (one per line or comma-separated)
- Optional name field
- Optional personal message
- Create button generates invitations
- Newly created invitations show with copy link buttons
- Existing invitations list with status badges:
  - Sent (secondary)
  - Viewed (blue outline)
  - Claimed (default/green)
  - Expired (destructive)
  - Revoked (destructive)

### Public Invitation Page
**Route**: `/i/:token`

Displays:
- Title: "You've been invited to view a service run"
- Read-only badge
- Invitation status
- Masked email
- Expiry date
- Personal message (if provided)
- Run name, dates, market mode

---

## 5) Copy Tokens Added

```typescript
// Provider run detail
'provider.run.notify.button': 'Notify stakeholders',

// Modal
'provider.notify.modal.title': 'Notify stakeholders',
'provider.notify.rule.title': 'Private ops notifications',
'provider.notify.rule.body': 'Notify sends private invitations. Publishing controls what appears on public portals.',

// Form
'provider.notify.invitees.label': 'Email addresses',
'provider.notify.invitees.help': 'One per line or comma-separated.',
'provider.notify.name.label': 'Name (optional)',
'provider.notify.message.label': 'Message (optional)',
'provider.notify.send': 'Create invitations',

// Results
'provider.notify.created.title': 'Invitation links',
'provider.notify.copy': 'Copy link',
'provider.notify.copied': 'Copied',
'provider.notify.list.title': 'Invitation tracking',
'provider.notify.status.sent': 'Sent',
'provider.notify.status.viewed': 'Viewed',
'provider.notify.status.claimed': 'Claimed',
'provider.notify.status.expired': 'Expired',
'provider.notify.status.revoked': 'Revoked',

// Public page
'public.invite.title': "You've been invited to view a service run",
'public.invite.read_only': 'Read-only',
'public.invite.expired': 'This invitation link is invalid or expired.',
```

---

## 6) Explicit Confirmation: No Portal Publication Side Effects

**CONFIRMED**: STEP 11C does NOT create any portal publications.

- Stakeholder invitations use `cc_invitations` table with `context_type = 'service_run'`
- No writes to `cc_run_portal_publications`
- No visibility graph modifications
- This is private ops only - completely separate from public portal publishing

### Separation Enforcement
- Rule block in modal clearly explains the distinction
- Different API endpoints (/stakeholder-invites vs /publish)
- Different database tables (cc_invitations vs cc_run_portal_publications)

---

## Files Modified/Created

### Backend
- `server/routes/provider.ts` - Added stakeholder-invites endpoints
- `server/routes/public-invitations.ts` - New public token view endpoint
- `server/routes.ts` - Registered public invitations router

### Frontend
- `client/src/pages/public/InvitationClaimPage.tsx` - New public page
- `client/src/components/provider/NotifyStakeholdersModal.tsx` - New modal
- `client/src/pages/app/provider/ProviderRunDetailPage.tsx` - Added notify button
- `client/src/App.tsx` - Added /i/:token route
- `client/src/copy/entryPointCopy.ts` - Added copy tokens

---

## Certification

**STEP 11C COMPLETE**

- [x] Provider can create stakeholder invitations for a run
- [x] Copy links generated and copyable
- [x] Public `/i/:token` page renders run context read-only
- [x] Status updated to 'viewed' on access
- [x] Provider run detail has "Notify stakeholders" action
- [x] Modal shows create form and existing invitations
- [x] No portal publication writes occur
- [x] Terminology compliant (no booking/contractor/calendar)
