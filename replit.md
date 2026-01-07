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
- **Multi-Tenant Security**: RLS-based tenant isolation with `is_service_mode()` bypass, tenant context middleware, and route guards.

### Multi-Tenant Infrastructure
- **Tenant Context Middleware**: `server/middleware/tenantContext.ts` - Resolves tenant/portal from request headers
- **Tenant-Aware Queries**: `server/db/tenantDb.ts` - Attaches `req.tenantQuery`/`req.tenantTransaction` to requests
- **Route Guards**: `server/middleware/guards.ts` - Role-based access control
- **RLS Policies**: `server/migrations/024_rls_policies.sql` - Database-level row security
- **Service Mode**: Use `serviceQuery`/`withServiceTransaction` for background jobs (bypasses RLS with `__SERVICE__` sentinel)
- **QA Checklist**: `docs/QA_TENANT_ISOLATION.md` - Testing and migration guide

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
- **Shared Service Runs**: Neighbor bundling system (NOT competitive bidding) where customers with a contractor invite neighbors to join and split mobilization costs. API prefix: `/api/shared-runs`. Uses CASE-based RLS policies with `__SERVICE__` sentinel handling for proper tenant isolation. (Renamed from "Coop Runs" due to negative brand associations in Canada.)
- **Work Requests System**: Procurement coordination for remote community work. API prefix: `/api/work-requests`. Replaces the former "Opportunities" terminology to clarify purpose (work coordination, NOT employment opportunities) and avoid confusion with future "Job Posting" features. Table: `work_requests`, column: `work_request_id` in bids.
- **Operations Board**: 15-minute precision scheduling interface at `/app/operations` for all resources (rooms, parking, equipment, crews). Features hold/maintenance/buffer blocks with check constraints enforcing 15-minute snapping. Table: `resource_schedule_events`. Integrates with `unified_assets` (resource source) and `unified_bookings` (displays as "booked" blocks). API prefix: `/api/schedule`. Available in both COMMUNITY_NAV and BUSINESS_NAV.
- **Multi-Portal Foundation**: One tenant can operate multiple business brands using the existing `portals` system. Added `portal_type` enum and `legal_dba_name` to portals table. Portal-scoped tables: `crm_contacts`, `projects`, `work_requests` (portal_id NOT NULL), `unified_bookings` (portal_id nullable). Commercial tables: `portal_products`, `portal_materials`, `portal_pricing_rules`. Portal context managed via `PortalContext.tsx` and `PortalSelector.tsx` in sidebar. API routes: `GET /api/portals`, `GET/PUT /api/me/portal-preference`.
- **Domain/Slug Portal Resolution**: TenantContext middleware resolves portals via: (1) Domain lookup from `portal_domains` table, (2) `/b/:slug` path prefix fallback for dev/QA. Public portal routes mounted at `/api/public` and `/b/:portalSlug/api/public`. Portal lookup uses `serviceQuery` to bypass RLS since tenant context isn't established yet. Portal domains seeded for 1252093 BC LTD: enviropaving.ca, remoteserve.ca, envirobright.ca (plus .communitycanvas.ca variants).
- **Entity Presentations System**: Portal-owned editorial content that presents tenant entities differently across portals. Tables: `entity_presentations` (main content), `presentation_blocks` (composable blocks), `presentation_versions` (history), `presentation_sources` (evidence links), `voice_profiles` (editorial tone), `presentation_entity_links` (bundles/collections), `ai_runs` (AI pipeline audit). Block types: hero, story, gallery, facts, map, cta, availability, faq, quote, list. RLS uses `safe_current_tenant_uuid()` function to handle `__SERVICE__` sentinel without UUID cast failures. Public API: `GET /api/public/portals/:slug/presentations` (list), `GET /api/public/portals/:slug/presentations/:slug` (detail). Sample portal: "Parts Unknown BC" with Bourdain-style voice profile.
- **System Explorer**: Permanent Platform Admin debug/discovery surface at `/admin/system-explorer` with 6 tabs: Overview (entity counts, integration status), Evidence (Evidence Ledger with verification), Integrations (Firecrawl, Apify, Mapbox, Jobber, CompanyCam), Data Sources (5 pipelines: DriveBC, BC Ferries, BC Hydro, Weather, Earthquakes), Data Browser (read-only exploration of 17 tables), Routes Audit (nav item verification). API prefix: `/api/admin/system-explorer`. Platform Admin only - not visible to tenants.
- **Evidence Rule Enforcement**: Machine-enforceable evidence gates that track what exists and verify accessibility. Table: `system_evidence` stores 31 artifacts (nav_items, routes, tables, integrations). Service: `server/services/evidenceVerification.ts` parses layout files for nav items, checks table existence, verifies env vars. API: `GET /api/admin/system-explorer/evidence/status`, `POST /api/admin/system-explorer/evidence/verify`. UI: Evidence tab in System Explorer with "Verify All" button. QA: `scripts/qa-smoke-test.ts` includes evidence verification that fails if required items missing.
- **Procurement & Accounting Standards**: Industry-standard classification columns for future accounting integration. Assets table includes UNSPSC codes (product classification), HS codes (imports/customs), manufacturer info, unit costs. Projects/work_requests include CSI MasterFormat codes (construction job costing) and budget tracking. Reference tables: `ref_unspsc_segments` (48 segments), `ref_csi_divisions` (35 divisions), `ref_currencies` (ISO 4217), `ref_unit_codes` (UN/CEFACT). Future-ready tables: `gl_accounts` (chart of accounts), `transactions`/`transaction_lines` (invoices, bills, journals with classification codes).

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