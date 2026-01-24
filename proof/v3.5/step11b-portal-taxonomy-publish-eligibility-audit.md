# V3.5 STEP 11B-AUDIT: Portal Taxonomy, Brand Structure, and Publish Eligibility

**Date**: 2025-01-24  
**Mode**: READ-ONLY AUDIT — No code changes, no migrations, no data updates  
**Status**: COMPLETE

---

## SECTION A: PORTAL SCHEMA — TAXONOMY COLUMNS

### A1) Full Portal Table Definition (Key Columns)

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| owning_tenant_id | uuid | YES | - |
| name | text | NO | - |
| slug | text | NO | - |
| status | portal_status enum | NO | 'draft' |
| primary_audience | portal_audience_type enum | NO | 'traveler' |
| portal_type | text | YES | 'community' |
| is_active | boolean | YES | true |
| anchor_community_id | uuid | YES | - |

### A2) Taxonomy Columns Found

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name='cc_portals'
  AND (column_name ILIKE '%type%' OR column_name ILIKE '%audience%' OR column_name ILIKE '%is_%');
```

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| primary_audience | portal_audience_type (enum) | NO | 'traveler' |
| portal_type | text | YES | 'community' |
| is_active | boolean | YES | true |

### A3) portal_type CHECK Constraint

```sql
CHECK ((portal_type = ANY (ARRAY[
  'community'::text, 
  'facility'::text, 
  'jobs'::text, 
  'marketplace'::text, 
  'business_service'::text, 
  'platform'::text, 
  'experience_editorial'::text
])))
```

### A4) primary_audience Enum Values

```
host, traveler, worker, contractor, buyer, coordinator, admin
```

---

## SECTION B: FULL PORTAL LIST WITH ALL TAXONOMY FIELDS

| Portal | slug | status | portal_type | primary_audience | owning_tenant_id | owning_tenant_name | anchor_community |
|--------|------|--------|-------------|------------------|------------------|-------------------|------------------|
| AdrenalineCanada | adrenalinecanada | active | community | worker | NULL | (orphan) | Deep Cove |
| Bamfield Adventure Center | bamfield-adventure | active | business_service | traveler | 7ed7... | Bamfield Adventure Center | Bamfield |
| Bamfield Community Portal | bamfield | active | community | traveler | e000... | Bamfield Community | Bamfield |
| Bamfield QA Portal | bamfield-qa | active | community | traveler | b000... | Community Canvas | Bamfield |
| CanadaDirect | canadadirect | active | community | worker | NULL | (orphan) | West Vancouver |
| Enviro Bright Lights | enviro-bright | active | business_service | buyer | b125... | 1252093 BC LTD | Cloverdale |
| Enviropaving BC | enviropaving | active | business_service | buyer | b125... | 1252093 BC LTD | Surrey |
| OffpeakAirBNB | offpeakairbnb | active | community | host | NULL | (orphan) | Victoria |
| Parts Unknown BC | parts-unknown-bc | active | experience_editorial | buyer | NULL | (orphan) | Saanich |
| Remote Serve | remote-serve | active | business_service | buyer | b125... | 1252093 BC LTD | New Westminster |
| Save Paradise Parking | save-paradise-parking | active | business_service | traveler | 7d8e... | Save Paradise Parking | Bamfield |
| Woods End Landing Cottages | woods-end-landing | active | business_service | traveler | d000... | Woods End Landing | Bamfield |

### Portal Type Distribution

| portal_type | Count |
|-------------|-------|
| business_service | 6 |
| community | 5 |
| experience_editorial | 1 |

---

## SECTION B2: PLATFORM-OWNED PORTALS (ORPHANS)

Portals with `owning_tenant_id IS NULL`:

| Portal | slug | portal_type | anchor_community |
|--------|------|-------------|------------------|
| AdrenalineCanada | adrenalinecanada | community | Deep Cove |
| CanadaDirect | canadadirect | community | West Vancouver |
| OffpeakAirBNB | offpeakairbnb | community | Victoria |
| Parts Unknown BC | parts-unknown-bc | experience_editorial | Saanich |

**Note**: No tenant with name ILIKE '%platform%' exists. These 4 portals are truly orphaned (no owner tenant).

---

## SECTION C: 1252093 BC LTD MULTI-BRAND STRUCTURE

### C1) Tenant Row

```sql
SELECT id, name, slug FROM cc_tenants WHERE name ILIKE '%1252093%';
```

| id | name | slug |
|----|------|------|
| b1252093-0000-4000-8000-000000000001 | 1252093 BC LTD | 1252093-bc-ltd |

### C2) Portals Owned by 1252093 BC LTD (Brand Portals)

| Portal | slug | status | portal_type | anchor_community |
|--------|------|--------|-------------|------------------|
| Enviro Bright Lights | enviro-bright | active | business_service | Cloverdale |
| Enviropaving BC | enviropaving | active | business_service | Surrey |
| Remote Serve | remote-serve | active | business_service | New Westminster |

**Analysis**: 1252093 BC LTD operates 3 distinct business brands, each as a separate portal with `portal_type='business_service'`. Each brand has its own geo anchor (different BC communities).

### C3) Asset Tables and Tenant Linkage (Proof Assets Are Tenant-Level)

**Asset Tables Found:**

| Table | Purpose |
|-------|---------|
| cc_assets | Unified asset registry |
| cc_tenant_vehicles | Tenant-owned vehicles |
| cc_tenant_trailers | Tenant-owned trailers |
| cc_transport_assets | Transport-specific assets |

**Tenant Linkage Proof:**

| Table | Tenant Column |
|-------|---------------|
| cc_assets | owner_tenant_id |
| cc_tenant_vehicles | tenant_id |

**Conclusion**: Assets are linked at the **tenant level**, not portal level. All 3 brand portals under 1252093 BC LTD share the same asset pool via `tenant_id`.

---

## SECTION D: COMMUNITY PORTALS VS BUSINESS PORTALS

### D1) Portals with Zones

```sql
SELECT p.name, p.portal_type, COUNT(z.id) AS zone_count
FROM cc_portals p LEFT JOIN cc_zones z ON z.portal_id = p.id
GROUP BY p.id, p.name, p.portal_type ORDER BY zone_count DESC;
```

| Portal | portal_type | zone_count |
|--------|-------------|------------|
| Bamfield Community Portal | community | 5 |
| Bamfield QA Portal | community | 2 |
| All others | various | 0 |

**Observation**: Only `community` type portals have zones. This is consistent with zones representing micro-communities within a larger geographic community.

### D2) Zone Details

| Zone | Key | Kind | Parent Portal | Portal Type |
|------|-----|------|---------------|-------------|
| Anacla | anacla | neighborhood | Bamfield Community Portal | community |
| Deer Group | deer-group | neighborhood | Bamfield Community Portal | community |
| East Bamfield | east-bamfield | neighborhood | Bamfield Community Portal | community |
| Helby Island | helby-island | neighborhood | Bamfield Community Portal | community |
| West Bamfield | west-bamfield | neighborhood | Bamfield Community Portal | community |
| Downtown Core | test-zone-1 | neighborhood | Bamfield QA Portal | community |
| Waterfront District | test-zone-2 | neighborhood | Bamfield QA Portal | community |

**Heuristic**: Zones exist only under `community` portals. However, this is a pattern observation, not a schema constraint.

---

## SECTION E: PUBLISH ELIGIBILITY RULES AS IMPLEMENTED

### E1) GET /api/provider/portals — Fetch Available Portals for Publishing

**Location**: `server/routes/provider.ts` lines 578-591

```typescript
const result = await pool.query(`
  SELECT id, name, slug, status
  FROM cc_portals
  WHERE owning_tenant_id = $1 AND status = 'active'
  ORDER BY name ASC
`, [tenantId]);
```

**Eligibility Rules:**
- ✅ Filters by `owning_tenant_id = tenant_id` (only tenant's own portals)
- ✅ Filters by `status = 'active'`
- ❌ Does NOT filter by `portal_type`
- ❌ Does NOT allow cross-tenant portals

### E2) POST /api/provider/runs/:id/publish — Confirm Publishing

**Location**: `server/routes/provider.ts` lines 593-689

```typescript
// Validation: portals must belong to tenant
const portalsResult = await pool.query(`
  SELECT id FROM cc_portals WHERE id = ANY($1::uuid[]) AND owning_tenant_id = $2
`, [portalIds, tenantId]);

