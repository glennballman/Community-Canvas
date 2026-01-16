/**
 * P2.6 Insurance Claim Auto-Assembler
 * Dossier assembly engine for carrier-agnostic insurance claim packages
 */

import { db } from '../../db';
import { sql } from 'drizzle-orm';
import { canonicalizeJson, sha256Hex, appendEvidenceEvent, verifyEvidenceChain, compileBundleManifest } from '../evidence/custody';

// ============================================================
// TYPES
// ============================================================

export type PolicyType = 'property' | 'liability' | 'business_interruption' | 'travel' | 'auto' | 'marine' | 'other';
export type ClaimType = 'evacuation' | 'wildfire' | 'flood' | 'tsunami' | 'power_outage' | 'storm' | 'theft' | 'liability' | 'other';
export type ClaimStatus = 'draft' | 'assembled' | 'submitted' | 'under_review' | 'approved' | 'denied' | 'closed';
export type DossierStatus = 'assembled' | 'exported' | 'superseded';

export interface InsurancePolicy {
  id: string;
  tenantId: string;
  circleId: string | null;
  portalId: string | null;
  policyType: PolicyType;
  carrierName: string | null;
  brokerName: string | null;
  policyNumber: string | null;
  namedInsured: string | null;
  effectiveDate: string | null;
  expiryDate: string | null;
  coverageSummary: Record<string, unknown>;
  contacts: Record<string, unknown>;
  createdAt: Date;
  createdByIndividualId: string | null;
  clientRequestId: string | null;
  metadata: Record<string, unknown>;
}

export interface InsuranceClaim {
  id: string;
  tenantId: string;
  circleId: string | null;
  portalId: string | null;
  policyId: string | null;
  claimType: ClaimType;
  claimStatus: ClaimStatus;
  title: string;
  lossOccurredAt: Date | null;
  lossDiscoveredAt: Date | null;
  reportedAt: Date | null;
  claimNumber: string | null;
  lossLocation: Record<string, unknown> | null;
  claimants: Array<Record<string, unknown>>;
  summary: string | null;
  createdAt: Date;
  createdByIndividualId: string | null;
  clientRequestId: string | null;
  metadata: Record<string, unknown>;
}

export interface ClaimInput {
  id: string;
  tenantId: string;
  claimId: string;
  bundleId: string | null;
  bundleManifestSha256: string | null;
  evidenceObjectId: string | null;
  evidenceContentSha256: string | null;
  attachedAt: Date;
  attachedByIndividualId: string | null;
  label: string | null;
  notes: string | null;
}

export interface ClaimDossier {
  id: string;
  tenantId: string;
  claimId: string;
  dossierVersion: number;
  dossierStatus: DossierStatus;
  assembledAt: Date;
  assembledByIndividualId: string | null;
  dossierJson: DossierContent;
  dossierSha256: string;
  exportArtifacts: Array<Record<string, unknown>>;
  clientRequestId: string | null;
  metadata: Record<string, unknown>;
}

export interface DossierContent {
  cover: {
    claimTitle: string;
    claimType: ClaimType;
    claimStatus: ClaimStatus;
    createdAt: string;
    createdBy: string | null;
    policySummary: Record<string, unknown> | null;
    claimants: Array<Record<string, unknown>>;
  };
  lossDetails: {
    occurredAt: string | null;
    discoveredAt: string | null;
    reportedAt: string | null;
    location: Record<string, unknown> | null;
    summary: string | null;
  };
  timeline: Array<{
    evidenceId: string;
    sourceType: string;
    title: string | null;
    occurredAt: string | null;
    createdAt: string;
    capturedAt: string | null;
    contentSha256: string;
    tipEventHash: string | null;
    pointer: string | null;
    label: string | null;
  }>;
  evidenceIndex: Record<string, Array<{
    evidenceId: string;
    title: string | null;
    contentSha256: string;
  }>>;
  verification: {
    bundleManifestSha256s: string[];
    evidenceContentSha256s: string[];
    dossierSha256: string;
    assemblyAlgorithmVersion: string;
    assembledAt: string;
  };
}

