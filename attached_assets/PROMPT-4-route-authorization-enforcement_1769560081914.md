# ================================================================================
# PROMPT-4 — APPLICATION ROUTE AUTHORIZATION ENFORCEMENT
# GOVERNED BY: AUTH_CONSTITUTION.md
# ANNEX REQUIRED: AUTH_CONSTITUTION_PROMPT_4_ANNEX.md (PASS/FAIL EVIDENCE)
#
# THIS PROMPT WIRES EXISTING AUTHORIZATION — IT DOES NOT CREATE NEW AUTH LOGIC.
#
# Non-Negotiable Rules:
# 1. resolvePrincipalFromSession() is the ONLY identity authority.
# 2. All protected routes MUST use requireCapability() or authorize().
# 3. No role checks, no string checks, no admin booleans.
# 4. Authorization MUST be fail-closed.
# 5. All allow/deny decisions MUST be audit logged.
# 6. Impersonation = actor substitution ONLY.
# 7. RLS remains authoritative.
# 8. Annex checklist MUST be returned with file+line evidence.
#
# If any rule cannot be met, STOP and report FAILURE.
# ================================================================================

---

# PROMPT-4: Application-Layer Route Authorization Enforcement

## ROLE
Senior Platform Architect + Route Security Engineer

## PURPOSE

PROMPT-4 wires the already-implemented authorization engine (PROMPT-3) into the actual Express application routes.

- **No schema changes**
- **No new auth logic**
- **No refactors**

This is **pure enforcement wiring**.

---

## PREREQUISITES

Before starting, verify these PROMPT-3 deliverables exist:

| Component | Location | Must Exist |
|-----------|----------|------------|
| `authContextMiddleware` | server/auth/context.ts | ✅ |
| `authorize()` | server/auth/authorize.ts | ✅ |
| `requireCapability()` | server/auth/authorize.ts | ✅ |
| `resolvePrincipalFromSession()` | server/auth/principal.ts | ✅ |
| `resolveTenantScopeId()` | server/auth/scope.ts | ✅ |
| `resolveResourceTypeScopeId()` | server/auth/scope.ts | ✅ |
| `cc_has_capability()` | Database function | ✅ |

**If any are missing, STOP and report. Do not invent replacements.**

---

## STEP 1 — GLOBAL MIDDLEWARE WIRING

**File:** `server/index.ts` (or main Express bootstrap)

### REQUIRED ACTIONS

1. Mount `authContextMiddleware` **before** any API routes
2. No routes may bypass this middleware

### ACCEPTABLE PATTERN

```typescript
import { authContextMiddleware } from './auth/context';

// Auth context MUST run before routes
app.use(authContextMiddleware);

// Then mount API routes
app.use('/api', apiRouter);
```

### FORBIDDEN

- ❌ Per-route identity resolution
- ❌ Inline session checks
- ❌ Skipping middleware for "trusted" routes
- ❌ Any `if (req.session?.user)` checks in route handlers

---

## STEP 2 — PLATFORM ROUTES

**Files:** `server/routes/platform/*.ts`, `server/routes/admin/*.ts`

### REQUIRED

All platform routes MUST be gated by capability checks.

```typescript
import { requireCapability } from '../auth/authorize';

// Platform tenant management
router.get('/platform/tenants', 
  requireCapability('platform.users.manage'),
  listTenantsHandler
);

router.post('/platform/tenants',
  requireCapability('platform.configure'),
  createTenantHandler
);

// Admin impersonation
router.post('/admin/impersonation/start',
  requireCapability('platform.users.manage'),
  startImpersonationHandler
);
```

### FORBIDDEN

- ❌ `if (user.isPlatformAdmin)`
- ❌ `if (req.user?.role === 'admin')`
- ❌ `if (ctx.is_platform_admin)`
- ❌ Any string or boolean admin logic

### GREP CHECK (must return empty)

```bash
grep -rn "isPlatformAdmin" server/routes/
grep -rn "is_platform_admin" server/routes/
grep -rn "role === 'admin'" server/routes/
grep -rn "role === 'platform'" server/routes/
```

---

## STEP 3 — TENANT ROUTES

**Files:** `server/routes/tenant/*.ts`, `server/routes/settings/*.ts`

### REQUIRED

1. Resolve tenant scope via `resolveTenantScopeId()`
2. Gate every mutating or sensitive read route

