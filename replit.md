# Community Status Dashboard

## Overview
The Community Status Dashboard is a Bloomberg-terminal style application designed to monitor community resilience across British Columbia. It provides a centralized hub for real-time status information, crucial for emergency response, logistical planning, and public awareness. Key capabilities include a dual-view mode (Sources View and Data View), a 4-column layout, comprehensive admin tools, and hierarchical source inheritance (Provincial → Regional → Municipal) with extensive geographic navigation. The dashboard also incorporates criticality-based ground transportation tabs for focused monitoring. The project aims to enhance situational awareness and support critical decision-making in BC.

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
- **Terminology Standards**: NEVER use "booking/booked" → ALWAYS use "reservation/reserved/scheduled". See `docs/TERMINOLOGY_STANDARDS.md` for canon. Run `./scripts/check-terminology.sh` as guardrail before commits.
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
- **Business Operator Onboarding**: Application workflow system for registering 11 operator types (accommodation, transport, tour, rental, food_beverage, retail, service, contractor, guide, artisan, other) with unique numbering (OPA-YYMMDD-XXXX for applications, OPR-TYPE-YYMMDD-XXXX for approved operators), document verification, and auto-provisioning of operator records and role assignments upon approval.
- **V3 Stored Value Stack**: PSP-agnostic payment infrastructure with append-only ledgers and FORCE RLS:
  - **Payment Rail Spine** (Migration 118): `cc_rail_connectors`, `cc_rail_accounts`, `cc_rail_transfers`, `cc_rail_transfer_events`
  - **Wallet Ledger Spine** (Migration 119): `cc_wallet_accounts`, `cc_wallet_entries`, `cc_wallet_holds`, `cc_wallet_balance_snapshots`
  - **RTR Connector Pack** (Migration 120): `cc_rtr_profiles`, `cc_rtr_message_log`, `cc_rtr_webhook_inbox`
  - **RTR Adaptor Layer**: Routes (`/api/wallet`, `/api/rail`, `/internal/rtr`) and worker (`server/workers/rtr-worker.ts`)
  - **Append-Only Tables**: 5 tables with FORCE RLS (cc_audit_trail, cc_folio_ledger, cc_rail_transfer_events, cc_wallet_entries, cc_rtr_message_log)

### Feature Specifications
- **Dual-view Mode**: Sources View (data source URLs) and Data View (live monitoring).
- **Geographic Navigation**: Covers 27 BC regional districts and over 161 municipalities.
- **Criticality-based Tabs**: Lifeline, Supply Chain, Bus, Taxi, Courier, Postal transportation tabs.
- **Apify Sync Integration**: External data ingestion from Apify datasets with streaming support and MD5-based change detection.
- **Operations Board**: 15-minute precision scheduling interface for all resources.
- **System Explorer**: Platform Admin debug/discovery surface for overview, evidence, integrations, data sources, data browser, and routes audit.
- **Evidence Rule Enforcement**: Machine-enforceable evidence gates to track and verify system artifacts.
- **Coordination Circles (Phase A1.1)**: Federated resource sharing between tenants via circles. Includes circle-aware messaging with notification fan-out, unified conversation inbox (/app/messages), context switching (/app/circles), and per-request membership revalidation in tenantContext middleware.
- **V3 App Shell (U1)**: Authoritative left nav IA via `V3_NAV` in `client/src/lib/routes/v3Nav.ts`. 6 sections (Operations, Reservations, Work, Compliance, Communication, Admin). ContextIndicator in top bar showing Portal/Tenant/Circle context. Route audit script: `npx tsx client/scripts/v3-route-audit.ts`.
- **Defensive Record Bundles (Phase A2.X)**: Immutable, owner-controlled evidence packages for legal/insurance defense (Migration 127). Includes:
  - **Bundle Types**: incident_defence, emergency_response, employment_action, chargeback_dispute, contract_dispute, general_legal
  - **Contemporaneous Notes**: Timestamped notes with scope-based linking (incident, bundle, worker, facility, asset, contract, work_order)
  - **ACL Delegation**: Owner/admin-only by default with explicit grantee delegation (individual or circle), redacted for non-owner/admin viewers
  - **Seal Workflow**: Draft → Sealed (locks all linked notes), immutable after sealing
  - **RLS Enforcement**: FORCE RLS on artifacts, ACL, and media tables; strict owner/admin/delegate access policies
- **P2.5 Evidence Chain-of-Custody Engine** (Migration 130-131): Tamper-evident evidence bundles with immutable manifests:
  - **Evidence Objects** (`cc_evidence_objects`): Source-typed (photo, video, audio, json_snapshot, url_snapshot, file_r2, manual_note) with content_sha256 hashing
  - **Event Chain** (`cc_evidence_events`): Append-only hash chain linking events via SHA256(prev_hash + canonical_event_json), FORCE RLS
  - **Bundle Manifests**: Deterministic JSON manifest with canonical serialization (sorted keys, no whitespace), frozen at seal time
  - **Utility Functions**: `canonicalizeJson()`, `sha256Hex()`, `appendEvidenceEvent()`, `verifyEvidenceChain()`, `compileBundleManifest()`
  - **API Endpoints**: 10 routes under `/api/evidence/*` for objects and bundles
  - **Tests**: 21 passing tests covering hashing, chain integrity, idempotency, and manifest determinism
