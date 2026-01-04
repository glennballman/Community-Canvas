-- Migration 030: Platform Staff Authentication
-- Creates staff accounts with roles for internal platform review console

BEGIN;

-- 1. Create platform_role enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'platform_role') THEN
    CREATE TYPE platform_role AS ENUM ('platform_reviewer', 'platform_admin');
  END IF;
END $$;

-- 2. Create actor_type enum for audit events
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'actor_type') THEN
    CREATE TYPE actor_type AS ENUM ('tenant', 'platform', 'service');
  END IF;
END $$;

-- 3. Create cc_platform_staff table
CREATE TABLE IF NOT EXISTS cc_platform_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role platform_role NOT NULL DEFAULT 'platform_reviewer',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create platform session table (separate from tenant sessions)
CREATE TABLE IF NOT EXISTS cc_platform_sessions (
  sid VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_platform_sessions_expire ON cc_platform_sessions (expire);

-- 5. Add actor_type and actor_id columns to catalog_claim_events
ALTER TABLE catalog_claim_events 
  ADD COLUMN IF NOT EXISTS actor_type actor_type,
  ADD COLUMN IF NOT EXISTS actor_staff_id UUID REFERENCES cc_platform_staff(id) ON DELETE SET NULL;

-- 6. Create index for staff action queries
CREATE INDEX IF NOT EXISTS idx_claim_events_staff_actor 
  ON catalog_claim_events (actor_staff_id, created_at DESC)
  WHERE actor_staff_id IS NOT NULL;

-- 7. Create platform_staff_bootstrap_tokens table for one-time setup
CREATE TABLE IF NOT EXISTS cc_platform_staff_bootstrap_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  created_by_ip VARCHAR(45),
  claimed_at TIMESTAMPTZ,
  claimed_by_staff_id UUID REFERENCES cc_platform_staff(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '1 hour'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- NOTE: First platform staff must be created via bootstrap endpoint
-- Run: POST /api/internal/bootstrap/init to generate one-time token
-- Then: POST /api/internal/bootstrap/claim with token + credentials

COMMIT;
