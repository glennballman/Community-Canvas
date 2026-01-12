# V3.3.1 Schema Reconciliation

## Purpose
Document the complete mapping between existing Community Canvas schema and V3.3.1 requirements.

---

## Executive Summary

| Category | Count |
|----------|-------|
| Total cc_* tables | 368 |
| Tables with RLS enabled | ~50 |
| Migration files | 75 |
| cc_assets columns | 124 |
| cc_reservations columns | 58 |

---

## Existing Core Tables Analysis

### cc_assets (124 columns)

**Current Purpose**: Unified registry for all rentable assets (properties, spots, trailers, vehicles, equipment).

**V3.3.1 Conflict Assessment**: LOW CONFLICT

The existing `cc_assets` table already supports:
- `asset_type` enum (room, spot, vehicle, trailer, equipment)
- Location fields (lat, lng, region, city)
- Pricing fields (rate_hourly, rate_daily, rate_weekly, rate_monthly)
- Availability fields (is_available, available_from, available_until)
- Scheduling fields (reservation_mode, time_granularity_minutes)

**V3.3.1 MERGE Strategy**:
```sql
-- ADD columns to cc_assets (do not remove existing)
ALTER TABLE cc_assets ADD COLUMN IF NOT EXISTS
  facility_id UUID REFERENCES cc_facilities(id),
  unit_number VARCHAR(50),
  unit_type VARCHAR(50),  -- 'slip', 'spot', 'stall', 'berth', 'pad'
  unit_size_category VARCHAR(20),  -- 'small', 'medium', 'large', 'xl'
  amenities JSONB DEFAULT '[]',
  seasonal_availability JSONB,
  default_offer_id UUID;  -- REFERENCES cc_offers when created
```

---

### cc_reservations (58 columns)

**Current Purpose**: Booking records linking guests to assets.

**Existing Columns** (preserve all):
```
id, confirmation_number, asset_id, customer_id, provider_id,
primary_guest_name, primary_guest_email, primary_guest_telephone,
party_size, guest_names, reservation_context, service_run_id, trip_id,
start_date, end_date, checkin_time, checkout_time,
rate_type, rate_amount, nights_or_units, subtotal, cleaning_fee,
service_fee, taxes, total, deposit_required, bond_id, deposit_paid,
deposit_returned, waiver_required, waiver_signed, waiver_signed_at,
signed_waiver_id, license_required, license_verified, license_document_id,
insurance_required, insurance_verified, ready_for_use, status,
payment_status, condition_at_start, condition_at_end, photos_at_start,
photos_at_end, damage_reported, damage_notes, confirmation_sent,
reminder_sent, special_requests, internal_notes, cancelled_at,
cancellation_reason, refund_amount, created_at, updated_at,
portal_id, schema_type
```

**V3.3.1 MERGE Strategy**:
```sql
-- ADD columns to cc_reservations (keep all 58 existing)
ALTER TABLE cc_reservations ADD COLUMN IF NOT EXISTS
  offer_id UUID,  -- REFERENCES cc_offers when created
  unit_id UUID,   -- REFERENCES cc_units when created
  allocation_id UUID,  -- REFERENCES cc_allocations when created
  pricing_snapshot JSONB,  -- Frozen pricing at booking time
  external_payment_ref VARCHAR(255),  -- External processor reference
  pricing_version INTEGER DEFAULT 1,
  rate_rule_ids UUID[] DEFAULT '{}';
```

---

### cc_resource_schedule_events (14 columns)

**Current Purpose**: Operations board scheduling with 15-minute precision.

**Existing Columns**:
```
id, tenant_id, resource_id, event_type, start_date, end_date,
status, title, notes, created_by_actor_id, related_entity_type,
related_entity_id, created_at, updated_at
```

**V3.3.1 Relationship**: This table handles **operational scheduling** (holds, maintenance, buffers). Reservations display as "reserved" blocks but are stored in `cc_reservations`.

