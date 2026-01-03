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

### Apify Sync Integration (Migration 019)
External data ingestion from Apify datasets with streaming support for large files (343MB+).

**Tables:**
- **apify_datasets**: Dataset configurations with sync settings, field mappings, and source types (airbnb, vrbo, equipment, retail, service)
- **apify_sync_history**: Sync run logs with record counts, timing, and error tracking

**Extended external_records Fields (Migration 019):**
- Rental: price_per_night, bedrooms, bathrooms, max_guests, amenities[], property_type
- Host: host_name, host_id, superhost, response_rate, reviews_count, rating
- Product: sku, brand, price, original_price, in_stock, item_condition
- Media: photo_urls[], main_photo_url, listing_url

**SQL Functions:**
- `create_entity_from_record(uuid)`: Auto-creates canonical entity from external record
- `resolve_community(lat, lng)`: PostGIS-based community matching for external records

**API Routes (/api/apify):**
- GET /datasets, POST /datasets - List/create dataset configurations
- PATCH /datasets/:id, DELETE /datasets/:id - Update/delete datasets
- POST /sync/:slug - Trigger sync for a dataset
- GET /stats - Entity resolution statistics
- GET /records, GET /records/:id - Query external records
- DELETE /records/:id - Delete records
- POST /records/:id/resolve - Accept/reject entity links
- DELETE /records/stale - Cleanup old records

**Service (server/services/apifySync.ts):**
- Lazy-loaded apify-client and stream-json dependencies
- MD5-based change detection to skip unchanged records
- Supports both Apify API streaming and local file streaming

### Unified Assets Registry (Migration 020)
Central registry unifying all rentable assets (properties, spots, trailers, vehicles, equipment) into a single searchable system with unified bookings and traveler bonds.

**Core Tables:**
- **unified_assets**: Central registry linking all asset types with denormalized search attributes
- **unified_bookings**: Single booking system for all asset types with requirement tracking
- **traveler_bonds**: Unified security deposits covering multiple bookings across asset types
- **bond_coverage**: Links between bonds and bookings

**Asset Types:** property, spot, trailer, vehicle, vehicle_rv, equipment, watercraft

**Source Tables Synced:**
- staging_properties (37 records) → property/spot
- staging_spots (10 records) → spot
- trailer_profiles (RV/LQ only) → trailer
- cc_vehicles (5 records) → vehicle/vehicle_rv
- cc_rental_items (15 records) → equipment
- external_records (4,852 Airbnb listings) → property

**Key Fields:**
- Accommodation: sleeps_total, bedrooms, bathrooms_full, bathroom_private, private_bedrooms
- Self-Contained: fresh_water_gallons, gray/black_water_gallons, solar_watts, generator_watts, days_self_sufficient
- Parking/Spot: is_parkable_spot, spot_length_ft, max_vehicle_length_ft, power_amps[], has_water/sewer_hookup
- Towable: is_towable, hitch_type, gvwr_lbs, tongue_weight_lbs
- Equipment: equipment_category_id, brand, model, condition
- Pricing: rate_hourly, rate_half_day, rate_daily, rate_weekly, rate_monthly, deposit_amount
- Scores: crew_score, family_score, trucker_score, equestrian_score

**Sync Functions:**
- `sync_staging_property_to_unified(id)`: Sync staging_properties
- `sync_staging_spot_to_unified(id)`: Sync staging_spots
- `sync_trailer_to_unified(id)`: Sync trailer_profiles (RV/LQ)
- `sync_vehicle_to_unified(id)`: Sync cc_vehicles
- `sync_rental_item_to_unified(id)`: Sync cc_rental_items
- `sync_external_record_to_unified(id)`: Sync external_records (Airbnb/VRBO)
- `sync_all_assets_to_unified()`: Master sync for all source tables

**Search Function:**
- `search_unified_assets(sleeps_min, lat, lng, radius_km, need_parking, max_vehicle_length, need_hookups, asset_types[], limit)`: Multi-criteria spatial search

**Views:**
- v_unified_accommodations: All assets with sleeps_total > 0
- v_unified_parking: All parkable spots with hookup level display
- v_unified_towables: All towable assets with weight class
- v_unified_self_contained: Self-contained assets with capacity ratings

**Current Stats (as of Migration 020):**
- Total unified_assets: 4,919
- Accommodations (is_accommodation=true): 4,852
- Parkable spots: 47
- Equipment: 15
- Vehicles: 5

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