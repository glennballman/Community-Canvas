# Community Status Dashboard

## Overview
The Community Status Dashboard is a Bloomberg-terminal style application for monitoring and enhancing community resilience across British Columbia. It provides a centralized hub for real-time status information, critical for emergency response, logistical planning, and public awareness. Key capabilities include a dual-view mode (Sources View and Data View), a 4-column layout, comprehensive admin tools, and hierarchical source inheritance with extensive geographic navigation. The dashboard also incorporates criticality-based ground transportation tabs for focused monitoring. The project aims to enhance situational awareness and support critical decision-making in BC, serving as a vital tool for provincial emergency management and public safety.

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
- **Geographic Hierarchy**: Provincial → Regional → Municipal data inheritance.
- **Multi-Tenant Security**: RLS-based tenant isolation with `is_service_mode()` bypass, tenant context middleware, and route guards.
- **Multi-Portal Foundation**: Supports one tenant operating multiple business brands, with portal-scoped data and context management.
- **V3 App Shell (U1)**: Role-based layouts with three first-class app shells: PlatformLayout (`/app/platform/*`), FounderLayout (`/app/founder/*`), and TenantAppLayout (`/app/*`). View mode persisted in localStorage with key `cc_view_mode`.
- **Authorization Constitution**: Defines non-negotiable authorization invariants including single identity authority via `cc_principals`/AuthContext, unified principals model, capability-first authorization, full scope hierarchy, RLS enforcement, and impersonation as actor substitution.
- **Canonical Systems**: `cc_n3_runs` for service runs, `cc_bids` for bids.
- **Evidence Management**: Includes Defensive Record Bundles, Evidence Chain-of-Custody Engine, Insurance Claim Auto-Assembler, Legal Hold & Retention Policies, Offline/Low-Signal Evidence Queue, and Authority/Adjuster Read-Only Portals.
- **N3 Service Run Monitor + Replan Engine**: Real-time service run monitoring with attention bundles and an evaluator.
- **N3-CAL-01 Calendar Projections**: Read-only calendar views over `cc_n3_runs` for contractor, resident, and portal audiences.
- **V3.5 Universal Copy-Token Layer**: Dynamic terminology system replacing hardcoded terms with entry-point-specific copy tokens, supporting 8 entry point types.

### Feature Specifications
- **Dual-view Mode**: Sources View (data source URLs) and Data View (live monitoring).
- **Geographic Navigation**: Covers 27 BC regional districts and over 161 municipalities.
- **Criticality-based Tabs**: Lifeline, Supply Chain, Bus, Taxi, Courier, Postal transportation tabs.
- **Apify Sync Integration**: External data ingestion from Apify datasets with streaming and MD5-based change detection.
- **Operations Board**: 15-minute precision scheduling interface for all resources.
- **System Explorer**: Platform Admin debug/discovery surface.
- **Evidence Rule Enforcement**: Machine-enforceable evidence gates.
- **Plan Views**: Visual operations maps for parking and marina, showing layout, real-time occupancy, and availability.
- **Admin & Folios**: Admin pages for role management, portal settings, notification preferences, and read-only folio/ledger views.
- **Platform Console**: Platform-level administrative interface for platform admins including tenant management and platform-wide analytics.
- **Work Catalog System**: Comprehensive property reference information for contractors.
- **Contractor Identity Enrichment**: Camera-first identity extraction from vehicle photos.
- **Service Area & Route Intelligence**: Consent-first service coverage inference.
- **Unified Upload Classifier + Asset Router**: Any-media classification pipeline for contractor uploads.
- **Geo Resolution + Business Graph Binding**: Geocodes EXIF/OCR data, resolves against contractor's business graph, proposes draft entities.
- **Event Mode**: Contractor lead capture at booths/events with non-linear flow and quote drafts system.
- **Ingestion Intelligence Layer**: Durable next actions engine for sticky note→execution flows, deriving 7 action types from A2.3 outputs.

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