# COMMUNITY CANVAS — SCHEMA.ORG REFERENCE GUIDE

**Purpose:** Definitive mapping of all entity types to schema.org standards. Use this before creating ANY new data model.

---

## CORE TABLES → SCHEMA.ORG MAPPING

### assets table (schema_type column)

| asset_type (internal) | schema_type (schema.org) | Notes |
|-----------------------|--------------------------|-------|
| vehicle | Vehicle | Cars, trucks, vans |
| trailer | Vehicle | Trailers are vehicles (towed) |
| boat | BoatOrShip | Boats, ships, watercraft |
| kayak | Product | Or BoatOrShip if you want specificity |
| equipment | Product | Generic equipment |
| tool | Product | Hand tools, power tools |
| forklift | Vehicle | It's a vehicle |
| room | Room | schema.org/Room (subtype of Accommodation) |
| suite | Suite | schema.org/Suite |
| cottage | House | schema.org/House (subtype of Accommodation) |
| cabin | LodgingBusiness | Or House |
| bed | BedDetails | schema.org/BedDetails (for bed configuration) |
| camping_pitch | CampingPitch | schema.org/CampingPitch |
| slip | Place | Marina slip - no specific schema.org type |
| mooring | Place | Boat mooring |
| stall | Place | Parking stall |
| parking_spot | ParkingFacility | Or Place |
| table | Place | Restaurant table - no specific type, use Place |
| seat | Seat | schema.org/Seat exists! |
| desk | Place | Coworking desk |
| locker | Place | Storage locker |

### reservations table (schema_type column)

| Context | schema_type | Notes |
|---------|-------------|-------|
| Lodging (room, cottage, cabin) | LodgingReservation | schema.org/LodgingReservation |
| Restaurant (table) | FoodEstablishmentReservation | schema.org/FoodEstablishmentReservation |
| Boat/Kayak rental | BoatReservation | schema.org/BoatReservation |
| Vehicle rental | RentalCarReservation | schema.org/RentalCarReservation |
| Event ticket | EventReservation | schema.org/EventReservation |
| Generic/Other | Reservation | Base type |

### people table (schema_type column)

| Context | schema_type | Notes |
|---------|-------------|-------|
| Default | Person | schema.org/Person |
| (No subtypes commonly used) | Person | Person covers almost all cases |

### organizations table (schema_type column)

| org_type (internal) | schema_type | Notes |
|---------------------|-------------|-------|
| business | LocalBusiness | Generic local business |
| restaurant | Restaurant | schema.org/Restaurant |
| hotel | Hotel | schema.org/Hotel |
| resort | Resort | schema.org/Resort |
| campground | Campground | schema.org/Campground |
| marina | BoatTerminal | Or LocalBusiness |
| government | GovernmentOrganization | schema.org/GovernmentOrganization |
| municipality | GovernmentOrganization | City/town government |
| first_nation | GovernmentOrganization | With additionalType |
| chamber | Organization | Chamber of commerce |
| nonprofit | NGO | schema.org/NGO |
| corporation | Corporation | schema.org/Corporation |
| contractor | LocalBusiness | Or ProfessionalService |
| tour_operator | TouristInformationCenter | Or LocalBusiness |

### places table (schema_type column)

| place_type (internal) | schema_type | Notes |
|-----------------------|-------------|-------|
| city | City | schema.org/City |
| town | City | No Town type, use City |
| village | City | No Village type, use City |
| community | Place | Generic |
| region | AdministrativeArea | schema.org/AdministrativeArea |
| province | AdministrativeArea | Canadian province |
| state | State | schema.org/State (US) |
| country | Country | schema.org/Country |
| park | Park | schema.org/Park |
| beach | Beach | schema.org/Beach |
| lake | BodyOfWater | schema.org/BodyOfWater |
| river | BodyOfWater | |
| mountain | Mountain | schema.org/Mountain |
| island | Place | No Island type |
| ferry_terminal | BusStation | Or Place (no FerryTerminal) |
| airport | Airport | schema.org/Airport |
| marina | BoatTerminal | schema.org/BoatTerminal |
| campground | Campground | schema.org/Campground |
| trailhead | Place | No specific type |
| tourist_attraction | TouristAttraction | schema.org/TouristAttraction |

### articles table (schema_type column)

| article_type (internal) | schema_type | Notes |
|-------------------------|-------------|-------|
| article | Article | schema.org/Article |
| guide | Article | Or HowTo for instructional |
| story | Article | Editorial/narrative |
| review | Review | schema.org/Review |
| blog_post | BlogPosting | schema.org/BlogPosting |
| news | NewsArticle | schema.org/NewsArticle |
| how_to | HowTo | schema.org/HowTo |
| faq | FAQPage | schema.org/FAQPage |
| event_listing | Event | schema.org/Event |

---

## SCHEMA.ORG PROPERTY STANDARDS

### Vehicle Properties (for vehicles, trailers, boats)
```
schema.org/Vehicle properties:
- vehicleConfiguration (e.g., "tandem axle")
- vehicleModelDate
- vehicleSeatingCapacity
- weightTotal (for capacity)
- cargoVolume
- fuelType
- mileageFromOdometer
- vehicleIdentificationNumber (VIN)
- manufacturer
- model
- color
```

