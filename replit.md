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

### Service Runs Platform (sr_* tables)
Production-grade normalized schema for service bundling, climate-based seasonality, and rural/remote routing:

**Core Tables (28 total):**
- **sr_service_categories**: Hierarchical service categories with parent relationships
- **sr_services**: Core service definitions with duration, crew requirements, noise/disruption levels
- **sr_climate_regions**: Climate zones with Koppen codes and freeze/thaw boundaries
- **sr_service_seasonality**: Per-region service windows with weather sensitivities
- **sr_access_requirements**: Access constraint definitions (boat, helicopter, etc.)
- **sr_mobilization_classes**: Equipment/crew mobilization cost tiers
- **sr_certifications**: Trade certifications and licensing requirements
- **sr_constraints**: Cultural, environmental, and regulatory constraints

**Pricing & Requirements:**
- **sr_pricing_models**: Pricing model types (flat, per_hour, per_sqft, hybrid)
- **sr_service_pricing**: Service-specific pricing with multipliers
- **sr_requirement_sets/items**: Photo and measurement requirements for quotes

**Bundling Intelligence:**
- **sr_service_compatibility**: Service bundling compatibility scores
- **sr_service_dependencies**: Service requires/blocks relationships
- **sr_service_addons**: Upsell opportunity mappings

**Bundles & Communities:**
- **sr_bundles**: Sellable service packages with subscription support
- **sr_bundle_items/pricing/seasonality**: Bundle composition and availability
- **sr_communities**: Community-specific climate and access bindings (links to cc_tenants)
- **sr_run_types**: Seasonal run templates with service compositions

**Enums:** noise_level, disruption_level, risk_level, pricing_model_type, job_context, dependency_type

### External Data Lake V2 (Migration 018)
Entity-graph architecture for managing scraped external data with entity resolution, consent-based outreach, and CASL compliance.

**Core Architecture:**
- **external_records**: Immutable scraped records from Apify datasets (name, address, phone, email, hours, etc.)
- **entity_links**: Confidence-scored connections between external_records and canonical entities
- **entities**: Extended with geom (PostGIS), community_id, visibility columns

**Entity Resolution:**
- Uses Jaccard token similarity + geo-proximity (<5km = bonus)
- Stores confidence scores (NUMERIC 0.0000-1.0000) and reasons as JSONB
- Links start as 'suggested' until human review accepts/rejects

**CASL-Compliant Contact Handling:**
- **external_contact_points**: Stores phone/email with consent_basis enum
- Scraped data defaults to consent='unknown', do_not_contact=true
- Outreach only allowed for: provided_by_user, public_opt_in, transactional_request, verified_owner
- Unsubscribe list with automatic 24-hour cooldown enforcement

**Claims & Inquiries:**
- **entity_claim_requests**: Business owners claim their canonical entity
- **entity_claims**: Approved claims linking individuals to entities
- **entity_inquiries**: Public questions routed to claimed entities

**Views:**
- v_unclaimed_entities_with_inquiries: Dashboard for unclaimed entities needing attention
- v_external_records_needing_resolution: Records without accepted entity links
- v_entity_resolution_queue: Suggested links awaiting human review
- v_outreach_ready: Contacts with valid consent for marketing

**Enums:** data_source_type, contact_type, link_status, consent_basis, verification_status, entity_type, inquiry_status, outreach_status, outreach_channel

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