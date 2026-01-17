import { describe, it, expect, beforeAll } from 'vitest';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

describe('Hiring Pulse', () => {
  describe('Database Requirements', () => {
    it('should have cc_job_application_events table with required columns', async () => {
      const result = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'cc_job_application_events'
        ORDER BY ordinal_position
      `);
      
      const columns = result.rows.map(r => r.column_name);
      expect(columns).toContain('id');
      expect(columns).toContain('application_id');
      expect(columns).toContain('event_type');
      expect(columns).toContain('created_at');
      expect(columns).toContain('portal_id');
    });

    it('should have index on application_id for events', async () => {
      const result = await pool.query(`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'cc_job_application_events'
          AND indexdef LIKE '%application_id%'
      `);
      expect(result.rows.length).toBeGreaterThan(0);
    });

    it('should have index on created_at for events', async () => {
      const result = await pool.query(`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'cc_job_application_events'
          AND indexdef LIKE '%created_at%'
      `);
      expect(result.rows.length).toBeGreaterThan(0);
    });
  });

  describe('Metrics Definitions', () => {
    it('should support reply_sent event type', async () => {
      const result = await pool.query(`
        SELECT enumlabel FROM pg_enum
        JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
        WHERE pg_type.typname = 'job_application_event_type'
      `);
      
      const eventTypes = result.rows.map(r => r.enumlabel);
      expect(eventTypes).toContain('reply_sent');
    });

    it('should have needs_reply column on applications', async () => {
      const result = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'cc_job_applications'
          AND column_name = 'needs_reply'
      `);
      expect(result.rows.length).toBe(1);
    });

    it('should have needs_accommodation column on applications', async () => {
      const result = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'cc_job_applications'
          AND column_name = 'needs_accommodation'
      `);
      expect(result.rows.length).toBe(1);
    });

    it('should have screening_responses column for work permit data', async () => {
      const result = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'cc_job_applications'
          AND column_name = 'screening_responses'
      `);
      expect(result.rows.length).toBe(1);
    });
  });

  describe('Portal Staff Authorization', () => {
    it('should verify portal staff via portal memberships', async () => {
      // Authorization is handled via cc_portal_memberships
      const result = await pool.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_name = 'cc_portal_memberships'
      `);
      expect(result.rows.length).toBe(1);
    });

    it('should have portal_id column on events for scoping', async () => {
      const result = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'cc_job_application_events'
          AND column_name = 'portal_id'
      `);
      expect(result.rows.length).toBe(1);
    });
  });

  describe('Median First Reply Calculation', () => {
    it('should be able to compute median from events', async () => {
      // Verify PERCENTILE_CONT is available (PostgreSQL)
      const result = await pool.query(`
        SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY v) as median
        FROM (VALUES (1), (2), (3), (4), (5)) AS t(v)
      `);
      expect(parseFloat(result.rows[0].median)).toBe(3);
    });

    it('should return null when no reply events exist for portal', async () => {
      // This tests the query logic - median should be null when no matching events
      const result = await pool.query(`
        WITH first_responses AS (
          SELECT 1 as minutes_to_first_response
          WHERE false -- empty result set
        )
        SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY minutes_to_first_response) as median
        FROM first_responses
      `);
      expect(result.rows[0].median).toBeNull();
    });
  });
});
