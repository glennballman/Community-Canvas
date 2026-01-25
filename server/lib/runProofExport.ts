/**
 * STEP 11C Phase 2C-10: Run Proof Export Builder
 * Produces deterministic, portable evidence bundles for run negotiations
 */

import { pool } from '../db';
import { loadNegotiationPolicyWithTrace } from './negotiation-policy';
import { sanitizeProposalContext, type SanitizedProposalContext } from './proposalContext';
import type { NegotiationType, ResolvedNegotiationPolicy, NegotiationPolicyTrace } from '@shared/schema';

export const EXPORT_SCHEMA_VERSION = 'cc.v3_5.step11c.2c10.run_proof_export.v1';

export interface AuditEventExport {
  id: string;
  created_at: string;
  portal_id: string | null;
  run_id: string;
  actor_type: string;
  actor_individual_id: string | null;
  negotiation_type: string;
  effective_source: string;
  effective_policy_id: string;
  effective_policy_updated_at: string;
  effective_policy_hash: string;
  request_fingerprint: string;
}

export interface NegotiationEventExport {
  id: string;
  created_at: string;
  event_type: string;
  actor_type: string | null;
  status: string | null;
  message: string | null;
  proposed_start: string | null;
  proposed_end: string | null;
  proposal_context: SanitizedProposalContext | null;
}

export interface NegotiationLatest {
  status: string;
  last_event_at: string | null;
  turn_count: number;
}

export interface RunProofExport {
  schema_version: string;
  exported_at: string;
  portal_id: string | null;
  run_id: string;
  negotiation_type: string;
  policy_trace: NegotiationPolicyTrace;
  policy: ResolvedNegotiationPolicy;
  audit_events: AuditEventExport[];
  negotiation: {
    latest: NegotiationLatest;
    events: NegotiationEventExport[];
  };
}

export interface BuildExportOptions {
  tenantId: string;
  portalId?: string | null;
  runId: string;
  negotiationType?: NegotiationType;
  format?: 'json' | 'csv';
  exportedAtOverride?: string;
}

export interface ExportResult {
  json: string;
  csv?: string;
  filename: string;
  mimeType: string;
}

function formatTimestamp(date: Date | string | null): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString();
}

function stableSort<T>(arr: T[], ...comparators: ((a: T, b: T) => number)[]): T[] {
  return [...arr].sort((a, b) => {
    for (const cmp of comparators) {
      const result = cmp(a, b);
      if (result !== 0) return result;
    }
    return 0;
  });
}

async function queryAuditEvents(tenantId: string, runId: string): Promise<AuditEventExport[]> {
  const result = await pool.query(
    `SELECT 
      id,
      created_at,
      portal_id,
      run_id,
      actor_type,
      actor_individual_id,
      negotiation_type,
      effective_source,
      effective_policy_id,
      effective_policy_updated_at,
      effective_policy_hash,
      request_fingerprint
    FROM cc_negotiation_policy_audit_events
    WHERE tenant_id = $1 AND run_id = $2
    ORDER BY created_at ASC, id ASC`,
    [tenantId, runId]
  );

  return result.rows.map((row): AuditEventExport => ({
    id: row.id,
    created_at: formatTimestamp(row.created_at),
    portal_id: row.portal_id,
    run_id: row.run_id,
    actor_type: row.actor_type,
    actor_individual_id: row.actor_individual_id,
    negotiation_type: row.negotiation_type,
    effective_source: row.effective_source,
    effective_policy_id: row.effective_policy_id,
    effective_policy_updated_at: formatTimestamp(row.effective_policy_updated_at),
    effective_policy_hash: row.effective_policy_hash,
    request_fingerprint: row.request_fingerprint,
  }));
}

async function queryNegotiationEvents(
  tenantId: string,
  runId: string,
  allowProposalContext: boolean
): Promise<NegotiationEventExport[]> {
  const result = await pool.query(
    `SELECT 
      id,
      created_at,
      event_type,
      actor_role,
      note,
      proposed_start,
      proposed_end,
      metadata
    FROM cc_service_run_schedule_proposals
    WHERE run_tenant_id = $1 AND run_id = $2
    ORDER BY created_at ASC, id ASC`,
    [tenantId, runId]
  );

  return result.rows.map((row): NegotiationEventExport => {
    let proposalContext: SanitizedProposalContext | null = null;
    
    if (allowProposalContext && row.metadata) {
      const metadata = typeof row.metadata === 'string' 
        ? JSON.parse(row.metadata) 
        : row.metadata;
      proposalContext = sanitizeProposalContext(metadata?.proposal_context);
    }

    return {
      id: row.id,
      created_at: formatTimestamp(row.created_at),
      event_type: row.event_type,
      actor_type: row.actor_role,
      status: row.event_type,
      message: row.note,
      proposed_start: row.proposed_start ? formatTimestamp(row.proposed_start) : null,
      proposed_end: row.proposed_end ? formatTimestamp(row.proposed_end) : null,
      proposal_context: proposalContext,
    };
  });
}

