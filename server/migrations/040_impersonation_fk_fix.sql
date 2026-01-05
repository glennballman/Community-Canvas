-- Migration 040: Fix impersonation sessions FK to reference cc_users
-- The platform_staff_id was referencing cc_platform_staff, but platform admins
-- authenticate via foundation JWT exchange which uses cc_users.id

-- Drop the old FK constraint
ALTER TABLE cc_impersonation_sessions 
DROP CONSTRAINT IF EXISTS cc_impersonation_sessions_platform_staff_id_fkey;

-- Add new FK constraint referencing cc_users
ALTER TABLE cc_impersonation_sessions 
ADD CONSTRAINT cc_impersonation_sessions_platform_staff_id_fkey 
FOREIGN KEY (platform_staff_id) REFERENCES cc_users(id);

-- Note: Any existing records with old cc_platform_staff IDs should be deleted
-- before running this migration in production
