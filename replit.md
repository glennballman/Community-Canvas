# Community Status Dashboard

## Overview

A real-time community status dashboard for Bamfield, BC that aggregates and displays local infrastructure status including BC Hydro power outages, water/sewer alerts, ferry schedules, and road conditions. The application uses Firecrawl's AI agent to scrape and structure data from various public sources, storing snapshots in PostgreSQL for display on a modern React dashboard.

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

### Key Design Patterns
- **Shared Types**: Schema definitions in `shared/` directory used by both client and server
- **Type-safe API**: Zod schemas for request/response validation with inferred TypeScript types
- **Storage Abstraction**: `IStorage` interface in `server/storage.ts` allows swapping implementations

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