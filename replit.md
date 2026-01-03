# Community Status Dashboard

## Overview
The Community Status Dashboard is a Bloomberg-terminal style application designed to monitor community resilience across British Columbia. It provides a centralized hub for real-time status information, crucial for emergency response, logistical planning, and public awareness. Key features include a dual-view mode (Sources View and Data View), a 4-column layout, comprehensive admin tools, and hierarchical source inheritance (Provincial → Regional → Municipal) with extensive geographic navigation. The dashboard also incorporates criticality-based ground transportation tabs for focused monitoring. The project aims to enhance situational awareness and support critical decision-making in BC.

## User Preferences
Preferred communication style: Simple, everyday language.
GitHub backup preference: Push to GitHub at the end of each session or after significant changes. Use `git push "$GIT_PUSH_URL" HEAD:main` command.

## System Architecture
The application uses a modern web stack: React 18 with TypeScript and Vite for the frontend, and Node.js with Express.js for the backend. Data is persisted in PostgreSQL with Drizzle ORM.

### Frontend
- **Framework**: React 18 with TypeScript, Vite
- **Routing**: Wouter
- **State Management**: TanStack React Query
- **UI Components**: shadcn/ui (built on Radix UI)
- **Styling**: Tailwind CSS (dark theme, CSS variables)
- **Animations**: Framer Motion

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript (ESM modules)
- **API Design**: REST endpoints with Zod validation
- **Build**: Custom esbuild for server, Vite for client

### Data Layer
- **Database**: PostgreSQL with Drizzle ORM
- **Schema**: `snapshots` table for location-based JSONB status data
- **Migrations**: Drizzle Kit

### Key Design Patterns
- **Shared Types**: Schema definitions in `shared/` for client/server consistency.
- **Type-safe API**: Zod schemas for validation and TypeScript inference.
- **Storage Abstraction**: `IStorage` interface for flexible storage implementations.
- **Geographic Hierarchy**: Provincial → Regional → Municipal data inheritance.
- **GPS Correlation**: Geodesic distance calculations for infrastructure lookups.
- **External Data Lake V2**: Entity-graph architecture for managing scraped external data with entity resolution, consent-based outreach, and CASL compliance.
- **Unified Assets Registry**: Central registry unifying all rentable assets (properties, spots, trailers, vehicles, equipment) into a single searchable system with unified bookings and traveler bonds.
- **Capability Architecture**: Operational layer for work order planning, preserving detailed attribute search from source tables, linking assets to source data, capabilities, terms, and availability.

### Feature Specifications
- **Dual-view Mode**: Sources View (data source URLs) and Data View (live monitoring).
- **Geographic Navigation**: Covers 27 BC regional districts and over 161 municipalities.
- **Criticality-based Tabs**: Lifeline, Supply Chain, Bus, Taxi, Courier, Postal transportation tabs.
- **Trip Planning Framework**: UI components for participant/vehicle profiles, qualification checks, and service runs.
- **Service Runs Platform**: Production-grade normalized schema for service bundling, climate-based seasonality, and rural/remote routing.
- **Apify Sync Integration**: External data ingestion from Apify datasets with streaming support and MD5-based change detection.
- **Work Order System**: For job authority, capability matching, material logistics, and mobilization plans.
- **Bonds System**: Unified deposits for individual, tenant, or employer-backed scenarios, with claim management and asset inspections.
- **Documentation System**: Bloomberg-terminal styled documentation available at `/admin/docs`, rendering markdown files.

## External Dependencies

### Third-Party Services
- **Firecrawl**: AI-powered web scraping for structured data extraction.
- **connect-pg-simple**: For PostgreSQL session store.

### Database
- **PostgreSQL**: Primary data store.

### Data Sources (scraped by Firecrawl)
- BC Hydro outage information
- Local water/sewer service alerts
- BC Ferries schedules
- Lady Rose ferry schedules
- Road condition reports

### Environment Variables
- `DATABASE_URL`
- `FIRECRAWL_API_KEY`
- `MAPBOX_ACCESS_TOKEN`
- `SESSION_SECRET`