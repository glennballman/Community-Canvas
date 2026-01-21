# ChatGPT Context Rebuild - Community Canvas V3.5

> Generated: January 21, 2026

---

## 1. System Architecture & Schema

### Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, TanStack Query, Wouter, Tailwind, shadcn/ui |
| Backend | Node.js, Express.js, TypeScript (ESM) |
| Database | PostgreSQL with Drizzle ORM |
| Storage | Cloudflare R2 for media |

### Table Naming Convention

All application tables use `cc_*` prefix (Community Canvas).

---

## 2. AI Ingestion Pipeline (A2.1-A2.3)

### Core Table: cc_ai_ingestions

```typescript
export const ccAiIngestions = pgTable("cc_ai_ingestions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  contractorProfileId: uuid("contractor_profile_id").notNull(),
  
  // Source type: vehicle_photo | tool_photo | sticky_note | jobsite_photo | document
  sourceType: varchar("source_type", { length: 30 }).notNull(),
  
  // Status: proposed | confirmed | discarded | error
  status: varchar("status", { length: 20 }).notNull().default('proposed'),
  
  // Media array: [{ url, mime, bytes, width?, height?, captured_at, exif?, geo_lat?, geo_lng? }]
  media: jsonb("media").notNull().default([]),
  
  // AI-generated proposal (stub until real AI integration)
  aiProposedPayload: jsonb("ai_proposed_payload").notNull().default({}),
  
  // Human-confirmed payload (set on confirm action)
  humanConfirmedPayload: jsonb("human_confirmed_payload"),
  
  // Confidence score (0-100)
  confidenceScore: numeric("confidence_score"),
  
  // A2.1: Identity proposal from vehicle photos
  identityProposal: jsonb("identity_proposal").notNull().default({}),
  identityProposalStatus: varchar("identity_proposal_status", { length: 20 }).notNull().default('none'),
  
  // A2.2: Service area proposals from location signals
  proposedServiceAreas: jsonb("proposed_service_areas").notNull().default([]),
  serviceAreaStatus: varchar("service_area_status", { length: 20 }).notNull().default('none'),
  
  // A2.3: Unified classification output
  classification: jsonb("classification").notNull().default({}),    // { primary, secondary[], confidence }
  extractedEntities: jsonb("extracted_entities").notNull().default({}),
  geoInference: jsonb("geo_inference").notNull().default({}),       // { lat?, lng?, proposedAddress?, confidence, source }
  proposedLinks: jsonb("proposed_links").notNull().default({}),     // { vehicle, tool, jobsite, customer, serviceRun, beforeAfterBundle }
  contextHint: varchar("context_hint", { length: 20 }),             // onboarding | job | fleet | unknown
  batchSource: varchar("batch_source", { length: 20 }),             // camera | upload | bulk
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### Classification Types

```typescript
type ClassificationType = 
  | 'vehicle_truck' | 'vehicle_trailer' | 'vehicle_van'
  | 'tool' | 'material'
  | 'jobsite' | 'before_photo' | 'after_photo'
  | 'whiteboard' | 'sticky_note'
  | 'document' | 'receipt'
  | 'unknown';
