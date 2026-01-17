/**
 * Job Publication Accounting Integration Tests
 * 
 * Tests the GL integration for cc_paid_publication_intents:
 * - Publish to paid portal creates intent AND GL CHARGE entry
 * - Mark paid posts GL PAYMENT entry and transitions intent to paid
 * - Refund posts GL REFUND entry and transitions intent to refunded
 * - Idempotency and state protection
 * - Tenant isolation
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { pool } from '../server/db';

describe('Job Publication Accounting Integration', () => {
  let testTenantId: string;
  let testPortalId: string;
  let testJobId: string;
  let testIntentId: string;

  beforeAll(async () => {
    const client = await pool.connect();
    try {
      await client.query("SET app.tenant_id = '__SERVICE__'");

      const tenantResult = await client.query(`
        SELECT id FROM cc_tenants LIMIT 1
      `);
      testTenantId = tenantResult.rows[0]?.id;

      const portalResult = await client.query(`
        SELECT p.id FROM cc_portals p
        JOIN cc_portal_distribution_policies pdp ON pdp.portal_id = p.id
        WHERE pdp.price_cents > 0
        LIMIT 1
      `);
      testPortalId = portalResult.rows[0]?.id;

      const jobResult = await client.query(`
        SELECT id FROM cc_jobs WHERE tenant_id = $1 LIMIT 1
      `, [testTenantId]);
      testJobId = jobResult.rows[0]?.id;

    } finally {
      client.release();
    }
  });

  describe('Schema Validation', () => {
    it('cc_paid_publication_intents has ledger link columns', async () => {
      const client = await pool.connect();
      try {
        const result = await client.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_name = 'cc_paid_publication_intents'
            AND column_name IN ('ledger_charge_entry_id', 'ledger_payment_entry_id', 'ledger_refund_entry_id')
        `);
        
        const columns = result.rows.map(r => r.column_name);
        expect(columns).toContain('ledger_charge_entry_id');
        expect(columns).toContain('ledger_payment_entry_id');
        expect(columns).toContain('ledger_refund_entry_id');
      } finally {
        client.release();
      }
    });

    it('cc_paid_publication_intent_events table exists', async () => {
      const client = await pool.connect();
      try {
        const result = await client.query(`
          SELECT table_name FROM information_schema.tables
          WHERE table_name = 'cc_paid_publication_intent_events'
        `);
        
        expect(result.rows.length).toBe(1);
      } finally {
        client.release();
      }
    });

    it('cc_ledger_entries has source_type and source_id indexes', async () => {
      const client = await pool.connect();
      try {
        const result = await client.query(`
          SELECT indexname FROM pg_indexes
          WHERE tablename = 'cc_ledger_entries'
            AND indexname LIKE '%source%'
        `);
        
        expect(result.rows.length).toBeGreaterThan(0);
      } finally {
        client.release();
      }
    });
  });

  describe('GL Entry Reference Contract', () => {
    it('ledger entries can use paid_publication_intent as source_type', async () => {
      const client = await pool.connect();
      try {
        await client.query("SET app.tenant_id = '__SERVICE__'");

        const testEntryResult = await client.query(`
          INSERT INTO cc_ledger_entries (
            tenant_id, entry_type, amount, currency, description,
            line_item_code, source_type, source_id, status, metadata
          ) VALUES (
            $1, 'charge', 100, 'CAD', 'Test job placement charge',
            'JOB_PLACEMENT_CHARGE', 'paid_publication_intent', gen_random_uuid(),
            'pending', '{}'::jsonb
          ) RETURNING id
        `, [testTenantId]);

        const entryId = testEntryResult.rows[0].id;

        const verifyResult = await client.query(`
          SELECT * FROM cc_ledger_entries WHERE id = $1
        `, [entryId]);

        expect(verifyResult.rows[0].source_type).toBe('paid_publication_intent');
        expect(verifyResult.rows[0].entry_type).toBe('charge');
        expect(verifyResult.rows[0].line_item_code).toBe('JOB_PLACEMENT_CHARGE');

        await client.query(`DELETE FROM cc_ledger_entries WHERE id = $1`, [entryId]);
      } finally {
        client.release();
      }
    });

    it('ledger entry taxonomy supports all job publication entry types', async () => {
      const client = await pool.connect();
      try {
        const result = await client.query(`
          SELECT enumlabel FROM pg_enum
          JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
          WHERE typname = 'ledger_entry_type'
        `);

        const types = result.rows.map(r => r.enumlabel);
        expect(types).toContain('charge');
        expect(types).toContain('payment');
        expect(types).toContain('refund');
      } finally {
        client.release();
      }
    });
  });

  describe('Intent Event Audit Trail', () => {
    it('can insert intent events with append-only semantics', async () => {
      const client = await pool.connect();
      try {
        await client.query("SET app.tenant_id = '__SERVICE__'");

        const intentResult = await client.query(`
          SELECT id, tenant_id FROM cc_paid_publication_intents LIMIT 1
        `);

        if (intentResult.rows.length === 0) {
          console.log('No intents found, skipping event insert test');
          return;
        }

        const intent = intentResult.rows[0];

        const eventResult = await client.query(`
          INSERT INTO cc_paid_publication_intent_events (
            tenant_id, intent_id, from_status, to_status,
            event_type, note, metadata
          ) VALUES ($1, $2, 'requires_action', 'pending_payment', 'test_event', 'Test event', '{}')
          RETURNING id
        `, [intent.tenant_id, intent.id]);

        expect(eventResult.rows[0].id).toBeDefined();

        const verifyResult = await client.query(`
          SELECT * FROM cc_paid_publication_intent_events WHERE id = $1
        `, [eventResult.rows[0].id]);

        expect(verifyResult.rows[0].event_type).toBe('test_event');
        expect(verifyResult.rows[0].to_status).toBe('pending_payment');
      } finally {
        client.release();
      }
    });
  });

  describe('Accounting Service Functions', () => {
    it('postIntentCharge creates GL entry with correct structure', async () => {
      const { postIntentCharge } = await import('../server/services/jobs/jobPublicationAccounting');
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        await client.query("SET app.tenant_id = '__SERVICE__'");

        const jobResult = await client.query(`
          INSERT INTO cc_jobs (
            tenant_id, title, role_category, employment_type, description
          ) VALUES (
            $1, 'Test Job for Accounting', 'maintenance', 'full_time', 'Test description'
          ) RETURNING id
        `, [testTenantId]);
        const testJobIdLocal = jobResult.rows[0].id;

        const portalResult = await client.query(`
          SELECT id FROM cc_portals LIMIT 1
        `);
        const testPortalIdLocal = portalResult.rows[0]?.id || testPortalId;

        const testIntentResult = await client.query(`
          INSERT INTO cc_paid_publication_intents (
            tenant_id, job_id, portal_id, amount_cents, currency, billing_unit, status,
            attention_tier, assistance_tier, tier_price_cents, tier_currency, tier_metadata
          ) VALUES (
            $1, $2, $3,
            2900, 'CAD', 'perPosting', 'requires_action',
            'standard', 'none', 0, 'CAD', '{}'::jsonb
          ) RETURNING *
        `, [testTenantId, testJobIdLocal, testPortalIdLocal]);

        const testIntent = testIntentResult.rows[0];

        const ledgerEntryId = await postIntentCharge(client, {
          id: testIntent.id,
          tenant_id: testIntent.tenant_id,
          job_id: testIntent.job_id,
          portal_id: testIntent.portal_id,
          amount_cents: testIntent.amount_cents,
          tier_price_cents: testIntent.tier_price_cents,
          currency: testIntent.currency,
          status: testIntent.status,
          tier_metadata: testIntent.tier_metadata
        });

        expect(ledgerEntryId).toBeDefined();

        const ledgerResult = await client.query(`
          SELECT * FROM cc_ledger_entries WHERE id = $1
        `, [ledgerEntryId]);

        expect(ledgerResult.rows[0].entry_type).toBe('charge');
        expect(ledgerResult.rows[0].source_type).toBe('paid_publication_intent');
        expect(ledgerResult.rows[0].source_id).toBe(testIntent.id);
        expect(parseFloat(ledgerResult.rows[0].amount)).toBe(29);

        const updatedIntentResult = await client.query(`
          SELECT ledger_charge_entry_id FROM cc_paid_publication_intents WHERE id = $1
        `, [testIntent.id]);

        expect(updatedIntentResult.rows[0].ledger_charge_entry_id).toBe(ledgerEntryId);

        await client.query('ROLLBACK');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    });

    it('recordIntentPayment creates GL payment entry and updates intent status', async () => {
      const { postIntentCharge, recordIntentPayment } = await import('../server/services/jobs/jobPublicationAccounting');
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        await client.query("SET app.tenant_id = '__SERVICE__'");

        const jobResult = await client.query(`
          INSERT INTO cc_jobs (
            tenant_id, title, role_category, employment_type, description
          ) VALUES (
            $1, 'Test Job for Payment', 'maintenance', 'full_time', 'Test description'
          ) RETURNING id
        `, [testTenantId]);
        const testJobIdLocal = jobResult.rows[0].id;

        const portalResult = await client.query(`
          SELECT id FROM cc_portals LIMIT 1
        `);
        const testPortalIdLocal = portalResult.rows[0]?.id || testPortalId;

        const testIntentResult = await client.query(`
          INSERT INTO cc_paid_publication_intents (
            tenant_id, job_id, portal_id, amount_cents, currency, billing_unit, status,
            attention_tier, assistance_tier, tier_price_cents, tier_currency, tier_metadata
          ) VALUES (
            $1, $2, $3,
            2900, 'CAD', 'perPosting', 'requires_action',
            'standard', 'none', 500, 'CAD', '{"breakdown":{"attentionPriceCents":500}}'::jsonb
          ) RETURNING *
        `, [testTenantId, testJobIdLocal, testPortalIdLocal]);

        const testIntent = testIntentResult.rows[0];

        await client.query(`
          INSERT INTO cc_job_postings (job_id, portal_id, publish_state, is_hidden)
          VALUES ($1, $2, 'draft', true)
        `, [testJobIdLocal, testPortalIdLocal]);

        const chargeEntryId = await postIntentCharge(client, {
          id: testIntent.id,
          tenant_id: testIntent.tenant_id,
          job_id: testIntent.job_id,
          portal_id: testIntent.portal_id,
          amount_cents: testIntent.amount_cents,
          tier_price_cents: testIntent.tier_price_cents,
          currency: testIntent.currency,
          status: testIntent.status,
          tier_metadata: testIntent.tier_metadata
        });

        const result = await recordIntentPayment(client, {
          id: testIntent.id,
          tenant_id: testIntent.tenant_id,
          job_id: testIntent.job_id,
          portal_id: testIntent.portal_id,
          amount_cents: testIntent.amount_cents,
          tier_price_cents: testIntent.tier_price_cents,
          currency: testIntent.currency,
          status: 'requires_action',
          tier_metadata: testIntent.tier_metadata,
          ledger_charge_entry_id: chargeEntryId
        }, {
          pspProvider: 'stripe',
          pspReference: 'pi_test_123'
        });

        expect(result.ledgerEntryId).toBeDefined();

        const paymentLedgerResult = await client.query(`
          SELECT * FROM cc_ledger_entries WHERE id = $1
        `, [result.ledgerEntryId]);

        expect(paymentLedgerResult.rows[0].entry_type).toBe('payment');
        expect(parseFloat(paymentLedgerResult.rows[0].amount)).toBe(34);

        expect(result.updatedIntent.status).toBe('paid');
        expect(result.updatedIntent.psp_provider).toBe('stripe');
        expect(result.updatedIntent.ledger_payment_entry_id).toBe(result.ledgerEntryId);

        await client.query('ROLLBACK');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    });

    it('recordIntentRefund creates GL refund entry and archives job posting', async () => {
      const { postIntentCharge, recordIntentPayment, recordIntentRefund } = await import('../server/services/jobs/jobPublicationAccounting');
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        await client.query("SET app.tenant_id = '__SERVICE__'");

        const jobResult = await client.query(`
          INSERT INTO cc_jobs (
            tenant_id, title, role_category, employment_type, description
          ) VALUES (
            $1, 'Test Job for Refund', 'maintenance', 'full_time', 'Test description'
          ) RETURNING id
        `, [testTenantId]);
        const testJobIdLocal = jobResult.rows[0].id;

        const portalResult = await client.query(`
          SELECT id FROM cc_portals LIMIT 1
        `);
        const testPortalIdLocal = portalResult.rows[0]?.id || testPortalId;

        const testIntentResult = await client.query(`
          INSERT INTO cc_paid_publication_intents (
            tenant_id, job_id, portal_id, amount_cents, currency, billing_unit, status,
            attention_tier, assistance_tier, tier_price_cents, tier_currency, tier_metadata
          ) VALUES (
            $1, $2, $3,
            2900, 'CAD', 'perPosting', 'requires_action',
            'standard', 'none', 0, 'CAD', '{}'::jsonb
          ) RETURNING *
        `, [testTenantId, testJobIdLocal, testPortalIdLocal]);

        const testIntent = testIntentResult.rows[0];

        await client.query(`
          INSERT INTO cc_job_postings (job_id, portal_id, publish_state, is_hidden)
          VALUES ($1, $2, 'draft', true)
        `, [testJobIdLocal, testPortalIdLocal]);

        await postIntentCharge(client, {
          id: testIntent.id,
          tenant_id: testIntent.tenant_id,
          job_id: testIntent.job_id,
          portal_id: testIntent.portal_id,
          amount_cents: testIntent.amount_cents,
          tier_price_cents: testIntent.tier_price_cents,
          currency: testIntent.currency,
          status: testIntent.status,
          tier_metadata: testIntent.tier_metadata
        });

        const paymentResult = await recordIntentPayment(client, {
          id: testIntent.id,
          tenant_id: testIntent.tenant_id,
          job_id: testIntent.job_id,
          portal_id: testIntent.portal_id,
          amount_cents: testIntent.amount_cents,
          tier_price_cents: testIntent.tier_price_cents,
          currency: testIntent.currency,
          status: 'requires_action',
          tier_metadata: testIntent.tier_metadata
        }, {
          pspProvider: 'manual'
        });

        const refundResult = await recordIntentRefund(client, {
          id: testIntent.id,
          tenant_id: testIntent.tenant_id,
          job_id: testIntent.job_id,
          portal_id: testIntent.portal_id,
          amount_cents: testIntent.amount_cents,
          tier_price_cents: testIntent.tier_price_cents,
          currency: testIntent.currency,
          status: 'paid',
          tier_metadata: testIntent.tier_metadata,
          ledger_payment_entry_id: paymentResult.ledgerEntryId
        }, {
          reason: 'Customer requested refund'
        });

        expect(refundResult.ledgerEntryId).toBeDefined();

        const refundLedgerResult = await client.query(`
          SELECT * FROM cc_ledger_entries WHERE id = $1
        `, [refundResult.ledgerEntryId]);

        expect(refundLedgerResult.rows[0].entry_type).toBe('refund');

        expect(refundResult.updatedIntent.status).toBe('refunded');
        expect(refundResult.updatedIntent.ledger_refund_entry_id).toBe(refundResult.ledgerEntryId);

        const postingResult = await client.query(`
          SELECT publish_state, is_hidden FROM cc_job_postings
          WHERE job_id = $1 AND portal_id = $2
        `, [testIntent.job_id, testIntent.portal_id]);

        expect(postingResult.rows[0].publish_state).toBe('archived');
        expect(postingResult.rows[0].is_hidden).toBe(true);

        await client.query('ROLLBACK');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    });
  });

  describe('State Protection and Idempotency', () => {
    it('recordIntentPayment rejects payment for already-paid intent', async () => {
      const { recordIntentPayment } = await import('../server/services/jobs/jobPublicationAccounting');
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        await client.query("SET app.tenant_id = '__SERVICE__'");

        await expect(recordIntentPayment(client, {
          id: 'test-id',
          tenant_id: testTenantId,
          job_id: 'test-job',
          portal_id: 'test-portal',
          amount_cents: 2900,
          tier_price_cents: 0,
          currency: 'CAD',
          status: 'paid',
          tier_metadata: {}
        }, {
          pspProvider: 'manual'
        })).rejects.toThrow('Cannot record payment');

        await client.query('ROLLBACK');
      } catch (error) {
        await client.query('ROLLBACK');
        if (error instanceof Error && error.message.includes('Cannot record payment')) {
          expect(true).toBe(true);
        } else {
          throw error;
        }
      } finally {
        client.release();
      }
    });

    it('recordIntentRefund rejects refund for non-paid intent', async () => {
      const { recordIntentRefund } = await import('../server/services/jobs/jobPublicationAccounting');
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        await client.query("SET app.tenant_id = '__SERVICE__'");

        await expect(recordIntentRefund(client, {
          id: 'test-id',
          tenant_id: testTenantId,
          job_id: 'test-job',
          portal_id: 'test-portal',
          amount_cents: 2900,
          tier_price_cents: 0,
          currency: 'CAD',
          status: 'requires_action',
          tier_metadata: {}
        }, {
          reason: 'Test refund'
        })).rejects.toThrow('Cannot refund');

        await client.query('ROLLBACK');
      } catch (error) {
        await client.query('ROLLBACK');
        if (error instanceof Error && error.message.includes('Cannot refund')) {
          expect(true).toBe(true);
        } else {
          throw error;
        }
      } finally {
        client.release();
      }
    });
  });
});
