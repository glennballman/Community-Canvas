# V3.3.1 Architecture Lock

## Document Purpose
This file defines the **non-negotiable invariants** and **supersession rules** for the V3.3.1 (Parking + Marina + Global Bamfield Dashboard) expansion.

**CRITICAL**: All code changes must comply with these rules. Any deviation requires explicit approval.

---

## Platform Identity

| System | Platform | Role |
|--------|----------|------|
| **Community Canvas** | Replit | Multi-tenant B2B SaaS for BC communities |
| **CivOS** | Lovable | Separate system that CC integrates with |

CC communicates WITH CivOS via `cc_civos_*` tables (signals, exports, etc.).

---

## Non-Negotiable Invariants

### 1. Table Naming Convention
- All application tables: `cc_*` prefix
- All constraints/indexes: `cc_*` prefix
- System tables excluded: `session`, `spatial_ref_sys`

### 2. RLS Sentinel Pattern
```typescript
// Exactly this value - double underscores
const SERVICE_MODE_SENTINEL = '__SERVICE__';

// Service mode bypass for background jobs
await client.query(`SELECT set_config('app.tenant_id', $1, false)`, ['__SERVICE__']);
```

### 3. Multi-Tenant Security
- All tenant-scoped tables require `tenant_id` column
- RLS policies use `safe_current_tenant_uuid()` function
- Service mode (`__SERVICE__`) bypasses RLS for cross-tenant operations

### 4. ID Column Preservation
- **NEVER** change existing primary key types
- `serial` stays `serial`
- `varchar` with UUID stays `varchar`
- Migrations must not include `ALTER TABLE ... ALTER COLUMN id`

---

## Supersession Rules

### V3.3.1 is Canonical For:
1. **Facility** - Physical locations (marinas, RV parks, parking lots)
2. **Unit** - Reservable spaces within facilities (slips, spots, stalls)
3. **Offer** - Pricing/availability configurations
4. **Reservation** - Booking records
5. **Allocation** - Unit assignments to reservations

### Existing Tables That Require MERGING (not replacement):

| Existing Table | V3.3.1 Action | Rationale |
|----------------|---------------|-----------|
| `cc_assets` (124 cols) | EXTEND | Add facility/unit columns, preserve existing |
| `cc_reservations` (58 cols) | MERGE | Keep all 58 columns, add V3.3.1 columns |
| `cc_resource_schedule_events` (14 cols) | EXTEND | Add allocation semantics |

### MERGE Strategy for cc_reservations
```sql
-- KEEP all existing 58 columns
-- ADD new V3.3.1 columns:
--   offer_id           UUID REFERENCES cc_offers
--   unit_id            UUID REFERENCES cc_units
--   allocation_id      UUID REFERENCES cc_allocations
--   pricing_snapshot   JSONB
--   external_payment_ref VARCHAR(255)  -- External only, never processed
```

---

## Pricing Stack Architecture

V3.3.1 introduces a normalized pricing stack:

```
cc_offers (base pricing templates)
    ↓
cc_rate_rules (time-based / condition-based modifiers)
    ↓
cc_tax_rules (jurisdiction-specific tax calculations)
    ↓
cc_reservations.pricing_snapshot (frozen at booking time)
```

### Key Constraints:
- Offers are portal-scoped (multi-portal support)
- Rate rules support seasonality, occupancy, and duration modifiers
- Tax rules integrate with existing `cc_tax_jurisdictions` (21 jurisdictions)
- **All pricing is calculated, never processed** - CC does not handle payments

---

## V3.3.1 New Tables (Proposed)

| Table | Purpose | RLS Required |
|-------|---------|--------------|
| `cc_facilities` | Physical locations | Yes |
| `cc_units` | Reservable spaces | Yes |
| `cc_offers` | Pricing templates | Yes |
| `cc_rate_rules` | Dynamic pricing rules | Yes |
| `cc_tax_rules` | Tax calculation rules | Yes |
| `cc_allocations` | Unit ↔ Reservation links | Yes |
| `cc_availability_calendar` | Pre-computed availability | Yes |

---

## Existing Schema Statistics

| Table | Column Count | RLS Enabled |
|-------|--------------|-------------|
| `cc_assets` | 124 | No |
| `cc_reservations` | 58 | No |
| `cc_resource_schedule_events` | 14 | No |
| `cc_portals` | 22 | Yes |
| `cc_tenants` | 28 | Yes |

**Total cc_* tables**: 368
**Total migration files**: 75

---

## Technology Stack Lock

| Layer | Technology | Locked Version |
|-------|------------|----------------|
| Frontend | React 18 + TypeScript | Yes |
| Router | react-router-dom | Yes |
| State | TanStack Query | Yes |
| Backend | Express.js + TypeScript | Yes |
| ORM | Drizzle | Yes |
| Database | PostgreSQL (Neon) | Yes |
| Storage | Cloudflare R2 | Yes |

---

## Migration Strategy

1. **Phase 1**: Schema extension only (ALTER TABLE ADD COLUMN)
2. **Phase 2**: New tables with proper RLS
3. **Phase 3**: API routes following existing patterns
4. **Phase 4**: Frontend components

**DO NOT** drop existing columns, tables, or constraints without explicit approval.

---

## Document History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-01-12 | 1.0 | Agent | Initial architecture lock |
