/**
 * V3.5 Certification Manifest
 * PATENT CC-01 & CC-02 INVENTOR GLENN BALLMAN
 * 
 * Single source of truth for required routes and endpoints.
 * Used by scripts/v35-cert.ts for certification checks.
 */

export interface RouteSpec {
  path: string;
  label: string;
  required: boolean;
}

/**
 * Required Public UI Routes
 */
export const PUBLIC_UI_ROUTES: RouteSpec[] = [
  { path: '/', label: 'Landing Page', required: true },
  { path: '/search', label: 'Availability Search', required: false },
  { path: '/proposals/:id', label: 'Public Proposal View', required: false },
];

/**
 * Required App UI Routes
 */
export const APP_UI_ROUTES: RouteSpec[] = [
  { path: '/app', label: 'Dashboard', required: true },
  { path: '/app/ops', label: 'Operations Board', required: true },
  { path: '/app/ops/housekeeping', label: 'Housekeeping Tasks', required: true },
  { path: '/app/ops/incidents', label: 'Incidents Console', required: true },
  { path: '/app/parking', label: 'Parking Plan View', required: true },
  { path: '/app/marina', label: 'Marina Plan View', required: true },
  { path: '/app/reservations', label: 'Reservations', required: true },
  { path: '/app/hospitality', label: 'Hospitality', required: false },
  { path: '/app/jobs', label: 'Jobs Board', required: false },
  { path: '/app/services/runs', label: 'Service Runs (N3)', required: false },
];

/**
 * Required API Endpoints grouped by domain
 */
export const API_ENDPOINTS: Record<string, RouteSpec[]> = {
  surfaces: [
    { path: 'GET /api/p2/app/surfaces/containers/:containerId', label: 'Container Detail', required: true },
    { path: 'POST /api/p2/app/surfaces/claims/hold', label: 'Claims Hold', required: true },
    { path: 'POST /api/p2/app/surfaces/claims/confirm', label: 'Claims Confirm', required: true },
    { path: 'POST /api/p2/app/surfaces/claims/release', label: 'Claims Release', required: true },
    { path: 'GET /api/p2/app/surfaces/capacity', label: 'Capacity Lens', required: true },
    { path: 'GET /api/p2/app/surfaces/capacity/compare', label: 'Capacity Compare', required: true },
    { path: 'POST /api/p2/app/surfaces/capacity/batch', label: 'Capacity Batch', required: true },
  ],
  proposals: [
    { path: 'GET /api/p2/app/proposals/:proposalId', label: 'Get Proposal', required: true },
    { path: 'POST /api/p2/app/proposals/from-cart', label: 'Create From Cart', required: true },
    { path: 'POST /api/p2/app/proposals/:proposalId/release', label: 'Release Proposal', required: true },
    { path: 'POST /api/p2/app/proposals/:proposalId/confirm', label: 'Confirm Proposal', required: true },
    { path: 'GET /api/p2/app/proposals/:proposalId/risk', label: 'Risk Assessment', required: true },
    { path: 'POST /api/p2/app/proposals/:proposalId/handoff', label: 'Forward to Approver', required: true },
  ],
  folios: [
    { path: 'POST /api/p2/app/proposals/folios/:folioId/pay', label: 'Pay Your Share', required: true },
    { path: 'POST /api/p2/app/proposals/folios/:folioId/credit', label: 'Operator Credit', required: true },
  ],
  ops: [
    { path: 'GET /api/p2/app/ops/tasks', label: 'Housekeeping Tasks List', required: true },
    { path: 'GET /api/p2/app/ops/tasks/:taskId', label: 'Task Detail', required: true },
    { path: 'POST /api/p2/app/ops/tasks', label: 'Create Task', required: true },
    { path: 'PATCH /api/p2/app/ops/tasks/:taskId', label: 'Update Task', required: true },
    { path: 'GET /api/p2/app/ops/incidents', label: 'Incidents List', required: true },
    { path: 'GET /api/p2/app/ops/incidents/:incidentId', label: 'Incident Detail', required: true },
    { path: 'PATCH /api/p2/app/ops/incidents/:incidentId', label: 'Update Incident', required: true },
  ],
  media: [
    { path: 'GET /api/p2/app/ops/media', label: 'Media List', required: true },
    { path: 'POST /api/p2/app/ops/media', label: 'Upload Media', required: true },
    { path: 'DELETE /api/p2/app/ops/media/:mediaId', label: 'Delete Media', required: true },
  ],
  n3: [
    { path: 'GET /api/n3/attention', label: 'N3 Attention Queue', required: true },
    { path: 'GET /api/n3/runs/:runId/monitor', label: 'N3 Monitor Detail', required: true },
    { path: 'POST /api/n3/runs/:runId/evaluate', label: 'N3 Evaluate Run', required: true },
    { path: 'GET /api/n3/status', label: 'N3 Monitor Status', required: true },
  ],
};