### Accommodation Properties (for rooms, cottages, cabins)
```
schema.org/Accommodation properties:
- accommodationCategory
- numberOfRooms
- numberOfBedrooms
- numberOfBathroomsTotal
- floorSize
- occupancy (max guests)
- petsAllowed
- amenityFeature
- bed (BedDetails)
- permittedUsage
```

### Product Properties (for equipment, tools, kayaks)
```
schema.org/Product properties:
- brand
- manufacturer
- model
- sku
- productID
- color
- material
- weight
- width/height/depth
- itemCondition (NewCondition, UsedCondition, etc.)
```

### Reservation Properties
```
schema.org/Reservation properties:
- reservationId
- reservationStatus (Confirmed, Cancelled, Pending, Hold)
- reservationFor (the thing being reserved)
- underName (Person making reservation)
- provider (Organization providing)
- bookingTime
- modifiedTime
- checkinTime / checkoutTime (for lodging)
- partySize (for restaurant)
- totalPrice
- priceCurrency
```

### Person Properties
```
schema.org/Person properties:
- name (full name)
- givenName
- familyName
- email
- telephone
- address
- jobTitle
- worksFor (Organization)
- memberOf
- knows (other Person)
```

### Organization Properties
```
schema.org/Organization properties:
- name
- legalName
- alternateName
- description
- url
- logo
- email
- telephone
- address
- location (Place)
- areaServed
- foundingDate
- numberOfEmployees
- naics (industry code)
- taxID
- vatID
```

### Place Properties
```
schema.org/Place properties:
- name
- alternateName
- description
- address
- geo (GeoCoordinates: latitude, longitude)
- telephone
- url
- openingHoursSpecification
- photo
- containsPlace
- containedInPlace
- amenityFeature
```

---

## THINGS SCHEMA.ORG DOESN'T HAVE (Use closest match)

| Concept | Best schema.org Match | Notes |
|---------|----------------------|-------|
| Trailer (vehicle) | Vehicle | Add description noting it's a trailer |
| Restaurant Table | Place | Or use custom additionalType |
| Marina Slip | Place | No specific type |
| Parking Stall | ParkingFacility or Place | |
| Work Request | Order or Demand | Not a great fit |
| Project | Project | Actually exists! schema.org/Project |
| Portal | N/A | Internal infrastructure |
| Crew | Organization? | Or custom |
| Service Run | Service + Action | Composite |

---

## FIELD NAMING CONVENTIONS

### Use schema.org property names when possible:

| Don't Use | Use Instead | schema.org |
|-----------|-------------|------------|
| first_name | given_name | givenName |
| last_name | family_name | familyName |
| phone | telephone | telephone |
| max_capacity | occupancy | occupancy |
| check_in | checkin_time | checkinTime |
| check_out | checkout_time | checkoutTime |
| lat | latitude | latitude |
| lng/lon | longitude | longitude |
| desc | description | description |
| img/image | photo | photo |
| pic | photo | photo |

---

## ADDING NEW ENTITY TYPES - CHECKLIST

Before creating ANY new table or entity type:

1. **Search schema.org first:** https://schema.org/docs/full.html
2. **Find the closest type** - there are 800+ types
3. **Check the properties** - use standard property names
4. **Document the mapping** - add to this reference guide
5. **Add schema_type column** - every content table needs it
6. **Consider subtypes** - schema.org has deep hierarchies

---

## SCHEMA.ORG HIERARCHY (Key Branches)

```
Thing
├── Action
├── CreativeWork
│   ├── Article
│   ├── Blog
│   ├── Review
│   ├── HowTo
│   └── Guide (not official, use Article)
├── Event
├── Intangible
│   ├── Reservation
│   │   ├── LodgingReservation
│   │   ├── FoodEstablishmentReservation
│   │   ├── RentalCarReservation
│   │   └── BoatReservation
│   ├── Service
│   └── Order
├── Organization
│   ├── LocalBusiness
│   │   ├── Restaurant
│   │   ├── Hotel
│   │   ├── Campground
│   │   └── (100+ subtypes)
│   ├── GovernmentOrganization
│   ├── Corporation
│   └── NGO
├── Person
├── Place
│   ├── Accommodation
│   │   ├── Room
│   │   ├── Suite
│   │   ├── House
│   │   ├── Apartment
│   │   └── CampingPitch
│   ├── CivicStructure
│   │   ├── Airport
│   │   ├── BusStation
│   │   └── ParkingFacility
│   ├── LocalBusiness (also under Organization)
│   ├── TouristAttraction
│   ├── Park
│   ├── Beach
│   └── BodyOfWater
└── Product
    ├── Vehicle
    │   ├── Car
    │   ├── Motorcycle
    │   └── BoatOrShip
    └── (generic products)
```

---

## RESOURCES

- **Full schema.org list:** https://schema.org/docs/full.html
- **Schema.org validator:** https://validator.schema.org/
- **Google Structured Data Testing:** https://search.google.com/test/rich-results

---

## RULE

> **Before creating any new entity type, table, or data structure:**
> 1. Search schema.org
> 2. Find the standard
> 3. Use the standard names
> 4. Document in this guide
> 
> **If it's not in schema.org, document WHY and what the closest match is.**
