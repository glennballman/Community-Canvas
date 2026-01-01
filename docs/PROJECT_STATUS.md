# BC COMMUNITY STATUS DASHBOARD - PROJECT STATUS CAPSULE
## Last Updated: December 31, 2024

---

# PROJECT OVERVIEW

## What We're Building
A comprehensive **BC Community Status Dashboard** that integrates with **CivOS** (Civilization OS), a sovereign-grade governmental operating system launching January 5th. The system bridges local community intelligence with government-level decision making.

## Dual Purpose
1. **AI-Powered Trip Planning** - Complex routing considering ferries, road conditions, weather, accommodation, equipment requirements
2. **Government Emergency Operations** - Real-time community-level intelligence for decision making

## User Profile
- **Glenn** - Experienced tech executive, hasn't coded for 25 years
- **Prefers GUI-based development** (Replit)
- **Primary environment**: Replit with PostgreSQL

## Key Integration
- **CivOS Launch**: January 5th
- **Integration Method**: Cursor-based synchronization with provenance tracking
- **Data Export**: Real-time signals to government systems

---

# CURRENT STATE

## Phase Status
| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1-3 | Complete | Core dashboard, municipalities, data sources |
| Phase 4 | In Progress | Fleet & Cargo Management |
| Phase 4A | Complete | Research: Liftgates, hitches, doors |
| Phase 45 | Complete | Database schema, API routes, Fleet UI |
| Phase 46 | Complete | VehicleForm, cleanup, route preview, trailer research |
| Phase 4B | Complete | Horse, LQ, Work, Equipment tabs (50+ fields) |
| Phase 4C | Complete | Overlander, Tiny Home, Specialty Equipment tabs |
| **Phase 47** | Ready | Trailer system cleanup, driver qualifications |

## Data Scope
- **238 data sources** across **29 municipalities** and **26 categories**
- **10,600+ entities** (airports, weather stations, hospitals, SAR groups, schools, chamber members)
- Geographic coverage: All of British Columbia

---

# DATABASE SCHEMA

## Core Tables (Implemented)

### participant_profiles
Driver/participant information with qualifications.

```sql
-- Key fields (existing)
id, user_id, full_name, email, phone, emergency_contact
role (driver, passenger, crew, coordinator)
medical_conditions, dietary_restrictions, mobility_requirements

-- Driver qualifications (added in migration 009):
license_class VARCHAR(10)           -- 1,2,3,4,5,6,7,8,L,N (BC)
license_province VARCHAR(20)
license_expiry DATE
has_air_brake_endorsement BOOLEAN
has_house_trailer_endorsement BOOLEAN   -- BC Code 07
has_heavy_trailer_endorsement BOOLEAN   -- BC Code 20
heavy_trailer_medical_expiry DATE       -- Required every 3 years
max_trailer_weight_certified_kg INTEGER
fifth_wheel_experience BOOLEAN
gooseneck_experience BOOLEAN
horse_trailer_experience BOOLEAN
boat_launching_experience BOOLEAN
double_tow_experience BOOLEAN           -- For AB/SK/MB travel
rv_driving_course_completed BOOLEAN
```

### vehicle_profiles
Fleet vehicles with towing capabilities.

```sql
-- Key fields (implemented in Phase 45)
id, user_id, nickname, fleet_number
year, make, model, color, vin, license_plate
vehicle_type ENUM (sedan, suv, pickup_truck, van, cargo_van, box_truck, flatbed, rv_class_a/b/c, motorcycle, other)

-- Towing specs
towing_capacity_lbs, payload_capacity_lbs, gvwr_lbs, gcwr_lbs
curb_weight_lbs, tongue_weight_capacity_lbs
hitch_type (none, bumper_pull, gooseneck, fifth_wheel, pintle)
hitch_class (I, II, III, IV, V)
ball_size (1_7_8, 2, 2_5_16)
has_brake_controller, brake_controller_type
wiring_type (4_pin_flat, 5_pin_flat, 6_pin_round, 7_pin_rv_blade, 7_pin_round)
has_tow_mirrors, has_weight_distribution_hitch, has_sway_control

-- Cargo specs
cargo_length_inches, cargo_width_inches, cargo_height_inches
cargo_volume_cubic_feet, has_liftgate, liftgate_type, liftgate_capacity_lbs
door_type, door_width_inches, door_height_inches
has_tie_downs, tie_down_count, has_e_track, e_track_length_feet
floor_type, has_climate_control, climate_control_type
```

