# TASK: Build Work Requests Inbox + Projects System (Contractor Reality Edition v1.1)

---

## ⚠️ IMPORTANT REALITY CHECK — READ THIS FIRST

This system is built for contractors working under time pressure, often on a phone, often offline, often after the fact.

**If any workflow:**
- Takes more than 10 seconds to capture intake
- Requires more than one required field beyond the bare minimum
- Blocks saving due to "missing data"
- Forces line items or categories
- Feels like enterprise software

**It will not be used in peak season and must be considered a failure.**

The bar is: "Faster than a sticky note."

---

## HARD CONSTRAINTS (VIOLATING THESE IS A REGRESSION)

### 1. Minimum Viable Intake
A Work Request MUST be savable with ONLY:
- One contact channel (phone OR email OR text)
- Created by actor

That's it. Name, property, description, category — ALL OPTIONAL at intake.

### 2. No Required Line Items
A Project with just a description and total amount ($2,500) is a COMPLETE and VALID quote.
Line items are optional. The system may SUGGEST them but must NEVER enforce them.

### 3. Backwards Entry is First-Class
"I already did this job" is not an edge case. It's how 40% of invoicing happens.
Projects can be created with status = Completed from day one.

### 4. No HR Software
This is not an HR system. No performance reviews. No time sheets. No compliance scoring.
Crew notes are private, blunt, and practical.

### 5. No Inventory Software
Equipment tracking is about WHERE IT IS, not depreciation or serial number management.
"Spotted" (someone saw it somewhere) is a valid equipment state.

### 6. Privacy by Default
All data is tenant-isolated. No cross-tenant visibility unless explicitly granted.
No global directories. No auto-sharing. No "helpful" data exposure.

### 7. Deliberate Blindness
Cash jobs, trade, favors — the system does NOT force financial records.
Projects can close without invoices. This is not a bug.

---

## VOCABULARY (LOCKED)

| Term | Meaning |
|------|---------|
| Work Requests | Intake inbox (the phone call, text, walk-in) |
| Projects | The actual job (quote → done → paid) |
| Contacts | People |
| Organizations | Businesses, government, bands, charities, schools |
| Properties | Physical locations |
| Units | Rooms, cottages, stalls, slips within a property |
| Photos | Before / During / After (NOT albums, NOT media) |

**DO NOT USE:** Work Orders, Opportunities, Jobs, Albums, Media, Assets

---

## PART 1: WORK REQUESTS (The Intake Inbox)

### 1.1 Philosophy

Work Requests are for capturing "someone called" — not for detailed job planning.
This is the sticky note replacement. If it's slower than a sticky note, it fails.

### 1.2 Required vs Optional Fields

```
REQUIRED (intake cannot save without these):
├── contact_channel_value (phone OR email OR text message content)
├── created_by_actor_id (who took this)

OPTIONAL (can be added immediately or never):
├── contact_channel_type (phone/email/text/walkin/voicemail/referral)
├── contact_channel_notes ("ask for Dave", "wife's phone")
├── contact_id (link to existing contact)
├── organization_id
├── property_id
├── unit_id
├── location_text (freeform if no property)
├── summary (one line)
├── description (longer)
├── category
├── priority (urgent/normal/low)
├── source
├── referral_source
```

**The system MUST save with only the required fields. Any additional validation is forbidden.**

### 1.3 Database Schema

