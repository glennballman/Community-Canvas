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

describe('Concierge Workflow - Job Application Events', () => {
  let testPortalId: string;
  let testTenantId: string;
  let testJobId: string;
  let testApplicationId: string;

  beforeAll(async () => {
    const tenantResult = await serviceQuery(`
      SELECT id FROM cc_tenants LIMIT 1
    `);
    testTenantId = tenantResult.rows[0]?.id;

    const portalResult = await serviceQuery(`
      SELECT id FROM cc_portals WHERE status = 'active' LIMIT 1
    `);
    testPortalId = portalResult.rows[0]?.id;

    if (testTenantId) {
      const jobResult = await serviceQuery(`
        SELECT id FROM cc_jobs WHERE tenant_id = $1 LIMIT 1
      `, [testTenantId]);
      testJobId = jobResult.rows[0]?.id;

      if (testJobId) {
        const appResult = await serviceQuery(`
          SELECT id FROM cc_job_applications WHERE job_id = $1 LIMIT 1
        `, [testJobId]);
        testApplicationId = appResult.rows[0]?.id;
      }
    }
  });

  describe('Database Schema', () => {
    it('should have cc_job_application_events table', async () => {
      const result = await serviceQuery(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'cc_job_application_events'
        ORDER BY ordinal_position
      `);
      
      const columns = result.rows.map((r: any) => r.column_name);
      expect(columns).toContain('id');
      expect(columns).toContain('application_id');
      expect(columns).toContain('portal_id');
      expect(columns).toContain('tenant_id');
      expect(columns).toContain('event_type');
      expect(columns).toContain('previous_status');
      expect(columns).toContain('new_status');
      expect(columns).toContain('note');
      expect(columns).toContain('template_code');
      expect(columns).toContain('metadata');
      expect(columns).toContain('created_at');
    });

    it('should have job_application_event_type enum', async () => {
      const result = await serviceQuery(`
        SELECT enumlabel FROM pg_enum 
        WHERE enumtypid = 'job_application_event_type'::regtype
        ORDER BY enumsortorder
      `);
      
      const types = result.rows.map((r: any) => r.enumlabel);
      expect(types).toContain('status_changed');
      expect(types).toContain('note_added');
      expect(types).toContain('reply_sent');
      expect(types).toContain('assigned_to_employer');
    });

    it('should have RLS enabled on events table', async () => {
      const result = await serviceQuery(`
        SELECT relrowsecurity
        FROM pg_class
        WHERE relname = 'cc_job_application_events'
      `);
      
      expect(result.rows[0]?.relrowsecurity).toBe(true);
    });

    it('should have last_activity_at column on applications', async () => {
      const result = await serviceQuery(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'cc_job_applications'
        AND column_name = 'last_activity_at'
      `);
      
      expect(result.rows.length).toBe(1);
    });

    it('should have needs_reply column on applications', async () => {
      const result = await serviceQuery(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'cc_job_applications'
        AND column_name = 'needs_reply'
      `);
      
      expect(result.rows.length).toBe(1);
    });
  });

  describe('Notification Templates', () => {
    it('should have job application notification templates', async () => {
      const result = await serviceQuery(`
        SELECT code, name, category
        FROM cc_notification_templates
        WHERE category = 'job'
        ORDER BY code
      `);
      
      const codes = result.rows.map((r: any) => r.code);
      expect(codes).toContain('job_application_received');
      expect(codes).toContain('job_application_request_info');
      expect(codes).toContain('job_application_interview_invite');
      expect(codes).toContain('job_application_not_selected');
    });

    it('should have housing and work permit templates', async () => {
      const result = await serviceQuery(`
        SELECT code FROM cc_notification_templates
        WHERE code IN ('job_application_housing_followup', 'job_application_work_permit_followup')
      `);
      
      expect(result.rows.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Event Creation', () => {
    it('should create an event with valid data', async () => {
      if (!testApplicationId || !testPortalId || !testTenantId) {
        console.log('Skipping test: Missing required test data');
        return;
      }

      const result = await serviceQuery(`
        INSERT INTO cc_job_application_events (
          application_id, portal_id, tenant_id, event_type, note
        ) VALUES ($1, $2, $3, 'note_added', 'Test note')
        RETURNING id
      `, [testApplicationId, testPortalId, testTenantId]);

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].id).toBeDefined();

      await serviceQuery(`DELETE FROM cc_job_application_events WHERE id = $1`, [result.rows[0].id]);
    });

    it('should create a status_changed event', async () => {
      if (!testApplicationId || !testPortalId || !testTenantId) {
        console.log('Skipping test: Missing required test data');
        return;
      }

      const result = await serviceQuery(`
        INSERT INTO cc_job_application_events (
          application_id, portal_id, tenant_id, event_type, 
          previous_status, new_status
        ) VALUES ($1, $2, $3, 'status_changed', 'submitted', 'under_review')
        RETURNING id, event_type
      `, [testApplicationId, testPortalId, testTenantId]);

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].event_type).toBe('status_changed');

      await serviceQuery(`DELETE FROM cc_job_application_events WHERE id = $1`, [result.rows[0].id]);
    });
  });

  describe('RLS Policies', () => {
    it('should have service bypass policy on events', async () => {
      const result = await serviceQuery(`
        SELECT polname
        FROM pg_policy
        WHERE polrelid = 'cc_job_application_events'::regclass
        AND polname LIKE '%service%'
      `);
      
      expect(result.rows.length).toBeGreaterThan(0);
    });

    it('should have portal read policy on events', async () => {
      const result = await serviceQuery(`
        SELECT polname
        FROM pg_policy
        WHERE polrelid = 'cc_job_application_events'::regclass
        AND polname LIKE '%portal%'
      `);
      
      expect(result.rows.length).toBeGreaterThan(0);
    });

    it('should have tenant read policy on events', async () => {
      const result = await serviceQuery(`
        SELECT polname
        FROM pg_policy
        WHERE polrelid = 'cc_job_application_events'::regclass
        AND polname LIKE '%tenant%'
      `);
      
      expect(result.rows.length).toBeGreaterThan(0);
    });
  });

  describe('Index Coverage', () => {
    it('should have index on application_id', async () => {
      const result = await serviceQuery(`
        SELECT indexname FROM pg_indexes 
        WHERE tablename = 'cc_job_application_events' 
        AND indexname LIKE '%application%'
      `);
      
      expect(result.rows.length).toBeGreaterThan(0);
    });

    it('should have index on portal_id', async () => {
      const result = await serviceQuery(`
        SELECT indexname FROM pg_indexes 
        WHERE tablename = 'cc_job_application_events' 
        AND indexname LIKE '%portal%'
      `);
      
      expect(result.rows.length).toBeGreaterThan(0);
    });

    it('should have index on tenant_id', async () => {
      const result = await serviceQuery(`
        SELECT indexname FROM pg_indexes 
        WHERE tablename = 'cc_job_application_events' 
        AND indexname LIKE '%tenant%'
      `);
      
      expect(result.rows.length).toBeGreaterThan(0);
    });
  });
});