if (portalsResult.rows.length !== portalIds.length) {
  return res.status(400).json({ ok: false, error: 'One or more portals not found or not accessible' });
}
```

**Eligibility Rules:**
- ✅ Run must belong to tenant (`WHERE tenant_id = $2`)
- ✅ All portals must belong to tenant (`owning_tenant_id = $2`)
- ❌ Does NOT filter by `portal_type`
- ❌ Does NOT allow cross-tenant publishing

**Write Operation:**

```typescript
INSERT INTO cc_run_portal_publications (tenant_id, run_id, portal_id, published_at)
VALUES ($1, $2, $3, now())
ON CONFLICT (tenant_id, run_id, portal_id) 
DO UPDATE SET unpublished_at = NULL, published_at = now()
```

### E3) GET /api/provider/runs/:id/publish-suggestions — STEP 7 Zone-First Suggestions

**Location**: `server/routes/provider.ts` lines 1643-1820

```typescript
// Query candidate zones (zones-first)
SELECT z.id, z.name, z.key, p.id, p.name, p.slug, p.anchor_community_id, c.latitude, c.longitude
FROM cc_zones z
JOIN cc_portals p ON p.id = z.portal_id
LEFT JOIN cc_sr_communities c ON c.id = p.anchor_community_id
WHERE z.tenant_id = $1
  AND p.owning_tenant_id = $1
  AND p.status = 'active'
