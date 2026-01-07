# TASK: Set Up Real Bamfield Tenants & Inventory

This task replaces test data with real Bamfield-area businesses. This is SEED DATA for development and demonstration.

## IMPORTANT: Execute in Order

1. Create/Update Tenants
2. Create Users for tenants
3. Create Inventory items per tenant
4. Clean up old test data

---

## STEP 1: TENANTS

### 1.1 Rename Existing Tenant

**Rename "Ballman Enterprises" → "Woods End Landing"**
```
slug: woods-end-landing
name: Woods End Landing
legal_name: Ethans Landing Inc
dba: Woods End Landing
type: business
description: Waterfront cottages and marina on the Bamfield Inlet
```

### 1.2 Create New Tenants

Create these tenants (type: business unless noted):

```
TENANT: Woods End Marina
slug: woods-end-marina
description: Moorage on the Bamfield Inlet
Note: This could be a sub-tenant of Woods End Landing, but for now separate

TENANT: Save Paradise Parking
slug: save-paradise-parking
description: Secure parking for Bamfield visitors

TENANT: Bamfield Adventure Center
slug: bamfield-adventure-center
description: Kayak rentals and outdoor adventures
(May already exist - if so, keep it)

TENANT: Harbourside Lodge
slug: harbourside-lodge
description: Fishing charters and accommodations

TENANT: Lucky Lander Services
slug: lucky-lander-services
description: Barge and marine transport services

TENANT: Broken Island Adventures
slug: broken-island-adventures
description: Excavation and site services

TENANT: Flora Stays
slug: flora-stays
description: Boutique hotel accommodations

TENANT: Flora's Restaurant
slug: floras-restaurant
description: Fine dining and event space

TENANT: Lady Rose Marine
slug: lady-rose-marine
description: Passenger ferry and freight service on Barkley Sound
```

### 1.3 Delete Old Test Tenants

Remove these if they exist:
- Tenant A
- Tenant B
- UI-Smoke-Test-Debug
- Any tenant with "test" in the name (except for QA purposes)

Keep:
- Glenn Ballman (individual)
- Test User (for QA)
- Bamfield Community (government)
- Uchucklesaht Tribe Community (government)

---

## STEP 2: USERS

### 2.1 Create Users for Broken Island Adventures

```
USER: Sheryl Ferguson
email: sheryl@brokenislandadventures.com (placeholder)
Link to tenant: Broken Island Adventures
Role: admin

USER: John Mass  
email: john@brokenislandadventures.com (placeholder)
Link to tenant: Broken Island Adventures
Role: member
```

---

## STEP 3: INVENTORY BY TENANT

### 3.1 Woods End Landing - Accommodations

**Delete any existing inventory for this tenant first.**

**Structure: 6 Cottage Buildings → 7 Bookable Units (doors)**

```
ITEM: Woodsman Cottage
type: accommodation
booking_mode: check_in_out
bedrooms: 2
beds: 4 (double/almost queen)
sleeps: 4
description: Classic cottage with 2 bedrooms, 4 double beds

ITEM: Homesteader Cottage
type: accommodation
booking_mode: check_in_out
bedrooms: 2
beds: 4 (double/almost queen)
sleeps: 4
description: Comfortable cottage with 2 bedrooms, 4 double beds

ITEM: Beachcomber Cottage
type: accommodation
booking_mode: check_in_out
bedrooms: 2
beds: 4 (double/almost queen) + pullout couch
sleeps: 6
description: Spacious cottage with 2 bedrooms, 4 double beds, plus pullout couch

ITEM: Mariner Cottage
type: accommodation
booking_mode: check_in_out
bedrooms: 2
beds: 4 (double/almost queen)
sleeps: 4
description: Waterfront cottage with 2 bedrooms, 4 double beds

ITEM: Aviator Cottage
type: accommodation
booking_mode: check_in_out
bedrooms: 1
beds: 2 (bunk - double top and bottom)
sleeps: 4
description: Cozy cottage with 1 bedroom, double bunk beds

ITEM: Castaway Cottage
type: accommodation
booking_mode: check_in_out
bedrooms: 1
beds: 1 king + 2 large couches (7ft)
sleeps: 4
description: Premium cottage with king bed and two 7-foot couches
note: Stowaway Suite is attached to this building with separate entrance

ITEM: Stowaway Suite
type: accommodation
booking_mode: check_in_out
bedrooms: 0 (bachelor suite)
beds: 2 (bunk - double top and bottom)
sleeps: 4
parent_asset: Castaway Cottage
description: Bachelor suite with separate entrance, attached to Castaway Cottage
note: Shares building with Castaway Cottage but books independently
```

