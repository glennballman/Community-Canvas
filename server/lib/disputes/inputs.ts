/**
 * P2.10 Dispute Input Attachment
 * Sealed-only enforcement for attaching evidence to disputes
 */

import { pool } from '../../db';

export interface AttachDisputeInputParams {
  tenantId: string;
  disputeId: string;
  inputType: 'evidence_bundle' | 'evidence_object' | 'claim_dossier' | 'insurance_claim';
  inputId: string;
  label?: string;
  notes?: string;
  attachedByIndividualId?: string;
}

export interface DisputeInput {
  id: string;
  tenantId: string;
  disputeId: string;
  inputType: string;
  inputId: string;
  copiedSha256: string;
  label: string | null;
  notes: string | null;
  attachedAt: Date;
  attachedByIndividualId: string | null;
}

/**
 * Attach an input to a dispute with sealed-only enforcement
 * - evidence_bundle: must be sealed, copies manifest_sha256
 * - evidence_object: must have chain_status='sealed', copies content_sha256
 * - claim_dossier: copies dossier_sha256
 * - insurance_claim: must have at least one dossier or sealed bundle inputs
 */
export async function attachDisputeInput(params: AttachDisputeInputParams): Promise<DisputeInput> {
  const { tenantId, disputeId, inputType, inputId, label, notes, attachedByIndividualId } = params;
  
  // Verify dispute exists
  const disputeResult = await pool.query(
    `SELECT id FROM cc_disputes WHERE tenant_id = $1::uuid AND id = $2::uuid`,
    [tenantId, disputeId]
  );
  if (disputeResult.rows.length === 0) {
    throw new Error('Dispute not found');
  }
  
  let copiedSha256: string;
  
  switch (inputType) {
    case 'evidence_bundle': {
      // Must be sealed, get manifest_sha256
      const bundleResult = await pool.query<any>(
        `SELECT id, bundle_status, manifest_sha256 
         FROM cc_evidence_bundles 
         WHERE tenant_id = $1::uuid AND id = $2::uuid`,
        [tenantId, inputId]
      );
      
      if (bundleResult.rows.length === 0) {
        throw new Error('Evidence bundle not found');
      }
      
      const bundle = bundleResult.rows[0];
      if (bundle.bundle_status !== 'sealed') {
        throw new Error(`Evidence bundle must be sealed (current status: ${bundle.bundle_status})`);
      }
      if (!bundle.manifest_sha256) {
        throw new Error('Evidence bundle is missing manifest_sha256');
      }
      
      copiedSha256 = bundle.manifest_sha256;
      break;
    }
    
    case 'evidence_object': {
      // Must have chain_status='sealed', get content_sha256
      const objectResult = await pool.query<any>(
        `SELECT id, chain_status, content_sha256 
         FROM cc_evidence_objects 
         WHERE tenant_id = $1::uuid AND id = $2::uuid`,
        [tenantId, inputId]
      );
      
      if (objectResult.rows.length === 0) {
        throw new Error('Evidence object not found');
      }
      
      const obj = objectResult.rows[0];
      if (obj.chain_status !== 'sealed') {
        throw new Error(`Evidence object must be sealed (current status: ${obj.chain_status})`);
      }
      if (!obj.content_sha256) {
        throw new Error('Evidence object is missing content_sha256');
      }
      
      copiedSha256 = obj.content_sha256;
      break;
    }
    
    case 'claim_dossier': {
      // Get dossier_sha256
      const dossierResult = await pool.query<any>(
        `SELECT id, dossier_sha256 
         FROM cc_claim_dossiers 
         WHERE tenant_id = $1::uuid AND id = $2::uuid`,
        [tenantId, inputId]
      );
      
      if (dossierResult.rows.length === 0) {
        throw new Error('Claim dossier not found');
      }
      
      const dossier = dossierResult.rows[0];
      if (!dossier.dossier_sha256) {
        throw new Error('Claim dossier is missing dossier_sha256');
      }
      
      copiedSha256 = dossier.dossier_sha256;
      break;
    }
    
    case 'insurance_claim': {
      // Must have at least one dossier or sealed bundle input
      const claimResult = await pool.query<any>(
        `SELECT id FROM cc_insurance_claims 
         WHERE tenant_id = $1::uuid AND id = $2::uuid`,
        [tenantId, inputId]
      );
      
      if (claimResult.rows.length === 0) {
        throw new Error('Insurance claim not found');
      }
      
      // Check for dossiers
      const dossiersResult = await pool.query<any>(
        `SELECT dossier_sha256 FROM cc_claim_dossiers 
         WHERE tenant_id = $1::uuid AND claim_id = $2::uuid 
         ORDER BY version DESC LIMIT 1`,
        [tenantId, inputId]
      );
      
      if (dossiersResult.rows.length > 0 && dossiersResult.rows[0].dossier_sha256) {
        // Use latest dossier sha
        copiedSha256 = dossiersResult.rows[0].dossier_sha256;
      } else {
        // Check for sealed bundle inputs
        const inputsResult = await pool.query<any>(
          `SELECT ci.sha256_at_attach 
           FROM cc_claim_inputs ci
           JOIN cc_evidence_bundles eb ON ci.input_id = eb.id
           WHERE ci.tenant_id = $1::uuid 
             AND ci.claim_id = $2::uuid
             AND ci.input_type = 'evidence_bundle'
             AND eb.bundle_status = 'sealed'
           LIMIT 1`,
          [tenantId, inputId]
        );
        
        if (inputsResult.rows.length === 0) {
          throw new Error('Insurance claim must have at least one dossier or sealed bundle input');
        }
        
        copiedSha256 = inputsResult.rows[0].sha256_at_attach;
      }
      break;
    }
    
    default:
      throw new Error(`Unknown input type: ${inputType}`);
  }
  
  // Insert the dispute input
  const result = await pool.query<any>(
    `INSERT INTO cc_dispute_inputs 
     (tenant_id, dispute_id, input_type, input_id, copied_sha256, label, notes, attached_by_individual_id)
     VALUES ($1::uuid, $2::uuid, $3, $4::uuid, $5, $6, $7, $8::uuid)
     ON CONFLICT (tenant_id, dispute_id, input_type, input_id) DO UPDATE
     SET label = EXCLUDED.label,
         notes = EXCLUDED.notes
     RETURNING *`,
    [tenantId, disputeId, inputType, inputId, copiedSha256, label || null, notes || null, attachedByIndividualId || null]
  );
  
  return mapInputRow(result.rows[0]);
}

/**
 * List inputs attached to a dispute
 */
export async function listDisputeInputs(tenantId: string, disputeId: string): Promise<DisputeInput[]> {
  const result = await pool.query<any>(
    `SELECT * FROM cc_dispute_inputs 
     WHERE tenant_id = $1::uuid AND dispute_id = $2::uuid
     ORDER BY attached_at ASC`,
    [tenantId, disputeId]
  );
  
  return result.rows.map(mapInputRow);
}

/**
 * Remove an input from a dispute
 */
export async function removeDisputeInput(tenantId: string, disputeId: string, inputId: string): Promise<void> {
  await pool.query(
    `DELETE FROM cc_dispute_inputs 
     WHERE tenant_id = $1::uuid AND dispute_id = $2::uuid AND id = $3::uuid`,
    [tenantId, disputeId, inputId]
  );
}

function mapInputRow(row: any): DisputeInput {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    disputeId: row.dispute_id,
    inputType: row.input_type,
    inputId: row.input_id,
    copiedSha256: row.copied_sha256,
    label: row.label,
    notes: row.notes,
    attachedAt: row.attached_at,
    attachedByIndividualId: row.attached_by_individual_id,
  };
}