/**
 * All required API endpoints as flat array
 */
export function getAllRequiredEndpoints(): RouteSpec[] {
  return Object.values(API_ENDPOINTS)
    .flat()
    .filter(e => e.required);
}

/**
 * Terminology allowlist - patterns that may contain "book" or "booking"
 * ALLOW_BOOKING_TERM_URL_ONLY: schema.org URLs or similar
 */
export const TERMINOLOGY_ALLOWLIST: RegExp[] = [
  /schema\.org/i,
  /ALLOW_BOOKING_TERM_URL_ONLY/,
  /\/\/.*booking/i, // URLs containing booking
];

/**
 * Directories to scan for terminology violations
 */
export const TERMINOLOGY_SCAN_DIRS = [
  'client/src',
  'server',
  'shared',
];

/**
 * File extensions to scan
 */
export const TERMINOLOGY_SCAN_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
];

/**
 * Invariant SQL checks
 */
export const INVARIANT_CHECKS = {
  ledgerImmutability: `
    SELECT COUNT(*) as count 
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'cc_folio_ledger'
    AND t.tgname LIKE '%update%'
    AND t.tgenabled = 'D'
  `,
  
  reversalLinks: `
    SELECT COUNT(*) as count
    FROM cc_folio_ledger l
    WHERE l.entry_type IN ('reversal', 'credit_reversal', 'charge_reversal')
    AND NOT EXISTS (
      SELECT 1 FROM cc_folio_ledger_links lnk 
      WHERE lnk.ledger_id = l.id 
      AND lnk.ref_folio_ledger_id IS NOT NULL
    )
  `,
  
  atomicLinking: `
    SELECT COUNT(*) as count
    FROM cc_folio_ledger l
    WHERE l.entry_type IN ('activity_rental', 'lodging')
    AND l.tenant_id = 'b0000000-0000-0000-0000-000000000001'
    AND NOT EXISTS (
      SELECT 1 FROM cc_folio_ledger_links lnk
      WHERE lnk.ledger_id = l.id
      AND (lnk.surface_claim_id IS NOT NULL OR lnk.surface_unit_id IS NOT NULL)
    )
  `,
  
  portalScopingUnits: `
    SELECT COUNT(*) as count
    FROM cc_surface_units
    WHERE portal_id IS NULL
  `,
  
  portalScopingClaims: `
    SELECT COUNT(*) as count
    FROM cc_surface_claims
    WHERE portal_id IS NULL
  `,
  
  portalScopingLinks: `
    SELECT COUNT(*) as count
    FROM cc_folio_ledger_links
    WHERE portal_id IS NULL
  `,
  
  portalScopingIncidents: `
    SELECT COUNT(*) as count
    FROM cc_refund_incidents
    WHERE portal_id IS NULL
  `,
};

/**
 * Dev seed endpoints for proof bundle
 */
export const DEV_SEED_ENDPOINTS = {
  weddingStress: 'POST /api/dev/seed/wedding-stress',
  n3: 'POST /api/dev/seed/n3',
  ops: 'POST /api/p2/app/ops/dev/seed',
};
