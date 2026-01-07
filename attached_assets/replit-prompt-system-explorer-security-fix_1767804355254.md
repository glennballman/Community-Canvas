# PROMPT: EVIDENCE RULE ENFORCEMENT — System Explorer Placement + Inspect Proof Lock

You are working in Community Canvas (Replit dev).

**SECURITY CONCERN:** System Explorer is appearing in tenant navigation. This is a Platform Admin tool that could expose cross-tenant data. This must be fixed immediately.

---

## NON-NEGOTIABLE EVIDENCE RULE

You may not claim "fixed" unless you provide:

1. **Screenshot proof** (Platform Admin nav WITH System Explorer, tenant nav WITHOUT)
2. **Working Inspect proof** (click Inspect on 2 different tables and show rows render)
3. **QA script proof** (a script asserts both gates)

**If you cannot produce those, you must say "NOT FIXED."**

---

## A) FIX PLACEMENT (STRICT) — SECURITY CRITICAL

### A1. System Explorer must be Platform Admin ONLY

- Route stays: `/admin/system-explorer`
- Nav item must appear ONLY in `PLATFORM_ADMIN_NAV` under Data Management near "Inventory (Audit)"
- **Remove System Explorer from ALL tenant navs:**
  - `BUSINESS_NAV`
  - `COMMUNITY_NAV`
  - Any other tenant nav config

### A2. Hide System Explorer while impersonating

Even if the logged-in actor is platform admin, if `isImpersonating === true` then:

- Hide System Explorer from left nav
- Block direct access to `/admin/system-explorer` with a friendly message:
  > "Exit impersonation to use System Explorer."

(We can allow override later; for now, hard block.)

### Required proof

- **Screenshot #1:** Platform Admin nav shows "System Explorer"
- **Screenshot #2:** Tenant nav (while impersonating) does NOT show "System Explorer"
- **Screenshot #3:** Visiting `/admin/system-explorer` while impersonating shows the block message

---

## B) FIX INSPECT BEHAVIOR (NO TENANT ROUTE LINKS)

System Explorer is a Platform Admin tool. It must never deep link into `/app/*` tenant routes unless it also switches tenant context.

### B1. Remove/ban all "View" links to /app/*

- No "View Inventory", "View Bookings", etc.
- Only allow "Inspect Data" inside System Explorer (Data Browser tab)

### B2. Data Browser must render rows (this is the entire point)

When I click "Inspect Data" from Overview or Data Sources:
1. The Data Browser tab must open
2. The selected table must be set
3. It must fetch and render rows (even if empty) with a clear empty state

If the table requires tenant context:
- Provide a tenant selector (platform admin can choose tenant to scope query)
- Default to currently selected tenant (or "All tenants" where safe)

### Data Browser minimum spec

- Table dropdown (allowlisted)
- Optional tenant dropdown (if table has tenant_id)
- Row count + pagination
- Renders JSONB safely (collapsed)
- Column headers visible even when 0 rows

### Required proof

- **Screenshot #4:** Click "Inspect Data" on `service_runs` → Data Browser shows rows OR "0 rows" empty state with schema columns visible
- **Screenshot #5:** Click "Inspect Snapshots" on one feed source → Data Browser shows rows with JSON payload visible

---

## C) FIX DATA SOURCES TAB (DON'T LIE WITH "NO TABLE")

Data Sources must show:
- Which underlying table(s) power each source
- Record counts
- `last_updated`
- "Inspect Snapshots" opens Data Browser on correct table + filtered

If a source has no backing table, it must show:
- `status = NOT WIRED`
- `reason = "no table found"`
- Suggested path

**No "No Table" on sources that clearly are wired.**

### Required proof

- **Screenshot #6:** Data Sources tab shows correct record counts for all wired sources
- **Screenshot #7:** Inspect Snapshots opens the correct rows

---

## D) QA GATE (STOP REGRESSIONS)

Update `scripts/qa-smoke-test.ts` (or add `scripts/qa-evidence-gate.ts`) to assert:

### Gate 1 — Placement

- When in platform admin, not impersonating: left nav contains "System Explorer"
- When impersonating a tenant: left nav does NOT contain "System Explorer"

### Gate 2 — Inspect Works

- Visit `/admin/system-explorer`
- Click Inspect on at least one table
- Assert at least one row renders OR explicit empty state text appears
- No redirects to `/app`

**The script must FAIL if any gate fails.**

### Required proof

- Paste QA output showing PASS for both gates

---

## E) ADD CONTEXT BADGE (PREVENTS CONFUSION)

Add a small badge in System Explorer header showing:

```
Mode: Platform Admin | Scope: All Tenants
```

or when tenant is selected:

```
Mode: Platform Admin | Scope: Tenant = Bamfield Adventure Center
```

This prevents "why is it empty" confusion.

---

## F) DELIVERABLES

Output:
1. Files changed list
2. The exact nav config location(s)
3. Screenshots #1–#7
4. QA script output

---

## SECURITY SUMMARY

| Risk | Fix |
|------|-----|
| System Explorer in tenant nav | Remove from BUSINESS_NAV, COMMUNITY_NAV |
| Cross-tenant data exposure | Tenant selector for scoped queries |
| Accidental access while impersonating | Block with message |
| Silent regression | QA gate fails on nav changes |

BEGIN.