```sql
-- Work Request status enum
DO $$ BEGIN
  CREATE TYPE work_request_status AS ENUM (
    'new',           -- Just came in
    'contacted',     -- We called them back
    'quoted',        -- Sent a quote (before conversion)
    'converted',     -- Became a Project
    'closed',        -- Won't proceed
    'spam'           -- Junk/wrong number
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS work_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id),
  
  -- The only truly required field: how to reach them
  contact_channel_value VARCHAR(255) NOT NULL,
  contact_channel_type VARCHAR(20) DEFAULT 'phone',
  contact_channel_notes TEXT,
  
  -- Optional contact linking
  contact_id UUID REFERENCES crm_contacts(id),
  organization_id UUID REFERENCES crm_organizations(id),
  
  -- Optional location
  property_id UUID REFERENCES crm_properties(id),
  unit_id UUID,
  location_text VARCHAR(500),
  
  -- The ask (all optional)
  summary TEXT,
  description TEXT,
  category VARCHAR(100),
  priority VARCHAR(20) DEFAULT 'normal',
  
  -- Source tracking (optional)
  source VARCHAR(50),
  referral_source VARCHAR(255),
  
  -- Status
  status work_request_status DEFAULT 'new',
  
  -- Conversion tracking
  converted_to_project_id UUID,
  converted_at TIMESTAMPTZ,
  converted_by_actor_id UUID,
  
  -- Closure
  closed_reason VARCHAR(255),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_actor_id UUID NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Multi-hat support
  answering_as_tenant_id UUID REFERENCES cc_tenants(id)
);

CREATE INDEX IF NOT EXISTS idx_work_requests_tenant_status 
  ON work_requests(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_work_requests_channel 
  ON work_requests(contact_channel_value);
CREATE INDEX IF NOT EXISTS idx_work_requests_created 
  ON work_requests(tenant_id, created_at DESC);

ALTER TABLE work_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS work_requests_tenant_isolation ON work_requests;
CREATE POLICY work_requests_tenant_isolation ON work_requests
  FOR ALL USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.current_tenant_id', true) IS NULL
    OR current_setting('app.current_tenant_id', true) = ''
  );
```

### 1.4 API Routes

```
Base: /api/work-requests

GET    /                    List (filter by status, search)
POST   /                    Create (minimal fields OK)
GET    /:id                 Get single
PATCH  /:id                 Update
POST   /:id/convert         Convert to Project
POST   /:id/close           Close without converting
```

**POST / must accept this minimal payload and succeed:**
```json
{
  "contact_channel_value": "250-555-1234"
}
```

Everything else gets defaults or NULL.

### 1.5 UI: Work Requests List

**Route:** `/app/work-requests`

```
┌─────────────────────────────────────────────────────────────┐
│ Work Requests                              [+ Quick Add]    │
├─────────────────────────────────────────────────────────────┤
│ [New (12)] [Contacted (5)] [Quoted (3)] [Closed] [All]     │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📞 250-555-1234                    5 min ago  [Convert] │ │
│ │ "septic making noise"                                   │ │
│ │ 📍 Location needed                                      │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📞 Dave Wilson                   2 hours ago  [Convert] │ │
│ │ "quote for driveway sealing"                            │ │
│ │ 📍 123 Marine Dr, Bamfield                              │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Each card shows:**
- Contact channel (phone/name if linked)
- Time since created (relative: "5 min ago")
- Summary or "(no description)"
- Location or "Location needed"
- Quick [Convert] button

**Empty state:**
```
No work requests right now.
When someone calls, capture it here.
```

### 1.6 UI: Quick Add (The Phone Is Ringing)

**Route:** `/app/work-requests/quick` (or modal from list)

**This must be completable in under 10 seconds.**

```
┌─────────────────────────────────────────────────────────────┐
│ Quick Capture                                         [X]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Phone or Email *                                            │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 250-555-1234                                            │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ What do they need? (optional)                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ septic noise, joe referral                              │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [🔴 Urgent]                                                 │
│                                                             │
│              [Save & Close]    [Save & Add Another]         │
└─────────────────────────────────────────────────────────────┘
```

**Rules:**
- Phone/Email is the ONLY required field
- Summary can be blank
- "Save & Add Another" for busy days (clears form, stays open)
- Auto-detect existing contact by phone → show name
- Auto-detect multiple properties for contact → show quick-select

### 1.7 UI: Work Request Detail

**Route:** `/app/work-requests/:id`

**Sections:**
1. **Header** — Status badge, created time, created by
2. **Contact** — Channel info, link to contact if exists, [Link Contact] button
3. **Location** — Property or text, [Link Property] button  
4. **Request** — Summary, description (editable)
5. **Notes** — Simple append-only
6. **Actions** — [Convert to Project] (primary), [Close], [Mark Spam]

---

## PART 2: PROJECTS (The Actual Job)

### 2.1 Philosophy

A Project is ONE record from first contact to final payment.
The system must reflect what happened, not what should have happened.

### 2.2 Creation Modes

**Every "Create Project" entry point must offer two modes:**

```
┌─────────────────────────────────────────────────────────────┐
│ ○ New Job (starting fresh)                                  │
│ ○ I Already Did This Job (entering after the fact)          │
└─────────────────────────────────────────────────────────────┘
```

**Mode A: New Job**
- Status defaults to 'lead' or 'quote'
- Full scheduling UI available
- Normal flow

**Mode B: I Already Did This Job**
- Status defaults to 'completed'
- Prompts for:
  - Completion date (default: "Last week" dropdown or date picker)
  - Total amount (optional)
  - Photos from camera roll
- NO scheduling UI shown
- Timeline reconstructed from photo EXIF dates where possible

### 2.3 Pricing Rules

**A single total amount is a complete quote.**

```
Valid quote #1:
  description: "Driveway sealing, prep and two coats"
  quoted_amount: $2,500

