# REPLIT PROMPT 1 — Surfaces + Containers + Atomic Units + Claims

## ROLE
Senior platform engineer implementing V3.5 Surface Spine.

## PATENT NOTICE
```
PATENT CC-02 SURFACES PATENT INVENTOR GLENN BALLMAN
```
Add this comment to the top of all migration files and key engine files.

## HARD RULES
- **Never use book/booking** — use reserve/reservation
- **Surfaces are spatial** — time lives in claims only
- **Atomic units must be individually addressable** — for split pay, housekeeping, refunds, incidents
- **Add UtilitySurface now** — power is a first-class constraint
- **Accessibility must be representable** — grates, clear width, steps

## GOAL
Implement:
- `cc_surface_containers` (hierarchy)
- `cc_surfaces` (physical surface anchors: bunks, sofa-bed, floor zone, slip edge, outlet, canoe hull)
- `cc_surface_units` (atomic units: 19 sleep spots, 10 seats, etc.)
- `cc_surface_claims` (time-bound allocation of unit_ids)
- Utility nodes + bindings (shared dock power pool)
- Seeds for Aviator + Woods End dock + Flora seating + Canoe/Kayak

---

## A) DATABASE MIGRATION

Create a new migration (next sequential number) with header:
```sql
-- PATENT CC-02 SURFACES PATENT INVENTOR GLENN BALLMAN
-- V3.5 Surface Spine: Containers, Surfaces, Atomic Units, Claims, Utility
```

### 1) cc_surface_containers

Represents rollups like cottage/room/bed-object/dock/slip/watercraft/etc.

```sql
CREATE TABLE IF NOT EXISTS cc_surface_containers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id uuid NOT NULL,
  tenant_id uuid NULL,  -- Keep for RLS compatibility
  parent_container_id uuid NULL REFERENCES cc_surface_containers(id),
  
  container_type varchar NOT NULL,
  -- Allowed: cottage, room, bed_object, dock, dock_section, slip, 
  --          restaurant, table, watercraft, parking_zone, parking_stall
  
  title varchar NOT NULL,
  is_private boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  
  -- Accessibility (minimal)
  min_door_width_mm int NULL,
  has_steps boolean NOT NULL DEFAULT false,
  notes_accessibility text NULL,
  
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cc_surface_containers_portal_type_idx 
  ON cc_surface_containers(portal_id, container_type);
CREATE INDEX cc_surface_containers_parent_idx 
  ON cc_surface_containers(parent_container_id);
CREATE INDEX cc_surface_containers_portal_tenant_idx 
  ON cc_surface_containers(portal_id, tenant_id);
```

### 2) cc_surfaces (physical anchors)

Atomic spatial units. No time here.

```sql
CREATE TABLE IF NOT EXISTS cc_surfaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id uuid NOT NULL,
  tenant_id uuid NULL,
  
  surface_type varchar NOT NULL,
  -- Allowed: sleep, sit, stand, movement, utility
  
  title varchar NOT NULL,
  description text NULL,
  
  -- Geometry (generic)
  length_mm int NULL,
  width_mm int NULL,
  area_sqmm bigint NULL,
  linear_mm int NULL,  -- For dock edge or other linear surfaces
  
  -- Accessibility (minimal)
  min_clear_width_mm int NULL,
  max_slope_pct numeric NULL,
  has_grates boolean NOT NULL DEFAULT false,
  surface_tags text[] NULL,
  
  -- Utility fields (for surface_type='utility')
  utility_type varchar NULL,  -- electricity, water, fuel, sewer, data
  utility_connector varchar NULL,  -- e.g., standard_120v
  
  metadata jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cc_surfaces_portal_type_active_idx 
  ON cc_surfaces(portal_id, surface_type, is_active);
CREATE INDEX cc_surfaces_portal_type_idx 
  ON cc_surfaces(portal_id, surface_type);
```

### 3) cc_surface_container_members

Maps physical surfaces to containers.

```sql
CREATE TABLE IF NOT EXISTS cc_surface_container_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id uuid NOT NULL,
  tenant_id uuid NULL,
  
  container_id uuid NOT NULL REFERENCES cc_surface_containers(id) ON DELETE CASCADE,
  surface_id uuid NOT NULL REFERENCES cc_surfaces(id) ON DELETE CASCADE,
  
  role varchar NULL,
  sort_order int NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE (container_id, surface_id)
);

CREATE INDEX cc_surface_container_members_portal_container_idx 
  ON cc_surface_container_members(portal_id, container_id);
CREATE INDEX cc_surface_container_members_portal_surface_idx 
  ON cc_surface_container_members(portal_id, surface_id);
```

