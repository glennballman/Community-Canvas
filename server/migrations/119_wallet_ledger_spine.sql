-- ============================================================================
-- MIGRATION 119: WALLET LEDGER SPINE
-- Tables:
--   cc_wallet_accounts
--   cc_wallet_entries           (append-only ledger)
--   cc_wallet_holds             (reserves against available balance)
--   cc_wallet_balance_snapshots (optional denormalized cache)
-- ============================================================================

-- Helper: updated_at trigger (create-if-missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace=n.oid
    WHERE p.proname='cc_set_updated_at' AND n.nspname='public'
  ) THEN
    CREATE FUNCTION cc_set_updated_at()
    RETURNS TRIGGER AS $fn$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;
  END IF;
END $$;

-- Enums (idempotent)
DO $$ BEGIN
  CREATE TYPE wallet_account_status AS ENUM ('active','suspended','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE wallet_entry_type AS ENUM ('credit','debit','adjustment','reversal','fee','refund','deposit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE wallet_entry_status AS ENUM ('pending','posted','void');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE wallet_hold_status AS ENUM ('active','captured','released','expired','void');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- cc_wallet_accounts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cc_wallet_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,

  -- ownership / linkage
  account_name TEXT NOT NULL,                    -- display label
  party_id UUID REFERENCES cc_parties(id) ON DELETE SET NULL,
  individual_id UUID REFERENCES cc_individuals(id) ON DELETE SET NULL,

  currency TEXT NOT NULL DEFAULT 'CAD',
  status wallet_account_status NOT NULL DEFAULT 'active',

  -- cached balances (derived; maintained by functions)
  posted_balance_cents BIGINT NOT NULL DEFAULT 0,
  available_balance_cents BIGINT NOT NULL DEFAULT 0,
  active_holds_cents BIGINT NOT NULL DEFAULT 0,

  -- sequencing for display/ordering
  next_sequence_number INTEGER NOT NULL DEFAULT 1,

  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ck_wallet_balances_nonnegative CHECK (
    posted_balance_cents >= 0
    AND available_balance_cents >= 0
    AND active_holds_cents >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_wallet_accounts_tenant_party
  ON cc_wallet_accounts(tenant_id, party_id);

CREATE INDEX IF NOT EXISTS idx_wallet_accounts_tenant_individual
  ON cc_wallet_accounts(tenant_id, individual_id);

DROP TRIGGER IF EXISTS trg_wallet_accounts_updated ON cc_wallet_accounts;
CREATE TRIGGER trg_wallet_accounts_updated
  BEFORE UPDATE ON cc_wallet_accounts
  FOR EACH ROW EXECUTE FUNCTION cc_set_updated_at();

-- ---------------------------------------------------------------------------
-- cc_wallet_holds (created before entries to satisfy FK)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cc_wallet_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  wallet_account_id UUID NOT NULL REFERENCES cc_wallet_accounts(id) ON DELETE CASCADE,

  status wallet_hold_status NOT NULL DEFAULT 'active',

  amount_cents BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CAD',

  reason TEXT NOT NULL,                          -- e.g. 'pending_purchase','damage_deposit','authorization'
  reference_type TEXT,
  reference_id UUID,

  expires_at TIMESTAMPTZ,

  created_by_individual_id UUID REFERENCES cc_individuals(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  captured_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,

  metadata JSONB,

  CONSTRAINT ck_hold_amount_positive CHECK (amount_cents > 0)
);

CREATE INDEX IF NOT EXISTS idx_wallet_holds_account_status
  ON cc_wallet_holds(wallet_account_id, status);

DROP TRIGGER IF EXISTS trg_wallet_holds_updated ON cc_wallet_holds;
CREATE TRIGGER trg_wallet_holds_updated
  BEFORE UPDATE ON cc_wallet_holds
  FOR EACH ROW EXECUTE FUNCTION cc_set_updated_at();

-- ---------------------------------------------------------------------------
-- cc_wallet_entries (append-only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cc_wallet_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  wallet_account_id UUID NOT NULL REFERENCES cc_wallet_accounts(id) ON DELETE CASCADE,

  entry_type wallet_entry_type NOT NULL,
  status wallet_entry_status NOT NULL DEFAULT 'posted',

  -- Positive amount; sign is determined by entry_type (credit +, debit -)
  amount_cents BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CAD',

  -- Reference (what generated this entry)
  reference_type TEXT,                            -- e.g. 'rail_transfer','purchase','settlement','manual'
  reference_id UUID,

  -- Reversal linkage (reversal entry points to original)
  reverses_entry_id UUID REFERENCES cc_wallet_entries(id),

  description TEXT NOT NULL,

  -- Hold linkage if captured from a hold
  hold_id UUID REFERENCES cc_wallet_holds(id),

  posted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  posted_by_individual_id UUID REFERENCES cc_individuals(id),

  -- Integrity proof (optional)
  entry_hash TEXT,

  -- Sequence within wallet account for display
  sequence_number INTEGER NOT NULL,

  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ck_wallet_amount_positive CHECK (amount_cents > 0),
  CONSTRAINT ck_wallet_reversal CHECK (
    (entry_type = 'reversal' AND reverses_entry_id IS NOT NULL)
    OR (entry_type != 'reversal')
  )
);

CREATE INDEX IF NOT EXISTS idx_wallet_entries_account_seq
  ON cc_wallet_entries(wallet_account_id, sequence_number);

CREATE INDEX IF NOT EXISTS idx_wallet_entries_reference
  ON cc_wallet_entries(reference_type, reference_id);

-- ---------------------------------------------------------------------------
-- cc_wallet_balance_snapshots (optional: for reporting / reconciliation)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cc_wallet_balance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  wallet_account_id UUID NOT NULL REFERENCES cc_wallet_accounts(id) ON DELETE CASCADE,

  as_of_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  posted_balance_cents BIGINT NOT NULL,
  active_holds_cents BIGINT NOT NULL,
  available_balance_cents BIGINT NOT NULL,

  computed_from_entry_seq INTEGER,     -- last sequence included
  metadata JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_snapshots_account_time
  ON cc_wallet_balance_snapshots(wallet_account_id, as_of_at DESC);

-- ---------------------------------------------------------------------------
-- RLS POLICIES
-- ---------------------------------------------------------------------------
ALTER TABLE cc_wallet_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_wallet_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_wallet_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_wallet_balance_snapshots ENABLE ROW LEVEL SECURITY;

-- Wallet accounts: tenant/service
DROP POLICY IF EXISTS wallet_accounts_select ON cc_wallet_accounts;
CREATE POLICY wallet_accounts_select ON cc_wallet_accounts
  FOR SELECT USING (tenant_id = current_tenant_id() OR is_service_mode());

DROP POLICY IF EXISTS wallet_accounts_insert ON cc_wallet_accounts;
CREATE POLICY wallet_accounts_insert ON cc_wallet_accounts
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());

DROP POLICY IF EXISTS wallet_accounts_update ON cc_wallet_accounts;
CREATE POLICY wallet_accounts_update ON cc_wallet_accounts
  FOR UPDATE
  USING (tenant_id = current_tenant_id() OR is_service_mode())
  WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());