Valid quote #2:
  description: "Driveway sealing"
  line_items:
    - Pressure wash: $200
    - Crack fill: $300
    - Seal coat x2: $2,000
  quoted_amount: $2,500
```

Both are equally valid. Line items are OPTIONAL and must never be required.

### 2.4 Settlement Types

Projects can close without invoices:

```
settlement_type:
  - 'invoiced'        -- Normal: invoice sent
  - 'paid_platform'   -- Paid through system
  - 'paid_external'   -- Paid outside system (cash, e-transfer direct)
  - 'trade'           -- Exchanged for goods/services
  - 'gift'            -- No payment expected
  - 'writeoff'        -- Forgiven/uncollectable
  - 'cancelled'       -- Didn't happen
  - NULL              -- Not yet settled
```

The system does NOT nag about financial records. This is deliberate.

### 2.5 Database Schema

```sql
-- Project status enum
DO $$ BEGIN
  CREATE TYPE project_status AS ENUM (
    'lead',
    'quote',
    'approved',
    'scheduled',
    'in_progress',
    'completed',
    'invoiced',
    'paid',
    'cancelled',
    'warranty'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id),
  
  -- Basic info
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Customer (optional - can be added later)
  contact_id UUID REFERENCES crm_contacts(id),
  organization_id UUID REFERENCES crm_organizations(id),
  
  -- Location (at least one should exist, but not enforced at DB level)
  property_id UUID REFERENCES crm_properties(id),
  unit_id UUID,
  location_text VARCHAR(500),
  
  -- Status
  status project_status DEFAULT 'lead',
  
  -- Money (simple - line items are separate and optional)
  quoted_amount DECIMAL(12,2),
  final_amount DECIMAL(12,2),
  deposit_required DECIMAL(12,2),
  deposit_received BOOLEAN DEFAULT FALSE,
  deposit_received_at TIMESTAMPTZ,
  
  -- Dates
  quoted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  scheduled_start DATE,
  scheduled_end DATE,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  invoiced_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  
  -- Warranty
  warranty_months INTEGER DEFAULT 12,
  warranty_expires_at DATE,
  warranty_notes TEXT,
  parent_project_id UUID REFERENCES projects(id),
  
  -- Service Run link (optional)
  service_run_id UUID,
  
  -- Source
  source_work_request_id UUID REFERENCES work_requests(id),
  source VARCHAR(50),
  
  -- Settlement
  settlement_type VARCHAR(30),
  settlement_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_actor_id UUID NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Optional line items (NEVER required)
CREATE TABLE IF NOT EXISTS project_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description VARCHAR(500) NOT NULL,
  quantity DECIMAL(10,2) DEFAULT 1,
  unit_price DECIMAL(10,2),
  total DECIMAL(12,2),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scope snapshots for change orders
CREATE TABLE IF NOT EXISTS project_scope_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  description TEXT,
  amount DECIMAL(12,2),
  reason VARCHAR(100), -- 'original', 'change_order', 'revision'
  notes TEXT, -- "Customer approved verbally 2pm"
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_actor_id UUID NOT NULL
);

-- Photos (Before / During / After)
CREATE TABLE IF NOT EXISTS project_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id),
  
  stage VARCHAR(20) NOT NULL CHECK (stage IN ('before', 'during', 'after')),
  
  storage_key VARCHAR(500),
  storage_url VARCHAR(500),
  filename VARCHAR(255),
  mime_type VARCHAR(100),
  size_bytes INTEGER,
  
  caption TEXT,
  taken_at TIMESTAMPTZ,
  
  uploaded_by_actor_id UUID NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Evidence metadata
  device_info VARCHAR(255),
  geo_lat DECIMAL(10,7),
  geo_lng DECIMAL(10,7)
);