### 4) cc_surface_units (ATOMIC UNITS — Critical)

This is the real "SleepSurface spots / SitSurface seats / StandSurface spots / Utility endpoints".
Each row is individually addressable for billing, refunds, incidents.

```sql
CREATE TABLE IF NOT EXISTS cc_surface_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id uuid NOT NULL,
  tenant_id uuid NULL,
  
  surface_id uuid NOT NULL REFERENCES cc_surfaces(id) ON DELETE CASCADE,
  
  unit_type varchar NOT NULL,  -- sleep, sit, stand, utility
  unit_index int NOT NULL,     -- 1..N within this surface
  label varchar NULL,          -- e.g., TopBunk-1, Canoe1-Middle, Seat-3
  
  -- Optional constraints at unit level
  unit_max_lbs int NULL,
  unit_tags text[] NULL,  -- e.g., top_bunk, floor_level, needs_ladder, window_seat
  
  metadata jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE (surface_id, unit_type, unit_index)
);

CREATE INDEX cc_surface_units_portal_type_idx 
  ON cc_surface_units(portal_id, unit_type);
CREATE INDEX cc_surface_units_portal_surface_idx 
  ON cc_surface_units(portal_id, surface_id);
CREATE INDEX cc_surface_units_active_idx 
  ON cc_surface_units(portal_id, is_active);
```

### 5) cc_surface_claims (claims allocate UNIT_IDS; time stays here)

```sql
CREATE TABLE IF NOT EXISTS cc_surface_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id uuid NOT NULL,
  tenant_id uuid NULL,
  
  container_id uuid NULL REFERENCES cc_surface_containers(id),  -- For reporting
  reservation_id uuid NULL,  -- Link to existing reservation record if present
  hold_token varchar NULL,
  
  claim_status varchar NOT NULL,
  -- Allowed: hold, confirmed, released, canceled
  
  time_start timestamptz NOT NULL,
  time_end timestamptz NOT NULL,
  
  unit_ids uuid[] NOT NULL,  -- CRITICAL: Array of specific unit UUIDs
  
  assigned_participant_id uuid NULL,  -- Optional but recommended
  
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT cc_surface_claims_time_valid CHECK (time_start < time_end)
);

CREATE INDEX cc_surface_claims_portal_token_idx 
  ON cc_surface_claims(portal_id, hold_token);
CREATE INDEX cc_surface_claims_portal_reservation_idx 
  ON cc_surface_claims(portal_id, reservation_id);
CREATE INDEX cc_surface_claims_portal_status_idx 
  ON cc_surface_claims(portal_id, claim_status);
CREATE INDEX cc_surface_claims_time_idx 
  ON cc_surface_claims(portal_id, time_start, time_end);

-- GIN index for unit_ids array overlap checking (CRITICAL for performance)
CREATE INDEX cc_surface_claims_units_gin_idx 
  ON cc_surface_claims USING GIN (unit_ids);
```

### 6) Utility upstream constraints (shared pool)

```sql
CREATE TABLE IF NOT EXISTS cc_utility_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id uuid NOT NULL,
  tenant_id uuid NULL,
  
  node_type varchar NOT NULL,  -- shared_pool, panel, feeder
  utility_type varchar NOT NULL,  -- electricity, water, fuel, sewer, data
  title varchar NOT NULL,
  
  capacity jsonb NOT NULL DEFAULT '{}',
  -- For electricity: { "max_watts": 3000 } or { "max_amps": 30, "voltage": 120 }
  
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cc_utility_nodes_portal_type_idx 
  ON cc_utility_nodes(portal_id, utility_type, node_type);
```

```sql
CREATE TABLE IF NOT EXISTS cc_surface_utility_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id uuid NOT NULL,
  tenant_id uuid NULL,
  
  surface_id uuid NOT NULL REFERENCES cc_surfaces(id) ON DELETE CASCADE,
  utility_node_id uuid NOT NULL REFERENCES cc_utility_nodes(id) ON DELETE CASCADE,
  
  priority int NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE (surface_id, utility_node_id)
);

CREATE INDEX cc_surface_utility_bindings_portal_idx 
  ON cc_surface_utility_bindings(portal_id);
CREATE INDEX cc_surface_utility_bindings_node_idx 
  ON cc_surface_utility_bindings(utility_node_id);
```

---

## B) DRIZZLE SCHEMA UPDATES

Add the new tables to Drizzle schema files and export types:
- `ccSurfaceContainers`
- `ccSurfaces`
- `ccSurfaceContainerMembers`
- `ccSurfaceUnits`
- `ccSurfaceClaims`
- `ccUtilityNodes`
- `ccSurfaceUtilityBindings`

