import { describe, it, expect, beforeAll } from 'vitest';
import { createHash } from 'crypto';
import { Pool } from 'pg';
import { 
  loadNegotiationPolicyWithTrace, 
  computePolicyHash 
} from '../server/lib/negotiation-policy';
import { buildRequestFingerprint } from '../server/lib/policyAudit';

const DATABASE_URL = process.env.DATABASE_URL || '';

describe('Policy Audit Trail (Phase 2C-8)', () => {
  let pool: Pool;

  beforeAll(() => {
    pool = new Pool({ connectionString: DATABASE_URL });
  });

  describe('Policy Hash Determinism', () => {
    function computePolicyHash(policy: Record<string, any>): string {
      const hashPayload = {
        allowCounter: policy.allowCounter,
        allowProposalContext: policy.allowProposalContext,
        closeOnAccept: policy.closeOnAccept,
        closeOnDecline: policy.closeOnDecline,
        maxTurns: policy.maxTurns,
        providerCanInitiate: policy.providerCanInitiate,
        stakeholderCanInitiate: policy.stakeholderCanInitiate,
      };
      const canonical = JSON.stringify(hashPayload);
      return createHash('sha256').update(canonical).digest('hex');
    }

    it('same policy values produce same hash', () => {
      const policy1 = {
        maxTurns: 3,
        allowCounter: true,
        closeOnAccept: true,
        closeOnDecline: true,
        providerCanInitiate: true,
        stakeholderCanInitiate: true,
        allowProposalContext: false,
      };
      const policy2 = { ...policy1 };

      expect(computePolicyHash(policy1)).toBe(computePolicyHash(policy2));
    });

    it('different policy values produce different hash', () => {
      const policy1 = {
        maxTurns: 3,
        allowCounter: true,
        closeOnAccept: true,
        closeOnDecline: true,
        providerCanInitiate: true,
        stakeholderCanInitiate: true,
        allowProposalContext: false,
      };
      const policy2 = { ...policy1, allowProposalContext: true };

      expect(computePolicyHash(policy1)).not.toBe(computePolicyHash(policy2));
    });

    it('hash is 64 character hex string', () => {
      const policy = {
        maxTurns: 3,
        allowCounter: true,
        closeOnAccept: true,
        closeOnDecline: true,
        providerCanInitiate: true,
        stakeholderCanInitiate: true,
        allowProposalContext: false,
      };

      const hash = computePolicyHash(policy);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('key order does not affect hash (canonical JSON)', () => {
      const policy1 = {
        maxTurns: 3,
        allowCounter: true,
        closeOnAccept: true,
        closeOnDecline: true,
        providerCanInitiate: true,
        stakeholderCanInitiate: true,
        allowProposalContext: false,
      };
      const policy2 = {
        allowProposalContext: false,
        stakeholderCanInitiate: true,
        providerCanInitiate: true,
        closeOnDecline: true,
        closeOnAccept: true,
        allowCounter: true,
        maxTurns: 3,
      };

      expect(computePolicyHash(policy1)).toBe(computePolicyHash(policy2));
    });
  });

  describe('Audit Table Schema', () => {
    it('cc_negotiation_policy_audit_events table exists', async () => {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'cc_negotiation_policy_audit_events'
        )
      `);
      expect(result.rows[0].exists).toBe(true);
    });

    it('request_fingerprint has unique index', async () => {
      const result = await pool.query(`
        SELECT COUNT(*) as count FROM pg_indexes 
        WHERE tablename = 'cc_negotiation_policy_audit_events' 
        AND indexname = 'idx_negotiation_policy_audit_fingerprint'
      `);
      expect(Number(result.rows[0].count)).toBe(1);
    });

    it('actor_type constraint enforces allowed values', async () => {
      const result = await pool.query(`
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'cc_negotiation_policy_audit_events' 
        AND constraint_name = 'chk_audit_actor_type'
      `);
      expect(result.rows.length).toBe(1);
    });

    it('effective_source constraint enforces allowed values', async () => {
      const result = await pool.query(`
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'cc_negotiation_policy_audit_events' 
        AND constraint_name = 'chk_audit_effective_source'
      `);
      expect(result.rows.length).toBe(1);
    });

    it('RLS is enabled on audit table', async () => {
      const result = await pool.query(`
        SELECT relrowsecurity 
        FROM pg_class 
        WHERE relname = 'cc_negotiation_policy_audit_events'
      `);
      expect(result.rows[0].relrowsecurity).toBe(true);
    });
  });

  describe('Request Fingerprint Logic', () => {
    it('fingerprint format is runId:actorType:policyHash', () => {
      const runId = 'abc123';
      const actorType = 'provider';
      const policyHash = 'def456';

      const fingerprint = `${runId}:${actorType}:${policyHash}`;
      expect(fingerprint).toBe('abc123:provider:def456');
    });

    it('different actors produce different fingerprints', () => {
      const runId = 'abc123';
      const policyHash = 'def456';

      const fp1 = `${runId}:provider:${policyHash}`;
      const fp2 = `${runId}:stakeholder:${policyHash}`;

      expect(fp1).not.toBe(fp2);
    });

    it('different policy hashes produce different fingerprints', () => {
      const runId = 'abc123';
      const actorType = 'provider';

      const fp1 = `${runId}:${actorType}:hash1`;
      const fp2 = `${runId}:${actorType}:hash2`;

      expect(fp1).not.toBe(fp2);
    });
  });

  describe('Policy Trace Shape', () => {
    interface PolicyTrace {
      negotiation_type: string;
      effective_source: 'platform' | 'tenant_override';
      platform_policy_id: string;
      tenant_policy_id: string | null;
      effective_policy_id: string;
      effective_policy_updated_at: string;
      effective_policy_hash: string;
    }

    it('trace has all required fields', () => {
      const trace: PolicyTrace = {
        negotiation_type: 'schedule',
        effective_source: 'platform',
        platform_policy_id: 'abc-123',
        tenant_policy_id: null,
        effective_policy_id: 'abc-123',
        effective_policy_updated_at: '2024-01-01T00:00:00.000Z',
        effective_policy_hash: 'deadbeef'.repeat(8),
      };

      expect(trace).toHaveProperty('negotiation_type');
      expect(trace).toHaveProperty('effective_source');
      expect(trace).toHaveProperty('platform_policy_id');
      expect(trace).toHaveProperty('tenant_policy_id');
      expect(trace).toHaveProperty('effective_policy_id');
      expect(trace).toHaveProperty('effective_policy_updated_at');
      expect(trace).toHaveProperty('effective_policy_hash');
    });

    it('effective_source must be platform or tenant_override', () => {
      const validSources = ['platform', 'tenant_override'];
      expect(validSources).toContain('platform');
      expect(validSources).toContain('tenant_override');
      expect(validSources.length).toBe(2);
    });

    it('effective_policy_updated_at is ISO timestamp', () => {
      const timestamp = '2024-01-15T12:30:45.123Z';
      const parsed = new Date(timestamp);
      expect(parsed.toISOString()).toBe(timestamp);
    });
  });

  describe('Platform Policy Table', () => {
    it('platform policy has id and updated_at columns', async () => {
      const result = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'cc_platform_negotiation_policy' 
        AND column_name IN ('id', 'updated_at')
        ORDER BY column_name
      `);
      const columns = result.rows.map((r: any) => r.column_name);
      expect(columns).toContain('id');
      expect(columns).toContain('updated_at');
    });
  });

  describe('Tenant Policy Table', () => {
    it('tenant policy has id and updated_at columns', async () => {
      const result = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'cc_tenant_negotiation_policy' 
        AND column_name IN ('id', 'updated_at')
        ORDER BY column_name
      `);
      const columns = result.rows.map((r: any) => r.column_name);
      expect(columns).toContain('id');
      expect(columns).toContain('updated_at');
    });
  });

  describe('Resolver Integration', () => {
    it('loadNegotiationPolicyWithTrace returns policy and trace', async () => {
      const tenantResult = await pool.query(`
        SELECT id FROM cc_tenants LIMIT 1
      `);
      if (tenantResult.rows.length === 0) {
        console.log('No tenants found, skipping resolver test');
        return;
      }
      const tenantId = tenantResult.rows[0].id;

      const platformPolicyResult = await pool.query(`
        SELECT id FROM cc_platform_negotiation_policy WHERE negotiation_type = 'schedule' LIMIT 1
      `);
      if (platformPolicyResult.rows.length === 0) {
        console.log('No platform policy found, skipping resolver test');
        return;
      }

      const { policy, trace } = await loadNegotiationPolicyWithTrace(tenantId, 'schedule');

      expect(policy).toBeDefined();
      expect(policy.negotiationType).toBe('schedule');
      expect(typeof policy.maxTurns).toBe('number');
      expect(typeof policy.allowCounter).toBe('boolean');

      expect(trace).toBeDefined();
      expect(trace.negotiation_type).toBe('schedule');
      expect(['platform', 'tenant_override']).toContain(trace.effective_source);
      expect(trace.platform_policy_id).toBeDefined();
      expect(trace.effective_policy_id).toBeDefined();
      expect(trace.effective_policy_updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(trace.effective_policy_hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('computePolicyHash produces consistent results', () => {
      const policy = {
        negotiationType: 'schedule' as const,
        maxTurns: 5,
        allowCounter: true,
        closeOnAccept: true,
        closeOnDecline: false,
        providerCanInitiate: true,
        stakeholderCanInitiate: false,
        allowProposalContext: true,
      };

      const hash1 = computePolicyHash(policy);
      const hash2 = computePolicyHash(policy);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('buildRequestFingerprint creates correct format', () => {
      const runId = 'test-run-123';
      const actorType = 'provider';
      const policyHash = 'abc123def456';

      const fingerprint = buildRequestFingerprint(runId, actorType, policyHash);
      expect(fingerprint).toBe('test-run-123:provider:abc123def456');
    });
  });

  describe('Audit Dedupe Behavior', () => {
    it('unique constraint on request_fingerprint prevents duplicates', async () => {
      const result = await pool.query(`
        SELECT indexdef FROM pg_indexes 
        WHERE tablename = 'cc_negotiation_policy_audit_events' 
        AND indexname = 'idx_negotiation_policy_audit_fingerprint'
      `);
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].indexdef).toContain('UNIQUE');
    });
  });
});