### trailer_profiles
All trailer types with comprehensive specifications.

```sql
-- Key fields (implemented in Phase 45)
id, user_id, nickname, fleet_number
year, make, model, color, vin, license_plate
trailer_type TEXT (see comprehensive list below)

-- Dimensions
length_feet, width_feet, height_feet
interior_length_inches, interior_width_inches, interior_height_inches
cargo_volume_cubic_feet

-- Weight
gvwr_lbs, payload_capacity_lbs, empty_weight_lbs, tongue_weight_lbs

-- Hitch requirements
required_hitch_type, required_ball_size, coupler_height_inches

-- Axles/Brakes
axle_count, axle_capacity_lbs, brake_type (none, surge, electric, air)
breakaway_switch, suspension_type

-- Wiring
wiring_type, lighting_type

-- Cargo features
has_ramp, ramp_type, ramp_capacity_lbs
door_type_rear, door_type_side
has_tie_downs, tie_down_count, has_e_track
floor_type, has_roof_vent

-- Horse/Livestock (migration 007)
is_horse_trailer, stall_count, horse_capacity, loading_type
has_living_quarters, lq_short_wall_feet, has_lq_ac, has_lq_heat
has_lq_bathroom, has_lq_shower, has_lq_kitchen, lq_awning_length_feet
is_livestock_trailer, livestock_type, deck_count

-- Work trailer fields
has_workbench, has_tool_storage, power_outlets_count
has_compressor_mount, has_generator_mount

-- Equipment trailer fields
is_equipment_trailer, deck_type, deck_height_inches
has_beavertail, has_air_ride, has_flip_ramps

-- Overlander (migration 008)
is_overlander, ground_clearance_inches, approach_angle_degrees
departure_angle_degrees, breakover_angle_degrees
offroad_suspension_type, tire_type, tire_size
has_rooftop_tent_mount, has_awning_mounts, has_recovery_points
has_rock_sliders, roof_rack_type, has_slide_out_kitchen
kitchen_side, has_outdoor_shower, outdoor_shower_type
has_exterior_speakers, water_storage_gallons, fuel_storage_gallons

-- Tiny Home (migration 008)
is_tiny_home, thow_certification, thow_square_feet
thow_four_season, registered_as, has_full_kitchen
has_washer_dryer, loft_count, thow_composting_toilet, thow_incinerating_toilet

-- Specialty Equipment (migration 008)
is_specialty_equipment, equipment_type, equipment_make, equipment_model
equipment_hp, equipment_power_type, license_plate_exempt
requires_setup_time, setup_time_minutes, requires_level_ground, has_outriggers
sawmill_max_log_diameter_inches, sawmill_max_log_length_feet, sawmill_cut_width_inches
welder_amp_rating, generator_kw_rating, generator_voltage, generator_phase
pressure_washer_psi, pressure_washer_gpm, water_tank_gallons
compressor_cfm, compressor_psi_max, tank_gallons
light_tower_height_feet, light_output_lumens, light_coverage_acres
fuel_tank_capacity_gallons, fuel_type_stored, has_fuel_pump
mixer_capacity_cubic_yards, mixer_drum_rpm
```

### provincial_towing_regulations (migration 010)
Reference table for provincial towing regulations.

```sql
id, province_code, province_name
standard_license_max_trailer_kg, house_trailer_endorsement_code
house_trailer_endorsement_threshold_kg, heavy_trailer_endorsement_code
heavy_trailer_endorsement_threshold_kg, air_brake_endorsement_required_threshold_kg
commercial_required_threshold_kg, double_tow_allowed, double_tow_requirements
max_trailer_length_m, max_combination_length_m, max_trailer_width_m
brakes_required_threshold_kg, driver_accessible_brakes_threshold_kg
notes, effective_date
```