---

## C) MINIMAL API (Internal App Endpoints)

Create endpoints under `/api/p2/app/surfaces/*`:

### 1) GET /api/p2/app/surfaces/containers/:containerId

Returns:
- container details
- child containers
- member surfaces
- units for each surface
- utility bindings if present

### 2) POST /api/p2/app/surfaces/claims/hold

Input:
```typescript
{
  unit_ids: string[],       // Array of unit UUIDs to claim
  time_start: string,       // ISO timestamp
  time_end: string,         // ISO timestamp  
  hold_token: string,
  container_id?: string,    // Optional, for reporting
  assigned_participant_id?: string
}
```

Behavior:
- **Unit-level overlap check**: A unit_id cannot overlap another active (hold/confirmed) claim
- Overlap exists if: `new.start < existing.end AND new.end > existing.start`
- Query using: `WHERE unit_ids && ARRAY[...] AND claim_status IN ('hold','confirmed')`
- If ANY unit_id has overlap conflict, return `{ ok: false, error: { code: "UNIT_OVERLAP", message: "One or more units already claimed for this time window", conflicting_unit_ids: [...] } }`
- On success, create claim and return `{ ok: true, claim_id: "...", hold_token: "..." }`

### 3) POST /api/p2/app/surfaces/claims/confirm

Input:
```typescript
{
  hold_token: string,
  reservation_id: string
}
```

Behavior:
- Find all claims with matching hold_token and status='hold'
- Set claim_status='confirmed', attach reservation_id
- Return `{ ok: true, confirmed_count: N }`

### 4) POST /api/p2/app/surfaces/claims/release

Input:
```typescript
{
  hold_token?: string,
  reservation_id?: string
}
```

Behavior:
- Find matching claims (hold or confirmed)
- Set claim_status='released'
- Return `{ ok: true, released_count: N }`

---

## D) SEEDS (Must Create Usable Test Data)

### Seed 1: Aviator (19 atomic sleep units)

**Containers:**
```
Cottage: "Aviator"
├── Room: "Bedroom" (is_private=true)
│   ├── BedObject: "Top Bunk"
│   └── BedObject: "Bottom Bunk"
└── Room: "Living Room" (is_private=false)
    ├── BedObject: "Sofa Bed"
    └── BedObject: "Floor Zone"
```

**Physical Surfaces (4):**
| Surface | Type | Title |
|---------|------|-------|
| 1 | sleep | Top Bunk Mattress |
| 2 | sleep | Bottom Bunk Mattress |
| 3 | sleep | Sofa Bed Mattress |
| 4 | sleep | Floor Zone Sleep Area |

**Atomic Units (19):**
| Surface | Unit Count | Labels | Tags |
|---------|------------|--------|------|
| Top Bunk | 4 | TopBunk-1..4 | `['top_bunk', 'needs_ladder']`, unit_max_lbs=300 |
| Bottom Bunk | 5 | BottomBunk-1..5 | `['bottom_bunk', 'floor_level']` |
| Sofa Bed | 5 | SofaBed-1..5 | `['sofa_bed']` |
| Floor Zone | 5 | Floor-1..5 | `['floor_mattress', 'floor_level']` |

✅ Total = 19 sleep units, each individually addressable

### Seed 2: Parking Stall Bike Corral (16 atomic stand units)

**Container:** Parking Stall "Bike Corral Stall"
**Physical Surface:** Stand surface "Stall Footprint"
**Atomic Units:** 16 stand units with labels Bike-1..16, tags `['bike_spot']`

### Seed 3: Flora's Restaurant (10 atomic sit units)

**Container:** Restaurant "Flora's" → Table "Table-10Top"
**Physical Surface:** Sit surface "Table 10 Seating"
**Atomic Units:** 10 sit units with labels Seat-1..10

### Seed 4: Watercraft (Canoes + Kayak)

**Canoe1:**
- Container: Watercraft "Canoe 1"
- Physical Surface: Sit surface "Canoe 1 Hull"
- Atomic Units: 6 sit units (Canoe1-Bow, Canoe1-Mid1..4, Canoe1-Stern)

**Canoe2:** Same structure, 6 sit units

**Kayak1:**
- Container: Watercraft "Kayak 1"  
- Physical Surface: Sit surface "Kayak 1 Hull"
- Atomic Units: 2 sit units (Kayak1-Front, Kayak1-Rear)

### Seed 5: Woods End Dock (9 slips + shared power)

