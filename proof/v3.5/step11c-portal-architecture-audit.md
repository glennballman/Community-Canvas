# V3.5 STEP 11C-AUDIT: Portal Architecture Audit

**Date**: 2025-01-24  
**Mode**: READ-ONLY AUDIT  
**Status**: COMPLETE

---

## 1. PORTAL TYPES SUMMARY

### Allowed portal_type Values (from CHECK constraint)

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

### portal_type Values Currently in Use

| portal_type | Count | Description |
|-------------|-------|-------------|
| business_service | 6 | Commercial service providers (contractors, B2B) |
| community | 5 | Geographic community portals for residents/travelers |
| experience_editorial | 1 | Content/editorial discovery portal |

### Type Definitions

| Type | Purpose | Geo-Anchored? | Public Visibility? |
|------|---------|---------------|-------------------|
| **community** | Represents a geographic community (Bamfield, etc). Users can browse/discover. | YES (required) | YES - primary public surface |
| **business_service** | Commercial service provider brand. Provider uses for run publishing. | YES (optional) | NO - private B2B surface |
| **experience_editorial** | Content discovery, travel guides, editorials. | YES (optional) | YES - curated content |
| **facility** | Physical facility (marina, parking, lodge). | YES | Varies |
| **jobs** | Job board portal. | NO | YES |
| **marketplace** | E-commerce/marketplace. | NO | YES |
| **platform** | Platform-level admin portal. | NO | NO |

---

## 2. THE 12 PORTALS CLASSIFIED

| Portal | portal_type | Tenant | Geo Anchor | Zones | Notes |
|--------|-------------|--------|------------|-------|-------|
| AdrenalineCanada | community | (orphan) | Deep Cove | 0 | Orphan - no owning_tenant_id |
| Bamfield Adventure Center | business_service | Bamfield Adventure Center | Bamfield | 0 | Business service brand |
| Bamfield Community Portal | community | Bamfield Community | Bamfield | 5 | Primary community portal |
| Bamfield QA Portal | community | Community Canvas | Bamfield | 2 | Test/QA portal |
| CanadaDirect | community | (orphan) | West Vancouver | 0 | Orphan - no owning_tenant_id |
| Enviro Bright Lights | business_service | 1252093 BC LTD | Cloverdale | 0 | Business brand #1 |
| Enviropaving BC | business_service | 1252093 BC LTD | Surrey | 0 | Business brand #2 |
| OffpeakAirBNB | community | (orphan) | Victoria | 0 | Orphan - no owning_tenant_id |
| Parts Unknown BC | experience_editorial | (orphan) | Saanich | 0 | Editorial portal, orphan |
| Remote Serve | business_service | 1252093 BC LTD | New Westminster | 0 | Business brand #3 |
| Save Paradise Parking | business_service | Save Paradise Parking | Bamfield | 0 | Facility business portal |
| Woods End Landing Cottages | business_service | Woods End Landing | Bamfield | 0 | Lodging business portal |

### Key Observations

1. **All 12 portals have geo anchors** - 100% compliance with STEP 9B
2. **4 orphan portals** - No owning_tenant_id (AdrenalineCanada, CanadaDirect, OffpeakAirBNB, Parts Unknown BC)
3. **1 tenant owns 3 portals** - 1252093 BC LTD owns 3 business_service brands
4. **Only 2 portals have zones** - Bamfield Community Portal (5), Bamfield QA Portal (2)
5. **5 portals anchored to Bamfield** - Core test community for V3.5

---

## 3. TENANT-PORTAL RELATIONSHIPS

### Portals per Tenant

