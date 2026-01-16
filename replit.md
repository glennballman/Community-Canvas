# Community Status Dashboard

## Overview
The Community Status Dashboard is a Bloomberg-terminal style application designed to monitor community resilience across British Columbia. It provides a centralized hub for real-time status information, crucial for emergency response, logistical planning, and public awareness. Key capabilities include a dual-view mode (Sources View and Data View), a 4-column layout, comprehensive admin tools, and hierarchical source inheritance with extensive geographic navigation. The dashboard also incorporates criticality-based ground transportation tabs for focused monitoring. The project aims to enhance situational awareness and support critical decision-making in BC.

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
- **Schema**: `snapshots` table for location-based JSONB status data. All application tables use `cc_*` prefix.
- **Migrations**: Drizzle Kit

### Key Design Patterns
- **Shared Types**: Schema definitions in `shared/` for client/server consistency.
- **Type-safe API**: Zod schemas for validation and TypeScript inference.
- **Storage Abstraction**: `IStorage` interface for flexible storage implementations.
- **Geographic Hierarchy**: Provincial → Regional → Municipal data inheritance.
- **Multi-Tenant Security**: RLS-based tenant isolation with `is_service_mode()` bypass, tenant context middleware, and route guards.
- **Terminology Standards**: Enforced via `docs/TERMINOLOGY_STANDARDS.md` and `./scripts/check-terminology.sh`.
- **External Data Lake V2**: Entity-graph architecture for managing scraped external data.
- **Unified Assets Registry**: Central registry for all rentable assets with unified reservations.
- **Capability Architecture**: Operational layer for work order planning and asset linking.
- **Multi-Portal Foundation**: Supports one tenant operating multiple business brands, with portal-scoped data and context management.
- **Entity Presentations System**: Portal-owned editorial content presentation system with composable blocks and AI pipeline auditing.
- **Procurement & Accounting Standards**: Industry-standard classification columns (UNSPSC, CSI MasterFormat) for future accounting integration.
- **Canadian Tax & Payroll System**: Comprehensive payroll infrastructure including tax jurisdictions, rates, contribution rates, and employer taxes.
- **Infrastructure & Organization Schema**: Extensive schema.org classification for entities using reference tables for infrastructure and organization types.
- **SEO & Sitemap System**: Multi-tenant sitemap infrastructure with portal-aware filtering and JSON-LD structured data.
- **Media Storage System**: Cloudflare R2-based storage for images and documents with automatic optimization and tenant-isolated storage.
- **Authority & Permits System**: Multi-authority permit management with lifecycle management and QR code verification.
- **Trip Permit Orchestration**: Links permits to trips with automatic requirement detection and status tracking.
- **Business Operator Onboarding**: Application workflow system for registering 11 operator types, with document verification and auto-provisioning.
- **V3 Stored Value Stack**: PSP-agnostic payment infrastructure with append-only ledgers and FORCE RLS, including Payment Rail Spine, Wallet Ledger Spine, and RTR Connector Pack.
- **Coordination Circles**: Federated resource sharing between tenants via circles with circle-aware messaging and unified conversation inbox.
- **V3 App Shell (U1)**: Authoritative left navigation via `V3_NAV` in `client/src/lib/routes/v3Nav.ts`, with 6 sections (Operations, Reservations, Work, Compliance, Communication, Admin).
- **Defensive Record Bundles**: Immutable, owner-controlled evidence packages for legal/insurance defense, with specific bundle types, contemporaneous notes, ACL delegation, and a seal workflow.
- **Evidence Chain-of-Custody Engine**: Tamper-evident evidence bundles with immutable manifests, evidence objects, event chains, and bundle manifests, supported by utility functions and API endpoints.
- **Insurance Claim Auto-Assembler**: Carrier-agnostic claim dossiers generated from sealed evidence, including policies, claims, inputs, and dossiers, with a deterministic assembly engine and R2 export.
- **Legal Hold & Retention Policies**: Spoliation prevention and audit-grade hold management using hold containers, targets, events, and retention policies, enforced by DB triggers.
- **Offline/Low-Signal Evidence Queue**: Evidence capture without connectivity, utilizing sync sessions, an ingest queue, a reconcile log, and a client-side queue library for batch processing and network status monitoring.
- **Authority/Adjuster Read-Only Portals**: Secure external access for insurance adjusters, legal authorities, and auditors, managed through grants, scopes, tokens, and audit logs, leveraging SECURITY DEFINER functions and public routes.
- **Dispute/Extortion Defense Pack**: Unified dispute management for various types of disputes, linking to sealed evidence, assembling defense packs with versioning, and integrating with Authority Share for external access.

### Feature Specifications
- **Dual-view Mode**: Sources View (data source URLs) and Data View (live monitoring).
- **Geographic Navigation**: Covers 27 BC regional districts and over 161 municipalities.
- **Criticality-based Tabs**: Lifeline, Supply Chain, Bus, Taxi, Courier, Postal transportation tabs.
- **Apify Sync Integration**: External data ingestion from Apify datasets with streaming support and MD5-based change detection.
- **Operations Board**: 15-minute precision scheduling interface for all resources.
- **System Explorer**: Platform Admin debug/discovery surface for overview, evidence, integrations, data sources, data browser, and routes audit.
- **Evidence Rule Enforcement**: Machine-enforceable evidence gates to track and verify system artifacts.

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