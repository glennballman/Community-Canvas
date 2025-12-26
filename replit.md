# Community Status Dashboard

## Overview

A Bloomberg-terminal style community status dashboard covering all of British Columbia. Features dual-view mode (Sources View for data source URLs, Data View for live monitoring), 4-column layout, comprehensive admin tools, hierarchical source inheritance (Provincial → Regional → Municipal), and complete geographic navigation covering all 27 BC regional districts and 161+ municipalities.

### Ground Transportation Tabs (Criticality-Based)
Ground transportation is organized into 6 tabs by criticality for community resilience monitoring:
- **Ground - Lifeline** (Tier 1): Fuel/energy distributors, food/grocery distribution, hazmat (propane) - critical to survival
- **Ground - Supply Chain** (Tier 2): General freight, LTL, refrigerated, logging, aggregate, rail freight - economic function
- **Ground - Bus** (Tier 3): Transit systems, intercity buses, charter services, passenger/commuter/tourist rail - community movement
- **Ground - Taxi** (Tier 3): Traditional taxi, accessible/wheelchair, eco-friendly, airport taxi services - on-demand mobility
- **Ground - Courier** (Tier 4): Express couriers, regional carriers, same-day delivery - delivery services
- **Ground - Postal** (Tier 4): Canada Post facilities - federal postal service

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript, using Vite as the build tool
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state and caching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom dark theme configuration and CSS variables
- **Animations**: Framer Motion for smooth transitions and entry animations

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ESM modules
- **API Design**: REST endpoints defined in `shared/routes.ts` with Zod validation schemas
- **Build Process**: Custom build script using esbuild for server bundling and Vite for client

### Data Layer
- **Database**: PostgreSQL with Drizzle ORM
- **Schema**: Single `snapshots` table storing location-based status data as JSONB
- **Migrations**: Drizzle Kit for schema management (`db:push` command)

### Infrastructure Datasets
Located in `shared/` directory with GPS coordinates and geographic correlation:

- **Aviation** (`shared/aviation.ts`): 45+ airports with ICAO/IATA/TC codes, METAR availability
- **Weather Stations** (`shared/weather-stations.ts`): 60+ stations including METAR, marine buoys, lightstations
- **Marine** (`shared/marine.ts`): 170+ facilities including:
  - Coast Guard stations and rescue stations
  - Marinas, fuel docks, public wharves, harbour authorities
  - Ferry terminals and seaplane docks
  - Private ferry operators (Hullo Ferries, Lady Rose Marine, BC inland ferries)
  - Water taxi services (Gulf Islands, Tofino/Clayoquot, Sunshine Coast)
- **Emergency Services** (`shared/emergency-services.ts`): 150+ facilities including:
  - Hospitals (with helipad ICAO codes, trauma centre designation, health authority)
  - Fire stations (municipal headquarters)
  - Municipal police departments (11 independent BC departments)
  - RCMP detachments (E Division across BC)
- **Search and Rescue** (`shared/search-rescue.ts`): 78 Ground SAR (GSAR) groups including:
  - All BCSARA member organizations with GPS coordinates
  - Specialized capabilities (rope rescue, avalanche rescue, swiftwater rescue, mountain rescue, helicopter operations, search dogs, tracking)
  - Coverage areas and operational jurisdictions
  - Volunteer organization structure (3,200+ trained volunteers province-wide)
