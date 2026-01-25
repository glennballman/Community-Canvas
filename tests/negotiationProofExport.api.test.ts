/**
 * Phase 2C-10: Run Proof Export API Tests
 * Tests for deterministic audit bundle export
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { buildRunProofExport, EXPORT_SCHEMA_VERSION } from '../server/lib/runProofExport';

const DATABASE_URL = process.env.DATABASE_URL || process.env.CC_APP_DATABASE_URL;

function getBaseUrl(): string {
  const baseUrl = process.env.BASE_URL?.trim();
  if (baseUrl && baseUrl.startsWith('http')) return baseUrl;
  
  const devDomain = process.env.REPLIT_DEV_DOMAIN?.trim();
  if (devDomain) return `https://${devDomain}`;
  
  const slug = process.env.REPL_SLUG?.trim();
  const owner = process.env.REPL_OWNER?.trim()?.toLowerCase();
  if (slug && owner) return `https://${slug}.${owner}.repl.co`;
  
  return 'http://localhost:5000';
}

const BASE_URL = getBaseUrl();

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL or CC_APP_DATABASE_URL environment variable is required');
}

const pool = new Pool({
  connectionString: DATABASE_URL,
});

describe('Run Proof Export API (Phase 2C-10)', () => {
  let testTenantId: string;
  let testRunId: string;
  let testMembershipId: string;

  beforeAll(async () => {
    await pool.query("SELECT set_config('app.service_mode', 'true', false)");

    const tenantResult = await pool.query(`
      SELECT id FROM cc_tenants WHERE name ILIKE '%demo%' LIMIT 1
    `);
    if (tenantResult.rows.length > 0) {
      testTenantId = tenantResult.rows[0].id;
    }

    if (testTenantId) {
      const runResult = await pool.query(`
        SELECT id FROM cc_n3_runs WHERE tenant_id = $1 LIMIT 1
      `, [testTenantId]);
      if (runResult.rows.length > 0) {
        testRunId = runResult.rows[0].id;
      }

      const membershipResult = await pool.query(`
        SELECT id FROM cc_tenant_memberships WHERE tenant_id = $1 LIMIT 1
      `, [testTenantId]);
      if (membershipResult.rows.length > 0) {
        testMembershipId = membershipResult.rows[0].id;
      }
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('Export Schema', () => {
    it('schema version is correctly formatted', () => {
      expect(EXPORT_SCHEMA_VERSION).toBe('cc.v3_5.step11c.2c10.run_proof_export.v1');
    });
  });

  describe('Role Gating', () => {
    it('returns 401 without authentication', async () => {
      const fakeRunId = '00000000-0000-0000-0000-000000000000';
      const response = await fetch(`${BASE_URL}/api/app/runs/${fakeRunId}/negotiation-proof-export`);
      expect(response.status).toBe(401);
    });
  });

  describe('Export Builder', () => {
    it('builds export with correct schema version', async () => {
      if (!testTenantId || !testRunId) {
        console.log('Skipping test - missing tenant or run');
        return;
      }

      const result = await buildRunProofExport({
        tenantId: testTenantId,
        runId: testRunId,
        exportedAtOverride: '2026-01-25T12:00:00.000Z',
      });

      const parsed = JSON.parse(result.json);
      expect(parsed.schema_version).toBe(EXPORT_SCHEMA_VERSION);
      expect(parsed.exported_at).toBe('2026-01-25T12:00:00.000Z');
      expect(parsed.run_id).toBe(testRunId);
    });

    it('export contains required top-level keys', async () => {
      if (!testTenantId || !testRunId) {
        console.log('Skipping test - missing tenant or run');
        return;
      }

      const result = await buildRunProofExport({
        tenantId: testTenantId,
        runId: testRunId,
        exportedAtOverride: '2026-01-25T12:00:00.000Z',
      });

      const parsed = JSON.parse(result.json);
      expect(parsed).toHaveProperty('schema_version');
      expect(parsed).toHaveProperty('exported_at');
      expect(parsed).toHaveProperty('portal_id');
      expect(parsed).toHaveProperty('run_id');
      expect(parsed).toHaveProperty('negotiation_type');
      expect(parsed).toHaveProperty('policy_trace');
      expect(parsed).toHaveProperty('policy');
      expect(parsed).toHaveProperty('audit_events');
      expect(parsed).toHaveProperty('negotiation');
    });

    it('audit_events are sorted by created_at ASC', async () => {
      if (!testTenantId || !testRunId) {
        console.log('Skipping test - missing tenant or run');
        return;
      }

      const result = await buildRunProofExport({
        tenantId: testTenantId,
        runId: testRunId,
      });

      const parsed = JSON.parse(result.json);
      const events = parsed.audit_events as { created_at: string }[];
      
      for (let i = 1; i < events.length; i++) {
        expect(events[i].created_at >= events[i - 1].created_at).toBe(true);
      }
    });

    it('negotiation.events are sorted by created_at ASC', async () => {
      if (!testTenantId || !testRunId) {
        console.log('Skipping test - missing tenant or run');
        return;
      }

      const result = await buildRunProofExport({
        tenantId: testTenantId,
        runId: testRunId,
      });

      const parsed = JSON.parse(result.json);
      const events = parsed.negotiation.events as { created_at: string }[];
      
      for (let i = 1; i < events.length; i++) {
        expect(events[i].created_at >= events[i - 1].created_at).toBe(true);
      }
    });

    it('negotiation.events include proposal payload fields', async () => {
      if (!testTenantId || !testRunId) {
        console.log('Skipping test - missing tenant or run');
        return;
      }

      const result = await buildRunProofExport({
        tenantId: testTenantId,
        runId: testRunId,
      });

      const parsed = JSON.parse(result.json);
      
      expect(parsed.negotiation).toHaveProperty('latest');
      expect(parsed.negotiation).toHaveProperty('events');
      expect(parsed.negotiation.latest).toHaveProperty('status');
      expect(parsed.negotiation.latest).toHaveProperty('last_event_at');
      expect(parsed.negotiation.latest).toHaveProperty('turn_count');
      
      if (parsed.negotiation.events.length > 0) {
        const event = parsed.negotiation.events[0];
        expect(event).toHaveProperty('id');
        expect(event).toHaveProperty('created_at');
        expect(event).toHaveProperty('event_type');
        expect(event).toHaveProperty('proposed_start');
        expect(event).toHaveProperty('proposed_end');
        expect(event).toHaveProperty('proposal_context');
      }
    });
  });

  describe('Determinism', () => {
    it('same data produces identical output with fixed exported_at', async () => {
      if (!testTenantId || !testRunId) {
        console.log('Skipping determinism test - missing tenant or run');
        return;
      }

      const fixedTime = '2026-01-25T12:00:00.000Z';

      const result1 = await buildRunProofExport({
        tenantId: testTenantId,
        runId: testRunId,
        exportedAtOverride: fixedTime,
      });

      const result2 = await buildRunProofExport({
        tenantId: testTenantId,
        runId: testRunId,
        exportedAtOverride: fixedTime,
      });

      expect(result1.json).toBe(result2.json);
    });
  });

  describe('Policy Gating', () => {
    it('proposal_context is included only when allow_proposal_context=true', async () => {
      if (!testTenantId || !testRunId) {
        console.log('Skipping policy gating test - missing tenant or run');
        return;
      }

      const result = await buildRunProofExport({
        tenantId: testTenantId,
        runId: testRunId,
      });

      const parsed = JSON.parse(result.json);
      
      if (!parsed.policy.allowProposalContext) {
        for (const event of parsed.negotiation.events) {
          expect(event.proposal_context).toBeNull();
        }
      }
    });
  });

  describe('CSV Export', () => {
    it('CSV format includes headers and data rows', async () => {
      if (!testTenantId || !testRunId) {
        console.log('Skipping CSV test - missing tenant or run');
        return;
      }

      const result = await buildRunProofExport({
        tenantId: testTenantId,
        runId: testRunId,
        format: 'csv',
      });

      expect(result.csv).toBeDefined();
      expect(result.mimeType).toBe('text/csv');
      expect(result.filename).toMatch(/\.csv$/);
      
      if (result.csv) {
        const lines = result.csv.split('\n');
        expect(lines.length).toBeGreaterThan(0);
        expect(lines[0]).toContain('id,created_at,portal_id,run_id');
      }
    });
  });

  describe('Filename Generation', () => {
    it('filename includes run ID and date', async () => {
      if (!testTenantId || !testRunId) {
        console.log('Skipping filename test - missing tenant or run');
        return;
      }

      const result = await buildRunProofExport({
        tenantId: testTenantId,
        runId: testRunId,
        exportedAtOverride: '2026-01-25T12:00:00.000Z',
      });

      expect(result.filename).toContain(testRunId);
      expect(result.filename).toContain('20260125');
      expect(result.filename).toMatch(/\.json$/);
    });
  });
});
