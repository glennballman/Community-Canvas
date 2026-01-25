# STEP 11C Phase 2C-4.1: Negotiation Policy Administration

## Status: CERTIFIED

## Objective
Provide tenant administrators with a UI to view and override platform-default negotiation policies for schedule, scope, and pricing negotiations.

## Completed Work

### 1. API Routes (server/routes/negotiation-policy.ts)

**GET /api/tenant/negotiation-policies**
- Returns all three negotiation types (schedule, scope, pricing)
- For each type: resolved policy, has_overrides flag
- Requires tenant context

**GET /api/tenant/negotiation-policies/:negotiationType**
- Returns detailed policy for specific type
- Includes: resolved values, platform_defaults, tenant_overrides
- Shows which values are inherited vs overridden

**PATCH /api/tenant/negotiation-policies/:negotiationType**
- Upsert pattern: creates override record if not exists
- Validates all fields with Zod schema
- Null values reset to platform defaults
- Returns updated resolved policy

**DELETE /api/tenant/negotiation-policies/:negotiationType**
- Removes all tenant overrides for the negotiation type
- Reverts to platform defaults
- Returns resolved policy after reset

### 2. Settings Page (NegotiationPolicySettingsPage.tsx)

**Policy Overview Grid**
- Three cards showing each negotiation type
- Icons: Calendar (schedule), ClipboardList (scope), DollarSign (pricing)
- Summary of current effective values
- "Custom" badge when tenant has overrides

**Policy Detail Editor**
- Full-width card for editing selected policy type
- Controls for each policy field:
  - Max Turns (number input, 1-20)
  - Allow Counter (toggle)
  - Provider Can Initiate (toggle)
  - Stakeholder Can Initiate (toggle)
  - Allow Proposal Attachments (toggle)
- Advanced options (collapsible):
  - Close on Accept
  - Close on Decline
- Shows platform defaults for each field
- Tooltips explaining each setting

**Actions**
- Save Changes button (enabled when changes pending)
- Reset to Defaults button (deletes tenant overrides)
- Loading states for all mutations

### 3. Navigation Entry (v3Nav.ts)
- Added "Negotiation Policies" to Admin section
- Icon: Handshake
- Route: `/app/settings/negotiation-policies`
- Access: tenant_owner, tenant_admin roles

### 4. Route Registration
- Page component: `NegotiationPolicySettingsPage`
- Route: `/app/settings/negotiation-policies`
- API routes mounted at `/api/tenant/negotiation-policies`

### 5. Copy Tokens
Added tokens for settings page:
- `settings.negotiation.title`
- `settings.negotiation.subtitle`
- `settings.negotiation.description`
- `settings.negotiation.edit_policy`
- `settings.negotiation.max_turns`
- `settings.negotiation.max_turns_help`
- `settings.negotiation.allow_counter`
- `settings.negotiation.allow_counter_help`
- `settings.negotiation.provider_can_initiate`
- `settings.negotiation.stakeholder_can_initiate`
- `settings.negotiation.allow_proposal_context`
- `settings.negotiation.allow_proposal_context_help`

## Key Design Decisions

1. **Three-Level Resolution**: Platform defaults -> Tenant overrides -> Resolved effective values. UI shows all three clearly.

2. **Null = Inherit**: Setting a value to null in tenant overrides causes that field to inherit from platform defaults.

3. **Upsert Pattern**: PATCH creates tenant override record if none exists, avoiding need for explicit creation.

4. **Delete = Reset**: DELETE removes entire tenant override record, cleanly reverting to platform defaults.

5. **Role-Based Access**: Only tenant_owner and tenant_admin can access policy settings.

## Files Created
- `server/routes/negotiation-policy.ts` (NEW)
- `client/src/pages/app/NegotiationPolicySettingsPage.tsx` (NEW)

## Files Modified
- `server/routes.ts` (import + registration)
- `client/src/App.tsx` (import + route)
- `client/src/lib/routes/v3Nav.ts` (nav entry)
- `client/src/copy/entryPointCopy.ts` (copy tokens)

## API Reference

### List All Policies
```http
GET /api/tenant/negotiation-policies
Authorization: (tenant context required)

Response:
{
  "ok": true,
  "policies": [
    {
      "negotiation_type": "schedule",
      "resolved": { "maxTurns": 3, "allowCounter": true, ... },
      "has_overrides": false
    },
    ...
  ]
}
```

### Get Policy Detail
```http
GET /api/tenant/negotiation-policies/schedule

Response:
{
  "ok": true,
  "negotiation_type": "schedule",
  "resolved": { "maxTurns": 5, ... },
  "platform_defaults": { "max_turns": 3, ... },
  "tenant_overrides": { "max_turns": 5, ... }
}
```

### Update Policy
```http
PATCH /api/tenant/negotiation-policies/schedule
Content-Type: application/json

{ "max_turns": 5, "allow_counter": false }

Response:
{
  "ok": true,
  "message": "Policy updated successfully",
  "resolved": { "maxTurns": 5, "allowCounter": false, ... }
}
```

### Reset Policy
```http
DELETE /api/tenant/negotiation-policies/schedule

Response:
{
  "ok": true,
  "message": "Policy overrides reset to platform defaults",
  "resolved": { "maxTurns": 3, ... }
}
```

## Date
January 25, 2026
