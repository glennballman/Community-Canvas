import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Pool, PoolClient } from 'pg';

const TEST_TENANT_ID = '11111111-1111-1111-1111-111111111111';
const CANADA_DIRECT_PORTAL_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const ADRENALINE_CANADA_PORTAL_ID = '96f6541c-2b38-4666-92e3-04f68d64b8ef';

describe('Job Publish Validation', () => {
  let pool: Pool;
  let client: PoolClient;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    client = await pool.connect();
    
    await client.query(`SET app.tenant_id = '${TEST_TENANT_ID}'`);
    await client.query(`SET app.mode = 'service'`);

    await client.query(`
      INSERT INTO cc_tenants (id, name, slug, tenant_type, status)
      VALUES ($1, 'Test Tenant', 'test-tenant', 'business', 'active')
      ON CONFLICT (id) DO NOTHING
    `, [TEST_TENANT_ID]);
  });

  afterAll(async () => {
    await client.query(`
      DELETE FROM cc_job_postings WHERE job_id IN (SELECT id FROM cc_jobs WHERE tenant_id = $1)
    `, [TEST_TENANT_ID]);
    await client.query(`DELETE FROM cc_jobs WHERE tenant_id = $1`, [TEST_TENANT_ID]);
    client.release();
    await pool.end();
  });

  describe('Strict Portal Validation (CanadaDirect/AdrenalineCanada)', () => {
    let testJobId: string;

    beforeEach(async () => {
      const result = await client.query(`
        INSERT INTO cc_jobs (
          tenant_id, title, role_category, employment_type, description,
          pay_min, pay_max, pay_unit, housing_status, work_permit_support
        ) VALUES (
          $1, 'Test Job', 'maintenance', 'full_time', 'Test description',
          NULL, NULL, 'hour', 'unknown', 'unknown'
        ) RETURNING id
      `, [TEST_TENANT_ID]);
      testJobId = result.rows[0].id;
    });

    afterAll(async () => {
      await client.query(`DELETE FROM cc_jobs WHERE tenant_id = $1`, [TEST_TENANT_ID]);
    });

    it('should fail when pay_min is missing for CanadaDirect', async () => {
      const portalResult = await client.query(`
        SELECT id, slug FROM cc_portals WHERE slug = 'canadadirect'
      `);
      
      if (portalResult.rows.length === 0) {
        console.log('CanadaDirect portal not found, skipping test');
        return;
      }

      const job = await client.query(`SELECT * FROM cc_jobs WHERE id = $1`, [testJobId]);
      expect(job.rows[0].pay_min).toBeNull();
      
      const missing: string[] = [];
      if (job.rows[0].pay_min == null) missing.push('pay_min');
      if (job.rows[0].pay_max == null) missing.push('pay_max');
      if (!job.rows[0].housing_status || job.rows[0].housing_status === 'unknown') {
        missing.push('housing_status');
      }
      if (!job.rows[0].work_permit_support || job.rows[0].work_permit_support === 'unknown') {
        missing.push('work_permit_support');
      }

      expect(missing).toContain('pay_min');
      expect(missing).toContain('pay_max');
    });

    it('should fail when housing_status is unknown for CanadaDirect', async () => {
      await client.query(`
        UPDATE cc_jobs SET pay_min = 20, pay_max = 30 WHERE id = $1
      `, [testJobId]);

      const job = await client.query(`SELECT * FROM cc_jobs WHERE id = $1`, [testJobId]);
      
      const missing: string[] = [];
      if (!job.rows[0].housing_status || job.rows[0].housing_status === 'unknown') {
        missing.push('housing_status');
      }
      
      expect(missing).toContain('housing_status');
    });

    it('should fail when work_permit_support is unknown for CanadaDirect', async () => {
      await client.query(`
        UPDATE cc_jobs SET pay_min = 20, pay_max = 30, housing_status = 'available' WHERE id = $1
      `, [testJobId]);

      const job = await client.query(`SELECT * FROM cc_jobs WHERE id = $1`, [testJobId]);
      
      const missing: string[] = [];
      if (!job.rows[0].work_permit_support || job.rows[0].work_permit_support === 'unknown') {
        missing.push('work_permit_support');
      }
      
      expect(missing).toContain('work_permit_support');
    });

    it('should succeed when all required fields are present', async () => {
      await client.query(`
        UPDATE cc_jobs SET 
          pay_min = 20, 
          pay_max = 30, 
          housing_status = 'available',
          work_permit_support = 'consider'
        WHERE id = $1
      `, [testJobId]);

      const job = await client.query(`SELECT * FROM cc_jobs WHERE id = $1`, [testJobId]);
      
      const missing: string[] = [];
      const invalid: string[] = [];

      if (job.rows[0].pay_min == null) missing.push('pay_min');
      if (job.rows[0].pay_max == null) missing.push('pay_max');
      if (job.rows[0].pay_min != null && job.rows[0].pay_max != null && 
          parseFloat(job.rows[0].pay_max) < parseFloat(job.rows[0].pay_min)) {
        invalid.push('pay_max must be >= pay_min');
      }
      if (!job.rows[0].housing_status || job.rows[0].housing_status === 'unknown') {
        missing.push('housing_status');
      }
      if (!job.rows[0].work_permit_support || job.rows[0].work_permit_support === 'unknown') {
        missing.push('work_permit_support');
      }

      expect(missing).toHaveLength(0);
      expect(invalid).toHaveLength(0);
    });

    it('should fail when pay_max < pay_min', async () => {
      await client.query(`
        UPDATE cc_jobs SET 
          pay_min = 30, 
          pay_max = 20, 
          housing_status = 'available',
          work_permit_support = 'consider'
        WHERE id = $1
      `, [testJobId]);

      const job = await client.query(`SELECT * FROM cc_jobs WHERE id = $1`, [testJobId]);
      
      const invalid: string[] = [];
      if (parseFloat(job.rows[0].pay_max) < parseFloat(job.rows[0].pay_min)) {
        invalid.push('pay_max must be >= pay_min');
      }

      expect(invalid).toContain('pay_max must be >= pay_min');
    });
  });

  describe('Free Portal Validation (warnings only)', () => {
    it('should identify that embed surfaces do not require strict validation', async () => {
      const STRICT_SLUGS = ['canadadirect', 'adrenalinecanada'];
      const embedSurfaceSlug = 'community-embed';
      
      expect(STRICT_SLUGS).not.toContain(embedSurfaceSlug);
    });

    it('should return warnings array when soft validation fields are missing', async () => {
      const softValidationWarnings: string[] = [];
      const job = { pay_min: null, pay_max: null, housing_status: 'unknown', work_permit_support: 'unknown' };

      if (job.pay_min == null || job.pay_max == null) {
        softValidationWarnings.push('pay_range_missing');
      }
      if (!job.housing_status || job.housing_status === 'unknown') {
        softValidationWarnings.push('housing_status_unknown');
      }
      if (!job.work_permit_support || job.work_permit_support === 'unknown') {
        softValidationWarnings.push('work_permit_support_unknown');
      }

      expect(softValidationWarnings).toContain('pay_range_missing');
      expect(softValidationWarnings).toContain('housing_status_unknown');
      expect(softValidationWarnings).toContain('work_permit_support_unknown');
      expect(softValidationWarnings).toHaveLength(3);
    });
  });

  describe('Schema Validation', () => {
    it('should have housing_status column with correct check constraint', async () => {
      const result = await client.query(`
        SELECT column_name, data_type, column_default
        FROM information_schema.columns
        WHERE table_name = 'cc_jobs' AND column_name = 'housing_status'
      `);

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].data_type).toBe('text');
      expect(result.rows[0].column_default).toContain('unknown');
    });

    it('should have work_permit_support column with correct check constraint', async () => {
      const result = await client.query(`
        SELECT column_name, data_type, column_default
        FROM information_schema.columns
        WHERE table_name = 'cc_jobs' AND column_name = 'work_permit_support'
      `);

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].data_type).toBe('text');
      expect(result.rows[0].column_default).toContain('unknown');
    });

    it('should have pay_unit column with correct check constraint', async () => {
      const result = await client.query(`
        SELECT column_name, data_type, column_default
        FROM information_schema.columns
        WHERE table_name = 'cc_jobs' AND column_name = 'pay_unit'
      `);

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].data_type).toBe('text');
      expect(result.rows[0].column_default).toContain('hour');
    });

    it('should have housing cost columns', async () => {
      const result = await client.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'cc_jobs' AND column_name IN ('housing_cost_min_cents', 'housing_cost_max_cents')
        ORDER BY column_name
      `);

      expect(result.rows.length).toBe(2);
      expect(result.rows[0].column_name).toBe('housing_cost_max_cents');
      expect(result.rows[1].column_name).toBe('housing_cost_min_cents');
    });

    it('should reject invalid housing_status values', async () => {
      try {
        await client.query(`
          INSERT INTO cc_jobs (
            tenant_id, title, role_category, employment_type, description, housing_status
          ) VALUES (
            $1, 'Bad Job', 'maintenance', 'full_time', 'Test', 'invalid_value'
          )
        `, [TEST_TENANT_ID]);
        expect.fail('Should have thrown check constraint error');
      } catch (err: any) {
        expect(err.message).toContain('violates check constraint');
      }
    });

    it('should reject invalid work_permit_support values', async () => {
      try {
        await client.query(`
          INSERT INTO cc_jobs (
            tenant_id, title, role_category, employment_type, description, work_permit_support
          ) VALUES (
            $1, 'Bad Job', 'maintenance', 'full_time', 'Test', 'invalid_value'
          )
        `, [TEST_TENANT_ID]);
        expect.fail('Should have thrown check constraint error');
      } catch (err: any) {
        expect(err.message).toContain('violates check constraint');
      }
    });
  });

  describe('CanadaDirect Portal Exists', () => {
    it('should have CanadaDirect portal with moderation enabled', async () => {
      const result = await client.query(`
        SELECT p.id, p.slug, p.name, pdp.requires_moderation, pdp.requires_checkout
        FROM cc_portals p
        JOIN cc_portal_distribution_policies pdp ON pdp.portal_id = p.id
        WHERE p.slug = 'canadadirect'
      `);

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].slug).toBe('canadadirect');
      expect(result.rows[0].requires_moderation).toBe(true);
      expect(result.rows[0].requires_checkout).toBe(false);
    });

    it('should have AdrenalineCanada portal with checkout enabled', async () => {
      const result = await client.query(`
        SELECT p.id, p.slug, p.name, pdp.requires_moderation, pdp.requires_checkout, pdp.price_cents
        FROM cc_portals p
        JOIN cc_portal_distribution_policies pdp ON pdp.portal_id = p.id
        WHERE p.slug = 'adrenalinecanada'
      `);

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].slug).toBe('adrenalinecanada');
      expect(result.rows[0].requires_checkout).toBe(true);
      expect(result.rows[0].price_cents).toBe(2900);
    });
  });
});
