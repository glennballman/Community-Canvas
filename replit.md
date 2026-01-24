# Community Status Dashboard

## Overview
The Community Status Dashboard is a Bloomberg-terminal style application for monitoring community resilience across British Columbia. It provides a centralized hub for real-time status information, crucial for emergency response, logistical planning, and public awareness. Key capabilities include a dual-view mode (Sources View and Data View), a 4-column layout, comprehensive admin tools, and hierarchical source inheritance with extensive geographic navigation. The dashboard also incorporates criticality-based ground transportation tabs for focused monitoring. The project aims to enhance situational awareness and support critical decision-making in BC, serving as a critical tool for provincial emergency management and public safety.

## User Preferences
Preferred communication style: Simple, everyday language.
GitHub backup preference: Push to GitHub at the end of each session or after significant changes. Use `git push "$GIT_PUSH_URL" HEAD:main` command.

## System Architecture
The application uses a modern web stack with React 18 (TypeScript, Vite) for the frontend and Node.js (Express.js) for the backend. Data is persisted in PostgreSQL with Drizzle ORM.

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
- **Schema**: `snapshots` table for location-based JSONB status data, all application tables use `cc_*` prefix.
- **Migrations**: Drizzle Kit

### Key Design Patterns
- **Shared Types**: Schema definitions in `shared/` for client/server consistency.
- **Type-safe API**: Zod schemas for validation and TypeScript inference.
- **Storage Abstraction**: `IStorage` interface for flexible storage implementations.
- **Geographic Hierarchy**: Provincial → Regional → Municipal data inheritance.
- **Multi-Tenant Security**: RLS-based tenant isolation with `is_service_mode()` bypass, tenant context middleware, and route guards.
- **Terminology Standards**: Enforced via `docs/TERMINOLOGY_STANDARDS.md`.
- **External Data Lake V2**: Entity-graph architecture for managing scraped external data.
- **Unified Assets Registry**: Central registry for all rentable assets with unified reservations.
- **Capability Architecture**: Operational layer for work order planning and asset linking.
- **Multi-Portal Foundation**: Supports one tenant operating multiple business brands, with portal-scoped data and context management.
- **Entity Presentations System**: Portal-owned editorial content presentation system with composable blocks.
- **Procurement & Accounting Standards**: Industry-standard classification columns (UNSPSC, CSI MasterFormat) for future accounting integration.
- **Canadian Tax & Payroll System**: Comprehensive payroll infrastructure.
- **Infrastructure & Organization Schema**: Extensive schema.org classification for entities.
- **SEO & Sitemap System**: Multi-tenant sitemap infrastructure with portal-aware filtering and JSON-LD structured data.
- **Media Storage System**: Cloudflare R2-based storage for images and documents with automatic optimization and tenant-isolated storage.
- **Authority & Permits System**: Multi-authority permit management with lifecycle management and QR code verification.
- **Trip Permit Orchestration**: Links permits to trips with automatic requirement detection and status tracking.
- **Business Operator Onboarding**: Application workflow system for registering 11 operator types, with document verification and auto-provisioning.
- **V3 Stored Value Stack**: PSP-agnostic payment infrastructure with append-only ledgers and FORCE RLS.
- **Coordination Circles**: Federated resource sharing between tenants.
- **V3 App Shell (U1)**: Role-based layouts with three first-class app shells: PlatformLayout (`/app/platform/*`), FounderLayout (`/app/founder/*`), and TenantAppLayout (`/app/*`). Each has its own nav source of truth (PLATFORM_NAV, FOUNDER_NAV, V3_NAV). View mode persisted in localStorage with key `cc_view_mode`.
- **Defensive Record Bundles**: Immutable, owner-controlled evidence packages for legal/insurance defense.
- **Evidence Chain-of-Custody Engine**: Tamper-evident evidence bundles with immutable manifests.
- **Insurance Claim Auto-Assembler**: Carrier-agnostic claim dossiers generated from sealed evidence.
- **Legal Hold & Retention Policies**: Spoliation prevention and audit-grade hold management.
- **Offline/Low-Signal Evidence Queue**: Evidence capture without connectivity.
- **Authority/Adjuster Read-Only Portals**: Secure external access for insurance adjusters, legal authorities, and auditors.
- **Dispute/Extortion Defense Pack**: Unified dispute management for various types of disputes.
- **Anonymous Interest Groups & Threshold Triggers (P2.11)**: Privacy-preserving collective action system.
- **P2.15 Monetization Event Ledger**: Append-only ledger for tracking billable events with plan-based gating.
- **P2.16 SCM Integration Certification**: Unified certification tracking for P2.5-P2.15 modules.
- **P2.17 Emergency Drill Mode**: Safe rehearsal of emergency scenarios without contaminating production records.
- **Jobs/Labor System (V3.5)**: Multi-tenant B2B SaaS job posting and application system.
- **Job Publication Accounting GL Integration**: Complete financial audit trail for paid job placement intents.
- **N3 Service Run Monitor + Replan Engine (Patent CC-01)**: Real-time service run monitoring with attention bundles and an evaluator.
- **N3-CAL-01 Calendar Projections**: Read-only calendar views over cc_n3_runs for 3 audiences: contractor (full details), resident (privacy-filtered), and portal (public). Features week/day/list views with tenant-based filtering.
- **N3-CAL-02 Dependencies/Staff/Asset Lanes**: Extended calendar with staff availability blocks, dependency windows (weather/ferry/seaplane/highway), and multi-lane groups. Contractor sees 8 lane groups, resident sees 4 (redacted), portal sees zone feasibility roll-up. Feasibility overlay marks runs as ok/risky/blocked based on overlapping dependency windows.
- **V3.5 Surface Spine (Patent CC-02)**: Atomic unit-level spatial modeling for containers, surfaces, claims, and utilities with Capacity Lenses.
- **P-UI-08 Proposal API**: Itinerary + atomic allocations + folios API with 10-participant split pay support, operator credits, and incidents.
- **P-UI-09 Proposal UI**: 8 React components for proposal/approver workflow.
- **P-UI-10 Availability → Proposal Handoff**: Complete flow from availability search to confirmed reservation.
- **V3.5 Universal Copy-Token Layer**: Dynamic terminology system that replaces hardcoded industry-specific terms with entry-point-specific copy tokens. Supports 8 entry point types (lodging, parking, marina, restaurant, equipment, service, activity, generic) with variable interpolation for message templates. Forbidden terms ("contractor", "booking", etc.) are enforced via copy-lint script. Client hook (useCopy) and server resolver (server/copy/entryPointCopy.ts) are kept in sync with automated tests.
- **Tenant Start Address Book (STEP 6.5B)**: Amazon-style saved addresses for service runs. Tenant-scoped cc_tenant_start_addresses table with RLS, FK on cc_n3_runs.start_address_id. Provider endpoints: GET/POST/PATCH start-addresses, PATCH runs/:id/start-address. StartAddressPickerModal component for selecting/creating addresses. Private/advisory only, does NOT imply person/asset assignment.

