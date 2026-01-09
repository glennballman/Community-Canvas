# Phase 4: Fleet & Cargo Management Specification

## Overview

This phase extends Community Canvas with comprehensive fleet vehicle management, trailer profiles, cargo tracking, and evidence-based check-in/check-out workflows. Designed for:

- **Work crews** sending trucks + trailers to remote job sites
- **RV rental companies** managing fleets with add-on equipment
- **Adventure tour operators** tracking kayaks, bikes, ATVs
- **Moving companies** with box trucks and equipment
- **Any organization** with multiple vehicles

---

## 4.1 Vehicle Photo/Video Documentation

### Purpose
Create an immutable evidence trail for vehicle condition at key moments:
- Fleet vehicle check-out by employee
- Fleet vehicle check-in by employee
- Rental car pickup
- Rental car return
- Insurance claims
- Damage disputes

### Data Model
```sql
CREATE TABLE vehicle_condition_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicle_profiles(id),
  
  -- Record type
  record_type VARCHAR(30) NOT NULL, -- check_out, check_in, inspection, incident, insurance_claim
  
  -- Who and when
  recorded_by UUID REFERENCES participant_profiles(id),
  recorded_by_name VARCHAR(255),
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Location
  location_name VARCHAR(255),
  location_lat DECIMAL(10, 7),
  location_lng DECIMAL(10, 7),
  
  -- Readings
  odometer_reading INTEGER,
  fuel_level VARCHAR(20), -- empty, 1/4, 1/2, 3/4, full
  fuel_level_photo_url VARCHAR(500),
  odometer_photo_url VARCHAR(500),
  
  -- Condition notes
  exterior_condition VARCHAR(20), -- excellent, good, fair, poor
  interior_condition VARCHAR(20),
  cleanliness VARCHAR(20), -- clean, acceptable, dirty, very_dirty
  
  -- Damage
  pre_existing_damage TEXT,
  new_damage_noted TEXT,
  damage_acknowledged BOOLEAN DEFAULT false,
  
  -- Signatures
  driver_signature_url VARCHAR(500),
  witness_signature_url VARCHAR(500),
  
  -- Video
  walkaround_video_url VARCHAR(500),
  walkaround_video_duration_seconds INTEGER,
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE vehicle_condition_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condition_record_id UUID NOT NULL REFERENCES vehicle_condition_records(id) ON DELETE CASCADE,
  
  photo_type VARCHAR(30) NOT NULL, -- front, rear, driver_side, passenger_side, roof, interior_front, interior_rear, cargo_area, damage_detail, odometer, fuel_gauge
  photo_url VARCHAR(500) NOT NULL,
  photo_order INTEGER DEFAULT 0,
  
  -- AI-detected issues (future)
  ai_detected_damage BOOLEAN DEFAULT false,
  ai_damage_description TEXT,
  ai_confidence DECIMAL(3,2),
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Photo Requirements

**Exterior (4-8 photos):**
1. Front (showing plate)
2. Rear (showing plate)
3. Driver side (full length)
4. Passenger side (full length)
5. Roof (if accessible or has rack)
6. Any existing damage (close-up)
7. Wheels/tires (optional)
8. Hitch area (if applicable)

**Interior (4-8 photos):**
1. Dashboard/instrument cluster
2. Front seats
3. Rear seats
4. Cargo area/trunk/bed
5. Any existing damage
6. Cleanliness issues
7. Fuel gauge (close-up)
8. Odometer (close-up)

**Video (60 seconds):**
- Continuous walkaround starting at driver door
- Full exterior circuit
- Open doors, show interior
- Show cargo area
- End on dashboard showing fuel/odometer
- Audio narration of any issues noted

### Workflow

**CHECK-OUT FLOW:**
1. Select vehicle from fleet
2. Confirm identity (driver)
3. Review previous check-in photos
4. Take new exterior photos (guided)
5. Take new interior photos (guided)
6. Record 60-second walkaround video
7. Note fuel level and odometer
8. Acknowledge pre-existing damage
9. Digital signature
10. Generate PDF receipt
11. Vehicle status -> "In Use by [Name]"

**CHECK-IN FLOW:**
1. Select vehicle being returned
2. Confirm identity
3. Take new exterior photos (guided)
4. Take new interior photos (guided)
5. Record 60-second walkaround video
6. Note fuel level and odometer
7. Compare to check-out photos (side-by-side)
8. Note any new damage
9. Digital signature
10. Generate PDF receipt
11. Vehicle status -> "Available" or "Needs Attention"

---

## 4.2 Fleet Identity & Nicknames

### Purpose
Real fleets don't say "the 2019 Ford F-350 with VIN ending 7842" - they say "Big Blue" or "Unit 42". Support human-friendly identification.

### Data Model Updates
```sql
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS nickname VARCHAR(100);
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS fleet_number VARCHAR(20);
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS fleet_status VARCHAR(30) DEFAULT 'available'; 
-- available, in_use, maintenance, retired

ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS assigned_to_id UUID REFERENCES participant_profiles(id);
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS assigned_to_name VARCHAR(255);
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS last_check_out TIMESTAMPTZ;
ALTER TABLE vehicle_profiles ADD COLUMN IF NOT EXISTS last_check_in TIMESTAMPTZ;
```

### UI Concept
```
+---------------------------------------------------+
| Fleet Vehicles                          [+ Add]   |
+---------------------------------------------------+
| +---------+                                       |
| | [Photo] |  "Big Blue" (T-042)                   |
| |         |  2019 Ford F-350 - White - Diesel     |
| |         |  [Available]                          |
| +---------+  Last: Returned by Pavel, 2 days ago  |
+---------------------------------------------------+
| +---------+                                       |
| | [Photo] |  "The Beast" (T-043)                  |
| |         |  2021 Isuzu NPR - White - Diesel      |
| |  [!]    |  [In Use: Mike T.]                    |
| +---------+  Checked out: Today 7:30am            |
+---------------------------------------------------+
| +---------+                                       |
| | [Photo] |  "Little Red" (T-044)                 |
| |         |  2020 Toyota Tacoma - Red - Gas       |
| |  [!]    |  [Maintenance Due]                    |
| +---------+  Oil change overdue by 500km          |
+---------------------------------------------------+
```

---

## 4.3 Trailer Profiles

### Purpose
Trailers are separate assets that:
- Get hitched to different vehicles
- Have their own registration/insurance
- Have their own capacity limits
- May be rented independently

### Data Model
```sql
CREATE TABLE trailer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  nickname VARCHAR(100),
  fleet_number VARCHAR(20),
  
  -- Ownership
  owner_type VARCHAR(20) NOT NULL, -- personal, company, rental
  organization_id UUID,
  
  -- Registration
  license_plate VARCHAR(20),
  registration_expiry DATE,
  vin VARCHAR(50),
  
  -- Type
  trailer_type VARCHAR(30) NOT NULL, -- enclosed_cargo, flatbed, utility, boat, car_hauler, dump, horse, rv_trailer, popup_camper
  
  -- Dimensions
  length_feet DECIMAL(4,1),
  width_feet DECIMAL(4,1),
  height_interior_feet DECIMAL(4,1),
  
  -- Capacity
  gvwr_lbs INTEGER, -- Gross Vehicle Weight Rating
  payload_capacity_lbs INTEGER,
  
  -- Hitch Requirements
  hitch_type VARCHAR(20), -- ball, gooseneck, fifth_wheel, pintle
  required_ball_size VARCHAR(20), -- 1_7_8, 2, 2_5_16
  tongue_weight_lbs INTEGER,
  
  -- Brakes
  brake_type VARCHAR(20), -- none, surge, electric, air
  
  -- Access
  gate_type VARCHAR(30), -- roll_up_door, swing_doors, ramp, lift_gate, drop_sides, none
  side_door BOOLEAN DEFAULT false,
  
  -- Features
  has_roof_rack BOOLEAN DEFAULT false,
  has_tie_downs BOOLEAN DEFAULT false,
  tie_down_count INTEGER,
  has_interior_lighting BOOLEAN DEFAULT false,
  has_electrical BOOLEAN DEFAULT false,
  
  -- Status
  fleet_status VARCHAR(30) DEFAULT 'available',
  currently_hitched_to UUID REFERENCES vehicle_profiles(id),
  
  -- Insurance
  insurance_company VARCHAR(255),
  insurance_expiry DATE,
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trailer photos
CREATE TABLE trailer_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trailer_id UUID NOT NULL REFERENCES trailer_profiles(id) ON DELETE CASCADE,
  photo_type VARCHAR(30), -- exterior_front, exterior_side, interior, hitch, damage
  photo_url VARCHAR(500) NOT NULL,
  photo_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Hitch Compatibility Check