```typescript
import { authorize, requireCapability } from '../auth/authorize';
import { resolveTenantScopeId } from '../auth/scope';

// Tenant settings
router.get('/tenant/:tenantId/settings',
  requireCapability('tenant.configure'),
  getSettingsHandler
);

router.put('/tenant/:tenantId/settings',
  requireCapability('tenant.configure'),
  updateSettingsHandler
);

// Team management
router.post('/tenant/:tenantId/members',
  requireCapability('tenant.users.manage'),
  addMemberHandler
);

router.delete('/tenant/:tenantId/members/:memberId',
  requireCapability('tenant.users.manage'),
  removeMemberHandler
);
```

### FORBIDDEN

- ❌ Tenant role assumptions (`if (membership.role === 'owner')`)
- ❌ Implicit access based on membership existence
- ❌ `if (isTenantAdmin(user, tenantId))`

---

## STEP 4 — RESOURCE-LEVEL ROUTES

**Files:** Routes for reservations, service_runs, projects, bids, assets, people, jobs, folios, etc.

### REQUIRED

1. Resolve resource scope when accessing specific resources
2. Enforce `{domain}.own.*` vs `{domain}.all.*` pattern
3. Use `authorize()` with appropriate capability

### PATTERN: List All (requires .read capability)

```typescript
// List all reservations in tenant
router.get('/reservations',
  requireCapability('reservations.read'),
  async (req, res) => {
    // RLS will further filter based on tenant
    const result = await pool.query(
      'SELECT * FROM cc_reservations WHERE tenant_id = $1',
      [req.auth.tenantId]
    );
    res.json({ ok: true, reservations: result.rows });
  }
);
```

### PATTERN: Get Single (requires .read OR .own.read)

```typescript
// Get single reservation
router.get('/reservations/:id',
  async (req, res) => {
    // Check if user has all-read OR own-read
    try {
      await authorize(req, 'reservations.read');
    } catch {
      // Fall back to own-read (will verify ownership)
      await authorize(req, 'reservations.own.read', {
        resourceType: 'reservation',
        resourceId: req.params.id
      });
    }
    // ... fetch and return
  }
);
```

### PATTERN: Create (requires .create capability)

```typescript
router.post('/reservations',
  requireCapability('reservations.create'),
  createReservationHandler
);
```

### PATTERN: Update (requires .update OR .own.update)

```typescript
router.patch('/reservations/:id',
  async (req, res) => {
    try {
      await authorize(req, 'reservations.update');
    } catch {
      await authorize(req, 'reservations.own.update', {
        resourceType: 'reservation',
        resourceId: req.params.id
      });
    }
    // ... update
  }
);
```

### PATTERN: Delete (requires .delete or domain-specific)

```typescript
router.delete('/reservations/:id',
  requireCapability('reservations.cancel'),
  cancelReservationHandler
);
```

---

## STEP 5 — FINANCIAL ROUTES (HIGH-RISK)

**Files:** Routes for folios, wallets, payments, pricing

### REQUIRED

Financial data is sensitive. Gate ALL reads and writes.

```typescript
// View folios
router.get('/folios',
  requireCapability('folios.read'),
  listFoliosHandler
);

// View single folio
router.get('/folios/:id',
  requireCapability('folios.read'),
  getFolioHandler
);

// Post charge
router.post('/folios/:id/charges',
  requireCapability('folios.charge'),
  postChargeHandler
);

// Process refund (high-risk)
router.post('/folios/:id/refunds',
  requireCapability('folios.refund'),
  processRefundHandler
);

// View wallets
router.get('/wallets',
  requireCapability('wallets.read'),
  listWalletsHandler
);
```

---

## STEP 6 — SERVICE RUN ROUTES

**Files:** Routes for cc_n3_runs (canonical service runs table)

```typescript
// List service runs
router.get('/service-runs',
  requireCapability('service_runs.read'),
  listServiceRunsHandler
);

// Create service run
router.post('/service-runs',
  requireCapability('service_runs.create'),
  createServiceRunHandler
);

// Dispatch service run
router.post('/service-runs/:id/dispatch',
  requireCapability('service_runs.dispatch'),
  dispatchServiceRunHandler
);

// Complete service run (own)
router.post('/service-runs/:id/complete',
  async (req, res) => {
    try {
      await authorize(req, 'service_runs.complete');
    } catch {
      await authorize(req, 'service_runs.own.complete', {
        resourceType: 'service_run',
        resourceId: req.params.id
      });
    }
    // ... complete
  }
);
```

---

## STEP 7 — IMPERSONATION ENFORCEMENT

### REQUIRED