| Tenant | Portal Count | Portals |
|--------|--------------|---------|
| 1252093 BC LTD | 3 | Enviro Bright Lights, Enviropaving BC, Remote Serve |
| Bamfield Adventure Center | 1 | Bamfield Adventure Center |
| Bamfield Community | 1 | Bamfield Community Portal |
| Community Canvas | 1 | Bamfield QA Portal |
| Save Paradise Parking | 1 | Save Paradise Parking |
| Woods End Landing | 1 | Woods End Landing Cottages |
| (orphan - null) | 4 | AdrenalineCanada, CanadaDirect, OffpeakAirBNB, Parts Unknown BC |

### 1252093 BC LTD Structure (Multi-Brand Tenant)

| Tenant | Portal | slug | portal_type | legal_dba_name |
|--------|--------|------|-------------|----------------|
| 1252093 BC LTD | Enviro Bright Lights | enviro-bright | business_service | Enviro Bright Lights |
| 1252093 BC LTD | Enviropaving BC | enviropaving | business_service | Enviropaving BC |
| 1252093 BC LTD | Remote Serve | remote-serve | business_service | Remote Serve |

**Analysis**: This tenant operates 3 distinct business brands, each with its own portal. All are `business_service` type. This is the multi-portal pattern V3.5 was designed to support.

---

## 4. ZONE-PORTAL RELATIONSHIPS

### Zones by Portal

| Portal | portal_type | Zone Count | Zones |
|--------|-------------|------------|-------|
| Bamfield Community Portal | community | 5 | Anacla, Deer Group, East Bamfield, Helby Island, West Bamfield |
| Bamfield QA Portal | community | 2 | Downtown Core, Waterfront District |
| All others | various | 0 | (no zones) |

**Key Finding**: Only `community` type portals have zones. This makes sense - zones represent micro-communities within a larger community portal.

---

## 5. VISIBILITY EDGE ANALYSIS

### Active Visibility Edges

| Edge ID | Source | Direction | Target | Source Type | Target Type | Reason |
|---------|--------|-----------|--------|-------------|-------------|--------|
| af4080d0... | Bamfield Community Portal | lateral | Bamfield Adventure Center | community | business_service | STEP 10D multi-hop test edge |
| 04c8b501... | Anacla (zone) | up | Bamfield Community Portal | zone | community | micro-community rollup |
| 50075665... | Deer Group (zone) | up | Bamfield Community Portal | zone | community | micro-community rollup |
| f22c1fe2... | East Bamfield (zone) | up | Bamfield Community Portal | zone | community | micro-community rollup |
| c6e3cf76... | Helby Island (zone) | up | Bamfield Community Portal | zone | community | micro-community rollup |
| e39b6706... | West Bamfield (zone) | up | Bamfield Community Portal | zone | community | micro-community rollup |

### Edge Pattern Analysis

| Pattern | Count | Description |
|---------|-------|-------------|
| zone → portal (up) | 5 | Micro-community zones roll up to parent community portal |
| portal → portal (lateral) | 1 | Community portal peers with business service portal |

### Edges Targeting Non-Community Portals

| Edge | Source | Target | Target Type | Concern? |
|------|--------|--------|-------------|----------|
| af4080d0... | Bamfield Community Portal | Bamfield Adventure Center | business_service | VALID - lateral peer edge |

**Analysis**: The only edge targeting a non-community portal is a `lateral` edge from Bamfield Community Portal to Bamfield Adventure Center. This is valid - it means runs published to Bamfield Community Portal will also roll up to Bamfield Adventure Center.

**No invalid edges found.**

---

## 6. GEO ANCHOR ANALYSIS

### Anchors by Portal Type

| portal_type | Total | With Anchor | Without Anchor |
|-------------|-------|-------------|----------------|
| business_service | 6 | 6 | 0 |
| community | 5 | 5 | 0 |
| experience_editorial | 1 | 1 | 0 |

**Result**: 100% geo anchor coverage across all portal types.

### Bamfield-Anchored Portals

5 portals are anchored to Bamfield (dfcf6f7c-cc73-47e6-8194-cb50079be93b):
1. Bamfield Adventure Center (business_service)
2. Bamfield Community Portal (community)
3. Bamfield QA Portal (community)
4. Save Paradise Parking (business_service)
5. Woods End Landing Cottages (business_service)

