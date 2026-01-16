import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '../../server/db';
import { serviceQuery } from '../../server/db/tenantDb';
import { canonicalizeJson, sha256Hex } from '../../server/lib/evidence/custody';
import { assembleDefensePack, PackType } from '../../server/lib/disputes/assembleDefensePack';
import { attachDisputeInput, listDisputeInputs } from '../../server/lib/disputes/inputs';

const TEST_TENANT_ID = 'c0000000-0000-0000-0000-000000000002';
const TEST_INDIVIDUAL_ID = '00000000-0000-0000-0000-000000000001';
let TEST_PARTY_ID: string;

describe('P2.10 Dispute/Extortion Defense Pack', () => {
  let disputeId: string;
  let evidenceObjectId: string;
  let bundleId: string;

  beforeAll(async () => {
    await serviceQuery(
      `DELETE FROM cc_defense_packs WHERE tenant_id = $1`,
      [TEST_TENANT_ID]
    );
    await serviceQuery(
      `DELETE FROM cc_dispute_inputs WHERE tenant_id = $1`,
      [TEST_TENANT_ID]
    );
    await serviceQuery(
      `DELETE FROM cc_disputes WHERE tenant_id = $1`,
      [TEST_TENANT_ID]
    );
    
    const partyResult = await serviceQuery<{ id: string }>(
      `INSERT INTO cc_parties (tenant_id, party_type, legal_name, status)
       VALUES ($1, 'contractor', 'Test Party', 'approved')
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [TEST_TENANT_ID]
    );
    
    if (partyResult.rows.length > 0) {
      TEST_PARTY_ID = partyResult.rows[0].id;
    } else {
      const existingParty = await serviceQuery<{ id: string }>(
        `SELECT id FROM cc_parties WHERE tenant_id = $1 LIMIT 1`,
        [TEST_TENANT_ID]
      );
      TEST_PARTY_ID = existingParty.rows[0]?.id || 'b87cb006-5599-4246-b98d-962458640602';
    }
  });

  afterAll(async () => {
    await serviceQuery(
      `DELETE FROM cc_defense_packs WHERE tenant_id = $1`,
      [TEST_TENANT_ID]
    );
    await serviceQuery(
      `DELETE FROM cc_dispute_inputs WHERE tenant_id = $1`,
      [TEST_TENANT_ID]
    );
    await serviceQuery(
      `DELETE FROM cc_disputes WHERE tenant_id = $1`,
      [TEST_TENANT_ID]
    );
    if (evidenceObjectId) {
      await serviceQuery(
        `DELETE FROM cc_evidence_objects WHERE id = $1`,
        [evidenceObjectId]
      ).catch(() => {});
    }
    if (bundleId) {
      await serviceQuery(
        `DELETE FROM cc_evidence_bundles WHERE id = $1`,
        [bundleId]
      ).catch(() => {});
    }
  });

  describe('Dispute CRUD', () => {
    it('should create a dispute', async () => {
      const result = await serviceQuery<{ id: string }>(
        `INSERT INTO cc_disputes (
          tenant_id, dispute_type, status, initiator_party_id, title, description
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id`,
        [
          TEST_TENANT_ID,
          'charge_dispute',
          'draft',
          TEST_PARTY_ID,
          'Test Dispute',
          'Guest claims services not rendered',
        ]
      );

      expect(result.rows).toHaveLength(1);
      disputeId = result.rows[0].id;
      expect(disputeId).toBeDefined();
    });

    it('should read a dispute', async () => {
      const result = await serviceQuery<{ id: string; status: string }>(
        `SELECT * FROM cc_disputes WHERE id = $1 AND tenant_id = $2`,
        [disputeId, TEST_TENANT_ID]
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].status).toBe('draft');
    });
  });

  describe('Sealed-Only Attachment', () => {
    it('should reject attaching unsealed evidence object via helper', async () => {
      const testHash = sha256Hex('unsealed test content');
      const objResult = await serviceQuery<{ id: string }>(
        `INSERT INTO cc_evidence_objects (
          tenant_id, source_type, title, chain_status, content_sha256, created_by_individual_id
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id`,
        [TEST_TENANT_ID, 'file_r2', 'Unsealed Photo', 'open', testHash, TEST_INDIVIDUAL_ID]
      );
      const unsealedObjectId = objResult.rows[0].id;

      await expect(
        attachDisputeInput({
          tenantId: TEST_TENANT_ID,
          disputeId,
          inputType: 'evidence_object',
          inputId: unsealedObjectId,
        })
      ).rejects.toThrow(/must be sealed/);

      await serviceQuery(
        `DELETE FROM cc_evidence_objects WHERE id = $1`,
        [unsealedObjectId]
      );
    });

    it('should allow attaching sealed evidence object via helper', async () => {
      const testHash = sha256Hex('sealed test content');
      const objResult = await serviceQuery<{ id: string }>(
        `INSERT INTO cc_evidence_objects (
          tenant_id, source_type, title, chain_status, content_sha256, created_by_individual_id
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id`,
        [TEST_TENANT_ID, 'file_r2', 'Sealed Photo', 'sealed', testHash, TEST_INDIVIDUAL_ID]
      );
      evidenceObjectId = objResult.rows[0].id;

      const input = await attachDisputeInput({
        tenantId: TEST_TENANT_ID,
        disputeId,
        inputType: 'evidence_object',
        inputId: evidenceObjectId,
        attachedByIndividualId: TEST_INDIVIDUAL_ID,
      });

      expect(input.id).toBeDefined();
      expect(input.copiedSha256).toBe(testHash);
    });

    it('should reject attaching unsealed bundle via helper', async () => {
      const bundleResult = await serviceQuery<{ id: string }>(
        `INSERT INTO cc_evidence_bundles (
          tenant_id, bundle_type, created_by_individual_id, title, bundle_status
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING id`,
        [TEST_TENANT_ID, 'dispute_defense', TEST_INDIVIDUAL_ID, 'Test Bundle', 'open']
      );
      const unsealedBundleId = bundleResult.rows[0].id;

      await expect(
        attachDisputeInput({
          tenantId: TEST_TENANT_ID,
          disputeId,
          inputType: 'evidence_bundle',
          inputId: unsealedBundleId,
        })
      ).rejects.toThrow(/must be sealed/);

      await serviceQuery(
        `DELETE FROM cc_evidence_bundles WHERE id = $1`,
        [unsealedBundleId]
      );
    });

    it('should allow attaching sealed bundle via helper', async () => {
      const manifestHash = sha256Hex('manifest content');
      const bundleResult = await serviceQuery<{ id: string }>(
        `INSERT INTO cc_evidence_bundles (
          tenant_id, bundle_type, created_by_individual_id, title, bundle_status, manifest_sha256
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id`,
        [TEST_TENANT_ID, 'dispute_defense', TEST_INDIVIDUAL_ID, 'Sealed Bundle', 'sealed', manifestHash]
      );
      bundleId = bundleResult.rows[0].id;

      const input = await attachDisputeInput({
        tenantId: TEST_TENANT_ID,
        disputeId,
        inputType: 'evidence_bundle',
        inputId: bundleId,
        attachedByIndividualId: TEST_INDIVIDUAL_ID,
      });

      expect(input.id).toBeDefined();
      expect(input.copiedSha256).toBe(manifestHash);
    });
  });

  describe('Defense Pack Assembly', () => {
    it('should assemble defense pack with sealed inputs', async () => {
      const pack = await assembleDefensePack(
        TEST_TENANT_ID,
        disputeId,
        'chargeback_v1',
        TEST_INDIVIDUAL_ID
      );

      expect(pack).toBeDefined();
      expect(pack.packJson).toBeDefined();
      expect(pack.packJson.cover).toBeDefined();
      expect(pack.packJson.cover.dispute_type).toBe('charge_dispute');
      expect(pack.packSha256).toBeDefined();
      expect(pack.packSha256.length).toBe(64);
    });

    it('should produce deterministic pack_sha256 for same inputs', async () => {
      const pack1 = await assembleDefensePack(
        TEST_TENANT_ID,
        disputeId,
        'chargeback_v1',
        TEST_INDIVIDUAL_ID
      );

      const pack2 = await assembleDefensePack(
        TEST_TENANT_ID,
        disputeId,
        'chargeback_v1',
        TEST_INDIVIDUAL_ID
      );

      expect(pack1.packSha256).toBe(pack2.packSha256);
    });

    it('should sort evidence chronologically in pack', async () => {
      const pack = await assembleDefensePack(
        TEST_TENANT_ID,
        disputeId,
        'chargeback_v1',
        TEST_INDIVIDUAL_ID
      );

      const chronology = pack.packJson.chronology;
      for (let i = 1; i < chronology.length; i++) {
        const prevTime = chronology[i-1].occurred_at || chronology[i-1].created_at;
        const currTime = chronology[i].occurred_at || chronology[i].created_at;
        expect(prevTime <= currTime).toBe(true);
      }
    });

    it('should include verification section with SHA256 hashes', async () => {
      const pack = await assembleDefensePack(
        TEST_TENANT_ID,
        disputeId,
        'chargeback_v1',
        TEST_INDIVIDUAL_ID
      );

      expect(pack.packJson.verification).toBeDefined();
      expect(pack.packJson.verification.pack_sha256).toBe(pack.packSha256);
      expect(pack.packJson.verification.algorithm_version).toBeDefined();
    });
  });

  describe('Pack Versioning', () => {
    let packId: string;

    it('should create initial pack with version 1', async () => {
      const pack = await assembleDefensePack(
        TEST_TENANT_ID,
        disputeId,
        'chargeback_v1',
        TEST_INDIVIDUAL_ID
      );

      const result = await serviceQuery<{ id: string; pack_version: number }>(
        `INSERT INTO cc_defense_packs (
          tenant_id, dispute_id, pack_type, pack_version, pack_status,
          pack_json, pack_sha256, assembled_by_individual_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, pack_version`,
        [
          TEST_TENANT_ID,
          disputeId,
          'chargeback_v1',
          1,
          'draft',
          JSON.stringify(pack.packJson),
          pack.packSha256,
          TEST_INDIVIDUAL_ID,
        ]
      );

      packId = result.rows[0].id;
      expect(result.rows[0].pack_version).toBe(1);
    });

    it('should allow non-immutable field updates before finalization', async () => {
      await serviceQuery(
        `UPDATE cc_defense_packs SET pack_status = $1 WHERE id = $2`,
        ['finalized', packId]
      );

      const result = await serviceQuery<{ pack_status: string }>(
        `SELECT pack_status FROM cc_defense_packs WHERE id = $1`,
        [packId]
      );

      expect(result.rows[0].pack_status).toBe('finalized');
    });

    it('should create superseded pack when new version assembled', async () => {
      const pack = await assembleDefensePack(
        TEST_TENANT_ID,
        disputeId,
        'chargeback_v1',
        TEST_INDIVIDUAL_ID
      );

      await serviceQuery(
        `UPDATE cc_defense_packs SET pack_status = 'superseded' WHERE id = $1`,
        [packId]
      );

      const result = await serviceQuery<{ id: string; pack_version: number }>(
        `INSERT INTO cc_defense_packs (
          tenant_id, dispute_id, pack_type, pack_version, pack_status,
          pack_json, pack_sha256, assembled_by_individual_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, pack_version`,
        [
          TEST_TENANT_ID,
          disputeId,
          'chargeback_v1',
          2,
          'draft',
          JSON.stringify(pack.packJson),
          pack.packSha256,
          TEST_INDIVIDUAL_ID,
        ]
      );

      expect(result.rows[0].pack_version).toBe(2);

      const oldPack = await serviceQuery<{ pack_status: string }>(
        `SELECT pack_status FROM cc_defense_packs WHERE id = $1`,
        [packId]
      );
      expect(oldPack.rows[0].pack_status).toBe('superseded');
    });
  });

  describe('Pack Types', () => {
    const packTypes: PackType[] = ['chargeback_v1', 'review_extortion_v1', 'bbb_v1', 'contract_v1', 'generic_v1'];

    it('should produce valid pack structure for all pack types', async () => {
      for (const packType of packTypes) {
        const pack = await assembleDefensePack(
          TEST_TENANT_ID,
          disputeId,
          packType,
          TEST_INDIVIDUAL_ID
        );

        expect(pack.packJson.cover).toBeDefined();
        expect(pack.packJson.executive_summary).toBeDefined();
        expect(pack.packJson.chronology).toBeDefined();
        expect(pack.packJson.evidence_index).toBeDefined();
        expect(pack.packJson.verification).toBeDefined();
        expect(pack.packSha256).toBeDefined();
      }
    });
  });

  describe('Canonical JSON Serialization', () => {
    it('should produce consistent JSON for equivalent objects', () => {
      const obj1 = { b: 2, a: 1, c: { z: 26, y: 25 } };
      const obj2 = { a: 1, c: { y: 25, z: 26 }, b: 2 };

      expect(canonicalizeJson(obj1)).toBe(canonicalizeJson(obj2));
    });
  });
});