-- Notes (append-only timeline)
CREATE TABLE IF NOT EXISTS project_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  note_type VARCHAR(50) DEFAULT 'note',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_actor_id UUID NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_projects_tenant_status ON projects(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_projects_property ON projects(property_id);
CREATE INDEX IF NOT EXISTS idx_projects_contact ON projects(contact_id);
CREATE INDEX IF NOT EXISTS idx_projects_scheduled ON projects(tenant_id, scheduled_start);
CREATE INDEX IF NOT EXISTS idx_project_photos_project ON project_photos(project_id, stage);

-- RLS on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_scope_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS projects_tenant_isolation ON projects;
CREATE POLICY projects_tenant_isolation ON projects
  FOR ALL USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.current_tenant_id', true) IS NULL
    OR current_setting('app.current_tenant_id', true) = ''
  );

-- Similar policies for child tables referencing project's tenant_id
```

### 2.6 API Routes

```
Base: /api/projects

GET    /                      List (filter by status, property, contact)
POST   /                      Create (supports both modes)
GET    /:id                   Get with photos/notes
PATCH  /:id                   Update
DELETE /:id                   Soft delete

POST   /:id/photos            Upload photo (stage in body)
DELETE /:id/photos/:photoId   Delete photo

POST   /:id/notes             Add note
GET    /:id/timeline          Get full timeline (notes + status changes)

POST   /:id/change-order      Add change order snapshot
```

**POST / for "I Already Did This Job" mode:**
```json
{
  "title": "Septic pump replacement",
  "property_id": "uuid",
  "status": "completed",
  "completed_at": "2025-01-03T00:00:00Z",
  "final_amount": 850,
  "settlement_type": "paid_external"
}
```

This is valid. No line items. No scheduling. Just what happened.

### 2.7 UI: Projects List

**Route:** `/app/projects`

```
┌─────────────────────────────────────────────────────────────┐
│ Projects                   [+ New Project] [+ I Did a Job]  │
├─────────────────────────────────────────────────────────────┤
│ [Active (15)] [Quotes (8)] [Completed] [All]               │
├─────────────────────────────────────────────────────────────┤
│ Search: [________________]  Status: [All ▾]                 │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Driveway Sealing - Wilson         SCHEDULED   Mar 15   │ │
│ │ 📍 123 Marine Dr                   💰 $2,500            │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Septic Pump Repair               IN PROGRESS           │ │
│ │ 📍 456 Boardwalk Rd               💰 $850               │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Two create buttons:**
- [+ New Project] → new job flow
- [+ I Did a Job] → backwards entry flow

### 2.8 UI: Create Project (New Job Mode)

**Route:** `/app/projects/new`

```
┌─────────────────────────────────────────────────────────────┐
│ New Project                                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ What's the job? *                                           │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Driveway sealing                                        │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Where?                                                      │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [Search properties...]              [+ New Property]    │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Customer (optional)                                         │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [Search contacts...]                [+ New Contact]     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Quote amount (optional)                                     │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ $ 2500                                                  │ │
│ └─────────────────────────────────────────────────────────┘ │
│ [ ] Add line item breakdown                                 │
│                                                             │
│                              [Cancel]  [Create Project]     │
└─────────────────────────────────────────────────────────────┘
```

**Rules:**
- Title is the only required field
- Property is strongly encouraged but not blocked
- Contact is optional
- Quote amount is optional
- Line items only show if checkbox clicked

### 2.9 UI: Create Project (I Did a Job Mode)

**Route:** `/app/projects/new?mode=completed` or `/app/projects/log-completed`

```
┌─────────────────────────────────────────────────────────────┐
│ Log Completed Work                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ What did you do? *                                          │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Replaced septic pump, cleared line blockage             │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Where?                                                      │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [Search or type address...]                             │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ When did you finish?                                        │
│ ┌───────────────────────┐                                   │
│ │ Last Friday     ▾     │  [or pick date]                  │
│ └───────────────────────┘                                   │
│                                                             │
│ Total charged (optional)                                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ $ 850                                                   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Add photos                                                  │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │  [📷 Before]    [📷 After]    [📁 From Phone]          │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Payment status                                              │
│ ( ) Not paid yet - I need to invoice                        │
│ (•) Already paid (outside this system)                      │
│ ( ) Trade/barter                                            │
│ ( ) No charge                                               │
│                                                             │
│                              [Cancel]  [Save]               │
└─────────────────────────────────────────────────────────────┘
```

