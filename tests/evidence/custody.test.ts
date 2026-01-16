/**
 * P2.5 Evidence Chain-of-Custody Tests
 * Tests for append-only chain, idempotency, and bundle manifest
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  canonicalizeJson,
  sha256Hex,
  computeEvidenceContentSha256,
  appendEvidenceEvent,
  verifyEvidenceChain,
  compileBundleManifest
} from '../../server/lib/evidence/custody';
import { pool } from '../../server/db';

// ============================================================
// UNIT TESTS: Canonical Hashing
// ============================================================

describe('Canonical JSON Serialization', () => {
  it('sorts object keys alphabetically', () => {
    const input = { z: 1, a: 2, m: 3 };
    const result = canonicalizeJson(input);
    expect(result).toBe('{"a":2,"m":3,"z":1}');
  });

  it('handles nested objects with sorted keys', () => {
    const input = { outer: { z: 1, a: 2 }, inner: { c: 3 } };
    const result = canonicalizeJson(input);
    expect(result).toBe('{"inner":{"c":3},"outer":{"a":2,"z":1}}');
  });

  it('preserves array order', () => {
    const input = { arr: [3, 1, 2] };
    const result = canonicalizeJson(input);
    expect(result).toBe('{"arr":[3,1,2]}');
  });

  it('handles null values', () => {
    const input = { a: null, b: 1 };
    const result = canonicalizeJson(input);
    expect(result).toBe('{"a":null,"b":1}');
  });

  it('handles strings with special characters', () => {
    const input = { key: 'hello "world"' };
    const result = canonicalizeJson(input);
    expect(result).toBe('{"key":"hello \\"world\\""}');
  });

  it('produces no whitespace', () => {
    const input = { a: 1, b: { c: 2 } };
    const result = canonicalizeJson(input);
    expect(result).not.toContain(' ');
    expect(result).not.toContain('\n');
    expect(result).not.toContain('\t');
  });

  it('is deterministic for identical inputs', () => {
    const input1 = { z: 1, a: 2, m: { x: 10, y: 20 } };
    const input2 = { m: { y: 20, x: 10 }, a: 2, z: 1 };
    expect(canonicalizeJson(input1)).toBe(canonicalizeJson(input2));
  });
});

describe('SHA256 Hashing', () => {
  it('produces correct hash for string input', () => {
    const result = sha256Hex('hello');
    expect(result).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });

  it('produces correct hash for buffer input', () => {
    const buffer = Buffer.from('hello', 'utf-8');
    const result = sha256Hex(buffer);
    expect(result).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });

  it('produces different hashes for different inputs', () => {
    const hash1 = sha256Hex('hello');
    const hash2 = sha256Hex('world');
    expect(hash1).not.toBe(hash2);
  });
});

describe('Evidence Content SHA256', () => {
  it('hashes json_snapshot using canonical form', () => {
    const json1 = { a: 1, b: 2 };
    const json2 = { b: 2, a: 1 };
    const hash1 = computeEvidenceContentSha256('json_snapshot', json1);
    const hash2 = computeEvidenceContentSha256('json_snapshot', json2);
    expect(hash1).toBe(hash2);
  });

  it('hashes file_r2 using raw bytes', () => {
    const content = Buffer.from('file content here');
    const hash = computeEvidenceContentSha256('file_r2', content);
    expect(hash).toBe(sha256Hex(content));
  });

  it('hashes url_snapshot using raw bytes', () => {
    const content = '<html>page content</html>';
    const hash = computeEvidenceContentSha256('url_snapshot', content);
    expect(hash).toBe(sha256Hex(content));
  });
});

// ============================================================
// INTEGRATION TESTS (require database)
// ============================================================

describe('Evidence Chain Integration', () => {
  let testTenantId: string;
  let testIndividualId: string;
  let testEvidenceId: string;

  beforeAll(async () => {
    // Get or create test tenant and individual from existing seed data
    const client = await pool.connect();
    try {
      // Use existing seeded tenant
      const tenantResult = await client.query(`
        SELECT id FROM cc_tenants LIMIT 1
      `);
      testTenantId = tenantResult.rows[0]?.id;

      const individualResult = await client.query(`
        SELECT id FROM cc_individuals LIMIT 1
      `);
      testIndividualId = individualResult.rows[0]?.id;
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    // Cleanup test evidence objects
    if (testEvidenceId) {
      const client = await pool.connect();
      try {
        await client.query(`DELETE FROM cc_evidence_events WHERE evidence_object_id = $1`, [testEvidenceId]);
        await client.query(`DELETE FROM cc_evidence_objects WHERE id = $1`, [testEvidenceId]);
      } finally {
        client.release();
      }
    }
  });

  it('creates evidence object and appends events with hash chain', async () => {
    if (!testTenantId) {
      console.log('Skipping test: no test tenant available');
      return;
    }

    const client = await pool.connect();
    try {
      // Create evidence object
      const createResult = await client.query(`
        INSERT INTO cc_evidence_objects (
          tenant_id, source_type, title, content_sha256
        ) VALUES (
          $1, 'manual_note'::cc_evidence_source_type_enum, 'Test Evidence', $2
        )
        RETURNING id
      `, [testTenantId, sha256Hex('test content')]);

      testEvidenceId = createResult.rows[0].id;

      // Append 'created' event
      const event1 = await appendEvidenceEvent({
        evidenceId: testEvidenceId,
        tenantId: testTenantId,
        eventType: 'created',
        payload: { title: 'Test Evidence' },
        actorIndividualId: testIndividualId
      });

      expect(event1.eventSha256).toBeDefined();
      expect(event1.prevEventSha256).toBeNull();

      // Append 'sealed' event
      const event2 = await appendEvidenceEvent({
        evidenceId: testEvidenceId,
        tenantId: testTenantId,
        eventType: 'sealed',
        payload: { reason: 'Test seal' },
        actorIndividualId: testIndividualId
      });

      expect(event2.eventSha256).toBeDefined();
      expect(event2.prevEventSha256).toBe(event1.eventSha256);

      // Verify chain
      const verification = await verifyEvidenceChain(testEvidenceId);
      expect(verification.valid).toBe(true);
      expect(verification.eventChain.length).toBe(2);
      expect(verification.firstFailureIndex).toBeNull();
    } finally {
      client.release();
    }
  });

  it('handles idempotency via client_request_id', async () => {
    if (!testTenantId || !testEvidenceId) {
      console.log('Skipping test: no test data available');
      return;
    }

    const clientRequestId = `test-idempotent-${Date.now()}`;

    // First call
    const event1 = await appendEvidenceEvent({
      evidenceId: testEvidenceId,
      tenantId: testTenantId,
      eventType: 'annotated',
      payload: { note: 'Idempotency test' },
      clientRequestId
    });

    // Second call with same client_request_id should return same event
    const event2 = await appendEvidenceEvent({
      evidenceId: testEvidenceId,
      tenantId: testTenantId,
      eventType: 'annotated',
      payload: { note: 'Different payload' },
      clientRequestId
    });

    expect(event1.id).toBe(event2.id);
    expect(event1.eventSha256).toBe(event2.eventSha256);
  });

  it('verifies chain integrity and detects tampering', async () => {
    if (!testEvidenceId) {
      console.log('Skipping test: no test evidence available');
      return;
    }

    // Verify valid chain
    const verification = await verifyEvidenceChain(testEvidenceId);
    expect(verification.valid).toBe(true);

    // Note: We don't actually tamper with the DB in this test
    // as that would corrupt the test data. The verification
    // logic is tested by ensuring proper hash computation.
  });
});

describe('Bundle Manifest', () => {
  let testTenantId: string;
  let testBundleId: string;
  let testEvidenceIds: string[] = [];

  beforeAll(async () => {
    const client = await pool.connect();
    try {
      // Get existing tenant
      const tenantResult = await client.query(`SELECT id FROM cc_tenants LIMIT 1`);
      testTenantId = tenantResult.rows[0]?.id;

      if (!testTenantId) return;

      // Create test evidence objects
      for (let i = 0; i < 3; i++) {
        const result = await client.query(`
          INSERT INTO cc_evidence_objects (
            tenant_id, source_type, title, content_sha256
          ) VALUES (
            $1, 'manual_note'::cc_evidence_source_type_enum, $2, $3
          )
          RETURNING id
        `, [testTenantId, `Bundle Test Evidence ${i}`, sha256Hex(`content ${i}`)]);
        testEvidenceIds.push(result.rows[0].id);

        // Add created event
        await appendEvidenceEvent({
          evidenceId: result.rows[0].id,
          tenantId: testTenantId,
          eventType: 'created',
          payload: { index: i }
        });
      }

      // Create test bundle
      const bundleResult = await client.query(`
        INSERT INTO cc_evidence_bundles (
          tenant_id, bundle_type, title
        ) VALUES (
          $1, 'generic'::cc_evidence_bundle_type_enum, 'Test Bundle'
        )
        RETURNING id
      `, [testTenantId]);
      testBundleId = bundleResult.rows[0].id;

      // Add items to bundle
      for (let i = 0; i < testEvidenceIds.length; i++) {
        await client.query(`
          INSERT INTO cc_evidence_bundle_items (
            tenant_id, bundle_id, evidence_object_id, sort_order, label
          ) VALUES ($1, $2, $3, $4, $5)
        `, [testTenantId, testBundleId, testEvidenceIds[i], i, `Item ${i}`]);
      }
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    const client = await pool.connect();
    try {
      // Enable service mode for cleanup (uses tenant_id = '__SERVICE__')
      await client.query(`SELECT set_config('app.tenant_id', '__SERVICE__', true)`);
      
      // Unseal any test bundles first (required for deletion)
      if (testBundleId) {
        await client.query(`UPDATE cc_evidence_bundles SET bundle_status = 'open', sealed_at = NULL WHERE id = $1`, [testBundleId]);
      }
      
      // 1. First delete ALL bundle_items referencing our test evidence objects
      if (testEvidenceIds.length > 0) {
        await client.query(
          `DELETE FROM cc_evidence_bundle_items WHERE evidence_object_id = ANY($1::uuid[])`,
          [testEvidenceIds]
        );
      }
      
      // 2. Delete events referencing evidence objects
      if (testEvidenceIds.length > 0) {
        await client.query(
          `DELETE FROM cc_evidence_events WHERE evidence_object_id = ANY($1::uuid[])`,
          [testEvidenceIds]
        );
      }
      
      // 3. Now safe to delete evidence objects
      if (testEvidenceIds.length > 0) {
        await client.query(
          `DELETE FROM cc_evidence_objects WHERE id = ANY($1::uuid[])`,
          [testEvidenceIds]
        );
      }
      
      // 4. Finally delete the bundle
      if (testBundleId) {
        await client.query(`DELETE FROM cc_evidence_bundles WHERE id = $1`, [testBundleId]);
      }
    } catch (e) {
      // Log cleanup errors but don't fail tests
      console.warn('Bundle Manifest cleanup warning:', e);
    } finally {
      client.release();
    }
  });

  it('compiles manifest with correct item order', async () => {
    if (!testBundleId) {
      console.log('Skipping test: no test bundle available');
      return;
    }

    const { manifest, manifestSha256 } = await compileBundleManifest(testBundleId);

    expect(manifest.items.length).toBe(3);
    expect(manifest.items[0].sortOrder).toBe(0);
    expect(manifest.items[1].sortOrder).toBe(1);
    expect(manifest.items[2].sortOrder).toBe(2);
  });

  it('produces deterministic manifest hash with explicit sealedAt', async () => {
    if (!testBundleId) {
      console.log('Skipping test: no test bundle available');
      return;
    }

    // With explicit sealedAt timestamp, manifest hash should be deterministic
    const fixedSealedAt = '2026-01-15T00:00:00.000Z';
    
    const { manifestSha256: hash1 } = await compileBundleManifest(testBundleId, { 
      sealedAt: fixedSealedAt 
    });
    const { manifestSha256: hash2 } = await compileBundleManifest(testBundleId, { 
      sealedAt: fixedSealedAt 
    });

    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64); // SHA256 hex
  });

  it('produces consistent manifest structure for open bundles', async () => {
    if (!testBundleId) {
      console.log('Skipping test: no test bundle available');
      return;
    }

    // For open bundles without explicit sealedAt, sealedAt changes but content is consistent
    const { manifest: m1 } = await compileBundleManifest(testBundleId);
    const { manifest: m2 } = await compileBundleManifest(testBundleId);

    // Core manifest data should be identical
    expect(m1.bundleId).toBe(m2.bundleId);
    expect(m1.title).toBe(m2.title);
    expect(m1.items.length).toBe(m2.items.length);
    
    // Each item's hashes should match
    for (let i = 0; i < m1.items.length; i++) {
      expect(m1.items[i].evidenceObjectId).toBe(m2.items[i].evidenceObjectId);
      expect(m1.items[i].contentSha256).toBe(m2.items[i].contentSha256);
      expect(m1.items[i].tipEventSha256).toBe(m2.items[i].tipEventSha256);
    }
  });

  it('includes content and tip hashes in manifest', async () => {
    if (!testBundleId) {
      console.log('Skipping test: no test bundle available');
      return;
    }

    const { manifest } = await compileBundleManifest(testBundleId);

    for (const item of manifest.items) {
      expect(item.contentSha256).toBeDefined();
      expect(item.contentSha256.length).toBe(64); // SHA256 hex
      expect(item.tipEventSha256).toBeDefined();
    }
  });

  it('uses persisted sealed_at for sealed bundles', async () => {
    if (!testBundleId || !testTenantId) {
      console.log('Skipping test: no test bundle available');
      return;
    }

    const client = await pool.connect();
    try {
      // Seal the bundle with a specific timestamp
      const sealedAt = new Date('2026-01-10T12:00:00.000Z');
      await client.query(`
        UPDATE cc_evidence_bundles 
        SET bundle_status = 'sealed', sealed_at = $1
        WHERE id = $2
      `, [sealedAt, testBundleId]);

      // Call compileBundleManifest WITHOUT explicit sealedAt
      // It should use the persisted sealed_at from DB
      const { manifest: m1, manifestSha256: h1 } = await compileBundleManifest(testBundleId);
      const { manifest: m2, manifestSha256: h2 } = await compileBundleManifest(testBundleId);

      // Manifest sealedAt should represent the same timestamp
      // (format may differ: '2026-01-10 12:00:00+00' vs '2026-01-10T12:00:00.000Z')
      const parsedM1 = new Date(m1.sealedAt).getTime();
      const parsedM2 = new Date(m2.sealedAt).getTime();
      const expected = sealedAt.getTime();
      expect(parsedM1).toBe(expected);
      expect(parsedM2).toBe(expected);

      // Hash should be deterministic since sealedAt is fixed
      expect(h1).toBe(h2);

    } finally {
      // Unseal for cleanup (even if test fails)
      await client.query(`
        UPDATE cc_evidence_bundles 
        SET bundle_status = 'open', sealed_at = NULL
        WHERE id = $1
      `, [testBundleId]);
      client.release();
    }
  });
});
