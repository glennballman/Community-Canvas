# V3.5 STEP 5 — Run Publishing Audit

**Date**: 2026-01-23  
**Status**: COMPLETE — Schema additions applied (STEP 5A)

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

### Before STEP 5A

**cc_n3_runs schema** (pre-migration):
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

### Finding: SINGLE-PORTAL ONLY (pre-migration)

- cc_n3_runs had only a single `portal_id` column
- No multi-portal publication join table existed

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

### Pre-Migration Status: MISSING
### Post-Migration Status: PRESENT ✅

============================================================
## Schema Additions (STEP 5A) — COMPLETE
============================================================

### Migration File
`server/migrations/172_run_publishing_schema.sql`

### SQL Executed

```sql
-- 1) Add market_mode column
ALTER TABLE cc_n3_runs 
ADD COLUMN IF NOT EXISTS market_mode TEXT DEFAULT 'INVITE_ONLY';

ALTER TABLE cc_n3_runs
ADD CONSTRAINT cc_n3_runs_market_mode_check 
CHECK (market_mode IN ('OPEN', 'INVITE_ONLY', 'CLOSED'));

-- 2) Create multi-portal publication join table
CREATE TABLE IF NOT EXISTS cc_run_portal_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES cc_n3_runs(id) ON DELETE CASCADE,
  portal_id UUID NOT NULL REFERENCES cc_portals(id) ON DELETE CASCADE,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_by_party_id UUID REFERENCES cc_parties(id),
  unpublished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, run_id, portal_id)
);

-- 3) Indexes
CREATE INDEX idx_run_portal_publications_run_id ON cc_run_portal_publications(run_id);
CREATE INDEX idx_run_portal_publications_portal_id ON cc_run_portal_publications(portal_id);
CREATE INDEX idx_run_portal_publications_tenant_id ON cc_run_portal_publications(tenant_id);
CREATE INDEX idx_run_portal_publications_active ON cc_run_portal_publications(run_id, portal_id) 
  WHERE unpublished_at IS NULL;

-- 4) RLS policies
ALTER TABLE cc_run_portal_publications ENABLE ROW LEVEL SECURITY;

CREATE POLICY cc_run_portal_publications_tenant_isolation ...
CREATE POLICY cc_run_portal_publications_service_bypass ...
```

### Verification Query Results

**market_mode column**:
```
 market_mode | text | 'INVITE_ONLY'::text
```

**CHECK constraint**:
```
 cc_n3_runs_market_mode_check | ((market_mode = ANY (ARRAY['OPEN'::text, 'INVITE_ONLY'::text, 'CLOSED'::text])))
```

**Join table columns**:
```
 id                    | uuid                     | NO
 tenant_id             | uuid                     | NO
 run_id                | uuid                     | NO
 portal_id             | uuid                     | NO
 published_at          | timestamp with time zone | NO
 published_by_party_id | uuid                     | YES
 unpublished_at        | timestamp with time zone | YES
 created_at            | timestamp with time zone | NO
```

**RLS status**:
```
 cc_run_portal_publications | t (enabled)
```

**Indexes**:
```
 cc_run_portal_publications_pkey
 cc_run_portal_publications_tenant_id_run_id_portal_id_key
 idx_run_portal_publications_run_id
 idx_run_portal_publications_portal_id
 idx_run_portal_publications_tenant_id
 idx_run_portal_publications_active
```

**RLS Policies**:
```
 cc_run_portal_publications_service_bypass
 cc_run_portal_publications_tenant_isolation
```

### Confirmation Checklist

- [x] market_mode column exists with CHECK constraint
- [x] cc_run_portal_publications table exists
- [x] RLS policies are active
- [x] Indexes are created
- [x] No other schema changes made

============================================================
## READY FOR STEP 5B
============================================================

Schema foundation is complete. Ready for implementation:
- POST /api/provider/runs/:id/publish endpoint
- Publish modal UI with portal selection + market mode

END.
