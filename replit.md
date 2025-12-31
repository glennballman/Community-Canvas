# Community Status Dashboard

## Overview

The Community Status Dashboard is a Bloomberg-terminal style application designed to monitor community resilience across British Columbia. It features a dual-view mode (Sources View for data source URLs, Data View for live monitoring), a 4-column layout, and comprehensive admin tools. A key feature is its hierarchical source inheritance (Provincial → Regional → Municipal) and extensive geographic navigation covering all 27 BC regional districts and over 161 municipalities. The dashboard also includes criticality-based ground transportation tabs (Lifeline, Supply Chain, Bus, Taxi, Courier, Postal) for focused monitoring. The project aims to provide a centralized hub for real-time status information, crucial for emergency response, logistical planning, and general public awareness.

## User Preferences

Preferred communication style: Simple, everyday language.
GitHub backup preference: Push to GitHub at the end of each session or after significant changes. Use `git push "$GIT_PUSH_URL" HEAD:main` command.

## System Architecture

The application is built with a modern web stack, utilizing React 18 with TypeScript and Vite for the frontend, and Node.js with Express.js for the backend. Data is stored in PostgreSQL with Drizzle ORM.

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

### Infrastructure Datasets
Pre-defined geographic datasets (with GPS coordinates and correlations) for BC include:
- **Aviation**: 45+ airports
- **Weather Stations**: 60+ stations
- **Marine**: 170+ facilities (Coast Guard, marinas, ferries, water taxis)
- **Emergency Services**: 150+ facilities (hospitals, fire, police)
- **Search and Rescue**: 78 Ground SAR groups
- **Ground Transportation**: Intercity bus, public transit, charter/tour bus, courier/postal, trucking (critical infrastructure), and rail operators.
- **Taxi Services**: 80+ taxi companies
- **Pharmacies**: 400+ locations
- **Community/Recreation Facilities**: 158+ facilities
- **Schools**: 314+ educational institutions
- **Chambers of Commerce**: 107+ chambers and boards of trade
- **Municipal Offices**: 200+ government administration offices

### Key Design Patterns
- **Shared Types**: Schema definitions in `shared/` for client/server consistency.
- **Type-safe API**: Zod schemas for validation and TypeScript inference.
- **Storage Abstraction**: `IStorage` interface for flexible storage implementations.
- **Geographic Hierarchy**: Provincial → Regional → Municipal data inheritance.
- **GPS Correlation**: Geodesic distance calculations for infrastructure lookups.

### Data Flow
User-triggered refreshes initiate Firecrawl AI scraping of public websites. Extracted data is stored in PostgreSQL as snapshots, and the client fetches the latest snapshot via React Query with auto-refresh.

### Trip Planning Framework
UI components at `client/src/components/TripPlanning/` provide:
- **TripPlanningTab**: Main dashboard with participant/vehicle profiles, qualification checks
- **ParticipantProfileForm**: Profile creation with skills management (paddling, driving, backcountry, water safety, emergency)
- **VehicleProfileForm**: Vehicle details with safety assessment checklist
- **TripQualificationCheck**: Route/skill matching and qualification assessment
- **ServiceRunsBoard**: Service runs viewer for commercial logistics
- **RouteExplorer**: Route segments, hazards, and transport providers

#### Trip Planning Database Schema (Migration 004)
Enhanced schema for comprehensive trip planning:
- **participant_emergency_contacts**: Multiple emergency contacts per participant with priority ordering
- **trip_passengers**: Passengers on trips with age categories, car seat needs, mobility aids, medical info
- **participant_documents**: Document uploads (licenses, certifications) with OCR extraction support
- **vehicle_documents**: Vehicle documents (registration, insurance, rental agreements)
- **safety_equipment_types**: 38 predefined equipment types across 6 categories (navigation, communication, vehicle_emergency, personal_safety, survival, tools)
- **vehicle_safety_equipment**: Equipment checklist per vehicle with condition tracking
- **Fleet management columns**: organization_id, subscription_tier, is_fleet_vehicle, assigned_driver_id

**Architectural Debt**: Trip Planning components need refactoring to:
- Use TanStack Query for data fetching (currently raw fetch/useState)
- Use react-hook-form with zod validation (currently ad-hoc state)
- Add PUT/PATCH endpoints for editing (currently POST only)

### Documentation System
A Bloomberg-terminal styled documentation library is available at `/admin/docs`, rendering markdown files from the `docs/` directory. Key topics include data collection, architecture, completion criteria, tool selection, member counts, NAICS assignment, date tracking, and manual overrides.

## External Dependencies

### Third-Party Services
- **Firecrawl**: AI-powered web scraping for structured data extraction. Requires `FIRECRAWL_API_KEY`.

### Database
- **PostgreSQL**: Primary data store. Uses `DATABASE_URL` and `connect-pg-simple`.

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