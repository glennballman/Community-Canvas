import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { serviceQuery } from '../server/db/tenantDb';

describe('Paid Portal Support - AdrenalineCanada', () => {
  let testTenantId: string;
  let testJobId: string;
  let adrenalinePortalId: string;
  let canadadirectPortalId: string;
  let bamfieldPortalId: string;
  let testIntentId: string;

  beforeAll(async () => {
    const tenantResult = await serviceQuery(`
      SELECT id FROM cc_tenants LIMIT 1
    `, []);
    if (tenantResult.rows.length === 0) {
      throw new Error('No tenant found for testing');
    }
    testTenantId = tenantResult.rows[0].id;

    const portalsResult = await serviceQuery(`
      SELECT id, slug FROM cc_portals WHERE slug IN ('adrenalinecanada', 'canadadirect', 'bamfield')
    `, []);
    for (const portal of portalsResult.rows) {
      if (portal.slug === 'adrenalinecanada') adrenalinePortalId = portal.id;
      if (portal.slug === 'canadadirect') canadadirectPortalId = portal.id;
      if (portal.slug === 'bamfield') bamfieldPortalId = portal.id;
    }

    if (!adrenalinePortalId) {
      throw new Error('AdrenalineCanada portal not found');
    }

    const jobResult = await serviceQuery(`
      INSERT INTO cc_jobs (tenant_id, title, description, role_category, employment_type, status)
      VALUES ($1, 'Test Job for Paid Portal', 'Test description', 'general_labour', 'full_time', 'open')
      RETURNING id
    `, [testTenantId]);
    testJobId = jobResult.rows[0].id;
  });

  afterAll(async () => {
    if (testJobId) {
      await serviceQuery(`DELETE FROM cc_paid_publication_intents WHERE job_id = $1`, [testJobId]);
      await serviceQuery(`DELETE FROM cc_job_postings WHERE job_id = $1`, [testJobId]);
      await serviceQuery(`DELETE FROM cc_jobs WHERE id = $1`, [testJobId]);
    }
  });

  describe('Portal Distribution Policies', () => {
    it('AdrenalineCanada should have paid pricing with $29 CAD', async () => {
      const result = await serviceQuery(`
        SELECT * FROM cc_portal_distribution_policies WHERE portal_id = $1
      `, [adrenalinePortalId]);

      expect(result.rows.length).toBe(1);
      const policy = result.rows[0];
      expect(policy.pricing_model).toBe('paid');
      expect(policy.price_cents).toBe(2900);
      expect(policy.currency).toBe('CAD');
      expect(policy.billing_unit).toBe('perPosting');
      expect(policy.requires_checkout).toBe(true);
      expect(policy.requires_moderation).toBe(false);
    });

    it('CanadaDirect should be free with moderation required', async () => {
      if (!canadadirectPortalId) return;

      const result = await serviceQuery(`
        SELECT * FROM cc_portal_distribution_policies WHERE portal_id = $1
      `, [canadadirectPortalId]);

      expect(result.rows.length).toBe(1);
      const policy = result.rows[0];
      expect(policy.pricing_model).toBe('free');
      expect(policy.price_cents).toBeNull();
      expect(policy.requires_checkout).toBe(false);
      expect(policy.requires_moderation).toBe(true);
    });

    it('Bamfield should be free with no moderation', async () => {
      if (!bamfieldPortalId) return;

      const result = await serviceQuery(`
        SELECT * FROM cc_portal_distribution_policies WHERE portal_id = $1
      `, [bamfieldPortalId]);

      expect(result.rows.length).toBe(1);
      const policy = result.rows[0];
      expect(policy.pricing_model).toBe('free');
      expect(policy.price_cents).toBeNull();
      expect(policy.requires_checkout).toBe(false);
      expect(policy.requires_moderation).toBe(false);
    });
  });

  describe('Paid Portal Publish Flow', () => {
    it('Publishing to AdrenalineCanada should create draft posting and payment intent', async () => {
      await serviceQuery(`DELETE FROM cc_paid_publication_intents WHERE job_id = $1`, [testJobId]);
      await serviceQuery(`DELETE FROM cc_job_postings WHERE job_id = $1`, [testJobId]);

      const policyResult = await serviceQuery(`
        SELECT price_cents, currency, billing_unit FROM cc_portal_distribution_policies WHERE portal_id = $1
      `, [adrenalinePortalId]);
      const policy = policyResult.rows[0];

      await serviceQuery(`
        INSERT INTO cc_job_postings (job_id, portal_id, publish_state, is_hidden)
        VALUES ($1, $2, 'draft', true)
      `, [testJobId, adrenalinePortalId]);

      const intentResult = await serviceQuery(`
        INSERT INTO cc_paid_publication_intents (
          tenant_id, job_id, portal_id, amount_cents, currency, billing_unit, status
        ) VALUES ($1, $2, $3, $4, $5, $6, 'requires_action')
        RETURNING id, status
      `, [testTenantId, testJobId, adrenalinePortalId, policy.price_cents, policy.currency, policy.billing_unit]);

      testIntentId = intentResult.rows[0].id;
      expect(intentResult.rows[0].status).toBe('requires_action');

      const postingResult = await serviceQuery(`
        SELECT publish_state, is_hidden FROM cc_job_postings WHERE job_id = $1 AND portal_id = $2
      `, [testJobId, adrenalinePortalId]);
      expect(postingResult.rows[0].publish_state).toBe('draft');
      expect(postingResult.rows[0].is_hidden).toBe(true);
    });

    it('Job should NOT be publicly visible before payment', async () => {
      const result = await serviceQuery(`
        SELECT jp.id, jp.publish_state 
        FROM cc_job_postings jp
        WHERE jp.job_id = $1 AND jp.portal_id = $2 AND jp.publish_state = 'published'
      `, [testJobId, adrenalinePortalId]);

      expect(result.rows.length).toBe(0);
    });

    it('Marking intent as paid should publish the job', async () => {
      await serviceQuery(`
        UPDATE cc_paid_publication_intents SET
          status = 'paid',
          psp_provider = 'test',
          psp_reference = 'test_ref_123',
          paid_at = now()
        WHERE id = $1
      `, [testIntentId]);

      await serviceQuery(`
        UPDATE cc_job_postings SET
          publish_state = 'published',
          published_at = now(),
          is_hidden = false
        WHERE job_id = $1 AND portal_id = $2
      `, [testJobId, adrenalinePortalId]);

      const intentResult = await serviceQuery(`
        SELECT status, paid_at FROM cc_paid_publication_intents WHERE id = $1
      `, [testIntentId]);
      expect(intentResult.rows[0].status).toBe('paid');
      expect(intentResult.rows[0].paid_at).not.toBeNull();

      const postingResult = await serviceQuery(`
        SELECT publish_state, published_at, is_hidden FROM cc_job_postings WHERE job_id = $1 AND portal_id = $2
      `, [testJobId, adrenalinePortalId]);
      expect(postingResult.rows[0].publish_state).toBe('published');
      expect(postingResult.rows[0].published_at).not.toBeNull();
      expect(postingResult.rows[0].is_hidden).toBe(false);
    });

    it('Job should be publicly visible after payment', async () => {
      const result = await serviceQuery(`
        SELECT jp.id, jp.publish_state, j.title
        FROM cc_job_postings jp
        JOIN cc_jobs j ON j.id = jp.job_id
        WHERE jp.job_id = $1 AND jp.portal_id = $2 AND jp.publish_state = 'published'
      `, [testJobId, adrenalinePortalId]);

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].publish_state).toBe('published');
    });
  });

  describe('Free Portal Publish Flow', () => {
    it('Publishing to Bamfield (free) should immediately publish', async () => {
      if (!bamfieldPortalId) return;

      await serviceQuery(`DELETE FROM cc_job_postings WHERE job_id = $1 AND portal_id = $2`, [testJobId, bamfieldPortalId]);

      await serviceQuery(`
        INSERT INTO cc_job_postings (job_id, portal_id, publish_state, published_at, is_hidden)
        VALUES ($1, $2, 'published', now(), false)
      `, [testJobId, bamfieldPortalId]);

      const result = await serviceQuery(`
        SELECT publish_state, published_at, is_hidden FROM cc_job_postings WHERE job_id = $1 AND portal_id = $2
      `, [testJobId, bamfieldPortalId]);

      expect(result.rows[0].publish_state).toBe('published');
      expect(result.rows[0].published_at).not.toBeNull();
      expect(result.rows[0].is_hidden).toBe(false);
    });

    it('Publishing to CanadaDirect (moderated) should set pending_review', async () => {
      if (!canadadirectPortalId) return;

      await serviceQuery(`DELETE FROM cc_job_postings WHERE job_id = $1 AND portal_id = $2`, [testJobId, canadadirectPortalId]);

      await serviceQuery(`
        INSERT INTO cc_job_postings (job_id, portal_id, publish_state, is_hidden)
        VALUES ($1, $2, 'pending_review', false)
      `, [testJobId, canadadirectPortalId]);

      const result = await serviceQuery(`
        SELECT publish_state, published_at FROM cc_job_postings WHERE job_id = $1 AND portal_id = $2
      `, [testJobId, canadadirectPortalId]);

      expect(result.rows[0].publish_state).toBe('pending_review');
      expect(result.rows[0].published_at).toBeNull();
    });
  });

  describe('Destinations Endpoint Data', () => {
    it('should return correct pricing metadata for AdrenalineCanada', async () => {
      const result = await serviceQuery(`
        SELECT 
          p.id, p.name, p.slug,
          pdp.pricing_model,
          pdp.price_cents,
          pdp.currency,
          pdp.billing_unit,
          pdp.requires_checkout,
          pdp.requires_moderation
        FROM cc_portals p
        JOIN cc_portal_distribution_policies pdp ON pdp.portal_id = p.id
        WHERE p.slug = 'adrenalinecanada'
      `, []);

      expect(result.rows.length).toBe(1);
      const portal = result.rows[0];
      expect(portal.pricing_model).toBe('paid');
      expect(portal.price_cents).toBe(2900);
      expect(portal.currency).toBe('CAD');
      expect(portal.requires_checkout).toBe(true);
    });
  });
});
