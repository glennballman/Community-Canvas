import { db } from '../../db';
import { sql } from 'drizzle-orm';
import { randomUUID, createHash } from 'crypto';

export type DrillScenarioType = 'tsunami' | 'wildfire' | 'power_outage' | 'storm' | 'evacuation' | 'multi_hazard' | 'other';

interface DrillScenarioConfig {
  type: DrillScenarioType;
  baseTitle: string;
  evidenceCount: number;
  hasEmergencyRun: boolean;
  hasDispute: boolean;
  hasClaim: boolean;
}

const SCENARIO_CONFIGS: Record<DrillScenarioType, DrillScenarioConfig> = {
  tsunami: {
    type: 'tsunami',
    baseTitle: 'Tsunami Warning Response Drill',
    evidenceCount: 5,
    hasEmergencyRun: true,
    hasDispute: false,
    hasClaim: true,
  },
  wildfire: {
    type: 'wildfire',
    baseTitle: 'Wildfire Evacuation Drill',
    evidenceCount: 8,
    hasEmergencyRun: true,
    hasDispute: true,
    hasClaim: true,
  },
  power_outage: {
    type: 'power_outage',
    baseTitle: 'Extended Power Outage Response Drill',
    evidenceCount: 4,
    hasEmergencyRun: true,
    hasDispute: false,
    hasClaim: false,
  },
  storm: {
    type: 'storm',
    baseTitle: 'Winter Storm Response Drill',
    evidenceCount: 6,
    hasEmergencyRun: true,
    hasDispute: false,
    hasClaim: true,
  },
  evacuation: {
    type: 'evacuation',
    baseTitle: 'Community Evacuation Drill',
    evidenceCount: 7,
    hasEmergencyRun: true,
    hasDispute: false,
    hasClaim: false,
  },
  multi_hazard: {
    type: 'multi_hazard',
    baseTitle: 'Multi-Hazard Response Drill',
    evidenceCount: 10,
    hasEmergencyRun: true,
    hasDispute: true,
    hasClaim: true,
  },
  other: {
    type: 'other',
    baseTitle: 'Custom Drill Scenario',
    evidenceCount: 3,
    hasEmergencyRun: false,
    hasDispute: false,
    hasClaim: false,
  },
};

interface GeneratedDrillRecords {
  drillSessionId: string;
  emergencyRunIds: string[];
  recordCaptureIds: string[];
  evidenceBundleIds: string[];
  evidenceObjectIds: string[];
  claimIds: string[];
  dossierIds: string[];
  disputeIds: string[];
  defensePackIds: string[];
}

interface StartDrillOptions {
  tenantId: string;
  scenarioType: DrillScenarioType;
  title?: string;
  portalId?: string;
  circleId?: string;
  startedByIndividualId?: string;
  clientRequestId?: string;
  metadata?: Record<string, unknown>;
}

export async function startDrillSession(options: StartDrillOptions): Promise<string> {
  const config = SCENARIO_CONFIGS[options.scenarioType];
  const drillId = randomUUID();
  const title = options.title ?? config.baseTitle;
  const metadataJson = JSON.stringify(options.metadata ?? {});
  
  await db.execute(sql`
    INSERT INTO cc_drill_sessions (
      id, tenant_id, portal_id, circle_id, title, scenario_type, status,
      started_by_individual_id, client_request_id, metadata
    ) VALUES (
      ${drillId}, ${options.tenantId}, ${options.portalId ?? null}, ${options.circleId ?? null},
      ${title}, ${options.scenarioType}, 'active',
      ${options.startedByIndividualId ?? null}, ${options.clientRequestId ?? null}, ${metadataJson}::jsonb
    )
  `);
  
  return drillId;
}

export async function completeDrillSession(
  drillId: string,
  completedByIndividualId?: string,
  notes?: string
): Promise<void> {
  await db.execute(sql`
    UPDATE cc_drill_sessions
    SET status = 'completed', completed_at = now(), 
        completed_by_individual_id = ${completedByIndividualId ?? null}, 
        notes = ${notes ?? null}
    WHERE id = ${drillId}
  `);
}

export async function cancelDrillSession(drillId: string): Promise<void> {
  await db.execute(sql`
    UPDATE cc_drill_sessions 
    SET status = 'cancelled', completed_at = now() 
    WHERE id = ${drillId}
  `);
}