DROP POLICY IF EXISTS wallet_accounts_delete_service ON cc_wallet_accounts;
CREATE POLICY wallet_accounts_delete_service ON cc_wallet_accounts
  FOR DELETE USING (is_service_mode());

-- Wallet entries: tenant/service SELECT+INSERT; UPDATE/DELETE denied (append-only)
DROP POLICY IF EXISTS wallet_entries_select ON cc_wallet_entries;
CREATE POLICY wallet_entries_select ON cc_wallet_entries
  FOR SELECT USING (tenant_id = current_tenant_id() OR is_service_mode());

DROP POLICY IF EXISTS wallet_entries_insert ON cc_wallet_entries;
CREATE POLICY wallet_entries_insert ON cc_wallet_entries
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());

DROP POLICY IF EXISTS wallet_entries_update_deny ON cc_wallet_entries;
CREATE POLICY wallet_entries_update_deny ON cc_wallet_entries
  FOR UPDATE USING (FALSE);

DROP POLICY IF EXISTS wallet_entries_delete_deny ON cc_wallet_entries;
CREATE POLICY wallet_entries_delete_deny ON cc_wallet_entries
  FOR DELETE USING (FALSE);

-- FORCE RLS on append-only table (even table owner can't bypass)
ALTER TABLE cc_wallet_entries FORCE ROW LEVEL SECURITY;

-- Holds: tenant/service (holds need updates for status changes)
DROP POLICY IF EXISTS wallet_holds_select ON cc_wallet_holds;
CREATE POLICY wallet_holds_select ON cc_wallet_holds
  FOR SELECT USING (tenant_id = current_tenant_id() OR is_service_mode());

DROP POLICY IF EXISTS wallet_holds_insert ON cc_wallet_holds;
CREATE POLICY wallet_holds_insert ON cc_wallet_holds
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());

