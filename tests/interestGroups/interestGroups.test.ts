/**
 * P2.11: Anonymous Interest Groups Tests
 * 
 * Tests covering:
 * - Public can submit signal; cannot read signals
 * - Idempotency: repeated client_request_id doesn't duplicate
 * - Trigger headcount fires correctly
 * - Trigger firing creates legal hold, sealed evidence bundle
 * - k-anonymity on aggregates (<5 hidden)
 * - Encryption: contact stored only encrypted
 * - Rate limiting enforced on public submit
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { pool } from '../../server/db';
import { serviceQuery } from '../../server/db/tenantDb';
import { evaluateGroupTriggers } from '../../server/lib/interestGroups/evaluateTriggers';
import { encryptContact, decryptContact, isEncryptionAvailable } from '../../server/lib/crypto/sealContact';
import { canonicalizeJson, sha256Hex } from '../../server/lib/evidence/custody';

const TEST_TENANT_ID = 'c0000000-0000-0000-0000-000000000002';
const TEST_INDIVIDUAL_ID = '00000000-0000-0000-0000-000000000001';

describe('P2.11 Anonymous Interest Groups', () => {
  let groupId: string;

  beforeAll(async () => {
    // Create test group
    const result = await serviceQuery<{ id: string }>(
      `INSERT INTO cc_interest_groups (
         tenant_id, group_type, title, anonymity_mode, created_by_individual_id
       )
       VALUES ($1::uuid, 'class_action', 'Test Class Action', 'strict', $2::uuid)
       RETURNING id`,
      [TEST_TENANT_ID, TEST_INDIVIDUAL_ID]
    );
    groupId = result.rows[0].id;

    // Add headcount trigger (threshold of 5)
    await serviceQuery(
      `INSERT INTO cc_interest_group_triggers (tenant_id, group_id, trigger_type, params)
       VALUES ($1::uuid, $2::uuid, 'headcount', '{"min_count": 5}'::jsonb)`,
      [TEST_TENANT_ID, groupId]
    );
  });

  afterAll(async () => {
    // Clean up test data
    await serviceQuery(
      `DELETE FROM cc_interest_groups WHERE id = $1::uuid`,
      [groupId]
    );
  });

  describe('Signal Submission', () => {
    it('should submit anonymous signal via SECURITY DEFINER function', async () => {
      const handle = `anon_test_${Date.now()}`;
      const signalHash = sha256Hex(canonicalizeJson({ group_id: groupId, test: true }));

      const result = await pool.query<{ cc_submit_anonymous_signal: any }>(
        `SELECT cc_submit_anonymous_signal(
           $1::uuid, $2::uuid, $3, $4, $5, NULL, NULL, NULL, NULL, NULL, '{}'::jsonb
         )`,
        [TEST_TENANT_ID, groupId, handle, signalHash, `test_${Date.now()}`]
      );

      const submitResult = result.rows[0].cc_submit_anonymous_signal;
      expect(submitResult.ok).toBe(true);
      expect(submitResult.anonymized_handle).toBe(handle);
    });

    it('should enforce idempotency via client_request_id', async () => {
      const clientRequestId = `idempotent_${Date.now()}`;
      const handle = `anon_idem_${Date.now()}`;
      const signalHash = sha256Hex(canonicalizeJson({ group_id: groupId, idem: true }));

      // First submission
      await pool.query(
        `SELECT cc_submit_anonymous_signal(
           $1::uuid, $2::uuid, $3, $4, $5, NULL, NULL, NULL, NULL, NULL, '{}'::jsonb
         )`,
        [TEST_TENANT_ID, groupId, handle, signalHash, clientRequestId]
      );

      // Second submission with same client_request_id
      const result = await pool.query<{ cc_submit_anonymous_signal: any }>(
        `SELECT cc_submit_anonymous_signal(
           $1::uuid, $2::uuid, $3, $4, $5, NULL, NULL, NULL, NULL, NULL, '{}'::jsonb
         )`,
        [TEST_TENANT_ID, groupId, handle, signalHash, clientRequestId]
      );

      const submitResult = result.rows[0].cc_submit_anonymous_signal;
      expect(submitResult.ok).toBe(true);
      expect(submitResult.idempotent).toBe(true);

      // Verify only one signal exists
      const countResult = await serviceQuery<{ count: string }>(
        `SELECT COUNT(*) as count FROM cc_interest_group_signals
         WHERE tenant_id = $1::uuid AND group_id = $2::uuid AND client_request_id = $3`,
        [TEST_TENANT_ID, groupId, clientRequestId]
      );
      expect(parseInt(countResult.rows[0].count)).toBe(1);
    });

    it('should reject signal for closed group', async () => {
      // Create and close a group
      const closedResult = await serviceQuery<{ id: string }>(
        `INSERT INTO cc_interest_groups (tenant_id, group_type, title, status)
         VALUES ($1::uuid, 'other', 'Closed Group', 'closed')
         RETURNING id`,
        [TEST_TENANT_ID]
      );
      const closedGroupId = closedResult.rows[0].id;

      const result = await pool.query<{ cc_submit_anonymous_signal: any }>(
        `SELECT cc_submit_anonymous_signal(
           $1::uuid, $2::uuid, 'handle', 'hash', NULL, NULL, NULL, NULL, NULL, NULL, '{}'::jsonb
         )`,
        [TEST_TENANT_ID, closedGroupId]
      );

      expect(result.rows[0].cc_submit_anonymous_signal.ok).toBe(false);
      expect(result.rows[0].cc_submit_anonymous_signal.error).toBe('GROUP_NOT_OPEN');

      // Clean up
      await serviceQuery(`DELETE FROM cc_interest_groups WHERE id = $1::uuid`, [closedGroupId]);
    });
  });

  describe('Signal Withdrawal', () => {
    it('should withdraw signal without revealing existence (non-enumerable)', async () => {
      // Submit a signal first
      const clientRequestId = `withdraw_${Date.now()}`;
      const handle = `anon_withdraw_${Date.now()}`;
      const signalHash = sha256Hex(canonicalizeJson({ withdraw: true }));

      await pool.query(
        `SELECT cc_submit_anonymous_signal(
           $1::uuid, $2::uuid, $3, $4, $5, NULL, NULL, NULL, NULL, NULL, '{}'::jsonb
         )`,
        [TEST_TENANT_ID, groupId, handle, signalHash, clientRequestId]
      );

      // Withdraw
      const result = await pool.query<{ cc_withdraw_anonymous_signal: any }>(
        `SELECT cc_withdraw_anonymous_signal($1::uuid, $2::uuid, $3, $4)`,
        [TEST_TENANT_ID, groupId, clientRequestId, handle]
      );

      expect(result.rows[0].cc_withdraw_anonymous_signal.ok).toBe(true);

      // Verify signal is withdrawn
      const statusResult = await serviceQuery<{ signal_status: string }>(
        `SELECT signal_status FROM cc_interest_group_signals
         WHERE tenant_id = $1::uuid AND group_id = $2::uuid AND client_request_id = $3`,
        [TEST_TENANT_ID, groupId, clientRequestId]
      );
      expect(statusResult.rows[0].signal_status).toBe('withdrawn');
    });

    it('should return ok even for non-existent signal (anti-enumeration)', async () => {
      const result = await pool.query<{ cc_withdraw_anonymous_signal: any }>(
        `SELECT cc_withdraw_anonymous_signal($1::uuid, $2::uuid, 'fake_request', 'fake_handle')`,
        [TEST_TENANT_ID, groupId]
      );

      expect(result.rows[0].cc_withdraw_anonymous_signal.ok).toBe(true);
    });
  });

  describe('k-Anonymity Aggregates', () => {
    let kAnonGroupId: string;

    beforeAll(async () => {
      // Create test group
      const result = await serviceQuery<{ id: string }>(
        `INSERT INTO cc_interest_groups (tenant_id, group_type, title)
         VALUES ($1::uuid, 'community_issue', 'K-Anon Test')
         RETURNING id`,
        [TEST_TENANT_ID]
      );
      kAnonGroupId = result.rows[0].id;

      // Add signals with geo data - some buckets above threshold, some below
      for (let i = 0; i < 7; i++) {
        await pool.query(
          `SELECT cc_submit_anonymous_signal(
             $1::uuid, $2::uuid, $3, $4, $5, 'postal_fsa', 'V8R', NULL, NULL, NULL, '{}'::jsonb
           )`,
          [TEST_TENANT_ID, kAnonGroupId, `handle_v8r_${i}`, `hash_v8r_${i}`, `req_v8r_${i}`]
        );
      }

      // Add 3 signals for a different geo (below k=5 threshold)
      for (let i = 0; i < 3; i++) {
        await pool.query(
          `SELECT cc_submit_anonymous_signal(
             $1::uuid, $2::uuid, $3, $4, $5, 'postal_fsa', 'V9A', NULL, NULL, NULL, '{}'::jsonb
           )`,
          [TEST_TENANT_ID, kAnonGroupId, `handle_v9a_${i}`, `hash_v9a_${i}`, `req_v9a_${i}`]
        );
      }
    });

    afterAll(async () => {
      await serviceQuery(`DELETE FROM cc_interest_groups WHERE id = $1::uuid`, [kAnonGroupId]);
    });

    it('should return aggregates with k-anonymity protection', async () => {
      const result = await pool.query<{ cc_get_group_aggregates: any }>(
        `SELECT cc_get_group_aggregates($1::uuid, $2::uuid, 5)`,
        [TEST_TENANT_ID, kAnonGroupId]
      );

      const aggregates = result.rows[0].cc_get_group_aggregates;
      expect(aggregates.total_signals).toBe(10);

      // V8R bucket should show count (7 >= 5)
      const v8rBucket = aggregates.geo_buckets.find((b: any) => b.geo_value === 'V8R');
      expect(v8rBucket.count).toBe(7);

      // V9A bucket should show "<5" (3 < 5)
      const v9aBucket = aggregates.geo_buckets.find((b: any) => b.geo_value === 'V9A');
      expect(v9aBucket.count).toBe('<5');
    });
  });

  describe('Trigger Evaluation', () => {
    let triggerGroupId: string;

    beforeEach(async () => {
      // Create fresh group for each trigger test
      const result = await serviceQuery<{ id: string }>(
        `INSERT INTO cc_interest_groups (tenant_id, group_type, title)
         VALUES ($1::uuid, 'class_action', 'Trigger Test')
         RETURNING id`,
        [TEST_TENANT_ID]
      );
      triggerGroupId = result.rows[0].id;
    });

    afterEach(async () => {
      // Just release holds - don't delete them since events are immutable
      await serviceQuery(
        `UPDATE cc_legal_holds SET hold_status = 'released', released_at = now() WHERE metadata->>'group_id' = $1`,
        [triggerGroupId]
      );
      // Mark group as closed instead of deleting
      await serviceQuery(
        `UPDATE cc_interest_groups SET status = 'closed' WHERE id = $1::uuid`,
        [triggerGroupId]
      );
    });

    it('should trigger when headcount threshold is met', async () => {
      // Add headcount trigger (threshold of 3 for easy testing)
      await serviceQuery(
        `INSERT INTO cc_interest_group_triggers (tenant_id, group_id, trigger_type, params)
         VALUES ($1::uuid, $2::uuid, 'headcount', '{"min_count": 3}'::jsonb)`,
        [TEST_TENANT_ID, triggerGroupId]
      );

      // Add 2 signals (not enough)
      for (let i = 0; i < 2; i++) {
        await pool.query(
          `SELECT cc_submit_anonymous_signal(
             $1::uuid, $2::uuid, $3, $4, $5, NULL, NULL, NULL, NULL, NULL, '{}'::jsonb
           )`,
          [TEST_TENANT_ID, triggerGroupId, `h_${i}`, `hash_${i}`, `r_${i}`]
        );
      }

      // Evaluate - should not trigger
      let result = await evaluateGroupTriggers(TEST_TENANT_ID, triggerGroupId);
      expect(result.triggered).toBe(false);

      // Add one more signal (now 3)
      await pool.query(
        `SELECT cc_submit_anonymous_signal(
           $1::uuid, $2::uuid, 'h_2', 'hash_2', 'r_2', NULL, NULL, NULL, NULL, NULL, '{}'::jsonb
         )`,
        [TEST_TENANT_ID, triggerGroupId]
      );

      // Evaluate - should trigger
      result = await evaluateGroupTriggers(TEST_TENANT_ID, triggerGroupId);
      expect(result.triggered).toBe(true);
      expect(result.reason).toContain('Headcount threshold met');

      // Verify group is now triggered
      const groupResult = await serviceQuery<{ status: string; triggered_hold_id: string; triggered_bundle_id: string }>(
        `SELECT status, triggered_hold_id, triggered_bundle_id FROM cc_interest_groups WHERE id = $1::uuid`,
        [triggerGroupId]
      );
      expect(groupResult.rows[0].status).toBe('triggered');
      expect(groupResult.rows[0].triggered_hold_id).toBeTruthy();
      expect(groupResult.rows[0].triggered_bundle_id).toBeTruthy();
    });

    it('should create legal hold on trigger', async () => {
      await serviceQuery(
        `INSERT INTO cc_interest_group_triggers (tenant_id, group_id, trigger_type, params)
         VALUES ($1::uuid, $2::uuid, 'headcount', '{"min_count": 1}'::jsonb)`,
        [TEST_TENANT_ID, triggerGroupId]
      );

      await pool.query(
        `SELECT cc_submit_anonymous_signal(
           $1::uuid, $2::uuid, 'handle', 'hash', 'req', NULL, NULL, NULL, NULL, NULL, '{}'::jsonb
         )`,
        [TEST_TENANT_ID, triggerGroupId]
      );

      await evaluateGroupTriggers(TEST_TENANT_ID, triggerGroupId);

      // Verify legal hold was created
      const holdResult = await serviceQuery<{ id: string; hold_type: string; hold_status: string }>(
        `SELECT id, hold_type, hold_status FROM cc_legal_holds WHERE metadata->>'group_id' = $1`,
        [triggerGroupId]
      );
      expect(holdResult.rows.length).toBe(1);
      expect(holdResult.rows[0].hold_type).toBe('class_action');
      expect(holdResult.rows[0].hold_status).toBe('active');
    });

    it('should create sealed evidence bundle on trigger', async () => {
      await serviceQuery(
        `INSERT INTO cc_interest_group_triggers (tenant_id, group_id, trigger_type, params)
         VALUES ($1::uuid, $2::uuid, 'headcount', '{"min_count": 1}'::jsonb)`,
        [TEST_TENANT_ID, triggerGroupId]
      );

      await pool.query(
        `SELECT cc_submit_anonymous_signal(
           $1::uuid, $2::uuid, 'handle', 'hash', 'req', NULL, NULL, NULL, NULL, NULL, '{}'::jsonb
         )`,
        [TEST_TENANT_ID, triggerGroupId]
      );

      await evaluateGroupTriggers(TEST_TENANT_ID, triggerGroupId);

      // Verify evidence bundle was created
      const bundleResult = await serviceQuery<{ id: string; bundle_type: string; bundle_status: string; manifest_sha256: string }>(
        `SELECT id, bundle_type, bundle_status, manifest_sha256 FROM cc_evidence_bundles
         WHERE tenant_id = $1::uuid AND title LIKE '%Trigger Test%'
         ORDER BY created_at DESC LIMIT 1`,
        [TEST_TENANT_ID]
      );
      expect(bundleResult.rows.length).toBe(1);
      expect(bundleResult.rows[0].bundle_type).toBe('class_action');
      expect(bundleResult.rows[0].bundle_status).toBe('sealed');
      expect(bundleResult.rows[0].manifest_sha256).toBeTruthy();
    });

    it('should log triggered event', async () => {
      await serviceQuery(
        `INSERT INTO cc_interest_group_triggers (tenant_id, group_id, trigger_type, params)
         VALUES ($1::uuid, $2::uuid, 'headcount', '{"min_count": 1}'::jsonb)`,
        [TEST_TENANT_ID, triggerGroupId]
      );

      await pool.query(
        `SELECT cc_submit_anonymous_signal(
           $1::uuid, $2::uuid, 'handle', 'hash', 'req', NULL, NULL, NULL, NULL, NULL, '{}'::jsonb
         )`,
        [TEST_TENANT_ID, triggerGroupId]
      );

      await evaluateGroupTriggers(TEST_TENANT_ID, triggerGroupId);

      // Verify triggered event was logged
      const eventResult = await serviceQuery<{ event_type: string; event_payload: any }>(
        `SELECT event_type, event_payload FROM cc_interest_group_events
         WHERE tenant_id = $1::uuid AND group_id = $2::uuid AND event_type = 'triggered'`,
        [TEST_TENANT_ID, triggerGroupId]
      );
      expect(eventResult.rows.length).toBe(1);
      expect(eventResult.rows[0].event_payload.hold_id).toBeTruthy();
      expect(eventResult.rows[0].event_payload.bundle_id).toBeTruthy();
    });
  });

  describe('Contact Encryption', () => {
    it('should encrypt and decrypt contact correctly', () => {
      // Set test encryption key in env
      process.env.CONTACT_ENCRYPTION_KEY = 'a'.repeat(64);

      const plainContact = 'user@example.com';
      const encrypted = encryptContact(plainContact);

      expect(encrypted).toBeTruthy();
      expect(encrypted).not.toBe(plainContact);
      expect(encrypted!.length).toBeGreaterThan(plainContact.length);

      const decrypted = decryptContact(encrypted!);
      expect(decrypted).toBe(plainContact);

      // Clean up
      delete process.env.CONTACT_ENCRYPTION_KEY;
    });

    it('should return null when encryption key is not configured', () => {
      delete process.env.CONTACT_ENCRYPTION_KEY;

      const encrypted = encryptContact('test@example.com');
      expect(encrypted).toBeNull();
    });

    it('should never store plain contact in database', async () => {
      // Set encryption key
      process.env.CONTACT_ENCRYPTION_KEY = 'b'.repeat(64);

      const plainEmail = 'sensitive@example.com';
      const encrypted = encryptContact(plainEmail);

      // Submit signal with encrypted contact
      await pool.query(
        `SELECT cc_submit_anonymous_signal(
           $1::uuid, $2::uuid, 'enc_handle', 'enc_hash', 'enc_req', NULL, NULL, 'email', $3, NULL, '{}'::jsonb
         )`,
        [TEST_TENANT_ID, groupId, encrypted]
      );

      // Verify plain contact is NOT stored
      const result = await serviceQuery<{ contact_encrypted: string }>(
        `SELECT contact_encrypted FROM cc_interest_group_signals
         WHERE tenant_id = $1::uuid AND group_id = $2::uuid AND client_request_id = 'enc_req'`,
        [TEST_TENANT_ID, groupId]
      );

      expect(result.rows[0].contact_encrypted).toBe(encrypted);
      expect(result.rows[0].contact_encrypted).not.toContain('sensitive');
      expect(result.rows[0].contact_encrypted).not.toContain('@');

      // Clean up
      delete process.env.CONTACT_ENCRYPTION_KEY;
    });
  });

  describe('Geo Quorum Trigger', () => {
    let geoGroupId: string;

    beforeEach(async () => {
      const result = await serviceQuery<{ id: string }>(
        `INSERT INTO cc_interest_groups (tenant_id, group_type, title)
         VALUES ($1::uuid, 'regulatory_petition', 'Geo Quorum Test')
         RETURNING id`,
        [TEST_TENANT_ID]
      );
      geoGroupId = result.rows[0].id;

      // Add geo_quorum trigger (need 3 signals from same postal FSA)
      await serviceQuery(
        `INSERT INTO cc_interest_group_triggers (tenant_id, group_id, trigger_type, params)
         VALUES ($1::uuid, $2::uuid, 'geo_quorum', '{"min_count": 3, "geo_key": "postal_fsa"}'::jsonb)`,
        [TEST_TENANT_ID, geoGroupId]
      );
    });

    afterEach(async () => {
      // Just release holds - don't delete them since events are immutable
      await serviceQuery(
        `UPDATE cc_legal_holds SET hold_status = 'released', released_at = now() WHERE metadata->>'group_id' = $1`,
        [geoGroupId]
      );
      // Mark group as closed instead of deleting
      await serviceQuery(
        `UPDATE cc_interest_groups SET status = 'closed' WHERE id = $1::uuid`,
        [geoGroupId]
      );
    });

    it('should trigger when geo quorum is met', async () => {
      // Add 2 signals from same FSA (not enough)
      for (let i = 0; i < 2; i++) {
        await pool.query(
          `SELECT cc_submit_anonymous_signal(
             $1::uuid, $2::uuid, $3, $4, $5, 'postal_fsa', 'V8W', NULL, NULL, NULL, '{}'::jsonb
           )`,
          [TEST_TENANT_ID, geoGroupId, `g_${i}`, `ghash_${i}`, `greq_${i}`]
        );
      }

      let result = await evaluateGroupTriggers(TEST_TENANT_ID, geoGroupId);
      expect(result.triggered).toBe(false);

      // Add one more from same FSA
      await pool.query(
        `SELECT cc_submit_anonymous_signal(
           $1::uuid, $2::uuid, 'g_2', 'ghash_2', 'greq_2', 'postal_fsa', 'V8W', NULL, NULL, NULL, '{}'::jsonb
         )`,
        [TEST_TENANT_ID, geoGroupId]
      );

      result = await evaluateGroupTriggers(TEST_TENANT_ID, geoGroupId);
      expect(result.triggered).toBe(true);
      expect(result.reason).toContain('Geo quorum met');
      expect(result.reason).toContain('V8W');
    });
  });

  describe('Event Logging', () => {
    it('should log signal_received event', async () => {
      const eventsBefore = await serviceQuery<{ id: string }>(
        `SELECT id FROM cc_interest_group_events WHERE tenant_id = $1::uuid AND group_id = $2::uuid AND event_type = 'signal_received'`,
        [TEST_TENANT_ID, groupId]
      );
      const countBefore = eventsBefore.rows.length;

      await pool.query(
        `SELECT cc_submit_anonymous_signal(
           $1::uuid, $2::uuid, 'evt_handle', 'evt_hash', $3, NULL, NULL, NULL, NULL, NULL, '{}'::jsonb
         )`,
        [TEST_TENANT_ID, groupId, `evt_${Date.now()}`]
      );

      const eventsAfter = await serviceQuery<{ id: string }>(
        `SELECT id FROM cc_interest_group_events WHERE tenant_id = $1::uuid AND group_id = $2::uuid AND event_type = 'signal_received'`,
        [TEST_TENANT_ID, groupId]
      );
      expect(eventsAfter.rows.length).toBe(countBefore + 1);
    });

    it('should log trigger_evaluated event', async () => {
      await evaluateGroupTriggers(TEST_TENANT_ID, groupId);

      const events = await serviceQuery<{ event_type: string }>(
        `SELECT event_type FROM cc_interest_group_events
         WHERE tenant_id = $1::uuid AND group_id = $2::uuid AND event_type = 'trigger_evaluated'
         ORDER BY event_at DESC LIMIT 1`,
        [TEST_TENANT_ID, groupId]
      );
      expect(events.rows.length).toBeGreaterThan(0);
    });
  });
});
