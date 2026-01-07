# PROMPT H — System Explorer (Discovery Surface) + Nav Lock + Proof Rules

You are working in Community Canvas (Replit dev). We have a recurring failure pattern:

- Subsystems are implemented but not discoverable (no UI entry point)
- Nav links get removed during unrelated changes, making features "gone forever"
- There is no canonical place to see integrations, feeds, catalogs, inventories, service runs, etc.

## GOAL

Create a **permanent, tenant-safe System Explorer** that makes the entire system discoverable and testable.

This is NOT a new product feature. This is a **debug/discovery surface** and must be treated as **infrastructure**.

---

## NON-NEGOTIABLE RULES

- Do NOT redesign the app.
- Do NOT rename existing routes.
- Do NOT remove any nav items.
- Add exactly ONE permanent nav item: **System Explorer**.
- All new pages are **read-only**.
- Must include proof: UI screenshots + API outputs + file list + smoke test updates.

---

## STEP 0 — FIND THE CANONICAL NAV REGISTRY

Identify where the left nav is defined (likely a single config file or component).

We need:
- One source of truth for nav structure (no scattered links across components)
- A minimal regression guard so Bookings/Inventory/etc can't silently disappear

**Report:**
- File path(s) for nav config
- How routes are added today

---

## STEP 1 — ADD NAV ITEM: "System Explorer"

Add "System Explorer" to the left nav in a stable location:
- Between Operations and Work Requests (or near Inventory/Operations)

**Route:** `/app/system-explorer`

This link must be treated as **permanent infrastructure**.

---

## STEP 2 — SYSTEM EXPLORER PAGE (READ-ONLY)

Create a new page: `SystemExplorerPage.tsx` at `/app/system-explorer`.

It must have tabs:

### Tab A) Overview (the "truth table")

Show quick cards with:
- Current tenant + impersonation status
- Core object counts for this tenant:
  - Assets (unified_assets)
  - Bookings (unified_bookings)
  - Work Requests
  - Projects
  - Contacts
  - Organizations
  - Places
  - Conversations (if exists)
  - Portals (if exists)
  - Presentations (if exists)

Each card must have:
- Count
- "View" link to the relevant existing page (if it exists)
- "Inspect" link to a table viewer (see Tab D)

### Tab B) Integrations & APIs

List all integrations wired in this environment, with:
- Name (e.g., Firecrawl, Apify, DriveBC, BC Ferries, BC Hydro, etc.)
- Enabled/disabled
- Where configured (env var key names only, **do not show secrets**)
- Last run timestamp (if any job table exists)
- Status (OK / failing / unknown)
- "Test" button (calls a safe ping endpoint, or returns "not implemented" deterministically)

**Implementation sources:**
- Scan server config for known env var keys (presence only)
- Scan DB for integration tables if they exist
- Scan any jobs/task tables if they exist

### Tab C) Data Sources / Feeds

List all data sources:
- Source name
- Source type (scrape/feed/api/manual/import)
- Coverage region (if available)
- Last updated time + record count loaded
- Link to "Records" viewer filtered to that source (Tab D)

If feed tables don't exist, create a minimal `data_sources` registry table (tenant-safe) and backfill known sources.

### Tab D) Data Browser (Read-only)

A generic table viewer for approved tables ONLY (allowlist).

**Requirements:**
- Must be tenant-safe (always filters by tenant_id where applicable)
- Pagination + basic filters
- Show last 50 rows by default
- Export is optional; do not implement editing

**Allowlist examples:**
- unified_assets
- unified_bookings
- work_requests
- projects
- contacts
- organizations
- places
- portals + portal_domains + portal_theme (if present)
- entity_presentations + presentation_blocks (if present)
- service_runs (if present)
- road_trips (if present)
- crews (if present)
- timelines (if present)
- data_sources (if present)

If some of these tables do not exist, the browser should gracefully hide them.

### Tab E) Routes & Surfaces Audit

This tab exists to **prevent "built but hidden."**

Show:
- Key routes that exist in code (hardcoded list is fine)
- Whether they are linked in the left nav (YES/NO)
- Whether the route renders (smoke ping that returns 200/OK)

**At minimum include:**
- /app/dashboard
- /app/inventory
- /app/bookings
- /app/operations
- /app/work-requests
- /app/projects
- /app/places
- /app/contacts
- /app/organizations
- /app/conversations
- /app/settings
- /app/system-explorer

---

## STEP 3 — SERVER ENDPOINTS (MINIMAL)

Add one endpoint:

```
GET /api/admin/system-explorer/overview
```

Return:
- Counts per entity for current tenant
- Detected integrations (presence/unknown)
- Detected feeds/jobs (if tables exist)
- Nav audit results (if feasible)

**Do NOT create many endpoints; keep it simple.**

---

## STEP 4 — NAV REGRESSION LOCK (STOP LOSING LINKS)

Add one of the following:

**Option 1 (preferred):** A unit test or QA script assertion that the nav includes:
- Inventory
- Bookings
- Operations
- System Explorer

**Option 2:** Add a "nav snapshot" JSON and a script that diffs expected vs actual.

Update `scripts/qa-smoke-test.ts` (or create it) to include:
- Visit /app/system-explorer
- Confirm it renders counts
- Confirm nav contains Bookings + Inventory + Operations + System Explorer

---

## STEP 5 — PROOF REQUIREMENT

After implementation, output:

### Files changed list

### Screenshot(s):
1. Left nav showing System Explorer link
2. System Explorer Overview tab showing counts
3. Integrations tab showing detected items
4. Data Browser tab showing a table

### API output sample
```bash
curl /api/admin/system-explorer/overview
```

### QA script output
Confirming nav assertions pass.

---

## WHY THIS MATTERS

| Problem | Solution |
|---------|----------|
| Features built but hidden | System Explorer reveals everything |
| Nav links randomly deleted | Routes Audit tab catches it immediately |
| No idea what feeds exist | Data Sources tab lists them |
| No idea what integrations are wired | Integrations tab shows presence |
| Hours wasted finding things | 10 seconds in System Explorer |

---

## IMPLEMENTATION PRIORITY

This is **infrastructure**, not a feature. It should be:
- Built once
- Never deleted
- Updated as new subsystems are added

The System Explorer link in the nav should be treated like the Dashboard link - permanent.

BEGIN.
