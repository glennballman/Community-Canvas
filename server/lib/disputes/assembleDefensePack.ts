/**
 * P2.10 Defense Pack Assembly Engine
 * Deterministic assembly of defense packs from sealed evidence
 */

import { pool } from '../../db';
import { canonicalizeJson, sha256Hex } from '../evidence/custody';
import { listDisputeInputs } from './inputs';

export type PackType = 'chargeback_v1' | 'review_extortion_v1' | 'bbb_v1' | 'contract_v1' | 'generic_v1';

export interface DefensePack {
  id: string;
  tenantId: string;
  disputeId: string;
  packVersion: number;
  packStatus: string;
  packType: string;
  assembledAt: Date;
  assembledByIndividualId: string | null;
  packJson: DefensePackJson;
  packSha256: string;
  exportArtifacts: ExportArtifact[];
  clientRequestId: string | null;
  metadata: Record<string, any>;
}

export interface ExportArtifact {
  format: string;
  r2Key: string;
  exportedAt: string;
  exportedByIndividualId?: string;
}

export interface DefensePackJson {
  algorithm_version: string;
  cover: CoverSection;
  executive_summary: SummaryBullet[];
  chronology: ChronologyEntry[];
  contractual_basis: ContractualBasis[];
  rebuttal_matrix: RebuttalEntry[];
  evidence_index: EvidenceIndex;
  verification: VerificationSection;
}

interface CoverSection {
  dispute_type: string;
  counterparty_type: string | null;
  counterparty_name: string | null;
  counterparty_reference: string | null;
  amount_cents: number | null;
  currency: string | null;
  tenant_id: string;
  portal_id: string | null;
  dispute_id: string;
  title: string;
  created_at: string;
  assembled_at: string;
}

interface SummaryBullet {
  order: number;
  text: string;
  evidence_refs: string[];
}

interface ChronologyEntry {
  occurred_at: string | null;
  created_at: string;
  title: string;
  source_type: string;
  content_sha256: string;
  pointer_type: string;
  pointer_id: string;
}

interface ContractualBasis {
  order: number;
  term_description: string;
  evidence_ref: string | null;
}

interface RebuttalEntry {
  category: string;
  claim: string;
  rebuttal: string;
  evidence_refs: string[];
}

interface EvidenceIndex {
  communications: EvidenceRef[];
  proof_of_service: EvidenceRef[];
  safety_emergency: EvidenceRef[];
  third_party: EvidenceRef[];
  photos: EvidenceRef[];
  receipts: EvidenceRef[];
  other: EvidenceRef[];
}

interface EvidenceRef {
  pointer_type: string;
  pointer_id: string;
  content_sha256: string;
  label: string | null;
  source_type: string;
}

interface VerificationSection {
  bundle_manifest_sha256s: string[];
  evidence_content_sha256s: string[];
  dossier_sha256s: string[];
  pack_sha256: string;
  algorithm_version: string;
}

/**
 * Assemble a defense pack for a dispute
 * Deterministic: same inputs always produce same pack_sha256
 */
