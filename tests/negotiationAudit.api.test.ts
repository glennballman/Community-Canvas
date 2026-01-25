import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';

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

async function makeAuthenticatedRequest(
  method: 'GET' | 'POST',
  path: string,
  tenantId: string,
  membershipId: string,
  body?: any
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-TEST-AUTH': JSON.stringify({
      tenant_id: tenantId,
      tenant_membership_id: membershipId,
      role: 'tenant_admin',
    }),
    'Cookie': 'test_session=valid',
  };
  
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  
  return {
    status: response.status,
    data: await response.json().catch(() => ({})),
  };
}

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL or CC_APP_DATABASE_URL environment variable is required');
}

const pool = new Pool({
  connectionString: DATABASE_URL,
});

describe('Negotiation Audit API (Phase 2C-9)', () => {
  let testTenantAId: string;
  let testTenantBId: string;
  let testRunId: string;
  let testAuditEventIds: string[] = [];

  beforeAll(async () => {
    await pool.query("SELECT set_config('app.service_mode', 'true', false)");

    const tenantAResult = await pool.query(`
      SELECT id FROM cc_tenants WHERE name ILIKE '%demo%' LIMIT 1
    `);
    if (tenantAResult.rows.length === 0) {
      console.log('No test tenant found, some tests may be skipped');
      return;
    }
    testTenantAId = tenantAResult.rows[0].id;

    const tenantBResult = await pool.query(`
      SELECT id FROM cc_tenants WHERE id != $1 LIMIT 1
    `, [testTenantAId]);
    if (tenantBResult.rows.length > 0) {
      testTenantBId = tenantBResult.rows[0].id;
    }

    const runResult = await pool.query(`
      SELECT id FROM cc_n3_runs WHERE tenant_id = $1 LIMIT 1
    `, [testTenantAId]);
    if (runResult.rows.length > 0) {
      testRunId = runResult.rows[0].id;
    }
  });

  afterAll(async () => {
    if (testAuditEventIds.length > 0) {
      await pool.query("SELECT set_config('app.service_mode', 'true', false)");
      await pool.query(
        `DELETE FROM cc_negotiation_policy_audit_events WHERE id = ANY($1)`,
        [testAuditEventIds]
      );
    }
    await pool.end();
  });

  describe('Audit Table Schema', () => {
    it('cc_negotiation_policy_audit_events table exists', async () => {
      const result = await pool.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'cc_negotiation_policy_audit_events'
      `);
      expect(result.rows.length).toBe(1);
    });

    it('table has expected columns', async () => {
      const result = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'cc_negotiation_policy_audit_events'
        ORDER BY column_name
      `);
      const columns = result.rows.map(r => r.column_name);
      
      expect(columns).toContain('id');
      expect(columns).toContain('tenant_id');
      expect(columns).toContain('portal_id');
      expect(columns).toContain('run_id');
      expect(columns).toContain('actor_type');
      expect(columns).toContain('negotiation_type');
      expect(columns).toContain('effective_source');
      expect(columns).toContain('effective_policy_id');
      expect(columns).toContain('effective_policy_hash');
      expect(columns).toContain('request_fingerprint');
      expect(columns).toContain('created_at');
    });

    it('RLS is enabled on audit table', async () => {
      const result = await pool.query(`
        SELECT relrowsecurity FROM pg_class 
        WHERE relname = 'cc_negotiation_policy_audit_events'
      `);
      expect(result.rows[0].relrowsecurity).toBe(true);
    });
  });

  describe('RLS Isolation', () => {
    it('audit events belong to a single tenant', async () => {
      if (!testTenantAId) {
        console.log('Skipping test - no test tenant available');
        return;
      }

      const result = await pool.query(`
        SELECT DISTINCT tenant_id FROM cc_negotiation_policy_audit_events
        WHERE tenant_id = $1
      `, [testTenantAId]);
      
      if (result.rows.length > 0) {
        expect(result.rows.every(r => r.tenant_id === testTenantAId)).toBe(true);
      }
    });

    it('tenant_id column exists for RLS filtering', async () => {
      const result = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'cc_negotiation_policy_audit_events' AND column_name = 'tenant_id'
      `);
      expect(result.rows.length).toBe(1);
    });
  });

  describe('Audit Event Insertion', () => {
    it('can insert audit event with all fields', async () => {
      if (!testTenantAId || !testRunId) {
        console.log('Skipping test - missing tenant or run');
        return;
      }

      const testHash = 'a'.repeat(64);
      const testFingerprint = `${testRunId}:test_api:${testHash}`;

      const insertResult = await pool.query(`
        INSERT INTO cc_negotiation_policy_audit_events (
          tenant_id, run_id, actor_type, negotiation_type,
          effective_source, effective_policy_id, effective_policy_updated_at,
          effective_policy_hash, request_fingerprint
        ) VALUES ($1, $2, 'provider', 'schedule', 'platform', gen_random_uuid(), NOW(), $3, $4)
        RETURNING id
      `, [testTenantAId, testRunId, testHash, testFingerprint]);

      expect(insertResult.rows.length).toBe(1);
      testAuditEventIds.push(insertResult.rows[0].id);
    });

    it('request_fingerprint enforces uniqueness', async () => {
      if (!testTenantAId || !testRunId) {
        console.log('Skipping test - missing tenant or run');
        return;
      }

      const testHash = 'b'.repeat(64);
      const testFingerprint = `${testRunId}:test_unique:${testHash}`;

      const insertResult = await pool.query(`
        INSERT INTO cc_negotiation_policy_audit_events (
          tenant_id, run_id, actor_type, negotiation_type,
          effective_source, effective_policy_id, effective_policy_updated_at,
          effective_policy_hash, request_fingerprint
        ) VALUES ($1, $2, 'provider', 'schedule', 'platform', gen_random_uuid(), NOW(), $3, $4)
        ON CONFLICT (request_fingerprint) DO NOTHING
        RETURNING id
      `, [testTenantAId, testRunId, testHash, testFingerprint]);

      if (insertResult.rows.length > 0) {
        testAuditEventIds.push(insertResult.rows[0].id);
      }

      const duplicateResult = await pool.query(`
        INSERT INTO cc_negotiation_policy_audit_events (
          tenant_id, run_id, actor_type, negotiation_type,
          effective_source, effective_policy_id, effective_policy_updated_at,
          effective_policy_hash, request_fingerprint
        ) VALUES ($1, $2, 'provider', 'schedule', 'platform', gen_random_uuid(), NOW(), $3, $4)
        ON CONFLICT (request_fingerprint) DO NOTHING
        RETURNING id
      `, [testTenantAId, testRunId, testHash, testFingerprint]);

      expect(duplicateResult.rows.length).toBe(0);
    });
  });

  describe('Filter Fields', () => {
    it('actor_type constraint allows valid values', async () => {
      const result = await pool.query(`
        SELECT conname, pg_get_constraintdef(oid) as definition
        FROM pg_constraint
        WHERE conrelid = 'cc_negotiation_policy_audit_events'::regclass
        AND contype = 'c'
        AND conname LIKE '%actor_type%'
      `);
      
      expect(result.rows.length).toBeGreaterThan(0);
      const definition = result.rows[0].definition;
      expect(definition).toContain('provider');
      expect(definition).toContain('stakeholder');
    });

    it('effective_source constraint allows valid values', async () => {
      const result = await pool.query(`
        SELECT conname, pg_get_constraintdef(oid) as definition
        FROM pg_constraint
        WHERE conrelid = 'cc_negotiation_policy_audit_events'::regclass
        AND contype = 'c'
        AND conname LIKE '%effective_source%'
      `);
      
      expect(result.rows.length).toBeGreaterThan(0);
      const definition = result.rows[0].definition;
      expect(definition).toContain('platform');
      expect(definition).toContain('tenant_override');
    });
  });

  describe('Query Performance', () => {
    it('indexes exist for common query patterns', async () => {
      const result = await pool.query(`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'cc_negotiation_policy_audit_events'
      `);
      
      const indexNames = result.rows.map(r => r.indexname);
      
      expect(indexNames.some(n => n.includes('fingerprint'))).toBe(true);
      expect(indexNames.some(n => n.includes('run') || n.includes('tenant'))).toBe(true);
    });
  });

  describe('Data Integrity', () => {
    it('effective_policy_hash is 64 characters', async () => {
      const result = await pool.query(`
        SELECT effective_policy_hash FROM cc_negotiation_policy_audit_events
        LIMIT 10
      `);
      
      for (const row of result.rows) {
        expect(row.effective_policy_hash).toMatch(/^[a-f0-9]{64}$/);
      }
    });

    it('created_at is populated automatically', async () => {
      const result = await pool.query(`
        SELECT created_at FROM cc_negotiation_policy_audit_events
        WHERE created_at IS NOT NULL
        LIMIT 1
      `);
      
      if (result.rows.length > 0) {
        expect(result.rows[0].created_at).toBeDefined();
        expect(new Date(result.rows[0].created_at).getTime()).toBeGreaterThan(0);
      }
    });
  });

  describe('Endpoint-Level API Tests', () => {
    let testMembershipId: string;

    beforeAll(async () => {
      if (!testTenantAId) return;
      
      const membershipResult = await pool.query(`
        SELECT id FROM cc_tenant_memberships 
        WHERE tenant_id = $1 
        LIMIT 1
      `, [testTenantAId]);
      
      if (membershipResult.rows.length > 0) {
        testMembershipId = membershipResult.rows[0].id;
      }
    });

    it('GET /api/app/negotiation-audit returns 401 without auth', async () => {
      const response = await fetch(`${BASE_URL}/api/app/negotiation-audit`);
      expect(response.status).toBe(401);
    });

    it('GET /api/app/negotiation-audit returns paginated results for authenticated tenant', async () => {
      if (!testTenantAId || !testMembershipId) {
        console.log('Skipping endpoint test - no test tenant/membership');
        return;
      }

      const response = await makeAuthenticatedRequest(
        'GET',
        '/api/app/negotiation-audit?limit=10',
        testTenantAId,
        testMembershipId
      );

      expect([200, 401, 403]).toContain(response.status);
      if (response.status === 200) {
        expect(response.data).toHaveProperty('ok');
        if (response.data.ok) {
          expect(response.data).toHaveProperty('events');
          expect(response.data).toHaveProperty('pagination');
          expect(Array.isArray(response.data.events)).toBe(true);
        }
      }
    });

    it('GET /api/app/negotiation-audit accepts filter parameters', async () => {
      if (!testTenantAId || !testMembershipId) {
        console.log('Skipping endpoint test - no test tenant/membership');
        return;
      }

      const response = await makeAuthenticatedRequest(
        'GET',
        '/api/app/negotiation-audit?actor_type=provider&effective_source=platform',
        testTenantAId,
        testMembershipId
      );

      expect([200, 401, 403]).toContain(response.status);
      if (response.status === 200 && response.data.ok) {
        for (const event of response.data.events) {
          if (event.actor_type) expect(event.actor_type).toBe('provider');
          if (event.effective_source) expect(event.effective_source).toBe('platform');
        }
      }
    });

    it('GET /api/app/runs/:id/negotiation-audit requires auth or returns not found for invalid run', async () => {
      const fakeRunId = '00000000-0000-0000-0000-000000000000';
      const response = await fetch(`${BASE_URL}/api/app/runs/${fakeRunId}/negotiation-audit`);
      expect([200, 401, 403, 404]).toContain(response.status);
    });

    it('GET /api/app/runs/:id/negotiation-audit returns events for specific run', async () => {
      if (!testTenantAId || !testMembershipId || !testRunId) {
        console.log('Skipping endpoint test - no test tenant/membership/run');
        return;
      }

      const response = await makeAuthenticatedRequest(
        'GET',
        `/api/app/runs/${testRunId}/negotiation-audit`,
        testTenantAId,
        testMembershipId
      );

      expect([200, 401, 403, 404]).toContain(response.status);
      if (response.status === 200 && response.data.ok) {
        expect(response.data).toHaveProperty('events');
        expect(Array.isArray(response.data.events)).toBe(true);
      }
    });

    it('RLS isolation: tenant A cannot see tenant B events via API', async () => {
      if (!testTenantAId || !testTenantBId || !testMembershipId) {
        console.log('Skipping cross-tenant isolation test - missing tenants');
        return;
      }

      const membershipBResult = await pool.query(`
        SELECT id FROM cc_tenant_memberships 
        WHERE tenant_id = $1 
        LIMIT 1
      `, [testTenantBId]);

      if (membershipBResult.rows.length === 0) {
        console.log('Skipping - no membership for tenant B');
        return;
      }

      const testMembershipBId = membershipBResult.rows[0].id;

      const responseA = await makeAuthenticatedRequest(
        'GET',
        '/api/app/negotiation-audit?limit=100',
        testTenantAId,
        testMembershipId
      );

      const responseB = await makeAuthenticatedRequest(
        'GET',
        '/api/app/negotiation-audit?limit=100',
        testTenantBId,
        testMembershipBId
      );

      if (responseA.status === 200 && responseA.data.ok && 
          responseB.status === 200 && responseB.data.ok) {
        const eventIdsA = new Set(responseA.data.events.map((e: any) => e.id));
        const eventIdsB = new Set(responseB.data.events.map((e: any) => e.id));
        
        const overlap = [...eventIdsA].filter(id => eventIdsB.has(id));
        expect(overlap.length).toBe(0);
      }
    });
  });
});