export async function generateSyntheticRecords(
  drillId: string,
  tenantId: string,
  scenarioType: DrillScenarioType
): Promise<GeneratedDrillRecords> {
  const config = SCENARIO_CONFIGS[scenarioType];
  const result: GeneratedDrillRecords = {
    drillSessionId: drillId,
    emergencyRunIds: [],
    recordCaptureIds: [],
    evidenceBundleIds: [],
    evidenceObjectIds: [],
    claimIds: [],
    dossierIds: [],
    disputeIds: [],
    defensePackIds: [],
  };

  const baseMetadata = JSON.stringify({ scenarioType, synthetic: true });

  if (config.hasEmergencyRun) {
    const runId = randomUUID();
    const runTitle = `[DRILL] ${config.baseTitle} - Emergency Run`;
    await db.execute(sql`
      INSERT INTO cc_emergency_runs (
        id, tenant_id, title, status, started_at, is_drill, drill_id, metadata
      ) VALUES (
        ${runId}, ${tenantId}, ${runTitle}, 'active', now(), true, ${drillId}, ${baseMetadata}::jsonb
      )
    `);
    result.emergencyRunIds.push(runId);
  }

  const bundleId = randomUUID();
  const bundleHash = createHash('sha256').update(`drill-bundle-${bundleId}-${Date.now()}`).digest('hex');
  const bundleTitle = `[DRILL] Evidence Bundle - ${config.baseTitle}`;
  await db.execute(sql`
    INSERT INTO cc_evidence_bundles (
      id, tenant_id, title, bundle_type, status, content_hash, is_drill, drill_id, metadata
    ) VALUES (
      ${bundleId}, ${tenantId}, ${bundleTitle}, 'drill_bundle', 'open', ${bundleHash}, true, ${drillId}, ${baseMetadata}::jsonb
    )
  `);
  result.evidenceBundleIds.push(bundleId);

  for (let i = 0; i < config.evidenceCount; i++) {
    const objectId = randomUUID();
    const objectHash = createHash('sha256').update(`drill-evidence-${objectId}-${i}-${Date.now()}`).digest('hex');
    const objMetadata = JSON.stringify({ scenarioType, synthetic: true, index: i });
    await db.execute(sql`
      INSERT INTO cc_evidence_objects (
        id, tenant_id, bundle_id, object_type, content_hash, captured_at, is_drill, drill_id, metadata
      ) VALUES (
        ${objectId}, ${tenantId}, ${bundleId}, 'document', ${objectHash}, now(), true, ${drillId}, ${objMetadata}::jsonb
      )
    `);
    result.evidenceObjectIds.push(objectId);
  }

  const captureId = randomUUID();
  await db.execute(sql`
    INSERT INTO cc_record_captures (
      id, tenant_id, capture_type, status, captured_at, is_drill, drill_id, metadata
    ) VALUES (
      ${captureId}, ${tenantId}, 'drill_capture', 'captured', now(), true, ${drillId}, ${baseMetadata}::jsonb
    )
  `);
  result.recordCaptureIds.push(captureId);

  if (config.hasClaim) {
    const claimId = randomUUID();
    const claimNumber = `DRILL-CLM-${Date.now().toString(36).toUpperCase()}`;
    await db.execute(sql`
      INSERT INTO cc_insurance_claims (
        id, tenant_id, claim_number, status, filed_at, is_drill, drill_id, metadata
      ) VALUES (
        ${claimId}, ${tenantId}, ${claimNumber}, 'draft', now(), true, ${drillId}, ${baseMetadata}::jsonb
      )
    `);
    result.claimIds.push(claimId);

    const dossierId = randomUUID();
    await db.execute(sql`
      INSERT INTO cc_claim_dossiers (
        id, tenant_id, claim_id, status, assembled_at, is_drill, drill_id, metadata
      ) VALUES (
        ${dossierId}, ${tenantId}, ${claimId}, 'draft', now(), true, ${drillId}, ${baseMetadata}::jsonb
      )
    `);
    result.dossierIds.push(dossierId);
  }

  if (config.hasDispute) {
    const disputeId = randomUUID();
    await db.execute(sql`
      INSERT INTO cc_disputes (
        id, tenant_id, dispute_type, status, opened_at, is_drill, drill_id, metadata
      ) VALUES (
        ${disputeId}, ${tenantId}, 'drill_dispute', 'open', now(), true, ${drillId}, ${baseMetadata}::jsonb
      )
    `);
    result.disputeIds.push(disputeId);

    const packId = randomUUID();
    await db.execute(sql`
      INSERT INTO cc_defense_packs (
        id, tenant_id, dispute_id, status, assembled_at, is_drill, drill_id, metadata
      ) VALUES (
        ${packId}, ${tenantId}, ${disputeId}, 'draft', now(), true, ${drillId}, ${baseMetadata}::jsonb
      )
    `);
    result.defensePackIds.push(packId);
  }

  return result;
}

export async function getDrillSession(drillId: string): Promise<Record<string, unknown> | null> {
  const result = await db.execute(sql`
    SELECT * FROM cc_drill_sessions WHERE id = ${drillId}
  `);
  return (result.rows[0] as Record<string, unknown>) ?? null;
}