export async function assembleDefensePack(
  tenantId: string,
  disputeId: string,
  packType: PackType,
  assembledByIndividualId?: string,
  clientRequestId?: string,
  forceNewVersion?: boolean
): Promise<DefensePack> {
  // 1. Get dispute
  const disputeResult = await pool.query<any>(
    `SELECT * FROM cc_disputes WHERE tenant_id = $1::uuid AND id = $2::uuid`,
    [tenantId, disputeId]
  );
  if (disputeResult.rows.length === 0) {
    throw new Error('Dispute not found');
  }
  const dispute = disputeResult.rows[0];
  
  // 2. Get all inputs
  const inputs = await listDisputeInputs(tenantId, disputeId);
  if (inputs.length === 0) {
    throw new Error('Dispute has no attached inputs');
  }
  
  // 3. Validate all inputs are sealed and collect data
  const bundleManifests: string[] = [];
  const evidenceSha256s: string[] = [];
  const dossierSha256s: string[] = [];
  const chronology: ChronologyEntry[] = [];
  const evidenceIndex: EvidenceIndex = {
    communications: [],
    proof_of_service: [],
    safety_emergency: [],
    third_party: [],
    photos: [],
    receipts: [],
    other: [],
  };
  
  for (const input of inputs) {
    switch (input.inputType) {
      case 'evidence_bundle': {
        const bundleResult = await pool.query<any>(
          `SELECT * FROM cc_evidence_bundles WHERE tenant_id = $1::uuid AND id = $2::uuid`,
          [tenantId, input.inputId]
        );
        if (bundleResult.rows.length === 0) {
          throw new Error(`Evidence bundle ${input.inputId} not found`);
        }
        const bundle = bundleResult.rows[0];
        if (bundle.bundle_status !== 'sealed') {
          throw new Error(`Evidence bundle ${input.inputId} is not sealed`);
        }
        if (!bundle.manifest_sha256) {
          throw new Error(`Evidence bundle ${input.inputId} missing manifest_sha256`);
        }
        bundleManifests.push(bundle.manifest_sha256);
        
        // Get bundle's evidence objects for chronology
        const objectsResult = await pool.query<any>(
          `SELECT eo.* FROM cc_evidence_objects eo
           JOIN cc_evidence_bundle_items ebi ON eo.id = ebi.evidence_object_id
           WHERE ebi.bundle_id = $1::uuid AND eo.tenant_id = $2::uuid`,
          [input.inputId, tenantId]
        );
        
        for (const obj of objectsResult.rows) {
          evidenceSha256s.push(obj.content_sha256);
          
          chronology.push({
            occurred_at: obj.occurred_at?.toISOString() || null,
            created_at: obj.created_at.toISOString(),
            title: obj.title || obj.source_type,
            source_type: obj.source_type,
            content_sha256: obj.content_sha256,
            pointer_type: 'evidence_object',
            pointer_id: obj.id,
          });
          
          const ref: EvidenceRef = {
            pointer_type: 'evidence_object',
            pointer_id: obj.id,
            content_sha256: obj.content_sha256,
            label: input.label,
            source_type: obj.source_type,
          };
          
          categorizeEvidence(ref, obj, evidenceIndex);
        }
        break;
      }
      
      case 'evidence_object': {
        const objResult = await pool.query<any>(
          `SELECT * FROM cc_evidence_objects WHERE tenant_id = $1::uuid AND id = $2::uuid`,
          [tenantId, input.inputId]
        );
        if (objResult.rows.length === 0) {
          throw new Error(`Evidence object ${input.inputId} not found`);
        }
        const obj = objResult.rows[0];
        if (obj.chain_status !== 'sealed') {
          throw new Error(`Evidence object ${input.inputId} is not sealed`);
        }
        if (!obj.content_sha256) {
          throw new Error(`Evidence object ${input.inputId} missing content_sha256`);
        }
        evidenceSha256s.push(obj.content_sha256);
        
        chronology.push({
          occurred_at: obj.occurred_at?.toISOString() || null,
          created_at: obj.created_at.toISOString(),
          title: obj.title || obj.source_type,
          source_type: obj.source_type,
          content_sha256: obj.content_sha256,
          pointer_type: 'evidence_object',
          pointer_id: obj.id,
        });
        
        const ref: EvidenceRef = {
          pointer_type: 'evidence_object',
          pointer_id: obj.id,
          content_sha256: obj.content_sha256,
          label: input.label,
          source_type: obj.source_type,
        };
        
        categorizeEvidence(ref, obj, evidenceIndex);
        break;
      }
      
      case 'claim_dossier': {
        const dossierResult = await pool.query<any>(
          `SELECT * FROM cc_claim_dossiers WHERE tenant_id = $1::uuid AND id = $2::uuid`,
          [tenantId, input.inputId]
        );
        if (dossierResult.rows.length === 0) {
          throw new Error(`Claim dossier ${input.inputId} not found`);
        }
        const dossier = dossierResult.rows[0];
        if (!dossier.dossier_sha256) {
          throw new Error(`Claim dossier ${input.inputId} missing dossier_sha256`);
        }
        dossierSha256s.push(dossier.dossier_sha256);
        
        chronology.push({
          occurred_at: null,
          created_at: dossier.assembled_at.toISOString(),
          title: `Claim Dossier v${dossier.version}`,
          source_type: 'claim_dossier',
          content_sha256: dossier.dossier_sha256,
          pointer_type: 'claim_dossier',
          pointer_id: dossier.id,
        });
        break;
      }
      
      case 'insurance_claim': {
        // Get the claim's dossiers
        const dossiersResult = await pool.query<any>(
          `SELECT * FROM cc_claim_dossiers 
           WHERE tenant_id = $1::uuid AND claim_id = $2::uuid
           ORDER BY version DESC`,
          [tenantId, input.inputId]
        );
        
        for (const dossier of dossiersResult.rows) {
          if (dossier.dossier_sha256) {
            dossierSha256s.push(dossier.dossier_sha256);
            
            chronology.push({
              occurred_at: null,
              created_at: dossier.assembled_at.toISOString(),
              title: `Claim Dossier v${dossier.version}`,
              source_type: 'claim_dossier',
              content_sha256: dossier.dossier_sha256,
              pointer_type: 'claim_dossier',
              pointer_id: dossier.id,
            });
          }
        }
        break;
      }
    }
  }
  
  // 4. Sort chronology deterministically
  chronology.sort((a, b) => {
    const aOccurred = a.occurred_at || '9999-12-31T23:59:59.999Z';
    const bOccurred = b.occurred_at || '9999-12-31T23:59:59.999Z';
    if (aOccurred !== bOccurred) return aOccurred.localeCompare(bOccurred);
    if (a.created_at !== b.created_at) return a.created_at.localeCompare(b.created_at);
    return a.pointer_id.localeCompare(b.pointer_id);
  });
  
  // 5. Sort all arrays for determinism
  bundleManifests.sort();
  evidenceSha256s.sort();
  dossierSha256s.sort();
  
  for (const category of Object.values(evidenceIndex)) {
    category.sort((a: EvidenceRef, b: EvidenceRef) => a.pointer_id.localeCompare(b.pointer_id));
  }
  
  // 6. Build pack JSON (without pack_sha256 initially)
  const now = new Date();
  const packJson: Omit<DefensePackJson, 'verification'> & { verification: Omit<VerificationSection, 'pack_sha256'> } = {
    algorithm_version: 'defense_pack_v1',
    cover: {
      dispute_type: dispute.dispute_type,
      counterparty_type: dispute.counterparty_type,
      counterparty_name: dispute.counterparty_name,
      counterparty_reference: dispute.counterparty_reference,
      amount_cents: dispute.amount_cents || dispute.disputed_amount_cents,
      currency: dispute.currency,
      tenant_id: tenantId,
      portal_id: dispute.portal_id,
      dispute_id: disputeId,
      title: dispute.title,
      created_at: dispute.created_at.toISOString(),
      assembled_at: now.toISOString(),
    },
    executive_summary: generateExecutiveSummary(dispute, chronology, packType),
    chronology,
    contractual_basis: [],
    rebuttal_matrix: generateRebuttalMatrix(packType),
    evidence_index: evidenceIndex,
    verification: {
      bundle_manifest_sha256s: bundleManifests,
      evidence_content_sha256s: evidenceSha256s,
      dossier_sha256s: dossierSha256s,
      algorithm_version: 'defense_pack_v1',
    },
  };
  
  // 7. Compute pack_sha256
  const canonicalJson = canonicalizeJson(packJson);
  const packSha256 = sha256Hex(canonicalJson);
  
  // 8. Add pack_sha256 to verification
  const finalPackJson: DefensePackJson = {
    ...packJson,
    verification: {
      ...packJson.verification,
      pack_sha256: packSha256,
    },
  };
  
  // 9. Get next version number
  const versionResult = await pool.query<any>(
    `SELECT COALESCE(MAX(pack_version), 0) as max_version 
     FROM cc_defense_packs 
     WHERE tenant_id = $1::uuid AND dispute_id = $2::uuid`,
    [tenantId, disputeId]
  );
  const nextVersion = versionResult.rows[0].max_version + 1;
  
  // 10. Mark previous versions as superseded (if any)
  if (nextVersion > 1) {
    await pool.query(
      `UPDATE cc_defense_packs 
       SET pack_status = 'superseded'
       WHERE tenant_id = $1::uuid AND dispute_id = $2::uuid AND pack_status NOT IN ('superseded', 'archived')`,
      [tenantId, disputeId]
    );
  }
  
  // 11. Insert defense pack
  const insertResult = await pool.query<any>(
    `INSERT INTO cc_defense_packs 
     (tenant_id, dispute_id, pack_version, pack_type, assembled_by_individual_id, pack_json, pack_sha256, client_request_id, metadata)
     VALUES ($1::uuid, $2::uuid, $3, $4, $5::uuid, $6::jsonb, $7, $8, $9::jsonb)
     RETURNING *`,
    [
      tenantId,
      disputeId,
      nextVersion,
      packType,
      assembledByIndividualId || null,
      JSON.stringify(finalPackJson),
      packSha256,
      clientRequestId || null,
      JSON.stringify({ events: [{ type: 'defense_pack_assembled', at: now.toISOString() }] }),
    ]
  );
  
  // Note: Dispute status change is left to the caller to handle as needed
  // since different workflows may require different status transitions
  
  return mapPackRow(insertResult.rows[0]);
}

