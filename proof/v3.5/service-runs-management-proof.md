# V3.5 Service Runs Management (Provider Phase 2) - Proof Document

**Date**: 2026-01-23  
**Feature**: STEP 4 - Service Runs Management  
**Status**: ✅ COMPLETE

## Summary

Provider Phase 2 adds read-only service runs management capabilities for service providers. Providers can now view a list of their organization's runs and navigate to individual run details.

## Implementation Details

### Backend Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/provider/runs` | GET | List provider's tenant-scoped runs |
| `/api/provider/runs/:id` | GET | Get run detail with empty attached_requests/publications |

**File**: `server/routes/provider.ts`

### Frontend Pages

| Page | Path | Purpose |
|------|------|---------|
| ProviderRunsPage | `/app/provider/runs` | List view with status filters, search |
| ProviderRunDetailPage | `/app/provider/runs/:id` | Read-only run detail view |

**Files**:
- `client/src/pages/app/provider/ProviderRunsPage.tsx`
- `client/src/pages/app/provider/ProviderRunDetailPage.tsx`

### Navigation

Added "Provider" section to V3 nav with:
- Inbox → `/app/provider/inbox`
- My Runs → `/app/provider/runs`

**File**: `client/src/lib/routes/v3Nav.ts`

### Route Registration

Routes wired in `client/src/App.tsx`:
- `/app/provider/runs` → ProviderRunsPage
- `/app/provider/runs/:id` → ProviderRunDetailPage

## Schema Constraints

Per audit (`proof/v3.5/service-runs-management-audit.md`):

1. **No party_id column** in cc_n3_runs - runs are scoped by tenant_id (organization-level)
2. **No request linkage table** - attached_requests returns empty array per spec
3. **Publications**: Derived from portal_id on cc_n3_runs

## Copy Tokens

Using existing copy tokens via `useCopy({ entryPoint: 'service' })`:
- `label.noun.run` → "service run"
- `label.noun.provider` → "provider"

No new tokens required.

## Security

- All endpoints require authenticated session
- Tenant context enforced via `getProviderContext()` middleware pattern
- MarketMode gating applied to provider routes

## Testing Checklist

- [x] `/app/provider/runs` renders run list with filters
- [x] `/app/provider/runs/:id` renders run detail
- [x] Navigation shows Provider section with Inbox and My Runs
- [x] Auth protection on all provider routes
- [x] Copy tokens resolve correctly

## Files Changed

1. `server/routes/provider.ts` - Added GET /runs and GET /runs/:id
2. `client/src/pages/app/provider/ProviderRunsPage.tsx` - New list page
3. `client/src/pages/app/provider/ProviderRunDetailPage.tsx` - New detail page
4. `client/src/lib/routes/v3Nav.ts` - Added Provider nav section
5. `client/src/App.tsx` - Added provider/runs routes