- **P2.6 Insurance Claim Auto-Assembler** (Migration 132): Carrier-agnostic claim dossiers from sealed evidence:
  - **Policies** (`cc_insurance_policies`): Policy records with carrier, broker, coverage info
  - **Claims** (`cc_insurance_claims`): Claim case files with status workflow (draft → assembled → submitted → approved/denied)
  - **Inputs** (`cc_claim_inputs`): Links claims to sealed bundles/objects with SHA256 copies at attach time
  - **Dossiers** (`cc_claim_dossiers`): Immutable assembled dossiers with versioning and export tracking
  - **Assembly Engine**: Deterministic dossier generation with sorted timelines and evidence categorization
  - **Export Format**: zip_json (dossier.json + inputs.json) stored to R2
  - **Tests**: 18 passing tests covering attach validation, deterministic hashing, versioning, immutability
- **P2.7 Legal Hold & Retention Policies** (Migration 133): Spoliation prevention and audit-grade hold management:
  - **Holds** (`cc_legal_holds`): Hold containers with types (insurance_claim, dispute_defense, class_action, regulatory, litigation)
  - **Targets** (`cc_legal_hold_targets`): What's protected (evidence_object, evidence_bundle, claim, claim_dossier, table_scope)
  - **Events** (`cc_legal_hold_events`): Append-only audit log for all hold actions
  - **Retention** (`cc_retention_policies`): Metadata for future retention automation
  - **DB Triggers**: BEFORE UPDATE/DELETE triggers on protected tables that call `cc_is_row_on_active_hold()` and raise `LEGAL_HOLD_ACTIVE`
  - **Scope Inheritance**: Holding a claim automatically protects linked evidence and dossiers
  - **Tests**: 16 passing tests covering hold creation, enforcement, release, and append-only events
- **P2.8 Offline/Low-Signal Evidence Queue** (Migration 134): Evidence capture without connectivity:
  - **Sync Sessions** (`cc_sync_sessions`): Device session tracking with app version and last seen timestamp
  - **Ingest Queue** (`cc_offline_ingest_queue`): Idempotent batch processing with status tracking (received → processed)
  - **Reconcile Log** (`cc_offline_reconcile_log`): Append-only audit trail with result tracking (applied, partially_applied, rejected)
  - **Client Queue Library**: `client/src/lib/offline/offlineQueue.ts` with localStorage persistence, network status monitoring, batch creation
  - **Server Ingest Module**: `server/lib/offline/ingest.ts` with batch idempotency (tenant_id + device_id + batch_client_request_id), item idempotency (tenant_id + client_request_id), hash verification, hold enforcement
  - **Pending Bytes Flow**: file_r2 items without r2_key create evidence with pending_bytes=true, cannot be sealed until bytes uploaded
  - **API Endpoints**: 7 routes under `/api/offline/*` for sync sessions, uploads, ingest, seal, and URL fetching
  - **RLS Policies**: Individual access to own sessions/queued items with service mode bypass
  - **Tests**: 10 passing tests covering sync sessions, batch/item idempotency, hash mismatch rejection, pending bytes, hold enforcement, sealing, and append-only logs
- **P2.9 Authority/Adjuster Read-Only Portals** (Migration 135): Secure external access for insurance adjusters, legal authorities, and auditors:
  - **Grants** (`cc_authority_access_grants`): Grant containers with recipient info, expiry, max views, optional passcode
  - **Scopes** (`cc_authority_access_scopes`): Defines what a grant can access (evidence_bundle, insurance_claim, claim_dossier)
  - **Tokens** (`cc_authority_access_tokens`): Shareable tokens with SHA-256 hashing, usage tracking, revocation
  - **Events** (`cc_authority_access_events`): Append-only audit log with FORCE RLS
  - **SECURITY DEFINER Functions**: 7 functions (validate_token, get_bundle_manifest, get_dossier, get_evidence_object_summary, list_scope_index, check_scope, log_event)
  - **Session Tokens**: JWT with 15-minute expiry after successful token+passcode validation
  - **Rate Limiting**: 30 requests/minute per IP+token hash combination
  - **Signed Downloads**: R2 pre-signed URLs with 60-second expiry
  - **Public Routes**: `/p/authority/*` for external access (validate, scopes, bundle, dossier, evidence, download)
  - **Admin Routes**: `/api/authority/*` for grant/scope/token management
  - **Tests**: 28 passing tests covering token generation, passcode enforcement, validation, revocation, rate limiting

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

### Environment Variables
- `DATABASE_URL`
- `FIRECRAWL_API_KEY`
- `MAPBOX_ACCESS_TOKEN`
- `SESSION_SECRET`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_URL`