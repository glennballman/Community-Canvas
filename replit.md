# Community Status Dashboard

## Overview

A Bloomberg-terminal style community status dashboard covering all of British Columbia. Features dual-view mode (Sources View for data source URLs, Data View for live monitoring), 4-column layout, comprehensive admin tools, hierarchical source inheritance (Provincial → Regional → Municipal), and complete geographic navigation covering all 27 BC regional districts and 161+ municipalities.

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