```typescript
function canTow(vehicle: VehicleProfile, trailer: TrailerProfile): CompatibilityResult {
  const issues: string[] = [];
  const warnings: string[] = [];
  
  // Check towing capacity
  if (trailer.gvwr_lbs > vehicle.towing_capacity_lbs) {
    issues.push(`Trailer GVWR (${trailer.gvwr_lbs} lbs) exceeds vehicle towing capacity (${vehicle.towing_capacity_lbs} lbs)`);
  }
  
  // Check hitch type
  if (trailer.hitch_type === 'gooseneck' && !vehicle.has_gooseneck_hitch) {
    issues.push('Trailer requires gooseneck hitch - vehicle does not have one');
  }
  
  if (trailer.hitch_type === 'fifth_wheel' && !vehicle.has_fifth_wheel_hitch) {
    issues.push('Trailer requires fifth wheel hitch - vehicle does not have one');
  }
  
  // Check ball size
  if (trailer.hitch_type === 'ball' && vehicle.hitch_ball_size !== trailer.required_ball_size) {
    if (vehicle.hitch_ball_size) {
      warnings.push(`Ball size mismatch: vehicle has ${vehicle.hitch_ball_size}", trailer needs ${trailer.required_ball_size}"`);
    } else {
      issues.push(`Trailer requires ${trailer.required_ball_size}" ball hitch`);
    }
  }
  
  // Check brake controller
  if (trailer.brake_type === 'electric' && !vehicle.has_brake_controller) {
    issues.push('Trailer has electric brakes - vehicle needs brake controller');
  }
  
  // Check wiring
  if (trailer.wiring_type === '7_pin' && vehicle.trailer_wiring !== '7_pin') {
    warnings.push('May need wiring adapter (trailer is 7-pin)');
  }
  
  return {
    compatible: issues.length === 0,
    issues,
    warnings
  };
}
```

---

## 4.4 Onboard Equipment

### Purpose
Track what equipment lives IN or ON a vehicle:
- Racks and carriers (roof rack, bike rack, kayak saddles)
- Moving/securing equipment (straps, blankets, dollies)
- Tools and supplies

### Data Model
```sql
CREATE TABLE vehicle_equipment_types (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL, -- rack, carrier, securing, moving, tools, supplies
  description TEXT,
  
  -- Capacity (if applicable)
  capacity_type VARCHAR(30), -- bikes, kayaks, weight_lbs, items
  default_capacity INTEGER,
  
  icon VARCHAR(10),
  sort_order INTEGER DEFAULT 0
);