```

### Extracted Entities Schema

```typescript
interface ExtractedEntities {
  // PRIVACY: No raw licensePlate - only region is stored for fleet matching
  licensePlateRegion?: { value: string; confidence: number; source?: string };
  companyName?: { value: string; confidence: number; source?: string };
  phone?: { value: string; confidence: number; source?: string };
  email?: { value: string; confidence: number; source?: string };
  website?: { value: string; confidence: number; source?: string };
  customerName?: { value: string; confidence: number; source?: string };
  // PRIVACY: Address is ADVISORY ONLY - UI displays "Photo captured near..."
  addressAdvisory?: { value: string; confidence: number; source?: string };
  materials?: Array<{ name: string; qty?: string; unit?: string; confidence: number }>;
  scopePhrases?: Array<{ text: string; confidence: number }>;
  dates?: Array<{ value: string; confidence: number }>;
  text?: string;
}
```

---

## 3. A2.3 Asset Tables

### cc_contractor_fleet (Vehicles)

```typescript
export const ccContractorFleet = pgTable("cc_contractor_fleet", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  contractorProfileId: uuid("contractor_profile_id").notNull(),
  assetType: varchar("asset_type", { length: 30 }).notNull(),  // truck | trailer | van | suv | other
  make: text("make"),
  model: text("model"),
  year: integer("year"),
  color: text("color"),
  licensePlate: text("license_plate"),        // Contractor-confirmed (not AI-extracted)
  licensePlateRegion: text("license_plate_region"),
  unitNumber: text("unit_number"),
  capabilities: jsonb("capabilities").notNull().default({}),  // { snow_blade, trailer_hitch, enclosed }
  sourceIngestionId: uuid("source_ingestion_id"),
  primaryMediaId: uuid("primary_media_id"),
  isConfirmed: boolean("is_confirmed").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
});
```

### cc_contractor_tools

```typescript
export const ccContractorTools = pgTable("cc_contractor_tools", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  contractorProfileId: uuid("contractor_profile_id").notNull(),
  assetType: varchar("asset_type", { length: 30 }).notNull(),  // tool | material | equipment
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  quantity: text("quantity"),
  unit: text("unit"),
  capabilities: jsonb("capabilities").notNull().default({}),
  sourceIngestionId: uuid("source_ingestion_id"),
  primaryMediaId: uuid("primary_media_id"),
  isConfirmed: boolean("is_confirmed").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
});
```

### cc_contractor_jobsites

```typescript
export const ccContractorJobsites = pgTable("cc_contractor_jobsites", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  contractorProfileId: uuid("contractor_profile_id").notNull(),
  proposedAddress: text("proposed_address"),
  confirmedAddress: text("confirmed_address"),
  geoLat: numeric("geo_lat", { precision: 10, scale: 7 }),
  geoLng: numeric("geo_lng", { precision: 10, scale: 7 }),
  addressConfidence: numeric("address_confidence", { precision: 3, scale: 2 }),
  customerId: uuid("customer_id"),
  mediaIds: jsonb("media_ids").notNull().default([]),
  hasBeforePhotos: boolean("has_before_photos").notNull().default(false),
  hasAfterPhotos: boolean("has_after_photos").notNull().default(false),
  sourceIngestionIds: jsonb("source_ingestion_ids").notNull().default([]),
  isConfirmed: boolean("is_confirmed").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  firstPhotoAt: timestamp("first_photo_at", { withTimezone: true }),
  lastPhotoAt: timestamp("last_photo_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
});
```

### cc_contractor_customers

```typescript
export const ccContractorCustomers = pgTable("cc_contractor_customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  contractorProfileId: uuid("contractor_profile_id").notNull(),
  name: text("name"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  notes: text("notes"),
  nameConfidence: numeric("name_confidence", { precision: 3, scale: 2 }),
  phoneConfidence: numeric("phone_confidence", { precision: 3, scale: 2 }),
  sourceIngestionId: uuid("source_ingestion_id"),
  isConfirmed: boolean("is_confirmed").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
});
```

### cc_contractor_opportunities (Patent CC-11)

```typescript
export const ccContractorOpportunities = pgTable("cc_contractor_opportunities", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  contractorProfileId: uuid("contractor_profile_id").notNull(),
  opportunityType: varchar("opportunity_type", { length: 30 }).notNull(),  // zone_expansion | asset_upsell | route_corridor | seasonal
  portalId: uuid("portal_id"),
  zoneId: uuid("zone_id"),
  reason: text("reason").notNull(),
  confidence: numeric("confidence", { precision: 3, scale: 2 }).default('0.00'),
  details: jsonb("details").notNull().default({}),  // { suggestedAsset, fitsWith, openRequestsCount, distanceFromCurrent, demandLevel, seasonalWindow, routeCorridor }
  status: varchar("status", { length: 20 }).notNull().default('proposed'),  // proposed | accepted | dismissed | expired
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});
```

### cc_contractor_photo_bundles

```typescript
export const ccContractorPhotoBundles = pgTable("cc_contractor_photo_bundles", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  contractorProfileId: uuid("contractor_profile_id").notNull(),
  bundleType: varchar("bundle_type", { length: 30 }).notNull().default('before_after'),  // before_after | progress_series
  jobsiteId: uuid("jobsite_id"),
  beforeMediaIds: jsonb("before_media_ids").notNull().default([]),
  afterMediaIds: jsonb("after_media_ids").notNull().default([]),
  status: varchar("status", { length: 20 }).notNull().default('incomplete'),  // incomplete | complete | confirmed
  missingStage: varchar("missing_stage", { length: 20 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});
```

---

## 4. N3 Service Run Architecture (Patent CC-01)

### Core Tables

```typescript
// N3 Service Runs
export const ccN3Runs = pgTable("cc_n3_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("scheduled"),  // scheduled | active | completed | cancelled
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  portalId: uuid("portal_id"),
  zoneId: uuid("zone_id"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// N3 Segments: move | ride | work | stay | wait | load
export const ccN3Segments = pgTable("cc_n3_segments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  runId: uuid("run_id").notNull().references(() => ccN3Runs.id, { onDelete: "cascade" }),
  segmentKind: text("segment_kind").notNull(),  // move | ride | work | stay | wait | load
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  startWindow: jsonb("start_window"),  // { earliest, latest }
  endWindow: jsonb("end_window"),
  locationRef: text("location_ref"),
  dependsOnSegmentId: uuid("depends_on_segment_id"),
  constraints: jsonb("constraints"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// N3 Surface Requirements - Bind segments to surfaces with actor profiles
export const ccN3SurfaceRequirements = pgTable("cc_n3_surface_requirements", {
  id: uuid("id").primaryKey().defaultRandom(),
  portalId: uuid("portal_id").notNull(),
  tenantId: uuid("tenant_id"),
  runId: uuid("run_id").notNull(),
  segmentId: uuid("segment_id").notNull(),
  surfaceId: uuid("surface_id").notNull(),
  containerId: uuid("container_id"),
  requiredSurfaceType: varchar("required_surface_type").notNull(),  // movement | sleep | sit | stand | utility
  actorProfile: jsonb("actor_profile").notNull().default({}),  // { actor_type, mass_g, width_mm, footprint_mm2, traction }
  demand: jsonb("demand").notNull().default({}),  // { watts_continuous, hours, sit_units_requested, rowing_required }
  requiredConstraints: jsonb("required_constraints").notNull().default({}),  // { no_grates, min_clear_width_mm, max_slope_pct }
  riskTolerance: numeric("risk_tolerance", { precision: 4, scale: 3 }).notNull().default("0.5"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// N3 Execution Contracts (Zero-Trust)
export const ccN3ExecutionContracts = pgTable('cc_n3_execution_contracts', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  segmentId: uuid('segment_id').notNull(),
  executorId: uuid('executor_id').notNull(),
  contractTerms: jsonb('contract_terms').notNull(),  // { deadline, penalty_conditions, required_evidence }
  status: text('status').notNull().default('pending'),  // pending | accepted | rejected | completed | failed
  signedAt: timestamp('signed_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### Monitor & Replan System

```typescript
// Monitor State - Tracks risk for each run
export const ccMonitorState = pgTable("cc_monitor_state", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  runId: uuid("run_id").notNull().unique(),
  policyId: uuid("policy_id").notNull(),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  nextCheckAt: timestamp("next_check_at", { withTimezone: true }),
  lastRiskScore: numeric("last_risk_score", { precision: 5, scale: 3 }),
  lastRiskFingerprint: text("last_risk_fingerprint"),
  lastBundleId: uuid("last_bundle_id"),
});

// Replan Bundles - Attention bundles for runs needing intervention
export const ccReplanBundles = pgTable("cc_replan_bundles", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  runId: uuid("run_id").notNull(),
  status: text("status").notNull().default("open"),  // open | dismissed | actioned
  reasonCodes: text("reason_codes").array().notNull().default([]),  // WEATHER_CHANGE | SURFACE_UNAVAIL | RESOURCE_CONFLICT | etc.
  summary: text("summary").notNull(),
  riskDelta: numeric("risk_delta", { precision: 5, scale: 3 }).notNull().default("0"),
  bundle: jsonb("bundle").notNull(),  // Full context for decision-making
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Replan Options - Alternative plans when issues detected
export const ccReplanOptions = pgTable("cc_replan_options", {
  id: uuid("id").primaryKey().defaultRandom(),
  bundleId: uuid("bundle_id").notNull(),
  rank: integer("rank").notNull(),
  label: text("label").notNull(),
  plan: jsonb("plan").notNull(),
  validation: jsonb("validation").notNull(),
  estimatedImpact: jsonb("estimated_impact"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

---

## 5. AI Proposes → Human Confirms Flow

### Hard Invariants

1. **Never auto-link by default** - `auto_link` defaults to `false`
2. **All AI output is proposal only** - Status starts as `proposed`, requires explicit `confirm` action
3. **Privacy-first license plates** - Never store raw license plates from AI extraction (only region for fleet matching)
4. **Addresses are advisory only** - Display as "Photo captured near..." not "Address:"
5. **Confidence scores required** - Every extraction includes 0-100 confidence
6. **Provenance tracking** - Every linked entity stores `sourceIngestionId`

### State Machine

```
[Upload Media] → cc_ai_ingestions (status: proposed)
     ↓
[AI Classification] → Updates: classification, extractedEntities, geoInference, proposedLinks
     ↓
[User Review UI] → Shows proposals with confidence, suggested actions
     ↓
[User Action]
  ├─ CONFIRM → Creates entity in cc_contractor_fleet/tools/jobsites/customers
  │            Updates ingestion status: confirmed, humanConfirmedPayload set
  ├─ EDIT → Opens form pre-filled with AI proposal, user corrects, then confirm
  └─ DISMISS → Updates ingestion status: discarded
```

### NextAction Types

```typescript
type NextActionType = 
  | 'confirm_vehicle' 
  | 'confirm_tool' 
  | 'confirm_jobsite' 
  | 'confirm_customer'
  | 'request_before_photo' 
  | 'request_after_photo' 
  | 'confirm_make_model'
  | 'expand_service_area' 
  | 'asset_upsell' 
  | 'open_message_thread';
```

---

## 6. Media System

### Current State

- Media stored in Cloudflare R2 (tenant-isolated buckets)
- Media items stored as JSONB array in `cc_ai_ingestions.media`
- EXIF extraction for GPS coordinates
- Width/height/bytes tracked for each item

### MediaItem Schema

```typescript
interface MediaItem {
  url: string;           // R2 URL
  mime: string;          // image/jpeg, image/png, etc.
  bytes: number;         // File size
  width?: number;        // Image width
  height?: number;       // Image height
  captured_at?: string;  // ISO timestamp from EXIF
  exif?: any;            // Full EXIF data
  geo_lat?: number;      // GPS latitude
  geo_lng?: number;      // GPS longitude
}
```

### CompanyCam Replacement Intent

The A2.3 photo classification system is designed to replace CompanyCam-style functionality:
- Before/after photo pairing → `cc_contractor_photo_bundles`
- Jobsite photo clustering → `cc_contractor_jobsites` with GPS grouping
- Work documentation → Links to service runs and work requests

---

## 7. Key Services

### contractorUploadClassifier.ts

- Visual classifier (stub) → classifies images by type
- OCR extractor (stub) → extracts text entities
- EXIF processor → extracts GPS and timestamp
- License plate region detector (stub) → extracts region only (not raw plate)
- Auto-linker → proposes links to existing fleet/tools/jobsites
- Next action generator → suggests follow-up actions

### contractorRouteOpportunityEngine.ts (Patent CC-11)

- `analyzeFleetCapabilities()` → Summarizes contractor's fleet
- `analyzeJobsitePatterns()` → Finds travel corridors from GPS
- `detectAssetUpsells()` → Suggests equipment based on open work requests
- `detectUnderservedZones()` → Finds nearby portals with unmet demand
- `detectSeasonalOpportunities()` → Matches contractor capabilities to seasonal work
- `generateOpportunities()` → Combines all analysis into actionable opportunities

---

## 8. API Endpoints

### A2.3 Ingestion APIs

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/contractor/ingestions` | Create new ingestion with classification |
| GET | `/api/contractor/ingestions` | List ingestions for contractor |
| PATCH | `/api/contractor/ingestions/:id/confirm` | Confirm AI proposal |
| PATCH | `/api/contractor/ingestions/:id/dismiss` | Dismiss ingestion |

### A2.3 Asset APIs

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/contractor/fleet` | List contractor vehicles |
| POST | `/api/contractor/fleet/:id/confirm` | Confirm vehicle from proposal |
| GET | `/api/contractor/tools` | List contractor tools/materials |
| POST | `/api/contractor/tools/:id/confirm` | Confirm tool from proposal |
| GET | `/api/contractor/jobsites` | List contractor jobsites |
| POST | `/api/contractor/jobsites/:id/confirm` | Confirm jobsite from proposal |
| GET | `/api/contractor/customers` | List draft customers |
| POST | `/api/contractor/customers/:id/confirm` | Confirm customer from proposal |

### A2.3 Opportunity APIs

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/contractor/opportunities` | List opportunities for contractor |
| POST | `/api/contractor/opportunities/:id/respond` | Accept or dismiss opportunity |

---

## 9. Terminology Standards

**REQUIRED:**
- "Work Request" (not "job")
- "reserve/reservation" (not "book/booking")

**FORBIDDEN:**
- Never use "job" for work items
- Never use "book" or "booking"

---

## 10. Patents

- **CC-01**: N3 Service Run Monitor + Replan Engine - Inventor: Glenn Ballman
- **CC-02**: V3.5 Surface Spine - Inventor: Glenn Ballman  
- **CC-11**: Route + Coverage + Opportunity Inference Engine - Inventor: Glenn Ballman