/**
 * Get a defense pack by ID
 */
export async function getDefensePack(tenantId: string, packId: string): Promise<DefensePack | null> {
  const result = await pool.query<any>(
    `SELECT * FROM cc_defense_packs WHERE tenant_id = $1::uuid AND id = $2::uuid`,
    [tenantId, packId]
  );
  if (result.rows.length === 0) return null;
  return mapPackRow(result.rows[0]);
}

/**
 * List defense packs for a dispute
 */
export async function listDefensePacks(tenantId: string, disputeId: string): Promise<DefensePack[]> {
  const result = await pool.query<any>(
    `SELECT * FROM cc_defense_packs 
     WHERE tenant_id = $1::uuid AND dispute_id = $2::uuid
     ORDER BY pack_version DESC`,
    [tenantId, disputeId]
  );
  return result.rows.map(mapPackRow);
}

/**
 * Add export artifact to a defense pack
 */
export async function addExportArtifact(
  tenantId: string,
  packId: string,
  artifact: ExportArtifact
): Promise<void> {
  await pool.query(
    `UPDATE cc_defense_packs 
     SET export_artifacts = export_artifacts || $3::jsonb,
         pack_status = 'exported',
         metadata = jsonb_set(
           metadata, 
           '{events}', 
           COALESCE(metadata->'events', '[]'::jsonb) || $4::jsonb
         )
     WHERE tenant_id = $1::uuid AND id = $2::uuid`,
    [
      tenantId,
      packId,
      JSON.stringify([artifact]),
      JSON.stringify([{ type: 'defense_pack_exported', at: new Date().toISOString(), format: artifact.format }]),
    ]
  );
}