-- What's currently on/in this vehicle
CREATE TABLE vehicle_onboard_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicle_profiles(id) ON DELETE CASCADE,
  equipment_type_id VARCHAR(50) NOT NULL REFERENCES vehicle_equipment_types(id),
  
  quantity INTEGER DEFAULT 1,
  capacity INTEGER, -- e.g., bike rack holds 4 bikes
  condition VARCHAR(20),
  notes TEXT,
  
  -- Is it permanently installed or removable?
  installation_type VARCHAR(20) DEFAULT 'removable', -- permanent, removable, quick_release
  
  UNIQUE(vehicle_id, equipment_type_id)
);
```

### Seed Common Equipment
```sql
INSERT INTO vehicle_equipment_types (id, name, category, description, capacity_type, default_capacity, sort_order) VALUES
-- Racks & Carriers
('roof_rack', 'Roof Rack', 'rack', 'Crossbar roof rack system', 'weight_lbs', 150, 1),
('roof_cargo_box', 'Roof Cargo Box', 'rack', 'Hard-shell roof cargo carrier', 'weight_lbs', 100, 2),
('bike_rack_hitch', 'Bike Rack (Hitch)', 'carrier', 'Hitch-mounted bike carrier', 'bikes', 4, 3),
('bike_rack_roof', 'Bike Rack (Roof)', 'carrier', 'Roof-mounted bike carrier', 'bikes', 2, 4),
('kayak_saddles', 'Kayak Saddles/J-Hooks', 'carrier', 'Roof-mounted kayak carriers', 'kayaks', 2, 5),
('canoe_carrier', 'Canoe Carrier', 'carrier', 'Roof-mounted canoe carrier', 'items', 1, 6),
('ski_rack', 'Ski/Snowboard Rack', 'carrier', 'Roof-mounted ski carrier', 'items', 6, 7),
('ladder_rack', 'Ladder Rack', 'carrier', 'Truck bed or roof ladder rack', 'items', 2, 8),