DROP POLICY IF EXISTS wallet_holds_update ON cc_wallet_holds;
CREATE POLICY wallet_holds_update ON cc_wallet_holds
  FOR UPDATE
  USING (tenant_id = current_tenant_id() OR is_service_mode())
  WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());

DROP POLICY IF EXISTS wallet_holds_delete_service ON cc_wallet_holds;
CREATE POLICY wallet_holds_delete_service ON cc_wallet_holds
  FOR DELETE USING (is_service_mode());

-- Snapshots: tenant/service
DROP POLICY IF EXISTS wallet_snapshots_select ON cc_wallet_balance_snapshots;
CREATE POLICY wallet_snapshots_select ON cc_wallet_balance_snapshots
  FOR SELECT USING (tenant_id = current_tenant_id() OR is_service_mode());

DROP POLICY IF EXISTS wallet_snapshots_insert ON cc_wallet_balance_snapshots;
CREATE POLICY wallet_snapshots_insert ON cc_wallet_balance_snapshots
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());

DROP POLICY IF EXISTS wallet_snapshots_delete_service ON cc_wallet_balance_snapshots;
CREATE POLICY wallet_snapshots_delete_service ON cc_wallet_balance_snapshots
  FOR DELETE USING (is_service_mode());

-- ---------------------------------------------------------------------------
-- FUNCTIONS
-- ---------------------------------------------------------------------------