async function queryNegotiationLatest(
  tenantId: string,
  runId: string
): Promise<NegotiationLatest> {
  const result = await pool.query(
    `SELECT 
      event_type,
      created_at,
      COUNT(*) OVER() as turn_count
     FROM cc_service_run_schedule_proposals
     WHERE run_tenant_id = $1 AND run_id = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [tenantId, runId]
  );

  if (result.rows.length === 0) {
    return {
      status: 'not_started',
      last_event_at: null,
      turn_count: 0,
    };
  }

  const row = result.rows[0];
  return {
    status: row.event_type || 'not_started',
    last_event_at: formatTimestamp(row.created_at),
    turn_count: parseInt(row.turn_count, 10) || 0,
  };
}

async function getRunPortalId(tenantId: string, runId: string): Promise<string | null> {
  const result = await pool.query(
    `SELECT portal_id FROM cc_n3_runs WHERE id = $1 AND tenant_id = $2`,
    [runId, tenantId]
  );
  return result.rows[0]?.portal_id || null;
}

export async function buildRunProofExport(options: BuildExportOptions): Promise<ExportResult> {
  const {
    tenantId,
    runId,
    negotiationType = 'schedule',
    format = 'json',
    exportedAtOverride,
  } = options;

  const exportedAt = exportedAtOverride || new Date().toISOString();

  const portalId = options.portalId ?? await getRunPortalId(tenantId, runId);

  const { policy, trace } = await loadNegotiationPolicyWithTrace(tenantId, negotiationType);

  const auditEvents = await queryAuditEvents(tenantId, runId);
  const sortedAuditEvents = stableSort(
    auditEvents,
    (a, b) => a.created_at.localeCompare(b.created_at),
    (a, b) => a.id.localeCompare(b.id)
  );

  const negotiationEvents = await queryNegotiationEvents(
    tenantId,
    runId,
    policy.allowProposalContext
  );
  const sortedNegotiationEvents = stableSort(
    negotiationEvents,
    (a, b) => a.created_at.localeCompare(b.created_at),
    (a, b) => a.id.localeCompare(b.id)
  );

  const latest = await queryNegotiationLatest(tenantId, runId);

  const exportData: RunProofExport = {
    schema_version: EXPORT_SCHEMA_VERSION,
    exported_at: exportedAt,
    portal_id: portalId,
    run_id: runId,
    negotiation_type: negotiationType,
    policy_trace: trace,
    policy: policy,
    audit_events: sortedAuditEvents,
    negotiation: {
      latest,
      events: sortedNegotiationEvents,
    },
  };

  const jsonOutput = JSON.stringify(exportData, null, 2);

  const dateStr = new Date(exportedAt).toISOString().slice(0, 10).replace(/-/g, '');
  const baseFilename = `run-proof-export-${runId}-${dateStr}`;

  if (format === 'csv') {
    const csvOutput = generateAuditEventsCsv(sortedAuditEvents);
    return {
      json: jsonOutput,
      csv: csvOutput,
      filename: `${baseFilename}.csv`,
      mimeType: 'text/csv',
    };
  }

  return {
    json: jsonOutput,
    filename: `${baseFilename}.json`,
    mimeType: 'application/json',
  };
}

function generateAuditEventsCsv(events: AuditEventExport[]): string {
  const headers = [
    'id',
    'created_at',
    'portal_id',
    'run_id',
    'actor_type',
    'actor_individual_id',
    'negotiation_type',
    'effective_source',
    'effective_policy_id',
    'effective_policy_updated_at',
    'effective_policy_hash',
    'request_fingerprint',
  ];

  const escapeCell = (val: string | null): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = events.map(event =>
    headers.map(h => escapeCell((event as any)[h])).join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}