export async function listDrillSessions(
  tenantId: string,
  status?: 'active' | 'completed' | 'cancelled',
  limit = 50
): Promise<Record<string, unknown>[]> {
  if (status) {
    const result = await db.execute(sql`
      SELECT * FROM cc_drill_sessions 
      WHERE tenant_id = ${tenantId} AND status = ${status}
      ORDER BY started_at DESC 
      LIMIT ${limit}
    `);
    return result.rows as Record<string, unknown>[];
  }
  
  const result = await db.execute(sql`
    SELECT * FROM cc_drill_sessions 
    WHERE tenant_id = ${tenantId}
    ORDER BY started_at DESC 
    LIMIT ${limit}
  `);
  return result.rows as Record<string, unknown>[];
}

interface CreateDrillScriptOptions {
  tenantId: string;
  title: string;
  scenarioType: DrillScenarioType;
  scriptJson: Record<string, unknown>;
  createdByIndividualId?: string;
  metadata?: Record<string, unknown>;
}

export async function createDrillScript(options: CreateDrillScriptOptions): Promise<string> {
  const scriptId = randomUUID();
  const scriptJsonStr = JSON.stringify(options.scriptJson);
  const scriptSha256 = createHash('sha256').update(scriptJsonStr).digest('hex');
  const metadataJson = JSON.stringify(options.metadata ?? {});
  
  await db.execute(sql`
    INSERT INTO cc_drill_scripts (
      id, tenant_id, title, scenario_type, script_json, script_sha256,
      created_by_individual_id, metadata
    ) VALUES (
      ${scriptId}, ${options.tenantId}, ${options.title}, ${options.scenarioType},
      ${scriptJsonStr}::jsonb, ${scriptSha256}, ${options.createdByIndividualId ?? null}, ${metadataJson}::jsonb
    )
    ON CONFLICT (tenant_id, script_sha256) DO UPDATE SET title = EXCLUDED.title
  `);
  
  return scriptId;
}

export async function getDrillScript(scriptId: string): Promise<Record<string, unknown> | null> {
  const result = await db.execute(sql`
    SELECT * FROM cc_drill_scripts WHERE id = ${scriptId}
  `);
  return (result.rows[0] as Record<string, unknown>) ?? null;
}

export async function listDrillScripts(
  tenantId: string,
  scenarioType?: DrillScenarioType,
  limit = 50
): Promise<Record<string, unknown>[]> {
  if (scenarioType) {
    const result = await db.execute(sql`
      SELECT * FROM cc_drill_scripts 
      WHERE tenant_id = ${tenantId} AND scenario_type = ${scenarioType}
      ORDER BY created_at DESC 
      LIMIT ${limit}
    `);
    return result.rows as Record<string, unknown>[];
  }
  
  const result = await db.execute(sql`
    SELECT * FROM cc_drill_scripts 
    WHERE tenant_id = ${tenantId}
    ORDER BY created_at DESC 
    LIMIT ${limit}
  `);
  return result.rows as Record<string, unknown>[];
}

export async function getDrillRecordCounts(drillId: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  
  const tables = [
    ['emergency_runs', 'cc_emergency_runs'],
    ['record_captures', 'cc_record_captures'],
    ['evidence_bundles', 'cc_evidence_bundles'],
    ['evidence_objects', 'cc_evidence_objects'],
    ['insurance_claims', 'cc_insurance_claims'],
    ['claim_dossiers', 'cc_claim_dossiers'],
    ['disputes', 'cc_disputes'],
    ['defense_packs', 'cc_defense_packs'],
  ];
  
  for (const [key, table] of tables) {
    const result = await db.execute(sql.raw(`
      SELECT count(*)::int as cnt FROM ${table} WHERE drill_id = '${drillId}'
    `));
    counts[key] = (result.rows[0] as { cnt: number })?.cnt ?? 0;
  }
  
  return counts;
}

export async function purgeDrillRecords(drillId: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  
  const tables = [
    ['defense_packs', 'cc_defense_packs'],
    ['disputes', 'cc_disputes'],
    ['claim_dossiers', 'cc_claim_dossiers'],
    ['insurance_claims', 'cc_insurance_claims'],
    ['evidence_objects', 'cc_evidence_objects'],
    ['evidence_bundles', 'cc_evidence_bundles'],
    ['record_captures', 'cc_record_captures'],
    ['emergency_runs', 'cc_emergency_runs'],
  ];
  
  for (const [key, table] of tables) {
    const result = await db.execute(sql.raw(`
      DELETE FROM ${table} WHERE drill_id = '${drillId}' RETURNING id
    `));
    counts[key] = result.rows.length;
  }
  
  return counts;
}