-- Securing Equipment
('ratchet_straps', 'Ratchet Straps', 'securing', 'Heavy-duty tie-down straps', 'items', 4, 10),
('cam_straps', 'Cam Buckle Straps', 'securing', 'Quick-release straps for lighter loads', 'items', 4, 11),
('bungee_cords', 'Bungee Cords', 'securing', 'Elastic tie-downs', 'items', 6, 12),
('cargo_net', 'Cargo Net', 'securing', 'Mesh net for securing loose items', 'items', 1, 13),
('moving_blankets', 'Moving Blankets', 'securing', 'Padded blankets for protecting items', 'items', 6, 14),
('furniture_pads', 'Furniture Pads', 'securing', 'Heavy-duty padded covers', 'items', 4, 15),

-- Moving Equipment
('hand_truck', 'Hand Truck/Dolly', 'moving', 'Two-wheel hand truck', 'items', 1, 20),
('furniture_dolly', 'Furniture Dolly', 'moving', 'Four-wheel platform dolly', 'items', 1, 21),
('appliance_dolly', 'Appliance Dolly', 'moving', 'Heavy-duty appliance mover with straps', 'items', 1, 22),
('pallet_jack', 'Pallet Jack', 'moving', 'Manual pallet jack', 'items', 1, 23),
('loading_ramps', 'Loading Ramps', 'moving', 'Portable loading ramps', 'items', 2, 24),

-- Work Tools
('toolbox_truck', 'Truck Toolbox', 'tools', 'Bed-mounted locking toolbox', 'items', 1, 30),
('generator', 'Portable Generator', 'tools', 'Gas or battery generator', 'items', 1, 31),
('air_compressor', 'Portable Air Compressor', 'tools', '12V or portable compressor', 'items', 1, 32),
('work_lights', 'Work Lights', 'tools', 'Portable LED work lights', 'items', 2, 33);
```

---

## 4.5 Cargo Profile (Load Manifest)

### Purpose
Track what's LOADED on a vehicle/trailer for a specific trip:
- Calculate total weight, height, length
- Check against route restrictions
- Calculate ferry pricing
- Dangerous goods documentation
- Insurance value

### Data Model
```sql
-- Cargo item library (reusable items)
CREATE TABLE cargo_item_types (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL, -- recreation, work_materials, personal, dangerous_goods
  
  -- Default dimensions (can be overridden)
  default_weight_lbs INTEGER,
  default_length_inches INTEGER,
  default_width_inches INTEGER,
  default_height_inches INTEGER,
  
  -- Dangerous goods
  is_dangerous_good BOOLEAN DEFAULT false,
  dangerous_goods_class VARCHAR(20), -- Class 1-9, UN number
  dangerous_goods_name VARCHAR(255),
  
  -- Restrictions
  bc_ferries_allowed BOOLEAN DEFAULT true,
  bc_ferries_notes TEXT,
  requires_paperwork BOOLEAN DEFAULT false,
  
  icon VARCHAR(10),
  sort_order INTEGER DEFAULT 0
);