### Feature Specifications
- **Dual-view Mode**: Sources View (data source URLs) and Data View (live monitoring).
- **Geographic Navigation**: Covers 27 BC regional districts and over 161 municipalities.
- **Criticality-based Tabs**: Lifeline, Supply Chain, Bus, Taxi, Courier, Postal transportation tabs.
- **Apify Sync Integration**: External data ingestion from Apify datasets with streaming support and MD5-based change detection.
- **Operations Board**: 15-minute precision scheduling interface for all resources.
- **System Explorer**: Platform Admin debug/discovery surface for various system aspects.
- **Evidence Rule Enforcement**: Machine-enforceable evidence gates to track and verify system artifacts.
- **Parking Plan View**: Visual operations map showing parking stall layout, real-time occupancy, and availability.
- **Marina Plan View**: Visual operations map showing marina slip layout, real-time occupancy, and amenities.
- **P-UI-17 Admin & Folios**: Admin pages for role management, portal settings, notification preferences, and read-only folio/ledger views.
- **P-UI-17 Platform Console**: Platform-level administrative interface for platform admins including tenant management, platform-wide analytics, and V3.5 certification status.
- **Work Catalog System**: Comprehensive property reference information system for contractors.
- **A2.1 Contractor Identity Enrichment**: Camera-first identity extraction from vehicle photos.
- **A2.2 Service Area & Route Intelligence**: Consent-first service coverage inference from uploads.
- **A2.3 Unified Upload Classifier + Asset Router**: Any-media classification pipeline for contractor uploads.
- **A2.4 Geo Resolution + Business Graph Binding**: Geocodes EXIF/OCR data to place candidates, resolves against contractor's business graph (customers/jobsites/work requests), proposes draft entities but never auto-creates without explicit confirmation. Features Nominatim integration with rate limiting, address normalization with SHA-256 hashing, and UI confirm/change/deny/skip workflow.
- **A2.5 Event Mode**: Contractor lead capture at booths/events with non-linear flow, public lead capture, and quote drafts system. Unclaimed leads (tenantId IS NULL) visible to contractors, auto-claimed on edit/publish.
- **A2.6 Ingestion Intelligence Layer**: Durable next actions engine for sticky note→execution flows. Derives 7 action types (create_work_request, attach_to_zone, request_more_photos, draft_n3_run, open_quote_draft, add_tool, add_fleet) from A2.3 outputs. Features cc_ingestion_next_actions table for durable tracking, cc_sticky_note_extractions for OCR analysis, confirm/dismiss workflow, and tenant-scoped security. UI workspace in UploadResultsPage.

## External Dependencies

### Third-Party Services
- **Firecrawl**: AI-powered web scraping.
- **connect-pg-simple**: PostgreSQL session store.
- **Cloudflare R2**: Object storage for media.

### Database
- **PostgreSQL**: Primary data store.

### Data Sources (scraped by Firecrawl)
- BC Hydro outage information
- Local water/sewer service alerts
- BC Ferries schedules
- Lady Rose ferry schedules
- Road condition reports

## Architecture Invariants

### Route Structure (V3.5)
**PERMANENTLY RETIRED**: `/admin/*` routes were retired as of V3.5.

All Platform Admin functionality MUST live under `/app/platform/*`. The server returns HTTP 410 Gone for any `/admin/*` requests.

**Current Route Trees:**
- `/c/:slug/*` - Public portal (no auth)
- `/app/platform/*` - Platform Admin mode (PlatformLayout)
- `/app/founder/*` - Founder Solo mode (FounderLayout)
- `/app/*` - Tenant app (TenantAppLayout)

**DO NOT:**
- Add new routes under `/admin/*`
- Re-introduce legacy admin links
- Create duplicate admin systems

**Legacy Code (Pending Cleanup):**
- `client/src/pages/admin/` - Old admin pages
- `client/src/layouts/PlatformAdminLayout.tsx` - Old admin layout
- `client/src/pages/AdminLayout.tsx`, `AdminHome.tsx`, `AdminChambers.tsx`
- `client/src/components/MainNav.tsx` - Contains legacy nav definitions