### Supporting Tables
- `municipalities` - BC municipalities
- `data_sources` - 238 data source definitions
- `entities` - 10,600+ infrastructure entities
- `weather_stations` - Weather data points
- `bc_ferries_routes` - Ferry route information
- `chambers_of_commerce` - Chamber member businesses

---

# FILE INVENTORY

## Backend (server/)
```
server/
├── routes/
│   └── fleet.ts              # ~700 lines, 15+ endpoints with ALLOWED_TRAILER_COLUMNS whitelist
├── migrations/
│   ├── 007_horse_livestock_equipment.sql   # Horse, livestock, work, equipment fields
│   ├── 008_overlander_specialty.sql        # Overlander, tiny home, specialty equipment
│   ├── 009_driver_qualifications.sql       # Driver license/endorsement fields
│   └── 010_provincial_regulations.sql      # Provincial towing regulations table
├── db/
│   └── schema.ts             # Drizzle schema definitions
└── index.ts                  # Express server setup
```

## Frontend (client/src/)
```
client/src/
├── components/
│   └── Fleet/
│       ├── FleetDashboard.tsx    # ~600 lines, main fleet UI
│       ├── VehicleForm.tsx       # ~800 lines, 4-tab form
│       ├── TrailerForm.tsx       # ~5200 lines, 9-tab form with conditional rendering
│       ├── VehicleCard.tsx       # Vehicle display card
│       ├── TrailerCard.tsx       # Trailer display card
│       └── index.ts              # Exports
├── pages/
│   └── (various dashboard pages)
└── lib/
    └── (utilities)
```

## Documentation (docs/)
```
docs/
├── PHASE4_FLEET_CARGO_MANAGEMENT.md    # Phase 4 vision document
└── PROJECT_STATUS.md                    # THIS FILE
```

---

# TRAILER TYPE SYSTEM (COMPREHENSIVE)

## Categories & Types

### RV / Recreation
| Type | Description |
|------|-------------|
| rv_travel_trailer | Standard bumper pull RV |
| rv_fifth_wheel | Fifth wheel RV over truck bed |
| rv_toy_hauler | RV with rear garage |
| rv_popup | Collapsible popup camper |
| rv_teardrop | Small teardrop camper |
| rv_truck_camper | Slide-in truck camper |
| park_model_rv | Semi-permanent (400 sq ft max) |

### Overlander / Expedition
| Type | Description |
|------|-------------|
| overlander | Off-road cargo/camping, rooftop tent |
| overlander_teardrop_offroad | Off-road teardrop |
| overlander_popup_offroad | Off-road popup |

### Tiny Home
| Type | Description |
|------|-------------|
| tiny_home | Tiny House on Wheels |

### Horse Trailers
| Type | Description |
|------|-------------|
| horse_straight_load | Horses face forward, side-by-side |
| horse_slant_load | Horses at 45 angle (most popular) |
| horse_reverse_slant | Head to passenger side (rare) |
| horse_head_to_head | 4-6 horses facing each other |
| horse_stock_combo | Stock trailer with horse dividers |
| horse_box_stall | Open box stalls |
| horse_2_plus_1 | 2 rear + 1 front box stall |
| horse_lq | Horse trailer with living quarters |

### Livestock
| Type | Description |
|------|-------------|
| livestock_stock | Open slat sides, general livestock |
| livestock_pot | Double-deck cattle pot |
| livestock_sheep_deck | Multi-level for sheep/goats |
| livestock_hog | Punch floor for swine |

### Enclosed / Work
| Type | Description |
|------|-------------|
| enclosed_cargo | Basic enclosed cargo |
| enclosed_contractor | Shelving, bins, tool storage |
| enclosed_mobile_workshop | Full workshop with workbench, power |
| food_truck_concession | Food service trailer |
| mobile_office | Construction site office |

### Utility
| Type | Description |
|------|-------------|
| utility_open | Basic open utility |
| utility_landscape | Landscape with mesh sides |

### Vehicle Transport
| Type | Description |
|------|-------------|
| car_hauler_open | Open flatbed for vehicles |
| car_hauler_enclosed | Enclosed vehicle transport |
| motorcycle_trailer | 1-3 motorcycles |
| snowmobile_trailer | Snowmobile transport |
| atv_utv_trailer | ATV/UTV transport |