-- Create wallet account
CREATE OR REPLACE FUNCTION cc_create_wallet_account(
  p_tenant_id UUID,
  p_account_name TEXT,
  p_party_id UUID DEFAULT NULL,
  p_individual_id UUID DEFAULT NULL,
  p_currency TEXT DEFAULT 'CAD',
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = on
AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT is_service_mode() AND p_tenant_id != current_tenant_id() THEN
    RAISE EXCEPTION 'Tenant mismatch';
  END IF;

  v_id := gen_random_uuid();

  INSERT INTO cc_wallet_accounts(
    id, tenant_id, account_name, party_id, individual_id, currency, metadata
  ) VALUES (
    v_id, p_tenant_id, p_account_name, p_party_id, p_individual_id, COALESCE(p_currency,'CAD'), p_metadata
  );

  RETURN v_id;
END;
$$;

-- Internal helper: recompute cached balances for an account
CREATE OR REPLACE FUNCTION cc_recompute_wallet_account_balances(
  p_wallet_account_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = on
AS $$
DECLARE
  v_tenant UUID;
  v_posted BIGINT;
  v_holds BIGINT;
  v_avail BIGINT;
BEGIN
  SELECT tenant_id INTO v_tenant FROM cc_wallet_accounts WHERE id=p_wallet_account_id;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Wallet account not found'; END IF;

  IF NOT is_service_mode() AND v_tenant != current_tenant_id() THEN
    RAISE EXCEPTION 'Tenant mismatch';
  END IF;

  SELECT COALESCE(SUM(
    CASE
      WHEN status != 'posted' THEN 0
      WHEN entry_type IN ('credit','deposit','refund') THEN amount_cents
      WHEN entry_type IN ('debit','fee') THEN -amount_cents
      WHEN entry_type IN ('adjustment') THEN amount_cents
      WHEN entry_type = 'reversal' THEN 0
      ELSE 0
    END
  ),0)
  INTO v_posted
  FROM cc_wallet_entries
  WHERE wallet_account_id=p_wallet_account_id;

  -- Holds reduce available
  SELECT COALESCE(SUM(amount_cents),0)
  INTO v_holds
  FROM cc_wallet_holds
  WHERE wallet_account_id=p_wallet_account_id
    AND status='active'
    AND (expires_at IS NULL OR expires_at > now());

  v_avail := v_posted - v_holds;
  IF v_avail < 0 THEN v_avail := 0; END IF;

  UPDATE cc_wallet_accounts
  SET posted_balance_cents = v_posted,
      active_holds_cents = v_holds,
      available_balance_cents = v_avail,
      updated_at = now()
  WHERE id=p_wallet_account_id;

  RETURN TRUE;
END;
$$;

-- Post a wallet entry (append-only) with per-account sequence number
CREATE OR REPLACE FUNCTION cc_post_wallet_entry(
  p_tenant_id UUID,
  p_wallet_account_id UUID,
  p_entry_type wallet_entry_type,
  p_amount_cents BIGINT,
  p_currency TEXT DEFAULT 'CAD',
  p_description TEXT DEFAULT 'Wallet entry',
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_hold_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = on
AS $$
DECLARE
  v_tenant UUID;
  v_seq INTEGER;
  v_entry_id UUID;
BEGIN
  SELECT tenant_id INTO v_tenant FROM cc_wallet_accounts WHERE id=p_wallet_account_id;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Wallet account not found'; END IF;

  IF NOT is_service_mode() AND (p_tenant_id != current_tenant_id() OR v_tenant != current_tenant_id()) THEN
    RAISE EXCEPTION 'Tenant mismatch';
  END IF;

  IF p_amount_cents <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;

  -- lock per account for sequencing consistency
  PERFORM pg_advisory_xact_lock(hashtext('cc_post_wallet_entry:' || p_wallet_account_id::text));

  SELECT next_sequence_number INTO v_seq
  FROM cc_wallet_accounts
  WHERE id=p_wallet_account_id
  FOR UPDATE;

  v_entry_id := gen_random_uuid();

  INSERT INTO cc_wallet_entries(
    id, tenant_id, wallet_account_id,
    entry_type, status,
    amount_cents, currency,
    reference_type, reference_id,
    description,
    hold_id,
    posted_by_individual_id,
    sequence_number
  ) VALUES (
    v_entry_id, p_tenant_id, p_wallet_account_id,
    p_entry_type, 'posted',
    p_amount_cents, COALESCE(p_currency,'CAD'),
    p_reference_type, p_reference_id,
    p_description,
    p_hold_id,
    current_individual_id(),
    v_seq
  );

  UPDATE cc_wallet_accounts
  SET next_sequence_number = next_sequence_number + 1
  WHERE id=p_wallet_account_id;

  PERFORM cc_recompute_wallet_account_balances(p_wallet_account_id);

  RETURN v_entry_id;
END;
$$;

-- Place a hold (reserve funds)
CREATE OR REPLACE FUNCTION cc_place_wallet_hold(
  p_tenant_id UUID,
  p_wallet_account_id UUID,
  p_amount_cents BIGINT,
  p_reason TEXT,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = on
AS $$
DECLARE
  v_tenant UUID;
  v_avail BIGINT;
  v_hold_id UUID;
BEGIN
  SELECT tenant_id, available_balance_cents INTO v_tenant, v_avail
  FROM cc_wallet_accounts WHERE id=p_wallet_account_id;

  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Wallet account not found'; END IF;
  IF NOT is_service_mode() AND (p_tenant_id != current_tenant_id() OR v_tenant != current_tenant_id()) THEN
    RAISE EXCEPTION 'Tenant mismatch';
  END IF;

  IF p_amount_cents <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  IF v_avail < p_amount_cents THEN RAISE EXCEPTION 'Insufficient available balance'; END IF;

  v_hold_id := gen_random_uuid();

  INSERT INTO cc_wallet_holds(
    id, tenant_id, wallet_account_id,
    status, amount_cents, currency,
    reason, reference_type, reference_id,
    expires_at, created_by_individual_id
  ) VALUES (
    v_hold_id, p_tenant_id, p_wallet_account_id,
    'active', p_amount_cents, 'CAD',
    p_reason, p_reference_type, p_reference_id,
    p_expires_at, current_individual_id()
  );

  PERFORM cc_recompute_wallet_account_balances(p_wallet_account_id);

  RETURN v_hold_id;
END;
$$;

-- Capture a hold (turn reserve into a posted debit entry)
CREATE OR REPLACE FUNCTION cc_capture_wallet_hold(
  p_tenant_id UUID,
  p_hold_id UUID,
  p_description TEXT DEFAULT 'Hold capture',
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = on
AS $$
DECLARE
  v_hold RECORD;
  v_entry_id UUID;
BEGIN
  SELECT * INTO v_hold FROM cc_wallet_holds WHERE id=p_hold_id;
  IF v_hold IS NULL THEN RAISE EXCEPTION 'Hold not found'; END IF;

  IF NOT is_service_mode() AND (p_tenant_id != current_tenant_id() OR v_hold.tenant_id != current_tenant_id()) THEN
    RAISE EXCEPTION 'Tenant mismatch';
  END IF;

  IF v_hold.status != 'active' THEN
    RAISE EXCEPTION 'Hold not active';
  END IF;

  UPDATE cc_wallet_holds
  SET status='captured',
      captured_at=now(),
      updated_at=now()
  WHERE id=p_hold_id;

  -- post debit entry linked to hold
  v_entry_id := cc_post_wallet_entry(
    p_tenant_id,
    v_hold.wallet_account_id,
    'debit',
    v_hold.amount_cents,
    v_hold.currency,
    p_description,
    COALESCE(p_reference_type, v_hold.reference_type),
    COALESCE(p_reference_id, v_hold.reference_id),
    p_hold_id
  );

  PERFORM cc_recompute_wallet_account_balances(v_hold.wallet_account_id);

  RETURN v_entry_id;
END;
$$;

-- Release a hold (free funds)
CREATE OR REPLACE FUNCTION cc_release_wallet_hold(
  p_tenant_id UUID,
  p_hold_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = on
AS $$
DECLARE v_hold RECORD;
BEGIN
  SELECT * INTO v_hold FROM cc_wallet_holds WHERE id=p_hold_id;
  IF v_hold IS NULL THEN RAISE EXCEPTION 'Hold not found'; END IF;

  IF NOT is_service_mode() AND (p_tenant_id != current_tenant_id() OR v_hold.tenant_id != current_tenant_id()) THEN
    RAISE EXCEPTION 'Tenant mismatch';
  END IF;

  IF v_hold.status != 'active' THEN
    RETURN FALSE;
  END IF;

  UPDATE cc_wallet_holds
  SET status='released',
      released_at=now(),
      metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object('release_reason',p_reason),
      updated_at=now()
  WHERE id=p_hold_id;

  PERFORM cc_recompute_wallet_account_balances(v_hold.wallet_account_id);

  RETURN TRUE;
END;
$$;

-- Grant execute to app role
GRANT EXECUTE ON FUNCTION cc_create_wallet_account TO cc_app_test;
GRANT EXECUTE ON FUNCTION cc_recompute_wallet_account_balances TO cc_app_test;
GRANT EXECUTE ON FUNCTION cc_post_wallet_entry TO cc_app_test;
GRANT EXECUTE ON FUNCTION cc_place_wallet_hold TO cc_app_test;
GRANT EXECUTE ON FUNCTION cc_capture_wallet_hold TO cc_app_test;
GRANT EXECUTE ON FUNCTION cc_release_wallet_hold TO cc_app_test;