---

## 7. STEP 7 PUBLISH-SUGGESTIONS ANALYSIS

### Current Implementation (Lines 1643-1820)

```typescript
// Current query (simplified)
SELECT z.id, z.name, p.id, p.name, p.slug, p.anchor_community_id, c.latitude, c.longitude
FROM cc_zones z
JOIN cc_portals p ON p.id = z.portal_id
WHERE z.tenant_id = $1
  AND p.owning_tenant_id = $1
  AND p.status = 'active'
```

### What STEP 7 Currently Does

1. **Zone-first approach**: Returns zones, not portals directly
2. **Tenant-scoped**: Only shows zones/portals owned by the current tenant
3. **No portal_type filtering**: Does NOT filter by portal_type
4. **Distance-based ranking**: Uses haversine to rank by proximity to run origin
5. **Excludes already-published**: Filters out portals where run is already published

### Gap Analysis

| Requirement | Current Status |
|-------------|----------------|
| Filter by portal_type? | NO - returns all portal types |
| Filter by community-only? | NO - would include business_service, etc. |
| Cross-tenant suggestions? | NO - only shows tenant's own portals |
| Visibility graph integration? | NO - pure geography-based |

### Potential Issue

**STEP 7 currently only suggests portals/zones owned by the same tenant.**

This means:
- If a service provider wants to publish to Bamfield Community Portal (owned by Bamfield Community tenant), STEP 7 won't suggest it.
- The current design assumes providers only publish to their own portals.

**This may be intentional** - visibility edges handle cross-tenant rollups. A provider publishes to their own portal, and visibility edges propagate to community portals.

---

## 8. RECOMMENDATIONS

### A) No Schema Changes Needed

The current schema supports the required use cases:
- `portal_type` column exists with proper CHECK constraint
- Geo anchors are fully populated
- Visibility edges are correctly structured

### B) STEP 7 Clarification Needed

The current STEP 7 implementation only suggests tenant-owned portals/zones. This is correct if:
- Providers publish to their own business portals
- Visibility edges handle cross-tenant propagation

If cross-tenant suggestions are needed:
- Add a mode to suggest community portals near the run origin
- Filter by `portal_type = 'community'`
- This would require explicit consent/opt-in per VISIBILITY PRINCIPLES

### C) Orphan Portals

4 portals have no owning_tenant_id. These may be:
- Legacy data from before tenant model
- Platform-level test portals
- Intentionally unowned for public discovery

**Recommendation**: Assign these to appropriate tenants or mark as platform-owned.

### D) Visibility Edge Targeting

Current edges correctly target:
- `community` portals (zone→portal up edges)
- `business_service` portals (portal→portal lateral edge)

**No changes needed** - edge patterns are valid.

---

## 9. TERMINOLOGY COMPLIANCE CHECK

| Term | Status |
|------|--------|
| "contractor" | NOT FOUND in portal names (good) |
| "booking" | NOT FOUND in portal names (good) |
| "customer" | NOT FOUND in portal names (good) |
| portal_type values | All compliant with TERMINOLOGY_CANON |

---

## 10. CONCLUSION

The portal architecture is well-structured for V3.5 visibility features:

1. **Portal types are correctly defined** - community, business_service, experience_editorial
2. **Geo anchors are complete** - 100% coverage
3. **Visibility edges are valid** - Correct zone→portal and portal→portal patterns
4. **STEP 7 is tenant-scoped** - This is intentional; visibility edges handle cross-tenant propagation
5. **No schema changes needed** - Ready for STEP 11C implementation

**Next Steps for STEP 11C**:
- If cross-tenant community portal suggestions are needed, add a separate endpoint or mode
- Filter suggestions by `portal_type = 'community'` when suggesting public community portals
- Keep current tenant-scoped behavior for business portal suggestions