-- Actual cargo loaded for a trip
CREATE TABLE trip_cargo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What trip/vehicle
  trip_reservation_id UUID REFERENCES trip_reservations(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicle_profiles(id),
  trailer_id UUID REFERENCES trailer_profiles(id),
  
  -- The cargo item
  cargo_type_id VARCHAR(50) REFERENCES cargo_item_types(id),
  custom_description VARCHAR(255), -- If not from library
  
  quantity INTEGER DEFAULT 1,
  
  -- Actual dimensions (override defaults)
  weight_lbs INTEGER,
  length_inches INTEGER,
  width_inches INTEGER,
  height_inches INTEGER,
  
  -- Placement
  placement VARCHAR(30), -- cabin, bed, roof, trailer_interior, trailer_roof
  
  -- Value (for insurance)
  declared_value DECIMAL(10,2),
  
  -- Dangerous goods
  is_dangerous_good BOOLEAN DEFAULT false,
  dg_documentation_complete BOOLEAN DEFAULT false,
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Seed Cargo Types
```sql
INSERT INTO cargo_item_types (id, name, category, default_weight_lbs, default_length_inches, is_dangerous_good, bc_ferries_allowed, bc_ferries_notes, sort_order) VALUES
-- Recreation
('kayak_single', 'Kayak (Single)', 'recreation', 50, 144, false, true, NULL, 1),
('kayak_tandem', 'Kayak (Tandem)', 'recreation', 75, 180, false, true, NULL, 2),
('canoe', 'Canoe', 'recreation', 70, 192, false, true, NULL, 3),
('sup_board', 'Stand-Up Paddleboard', 'recreation', 25, 126, false, true, NULL, 4),
('bicycle', 'Bicycle', 'recreation', 30, 72, false, true, NULL, 5),
('ebike', 'E-Bike', 'recreation', 55, 72, false, true, 'Battery regulations may apply', 6),
('atv', 'ATV/Quad', 'recreation', 600, 84, false, true, 'Fuel tank max 1/4 full', 7),
('dirt_bike', 'Dirt Bike/Motorcycle', 'recreation', 250, 84, false, true, 'Fuel tank max 1/4 full', 8),
('snowmobile', 'Snowmobile', 'recreation', 500, 120, false, true, 'Fuel tank max 1/4 full', 9),
('jetski', 'Jet Ski/PWC', 'recreation', 800, 120, false, true, 'Fuel tank max 1/4 full', 10),
('small_boat', 'Small Boat (14ft)', 'recreation', 400, 168, false, true, NULL, 11),
('camping_gear', 'Camping Gear (per person)', 'recreation', 40, 36, false, true, NULL, 12),

-- Work Materials
('glass_panel', 'Glass Panel (large)', 'work_materials', 100, 96, false, true, 'Secure properly', 20),
('lumber_bundle', 'Lumber Bundle', 'work_materials', 500, 192, false, true, NULL, 21),
('pallet_materials', 'Pallet of Materials', 'work_materials', 1500, 48, false, true, NULL, 22),
('tool_chest', 'Tool Chest (large)', 'work_materials', 200, 48, false, true, NULL, 23),
('scaffolding', 'Scaffolding Set', 'work_materials', 300, 120, false, true, NULL, 24),
('ladder_extension', 'Extension Ladder', 'work_materials', 50, 288, false, true, NULL, 25),

-- Dangerous Goods (EXTRA CARE)
('propane_tank_20lb', 'Propane Tank (20lb)', 'dangerous_goods', 40, 18, true, true, 'Must be turned OFF. Max 2 tanks.', 30),
('propane_tank_100lb', 'Propane Tank (100lb)', 'dangerous_goods', 180, 48, true, true, 'Must be turned OFF. Notify crew.', 31),
('gasoline_jerry_can', 'Gasoline Jerry Can', 'dangerous_goods', 45, 18, true, true, 'Must be EMPTY on ferry', 32),
('diesel_jerry_can', 'Diesel Jerry Can', 'dangerous_goods', 50, 18, true, true, 'Must be EMPTY on ferry', 33),
('paint_flammable', 'Flammable Paint', 'dangerous_goods', 30, 12, true, true, 'Check quantity limits', 34),
('compressed_gas', 'Compressed Gas Cylinder', 'dangerous_goods', 40, 36, true, false, 'NOT ALLOWED on BC Ferries', 35);
```

### Calculate Cargo Totals
```sql
CREATE OR REPLACE FUNCTION calculate_cargo_totals(p_trip_reservation_id UUID)
RETURNS TABLE (
  total_weight_lbs INTEGER,
  max_height_inches INTEGER,
  total_length_inches INTEGER,
  dangerous_goods_count INTEGER,
  declared_value_total DECIMAL(10,2),
  ferry_warnings TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    SUM(COALESCE(tc.weight_lbs, ct.default_weight_lbs) * tc.quantity)::INTEGER as total_weight_lbs,
    MAX(COALESCE(tc.height_inches, ct.default_height_inches))::INTEGER as max_height_inches,
    SUM(COALESCE(tc.length_inches, ct.default_length_inches))::INTEGER as total_length_inches,
    SUM(CASE WHEN tc.is_dangerous_good OR ct.is_dangerous_good THEN tc.quantity ELSE 0 END)::INTEGER as dangerous_goods_count,
    SUM(tc.declared_value)::DECIMAL as declared_value_total,
    ARRAY_AGG(DISTINCT ct.bc_ferries_notes) FILTER (WHERE ct.bc_ferries_notes IS NOT NULL) as ferry_warnings
  FROM trip_cargo tc
  JOIN cargo_item_types ct ON tc.cargo_type_id = ct.id
  WHERE tc.trip_reservation_id = p_trip_reservation_id;
END;
$$ LANGUAGE plpgsql;
```

### Cargo Builder UI Concept
```
+---------------------------------------------------------------+
| Cargo Profile: Bamfield Job Run                               |
+---------------------------------------------------------------+
| Vehicle: "Big Blue" (Ford F-350)     Trailer: "T-07" (Enclosed)|
+---------------------------------------------------------------+
|                                                               |
|  TRUCK BED                          TRAILER                   |
|  +----------------------+          +-------------------------+|
|  | Glass Panels (4)     |          | Tool Chest              ||
|  | Weight: 400 lbs      |          | Scaffolding             ||
|  | [!] Fragile          |          | Materials (2 pallets)   ||
|  +----------------------+          | Fuel cans (EMPTY)       ||
|                                    +-------------------------+|
|  ROOF RACK                                                    |
|  +----------------------+                                     |
|  | Kayaks (2)           | <- Adds 18" to height!             |
|  | Weight: 100 lbs      |                                     |
|  +----------------------+                                     |
|                                                               |
+---------------------------------------------------------------+
| TOTALS                                                        |
| - Total Weight: 3,850 lbs (Capacity: 5,000) [OK]              |
| - Total Height: 11'2" [!] Check bridge clearances             |
| - Total Length: 45' (Truck + Trailer)                         |
| - Ferry Class: Over 40ft + Overheight = $$$                   |
| - Dangerous Goods: 0 [OK]                                     |
+---------------------------------------------------------------+
| [!] WARNINGS                                                  |
| - Kayaks on roof increase height to 11'2"                     |
| - Check clearance at Cameron Lake tunnels (12' clearance)     |
| - Fuel cans must be EMPTY for BC Ferries                      |
+---------------------------------------------------------------+
| [+ Add Item]  [Calculate Ferry Cost]  [Generate Manifest PDF] |
+---------------------------------------------------------------+
```

---

## 4.6 Implementation Priority

### Phase 4A: Fleet Basics (Week 1)
- [ ] Vehicle nicknames and fleet numbers
- [ ] Fleet status (available/in-use/maintenance)
- [ ] Fleet dashboard view
- [ ] Basic photo upload for vehicles

### Phase 4B: Check-In/Check-Out (Week 2)
- [ ] Condition record workflow
- [ ] Guided photo capture (8 exterior, 8 interior)
- [ ] 60-second walkaround video capture
- [ ] Fuel/odometer recording
- [ ] Digital signature
- [ ] PDF receipt generation

### Phase 4C: Trailers (Week 3)
- [ ] Trailer profiles
- [ ] Hitch compatibility checker
- [ ] Trailer-vehicle assignment
- [ ] Trailer condition records

### Phase 4D: Cargo Management (Week 4)
- [ ] Cargo item library
- [ ] Cargo profile builder
- [ ] Weight/dimension calculator
- [ ] Ferry cost estimator
- [ ] Dangerous goods warnings
- [ ] Cargo manifest PDF

### Phase 4E: Integration (Week 5)
- [ ] Route planner integration (clearance checks)
- [ ] BC Ferries pricing integration
- [ ] Insurance value tracking
- [ ] Dangerous goods paperwork generation

---

## 4.7 Future Considerations

### CivOS Integration
- Fleet vehicles registered with provincial system
- Driver credentials verified against CivOS
- Insurance/registration automatically validated

### Genesis Exchange Integration
- Company fleet management
- Employee vehicle assignments
- Job dispatch with vehicle allocation
- Maintenance scheduling

### AI Enhancements
- Photo analysis for damage detection
- Automatic vehicle spec lookup by VIN
- Voice-guided walkaround video
- OCR for registration/insurance documents

---

## Summary

This phase transforms Community Canvas from a trip planner into a comprehensive **fleet and logistics management system** that handles:

1. **Evidence-based vehicle handoffs** (photos, video, signatures)
2. **Fleet identity** (nicknames, numbers, assignments)
3. **Trailer management** (separate profiles, hitch compatibility)
4. **Onboard equipment** (racks, straps, dollies)
5. **Cargo profiles** (load manifests, weight/dimension tracking)
6. **Safety compliance** (dangerous goods, ferry restrictions)

This serves work crews, RV rentals, adventure tours, and any organization managing vehicles and cargo.
