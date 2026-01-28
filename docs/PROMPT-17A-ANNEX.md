# PROMPT-17A Annex: PMS Authorization Lock

**Generated**: 2026-01-28  
**Type**: Targeted Remediation  
**Scope**: server/routes/pms.ts ONLY

---

## A. Route Inventory

Every PMS route now has explicit capability enforcement.

### Property Endpoints

| Method | Path | Capability | Evidence |
|--------|------|------------|----------|
| POST | `/portals/:slug/properties` | tenant.configure | pms.ts:56 |
| GET | `/portals/:slug/properties` | tenant.read | pms.ts:98 |
| GET | `/portals/:slug/properties/by-slug/:propertySlug` | tenant.read | pms.ts:120 |
| GET | `/portals/:slug/properties/:id` | tenant.read | pms.ts:139 |

### Unit Endpoints

| Method | Path | Capability | Evidence |
|--------|------|------------|----------|
| POST | `/portals/:slug/properties/:propertyId/units` | tenant.configure | pms.ts:160 |
| GET | `/portals/:slug/units/:id` | tenant.read | pms.ts:196 |
| POST | `/portals/:slug/units/:id/status` | tenant.configure | pms.ts:215 |

### Availability Endpoint

| Method | Path | Capability | Evidence |
|--------|------|------------|----------|
| GET | `/portals/:slug/availability` | tenant.read | pms.ts:238 |

### Reservation Endpoints

| Method | Path | Capability | Evidence |
|--------|------|------------|----------|
| POST | `/portals/:slug/reservations` | tenant.configure | pms.ts:268 |
| GET | `/portals/:slug/reservations` | tenant.read | pms.ts:308 |
| GET | `/portals/:slug/reservations/by-confirmation/:number` | tenant.read | pms.ts:334 |
| GET | `/portals/:slug/reservations/:id` | tenant.read | pms.ts:353 |
| POST | `/portals/:slug/reservations/:id/confirm` | tenant.configure | pms.ts:372 |
| POST | `/portals/:slug/reservations/:id/check-in` | tenant.configure | pms.ts:386 |
| POST | `/portals/:slug/reservations/:id/check-out` | tenant.configure | pms.ts:401 |
| POST | `/portals/:slug/reservations/:id/cancel` | tenant.configure | pms.ts:415 |

### Calendar Endpoints

| Method | Path | Capability | Evidence |
|--------|------|------------|----------|
| GET | `/portals/:slug/units/:unitId/calendar` | tenant.read | pms.ts:432 |
| POST | `/portals/:slug/units/:unitId/block` | tenant.configure | pms.ts:461 |
| POST | `/portals/:slug/units/:unitId/unblock` | tenant.configure | pms.ts:490 |
| POST | `/portals/:slug/reservations/:id/sync-calendar` | tenant.configure | pms.ts:516 |
| GET | `/portals/:slug/properties/:propertyId/calendar` | tenant.read | pms.ts:531 |

### Seasonal Rules Endpoints

| Method | Path | Capability | Evidence |
|--------|------|------------|----------|
| GET | `/portals/:slug/seasonal-rules` | tenant.read | pms.ts:559 |
| POST | `/portals/:slug/seasonal-rules` | tenant.configure | pms.ts:576 |
| PATCH | `/portals/:slug/seasonal-rules/:ruleId` | tenant.configure | pms.ts:612 |
| DELETE | `/portals/:slug/seasonal-rules/:ruleId` | tenant.configure | pms.ts:629 |

### Housekeeping Endpoints

| Method | Path | Capability | Evidence |
|--------|------|------------|----------|
| POST | `/portals/:slug/housekeeping` | tenant.configure | pms.ts:647 |
| GET | `/portals/:slug/housekeeping` | tenant.read | pms.ts:685 |
| GET | `/portals/:slug/housekeeping/:id` | tenant.read | pms.ts:711 |
| POST | `/portals/:slug/housekeeping/:id/assign` | tenant.configure | pms.ts:730 |
| POST | `/portals/:slug/housekeeping/:id/start` | tenant.configure | pms.ts:750 |
| POST | `/portals/:slug/housekeeping/:id/checklist` | tenant.configure | pms.ts:764 |
| POST | `/portals/:slug/housekeeping/:id/complete` | tenant.configure | pms.ts:784 |
| POST | `/portals/:slug/housekeeping/:id/inspect` | tenant.configure | pms.ts:806 |

### Maintenance Endpoints

| Method | Path | Capability | Evidence |
|--------|------|------------|----------|
| POST | `/portals/:slug/maintenance` | tenant.configure | pms.ts:828 |
| GET | `/portals/:slug/maintenance` | tenant.read | pms.ts:865 |
| GET | `/portals/:slug/maintenance/:id` | tenant.read | pms.ts:891 |
| POST | `/portals/:slug/maintenance/:id/status` | tenant.configure | pms.ts:910 |

---

## B. Fail-Closed Confirmation

### Per-Route Capability Pattern

**Read operations (tenant.read):**
```typescript
if (!(await can(req, 'tenant.read'))) {
  return denyCapability(res, 'tenant.read');
}
```

**Mutating operations (tenant.configure):**
```typescript
if (!(await can(req, 'tenant.configure'))) {
  return denyCapability(res, 'tenant.configure');
}
```

### Evidence References

- **Router-level auth gate:** `router.use(authenticateToken);` — line 38
- **denyCapability helper:** lines 44–51
- **First can() check (POST properties):** line 56 — first executable statement in handler
- **First can() check (GET properties):** line 98 — first executable statement in handler
- **Fail-closed semantics:** `can()` returns `false` on `authorize()` throw
- **403 payload:** Matches canonical shape per AUTH_CONSTITUTION.md §8a

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