### Boat / Marine
| Type | Description |
|------|-------------|
| boat_bunk | Bunk-style boat trailer |
| boat_roller | Roller boat trailer |
| boat_pwc | Personal watercraft (jet ski) |
| boat_pontoon | Pontoon boat trailer |
| boat_sailboat | With mast support |
| kayak_canoe_trailer | Multi-boat (4-12+) |

### Heavy Equipment
| Type | Description |
|------|-------------|
| flatbed_standard | Standard flat deck |
| flatbed_tilt | Hydraulic tilt deck |
| flatbed_dovetail | Beavertail rear |
| flatbed_deckover | Deck over wheels |
| equipment_step_deck | Drop deck (10'2" max height) |
| equipment_lowboy | Fixed gooseneck (11'6" max) |
| equipment_rgn | Removable gooseneck (12' max) |
| equipment_double_drop | High-low-high deck |
| equipment_stretch | Extendable length |

### Dump
| Type | Description |
|------|-------------|
| dump_standard | End dump, bumper pull |
| dump_gooseneck | Heavy duty GN dump |
| dump_side_dump | Side discharge |
| dump_belly_dump | Bottom discharge |

### Specialty Equipment
| Type | Description |
|------|-------------|
| specialty_equipment | Generic specialty equipment |
| portable_sawmill | Portable bandsaw (Wood-Mizer) |
| log_splitter | Towable hydraulic splitter |
| welding_rig | Mobile welding rig |
| pressure_washer | Pressure wash trailer |
| generator_trailer | Towable generator |
| air_compressor | Industrial compressor |
| light_tower | Mobile light tower |
| fuel_transfer | Fuel tank with pump |
| concrete_mixer | Towable mixer |

### Mobile Services
| Type | Description |
|------|-------------|
| mobile_medical | Mobile clinic |
| mobile_command | Emergency command |
| mobile_stage | Performance stage |
| restroom_shower | Portable restroom trailer |

---

# DRIVER LICENSING REQUIREMENTS

## BC Thresholds

| Trailer Weight | License Required |
|----------------|------------------|
| <= 4,600 kg (10,141 lbs) | Class 5/7 OK |
| > 4,600 kg house/toy hauler | **Code 07** House Trailer Endorsement |
| > 4,600 kg other trailers | **Code 20** Heavy Trailer Endorsement |
| Any trailer with air brakes <=4,600 kg | **Air Brake Endorsement** |
| Air brakes + >4,600 kg | **Class 1 Commercial** |

## BC Limits
- Max motorized RV: **14m** (46 ft)
- Max towed trailer: **12.5m** (41 ft)
- Max combination: **20m** (65.6 ft)
- Max width: **2.6m** (8.5 ft)
- Brakes required on all wheels: **>1,400 kg** (3,086 lbs)
- Driver-accessible brakes: **>2,800 kg** (6,173 lbs)

## Double Towing by Province

| Province | Allowed? | Requirements |
|----------|----------|--------------|
| **BC** | NO | Commercial only (car dolly exception) |
| **Alberta** | YES | Fifth wheel lead w/ 2+ tandem axles, <=20m, longer trailer first |
| **Saskatchewan** | YES | Fifth wheel lead required |
| **Manitoba** | YES | Fifth wheel lead required |
| **Nova Scotia** | YES | Fifth wheel lead required |
| **Ontario** | NO | Commercial only |

---

# COMPLETED RESEARCH

## Phase 4A - Equipment Research
- Liftgate types (tuck-under, rail gate, cantilever, column lift, sideloader)
- Liftgate capacities (1,500-6,600 lbs)
- Trailer hitch systems (bumper pull, gooseneck, fifth wheel, pintle)
- Conversion options (gooseneck to fifth wheel, etc.)
- Trailer door types (barn, ramp, roll-up, sliding)
- Swing clearances and width measurements

## Phase 46 - RV & Cargo Research
- RV rentals (Class A/B/C motorhomes)
- Sleep capacities, tank systems, power systems
- Slideouts, climate control specs
- Cargo vans (standard/high-roof, 250-450 cu ft)
- Box trucks (10-26 ft, 450-1,682 cu ft)
- Trailer wiring (4-pin through 7-pin connectors)
- Brake controllers (proportional, time-delayed, integrated)

## Phase 46 - Work, Horse & Heavy Transport Research
- Horse trailer loading configs (slant, straight, HTH, stock)
- Living quarters specifications (short wall sizing, amenities)
- RVIA certification vs RV registration
- Enclosed contractor trailer layouts
- Heavy transport (step deck, lowboy, RGN)
- Deck heights and load clearances

## Phase 46/47 - Cleanup Research
- Overlander/expedition trailers
- Tiny Homes on Wheels (THOW) - RVIA/NOAH certification
- Specialty equipment (sawmills, welders, generators)
- Driver licensing requirements by province
- Double towing regulations (BC vs Alberta)
- Weight thresholds for endorsements

---

# PHASE 47 - REMAINING TASKS

## Completed in Phase 4B/4C
- Migration 007: Horse, livestock, work, equipment fields
- Migration 008: Overlander, tiny home, specialty equipment fields
- Migration 009: Driver qualification fields on participant_profiles
- Migration 010: Provincial towing regulations table with BC/AB data
- TrailerForm tabs: Horse, LQ, Work, Equipment (Phase 4B)
- TrailerForm tabs: Overlander, Tiny Home, Specialty Equipment (Phase 4C)
- ALLOWED_TRAILER_COLUMNS whitelist updated
- All data-testid attributes added

## Still Needed for Phase 47
- [ ] UI for driver qualification fields (participant profile form)
- [ ] check_driver_trailer_qualification() function
- [ ] Warning badges on Fleet Dashboard for unqualified drivers
- [ ] BC Ferries classification field integration
- [ ] Compatibility checking when assigning driver to trailer

---

# KEY DECISIONS MADE

| Decision | Rationale |
|----------|-----------|
| Horse LQ trailers are NOT RVs | Primary function is hauling horses - California DMV explicit |
| Tiny Homes need RVIA/NOAH cert | Required for RV parks, insurance, resale |
| 4,600 kg is BC threshold | Matches ICBC licensing requirements |
| Store driver endorsements with dates | Medical expires every 3 years for heavy |
| Track double-tow experience | Legal in AB/SK/MB but not BC |
| Include specialty equipment | Sawmills, welders are common in rural BC |
| BC Ferry classification field | Needed for trip planning (overheight, dangerous goods) |
| Use TEXT columns not ENUMs | More flexible for adding new types without migrations |

---

# ARCHITECTURE NOTES

## 10-Layer Data Model
Every entity should have:
1. **Identity** - What it is
2. **Configuration** - How it's set up
3. **Real-time Status** - Current state
4. **Capacity** - What it can handle
5. **Environmental Context** - Weather, conditions
6. **Pricing** - Costs, fees
7. **Demand Patterns** - Usage trends
8. **Reputation** - Ratings, reviews
9. **Connections** - Relationships to other entities
10. **Provenance** - Data source, freshness

## Critical Architectural Insight
> "Impressive frontend systems can mask fundamental data storage problems."

The discovery that extensive TypeScript code was serving as the primary data store rather than the database highlighted the importance of proper data architecture.

---

# SUCCESS CRITERIA

## Phase 47 Complete When:
- [x] All new trailer types in enum
- [x] Overlander/Tiny Home/Specialty fields in schema
- [x] Driver qualification fields in schema
- [x] provincial_towing_regulations table seeded (BC, AB minimum)
- [x] TrailerForm shows all categories with conditional fields
- [ ] Driver profile shows license/endorsement section
- [ ] check_driver_trailer_qualification() function works
- [ ] Fleet Dashboard shows qualification warnings

## Integration Ready When:
- [ ] All fleet data in PostgreSQL (not TypeScript files)
- [ ] API endpoints return real data
- [ ] Cursor-based sync ready for CivOS
- [ ] BC Ferries classification working
- [ ] Route suitability includes trailer compatibility

---

*This document is the single source of truth for project continuity. Update after each major phase completion.*
