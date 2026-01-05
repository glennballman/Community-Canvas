-- ============================================================
-- COMMUNITY CANVAS v2.6 - PAYMENT PROMISES (HONOR SYSTEM)
-- Migration 037 - Schema Alignment + Soft Tracking
-- ============================================================

-- Philosophy:
-- - Track payments, don't enforce them
-- - Honor system like early eBay
-- - Work continues regardless of payment status
-- - NO HARD GATES anywhere
-- - Both parties can always unlock contact (owner OR contractor)

-- ============================================================
-- 1. EXTEND EXISTING ENUMS (Align with actual workflow)
-- ============================================================

-- Extend milestone_trigger to include 'manual'
DO $$ BEGIN
  ALTER TYPE milestone_trigger ADD VALUE IF NOT EXISTS 'manual';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Extend payment_status to include workflow states
DO $$ BEGIN
  ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'partial' AFTER 'received';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'submitted' AFTER 'pending';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Extend contact_unlock_gate for contractor override
DO $$ BEGIN
  ALTER TYPE contact_unlock_gate ADD VALUE IF NOT EXISTS 'contractor_override';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. PAYMENT COMMUNICATION STATUS (Soft Signals)
-- ============================================================

DO $$ BEGIN
  CREATE TYPE payment_communication AS ENUM (
    'on_track',           -- Everything normal
    'gentle_reminder',    -- Friendly nudge
    'behind_schedule',    -- Payment delayed
    'hardship_noted',     -- Owner communicated difficulty
    'community_event',    -- Fire/flood/earthquake affecting area
    'worked_out',         -- Parties resolved it themselves
    'written_off'         -- Contractor decided to absorb loss
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 3. ADD MISSING COLUMNS TO payment_promises
-- ============================================================

-- Add owner/contractor semantic aliases (payer=owner, payee=contractor)
-- We keep payer_party_id/payee_party_id as canonical but add views
DO $$ BEGIN
  -- Communication status
  ALTER TABLE payment_promises 
    ADD COLUMN IF NOT EXISTS communication_status payment_communication DEFAULT 'on_track';
  
  -- Notes between parties
  ALTER TABLE payment_promises 
    ADD COLUMN IF NOT EXISTS owner_notes TEXT;
  ALTER TABLE payment_promises 
    ADD COLUMN IF NOT EXISTS contractor_notes TEXT;
  
  -- Flexibility flags
  ALTER TABLE payment_promises 
    ADD COLUMN IF NOT EXISTS flexibility_requested BOOLEAN DEFAULT false;
  ALTER TABLE payment_promises 
    ADD COLUMN IF NOT EXISTS flexibility_granted BOOLEAN DEFAULT false;
  ALTER TABLE payment_promises 
    ADD COLUMN IF NOT EXISTS flexibility_reason TEXT;
  
  -- Community event tracking
  ALTER TABLE payment_promises 
    ADD COLUMN IF NOT EXISTS affected_by_community_event BOOLEAN DEFAULT false;
  ALTER TABLE payment_promises 
    ADD COLUMN IF NOT EXISTS community_event_description TEXT;
  
  -- Revised schedule
  ALTER TABLE payment_promises 
    ADD COLUMN IF NOT EXISTS revised_schedule JSONB;
  ALTER TABLE payment_promises 
    ADD COLUMN IF NOT EXISTS revision_reason TEXT;
  
  -- Honor system
  ALTER TABLE payment_promises 
    ADD COLUMN IF NOT EXISTS honor_system_note TEXT;
  
  -- Materials separate flag
  ALTER TABLE payment_promises 
    ADD COLUMN IF NOT EXISTS materials_separate BOOLEAN DEFAULT false;
  
  -- Multiple promises support (only one active at a time)
  ALTER TABLE payment_promises 
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
  ALTER TABLE payment_promises 
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
  ALTER TABLE payment_promises 
    ADD COLUMN IF NOT EXISTS archived_reason TEXT;

EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

COMMENT ON TABLE payment_promises IS 
  'Payment tracking and communication. DOES NOT gate work. Honor system. payer=owner, payee=contractor.';

-- ============================================================
-- 4. ADD MISSING COLUMNS TO payment_milestones
-- ============================================================

DO $$ BEGIN
  -- Due date
  ALTER TABLE payment_milestones 
    ADD COLUMN IF NOT EXISTS due_date DATE;
  
  -- Communication status
  ALTER TABLE payment_milestones 
    ADD COLUMN IF NOT EXISTS communication_status payment_communication DEFAULT 'on_track';
  
  -- Owner communication
  ALTER TABLE payment_milestones 
    ADD COLUMN IF NOT EXISTS owner_message TEXT;
  ALTER TABLE payment_milestones 
    ADD COLUMN IF NOT EXISTS owner_message_at TIMESTAMPTZ;
  
  -- Contractor acknowledgment
  ALTER TABLE payment_milestones 
    ADD COLUMN IF NOT EXISTS contractor_acknowledged BOOLEAN DEFAULT false;
  ALTER TABLE payment_milestones 
    ADD COLUMN IF NOT EXISTS contractor_response TEXT;
  
  -- Verification tracking (who confirmed)
  ALTER TABLE payment_milestones 
    ADD COLUMN IF NOT EXISTS verified_by_party_id UUID REFERENCES parties(id);
  ALTER TABLE payment_milestones 
    ADD COLUMN IF NOT EXISTS verified_by_individual_id UUID REFERENCES cc_individuals(id);
  ALTER TABLE payment_milestones 
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
  
  -- Extension support
  ALTER TABLE payment_milestones 
    ADD COLUMN IF NOT EXISTS extended_to DATE;
  ALTER TABLE payment_milestones 
    ADD COLUMN IF NOT EXISTS extension_reason TEXT;
  
  -- Partial payment tracking
  ALTER TABLE payment_milestones 
    ADD COLUMN IF NOT EXISTS partial_amount NUMERIC(12,2);
  ALTER TABLE payment_milestones 
    ADD COLUMN IF NOT EXISTS partial_date TIMESTAMPTZ;
  ALTER TABLE payment_milestones 
    ADD COLUMN IF NOT EXISTS remaining_amount NUMERIC(12,2);
  
  -- Write-off (PRIVATE to contractor - not shown to owner)
  ALTER TABLE payment_milestones 
    ADD COLUMN IF NOT EXISTS written_off BOOLEAN DEFAULT false;
  ALTER TABLE payment_milestones 
    ADD COLUMN IF NOT EXISTS written_off_amount NUMERIC(12,2);
  ALTER TABLE payment_milestones 
    ADD COLUMN IF NOT EXISTS written_off_reason TEXT;
  ALTER TABLE payment_milestones 
    ADD COLUMN IF NOT EXISTS written_off_at TIMESTAMPTZ;
  
  -- Payment notes
  ALTER TABLE payment_milestones 
    ADD COLUMN IF NOT EXISTS payment_notes TEXT;
  ALTER TABLE payment_milestones 
    ADD COLUMN IF NOT EXISTS payment_reference TEXT;
  ALTER TABLE payment_milestones 
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

COMMENT ON TABLE payment_milestones IS 
  'Individual payment tracking. Status is INFORMATIONAL. Work continues regardless. Write-offs are contractor-private.';

COMMENT ON COLUMN payment_milestones.written_off IS 
  'PRIVATE to contractor. Does not affect owner view or public reputation. For contractor records/taxes only.';

-- ============================================================
-- 5. PAYMENT EVENTS LOG (Communication History)
-- ============================================================

CREATE TABLE IF NOT EXISTS payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  payment_promise_id UUID NOT NULL REFERENCES payment_promises(id),
  milestone_id UUID REFERENCES payment_milestones(id),
  
  -- Who did what
  actor_party_id UUID REFERENCES parties(id),
  actor_individual_id UUID REFERENCES cc_individuals(id),
  actor_role TEXT CHECK (actor_role IN ('owner', 'contractor', 'system')),
  
  -- Event type (all soft/informational)
  event_type TEXT NOT NULL CHECK (event_type IN (
    'promise_created',
    'promise_archived',
    'milestone_added',
    'payment_sent',           -- Owner says they sent it
    'payment_received',       -- Contractor confirms receipt
    'payment_partial',        -- Partial payment made
    'reminder_sent',          -- Gentle reminder
    'extension_requested',    -- Owner asks for more time
    'extension_granted',      -- Contractor agrees
    'hardship_communicated',  -- Owner explains difficulty
    'community_event_noted',  -- Fire/flood/earthquake
    'schedule_revised',       -- New timeline agreed
    'written_off',            -- Contractor absorbs (private)
    'resolved',               -- Parties worked it out
    'note_added'              -- General communication
  )),
  
  -- Details
  amount NUMERIC(12,2),
  currency CHAR(3) DEFAULT 'CAD',
  message TEXT,
  metadata JSONB,
  
  -- Proof (optional - honor system means not always needed)
  proof_type TEXT,  -- 'screenshot', 'reference', 'verbal', 'none'
  proof_reference TEXT,
  proof_url TEXT,
  
  -- Privacy flag (for write-offs)
  is_private BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_events_promise_idx ON payment_events(payment_promise_id);
CREATE INDEX IF NOT EXISTS payment_events_milestone_idx ON payment_events(milestone_id);
CREATE INDEX IF NOT EXISTS payment_events_type_idx ON payment_events(event_type);

COMMENT ON TABLE payment_events IS 
  'Communication log for payments. Tracks what happened without enforcing anything.';

-- ============================================================
-- 6. ENSURE contact_unlock_gate EXISTS ON conversations
-- ============================================================

-- Check and add if missing (may already exist from migration 034)
DO $$ BEGIN
  ALTER TABLE conversations 
    ADD COLUMN IF NOT EXISTS contact_unlock_gate contact_unlock_gate DEFAULT 'none';
EXCEPTION WHEN undefined_object THEN 
  -- If enum doesn't exist, the column probably exists, skip
  NULL;
END $$;

-- ============================================================
-- 7. COMMUNITY EVENTS (Fires, Floods, Earthquakes)
-- ============================================================

CREATE TABLE IF NOT EXISTS community_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  event_name TEXT NOT NULL,
  event_type TEXT CHECK (event_type IN (
    'wildfire', 'flood', 'earthquake', 'storm', 'pandemic',
    'economic', 'infrastructure', 'other'
  )),
  
  -- Affected area
  affected_regions TEXT[],
  affected_postal_prefixes TEXT[],
  
  -- Timeline
  start_date DATE NOT NULL,
  end_date DATE,
  ongoing BOOLEAN DEFAULT true,
  
  -- Impact
  description TEXT,
  payment_impact_note TEXT,
  
  -- Official reference
  official_reference TEXT,
  official_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS community_events_ongoing_idx ON community_events(ongoing) WHERE ongoing;
CREATE INDEX IF NOT EXISTS community_events_regions_idx ON community_events USING gin(affected_regions);

-- ============================================================
-- 8. SEED EXAMPLE COMMUNITY EVENT
-- ============================================================

INSERT INTO community_events (
  event_name, event_type, affected_regions, affected_postal_prefixes,
  start_date, ongoing, description, payment_impact_note
) VALUES (
  '2024 BC Wildfire Season',
  'wildfire',
  ARRAY['West Kelowna', 'Kamloops', 'Vernon'],
  ARRAY['V1Z', 'V1T', 'V2C'],
  '2024-07-15',
  false,
  'Multiple wildfires across BC interior',
  'Residents may experience payment delays. Flexibility expected.'
) ON CONFLICT DO NOTHING;

-- ============================================================
-- 9. PHILOSOPHY COMMENTS
-- ============================================================

COMMENT ON COLUMN payment_promises.is_active IS 
  'Only one promise active per conversation. Creating new one archives previous. Jobs change.';

COMMENT ON COLUMN conversations.contact_unlocked IS 
  'Contact sharing status. BOTH owner AND contractor can unlock anytime. No payment gate required.';
