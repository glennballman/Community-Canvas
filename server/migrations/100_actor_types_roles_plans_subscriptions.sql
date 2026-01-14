-- ============================================================
-- MIGRATION 100: ACTOR TYPES, ROLES, PLANS & SUBSCRIPTIONS
-- Part of Prompt 24A - Core Pricing Infrastructure
-- ============================================================

BEGIN;

-- ============================================================
-- 1) ACTOR TYPES (Economic Roles)
-- These are the 5 buyer types in the platform
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_actor_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cc_actor_types_code ON cc_actor_types(code);
CREATE INDEX IF NOT EXISTS idx_cc_actor_types_active ON cc_actor_types(is_active);

-- ============================================================
-- 2) TENANT ACTOR ROLES (Join Table)
-- A tenant can have MULTIPLE roles simultaneously
-- This replaces the bad idea of actor_type_id on cc_tenants
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_tenant_actor_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  actor_type_id uuid NOT NULL REFERENCES cc_actor_types(id) ON DELETE CASCADE,
  
  -- Which role is primary for UI defaults
  is_primary boolean NOT NULL DEFAULT false,
  
  -- Lifecycle
  activated_at timestamptz NOT NULL DEFAULT now(),
  deactivated_at timestamptz,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- One role per actor type per tenant
  UNIQUE (tenant_id, actor_type_id)
);

CREATE INDEX IF NOT EXISTS idx_cc_tenant_actor_roles_tenant ON cc_tenant_actor_roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cc_tenant_actor_roles_actor ON cc_tenant_actor_roles(actor_type_id);
CREATE INDEX IF NOT EXISTS idx_cc_tenant_actor_roles_primary ON cc_tenant_actor_roles(tenant_id, is_primary) WHERE is_primary = true;

-- Enable RLS
ALTER TABLE cc_tenant_actor_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY cc_tenant_actor_roles_service_bypass ON cc_tenant_actor_roles
  FOR ALL
  USING (current_setting('app.tenant_id', true) = '__SERVICE__')
  WITH CHECK (current_setting('app.tenant_id', true) = '__SERVICE__');

CREATE POLICY cc_tenant_actor_roles_tenant_read ON cc_tenant_actor_roles
  FOR SELECT
  USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY cc_tenant_actor_roles_tenant_write ON cc_tenant_actor_roles
  FOR ALL
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

-- ============================================================
-- 3) PLANS (Subscription Plans per Actor Type)
-- 15 plans total: 3 tiers × 5 actor types
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type_id uuid NOT NULL REFERENCES cc_actor_types(id) ON DELETE CASCADE,
  
  -- Identity
  code text NOT NULL,
  name text NOT NULL,
  description text,
  
  -- Pricing (PSP-agnostic)
  monthly_price numeric NOT NULL DEFAULT 0,
  annual_price numeric,
  seasonal_price numeric,
  billing_interval text NOT NULL DEFAULT 'monthly',
  currency text NOT NULL DEFAULT 'CAD',
  
  -- Tier (1=starter/free, 2=pro, 3=enterprise)
  tier_level integer NOT NULL DEFAULT 1,
  
  -- Status
  is_active boolean NOT NULL DEFAULT true,
  is_public boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Unique code per actor type
  UNIQUE (actor_type_id, code)
);

CREATE INDEX IF NOT EXISTS idx_cc_plans_actor ON cc_plans(actor_type_id);
CREATE INDEX IF NOT EXISTS idx_cc_plans_code ON cc_plans(code);
CREATE INDEX IF NOT EXISTS idx_cc_plans_active ON cc_plans(is_active, is_public);
CREATE INDEX IF NOT EXISTS idx_cc_plans_tier ON cc_plans(actor_type_id, tier_level);

-- ============================================================
-- 4) PLAN ENTITLEMENTS (Feature Flags per Plan)
-- What features/limits each plan grants
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_plan_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES cc_plans(id) ON DELETE CASCADE,
  
  -- Entitlement key
  entitlement_key text NOT NULL,
  
  -- Value type and value
  value_type text NOT NULL DEFAULT 'boolean',
  boolean_value boolean,
  numeric_value integer,
  text_value text,
  
  -- Description for UI
  display_name text,
  description text,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- One entitlement per key per plan
  UNIQUE (plan_id, entitlement_key)
);

CREATE INDEX IF NOT EXISTS idx_cc_plan_entitlements_plan ON cc_plan_entitlements(plan_id);
CREATE INDEX IF NOT EXISTS idx_cc_plan_entitlements_key ON cc_plan_entitlements(entitlement_key);

-- ============================================================
-- 5) SUBSCRIPTIONS (Tenant → Plan)
-- PSP-agnostic: works without Stripe
-- V3+: Tenant-owned only (party/individual subscriptions can be added later)
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Owner (tenant-owned only for V3+)
  tenant_id uuid NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  
  -- What they're subscribed to
  plan_id uuid NOT NULL REFERENCES cc_plans(id),
  actor_type_id uuid NOT NULL REFERENCES cc_actor_types(id),
  
  -- Status
  status text NOT NULL DEFAULT 'active',
  
  -- Trial
  trial_ends_at timestamptz,
  
  -- Billing period
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz,
  
  -- PSP-agnostic billing
  billing_method text NOT NULL DEFAULT 'invoice',
  billing_email text,
  external_customer_id text,
  external_subscription_id text,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  
  -- One subscription per actor type per tenant
  UNIQUE (tenant_id, actor_type_id)
);

CREATE INDEX IF NOT EXISTS idx_cc_subscriptions_tenant ON cc_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cc_subscriptions_plan ON cc_subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_cc_subscriptions_status ON cc_subscriptions(status);

-- Enable RLS
ALTER TABLE cc_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY cc_subscriptions_service_bypass ON cc_subscriptions
  FOR ALL
  USING (current_setting('app.tenant_id', true) = '__SERVICE__')
  WITH CHECK (current_setting('app.tenant_id', true) = '__SERVICE__');

-- Tenant can read their own subscriptions
CREATE POLICY cc_subscriptions_tenant_read ON cc_subscriptions
  FOR SELECT
  USING (tenant_id::text = current_setting('app.tenant_id', true));

-- Tenant can manage their own subscriptions
CREATE POLICY cc_subscriptions_tenant_write ON cc_subscriptions
  FOR ALL
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

-- ============================================================
-- 6) GRANTS
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON cc_actor_types TO cc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON cc_tenant_actor_roles TO cc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON cc_plans TO cc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON cc_plan_entitlements TO cc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON cc_subscriptions TO cc_app;

-- ============================================================
-- 7) COMMENTS
-- ============================================================

COMMENT ON COLUMN cc_subscriptions.status IS 'active, trialing, past_due, cancelled, paused, expired';
COMMENT ON COLUMN cc_subscriptions.billing_method IS 'invoice, eft, credit_card, stripe, external, manual';

COMMIT;