export interface AttachClaimInputOptions {
  claimId: string;
  tenantId: string;
  bundleId?: string;
  evidenceObjectId?: string;
  attachedByIndividualId?: string;
  label?: string;
  notes?: string;
}

export interface AssembleClaimDossierOptions {
  claimId: string;
  tenantId: string;
  assembledByIndividualId?: string;
  clientRequestId?: string;
  forceNewVersion?: boolean;
}

// ============================================================
// CONSTANTS
// ============================================================

const ASSEMBLY_ALGORITHM_VERSION = 'claim_dossier_v1';

const EVIDENCE_CATEGORIES: Record<string, string[]> = {
  'evacuation_orders': ['evacuation', 'order', 'emergency'],
  'utilities_outages': ['outage', 'power', 'hydro', 'utility'],
  'media_reports': ['news', 'report', 'media', 'article'],
  'photos_videos': ['photo', 'video', 'image', 'media'],
  'notes_statements': ['note', 'statement', 'witness', 'testimony'],
  'telemetry_snapshots': ['telemetry', 'snapshot', 'sensor', 'data'],
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function categorizeEvidence(label: string | null, title: string | null): string {
  const searchText = `${label || ''} ${title || ''}`.toLowerCase();
  
  for (const [category, keywords] of Object.entries(EVIDENCE_CATEGORIES)) {
    if (keywords.some(kw => searchText.includes(kw))) {
      return category;
    }
  }
  return 'other';
}

function toIsoString(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  if (typeof date === 'string') return date;
  return date.toISOString();
}

// ============================================================
// ATTACHMENT FUNCTIONS
// ============================================================

/**
 * Attach a sealed evidence bundle or object to a claim
 * Enforces sealed-only inputs
 */
export async function attachClaimInput(options: AttachClaimInputOptions): Promise<ClaimInput> {
  const { claimId, tenantId, bundleId, evidenceObjectId, attachedByIndividualId, label, notes } = options;

  // Validate exactly one source is provided
  if ((!bundleId && !evidenceObjectId) || (bundleId && evidenceObjectId)) {
    throw new Error('Must provide exactly one of bundleId or evidenceObjectId');
  }

  let bundleManifestSha256: string | null = null;
  let evidenceContentSha256: string | null = null;

  if (bundleId) {
    // Verify bundle is sealed
    const bundleResult = await db.execute(sql`
      SELECT bundle_status, manifest_sha256 FROM cc_evidence_bundles
      WHERE id = ${bundleId} AND tenant_id = ${tenantId}
    `);
    
    if (bundleResult.rows.length === 0) {
      throw new Error('Evidence bundle not found');
    }
    
    const bundle = bundleResult.rows[0] as { bundle_status: string; manifest_sha256: string | null };
    if (bundle.bundle_status !== 'sealed') {
      throw new Error('Cannot attach unsealed bundle. Bundle must be sealed before attaching to claim.');
    }
    
    bundleManifestSha256 = bundle.manifest_sha256;
  }

  if (evidenceObjectId) {
    // Verify evidence object is sealed
    const objectResult = await db.execute(sql`
      SELECT chain_status, content_sha256 FROM cc_evidence_objects
      WHERE id = ${evidenceObjectId} AND tenant_id = ${tenantId}
    `);
    
    if (objectResult.rows.length === 0) {
      throw new Error('Evidence object not found');
    }
    
    const obj = objectResult.rows[0] as { chain_status: string; content_sha256: string };
    if (obj.chain_status !== 'sealed') {
      throw new Error('Cannot attach unsealed evidence object. Object must be sealed before attaching to claim.');
    }
    
    evidenceContentSha256 = obj.content_sha256;
  }

  // Check for duplicate attachment
  if (bundleId) {
    const existing = await db.execute(sql`
      SELECT id FROM cc_claim_inputs
      WHERE tenant_id = ${tenantId} AND claim_id = ${claimId} AND bundle_id = ${bundleId}
    `);
    if (existing.rows.length > 0) {
      throw new Error('Bundle is already attached to this claim');
    }
  }

  if (evidenceObjectId) {
    const existing = await db.execute(sql`
      SELECT id FROM cc_claim_inputs
      WHERE tenant_id = ${tenantId} AND claim_id = ${claimId} AND evidence_object_id = ${evidenceObjectId}
    `);
    if (existing.rows.length > 0) {
      throw new Error('Evidence object is already attached to this claim');
    }
  }

  // Insert the claim input
  const insertResult = await db.execute(sql`
    INSERT INTO cc_claim_inputs (
      tenant_id, claim_id, bundle_id, bundle_manifest_sha256,
      evidence_object_id, evidence_content_sha256,
      attached_by_individual_id, label, notes
    ) VALUES (
      ${tenantId}, ${claimId}, ${bundleId || null}, ${bundleManifestSha256},
      ${evidenceObjectId || null}, ${evidenceContentSha256},
      ${attachedByIndividualId || null}, ${label || null}, ${notes || null}
    )
    RETURNING *
  `);

  const row = insertResult.rows[0] as Record<string, unknown>;
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    claimId: row.claim_id as string,
    bundleId: row.bundle_id as string | null,
    bundleManifestSha256: row.bundle_manifest_sha256 as string | null,
    evidenceObjectId: row.evidence_object_id as string | null,
    evidenceContentSha256: row.evidence_content_sha256 as string | null,
    attachedAt: row.attached_at as Date,
    attachedByIndividualId: row.attached_by_individual_id as string | null,
    label: row.label as string | null,
    notes: row.notes as string | null,
  };
}