**V3.3.1 MERGE Strategy**:
```sql
-- ADD columns for allocation integration
ALTER TABLE cc_resource_schedule_events ADD COLUMN IF NOT EXISTS
  allocation_id UUID,  -- Link to cc_allocations for unit blocks
  block_reason VARCHAR(100),
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule JSONB;
```

---

## V3.3.1 New Tables

### cc_facilities

```sql
CREATE TABLE cc_facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id),
  portal_id UUID REFERENCES cc_portals(id),
  
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  facility_type VARCHAR(50) NOT NULL,  -- 'marina', 'rv_park', 'parking_lot', 'campground'
  
  -- Location
  address TEXT,
  city VARCHAR(100),
  region VARCHAR(100),
  postal_code VARCHAR(20),
  country CHAR(2) DEFAULT 'CA',
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  
  -- Configuration
  timezone VARCHAR(50) DEFAULT 'America/Vancouver',
  default_checkin_time TIME DEFAULT '14:00',
  default_checkout_time TIME DEFAULT '11:00',
  
  -- Features
  amenities JSONB DEFAULT '[]',
  rules JSONB DEFAULT '[]',
  
  -- Status
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(tenant_id, slug)
);
```

**RLS**: Required (tenant-scoped)

---

### cc_units

```sql
CREATE TABLE cc_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id),
  facility_id UUID NOT NULL REFERENCES cc_facilities(id),
  asset_id UUID REFERENCES cc_assets(id),  -- Links to unified asset registry
  
  unit_number VARCHAR(50) NOT NULL,
  unit_type VARCHAR(50) NOT NULL,  -- 'slip', 'spot', 'stall', 'berth', 'pad'
  
  -- Dimensions
  length_ft DECIMAL(6, 1),
  width_ft DECIMAL(6, 1),
  depth_ft DECIMAL(6, 1),  -- For marina slips
  max_vessel_length_ft DECIMAL(6, 1),
  max_vessel_beam_ft DECIMAL(6, 1),
  max_vessel_draft_ft DECIMAL(6, 1),
  
  -- Hookups (parking/RV)
  power_amps INTEGER,
  has_water BOOLEAN DEFAULT false,
  has_sewer BOOLEAN DEFAULT false,
  has_wifi BOOLEAN DEFAULT false,
  
  -- Marina-specific
  has_shore_power BOOLEAN DEFAULT false,
  has_water_hookup BOOLEAN DEFAULT false,
  has_pump_out BOOLEAN DEFAULT false,
  
  -- Status
  status VARCHAR(20) DEFAULT 'available',
  is_reservable BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(facility_id, unit_number)
);
```

**RLS**: Required (tenant-scoped)

---

### cc_offers

```sql
CREATE TABLE cc_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id),
  portal_id UUID REFERENCES cc_portals(id),
  facility_id UUID REFERENCES cc_facilities(id),
  
  name VARCHAR(255) NOT NULL,
  offer_type VARCHAR(50) NOT NULL,  -- 'nightly', 'monthly', 'seasonal', 'transient'
  
  -- Base pricing
  base_rate DECIMAL(10, 2) NOT NULL,
  rate_unit VARCHAR(20) NOT NULL,  -- 'night', 'week', 'month', 'season'
  currency CHAR(3) DEFAULT 'CAD',
  
  -- Applicability
  unit_types VARCHAR(50)[] DEFAULT '{}',  -- Which unit types this applies to
  min_stay_nights INTEGER DEFAULT 1,
  max_stay_nights INTEGER,
  
  -- Validity
  valid_from DATE,
  valid_until DATE,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,  -- Higher = preferred when multiple match
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**RLS**: Required (tenant-scoped)

---

### cc_rate_rules

```sql
CREATE TABLE cc_rate_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id),
  offer_id UUID NOT NULL REFERENCES cc_offers(id),
  
  rule_type VARCHAR(50) NOT NULL,
  -- 'seasonal', 'weekday', 'length_of_stay', 'early_bird', 'last_minute', 'occupancy'
  
  -- Adjustment
  adjustment_type VARCHAR(20) NOT NULL,  -- 'percent', 'fixed'
  adjustment_value DECIMAL(10, 2) NOT NULL,  -- Positive = increase, Negative = discount
  
  -- Conditions (JSONB for flexibility)
  conditions JSONB NOT NULL DEFAULT '{}',
  -- Examples:
  -- { "months": [6, 7, 8] }  -- Summer
  -- { "days_of_week": [5, 6] }  -- Weekends
  -- { "min_nights": 7, "max_nights": 30 }  -- Length discounts
  -- { "days_advance": { "min": 30 } }  -- Early bird
  
  -- Validity
  valid_from DATE,
  valid_until DATE,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**RLS**: Required (tenant-scoped)

