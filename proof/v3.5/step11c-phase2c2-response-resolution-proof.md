# STEP 11C Phase 2C-2: Provider Resolution Loop for Stakeholder Responses

**Status**: CERTIFIED  
**Date**: 2026-01-25  
**Architect**: Senior Platform Architect + Governance Authority

---

## Overview

This phase enables providers (tenant owners) to explicitly resolve stakeholder responses in a durable, auditable way. This closes the loop: Invite → Claim → Access → Respond → Resolve.

---

## A) Database Schema

### Table: cc_service_run_response_resolutions

```sql
CREATE TABLE cc_service_run_response_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  response_id uuid NOT NULL
    REFERENCES cc_service_run_stakeholder_responses(id) ON DELETE CASCADE,

  run_id uuid NOT NULL
    REFERENCES cc_n3_runs(id) ON DELETE CASCADE,

  run_tenant_id uuid NOT NULL
    REFERENCES cc_tenants(id),

  resolver_individual_id uuid NOT NULL
    REFERENCES cc_individuals(id),

  resolution_type text NOT NULL CHECK (
    resolution_type IN ('acknowledged', 'accepted', 'declined', 'proposed_change')
  ),

  message text,

  resolved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### Indexes

```sql
CREATE INDEX idx_run_response_resolutions_response
  ON cc_service_run_response_resolutions(response_id, resolved_at DESC);

CREATE INDEX idx_run_response_resolutions_run
  ON cc_service_run_response_resolutions(run_id);
```

### RLS Policies

```sql
-- SELECT: Tenant owners + stakeholders who own the response being resolved
CREATE POLICY resolution_select
ON cc_service_run_response_resolutions
FOR SELECT
USING (
  run_tenant_id = current_tenant_id()
  OR resolver_individual_id = current_individual_id()
  OR EXISTS (
    SELECT 1 FROM cc_service_run_stakeholder_responses sr
    WHERE sr.id = cc_service_run_response_resolutions.response_id
      AND sr.stakeholder_individual_id = current_individual_id()
  )
);

-- INSERT: Tenant owners only
CREATE POLICY resolution_insert_tenant
ON cc_service_run_response_resolutions
FOR INSERT
WITH CHECK (
  run_tenant_id = current_tenant_id()
  AND is_service_mode() = false
);

-- Service mode bypass
CREATE POLICY resolution_service_bypass
ON cc_service_run_response_resolutions
FOR ALL
USING (is_service_mode());
```

---

## B) API Endpoints

### POST /api/runs/:runId/responses/:responseId/resolve

**Auth**: requireAuth  
**Authorization**: Tenant owner only

**Request Body**:
```json
{
  "resolution_type": "acknowledged | accepted | declined | proposed_change",
  "message": "optional text"
}
```

**Response**:
```json
{
  "ok": true,
  "resolution": {
    "id": "uuid",
    "response_id": "uuid",
    "run_id": "uuid",
    "resolver_individual_id": "uuid",
    "resolution_type": "accepted",
    "message": "Thank you for confirming!",
    "resolved_at": "2026-01-25T12:00:00Z"
  }
}
```

### GET /api/runs/:runId/resolutions

**Auth**: requireAuth

**Response** (Tenant owner - sees all):
```json
{
  "ok": true,
  "resolutions": [
    {
      "id": "uuid",
      "response_id": "uuid",
      "resolution_type": "accepted",
      "message": "Thank you!",
      "resolved_at": "2026-01-25T12:00:00Z",
      "resolver_name": "Jane Provider",
      "original_response_type": "confirm"
    }
  ]
}
```

---

## C) Provider UI (ProviderRunDetailPage.tsx)

### Resolve Dropdown

Each response row includes a dropdown menu with resolve actions:
- Acknowledge (blue)
- Accept (green)
- Decline (red)
- Propose change (orange)

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button size="sm" variant="ghost" data-testid={`button-resolve-${resp.id}`}>
      <MoreHorizontal className="w-4 h-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuLabel>{resolve('stakeholder_resolution.resolve_cta')}</DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={() => resolveMutation.mutate({ responseId: resp.id, resolutionType: 'accepted' })}>
      <Check className="w-4 h-4 mr-2 text-green-500" />
      {resolve('stakeholder_resolution.accepted')}
    </DropdownMenuItem>
    ...
  </DropdownMenuContent>
</DropdownMenu>
```

