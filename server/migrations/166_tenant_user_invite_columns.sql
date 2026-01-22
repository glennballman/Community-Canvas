-- Add invite-related columns to cc_tenant_users for claim/invite workflow
-- P-UI-17 Platform Admin: Connect User ↔ Tenant with invite support

ALTER TABLE cc_tenant_users ADD COLUMN IF NOT EXISTS invited_email TEXT;
ALTER TABLE cc_tenant_users ADD COLUMN IF NOT EXISTS invite_token TEXT;
ALTER TABLE cc_tenant_users ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ;

-- Index for invite token lookups
CREATE INDEX IF NOT EXISTS idx_tenant_users_invite_token ON cc_tenant_users(invite_token) WHERE invite_token IS NOT NULL;

-- Index for finding pending invites by email
CREATE INDEX IF NOT EXISTS idx_tenant_users_invited_email ON cc_tenant_users(invited_email) WHERE invited_email IS NOT NULL;
