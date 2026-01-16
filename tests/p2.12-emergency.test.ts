/**
 * P2.12 Emergency Templates & Emergency Circle Mode Hardening Tests
 * 
 * Tests emergency template management, run lifecycle, scope grants,
 * and integration with P2.5 (Evidence Bundles), P2.7 (Legal Holds),
 * and P2.9 (Authority Sharing).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { serviceQuery } from '../server/db/tenantDb';
import {
  startEmergencyRun,
  resolveEmergencyRun,
  cancelEmergencyRun,
  attachEvidenceToRun,
  createScopeGrant,
} from '../server/lib/emergency/orchestrate';
import {
  hasActiveEmergencyGrant,
  getActiveEmergencyGrants,
  expireEmergencyGrants,
  revokeEmergencyGrant,
  validateGrantExpiration,
} from '../server/lib/emergency/scopes';
import {
  getActiveTemplate,
  getTemplateById,
  getPropertyProfile,
  createCoordinationBundle,
  bindTemplateToRun,
  bindPropertyToRun,
} from '../server/lib/emergency/bindings';
import {
  exportPlaybook,
} from '../server/lib/emergency/playbook';

const TEST_TENANT_ID = crypto.randomUUID();
const TEST_INDIVIDUAL_ID = crypto.randomUUID();

let testTemplateId: string;
let testProfileId: string;
let testRunId: string;

describe('P2.12 Emergency Templates & Runs', () => {
  beforeAll(async () => {
    const testSlug = `p212-test-${Date.now()}`;
    await serviceQuery(
      `INSERT INTO cc_tenants (id, name, slug, tenant_type, status)
       VALUES ($1, 'P2.12 Test Tenant', $2, 'business', 'active')
       ON CONFLICT (id) DO NOTHING`,
      [TEST_TENANT_ID, testSlug]
    );
    
    await serviceQuery(
      `INSERT INTO cc_individuals (id, full_name, email, status)
       VALUES ($1, 'P2.12 Test User', $2, 'active')
       ON CONFLICT (id) DO NOTHING`,
      [TEST_INDIVIDUAL_ID, `p212-test-${Date.now()}@example.com`]
    );
  });

  afterAll(async () => {
    await serviceQuery(
      `UPDATE cc_legal_holds SET hold_status = 'released' WHERE tenant_id = $1`,
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
      `DELETE FROM cc_property_emergency_profiles WHERE tenant_id = $1`,
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
      `DELETE FROM cc_individuals WHERE id = $1`,
      [TEST_INDIVIDUAL_ID]
    );
    await serviceQuery(
      `DELETE FROM cc_tenants WHERE id = $1`,
      [TEST_TENANT_ID]
    );
  });

  describe('Emergency Template Management', () => {
    it('should create an emergency template', async () => {
      testTemplateId = crypto.randomUUID();
      const templateJson = {
        sections: [
          { title: 'Immediate Actions', content: 'Call 911, evacuate' }
        ],
        checklists: [
          { title: 'Wildfire Response', items: ['Call 911', 'Evacuate guests', 'Document damage'] }
        ],
        contacts: [
          { role: 'Fire Department', phone: '911', type: 'emergency' },
          { role: 'Insurance', phone: '1-800-INSURE', type: 'insurance' }
        ]
      };
      
      const sha256 = 'abc123sha256placeholder';
      
      const result = await serviceQuery<{ id: string; template_type: string; title: string }>(
        `INSERT INTO cc_emergency_templates (
           id, tenant_id, template_type, title, version, status,
           template_json, template_sha256
         ) VALUES (
           $1, $2, 'wildfire', 'Wildfire Emergency Template', 1, 'active',
           $3, $4
         ) RETURNING id, template_type, title`,
        [
          testTemplateId,
          TEST_TENANT_ID,
          JSON.stringify(templateJson),
          sha256
        ]
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].template_type).toBe('wildfire');
      expect(result.rows[0].title).toBe('Wildfire Emergency Template');
    });

    it('should create property emergency profile', async () => {
      testProfileId = crypto.randomUUID();
      
      const result = await serviceQuery<{ id: string; property_label: string }>(
        `INSERT INTO cc_property_emergency_profiles (
           id, tenant_id, property_label, address,
           hazard_overrides, contacts, dependencies
         ) VALUES (
           $1, $2, 'Test Cabin', '123 Forest Road',
           $3, $4, $5
         ) RETURNING id, property_label`,
        [
          testProfileId,
          TEST_TENANT_ID,
          JSON.stringify({ muster_points: ['Front parking lot', 'Back field'] }),
          JSON.stringify({ owner: { name: 'John', phone: '555-1234' }, emergency_line: '555-911' }),
          JSON.stringify([{ type: 'water', description: 'Well pump' }])
        ]
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].property_label).toBe('Test Cabin');
    });

    it('should retrieve template by ID', async () => {
      const template = await getTemplateById(TEST_TENANT_ID, testTemplateId);
      
      expect(template).not.toBeNull();
      expect(template!.id).toBe(testTemplateId);
      expect(template!.template_type).toBe('wildfire');
    });

    it('should retrieve active template by type', async () => {
      const template = await getActiveTemplate(TEST_TENANT_ID, 'wildfire');
      
      expect(template).not.toBeNull();
      expect(template!.template_type).toBe('wildfire');
    });

    it('should retrieve property profile', async () => {
      const profile = await getPropertyProfile(TEST_TENANT_ID, testProfileId);
      
      expect(profile).not.toBeNull();
      expect(profile!.id).toBe(testProfileId);
      expect(profile!.property_label).toBe('Test Cabin');
    });
  });

  describe('Emergency Run Lifecycle', () => {
    it('should start an emergency run and auto-create legal hold', async () => {
      const result = await startEmergencyRun({
        tenantId: TEST_TENANT_ID,
        runType: 'wildfire',
        templateId: testTemplateId,
        propertyProfileId: testProfileId,
        summary: 'Test wildfire emergency - smoke detected',
        startedByIndividualId: TEST_INDIVIDUAL_ID,
      });

      expect(result.runId).toBeDefined();
      testRunId = result.runId;
      expect(result.holdId).toBeDefined();
      expect(result.bundleId).toBeDefined();
      
      const holdResult = await serviceQuery<{ hold_status: string }>(
        `SELECT hold_status FROM cc_legal_holds WHERE id = $1`,
        [result.holdId]
      );
      expect(holdResult.rows.length).toBe(1);
      expect(holdResult.rows[0].hold_status).toBe('active');
    });

    it('should record immutable run events', async () => {
      const eventsResult = await serviceQuery<{ event_type: string }>(
        `SELECT event_type FROM cc_emergency_run_events 
         WHERE run_id = $1 
         ORDER BY event_at ASC`,
        [testRunId]
      );

      expect(eventsResult.rows.length).toBeGreaterThanOrEqual(1);
      expect(eventsResult.rows[0].event_type).toBe('run_started');
    });

    it('should prevent modification of run events', async () => {
      const eventsResult = await serviceQuery<{ id: string }>(
        `SELECT id FROM cc_emergency_run_events WHERE run_id = $1 LIMIT 1`,
        [testRunId]
      );

      if (eventsResult.rows.length > 0) {
        try {
          await serviceQuery(
            `UPDATE cc_emergency_run_events SET event_type = 'tampered' WHERE id = $1`,
            [eventsResult.rows[0].id]
          );
          expect.fail('Should have thrown error on event modification');
        } catch (error: any) {
          expect(error.message.toUpperCase()).toContain('IMMUTABLE');
        }
      }
    });

    it('should attach evidence to run', async () => {
      await attachEvidenceToRun({
        tenantId: TEST_TENANT_ID,
        runId: testRunId,
        evidenceObjectId: crypto.randomUUID(),
        label: 'Photo of smoke damage',
        notes: 'Taken at 2:30 PM',
        actorIndividualId: TEST_INDIVIDUAL_ID,
      });
      
      const eventsResult = await serviceQuery<{ event_type: string }>(
        `SELECT event_type FROM cc_emergency_run_events 
         WHERE run_id = $1 AND event_type = 'evidence_attached'`,
        [testRunId]
      );
      expect(eventsResult.rows.length).toBe(1);
    });

    it('should resolve run', async () => {
      const result = await resolveEmergencyRun({
        tenantId: TEST_TENANT_ID,
        runId: testRunId,
        summary: 'Fire contained. Minor damage. Insurance claim to be filed.',
        resolvedByIndividualId: TEST_INDIVIDUAL_ID,
      });

      expect(result.authorityGrantId).toBeNull();
      
      const runResult = await serviceQuery<{ status: string; resolved_at: Date }>(
        `SELECT status, resolved_at FROM cc_emergency_runs WHERE id = $1`,
        [testRunId]
      );
      expect(runResult.rows[0].status).toBe('resolved');
      expect(runResult.rows[0].resolved_at).toBeDefined();
    });
  });

  describe('Scope Grants', () => {
    let grantTestRunId: string;
    let grantId: string;
    const granteeId = crypto.randomUUID();

    beforeAll(async () => {
      await serviceQuery(
        `INSERT INTO cc_individuals (id, full_name, email, status)
         VALUES ($1, 'Grantee User', $2, 'active')
         ON CONFLICT (id) DO NOTHING`,
        [granteeId, `grantee-${Date.now()}@example.com`]
      );
      
      const run = await startEmergencyRun({
        tenantId: TEST_TENANT_ID,
        runType: 'storm',
        summary: 'Test for scope grants',
        startedByIndividualId: TEST_INDIVIDUAL_ID,
      });
      grantTestRunId = run.runId;
    });

    afterAll(async () => {
      await cancelEmergencyRun(
        TEST_TENANT_ID,
        grantTestRunId,
        TEST_INDIVIDUAL_ID,
        'Test cleanup'
      );
      await serviceQuery(
        `DELETE FROM cc_individuals WHERE id = $1`,
        [granteeId]
      );
    });

    it('should create a scope grant with TTL', async () => {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      grantId = await createScopeGrant({
        tenantId: TEST_TENANT_ID,
        runId: grantTestRunId,
        granteeIndividualId: granteeId,
        grantType: 'asset_control',
        scopeJson: { asset_ids: ['asset-1', 'asset-2'] },
        expiresAt,
        grantedByIndividualId: TEST_INDIVIDUAL_ID,
      });

      expect(grantId).toBeDefined();
      
      const grantResult = await serviceQuery<{ expires_at: Date; grant_type: string }>(
        `SELECT expires_at, grant_type FROM cc_emergency_scope_grants WHERE id = $1`,
        [grantId]
      );
      expect(grantResult.rows[0].grant_type).toBe('asset_control');
    });

    it('should validate grant expiration within 72 hours', () => {
      const validExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const result = validateGrantExpiration(validExpiry);
      expect(result.valid).toBe(true);
    });

    it('should reject grant expiration beyond 72 hours', () => {
      const invalidExpiry = new Date(Date.now() + 100 * 60 * 60 * 1000);
      const result = validateGrantExpiration(invalidExpiry);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('72');
    });

    it('should check for active emergency grants', async () => {
      const hasGrant = await hasActiveEmergencyGrant(
        TEST_TENANT_ID,
        granteeId,
        'asset_control'
      );
      expect(hasGrant).toBe(true);
    });

    it('should get all active grants for individual', async () => {
      const grants = await getActiveEmergencyGrants(TEST_TENANT_ID, granteeId);
      expect(grants.length).toBeGreaterThanOrEqual(1);
      expect(grants[0].grant_type).toBe('asset_control');
    });

    it('should revoke grant', async () => {
      await revokeEmergencyGrant(
        TEST_TENANT_ID,
        grantId,
        TEST_INDIVIDUAL_ID,
        'Test revocation'
      );

      const hasGrant = await hasActiveEmergencyGrant(
        TEST_TENANT_ID,
        granteeId,
        'asset_control'
      );
      expect(hasGrant).toBe(false);
    });

    it('should expire grants past TTL', async () => {
      const newGrantId = await createScopeGrant({
        tenantId: TEST_TENANT_ID,
        runId: grantTestRunId,
        granteeIndividualId: granteeId,
        grantType: 'vehicle_access',
        scopeJson: { vehicle_ids: ['vehicle-1'] },
        expiresAt: new Date(Date.now() + 1000),
        grantedByIndividualId: TEST_INDIVIDUAL_ID,
      });

      await serviceQuery(
        `UPDATE cc_emergency_scope_grants 
         SET expires_at = NOW() - INTERVAL '1 hour'
         WHERE id = $1`,
        [newGrantId]
      );

      const expiredCount = await expireEmergencyGrants(TEST_TENANT_ID);
      expect(expiredCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Coordination Bundle', () => {
    it('should create sealed coordination bundle', async () => {
      const template = await getTemplateById(TEST_TENANT_ID, testTemplateId);
      const property = await getPropertyProfile(TEST_TENANT_ID, testProfileId);
      
      const bundleRunId = crypto.randomUUID();
      
      const result = await createCoordinationBundle(
        TEST_TENANT_ID,
        bundleRunId,
        'wildfire',
        template,
        property,
        'Test coordination bundle'
      );

      expect(result.bundleId).toBeDefined();
      expect(result.manifestSha256).toBeDefined();
      expect(result.manifestSha256.length).toBe(64);
      
      const bundleResult = await serviceQuery<{ bundle_status: string; bundle_type: string }>(
        `SELECT bundle_status, bundle_type FROM cc_evidence_bundles WHERE id = $1`,
        [result.bundleId]
      );
      expect(bundleResult.rows[0].bundle_status).toBe('sealed');
      expect(bundleResult.rows[0].bundle_type).toBe('emergency_coordination');
    });
  });

  describe('Cancel Emergency Run', () => {
    let cancelTestRunId: string;

    beforeAll(async () => {
      const run = await startEmergencyRun({
        tenantId: TEST_TENANT_ID,
        runType: 'power_outage',
        summary: 'Test run for cancellation',
        startedByIndividualId: TEST_INDIVIDUAL_ID,
      });
      cancelTestRunId = run.runId;
    });

    it('should cancel run', async () => {
      await cancelEmergencyRun(
        TEST_TENANT_ID,
        cancelTestRunId,
        TEST_INDIVIDUAL_ID,
        'False alarm - no actual emergency'
      );

      const runResult = await serviceQuery<{ status: string; resolved_at: Date }>(
        `SELECT status, resolved_at FROM cc_emergency_runs WHERE id = $1`,
        [cancelTestRunId]
      );
      expect(runResult.rows[0].status).toBe('cancelled');
      expect(runResult.rows[0].resolved_at).toBeDefined();
    });
  });

  describe('Playbook Export', () => {
    let playbookRunId: string;

    beforeAll(async () => {
      const run = await startEmergencyRun({
        tenantId: TEST_TENANT_ID,
        runType: 'storm',
        templateId: testTemplateId,
        propertyProfileId: testProfileId,
        summary: 'Test run for playbook export',
        startedByIndividualId: TEST_INDIVIDUAL_ID,
      });
      playbookRunId = run.runId;
    });

    afterAll(async () => {
      await cancelEmergencyRun(
        TEST_TENANT_ID,
        playbookRunId,
        TEST_INDIVIDUAL_ID,
        'Test cleanup'
      );
    });

    it('should export playbook ZIP to R2', async () => {
      try {
        const result = await exportPlaybook(
          TEST_TENANT_ID,
          playbookRunId,
          TEST_INDIVIDUAL_ID
        );

        expect(result.url).toBeDefined();
        expect(result.r2Key).toContain('playbook');
        expect(result.playbookSha256).toBeDefined();
        expect(result.verificationSha256).toBeDefined();
      } catch (error: any) {
        if (error.message?.includes('R2 storage is not configured')) {
          console.log('Skipping R2 test - storage not configured');
        } else {
          throw error;
        }
      }
    });
  });

  describe('Template and Property Binding', () => {
    let bindingRunId: string;

    beforeAll(async () => {
      const run = await startEmergencyRun({
        tenantId: TEST_TENANT_ID,
        runType: 'wildfire',
        summary: 'Test run for binding',
        startedByIndividualId: TEST_INDIVIDUAL_ID,
      });
      bindingRunId = run.runId;
    });

    afterAll(async () => {
      await cancelEmergencyRun(
        TEST_TENANT_ID,
        bindingRunId,
        TEST_INDIVIDUAL_ID,
        'Test cleanup'
      );
    });

    it('should bind template to run', async () => {
      await bindTemplateToRun(
        TEST_TENANT_ID,
        bindingRunId,
        testTemplateId,
        TEST_INDIVIDUAL_ID
      );

      const runResult = await serviceQuery<{ template_id: string }>(
        `SELECT template_id FROM cc_emergency_runs WHERE id = $1`,
        [bindingRunId]
      );
      expect(runResult.rows[0].template_id).toBe(testTemplateId);

      const eventResult = await serviceQuery<{ event_type: string }>(
        `SELECT event_type FROM cc_emergency_run_events 
         WHERE run_id = $1 AND event_type = 'template_bound'`,
        [bindingRunId]
      );
      expect(eventResult.rows.length).toBe(1);
    });

    it('should bind property to run', async () => {
      await bindPropertyToRun(
        TEST_TENANT_ID,
        bindingRunId,
        testProfileId,
        TEST_INDIVIDUAL_ID
      );

      const runResult = await serviceQuery<{ property_profile_id: string }>(
        `SELECT property_profile_id FROM cc_emergency_runs WHERE id = $1`,
        [bindingRunId]
      );
      expect(runResult.rows[0].property_profile_id).toBe(testProfileId);

      const eventResult = await serviceQuery<{ event_type: string }>(
        `SELECT event_type FROM cc_emergency_run_events 
         WHERE run_id = $1 AND event_type = 'property_bound'`,
        [bindingRunId]
      );
      expect(eventResult.rows.length).toBe(1);
    });
  });
});