```

**Eligibility Rules:**
- ✅ Zones must belong to tenant (`z.tenant_id = $1`)
- ✅ Portals must belong to tenant (`p.owning_tenant_id = $1`)
- ✅ Portal must be active (`p.status = 'active'`)
- ❌ Does NOT filter by `portal_type`
- ❌ Does NOT allow cross-tenant suggestions
- ✅ Excludes already-published portals

### E4) POST /api/provider/runs/:id/visibility-preview — STEP 11A Read-Only Preview

**Location**: `server/routes/provider.ts` lines 693-880

```typescript
// Validate portals belong to tenant
SELECT id FROM cc_portals WHERE id = ANY($1::uuid[]) AND owning_tenant_id = $2
```

**Eligibility Rules:**
- ✅ Run must belong to tenant
- ✅ Selected portals must belong to tenant
- ✅ Uses visibility graph for rollup (cross-tenant via edges)
- ✅ Read-only (no publications written)

---

## SECTION F: VISIBILITY GRAPH RISK ASSESSMENT

### F1) All Active Visibility Edges

| Edge ID | Source | Source Type | Direction | Target | Target Type | Source Owner | Target Owner | Reason |
|---------|--------|-------------|-----------|--------|-------------|--------------|--------------|--------|
| 04c8b501... | Anacla | zone | up | Bamfield Community Portal | community | (via portal) | e000... | micro-community rollup |
| 50075665... | Deer Group | zone | up | Bamfield Community Portal | community | (via portal) | e000... | micro-community rollup |
| f22c1fe2... | East Bamfield | zone | up | Bamfield Community Portal | community | (via portal) | e000... | micro-community rollup |
| c6e3cf76... | Helby Island | zone | up | Bamfield Community Portal | community | (via portal) | e000... | micro-community rollup |
| e39b6706... | West Bamfield | zone | up | Bamfield Community Portal | community | (via portal) | e000... | micro-community rollup |
| af4080d0... | Bamfield Community Portal | community | lateral | Bamfield Adventure Center | business_service | e000... | 7ed7... | STEP 10D test edge |

### F2) Edges Targeting business_service Portals (Cross-Tenant Risk Analysis)

```sql
SELECT source_name, source_owner, direction, target_name, target_portal_type, target_owner
FROM cc_visibility_edges e ...
WHERE pt.portal_type = 'business_service';
```

| Source | Source Owner | Direction | Target | Target Type | Target Owner |
|--------|--------------|-----------|--------|-------------|--------------|
| Bamfield Community Portal | e0000... (Bamfield Community) | lateral | Bamfield Adventure Center | business_service | 7ed7... (Bamfield Adventure Center) |

**Risk Assessment:**

1. **One edge targets a business_service portal** (Bamfield Adventure Center)
2. **Cross-tenant edge**: Source owner (Bamfield Community) ≠ Target owner (Bamfield Adventure Center)
3. **Impact**: Runs published to Bamfield Community Portal will roll up to Bamfield Adventure Center

**Is this a problem?**

- The edge was intentionally created for STEP 10D testing
- The `lateral` direction means both portals are peers
- This is the expected behavior for visibility rollup
- Bamfield Adventure Center is a business portal for the same geographic community

**Recommendation**: This edge is valid for testing. In production, cross-tenant edges to business_service portals should be reviewed to ensure they represent intentional partnerships.

---

## SECTION G: SUMMARY OF PUBLISH ELIGIBILITY RULES

### Current Behavior (As Implemented)

| Endpoint | Tenant-Scoped? | portal_type Filter? | Cross-Tenant? | Visibility Graph? |
|----------|----------------|---------------------|---------------|-------------------|
| GET /provider/portals | YES | NO | NO | NO |
| POST /runs/:id/publish | YES | NO | NO | NO |
| GET /runs/:id/publish-suggestions | YES | NO | NO | NO |
| POST /runs/:id/visibility-preview | YES | NO | Via edges only | YES (read-only) |

### Key Findings

1. **Publish endpoints are strictly tenant-scoped**: Providers can only publish to their own portals
2. **No portal_type filtering**: Business and community portals are treated identically
3. **Cross-tenant visibility is via edges only**: Direct publishing is tenant-scoped; visibility rollup uses edges
4. **STEP 7 suggestions are zone-first**: Only zones owned by the tenant are suggested

### Potential Gaps

1. **Community portal suggestions**: Providers cannot discover community portals they don't own
2. **portal_type awareness**: UI could benefit from distinguishing community vs business portals
3. **Cross-tenant edge governance**: No admin UI to manage which edges are appropriate

---

## SECTION H: RECOMMENDATIONS (NO IMPLEMENTATION)

### If cross-tenant community portal publishing is needed:

1. Add a separate endpoint for discovering community portals near the run origin
2. Filter by `portal_type = 'community'`
3. Require explicit consent before allowing cross-tenant publishing

### If portal_type filtering is needed in STEP 7:

1. Add `AND p.portal_type = 'community'` to publish-suggestions query
2. This would exclude business_service portals from auto-suggestions

### For visibility edge governance:

1. Add admin UI to review/approve edges targeting business_service portals
2. Flag cross-tenant edges for review

---

## APPENDIX: SQL QUERIES USED

All queries in this document were executed against the development database on 2025-01-24. No modifications were made.