**Pricing notes (store as metadata or pricing config):**
```
Peak season: June 20 - September 5
Discounts:
  - Canadian visitors: 10% off
  - 2nd year returning: 15% off
  - 3rd year+ returning: 20% off
Discounts apply to: room nights, moorage
```

### 3.2 Woods End Marina - Moorage

Create 8 moorage slips:

```
For i = 1 to 8:
  ITEM: Slip {i}
  type: moorage
  booking_mode: arrive_depart
  max_length_ft: 24
  description: Moorage slip for boats up to 24 feet
  
Pricing: $2.00 per foot per night
Note: 8 slips at 24ft OR can accommodate 5 boats at 40ft (flexible allocation)
```

### 3.3 Save Paradise Parking - Stalls

Create parking inventory:

```
For i = 1 to 74:
  ITEM: Stall {i}
  type: parking
  booking_mode: arrive_depart
  
  If i <= 25:
    size_class: oversized
    description: Can accommodate truck + trailer
  Else:
    size_class: standard
    description: Standard vehicle up to 21 feet

Pricing:
  Peak season:
    - Standard (up to 21ft): $14/night
    - Oversized: $28/night
  Off-peak:
    - Flat rate: $100/month
```

### 3.4 Bamfield Adventure Center - Kayaks

Create kayak inventory:

```
For i = 1 to 18:
  ITEM: Sea Kayak Single - {i}
  type: rental
  booking_mode: pickup_return
  kayak_type: sea_kayak_single
  description: Single sea kayak for experienced paddlers

For i = 1 to 6:
  ITEM: Sea Kayak Double - {i}
  type: rental
  booking_mode: pickup_return
  kayak_type: sea_kayak_double
  description: Tandem sea kayak

For i = 1 to 10:
  ITEM: Day Kayak - {i}
  type: rental
  booking_mode: pickup_return
  kayak_type: day_kayak
  description: Day kayak suitable for beginners and children
  note: Appropriate for children under 12
```

**Total: 34 kayaks (18 single sea + 6 double sea + 10 day)**

**Pricing (all kayaks):**
```
duration_presets:
  - label: "Half Day (4 hours)", minutes: 240, price: 60
  - label: "Full Day (8 hours)", minutes: 480, price: 128
  - label: "24 Hours", minutes: 1440, price: 144
```

### 3.5 Harbourside Lodge - Fishing Charters

Create 3 charter boats:

```
ITEM: Charter Boat 1
type: charter
booking_mode: pickup_return
capacity: 4 adults
description: Fishing charter vessel

ITEM: Charter Boat 2
type: charter
booking_mode: pickup_return
capacity: 4 adults
description: Fishing charter vessel

ITEM: Charter Boat 3
type: charter
booking_mode: pickup_return
capacity: 4 adults
description: Fishing charter vessel

Pricing:
duration_presets:
  - label: "Half Day Charter", minutes: 240, price: 800
  - label: "Full Day Charter", minutes: 480, price: 1200
```

### 3.6 Lucky Lander Services - Marine Transport

**Move or recreate Lucky Lander:**

```
ITEM: Lucky Lander
type: watercraft
subtype: landing_craft
booking_mode: arrive_depart
description: Landing craft for vehicle and cargo transport
capacity: Vehicles up to F550 loaded weight
constraint: Max deck weight determines what can be transported

CHILD ASSET: Loading Crane
  parent: Lucky Lander
  type: equipment
  subtype: crane
  is_required: false
  description: Deck crane for loading freight
  note: When crane is down, Lucky Lander still operates but cannot load heavy freight
  
  Operational states:
    - operational: Full service available
    - degraded: Crane down - vehicle transport only, no heavy freight loading
    - out_of_service: Vessel not operating
```

Delete Lucky Lander from any other tenant (was under Ballman Enterprises).

---

### 3.6b Lady Rose Marine - Passenger & Freight Service

**Create new tenant and vessel:**

```
TENANT: Lady Rose Marine
slug: lady-rose-marine
description: Passenger ferry and freight service on Barkley Sound
```