- **Ground Transportation** (`shared/ground-transport.ts`): People carrier and delivery services including:
  - **Intercity Bus**: 11+ scheduled services (Ebus, Rider Express, FlixBus, Island Express/Tofino Bus, Wilson's, BC Bus North, Health Connections, etc.)
  - **Public Transit**: 30+ BC Transit systems and TransLink (Metro Vancouver), mapped to municipalities served
  - **Charter/Tour Bus**: 13+ operators including school bus contractors (First Student, Lynch Bus Lines), tour operators, and airport shuttles
  - **Courier/Postal**: 15+ services with 100+ facilities including:
    - Canada Post processing plants and depots across BC
    - Express couriers (Purolator, FedEx, UPS, DHL, Canpar, Loomis)
    - Regional carriers (Bandstra, Northern Freightways, Coastal Courier)
    - Freight/LTL (Purolator Freight, Day & Ross)
    - Same-day delivery (Novex, Dynamex, Intelcom)
  - **Trucking (Critical Infrastructure)**: 20+ carriers with 60+ terminals including:
    - Fuel distributors (Suncor/Petro-Canada, Imperial/Esso, Parkland, Cenovus, Super Save)
    - Food/grocery distribution (Sysco, Gordon Food Service, Sobeys, Save-On-Foods, Loblaw)
    - General freight and LTL (Mullen Group, Day & Ross, Manitoulin, CP/CN Intermodal)
    - Refrigerated transport (Vedder Transport, Van Kam Freightways)
    - Logging/forestry (Arrow Transportation, Teal-Jones)
    - Aggregate/construction (Jack Cewe, Ocean Concrete)
    - Hazmat/propane (Trimac, Superior Propane)
  - **Rail**: 10 railway operators with 40+ stations including:
    - Class I freight (CN Rail, CP Kansas City) with major yards and intermodal terminals
    - Shortline railways (Southern Railway of BC, Kelowna Pacific Railway)
    - Passenger rail (VIA Rail - The Canadian, Skeena routes)
    - Commuter rail (West Coast Express - Vancouver to Mission)
    - Tourist/heritage railways (Rocky Mountaineer, Kettle Valley Steam, Alberni Pacific, Kamloops Heritage)
- **Taxi Services** (`shared/taxi-services.ts`): 80+ taxi companies across BC including:
  - Metro Vancouver (Yellow Cab, Black Top & Checker, MacLure's, Vancouver Taxi, Bonny's, North Shore Taxi, Sunshine Cabs, Surdell-Kennedy, Pacific Cabs, Royal City Taxi, Kimber Cabs, Queen City Taxi, Tsawwassen Taxi, White Rock South Surrey Taxi, Coquitlam Taxi, Delta Sunshine Taxi)
  - Victoria/Capital Region (Bluebird Cabs, Yellow Cab Victoria, Victoria Taxi, Uptown Taxi, Sidney Taxi, Peninsula Taxi, Westshore Taxi, Orange Taxi)
  - Gulf Islands (Silver Shadow Taxi, Salt Spring Taxi)
  - Sea-to-Sky (Whistler Taxis, Squamish Taxi, Howe Sound Taxi)
  - Fraser Valley (Abbotsford Mission Taxi, Central Valley Taxi, Yellow Top Taxi, Langley Cabs, Aldergrove-Langley Taxi, Maple Ridge Taxi, Mission Taxi, Hope Taxi, Chilliwack Taxi, Cheam Taxi)
  - Okanagan (Kelowna Cabs, Checkmate Cabs, Current Taxi, West Cabs, Kelowna Eco Taxi, Penticton Taxi, Eco Taxi Penticton, Vernon Taxi, Salmon Arm Taxi)
  - Kamloops (Kami Cabs, Yellow Cabs Kamloops)
  - Cariboo (Town Taxi Williams Lake, Williams Lake Taxi, Cariboo Taxi Quesnel, Quesnel Taxi)
  - Prince George (Prince George Taxi, Emerald Taxi)
  - Northern BC (Kalum Kabs Terrace, Kitimat Taxi, Skeena Taxi Prince Rupert, Teco Taxi Fort St. John, Fort St. John Cabs, Energetic Taxi)
  - Kootenays (Glacier Cabs Nelson, Star Taxi Cranbrook, Key City Cabs, Kootenay Taxi Fernie, Tunnel49, Mount 7 Taxi Golden)
  - Vancouver Island (A.C. Taxi Nanaimo, Yellow Cab Nanaimo, Nanaimo Taxi Cab, Bee Line Taxi Campbell River, Comox Taxi, Ladysmith GoTaxi, United Cabs Port Alberni, Tofino Taxi, Ucluelet Taxi, Pacific Rim Navigators)
  - Sunshine Coast (Sechelt Taxi, Powell River Taxi)
  - Service type classification: taxi, accessible, eco-friendly, airport specialty
  - Features tracking: mobile app availability, wheelchair accessibility, fleet size
- **Pharmacies** (`shared/pharmacies.ts`): 400+ pharmacy locations including:
  - Major chains (Shoppers Drug Mart, London Drugs, Pharmasave, Rexall)
  - Grocery pharmacies (Save-On-Foods, Safeway, Thrifty Foods)
  - Warehouse pharmacies (Walmart, Costco)
  - Hospital and independent pharmacies
  - Cross-referenced courier services (Canada Post, Purolator, UPS, FedEx drop-off locations)
- **Community/Recreation Facilities** (`shared/community-facilities.ts`): 158+ facilities including:
  - Community centres with multi-use amenities
  - Sports complexes and arenas
  - Aquatic centres and curling clubs
  - Playgrounds, skate parks, and recreation parks
  - Stadiums and fieldhouses
  - Amenity tracking: pools, ice sheets, curling sheets, gyms, weight rooms, meeting rooms, courts, fields, etc.
- **Schools** (`shared/schools.ts`): 314+ educational institutions including:
  - Universities (UBC, SFU, UVic, UNBC, TRU, Royal Roads, KPU, Capilano, Emily Carr)
  - Colleges (BCIT, Douglas, Langara, VCC, Camosun, Okanagan, Selkirk, CNC, Coast Mountain, Northern Lights, North Island, UFV, VIU)
  - Polytechnics and trades schools (ITA BC, Sprott Shaw, CDI College, Pacific Vocational)
  - Public secondary schools (Vancouver, Burnaby, Surrey, Richmond, Victoria, Kelowna, Kamloops, Prince George districts)
  - Private/independent schools (St. George's, Crofton House, Mulgrave, Shawnigan Lake, Brentwood, etc.)
  - First Nations schools (Seabird Island, Xet'olacw, Stz'uminus, Gitanyow, Witset, Haahuupayak, Maaqtusiis, 'Namgis, Bella Bella, Klemtu, Haida Gwaii, Peace River nations)
  - Online/distance learning (SIDES, eBus Academy, SelfDesign)
  - University research stations (Bamfield Marine Sciences Centre - operated by UBC, UVic, SFU, U of Alberta, U of Calgary)
  - First Nations community gymnasiums serving as de facto community centers for events and sports
- **Chambers of Commerce** (`shared/chambers-of-commerce.ts`): 80+ chambers of commerce and boards of trade including:
  - Metro Vancouver (Greater Vancouver Board of Trade, Burnaby Board of Trade, Surrey & White Rock, Richmond, Delta, North Vancouver, West Vancouver, Tri-Cities, Cloverdale, New Westminster)
  - Fraser Valley (Abbotsford, Chilliwack, Langley, Mission, Maple Ridge Pitt Meadows, Hope)
  - Victoria/Capital Region (Greater Victoria, WestShore, Sooke, Saanich Peninsula, Salt Spring Island)
  - Vancouver Island (Nanaimo, Parksville Qualicum, Comox Valley, Campbell River, Port Hardy, Port Alberni, Pacific Rim, Duncan Cowichan, Ladysmith, Chemainus)
  - Okanagan (Kelowna, West Kelowna, Vernon, Penticton, South Okanagan, Summerland, Salmon Arm, Sicamous)
  - Kamloops/Thompson-Nicola (Kamloops, Merritt)
  - Cariboo (Williams Lake, Quesnel, 100 Mile House)
  - Northern BC (Prince George, Fort St. John, Dawson Creek, Fort Nelson, Terrace, Kitimat, Prince Rupert, Smithers)
  - Kootenays (Nelson, Cranbrook, Trail, Castlegar, Revelstoke, Golden, Fernie, Invermere, Kimberley, Creston)
  - Sea-to-Sky (Whistler, Squamish, Pemberton, Lillooet)
  - Sunshine Coast (Sechelt, Gibsons, Pender Harbour, Powell River)
  - Contact information: phone, email, website, founding dates, member counts
- **Municipal Offices** (`shared/municipal-offices.ts`): 200+ government administration offices including:
  - City halls (Vancouver, Victoria, Kelowna, Prince George, Kamloops, Nanaimo, etc.)
  - Town offices, village offices, district municipal offices
  - Regional district offices
  - First Nation band offices and administration buildings (Musqueam, Squamish, Tsawwassen, Nisga'a, Heiltsuk, Haida, etc.)
  - Treaty nation offices (Maa-nulth, Tsawwassen, Nisga'a, Westbank - self-governing nations)
  - Court location notes for upcoming courts/jails dataset (most courts are in separate buildings from municipal offices)

### Key Design Patterns
- **Shared Types**: Schema definitions in `shared/` directory used by both client and server
- **Type-safe API**: Zod schemas for request/response validation with inferred TypeScript types
- **Storage Abstraction**: `IStorage` interface in `server/storage.ts` allows swapping implementations
- **Geographic Hierarchy**: Provincial → Regional → Municipal inheritance for data sources
- **GPS Correlation**: Geodesic distance calculations for nearest infrastructure lookups

### Data Flow
1. User triggers refresh via dashboard button
2. Server calls Firecrawl AI agent with structured extraction schema
3. Firecrawl scrapes relevant BC government and service websites
4. Extracted data is stored as a snapshot in PostgreSQL
5. Client fetches latest snapshot via React Query with 5-minute auto-refresh

## External Dependencies

### Third-Party Services
- **Firecrawl** (`@mendable/firecrawl-js`): AI-powered web scraping service for extracting structured data from public websites. Requires `FIRECRAWL_API_KEY` environment variable.

### Database
- **PostgreSQL**: Primary data store accessed via `DATABASE_URL` environment variable. Uses `connect-pg-simple` for session storage and `pg` driver with Drizzle ORM.

### Data Sources (scraped by Firecrawl)
- BC Hydro outage information
- Local water/sewer service alerts
- BC Ferries schedules
- Lady Rose ferry schedules
- Road condition reports

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- `FIRECRAWL_API_KEY`: API key for Firecrawl service