// ============================================================
// DOSSIER ASSEMBLY
// ============================================================

/**
 * Assemble a deterministic claim dossier from all attached sealed evidence
 */
export async function assembleClaimDossier(options: AssembleClaimDossierOptions): Promise<ClaimDossier> {
  const { claimId, tenantId, assembledByIndividualId, clientRequestId, forceNewVersion } = options;

  // Get the claim
  const claimResult = await db.execute(sql`
    SELECT * FROM cc_insurance_claims
    WHERE id = ${claimId} AND tenant_id = ${tenantId}
  `);

  if (claimResult.rows.length === 0) {
    throw new Error('Claim not found');
  }

  const claimRow = claimResult.rows[0] as Record<string, unknown>;
  const claim: InsuranceClaim = {
    id: claimRow.id as string,
    tenantId: claimRow.tenant_id as string,
    circleId: claimRow.circle_id as string | null,
    portalId: claimRow.portal_id as string | null,
    policyId: claimRow.policy_id as string | null,
    claimType: claimRow.claim_type as ClaimType,
    claimStatus: claimRow.claim_status as ClaimStatus,
    title: claimRow.title as string,
    lossOccurredAt: claimRow.loss_occurred_at as Date | null,
    lossDiscoveredAt: claimRow.loss_discovered_at as Date | null,
    reportedAt: claimRow.reported_at as Date | null,
    claimNumber: claimRow.claim_number as string | null,
    lossLocation: claimRow.loss_location as Record<string, unknown> | null,
    claimants: (claimRow.claimants as Array<Record<string, unknown>>) || [],
    summary: claimRow.summary as string | null,
    createdAt: claimRow.created_at as Date,
    createdByIndividualId: claimRow.created_by_individual_id as string | null,
    clientRequestId: claimRow.client_request_id as string | null,
    metadata: (claimRow.metadata as Record<string, unknown>) || {},
  };

  // Get policy if linked
  let policySummary: Record<string, unknown> | null = null;
  if (claim.policyId) {
    const policyResult = await db.execute(sql`
      SELECT policy_type, carrier_name, broker_name, policy_number, named_insured,
             effective_date, expiry_date, coverage_summary, contacts
      FROM cc_insurance_policies
      WHERE id = ${claim.policyId} AND tenant_id = ${tenantId}
    `);
    if (policyResult.rows.length > 0) {
      const p = policyResult.rows[0] as Record<string, unknown>;
      policySummary = {
        policyType: p.policy_type,
        carrierName: p.carrier_name,
        brokerName: p.broker_name,
        policyNumber: p.policy_number,
        namedInsured: p.named_insured,
        effectiveDate: p.effective_date,
        expiryDate: p.expiry_date,
        coverageSummary: p.coverage_summary,
        contacts: p.contacts,
      };
    }
  }

  // Get all attached inputs
  const inputsResult = await db.execute(sql`
    SELECT * FROM cc_claim_inputs
    WHERE claim_id = ${claimId} AND tenant_id = ${tenantId}
    ORDER BY attached_at
  `);

  const inputs = inputsResult.rows as Array<Record<string, unknown>>;

  // Validate all inputs are still sealed
  for (const input of inputs) {
    if (input.bundle_id) {
      const bundleCheck = await db.execute(sql`
        SELECT bundle_status FROM cc_evidence_bundles
        WHERE id = ${input.bundle_id as string}
      `);
      if (bundleCheck.rows.length === 0 || (bundleCheck.rows[0] as Record<string, unknown>).bundle_status !== 'sealed') {
        throw new Error(`Bundle ${input.bundle_id} is no longer sealed. Cannot assemble dossier.`);
      }
    }
    if (input.evidence_object_id) {
      const objCheck = await db.execute(sql`
        SELECT chain_status FROM cc_evidence_objects
        WHERE id = ${input.evidence_object_id as string}
      `);
      if (objCheck.rows.length === 0 || (objCheck.rows[0] as Record<string, unknown>).chain_status !== 'sealed') {
        throw new Error(`Evidence object ${input.evidence_object_id} is no longer sealed. Cannot assemble dossier.`);
      }
    }
  }

  // Collect all evidence objects from bundles and direct attachments
  const evidenceItems: Array<{
    evidenceId: string;
    sourceType: string;
    title: string | null;
    occurredAt: Date | null;
    createdAt: Date;
    capturedAt: Date | null;
    contentSha256: string;
    r2Key: string | null;
    url: string | null;
    label: string | null;
    bundleId: string | null;
  }> = [];

  const bundleManifestSha256s: string[] = [];
  const evidenceContentSha256s: string[] = [];

  for (const input of inputs) {
    const inputLabel = input.label as string | null;

    if (input.bundle_id) {
      // Get bundle manifest sha
      const bundleResult = await db.execute(sql`
        SELECT manifest_sha256 FROM cc_evidence_bundles WHERE id = ${input.bundle_id as string}
      `);
      const manifestSha = (bundleResult.rows[0] as Record<string, unknown>)?.manifest_sha256 as string | null;
      if (manifestSha) {
        bundleManifestSha256s.push(manifestSha);
      }

      // Get all evidence objects in this bundle
      const bundleItemsResult = await db.execute(sql`
        SELECT eo.id, eo.source_type, eo.title, eo.occurred_at, eo.created_at,
               eo.captured_at, eo.content_sha256, eo.r2_key, eo.url
        FROM cc_evidence_bundle_items bi
        JOIN cc_evidence_objects eo ON eo.id = bi.evidence_object_id
        WHERE bi.bundle_id = ${input.bundle_id as string}
        ORDER BY eo.occurred_at NULLS LAST, eo.created_at, eo.id
      `);

      for (const item of bundleItemsResult.rows as Array<Record<string, unknown>>) {
        evidenceItems.push({
          evidenceId: item.id as string,
          sourceType: item.source_type as string,
          title: item.title as string | null,
          occurredAt: item.occurred_at as Date | null,
          createdAt: item.created_at as Date,
          capturedAt: item.captured_at as Date | null,
          contentSha256: item.content_sha256 as string,
          r2Key: item.r2_key as string | null,
          url: item.url as string | null,
          label: inputLabel,
          bundleId: input.bundle_id as string,
        });
        evidenceContentSha256s.push(item.content_sha256 as string);
      }
    }

    if (input.evidence_object_id) {
      const objResult = await db.execute(sql`
        SELECT id, source_type, title, occurred_at, created_at, captured_at,
               content_sha256, r2_key, url
        FROM cc_evidence_objects
        WHERE id = ${input.evidence_object_id as string}
      `);

      if (objResult.rows.length > 0) {
        const item = objResult.rows[0] as Record<string, unknown>;
        evidenceItems.push({
          evidenceId: item.id as string,
          sourceType: item.source_type as string,
          title: item.title as string | null,
          occurredAt: item.occurred_at as Date | null,
          createdAt: item.created_at as Date,
          capturedAt: item.captured_at as Date | null,
          contentSha256: item.content_sha256 as string,
          r2Key: item.r2_key as string | null,
          url: item.url as string | null,
          label: inputLabel,
          bundleId: null,
        });
        evidenceContentSha256s.push(item.content_sha256 as string);
      }
    }
  }

  // Get tip event hash for each evidence object
  const tipEventHashes: Record<string, string | null> = {};
  for (const item of evidenceItems) {
    const tipResult = await db.execute(sql`
      SELECT event_sha256 FROM cc_evidence_events
      WHERE evidence_object_id = ${item.evidenceId}
      ORDER BY event_at DESC, id DESC
      LIMIT 1
    `);
    tipEventHashes[item.evidenceId] = tipResult.rows.length > 0 
      ? (tipResult.rows[0] as Record<string, unknown>).event_sha256 as string 
      : null;
  }

  // Sort evidence items: occurred_at nulls last, then created_at, then id
  evidenceItems.sort((a, b) => {
    // Handle occurred_at (nulls last)
    if (a.occurredAt && !b.occurredAt) return -1;
    if (!a.occurredAt && b.occurredAt) return 1;
    if (a.occurredAt && b.occurredAt) {
      const diff = new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime();
      if (diff !== 0) return diff;
    }
    // Then by created_at
    const createdDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (createdDiff !== 0) return createdDiff;
    // Finally by id
    return a.evidenceId.localeCompare(b.evidenceId);
  });

  // Build timeline
  const timeline = evidenceItems.map(item => ({
    evidenceId: item.evidenceId,
    sourceType: item.sourceType,
    title: item.title,
    occurredAt: toIsoString(item.occurredAt),
    createdAt: toIsoString(item.createdAt)!,
    capturedAt: toIsoString(item.capturedAt),
    contentSha256: item.contentSha256,
    tipEventHash: tipEventHashes[item.evidenceId] || null,
    pointer: item.r2Key || item.url || null,
    label: item.label,
  }));

  // Build evidence index (grouped by category)
  const evidenceIndex: Record<string, Array<{ evidenceId: string; title: string | null; contentSha256: string }>> = {};
  for (const item of evidenceItems) {
    const category = categorizeEvidence(item.label, item.title);
    if (!evidenceIndex[category]) {
      evidenceIndex[category] = [];
    }
    evidenceIndex[category].push({
      evidenceId: item.evidenceId,
      title: item.title,
      contentSha256: item.contentSha256,
    });
  }

  // Sort categories and items within categories
  const sortedEvidenceIndex: Record<string, Array<{ evidenceId: string; title: string | null; contentSha256: string }>> = {};
  const sortedCategories = Object.keys(evidenceIndex).sort();
  for (const category of sortedCategories) {
    sortedEvidenceIndex[category] = evidenceIndex[category].sort((a, b) => a.evidenceId.localeCompare(b.evidenceId));
  }

  // Get creator name
  let createdByName: string | null = null;
  if (claim.createdByIndividualId) {
    const creatorResult = await db.execute(sql`
      SELECT full_name FROM cc_individuals WHERE id = ${claim.createdByIndividualId}
    `);
    if (creatorResult.rows.length > 0) {
      createdByName = (creatorResult.rows[0] as Record<string, unknown>).full_name as string;
    }
  }

  // Get next version number
  const versionResult = await db.execute(sql`
    SELECT COALESCE(MAX(dossier_version), 0) as max_version
    FROM cc_claim_dossiers
    WHERE claim_id = ${claimId} AND tenant_id = ${tenantId}
  `);
  const currentMaxVersion = (versionResult.rows[0] as Record<string, unknown>).max_version as number;
  const nextVersion = currentMaxVersion + 1;

  const assembledAt = new Date();

  // Build dossier content (without dossier_sha256 first)
  const dossierContentWithoutHash: Omit<DossierContent, 'verification'> & { verification: Omit<DossierContent['verification'], 'dossierSha256'> } = {
    cover: {
      claimTitle: claim.title,
      claimType: claim.claimType,
      claimStatus: claim.claimStatus,
      createdAt: toIsoString(claim.createdAt)!,
      createdBy: createdByName,
      policySummary,
      claimants: claim.claimants,
    },
    lossDetails: {
      occurredAt: toIsoString(claim.lossOccurredAt),
      discoveredAt: toIsoString(claim.lossDiscoveredAt),
      reportedAt: toIsoString(claim.reportedAt),
      location: claim.lossLocation,
      summary: claim.summary,
    },
    timeline,
    evidenceIndex: sortedEvidenceIndex,
    verification: {
      bundleManifestSha256s: bundleManifestSha256s.sort(),
      evidenceContentSha256s: evidenceContentSha256s.sort(),
      assemblyAlgorithmVersion: ASSEMBLY_ALGORITHM_VERSION,
      assembledAt: assembledAt.toISOString(),
    },
  };

  // Calculate dossier sha256
  const canonicalDossier = canonicalizeJson(dossierContentWithoutHash);
  const dossierSha256 = sha256Hex(canonicalDossier);

  // Complete dossier content
  const dossierContent: DossierContent = {
    ...dossierContentWithoutHash,
    verification: {
      ...dossierContentWithoutHash.verification,
      dossierSha256,
    },
  };

  // Insert dossier
  const insertResult = await db.execute(sql`
    INSERT INTO cc_claim_dossiers (
      tenant_id, claim_id, dossier_version, dossier_status,
      assembled_at, assembled_by_individual_id,
      dossier_json, dossier_sha256, client_request_id
    ) VALUES (
      ${tenantId}, ${claimId}, ${nextVersion}, 'assembled',
      ${assembledAt}, ${assembledByIndividualId || null},
      ${JSON.stringify(dossierContent)}::jsonb, ${dossierSha256}, ${clientRequestId || null}
    )
    RETURNING *
  `);

  // Mark previous versions as superseded
  if (currentMaxVersion > 0) {
    await db.execute(sql`
      UPDATE cc_claim_dossiers
      SET dossier_status = 'superseded'
      WHERE claim_id = ${claimId} AND tenant_id = ${tenantId} 
      AND dossier_version < ${nextVersion}
      AND dossier_status = 'assembled'
    `);
  }

  // Update claim status to assembled
  await db.execute(sql`
    UPDATE cc_insurance_claims
    SET claim_status = 'assembled'
    WHERE id = ${claimId} AND tenant_id = ${tenantId}
  `);

  const row = insertResult.rows[0] as Record<string, unknown>;
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    claimId: row.claim_id as string,
    dossierVersion: row.dossier_version as number,
    dossierStatus: row.dossier_status as DossierStatus,
    assembledAt: row.assembled_at as Date,
    assembledByIndividualId: row.assembled_by_individual_id as string | null,
    dossierJson: row.dossier_json as DossierContent,
    dossierSha256: row.dossier_sha256 as string,
    exportArtifacts: (row.export_artifacts as Array<Record<string, unknown>>) || [],
    clientRequestId: row.client_request_id as string | null,
    metadata: (row.metadata as Record<string, unknown>) || {},
  };
}