**Rules:**
- Creates project with status = 'completed' or 'paid'
- Completion date has quick options: "Today", "Yesterday", "Last week", or date picker
- Photos picker accesses camera roll
- If photos have EXIF dates, use them to backfill timeline
- "Already paid outside system" sets settlement_type = 'paid_external' with no invoice required

### 2.10 UI: Project Detail

**Route:** `/app/projects/:id`

```
┌─────────────────────────────────────────────────────────────┐
│ Driveway Sealing - Wilson                     [SCHEDULED]   │
│ 📍 123 Marine Dr    👤 Dave Wilson    💰 $2,500             │
├─────────────────────────────────────────────────────────────┤
│ [Photos] [Details] [Notes] [Timeline]                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─── Before (2) ────┬─── During (0) ───┬─── After (0) ────┐ │
│ │ ┌────┐ ┌────┐     │     [+ Add]      │     [+ Add]      │ │
│ │ │ 📷 │ │ 📷 │     │                  │                  │ │
│ │ └────┘ └────┘     │                  │                  │ │
│ │ [+ Add Before]    │                  │                  │ │
│ └───────────────────┴──────────────────┴──────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [Update Status ▾]  [+ Change Order]  [Create Invoice]   │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Tabs:**
- **Photos** (default) — Before/During/After columns, big [+ Add] buttons
- **Details** — Description, amounts, dates, warranty info
- **Notes** — Append-only log with quick-add
- **Timeline** — Status changes, scope snapshots, all activity

**Quick Actions:**
- Status dropdown (lead → quote → approved → scheduled → in_progress → completed → invoiced → paid)
- [+ Change Order] for scope changes
- [Create Invoice] (future)

### 2.11 Quick Change Order

**On Project detail, always visible:** `[+ Change Order]`

```
┌─────────────────────────────────────────────────────────────┐
│ Add Change Order                                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ What's being added/changed?                                 │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Add outlet in garage                                    │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Additional amount                                           │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ $ 350                                                   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ How was this approved?                                      │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Dave approved verbally on site, 2pm Tuesday             │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [📷 Photo of change location]                               │
│                                                             │
│                              [Cancel]  [Save Change Order]  │
└─────────────────────────────────────────────────────────────┘
```

**Creates:**
- project_scope_snapshots record
- Adds to final_amount
- Timeline entry with approval note

---

## PART 3: CONVERSION FLOW (Work Request → Project)

### 3.1 Endpoint

**POST /api/work-requests/:id/convert**

```json
// Request
{
  "project_title": "Septic pump repair",  // optional
  "project_status": "quote"               // optional, default 'quote'
}

// Response
{
  "success": true,
  "project_id": "uuid",
  "project_url": "/app/projects/uuid",
  "migrated": {
    "contact": true,
    "property": true,
    "notes": 2
  }
}
```

### 3.2 Server Logic

1. Create Project:
   - title = request.project_title OR work_request.summary OR "New Project"
   - contact_id = work_request.contact_id
   - property_id = work_request.property_id
   - location_text = work_request.location_text
   - status = request.project_status OR 'quote'
   - source = 'work_request'
   - source_work_request_id = work_request.id

2. Update Work Request:
   - status = 'converted'
   - converted_to_project_id = new project
   - converted_at = now()
   - converted_by_actor_id = current actor

3. Create project_note: "Converted from work request"

4. Return project info

### 3.3 UI: Convert Button

On Work Request detail, primary action: `[Convert to Project]`

**If contact AND property exist:**
- Single click converts immediately
- Redirect to new project

**If contact OR property missing:**
```
┌─────────────────────────────────────────────────────────────┐
│ Convert to Project                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ⚠️  This request is missing:                                │
│     • Contact name                                          │
│     • Property/location                                     │
│                                                             │
│ You can add these now or later.                             │
│                                                             │
│ Contact: [Search...]  or  [Skip]                            │
│ Property: [Search...] or  [Skip]                            │
│                                                             │
│              [Cancel]  [Skip & Convert]  [Add & Convert]    │
└─────────────────────────────────────────────────────────────┘
```

**"Skip & Convert" always works.** Missing data is allowed.

---

## PART 4: MULTI-HAT SUPPORT (Answering As)

### 4.1 The Problem

Sheryl answers phones for Chamber, Bamfield Excavation, and Woods End.
When she creates a Work Request, which tenant owns it?

### 4.2 Implementation

**Check if user has multiple tenant memberships:**
```sql
SELECT t.id, t.name FROM cc_tenants t
JOIN tenant_members tm ON tm.tenant_id = t.id
WHERE tm.user_id = :current_user_id
AND tm.status = 'active';
```

**If count > 1, show "Answering as" in header:**

```
┌─────────────────────────────────────────────────────────────┐
│ Sheryl                              Answering as: Chamber ▾ │
└─────────────────────────────────────────────────────────────┘
                                          │
                                          ├── Chamber (current)
                                          ├── Bamfield Excavation
                                          └── Woods End Landing
