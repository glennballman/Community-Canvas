BEGIN;

-- ============ AUTH ACCOUNTS ============
-- Primary authentication accounts (renamed from cc_user_profiles to avoid conflict)

CREATE TABLE IF NOT EXISTS cc_auth_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Links
  portal_id uuid REFERENCES cc_portals(id) ON DELETE SET NULL,
  identity_id uuid REFERENCES cc_verified_identities(id) ON DELETE SET NULL,
  tenant_id uuid REFERENCES cc_tenants(id) ON DELETE SET NULL,
  
  -- Auth reference (external auth system or internal)
  auth_provider varchar DEFAULT 'email' CHECK (auth_provider IN (
    'email', 'google', 'apple', 'microsoft', 'phone'
  )),
  auth_provider_id text,
  
  -- Basic info
  email text NOT NULL,
  email_verified boolean DEFAULT false,
  email_verified_at timestamptz,
  
  phone text,
  phone_verified boolean DEFAULT false,
  phone_verified_at timestamptz,
  
  -- Password (for email auth)
  password_hash text,
  password_changed_at timestamptz,
  
  -- Profile
  display_name text NOT NULL,
  avatar_url text,
  bio text,
  
  -- Location
  timezone varchar(50) DEFAULT 'America/Vancouver',
  locale varchar(10) DEFAULT 'en-CA',
  
  -- Preferences
  preferences_json jsonb DEFAULT '{}'::jsonb,
  
  notification_settings_json jsonb DEFAULT '{
    "email_marketing": false,
    "email_transactional": true,
    "email_updates": true,
    "sms_alerts": false,
    "push_enabled": false
  }'::jsonb,
  
  -- Status
  status varchar DEFAULT 'active' CHECK (status IN (
    'pending',
    'active',
    'suspended',
    'banned',
    'deleted'
  )),
  
  suspension_reason text,
  suspended_until timestamptz,
  
  -- Activity tracking
  last_login_at timestamptz,
  last_active_at timestamptz,
  login_count integer DEFAULT 0,
  
  -- Onboarding
  onboarding_completed boolean DEFAULT false,
  onboarding_completed_at timestamptz,
  onboarding_step varchar DEFAULT 'welcome',
  
  -- Terms acceptance
  terms_accepted_at timestamptz,
  privacy_accepted_at timestamptz,
  terms_version varchar,
  
  -- Metadata
  signup_source varchar,
  signup_referrer_id uuid REFERENCES cc_auth_accounts(id),
  utm_source varchar,
  utm_medium varchar,
  utm_campaign varchar,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  
  UNIQUE(email)
);

CREATE INDEX IF NOT EXISTS idx_auth_accounts_email ON cc_auth_accounts(email);
CREATE INDEX IF NOT EXISTS idx_auth_accounts_portal ON cc_auth_accounts(portal_id) WHERE portal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_auth_accounts_identity ON cc_auth_accounts(identity_id) WHERE identity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_auth_accounts_status ON cc_auth_accounts(status);
CREATE INDEX IF NOT EXISTS idx_auth_accounts_auth ON cc_auth_accounts(auth_provider, auth_provider_id);

ALTER TABLE cc_auth_accounts ENABLE ROW LEVEL SECURITY;

-- ============ AUTH SESSIONS ============
-- Active user sessions and tokens

CREATE TABLE IF NOT EXISTS cc_auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  user_id uuid NOT NULL REFERENCES cc_auth_accounts(id) ON DELETE CASCADE,
  
  -- Session token
  token_hash text NOT NULL UNIQUE,
  
  -- Refresh token (for token refresh flow)
  refresh_token_hash text UNIQUE,
  refresh_expires_at timestamptz,
  
  -- Session info
  session_type varchar DEFAULT 'web' CHECK (session_type IN (
    'web', 'mobile', 'api', 'cli'
  )),
  
  -- Device/client info
  device_name text,
  device_type varchar,
  browser varchar,
  os varchar,
  ip_address text,
  user_agent text,
  
  -- Location (from IP)
  city varchar,
  region varchar,
  country varchar(2),
  
  -- Status
  status varchar DEFAULT 'active' CHECK (status IN (
    'active', 'expired', 'revoked'
  )),
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  last_used_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_reason varchar,
  
  -- Security
  is_suspicious boolean DEFAULT false,
  mfa_verified boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON cc_auth_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_token ON cc_auth_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON cc_auth_sessions(expires_at) WHERE status = 'active';

ALTER TABLE cc_auth_sessions ENABLE ROW LEVEL SECURITY;

-- ============ PASSWORD RESET TOKENS ============
-- For password reset flow

CREATE TABLE IF NOT EXISTS cc_password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  user_id uuid NOT NULL REFERENCES cc_auth_accounts(id) ON DELETE CASCADE,
  
  token_hash text NOT NULL UNIQUE,
  
  -- Status
  status varchar DEFAULT 'pending' CHECK (status IN (
    'pending', 'used', 'expired'
  )),
  
  -- Security
  ip_address text,
  user_agent text,
  
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_password_resets_token ON cc_password_resets(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON cc_password_resets(user_id, status);

ALTER TABLE cc_password_resets ENABLE ROW LEVEL SECURITY;

COMMIT;
