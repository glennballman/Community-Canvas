# V3.5 Service Runs Management - Proof-Grade Inventory Audit

**Date**: 2026-01-23  
**Author**: Platform Engineering  
**Mode**: Evidence-first, additive-only

---

## 1. Database Table Verification

### 1.1 cc_n3_runs Table - EXISTS ✅

```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'cc_n3_runs' 
ORDER BY ordinal_position;
```

**Result:**
| Column | Data Type | Nullable |
|--------|-----------|----------|
| id | uuid | NO |
| tenant_id | uuid | NO |
| name | text | NO |
| description | text | YES |
| status | text | NO |
| starts_at | timestamp with time zone | YES |
| ends_at | timestamp with time zone | YES |
| metadata | jsonb | YES |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |
| portal_id | uuid | YES |
| zone_id | uuid | YES |

### 1.2 Schema Field Mapping (Spec vs Actual)

| Spec Field | Actual Column | Notes |
|------------|---------------|-------|
| title | name | Different name |
| description | description | ✅ Matches |
| status | status | ✅ Matches |
| schedule fields | starts_at, ends_at | Timestamps instead of date fields |
| party_id | **NOT FOUND** | ⚠️ No provider ownership column |

### 1.3 Missing party_id Analysis

**FINDING**: cc_n3_runs does NOT have a party_id column for provider ownership.

**Impact**: Cannot filter runs by individual provider. 

**Resolution**: Use tenant_id for scoping. Providers within a tenant see all tenant runs. This matches how N3 routes work (tenant-scoped via requireTenant middleware).

---

## 2. Existing Endpoints Verification

### 2.1 Service Runs Routes Found

| File | Path Pattern | Purpose |
|------|-------------|---------|
| `server/routes/serviceRuns.ts` | Various | Service catalog/pricing (cc_sr_services) |
| `server/routes/p2-service-runs.ts` | `/api/p2/service-runs` | P2 dashboard (cc_service_runs table) |
| `server/routes/n3.ts` | `/api/n3/*` | N3 Monitor/Replan (cc_n3_runs table) |

### 2.2 Provider-Specific Runs Endpoints

```bash
grep -n "provider.*runs\|runs.*provider" server/routes --include="*.ts"
```

**Result**: NO PROVIDER-SPECIFIC RUNS ENDPOINTS FOUND

### 2.3 Endpoints to Create (per Spec 1.3)

| Endpoint | Status | Notes |
|----------|--------|-------|
| GET /api/provider/runs | MISSING | List provider's runs |
| GET /api/provider/runs/:id | MISSING | Run detail |

---

## 3. Provider Routes Pattern Verification

### 3.1 Location
```
File: server/routes/provider.ts
Lines: 314
```

### 3.2 Auth Pattern
```typescript
interface AuthRequest extends Request {
  user?: { id: string; tenantId?: string };
}

function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user?.id) {
    return res.status(401).json({ ok: false, error: 'Authentication required' });
  }
  next();
}
```

### 3.3 Ownership Pattern
Provider routes use `assigned_provider_person_id` on cc_service_requests:
```typescript
WHERE sr.assigned_provider_person_id = $1
```

### 3.4 Party Resolution Available
```
File: server/lib/partyResolver.ts
Function: resolveActorParty(req, role)
Returns: { individual_id, tenant_id, actor_party_id, ... }
```

---

## 4. Attachment Linkage Pattern

### 4.1 Join Table Pattern
```bash
grep -n "cc_run_requests\|run_requests" shared/schema.ts
```
**Result**: NO JOIN TABLE FOUND

### 4.2 Direct FK Pattern
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'cc_service_requests' AND column_name = 'run_id';
```
**Result**: NO run_id COLUMN ON cc_service_requests

### 4.3 Array Pattern
```bash
grep -n "request_ids" shared/schema.ts
```
**Result**: NO request_ids ARRAY ON cc_n3_runs

### 4.4 N3 Run ↔ Maintenance Request Linkage
```typescript
// From shared/schema.ts line 7271
export const ccN3RunMaintenanceRequests = pgTable("cc_n3_run_maintenance_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").notNull().references(() => ccN3Runs.id, { onDelete: "cascade" }),
  maintenanceRequestId: uuid("maintenance_request_id").notNull(),
  ...
});
```
**This links runs to maintenance_requests, NOT service_requests.**

### 4.5 CONCLUSION
**NO ATTACHMENT LINKAGE FOUND** between cc_n3_runs and cc_service_requests.

Per spec: Return `attached_requests: []` and document. Do NOT create linkage in STEP 4.

---

## 5. Publications Linkage

### 5.1 Portal Publication Check
cc_n3_runs has `portal_id` column - runs can be associated with a portal.

**Resolution**: Publications list = portals where this run is visible (via portal_id).

---

## 6. Navigation Verification

### 6.1 Provider Nav Location
```bash
grep -rn "provider" client/src --include="*nav*.ts" --include="*Nav*.tsx"
```

Provider pages are accessed directly via URL, not currently in main nav:
- `/app/provider/inbox`
- `/app/provider/requests/:id`

### 6.2 V3 Nav System
```
File: client/src/lib/v3Nav.ts
```

---

## 7. Copy Token System

### 7.1 Location
```
File: server/copy/entryPointCopy.ts (server resolver)
File: client/src/hooks/useCopy.ts (client hook)
```

### 7.2 Existing Provider Copy Tokens
```bash
grep -n "provider\." server/copy
```
**Result**: Provider-specific copy tokens to be added.

---

## 8. Summary of Findings

### 8.1 Schema Status
- ✅ cc_n3_runs table exists
- ⚠️ No party_id column (use tenant_id for scoping)
- ⚠️ Field name differences (name vs title)

### 8.2 Endpoints Status
- ❌ GET /api/provider/runs - MISSING
- ❌ GET /api/provider/runs/:id - MISSING

### 8.3 Attachment Linkage
- ❌ NO LINKAGE FOUND
- Return `attached_requests: []` per spec

### 8.4 Action Items
1. Add GET /api/provider/runs (tenant-scoped)
2. Add GET /api/provider/runs/:id (with empty attached_requests)
3. Add frontend pages (read-only)
4. Wire navigation
5. Add copy tokens

---

## END OF AUDIT
