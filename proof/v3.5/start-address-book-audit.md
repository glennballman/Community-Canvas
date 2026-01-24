# V3.5 STEP 6.5B - Start Address Book Audit

Date: 2026-01-24
Status: AUDIT COMPLETE - PROCEED WITH IMPLEMENTATION

## A1) Confirm cc_n3_runs Exists and Lacks Start Address Fields

### Command
```bash
psql "$DATABASE_URL" -c "\d cc_n3_runs"
```

### Result
```
                              Table "public.cc_n3_runs"
   Column    |           Type           | Collation | Nullable |       Default       
-------------+--------------------------+-----------+----------+---------------------
 id          | uuid                     |           | not null | gen_random_uuid()
 tenant_id   | uuid                     |           | not null | 
 name        | text                     |           | not null | 
 description | text                     |           |          | 
 status      | text                     |           | not null | 'scheduled'::text
 starts_at   | timestamp with time zone |           |          | 
 ends_at     | timestamp with time zone |           |          | 
 metadata    | jsonb                    |           |          | '{}'::jsonb
 created_at  | timestamp with time zone |           | not null | now()
 updated_at  | timestamp with time zone |           | not null | now()
 portal_id   | uuid                     |           |          | 
 zone_id     | uuid                     |           |          | 
 market_mode | text                     |           |          | 'INVITE_ONLY'::text
```

**CONFIRMED:** cc_n3_runs has NO start_address_id or similar column. ✅

---

## A2) Confirm Tenant Isolation Pattern for RLS

### Command
```bash
psql "$DATABASE_URL" -c "SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'cc_run_portal_publications'"
```

### Result
```
                 policyname                  | cmd |                                 qual                                 
---------------------------------------------+-----+----------------------------------------------------------------------
 cc_run_portal_publications_service_bypass   | ALL | (current_setting('app.tenant_id'::text, true) = '__SERVICE__'::text)
 cc_run_portal_publications_tenant_isolation | ALL | ((tenant_id)::text = current_setting('app.tenant_id'::text, true))
```

**CONFIRMED:** RLS pattern uses:
- `tenant_id::text = current_setting('app.tenant_id', true)` for tenant isolation
- `current_setting('app.tenant_id', true) = '__SERVICE__'` for service mode bypass

✅ Pattern can be replicated for cc_tenant_start_addresses.

---

## A3) Confirm Copy Token File Location and Pattern

### Files Found
```
client/src/copy/index.ts       - Main exports
client/src/copy/useCopy.ts     - React hook for copy resolution
client/src/copy/entryPointCopy.ts - Entry point type definitions
client/src/copy/CopyResolver.ts - Resolution utilities
```

### Usage Pattern
```typescript
import { useCopy } from '@/copy/useCopy';
const { resolve, nouns, stateLabels } = useCopy({ entryPoint: 'service' });
```

**CONFIRMED:** Copy token system uses useCopy hook with entryPoint context. ✅

---

## A4) Confirm Provider Run Detail Page File Path

### File
```
client/src/pages/app/provider/ProviderRunDetailPage.tsx
```

### Current Structure (lines 30-45)
```typescript
interface ServiceRun {
  id: string;
  title: string;
  description: string | null;
  status: string;
  market_mode: string;
  starts_at: string | null;
  ends_at: string | null;
  portal_id: string | null;
  portal_name: string | null;
  zone_id: string | null;
  zone_name: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}
```

**CONFIRMED:** ProviderRunDetailPage exists at expected path. ✅

### Related Components
- `client/src/components/provider/PublishRunModal.tsx` - Publish modal
- `client/src/components/provider/AddRequestsModal.tsx` - Add requests modal

---

## AUDIT SUMMARY

| Check | Status |
|-------|--------|
| cc_n3_runs exists, no start_address_id | ✅ PASS |
| RLS pattern available (GUC-based) | ✅ PASS |
| Copy token system located | ✅ PASS |
| ProviderRunDetailPage found | ✅ PASS |

**PROCEED WITH IMPLEMENTATION**
