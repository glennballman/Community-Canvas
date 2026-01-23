# V3.5 STEP 5 — Run Publishing Audit

**Date**: 2026-01-23  
**Status**: BLOCKED — Schema additions required

============================================================
## A1) Portal Inventory Discovery
============================================================

**Table**: `cc_portals`

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NO | Primary key |
| owning_tenant_id | uuid | YES | Tenant isolation FK |
| name | text | NO | Display name |
| slug | text | NO | URL-safe identifier |
| status | USER-DEFINED | NO | Lifecycle status |
| primary_audience | USER-DEFINED | NO | Audience type |
| is_active | boolean | YES | Active flag |
| default_zone_id | uuid | YES | Default zone FK |

**Tenant Isolation**: `owning_tenant_id` column exists for tenant scoping.

============================================================
## A2) Existing Run→Portal Publication Discovery
============================================================

### Current State

**cc_n3_runs schema**:
| Column | Type | Nullable |
|--------|------|----------|
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

### Finding: SINGLE-PORTAL ONLY

- cc_n3_runs has a single `portal_id` column
- **NO multi-portal publication join table exists**
- Existing publication tables are for jobs, not runs:
  - `cc_job_embed_publications`
  - `cc_job_channel_publications`
  - `cc_paid_publication_intents`

### Required for STEP 5

A join table is needed to support multi-portal publishing:

```sql
CREATE TABLE cc_run_portal_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES cc_n3_runs(id) ON DELETE CASCADE,
  portal_id UUID NOT NULL REFERENCES cc_portals(id) ON DELETE CASCADE,
  published_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(run_id, portal_id)
);
```

============================================================
## A3) Tenant Isolation Enforcement
============================================================

**Verified** in `server/routes/provider.ts`:

```typescript
// Line 16
ctx?: { tenant_id: string | null };

// Lines 318, 404
const tenantId = req.ctx?.tenant_id;

// Lines 368, 433
WHERE r.tenant_id = $1
```

Tenant isolation is enforced via `req.ctx?.tenant_id` from global middleware.

============================================================
## A4) market_mode Column Check
============================================================

### Finding: COLUMN DOES NOT EXIST

Query result for `cc_n3_runs.market_mode`:
```
(empty - no rows returned)
```

**The `market_mode` column is MISSING from cc_n3_runs.**

Per prompt instructions: **STOP and document (do not create)**

============================================================
## BLOCKER SUMMARY
============================================================

### Missing Schema Elements

1. **cc_n3_runs.market_mode** column
   - Required values: OPEN | INVITE_ONLY | CLOSED
   - Default: INVITE_ONLY
   
2. **cc_run_portal_publications** table
   - Required for multi-portal publishing
   - Current `portal_id` column only supports single portal

### Decision Required

Before proceeding with STEP 5 implementation:

- [ ] Add `market_mode` column to cc_n3_runs
- [ ] Create cc_run_portal_publications join table
- [ ] OR: Confirm we should modify approach to use existing portal_id column

============================================================
## RECOMMENDATION
============================================================

**Option A**: Add missing schema (preferred)
- Add market_mode column: `ALTER TABLE cc_n3_runs ADD COLUMN market_mode TEXT DEFAULT 'INVITE_ONLY'`
- Create cc_run_portal_publications table for multi-portal support

**Option B**: Single-portal only (limited)
- Use existing portal_id column
- Only supports publishing to ONE portal per run
- Does not meet STEP 5 spec for "multiple portals"

**Awaiting confirmation before proceeding.**

END.
