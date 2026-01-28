# PROMPT-17A Annex: PMS Authorization Lock

**Generated**: 2025-01-28  
**Type**: Targeted Remediation  
**Scope**: server/routes/pms.ts ONLY

---

## A. Route Inventory

Every PMS route now has explicit capability enforcement.

### Property Endpoints

| Method | Path | Capability | Evidence |
|--------|------|------------|----------|
| POST | `/portals/:slug/properties` | tenant.configure | pms.ts:52 |
| GET | `/portals/:slug/properties` | tenant.read | pms.ts:93 |
| GET | `/portals/:slug/properties/by-slug/:propertySlug` | tenant.read | pms.ts:111 |
| GET | `/portals/:slug/properties/:id` | tenant.read | pms.ts:127 |

### Unit Endpoints

| Method | Path | Capability | Evidence |
|--------|------|------------|----------|
| POST | `/portals/:slug/properties/:propertyId/units` | tenant.configure | pms.ts:145 |
| GET | `/portals/:slug/units/:id` | tenant.read | pms.ts:183 |
| POST | `/portals/:slug/units/:id/status` | tenant.configure | pms.ts:199 |

### Availability Endpoint

| Method | Path | Capability | Evidence |
|--------|------|------------|----------|
| GET | `/portals/:slug/availability` | tenant.read | pms.ts:221 |

### Reservation Endpoints

| Method | Path | Capability | Evidence |
|--------|------|------------|----------|
| POST | `/portals/:slug/reservations` | tenant.configure | pms.ts:250 |
| GET | `/portals/:slug/reservations` | tenant.read | pms.ts:286 |
| GET | `/portals/:slug/reservations/by-confirmation/:number` | tenant.read | pms.ts:310 |
| GET | `/portals/:slug/reservations/:id` | tenant.read | pms.ts:328 |
| POST | `/portals/:slug/reservations/:id/confirm` | tenant.configure | pms.ts:344 |
| POST | `/portals/:slug/reservations/:id/check-in` | tenant.configure | pms.ts:358 |
| POST | `/portals/:slug/reservations/:id/check-out` | tenant.configure | pms.ts:374 |
| POST | `/portals/:slug/reservations/:id/cancel` | tenant.configure | pms.ts:388 |

### Calendar Endpoints

| Method | Path | Capability | Evidence |
|--------|------|------------|----------|
| GET | `/portals/:slug/units/:unitId/calendar` | tenant.read | pms.ts:404 |
| POST | `/portals/:slug/units/:unitId/block` | tenant.configure | pms.ts:431 |
| POST | `/portals/:slug/units/:unitId/unblock` | tenant.configure | pms.ts:458 |
| POST | `/portals/:slug/reservations/:id/sync-calendar` | tenant.configure | pms.ts:481 |
| GET | `/portals/:slug/properties/:propertyId/calendar` | tenant.read | pms.ts:495 |

### Seasonal Rules Endpoints

| Method | Path | Capability | Evidence |
|--------|------|------------|----------|
| GET | `/portals/:slug/seasonal-rules` | tenant.read | pms.ts:522 |
| POST | `/portals/:slug/seasonal-rules` | tenant.configure | pms.ts:539 |
| PATCH | `/portals/:slug/seasonal-rules/:ruleId` | tenant.configure | pms.ts:574 |
| DELETE | `/portals/:slug/seasonal-rules/:ruleId` | tenant.configure | pms.ts:592 |

### Housekeeping Endpoints

| Method | Path | Capability | Evidence |
|--------|------|------------|----------|
| POST | `/portals/:slug/housekeeping` | tenant.configure | pms.ts:610 |
| GET | `/portals/:slug/housekeeping` | tenant.read | pms.ts:649 |
| GET | `/portals/:slug/housekeeping/:id` | tenant.read | pms.ts:676 |
| POST | `/portals/:slug/housekeeping/:id/assign` | tenant.configure | pms.ts:694 |
| POST | `/portals/:slug/housekeeping/:id/start` | tenant.configure | pms.ts:714 |
| POST | `/portals/:slug/housekeeping/:id/checklist` | tenant.configure | pms.ts:728 |
| POST | `/portals/:slug/housekeeping/:id/complete` | tenant.configure | pms.ts:749 |
| POST | `/portals/:slug/housekeeping/:id/inspect` | tenant.configure | pms.ts:770 |

### Maintenance Endpoints

| Method | Path | Capability | Evidence |
|--------|------|------------|----------|
| POST | `/portals/:slug/maintenance` | tenant.configure | pms.ts:795 |
| GET | `/portals/:slug/maintenance` | tenant.read | pms.ts:833 |
| GET | `/portals/:slug/maintenance/:id` | tenant.read | pms.ts:861 |
| POST | `/portals/:slug/maintenance/:id/status` | tenant.configure | pms.ts:881 |

---

## B. Fail-Closed Confirmation

### Authentication Gate (Router-Level)

```typescript
// pms.ts:35
router.use(authenticateToken);
```

All routes require JWT authentication. Missing or invalid tokens are rejected by `authenticateToken` middleware before any handler executes.

### Capability Check Pattern

Every route uses the `can()` function from `server/auth/authorize.ts`:

```typescript
if (!(await can(req, 'tenant.configure'))) {
  return denyCapability(res, 'tenant.configure');
}
```

### Denial Behavior

The `denyCapability` helper (pms.ts:42-48) returns standardized 403 responses:

```typescript
function denyCapability(res: Response, capability: string): Response {
  return res.status(403).json({
    error: 'Forbidden',
    code: 'NOT_AUTHORIZED',
    capability,
    reason: 'capability_not_granted'
  });
}
```

### Fail-Closed Semantics (from authorize.ts)

The `can()` function wraps `authorize()` and returns `false` on any error:

| Condition | Result | Reference |
|-----------|--------|-----------|
| Missing auth context | `deny` | authorize.ts:66-68 |
| No effective principal | `deny` | authorize.ts:78-80 |
| No scope resolved | `deny` | authorize.ts:101-102 |
| Capability not granted | `deny` | authorize.ts:128-129 |
| DB error | `deny` | authorize.ts:137-140 |

```typescript
// authorize.ts:147-158
export async function can(
  req: Request,
  capabilityCode: string,
  options: AuthorizeOptions = {}
): Promise<boolean> {
  try {
    await authorize(req, capabilityCode, options);
    return true;
  } catch {
    return false;  // Fail-closed: any error = deny
  }
}
```

---

## C. Constitutional Compliance Checklist

| Article | Status | Evidence |
|---------|--------|----------|
| Single Identity Authority | PASS | Uses `req.auth.effectivePrincipalId` from authorize.ts |
| Capability-First | PASS | All 37 routes gated with `can(req, capability)` |
| Fail-Closed | PASS | `can()` returns false on any error |
| No Parallel Systems | PASS | No role names, no isPlatformAdmin checks |
| No Scope Expansion | PASS | Only server/routes/pms.ts modified |

---

## D. Summary Statistics

| Category | Count |
|----------|-------|
| Total routes gated | 37 |
| Routes requiring tenant.read | 15 |
| Routes requiring tenant.configure | 22 |
| New capability codes added | 0 |
| Files modified | 1 (server/routes/pms.ts) |
| Database changes | 0 |
| Shared helpers added | 0 |

---

## E. Files Modified

**Only one file was modified as per PROMPT-17A requirements:**

- `server/routes/pms.ts` - Added capability enforcement to all 37 routes

**No other files were touched:**
- No schema changes
- No shared helpers
- No UI changes
- No database migrations