---

### cc_tax_rules

```sql
CREATE TABLE cc_tax_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id),
  
  jurisdiction_id UUID REFERENCES cc_tax_jurisdictions(id),
  tax_type VARCHAR(50) NOT NULL,  -- 'GST', 'PST', 'HST', 'MRDT'
  
  -- Rate
  rate_percent DECIMAL(5, 3) NOT NULL,
  
  -- Applicability
  applies_to VARCHAR(50)[] DEFAULT '{"accommodation"}',
  -- 'accommodation', 'equipment', 'services'
  
  -- Exemptions
  exempt_unit_types VARCHAR(50)[] DEFAULT '{}',
  min_stay_exempt INTEGER,  -- Exempt if stay >= N nights
  
  -- Validity
  effective_from DATE NOT NULL,
  effective_until DATE,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**RLS**: Required (tenant-scoped)

---

### cc_allocations

```sql
CREATE TABLE cc_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id),
  
  reservation_id UUID NOT NULL REFERENCES cc_reservations(id),
  unit_id UUID NOT NULL REFERENCES cc_units(id),
  
  -- Time range (may differ from reservation if multiple units)
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  -- Status
  status VARCHAR(20) DEFAULT 'confirmed',
  -- 'pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled'
  
  -- Tracking
  assigned_at TIMESTAMPTZ DEFAULT now(),
  assigned_by UUID,  -- Actor who made assignment
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Prevent double-booking
  UNIQUE(unit_id, start_date, end_date) 
    WHERE status NOT IN ('cancelled')
);
```

**RLS**: Required (tenant-scoped)

---

## Conflict Resolution Matrix

| V3.3.1 Concept | Existing Table | Resolution |
|----------------|----------------|------------|
| Facility | `cc_assets` (as container) | EXTEND with facility_id |
| Unit | `cc_assets` (as rentable) | EXTEND with unit_id, NEW cc_units |
| Offer | None | NEW cc_offers |
| Rate Rule | None | NEW cc_rate_rules |
| Tax Rule | `cc_tax_jurisdictions` exists | NEW cc_tax_rules, reference existing |
| Reservation | `cc_reservations` | MERGE (add columns) |
| Allocation | `cc_resource_schedule_events` | NEW cc_allocations, integrate |

---

## Migration Sequence

1. **Migration 076**: Create `cc_facilities` table
2. **Migration 077**: Create `cc_units` table
3. **Migration 078**: Create `cc_offers` table
4. **Migration 079**: Create `cc_rate_rules` table
5. **Migration 080**: Create `cc_tax_rules` table
6. **Migration 081**: Create `cc_allocations` table
7. **Migration 082**: Extend `cc_assets` with V3.3.1 columns
8. **Migration 083**: Extend `cc_reservations` with V3.3.1 columns
9. **Migration 084**: Extend `cc_resource_schedule_events`
10. **Migration 085**: Add RLS policies to new tables

---

## Backward Compatibility

All existing functionality preserved:
- `cc_assets` continues to work for vehicles, trailers, equipment
- `cc_reservations` continues to work for existing bookings
- Operations board (`cc_resource_schedule_events`) unchanged
- Existing API routes continue to function

New V3.3.1 features are additive only.

---

## Document History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-01-12 | 1.0 | Agent | Initial schema reconciliation |
