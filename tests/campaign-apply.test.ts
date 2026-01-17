import { describe, it, expect, beforeAll } from 'vitest';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function serviceQuery(sql: string, params?: any[]) {
  const client = await pool.connect();
  try {
    await client.query("SET LOCAL app.service_mode = 'true'");
    const result = await client.query(sql, params);
    return result;
  } finally {
    client.release();
  }
}

describe('Campaign Apply Feature', () => {
  let testPortalId: string;
  let testTenantId: string;
  let testJobId: string;
  let testJobPostingId: string;

  beforeAll(async () => {
    const tenantResult = await serviceQuery(`
      SELECT id FROM cc_tenants LIMIT 1
    `);
    testTenantId = tenantResult.rows[0]?.id;

    const portalResult = await serviceQuery(`
      SELECT id FROM cc_portals WHERE status = 'active' LIMIT 1
    `);
    testPortalId = portalResult.rows[0]?.id;

    if (testTenantId && testPortalId) {
      const jobResult = await serviceQuery(`
        SELECT j.id as job_id, jp.id as posting_id
        FROM cc_jobs j
        JOIN cc_job_postings jp ON jp.job_id = j.id
        WHERE jp.portal_id = $1 AND jp.publish_state = 'published'
        LIMIT 1
      `, [testPortalId]);
      
      if (jobResult.rows.length > 0) {
        testJobId = jobResult.rows[0].job_id;
        testJobPostingId = jobResult.rows[0].posting_id;
      }
    }
  });

  describe('Database Schema', () => {
    it('should have cc_job_application_bundles table', async () => {
      const result = await serviceQuery(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'cc_job_application_bundles'
        ORDER BY ordinal_position
      `);
      
      const columns = result.rows.map((r: any) => r.column_name);
      expect(columns).toContain('id');
      expect(columns).toContain('portal_id');
      expect(columns).toContain('campaign_key');
      expect(columns).toContain('applicant_name');
      expect(columns).toContain('applicant_email');
      expect(columns).toContain('applicant_phone');
      expect(columns).toContain('applicant_location');
      expect(columns).toContain('housing_needed');
      expect(columns).toContain('work_permit_question');
      expect(columns).toContain('message');
      expect(columns).toContain('consent_given');
      expect(columns).toContain('status');
    });

    it('should have cc_job_application_bundle_items table', async () => {
      const result = await serviceQuery(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'cc_job_application_bundle_items'
        ORDER BY ordinal_position
      `);
      
      const columns = result.rows.map((r: any) => r.column_name);
      expect(columns).toContain('id');
      expect(columns).toContain('bundle_id');
      expect(columns).toContain('job_posting_id');
      expect(columns).toContain('job_id');
      expect(columns).toContain('tenant_id');
      expect(columns).toContain('application_id');
    });

    it('should have bundle status check constraint', async () => {
      const result = await serviceQuery(`
        SELECT pg_get_constraintdef(oid) as constraint_def
        FROM pg_constraint
        WHERE conrelid = 'cc_job_application_bundles'::regclass
        AND contype = 'c'
        AND conname LIKE '%status%'
      `);
      
      expect(result.rows.length).toBeGreaterThan(0);
      const constraintDef = result.rows[0].constraint_def;
      expect(constraintDef).toMatch(/draft.*submitted.*withdrawn/);
    });

    it('should have RLS enabled on bundles table', async () => {
      const result = await serviceQuery(`
        SELECT relrowsecurity
        FROM pg_class
        WHERE relname = 'cc_job_application_bundles'
      `);
      
      expect(result.rows[0]?.relrowsecurity).toBe(true);
    });

    it('should have RLS enabled on bundle_items table', async () => {
      const result = await serviceQuery(`
        SELECT relrowsecurity
        FROM pg_class
        WHERE relname = 'cc_job_application_bundle_items'
      `);
      
      expect(result.rows[0]?.relrowsecurity).toBe(true);
    });
  });

  describe('Bundle Creation', () => {
    it('should create a bundle with valid data', async () => {
      if (!testPortalId) {
        console.log('Skipping test: No portal found');
        return;
      }

      const result = await serviceQuery(`
        INSERT INTO cc_job_application_bundles (
          portal_id, campaign_key, applicant_name, applicant_email,
          housing_needed, consent_given, status
        ) VALUES ($1, 'hospitality_all', 'Test User', 'test@example.com', false, true, 'submitted')
        RETURNING id, status
      `, [testPortalId]);

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].status).toBe('submitted');

      await serviceQuery(`DELETE FROM cc_job_application_bundles WHERE id = $1`, [result.rows[0].id]);
    });

    it('should reject invalid status values', async () => {
      if (!testPortalId) {
        console.log('Skipping test: No portal found');
        return;
      }

      await expect(serviceQuery(`
        INSERT INTO cc_job_application_bundles (
          portal_id, campaign_key, applicant_name, applicant_email,
          housing_needed, consent_given, status
        ) VALUES ($1, 'hospitality_all', 'Test User', 'test@example.com', false, true, 'invalid_status')
      `, [testPortalId])).rejects.toThrow();
    });
  });

  describe('Bundle Items', () => {
    it('should create bundle items linked to bundles', async () => {
      if (!testPortalId || !testJobId || !testJobPostingId || !testTenantId) {
        console.log('Skipping test: Missing required test data');
        return;
      }

      const bundleResult = await serviceQuery(`
        INSERT INTO cc_job_application_bundles (
          portal_id, campaign_key, applicant_name, applicant_email,
          housing_needed, consent_given, status
        ) VALUES ($1, 'hospitality_all', 'Test User', 'test@example.com', false, true, 'submitted')
        RETURNING id
      `, [testPortalId]);

      const bundleId = bundleResult.rows[0].id;

      const itemResult = await serviceQuery(`
        INSERT INTO cc_job_application_bundle_items (
          bundle_id, job_posting_id, job_id, tenant_id
        ) VALUES ($1, $2, $3, $4)
        RETURNING id
      `, [bundleId, testJobPostingId, testJobId, testTenantId]);

      expect(itemResult.rows.length).toBe(1);

      await serviceQuery(`DELETE FROM cc_job_application_bundles WHERE id = $1`, [bundleId]);
    });

    it('should cascade delete bundle items when bundle is deleted', async () => {
      if (!testPortalId || !testJobId || !testJobPostingId || !testTenantId) {
        console.log('Skipping test: Missing required test data');
        return;
      }

      const bundleResult = await serviceQuery(`
        INSERT INTO cc_job_application_bundles (
          portal_id, campaign_key, applicant_name, applicant_email,
          housing_needed, consent_given, status
        ) VALUES ($1, 'trades_all', 'Cascade Test', 'cascade@test.com', false, true, 'submitted')
        RETURNING id
      `, [testPortalId]);

      const bundleId = bundleResult.rows[0].id;

      await serviceQuery(`
        INSERT INTO cc_job_application_bundle_items (
          bundle_id, job_posting_id, job_id, tenant_id
        ) VALUES ($1, $2, $3, $4)
      `, [bundleId, testJobPostingId, testJobId, testTenantId]);

      await serviceQuery(`DELETE FROM cc_job_application_bundles WHERE id = $1`, [bundleId]);

      const itemCheck = await serviceQuery(`
        SELECT * FROM cc_job_application_bundle_items WHERE bundle_id = $1
      `, [bundleId]);

      expect(itemCheck.rows.length).toBe(0);
    });
  });

  describe('Portal Scoping', () => {
    it('should enforce portal_id foreign key', async () => {
      await expect(serviceQuery(`
        INSERT INTO cc_job_application_bundles (
          portal_id, campaign_key, applicant_name, applicant_email,
          housing_needed, consent_given, status
        ) VALUES ('00000000-0000-0000-0000-000000000000', 'all_roles', 'FK Test', 'fk@test.com', false, true, 'submitted')
      `)).rejects.toThrow();
    });
  });

  describe('RLS Policies', () => {
    it('should have service bypass policy on bundles', async () => {
      const result = await serviceQuery(`
        SELECT polname
        FROM pg_policy
        WHERE polrelid = 'cc_job_application_bundles'::regclass
        AND polname LIKE '%service%'
      `);
      
      expect(result.rows.length).toBeGreaterThan(0);
    });

    it('should have service bypass policy on bundle items', async () => {
      const result = await serviceQuery(`
        SELECT polname
        FROM pg_policy
        WHERE polrelid = 'cc_job_application_bundle_items'::regclass
        AND polname LIKE '%service%'
      `);
      
      expect(result.rows.length).toBeGreaterThan(0);
    });

    it('should have tenant read policy on bundle items', async () => {
      const result = await serviceQuery(`
        SELECT polname
        FROM pg_policy
        WHERE polrelid = 'cc_job_application_bundle_items'::regclass
        AND polname LIKE '%tenant%'
      `);
      
      expect(result.rows.length).toBeGreaterThan(0);
    });
  });
});