1. All authorization checks use `effective_principal_id`
2. No impersonation bypass logic anywhere
3. Audit logs record BOTH `principal_id` AND `effective_principal_id`

### VERIFY IN authorize()

```typescript
// authorize() must use effective principal
const result = await pool.query(
  'SELECT cc_has_capability($1, $2, $3, $4, $5)',
  [
    req.auth.effectivePrincipalId,  // NOT principalId
    capabilityCode,
    scopeId,
    resourceId,
    resourceType
  ]
);
```

### FORBIDDEN

- ❌ `if (req.auth.isImpersonating) { /* bypass */ }`
- ❌ Special impersonation permissions
- ❌ UI-driven impersonation exceptions

---

## STEP 8 — AUDIT LOG VALIDATION

### REQUIRED

Every authorization decision (allow AND deny) MUST log:

| Field | Required | Source |
|-------|----------|--------|
| `principal_id` | ✅ | `req.auth.principalId` |
| `effective_principal_id` | ✅ | `req.auth.effectivePrincipalId` |
| `capability_code` | ✅ | The capability being checked |
| `scope_id` | ✅ | Resolved scope |
| `decision` | ✅ | 'allow' or 'deny' |
| `reason` | ✅ | Why allowed/denied |
| `route` | ✅ | `req.originalUrl` |
| `method` | ✅ | `req.method` |

### VERIFY

```sql
-- After testing, verify audit logs have both principals
SELECT 
  principal_id,
  effective_principal_id,
  capability_code,
  decision,
  reason
FROM cc_auth_audit_log
ORDER BY created_at DESC
LIMIT 10;
```

---

## STEP 9 — LEGACY CHECK ELIMINATION

### REQUIRED GREP CHECKS (all must return empty or only false positives)

```bash
# No role string checks
grep -rn "role ===" server/routes/
grep -rn "role ===" server/services/
grep -rn "'admin'" server/routes/ | grep -v capability
grep -rn "'owner'" server/routes/ | grep -v capability

# No tenant_admin string logic
grep -rn "tenant_admin" server/routes/ | grep -v capability

# No isPlatformAdmin checks
grep -rn "isPlatformAdmin" server/
grep -rn "is_platform_admin" server/

# No isTenantAdmin helper
grep -rn "isTenantAdmin" server/
```

---

## STEP 10 — TEST COVERAGE

### REQUIRED TESTS

Add or update tests to verify:

1. **Route denies without capability**
```typescript
it('denies access without capability', async () => {
  const res = await request(app)
    .get('/api/reservations')
    .set('Authorization', `Bearer ${limitedWorkerToken}`);
  
  expect(res.status).toBe(403);
  expect(res.body.code).toBe('CAPABILITY_DENIED');
});
```

2. **Route allows with capability**
```typescript
it('allows access with capability', async () => {
  const res = await request(app)
    .get('/api/reservations')
    .set('Authorization', `Bearer ${reservationManagerToken}`);
  
  expect(res.status).toBe(200);
});
```

3. **Impersonation audit logging**
```typescript
it('logs both principals when impersonating', async () => {
  // Start impersonation, make request, verify audit log
  const auditLog = await getLatestAuditLog();
  expect(auditLog.principal_id).not.toBe(auditLog.effective_principal_id);
});
```

---

## VERIFICATION CHECKLIST

Before completing, verify:

| Check | Status |
|-------|--------|
| `authContextMiddleware` mounted globally | ☐ |
| All `/api/platform/*` routes gated | ☐ |
| All `/api/admin/*` routes gated | ☐ |
| All tenant settings routes gated | ☐ |
| All resource write routes gated | ☐ |
| All financial read routes gated | ☐ |
| No `isPlatformAdmin` checks remain | ☐ |
| No role string checks remain | ☐ |
| Audit logs include both principals | ☐ |
| Tests pass | ☐ |

---

## REQUIRED OUTPUT

Replit MUST return:

1. **AUTH_CONSTITUTION_PROMPT_4_ANNEX.md** filled out with:
   - PASS/FAIL for each item
   - File paths + line numbers as evidence
   - Grep output showing no legacy checks

2. **Confirmation** that no constitutional violations occurred

---

## COMPLETION RULE

**PROMPT-4 is NOT COMPLETE unless:**

- ✅ All protected routes are gated with capability checks
- ✅ No role/string checks remain
- ✅ Annex shows PASS on all items
- ✅ Grep checks return empty (or explained false positives)

**If not → STOP. Do not proceed to PROMPT-5.**