**Containers:**
```
Dock: "Woods End Dock"
├── DockSection: "Main Float"
│   └── Slips: A1, A2, A3, A4, A5
└── DockSection: "Finger B"
    └── Slips: B1, B2, B3, B4
```

**For EACH slip, create:**

1. **Stand surface** (dock edge moorage):
   - surface_type='stand'
   - linear_mm=6000 (20ft) or appropriate
   - title="Slip {X} Moorage Edge"

2. **Utility surface** (standard plug power):
   - surface_type='utility'
   - utility_type='electricity'
   - utility_connector='standard_120v'
   - title="Slip {X} Power Outlet"

3. **Atomic units:**
   - 1 stand unit per slip: "SlipMoorage-{X}"
   - 1 utility unit per slip: "SlipPower-{X}"

**Utility Node:**
- Create `cc_utility_nodes` row: "Dock Power Shared Pool"
  - node_type='shared_pool'
  - utility_type='electricity'
  - capacity='{"max_watts": 3000}'

**Utility Bindings:**
- Bind ALL 9 slip utility surfaces to DockPowerSharedPool

---

## E) PROOF OUTPUTS / TESTS

### Proof Query Outputs (Print in Seed Log)

```sql
-- Aviator sleep units
SELECT COUNT(*) as aviator_sleep_units 
FROM cc_surface_units su
JOIN cc_surfaces s ON su.surface_id = s.id
JOIN cc_surface_container_members scm ON s.id = scm.surface_id
JOIN cc_surface_containers c ON scm.container_id = c.id
WHERE c.title = 'Aviator' AND su.unit_type = 'sleep';
-- Expected: 19

-- Flora seats
SELECT COUNT(*) as flora_seats
FROM cc_surface_units WHERE unit_type = 'sit' 
AND surface_id IN (SELECT id FROM cc_surfaces WHERE title LIKE '%Flora%' OR title LIKE '%Table 10%');
-- Expected: 10

-- Bike corral stand units
SELECT COUNT(*) as bike_spots
FROM cc_surface_units WHERE unit_type = 'stand'
AND surface_id IN (SELECT id FROM cc_surfaces WHERE title LIKE '%Bike%' OR title LIKE '%Stall%');
-- Expected: 16

-- Dock slips
SELECT COUNT(*) as dock_slips
FROM cc_surface_containers WHERE container_type = 'slip';
-- Expected: 9

-- Utility bindings to shared pool
SELECT COUNT(*) as utility_bindings
FROM cc_surface_utility_bindings;
-- Expected: 9
```

### Functional Tests

**Test 1: Claim units on Aviator top bunk**
```typescript
// Hold 3 units succeeds
await claimHold({
  unit_ids: [topBunkUnit1, topBunkUnit2, topBunkUnit3],
  time_start: '2026-06-01T14:00:00Z',
  time_end: '2026-06-03T11:00:00Z',
  hold_token: 'test-hold-1'
});
// Expected: { ok: true }

// Hold unit 2 again (overlapping) fails
await claimHold({
  unit_ids: [topBunkUnit2],
  time_start: '2026-06-02T00:00:00Z',
  time_end: '2026-06-02T23:59:00Z',
  hold_token: 'test-hold-2'
});
// Expected: { ok: false, error: { code: "UNIT_OVERLAP" } }
```

**Test 2: Dock slip moorage is exclusive**
```typescript
// Slip A1 moorage (max 1 unit) claimed
await claimHold({
  unit_ids: [slipA1MoorageUnit],
  time_start: '2026-07-01T00:00:00Z',
  time_end: '2026-07-07T00:00:00Z',
  hold_token: 'boat-1'
});
// Expected: { ok: true }

// Same slip overlapping fails
await claimHold({
  unit_ids: [slipA1MoorageUnit],
  time_start: '2026-07-03T00:00:00Z',
  time_end: '2026-07-05T00:00:00Z',
  hold_token: 'boat-2'
});
// Expected: { ok: false, error: { code: "UNIT_OVERLAP" } }
```

---

## F) STOP CONDITION

After implementation, report back:
1. Migration number created
2. Any schema/RLS errors
3. Confirm your existing ledger table name (cc_folio_ledger or different?)
4. Proof query results matching expected values
5. Test results for overlap enforcement

---

## NOTES

- Do NOT implement "normal vs emergency" lens yet — that is Prompt 2
- Do NOT implement folio/ledger integration yet — that is Prompt 3
- The GIN index on `unit_ids` is critical for overlap query performance
- All P2 envelope responses: `{ ok: true, ...data }` or `{ ok: false, error: { code, message } }`
