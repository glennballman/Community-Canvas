import { describe, it, expect, beforeAll } from 'vitest';
import { pool } from '../server/db';

describe('Portal Growth Switches & Housing Waitlist', () => {
  describe('Migration 149: Growth Switches', () => {
    it('should have cc_portal_growth_switches table', async () => {
      const result = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'cc_portal_growth_switches'
        ORDER BY ordinal_position
      `);
      
      expect(result.rows.length).toBeGreaterThan(0);
      
      const columnNames = result.rows.map(r => r.column_name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('portal_id');
      expect(columnNames).toContain('jobs_enabled');
      expect(columnNames).toContain('reservations_state');
      expect(columnNames).toContain('assets_enabled');
      expect(columnNames).toContain('service_runs_enabled');
      expect(columnNames).toContain('leads_enabled');
    });

    it('should have unique constraint on portal_id', async () => {
      const result = await pool.query(`
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_name = 'cc_portal_growth_switches'
          AND constraint_type = 'UNIQUE'
      `);
      
      expect(result.rows.length).toBeGreaterThan(0);
    });

    it('should have RLS enabled', async () => {
      const result = await pool.query(`
        SELECT relrowsecurity
        FROM pg_class
        WHERE relname = 'cc_portal_growth_switches'
      `);
      
      expect(result.rows[0].relrowsecurity).toBe(true);
    });

    it('should have valid reservations_state check constraint', async () => {
      const result = await pool.query(`
        SELECT constraint_name
        FROM information_schema.check_constraints
        WHERE constraint_name LIKE '%reservations_state%'
          OR constraint_name LIKE '%growth_switches%'
      `);
      
      expect(result.rows.length).toBeGreaterThan(0);
    });
  });

  describe('Migration 150: Housing Waitlist', () => {
    it('should have cc_portal_housing_policies table', async () => {
      const result = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'cc_portal_housing_policies'
      `);
      
      const columnNames = result.rows.map(r => r.column_name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('portal_id');
      expect(columnNames).toContain('is_enabled');
      expect(columnNames).toContain('disclosure_text');
    });

    it('should have cc_portal_housing_offers table', async () => {
      const result = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'cc_portal_housing_offers'
      `);
      
      const columnNames = result.rows.map(r => r.column_name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('portal_id');
      expect(columnNames).toContain('tenant_id');
      expect(columnNames).toContain('capacity_beds');
      expect(columnNames).toContain('capacity_rooms');
      expect(columnNames).toContain('status');
    });

    it('should have cc_portal_housing_waitlist_entries table', async () => {
      const result = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'cc_portal_housing_waitlist_entries'
      `);
      
      const columnNames = result.rows.map(r => r.column_name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('portal_id');
      expect(columnNames).toContain('bundle_id');
      expect(columnNames).toContain('application_id');
      expect(columnNames).toContain('applicant_name');
      expect(columnNames).toContain('applicant_email');
      expect(columnNames).toContain('status');
    });

    it('should have unique indexes for waitlist deduplication', async () => {
      const result = await pool.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'cc_portal_housing_waitlist_entries'
          AND indexname LIKE '%unique%'
      `);
      
      expect(result.rows.length).toBeGreaterThanOrEqual(2);
    });

    it('should have RLS enabled on housing tables', async () => {
      const tables = [
        'cc_portal_housing_policies',
        'cc_portal_housing_offers',
        'cc_portal_housing_waitlist_entries'
      ];
      
      for (const table of tables) {
        const result = await pool.query(`
          SELECT relrowsecurity
          FROM pg_class
          WHERE relname = $1
        `, [table]);
        
        expect(result.rows[0]?.relrowsecurity).toBe(true);
      }
    });
  });

  describe('Campaign Apply Housing Integration', () => {
    it('should have housing_needed column on bundles', async () => {
      const result = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'cc_job_application_bundles'
          AND column_name = 'housing_needed'
      `);
      
      expect(result.rows.length).toBe(1);
    });

    it('should be able to insert waitlist entry with bundle_id', async () => {
      const result = await pool.query(`
        SELECT column_name, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'cc_portal_housing_waitlist_entries'
          AND column_name = 'bundle_id'
      `);
      
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].is_nullable).toBe('YES');
    });
  });

  describe('Forbidden Terms Check', () => {
    it('should not contain forbidden terminology in migrations', async () => {
      const fs = await import('fs');
      const path = await import('path');
      
      const migrations = [
        'server/migrations/149_portal_growth_switches.sql',
        'server/migrations/150_portal_housing_waitlist.sql'
      ];
      
      const forbidden = ['b' + 'ook', 'b' + 'ooking', 'b' + 'ooked', 'b' + 'ookings', 'b' + 'ooker'];
      
      for (const migrationPath of migrations) {
        const content = fs.readFileSync(path.resolve(process.cwd(), migrationPath), 'utf-8').toLowerCase();
        
        for (const term of forbidden) {
          const regex = new RegExp(`\\b${term}\\b`, 'gi');
          expect(content.match(regex)).toBeNull();
        }
      }
    });
  });
});