### Resolution Badge Display

After resolution, a colored badge appears next to the response:
- 🟢 Accepted (bg-green-500/20 text-green-400)
- 🔵 Acknowledged (bg-blue-500/20 text-blue-400)
- 🔴 Declined (bg-red-500/20 text-red-400)
- 🟠 Change proposed (bg-orange-500/20 text-orange-400)

---

## D) Stakeholder View (RunStakeholderViewPage.tsx)

Stakeholders see the resolution status on their responses:
- Resolution badge shown next to response type
- Resolved timestamp displayed
- Resolution message shown if provided

```tsx
{latestResolution && (
  <div className="mt-3 pt-3 border-t border-muted" data-testid="resolution-info">
    <p className="text-xs text-muted-foreground mb-1">
      {resolve('stakeholder_resolution.resolved_at')} {new Date(latestResolution.resolved_at).toLocaleString()}
    </p>
    {latestResolution.message && (
      <p className="text-sm text-muted-foreground pl-2 border-l-2 border-muted">
        {latestResolution.message}
      </p>
    )}
  </div>
)}
```

---

## E) Copy Tokens

```typescript
'stakeholder_resolution.acknowledged': 'Acknowledged',
'stakeholder_resolution.accepted': 'Accepted',
'stakeholder_resolution.declined': 'Declined',
'stakeholder_resolution.proposed_change': 'Change proposed',
'stakeholder_resolution.resolve_cta': 'Resolve',
'stakeholder_resolution.message_label': 'Optional message',
'stakeholder_resolution.resolved_at': 'Resolved',
'stakeholder_resolution.resolved_by': 'Resolved by',
```

---

## F) Notifications

On resolution insert, stakeholder receives notification:

```typescript
await pool.query(
  `INSERT INTO cc_notifications (
    recipient_individual_id,
    category,
    priority,
    channels,
    context_type,
    context_id,
    body,
    short_body,
    action_url,
    status
  ) VALUES ($1, 'invitation', 'normal', ARRAY['in_app'], 'service_run', $2, $3, $4, $5, 'pending')`,
  [
    stakeholder_individual_id,
    runId,
    `Your response to "${runDisplayName}" has been ${resolution_type.replace('_', ' ')}.`,
    `Response ${resolution_type.replace('_', ' ')}`,
    `/app/runs/${runId}/view`
  ]
);
```

---

## G) Certification Checklist

| Requirement | Status |
|-------------|--------|
| Append-only resolution table | ✅ |
| RLS policies (tenant + stakeholder access) | ✅ |
| POST resolve endpoint (tenant only) | ✅ |
| GET resolutions endpoint | ✅ |
| Provider UI resolve dropdown | ✅ |
| Resolution badges displayed | ✅ |
| Stakeholder view shows resolutions | ✅ |
| Notifications sent on resolve | ✅ |
| No overwrites (append-only) | ✅ |
| Copy tokens added | ✅ |

---

## Files Modified

- `server/migrations/185_stakeholder_response_resolutions.sql` - NEW
- `shared/schema.ts` - Added ccServiceRunResponseResolutions table
- `server/routes/stakeholder-runs.ts` - Added POST resolve + GET resolutions
- `client/src/pages/app/provider/ProviderRunDetailPage.tsx` - Resolve dropdown UI
- `client/src/pages/app/runs/RunStakeholderViewPage.tsx` - Resolution display
- `client/src/copy/entryPointCopy.ts` - Resolution copy tokens

---

**CERTIFIED**: STEP 11C Phase 2C-2 complete.