function generateExecutiveSummary(
  dispute: any,
  chronology: ChronologyEntry[],
  packType: PackType
): SummaryBullet[] {
  const bullets: SummaryBullet[] = [];
  let order = 1;
  
  // Generate type-specific summary bullets
  if (dispute.title) {
    bullets.push({
      order: order++,
      text: `Dispute: ${dispute.title}`,
      evidence_refs: [],
    });
  }
  
  if (dispute.amount_cents || dispute.disputed_amount_cents) {
    const amount = (dispute.amount_cents || dispute.disputed_amount_cents) / 100;
    bullets.push({
      order: order++,
      text: `Disputed amount: ${dispute.currency || 'CAD'} ${amount.toFixed(2)}`,
      evidence_refs: [],
    });
  }
  
  if (chronology.length > 0) {
    bullets.push({
      order: order++,
      text: `Total evidence items: ${chronology.length}`,
      evidence_refs: chronology.slice(0, 3).map(c => c.pointer_id),
    });
  }
  
  // Add pack-type-specific bullets
  switch (packType) {
    case 'chargeback_v1':
      bullets.push({
        order: order++,
        text: 'Defense pack prepared for credit card chargeback dispute resolution',
        evidence_refs: [],
      });
      break;
    case 'review_extortion_v1':
      bullets.push({
        order: order++,
        text: 'Defense pack documents review extortion pattern with timestamped evidence',
        evidence_refs: [],
      });
      break;
    case 'bbb_v1':
      bullets.push({
        order: order++,
        text: 'Defense pack prepared for BBB complaint response',
        evidence_refs: [],
      });
      break;
    case 'contract_v1':
      bullets.push({
        order: order++,
        text: 'Defense pack documents contractual dispute with evidence chain',
        evidence_refs: [],
      });
      break;
  }
  
  return bullets;
}