```
ITEM: MV Francis Barkley
type: watercraft
subtype: passenger_freight_vessel
booking_mode: arrive_depart
description: Passenger ferry and freight vessel serving Barkley Sound
passenger_capacity: 100
freight_capable: true

CHILD ASSET: Loading Crane
  parent: MV Francis Barkley
  type: equipment
  subtype: crane
  is_required: false
  description: Deck crane for loading freight
  note: When crane is down, vessel still operates for passengers but freight loading limited
  
  Operational states:
    - operational: Full passenger + freight service
    - degraded: Crane down - passenger service only, no heavy freight
    - out_of_service: Vessel not operating
```

### 3.7 Broken Island Adventures - Equipment

**Move or recreate F550:**

```
ITEM: Ford F550 Gravel Truck
type: vehicle
booking_mode: pickup_return
description: Heavy-duty gravel truck - max capacity that fits on Lucky Lander
constraint: Heaviest truck that can cross on Lucky Lander loaded
owners: John Mass, Brian Baird (shared equipment)

ITEM: Mini Excavator
type: equipment
booking_mode: pickup_return
description: Compact excavator for site work

ITEM: Bobcat Skidsteer
type: equipment
booking_mode: pickup_return
description: Skid steer loader for material handling and site work

ITEM: Laser Level
type: equipment
booking_mode: pickup_return
description: Survey/grading laser level
note: Small equipment - may be loaned with other jobs

ITEM: Chainsaw
type: equipment
booking_mode: pickup_return
description: Professional chainsaw
note: Small equipment - may be loaned with other jobs
```

Delete F550 from any other tenant.

### 3.8 Flora Stays - Hotel Rooms

Create 8 hotel rooms:

```
For i = 1 to 8:
  ITEM: Room {i}
  type: accommodation
  booking_mode: check_in_out
  room_type: hotel_room
  description: Boutique hotel room
```

### 3.9 Flora's Restaurant - Tables

Create restaurant tables:

```
For i = 1 to 20:
  ITEM: Table {i}
  type: table
  booking_mode: pickup_return (for reservations)
  seats: 4
  description: 4-person dining table

For i = 21 to 26:
  ITEM: Table {i}
  type: table
  booking_mode: pickup_return
  seats: 8
  description: 8-person dining table (large party/event)
```

---

## STEP 4: CLEANUP

### 4.1 Remove Test Inventory

Delete from unified_assets:
- "Excavator" (was test item)
- "Cabin A" (was test item)
- "Parking Spot 1" (was test item)
- Any item with "test" or "QA" in name
- Any item with "No tenant" assigned

### 4.2 Remove Test Bookings

Delete any bookings associated with:
- Deleted tenants
- Deleted inventory items
- "QA Test Guest"

---

## VERIFICATION

After completion:

- [ ] Woods End Landing has 7 bookable units (6 cottages + Stowaway Suite attached to Castaway)
- [ ] Woods End Marina has 8 slips
- [ ] Save Paradise Parking has 74 stalls
- [ ] Bamfield Adventure Center has 34 kayaks (18 single sea + 6 double sea + 10 day)
- [ ] Harbourside Lodge has 3 charter boats
- [ ] Lucky Lander Services has Lucky Lander (with Loading Crane as child asset)
- [ ] Lady Rose Marine has MV Francis Barkley (with Loading Crane as child asset)
- [ ] Broken Island Adventures has F550, Mini Excavator, Bobcat Skidsteer, Laser Level, Chainsaw (5 items)
- [ ] Flora Stays has 8 rooms
- [ ] Flora's Restaurant has 26 tables (20×4 + 6×8)
- [ ] Sheryl Ferguson and John Mass are users for Broken Island Adventures
- [ ] No "Ballman Enterprises" exists
- [ ] No orphaned test data

---

## TENANT SUMMARY (For Reference)

| Tenant | Primary Offering | Item Count |
|--------|------------------|------------|
| Woods End Landing | Cottages (6 buildings, 7 units) | 7 |
| Woods End Marina | Moorage | 8 |
| Save Paradise Parking | Parking | 74 |
| Bamfield Adventure Center | Kayaks | 34 |
| Harbourside Lodge | Fishing Charters | 3 |
| Lucky Lander Services | Barge Transport | 1 (+crane) |
| Lady Rose Marine | Passenger/Freight Ferry | 1 (+crane) |
| Broken Island Adventures | Equipment | 5 |
| Flora Stays | Hotel Rooms | 8 |
| Flora's Restaurant | Tables | 26 |

BEGIN.
