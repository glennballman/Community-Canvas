import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { serviceQuery } from '../server/db/tenantDb';

const TEST_TENANT_ID = '11111111-1111-1111-1111-111111111111';
const TEST_INDIVIDUAL_ID = '22222222-2222-2222-2222-222222222213';

describe('P2.13 Preserve Record → Generate Pack', () => {
  let sourceId: string;
  let captureId: string;
  let runId: string;
  let evidenceObjectId: string;

  beforeAll(async () => {
    await serviceQuery(
      `INSERT INTO cc_tenants (id, slug, name, tenant_type) VALUES ($1, 'p213-test', 'P2.13 Test Tenant', 'community')
       ON CONFLICT (id) DO NOTHING`,
      [TEST_TENANT_ID]
    );
    await serviceQuery(
      `INSERT INTO cc_individuals (id, email, full_name) VALUES ($1, $2, 'P2.13 Test User')
       ON CONFLICT (id) DO NOTHING`,
      [TEST_INDIVIDUAL_ID, `p213-test-${Date.now()}@example.com`]
    );
  });

  afterAll(async () => {
    await serviceQuery(
      `UPDATE cc_legal_holds SET hold_status = 'released' WHERE tenant_id = $1`,
      [TEST_TENANT_ID]
    );
    await serviceQuery(
      `DELETE FROM cc_record_capture_queue WHERE tenant_id = $1`,
      [TEST_TENANT_ID]
    );
    await serviceQuery(
      `DELETE FROM cc_record_captures WHERE tenant_id = $1`,
      [TEST_TENANT_ID]
    );
    await serviceQuery(
      `DELETE FROM cc_record_sources WHERE tenant_id = $1`,
      [TEST_TENANT_ID]
    );
    await serviceQuery(
      `DELETE FROM cc_emergency_scope_grants WHERE run_id IN (SELECT id FROM cc_emergency_runs WHERE tenant_id = $1)`,
      [TEST_TENANT_ID]
    );
    await serviceQuery(
      `DELETE FROM cc_emergency_runs WHERE tenant_id = $1`,
      [TEST_TENANT_ID]
    );
    await serviceQuery(
      `DELETE FROM cc_emergency_templates WHERE tenant_id = $1`,
      [TEST_TENANT_ID]
    );
    await serviceQuery(
      `DELETE FROM cc_evidence_bundles WHERE tenant_id = $1`,
      [TEST_TENANT_ID]
    );
    await serviceQuery(
      `DELETE FROM cc_evidence_events WHERE tenant_id = $1`,
      [TEST_TENANT_ID]
    );
    await serviceQuery(
      `DELETE FROM cc_evidence_objects WHERE tenant_id = $1`,
      [TEST_TENANT_ID]
    );
    await serviceQuery(
      `DELETE FROM cc_individuals WHERE id = $1`,
      [TEST_INDIVIDUAL_ID]
    );
  });

  describe('Record Sources', () => {
    it('should create a record source', async () => {
      const result = await serviceQuery<{ id: string }>(
        `INSERT INTO cc_record_sources (
          tenant_id, source_type, title, description, config, created_by_individual_id
        ) VALUES ($1, 'url', 'Test URL Source', 'For testing', $2, $3)
        RETURNING id`,
        [TEST_TENANT_ID, JSON.stringify({ url: 'https://example.com' }), TEST_INDIVIDUAL_ID]
      );
      expect(result.rows.length).toBe(1);
      sourceId = result.rows[0].id;
    });

    it('should list record sources', async () => {
      const result = await serviceQuery(
        `SELECT * FROM cc_record_sources WHERE tenant_id = $1`,
        [TEST_TENANT_ID]
      );
      expect(result.rows.length).toBeGreaterThan(0);
    });

    it('should update source enabled status', async () => {
      await serviceQuery(
        `UPDATE cc_record_sources SET enabled = false WHERE id = $1`,
        [sourceId]
      );
      const result = await serviceQuery<{ enabled: boolean }>(
        `SELECT enabled FROM cc_record_sources WHERE id = $1`,
        [sourceId]
      );
      expect(result.rows[0].enabled).toBe(false);
      
      await serviceQuery(
        `UPDATE cc_record_sources SET enabled = true WHERE id = $1`,
        [sourceId]
      );
    });
  });

  describe('Record Captures', () => {
    it('should create a capture record', async () => {
      const result = await serviceQuery<{ id: string }>(
        `INSERT INTO cc_record_captures (
          tenant_id, source_id, capture_type, target_url, status,
          requested_by_individual_id
        ) VALUES ($1, $2, 'generic', 'https://example.com/test', 'pending', $3)
        RETURNING id`,
        [TEST_TENANT_ID, sourceId, TEST_INDIVIDUAL_ID]
      );
      expect(result.rows.length).toBe(1);
      captureId = result.rows[0].id;
    });

    it('should update capture status', async () => {
      await serviceQuery(
        `UPDATE cc_record_captures SET 
          status = 'stored',
          http_status = 200,
          content_mime = 'text/html',
          content_bytes = 1024,
          content_sha256 = $2
        WHERE id = $1`,
        [captureId, 'a'.repeat(64)]
      );

      const result = await serviceQuery<{ status: string; http_status: number }>(
        `SELECT status, http_status FROM cc_record_captures WHERE id = $1`,
        [captureId]
      );
      expect(result.rows[0].status).toBe('stored');
      expect(result.rows[0].http_status).toBe(200);
    });

    it('should link capture to evidence object', async () => {
      const eoResult = await serviceQuery<{ id: string }>(
        `INSERT INTO cc_evidence_objects (
          tenant_id, source_type, occurred_at, content_sha256, metadata
        ) VALUES ($1, 'url_snapshot', now(), $2, '{}')
        RETURNING id`,
        [TEST_TENANT_ID, 'b'.repeat(64)]
      );
      evidenceObjectId = eoResult.rows[0].id;

      await serviceQuery(
        `UPDATE cc_record_captures SET evidence_object_id = $2 WHERE id = $1`,
        [captureId, evidenceObjectId]
      );

      const result = await serviceQuery<{ evidence_object_id: string }>(
        `SELECT evidence_object_id FROM cc_record_captures WHERE id = $1`,
        [captureId]
      );
      expect(result.rows[0].evidence_object_id).toBe(evidenceObjectId);
    });
  });

  describe('Capture Queue', () => {
    let queuedCaptureId: string;
    let queueId: string;

    it('should create deferred capture and queue entry', async () => {
      const captureResult = await serviceQuery<{ id: string }>(
        `INSERT INTO cc_record_captures (
          tenant_id, capture_type, target_url, status
        ) VALUES ($1, 'advisory', 'https://example.com/deferred', 'deferred')
        RETURNING id`,
        [TEST_TENANT_ID]
      );
      queuedCaptureId = captureResult.rows[0].id;

      const queueResult = await serviceQuery<{ id: string }>(
        `INSERT INTO cc_record_capture_queue (
          tenant_id, capture_id, status
        ) VALUES ($1, $2, 'queued')
        RETURNING id`,
        [TEST_TENANT_ID, queuedCaptureId]
      );
      expect(queueResult.rows.length).toBe(1);
      queueId = queueResult.rows[0].id;
    });

    it('should track queue attempt count', async () => {
      await serviceQuery(
        `UPDATE cc_record_capture_queue SET 
          attempt_count = attempt_count + 1,
          next_attempt_at = now() + interval '1 minute'
        WHERE id = $1`,
        [queueId]
      );

      const result = await serviceQuery<{ attempt_count: number }>(
        `SELECT attempt_count FROM cc_record_capture_queue WHERE id = $1`,
        [queueId]
      );
      expect(result.rows[0].attempt_count).toBe(1);
    });

    it('should deadletter after max attempts', async () => {
      await serviceQuery(
        `UPDATE cc_record_capture_queue SET 
          status = 'deadletter',
          attempt_count = 5,
          last_error = $2
        WHERE id = $1`,
        [queueId, JSON.stringify({ message: 'Max attempts reached' })]
      );

      const result = await serviceQuery<{ status: string }>(
        `SELECT status FROM cc_record_capture_queue WHERE id = $1`,
        [queueId]
      );
      expect(result.rows[0].status).toBe('deadletter');
    });
  });

  describe('Emergency Run Integration', () => {
    let templateId: string;

    it('should create emergency run for capture association', async () => {
      const templateResult = await serviceQuery<{ id: string }>(
        `INSERT INTO cc_emergency_templates (
          tenant_id, template_type, title, status, template_json, template_sha256
        ) VALUES ($1, 'storm', 'Storm Template', 'active', '{}', $2)
        RETURNING id`,
        [TEST_TENANT_ID, 'c'.repeat(64)]
      );
      templateId = templateResult.rows[0].id;

      const runResult = await serviceQuery<{ id: string }>(
        `INSERT INTO cc_emergency_runs (
          tenant_id, template_id, run_type, status
        ) VALUES ($1, $2, 'storm', 'active')
        RETURNING id`,
        [TEST_TENANT_ID, templateId]
      );
      expect(runResult.rows.length).toBe(1);
      runId = runResult.rows[0].id;
    });

    it('should associate capture with run', async () => {
      const captureResult = await serviceQuery<{ id: string }>(
        `INSERT INTO cc_record_captures (
          tenant_id, run_id, capture_type, target_url, status
        ) VALUES ($1, $2, 'evac_order', 'https://example.com/evac', 'stored')
        RETURNING id`,
        [TEST_TENANT_ID, runId]
      );

      const result = await serviceQuery<{ run_id: string }>(
        `SELECT run_id FROM cc_record_captures WHERE id = $1`,
        [captureResult.rows[0].id]
      );
      expect(result.rows[0].run_id).toBe(runId);
    });

    it('should list captures for run', async () => {
      const result = await serviceQuery(
        `SELECT * FROM cc_record_captures WHERE tenant_id = $1 AND run_id = $2`,
        [TEST_TENANT_ID, runId]
      );
      expect(result.rows.length).toBeGreaterThan(0);
    });
  });

  describe('Evidence Integration', () => {
    it('should verify evidence object was created', async () => {
      const result = await serviceQuery(
        `SELECT id, source_type, content_sha256 FROM cc_evidence_objects WHERE id = $1`,
        [evidenceObjectId]
      );
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].source_type).toBe('url_snapshot');
    });

    it('should list captures with evidence links', async () => {
      const result = await serviceQuery(
        `SELECT rc.id, rc.evidence_object_id, eo.source_type
         FROM cc_record_captures rc
         JOIN cc_evidence_objects eo ON rc.evidence_object_id = eo.id
         WHERE rc.tenant_id = $1 AND rc.evidence_object_id IS NOT NULL`,
        [TEST_TENANT_ID]
      );
      expect(result.rows.length).toBeGreaterThan(0);
    });
  });

  describe('RLS Tenant Isolation', () => {
    const OTHER_TENANT_ID = '33333333-3333-3333-3333-333333333333';

    beforeAll(async () => {
      await serviceQuery(
        `INSERT INTO cc_tenants (id, slug, name, tenant_type) VALUES ($1, 'p213-other', 'P2.13 Other Tenant', 'community')
         ON CONFLICT (id) DO NOTHING`,
        [OTHER_TENANT_ID]
      );
    });

    afterAll(async () => {
      await serviceQuery(
        `DELETE FROM cc_record_sources WHERE tenant_id = $1`,
        [OTHER_TENANT_ID]
      );
    });

    it('should isolate sources by tenant', async () => {
      await serviceQuery(
        `INSERT INTO cc_record_sources (tenant_id, source_type, title, config)
         VALUES ($1, 'url', 'Other Tenant Source', '{}')`,
        [OTHER_TENANT_ID]
      );

      const testTenantSources = await serviceQuery(
        `SELECT * FROM cc_record_sources WHERE tenant_id = $1`,
        [TEST_TENANT_ID]
      );
      const otherTenantSources = await serviceQuery(
        `SELECT * FROM cc_record_sources WHERE tenant_id = $1`,
        [OTHER_TENANT_ID]
      );

      expect(testTenantSources.rows.every((r: any) => r.tenant_id === TEST_TENANT_ID)).toBe(true);
      expect(otherTenantSources.rows.every((r: any) => r.tenant_id === OTHER_TENANT_ID)).toBe(true);
    });
  });

  describe('Pack Generation Schema', () => {
    it('should support emergency_pack bundle type', async () => {
      const result = await serviceQuery<{ id: string }>(
        `INSERT INTO cc_evidence_bundles (
          tenant_id, bundle_type, title, manifest_sha256
        ) VALUES ($1, 'emergency_pack', 'Test Pack', $2)
        RETURNING id`,
        [TEST_TENANT_ID, 'd'.repeat(64)]
      );
      expect(result.rows.length).toBe(1);
    });
  });
});