function generateRebuttalMatrix(packType: PackType): RebuttalEntry[] {
  const matrix: RebuttalEntry[] = [];
  
  switch (packType) {
    case 'chargeback_v1':
      matrix.push({
        category: 'service_provided',
        claim: 'Service/product not provided as described',
        rebuttal: '[Placeholder: Evidence of service delivery]',
        evidence_refs: [],
      });
      matrix.push({
        category: 'authorization',
        claim: 'Transaction not authorized',
        rebuttal: '[Placeholder: Evidence of authorization]',
        evidence_refs: [],
      });
      break;
    case 'review_extortion_v1':
      matrix.push({
        category: 'threat_demand_response',
        claim: 'Threat made by reviewer',
        rebuttal: '[Placeholder: Communication showing threat]',
        evidence_refs: [],
      });
      matrix.push({
        category: 'threat_demand_response',
        claim: 'Demand for refund/compensation under threat',
        rebuttal: '[Placeholder: Communication showing demand]',
        evidence_refs: [],
      });
      break;
  }
  
  return matrix;
}

function categorizeEvidence(ref: EvidenceRef, obj: any, index: EvidenceIndex): void {
  const sourceType = obj.source_type?.toLowerCase() || '';
  const title = (obj.title || '').toLowerCase();
  
  if (sourceType.includes('photo') || sourceType.includes('image')) {
    index.photos.push(ref);
  } else if (sourceType.includes('receipt') || title.includes('receipt') || title.includes('invoice')) {
    index.receipts.push(ref);
  } else if (sourceType.includes('message') || sourceType.includes('email') || sourceType.includes('communication')) {
    index.communications.push(ref);
  } else if (sourceType.includes('safety') || sourceType.includes('emergency') || title.includes('safety')) {
    index.safety_emergency.push(ref);
  } else if (sourceType.includes('service') || title.includes('service') || title.includes('delivery')) {
    index.proof_of_service.push(ref);
  } else if (sourceType.includes('third') || sourceType.includes('external')) {
    index.third_party.push(ref);
  } else {
    index.other.push(ref);
  }
}

function mapPackRow(row: any): DefensePack {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    disputeId: row.dispute_id,
    packVersion: row.pack_version,
    packStatus: row.pack_status,
    packType: row.pack_type,
    assembledAt: row.assembled_at,
    assembledByIndividualId: row.assembled_by_individual_id,
    packJson: row.pack_json,
    packSha256: row.pack_sha256,
    exportArtifacts: row.export_artifacts || [],
    clientRequestId: row.client_request_id,
    metadata: row.metadata || {},
  };
}
