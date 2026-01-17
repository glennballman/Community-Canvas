-- Migration 154: Tenant-scoped emergency replacement requests
-- Allows tenants to create and view their own emergency requests

-- Policy: Tenants can INSERT emergency requests for jobs they own
CREATE POLICY emergency_tenant_insert ON cc_emergency_replacement_requests
  FOR INSERT
  WITH CHECK (
    is_service_mode() OR
    (
      tenant_id IS NOT NULL AND
      tenant_id = current_setting('app.tenant_id', true)::uuid AND
      (
        job_id IS NULL OR
        EXISTS (
          SELECT 1 FROM cc_jobs j
          WHERE j.id = job_id AND j.tenant_id = tenant_id
        )
      )
    )
  );

-- Policy: Tenants can SELECT their own emergency requests
CREATE POLICY emergency_tenant_select ON cc_emergency_replacement_requests
  FOR SELECT
  USING (
    is_service_mode() OR
    (
      tenant_id IS NOT NULL AND
      tenant_id = current_setting('app.tenant_id', true)::uuid
    )
  );

-- Policy: Tenants can UPDATE their own emergency requests (for cancel/notes)
CREATE POLICY emergency_tenant_update ON cc_emergency_replacement_requests
  FOR UPDATE
  USING (
    is_service_mode() OR
    (
      tenant_id IS NOT NULL AND
      tenant_id = current_setting('app.tenant_id', true)::uuid
    )
  )
  WITH CHECK (
    is_service_mode() OR
    (
      tenant_id IS NOT NULL AND
      tenant_id = current_setting('app.tenant_id', true)::uuid
    )
  );