```

**Rules:**
- Switching changes current_tenant_id in session
- Work Requests/Projects created under that tenant
- No cross-tenant visibility
- Switching is instant (no logout required)

---

## PART 5: NAVIGATION

Add to left nav (TenantAppLayout):

```
CRM Section:
├── Work Requests  → /app/work-requests
├── Projects       → /app/projects
├── Contacts       → /app/crm/contacts
├── Organizations  → /app/crm/organizations
└── Properties     → /app/crm/properties
```

Or flatten if preferred:
```
├── Work Requests
├── Projects
├── Contacts
├── Properties
```

---

## PART 6: VERIFICATION CHECKLIST

### A) Database
- [ ] work_requests table created with RLS
- [ ] projects table created with RLS
- [ ] project_photos table created
- [ ] project_notes table created  
- [ ] project_line_items table created (optional usage)
- [ ] project_scope_snapshots table created
- [ ] All indexes in place
- [ ] Migrations run without error

### B) Work Requests API
- [ ] POST /api/work-requests with ONLY phone number succeeds
- [ ] GET /api/work-requests returns list filtered by status
- [ ] GET /api/work-requests/:id returns full record
- [ ] PATCH /api/work-requests/:id updates
- [ ] POST /api/work-requests/:id/convert creates project
- [ ] POST /api/work-requests/:id/close works

### C) Projects API
- [ ] POST /api/projects creates new project
- [ ] POST /api/projects with status='completed' works (backwards entry)
- [ ] GET /api/projects returns list with filters
- [ ] GET /api/projects/:id returns project with photos/notes
- [ ] PATCH /api/projects/:id updates
- [ ] POST /api/projects/:id/photos uploads photo with stage
- [ ] POST /api/projects/:id/notes adds note
- [ ] POST /api/projects/:id/change-order creates snapshot

### D) Work Requests UI
- [ ] /app/work-requests loads list with status tabs
- [ ] Quick Add creates request with just phone number
- [ ] /app/work-requests/:id shows detail
- [ ] Convert button works (with and without missing data)
- [ ] Redirect to project after convert

### E) Projects UI
- [ ] /app/projects loads list
- [ ] [+ New Project] creates via normal flow
- [ ] [+ I Did a Job] creates via backwards entry flow
- [ ] /app/projects/:id shows detail with photo tabs
- [ ] Photo upload works
- [ ] Notes add works
- [ ] Change order works
- [ ] Status update works

### F) Conversion Flow
- [ ] Work Request converts to Project
- [ ] Contact/Property linked if present
- [ ] Work Request status = 'converted'
- [ ] Project has source_work_request_id

### G) Navigation
- [ ] Work Requests in nav
- [ ] Projects in nav
- [ ] All links work

### H) Console
- [ ] No runtime errors
- [ ] No React warnings about keys/props

---

## FINAL REMINDER

**The bar is: "Faster than a sticky note."**

If a contractor in June with 3 trucks running and the phone ringing can't use this faster than grabbing a pen, it has failed.

Keep it simple. Keep it fast. Keep it honest.

BEGIN IMPLEMENTATION.