// ============================================================
// EXPORT FUNCTIONS
// ============================================================

export interface ExportDossierOptions {
  dossierId: string;
  tenantId: string;
  format: 'zip_json';
  exportedByIndividualId?: string;
}

export interface ExportResult {
  dossierId: string;
  r2Key: string;
  format: string;
  exportedAt: Date;
}

/**
 * Export a dossier to R2 storage as ZIP
 * Note: This is a stub that prepares the data - actual R2 upload handled by caller
 */
export async function prepareDossierExport(options: ExportDossierOptions): Promise<{
  dossier: ClaimDossier;
  exportData: {
    dossierJson: DossierContent;
    inputsJson: Array<{
      bundleId: string | null;
      bundleManifestSha256: string | null;
      evidenceObjectId: string | null;
      evidenceContentSha256: string | null;
    }>;
  };
}> {
  const { dossierId, tenantId } = options;

  // Get dossier
  const dossierResult = await db.execute(sql`
    SELECT * FROM cc_claim_dossiers
    WHERE id = ${dossierId} AND tenant_id = ${tenantId}
  `);

  if (dossierResult.rows.length === 0) {
    throw new Error('Dossier not found');
  }

  const row = dossierResult.rows[0] as Record<string, unknown>;
  const dossier: ClaimDossier = {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    claimId: row.claim_id as string,
    dossierVersion: row.dossier_version as number,
    dossierStatus: row.dossier_status as DossierStatus,
    assembledAt: row.assembled_at as Date,
    assembledByIndividualId: row.assembled_by_individual_id as string | null,
    dossierJson: row.dossier_json as DossierContent,
    dossierSha256: row.dossier_sha256 as string,
    exportArtifacts: (row.export_artifacts as Array<Record<string, unknown>>) || [],
    clientRequestId: row.client_request_id as string | null,
    metadata: (row.metadata as Record<string, unknown>) || {},
  };

  // Get inputs for this claim
  const inputsResult = await db.execute(sql`
    SELECT bundle_id, bundle_manifest_sha256, evidence_object_id, evidence_content_sha256
    FROM cc_claim_inputs
    WHERE claim_id = ${dossier.claimId} AND tenant_id = ${tenantId}
    ORDER BY attached_at
  `);

  const inputsJson = (inputsResult.rows as Array<Record<string, unknown>>).map(r => ({
    bundleId: r.bundle_id as string | null,
    bundleManifestSha256: r.bundle_manifest_sha256 as string | null,
    evidenceObjectId: r.evidence_object_id as string | null,
    evidenceContentSha256: r.evidence_content_sha256 as string | null,
  }));

  return {
    dossier,
    exportData: {
      dossierJson: dossier.dossierJson,
      inputsJson,
    },
  };
}

