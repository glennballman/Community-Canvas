# STEP 11C Phase 2C-1.1 — Provider Responses Panel Proof

**Feature**: Tenant-Side Stakeholder Responses Panel  
**Date**: 2026-01-25  
**Status**: COMPLETE

---

## 1. UI Code Excerpt — useQuery for Responses

**File**: `client/src/pages/app/provider/ProviderRunDetailPage.tsx`

```typescript
const { data: responsesData, isLoading: responsesLoading } = useQuery<{
  ok: boolean;
  responses: StakeholderResponse[];
}>({
  queryKey: ['/api/runs', id, 'responses'],
  queryFn: async () => {
    const res = await fetch(`/api/runs/${id}/responses`);
    if (!res.ok) return { ok: false, responses: [] };
    return res.json();
  },
  enabled: !!id
});
```

**Query Key Pattern**: Array-segmented `['/api/runs', id, 'responses']` for proper cache invalidation.

---

## 2. Card Insertion Location

Added after Publications card (around line ~500), before Actions column.

```tsx
<Card data-testid="card-stakeholder-responses">
  <CardHeader>
    <CardTitle className="text-lg flex items-center gap-2">
      {resolve('provider.run.responses.title')}
      {responses.length > 0 && (
        <Badge variant="secondary" className="text-xs" data-testid="badge-responses-count">
          {responses.length}
        </Badge>
      )}
    </CardTitle>
    <CardDescription>Feedback from notified stakeholders</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Loading / Empty / List states */}
  </CardContent>
</Card>
```

---

## 3. Response Rendering Example

Each response item renders with:

```tsx
<div key={resp.id} className="p-3 rounded-md bg-muted/50 space-y-2" data-testid={`response-item-${resp.id}`}>
  <div className="flex items-start justify-between gap-2 flex-wrap">
    <div className="flex items-center gap-2">
      <span className="font-medium text-sm" data-testid="text-response-identity">{displayName}</span>
      <Badge variant={badgeVariant} className="text-xs" data-testid="badge-response-type">
        {badgeLabel}
      </Badge>
    </div>
    <span className="text-xs text-muted-foreground" data-testid="text-response-time">
      {formattedDate}
    </span>
  </div>
  {resp.message && (
    <p className="text-sm text-muted-foreground" data-testid="text-response-message">
      {resp.message}
    </p>
  )}
</div>
```

---

## 4. Identity Display Logic

**Priority Order**:
1. `stakeholder_name` (if present) — display as-is
2. `stakeholder_email` (if present) — masked via `maskEmail()` helper
3. Fallback — copy token `provider.run.responses.identity.fallback` ("Stakeholder")

**maskEmail Implementation**:
```typescript
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const maskedLocal = local.length > 2 ? local[0] + '***' + local.slice(-1) : '***';
  return `${maskedLocal}@${domain}`;
}
```

**Example outputs**:
- `john.smith@example.com` → `j***h@example.com`
- `ab@test.org` → `***@test.org`

---

## 5. Endpoint Verification

**Endpoint Used**: `GET /api/runs/:id/responses`

**Router Mount** (server/routes.ts:584):
```typescript
app.use('/api/runs', stakeholderRunsRouter);
```

**Authorization**: 
- Requires authentication via `requireAuth` middleware
- Tenant owners can view all responses for runs they own (via `ctx.isTenantOwner` check)

**Response Shape** (for tenant owners):
```json
{
  "ok": true,
  "responses": [
    {
      "id": "uuid",
      "response_type": "confirm" | "request_change" | "question",
      "message": "optional message text",
      "responded_at": "2026-01-25T10:00:00Z",
      "stakeholder_individual_id": "uuid",
      "stakeholder_name": "John Smith",
      "stakeholder_email": "john@example.com"
    }
  ]
}
```

---

## 6. Copy Tokens Added

**File**: `client/src/copy/entryPointCopy.ts`

```typescript
// STEP 11C Phase 2C-1.1: Stakeholder Responses Panel
'provider.run.responses.title': 'Stakeholder responses',
'provider.run.responses.empty': 'No stakeholder responses yet.',
'provider.run.responses.loading': 'Loading responses…',
'provider.run.responses.badge.confirm': 'Confirmed',
'provider.run.responses.badge.request_change': 'Request change',
'provider.run.responses.badge.question': 'Question',
'provider.run.responses.identity.fallback': 'Stakeholder',
```

---

## 7. Terminology Compliance Check

| Term | Status |
|------|--------|
| service provider | ✅ Used |
| reservation | ✅ Used |
| stakeholder | ✅ Used |
| booking | ❌ NOT used |
| contractor | ❌ NOT used |
| calendar | ❌ NOT used |

**PASS** — All terminology compliant with TERMINOLOGY_CANON.md v3.

---

## 8. Test IDs Added

| Test ID | Element |
|---------|---------|
| `card-stakeholder-responses` | Responses card container |
| `badge-responses-count` | Count badge in title |
| `text-responses-loading` | Loading state message |
| `text-no-responses` | Empty state message |
| `list-stakeholder-responses` | Responses list container |
| `response-item-${id}` | Individual response row |
| `text-response-identity` | Stakeholder display name |
| `badge-response-type` | Response type badge |
| `text-response-time` | Response timestamp |
| `text-response-message` | Response message text |

---

## 9. Done Criteria Checklist

- [x] ProviderRunDetailPage shows "Stakeholder responses" card
- [x] Responses load via `GET /api/runs/:id/responses`
- [x] Identity displayed safely with masking fallback
- [x] Empty state displays "No stakeholder responses yet."
- [x] Loading state displays with spinner
- [x] Response type badges (Confirmed/Request change/Question)
- [x] Timestamps formatted properly
- [x] Messages displayed when present
- [x] Copy tokens added to entryPointCopy.ts
- [x] Test IDs added for all interactive/display elements
- [x] Proof document exists under proof/v3.5/

---

## Files Modified

1. `client/src/pages/app/provider/ProviderRunDetailPage.tsx`
   - Added `StakeholderResponse` interface
   - Added `maskEmail()` helper function
   - Added `useQuery` for responses endpoint
   - Added Stakeholder Responses Card UI

2. `client/src/copy/entryPointCopy.ts`
   - Added 7 copy tokens for responses panel

---

**PHASE 2C-1.1 CERTIFIED** ✓