/**
 * Record export completion and append evidence events
 */
export async function recordDossierExport(options: {
  dossierId: string;
  tenantId: string;
  r2Key: string;
  format: string;
  exportedByIndividualId?: string;
}): Promise<void> {
  const { dossierId, tenantId, r2Key, format, exportedByIndividualId } = options;

  // Update dossier with export artifact
  await db.execute(sql`
    UPDATE cc_claim_dossiers
    SET 
      dossier_status = 'exported',
      export_artifacts = export_artifacts || ${JSON.stringify([{ r2Key, format, exportedAt: new Date().toISOString() }])}::jsonb
    WHERE id = ${dossierId} AND tenant_id = ${tenantId}
  `);

  // Get all evidence objects from this dossier's claim inputs
  const dossierResult = await db.execute(sql`
    SELECT claim_id FROM cc_claim_dossiers WHERE id = ${dossierId}
  `);
  
  if (dossierResult.rows.length === 0) return;
  
  const claimId = (dossierResult.rows[0] as Record<string, unknown>).claim_id as string;

  // Get all evidence object IDs (from direct attachments and bundles)
  const directEvidence = await db.execute(sql`
    SELECT evidence_object_id FROM cc_claim_inputs
    WHERE claim_id = ${claimId} AND evidence_object_id IS NOT NULL
  `);

  const bundleEvidence = await db.execute(sql`
    SELECT bi.evidence_object_id
    FROM cc_claim_inputs ci
    JOIN cc_evidence_bundle_items bi ON bi.bundle_id = ci.bundle_id
    WHERE ci.claim_id = ${claimId} AND ci.bundle_id IS NOT NULL
  `);

  const evidenceIds = new Set<string>();
  for (const row of directEvidence.rows as Array<Record<string, unknown>>) {
    if (row.evidence_object_id) evidenceIds.add(row.evidence_object_id as string);
  }
  for (const row of bundleEvidence.rows as Array<Record<string, unknown>>) {
    if (row.evidence_object_id) evidenceIds.add(row.evidence_object_id as string);
  }

  // Append 'exported' event to each evidence object (deduped)
  for (const evidenceId of Array.from(evidenceIds)) {
    try {
      await appendEvidenceEvent({
        evidenceId,
        tenantId,
        eventType: 'exported',
        payload: {
          dossierId,
          claimId,
          r2Key,
          format,
        },
        actorIndividualId: exportedByIndividualId,
        clientRequestId: `dossier-export-${dossierId}-${evidenceId}`,
      });
    } catch (err) {
      // Ignore duplicate event errors (idempotency)
      if (!(err instanceof Error) || !err.message.includes('client_request_id')) {
        throw err;
      }
    }
  }
}
