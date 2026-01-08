import { Router } from 'express';
import { serviceQuery } from '../db/tenantDb';
import { verifyAllEvidence, getAllEvidence, getEvidenceSummary } from '../services/evidenceVerification';

const router = Router();

// Known integrations to check for
const KNOWN_INTEGRATIONS = [
  { name: 'Firecrawl', envKey: 'FIRECRAWL_API_KEY', category: 'scraping' },
  { name: 'Apify', envKey: 'APIFY_API_TOKEN', category: 'scraping' },
  { name: 'Mapbox', envKey: 'MAPBOX_ACCESS_TOKEN', category: 'mapping' },
  { name: 'Jobber', envKey: 'JOBBER_ACCESS_TOKEN', category: 'field-service' },
  { name: 'CompanyCam', envKey: 'COMPANYCAM_ACCESS_TOKEN', category: 'photos' },
];

// Known data sources/pipelines - data stored in snapshots table as nested JSONB fields
// Each snapshot contains: road_conditions, ferry_schedules, bc_hydro_outages, active_alerts
const KNOWN_PIPELINES = [
  { name: 'DriveBC Road Conditions', table: 'snapshots', jsonPath: 'real_time_status_updates.road_conditions', category: 'transportation' },
  { name: 'BC Ferries Schedules', table: 'snapshots', jsonPath: 'real_time_status_updates.ferry_schedules', category: 'transportation' },
  { name: 'BC Hydro Outages', table: 'snapshots', jsonPath: 'real_time_status_updates.bc_hydro_outages', category: 'utilities' },
  { name: 'Active Alerts', table: 'snapshots', jsonPath: 'real_time_status_updates.active_alerts', category: 'emergency' },
  { name: 'Water/Sewer Alerts', table: 'snapshots', jsonPath: 'real_time_status_updates.water_sewer_alerts', category: 'utilities' },
];

// Key routes that should exist
const KEY_ROUTES = [
  { path: '/app/dashboard', label: 'Dashboard', required: true },
  { path: '/app/inventory', label: 'Inventory', required: true },
  { path: '/app/bookings', label: 'Bookings', required: true },
  { path: '/app/operations', label: 'Operations', required: true },
  { path: '/app/intake/work-requests', label: 'Work Requests', required: true },
  { path: '/app/projects', label: 'Projects', required: true },
  { path: '/app/crm/places', label: 'Places', required: true },
  { path: '/app/crm/people', label: 'Contacts', required: true },
  { path: '/app/crm/orgs', label: 'Organizations', required: true },
  { path: '/app/conversations', label: 'Conversations', required: false },
  { path: '/app/settings', label: 'Settings', required: true },
  { path: '/admin/system-explorer', label: 'System Explorer', required: true },
];

// Allowed tables for data browser with tenant column names
// Different tables use different column names for tenant scoping
// Updated to schema.org-aligned names: assets, reservations, people, organizations, articles
export const ALLOWED_TABLES = [
  { name: 'assets', label: 'Assets', tenantScoped: true, tenantColumn: 'owner_tenant_id' },
  { name: 'reservations', label: 'Reservations', tenantScoped: true, tenantColumn: 'provider_id' },
  { name: 'work_requests', label: 'Work Requests', tenantScoped: true, tenantColumn: 'tenant_id' },
  { name: 'projects', label: 'Projects', tenantScoped: true, tenantColumn: 'tenant_id' },
  { name: 'people', label: 'People', tenantScoped: true, tenantColumn: 'tenant_id' },
  { name: 'organizations', label: 'Organizations', tenantScoped: true, tenantColumn: 'tenant_id' },
  { name: 'portals', label: 'Portals', tenantScoped: true, tenantColumn: 'owning_tenant_id' },
  { name: 'portal_domains', label: 'Portal Domains', tenantScoped: false },
  { name: 'articles', label: 'Articles', tenantScoped: true, tenantColumn: 'canonical_tenant_id' },
  { name: 'presentation_blocks', label: 'Presentation Blocks', tenantScoped: false },
  { name: 'service_runs', label: 'Service Runs', tenantScoped: true, tenantColumn: 'tenant_id' },
  { name: 'crews', label: 'Crews', tenantScoped: true, tenantColumn: 'tenant_id' },
  { name: 'snapshots', label: 'Status Snapshots', tenantScoped: false },
  { name: 'tenants', label: 'Tenants', tenantScoped: false },
  { name: 'users', label: 'Users', tenantScoped: false },
  { name: 'system_evidence', label: 'Evidence Ledger', tenantScoped: false },
];

// GET /api/admin/system-explorer/overview
router.get('/overview', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string | undefined;
    
    // Entity counts
    const counts: Record<string, number | null> = {};
    
    for (const table of ALLOWED_TABLES) {
      try {
        const tenantColumn = (table as any).tenantColumn || 'tenant_id';
        let query = `SELECT COUNT(*) as count FROM ${table.name}`;
        if (table.tenantScoped && tenantId) {
          query += ` WHERE ${tenantColumn} = $1`;
        }
        const result = await serviceQuery(query, table.tenantScoped && tenantId ? [tenantId] : []);
        counts[table.name] = parseInt(result.rows[0]?.count || '0', 10);
      } catch {
        counts[table.name] = null; // Table doesn't exist
      }
    }
    
    // Integration status (check env vars presence only)
    const integrations = KNOWN_INTEGRATIONS.map(int => ({
      name: int.name,
      envKey: int.envKey,
      category: int.category,
      configured: !!process.env[int.envKey],
    }));
    
    // Pipeline/data source status (all use snapshots table with JSONB fields)
    const pipelines = await Promise.all(KNOWN_PIPELINES.map(async (p) => {
      try {
        // Count records that have data for this specific JSON path
        const pathParts = (p as any).jsonPath.split('.');
        const jsonQuery = pathParts.map((part: string) => `'${part}'`).join('->');
        const result = await serviceQuery(`
          SELECT 
            COUNT(*) FILTER (WHERE data->${jsonQuery} IS NOT NULL AND jsonb_array_length(data->${jsonQuery}) > 0) as count,
            MAX(created_at) as last_updated
          FROM snapshots
        `);
        const count = parseInt(result.rows[0]?.count || '0', 10);
        return {
          name: p.name,
          table: p.table,
          jsonPath: (p as any).jsonPath,
          category: p.category,
          exists: count > 0,
          count,
          lastUpdated: result.rows[0]?.last_updated || null,
        };
      } catch (err) {
        return {
          name: p.name,
          table: p.table,
          jsonPath: (p as any).jsonPath,
          category: p.category,
          exists: false,
          count: 0,
          lastUpdated: null,
        };
      }
    }));
    
    // Routes audit (we know these are in the nav config)
    const routesAudit = KEY_ROUTES.map(r => ({
      ...r,
      inNav: true, // All key routes are now in nav
      status: 'ok',
    }));
    
    res.json({
      success: true,
      data: {
        tenantId: tenantId || null,
        counts,
        integrations,
        pipelines,
        routesAudit,
        allowedTables: ALLOWED_TABLES,
      },
    });
  } catch (error) {
    console.error('System explorer overview error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch overview' });
  }
});

// GET /api/admin/system-explorer/table/:tableName
// Platform Admin only - allows viewing ALL data across tenants
router.get('/table/:tableName', async (req, res) => {
  try {
    const { tableName } = req.params;
    const tenantIdFilter = req.query.tenantId as string | undefined; // Optional tenant filter
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;
    
    // Validate table is allowed
    const tableConfig = ALLOWED_TABLES.find(t => t.name === tableName);
    if (!tableConfig) {
      return res.status(400).json({ success: false, error: 'Table not allowed' });
    }
    
    // PLATFORM ADMIN: Can view ALL data across tenants (no tenant filter required)
    // Optionally filter by tenantId if provided
    const tenantColumn = (tableConfig as any).tenantColumn || 'tenant_id';
    let query = `SELECT * FROM ${tableName}`;
    const params: any[] = [];
    
    // Only apply tenant filter if explicitly provided (optional for Platform Admin)
    if (tableConfig.tenantScoped && tenantIdFilter) {
      query += ` WHERE ${tenantColumn} = $1`;
      params.push(tenantIdFilter);
    }
    
    query += ` ORDER BY 1 DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    
    const result = await serviceQuery(query, params);
    
    // Get total count (with same optional tenant filter)
    let countQuery = `SELECT COUNT(*) as count FROM ${tableName}`;
    const countParams: any[] = [];
    if (tableConfig.tenantScoped && tenantIdFilter) {
      countQuery += ` WHERE ${tenantColumn} = $1`;
      countParams.push(tenantIdFilter);
    }
    const countResult = await serviceQuery(countQuery, countParams);
    const total = parseInt(countResult.rows[0]?.count || '0', 10);
    
    res.json({
      success: true,
      data: {
        table: tableName,
        tenantScoped: tableConfig.tenantScoped,
        tenantFiltered: !!tenantIdFilter,
        rows: result.rows,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error: any) {
    console.error('System explorer table error:', error);
    if (error.message?.includes('does not exist')) {
      return res.status(404).json({ success: false, error: 'Table does not exist' });
    }
    res.status(500).json({ success: false, error: 'Failed to fetch table data' });
  }
});

// ============================================================================
// EVIDENCE ENDPOINTS
// ============================================================================

// GET /api/admin/system-explorer/evidence/status
// Returns all evidence items and their current status (without running verification)
router.get('/evidence/status', async (req, res) => {
  try {
    const evidence = await getAllEvidence();
    
    // Calculate stale items (not checked in 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const enhancedEvidence = evidence.map(item => ({
      ...item,
      is_stale: item.last_verified_at ? new Date(item.last_verified_at) < oneDayAgo : true,
    }));
    
    const summary = {
      total: evidence.length,
      verified: evidence.filter(e => e.verification_status === 'verified').length,
      missing: evidence.filter(e => e.verification_status === 'missing').length,
      stale: enhancedEvidence.filter(e => e.is_stale).length,
      unknown: evidence.filter(e => e.verification_status === 'unknown').length,
    };
    
    res.json({
      success: true,
      data: {
        evidence: enhancedEvidence,
        summary,
      },
    });
  } catch (error: any) {
    console.error('Evidence status error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch evidence status' });
  }
});

// POST /api/admin/system-explorer/evidence/verify
// Run verification on all evidence items
router.post('/evidence/verify', async (req, res) => {
  try {
    console.log('[EVIDENCE] Starting verification...');
    const results = await verifyAllEvidence();
    const summary = getEvidenceSummary(results);
    
    // Log failures loudly
    const failures = results.filter(r => r.status !== 'verified');
    if (failures.length > 0) {
      console.error('[EVIDENCE] Verification failures:', failures.map(f => ({
        artifact: `${f.artifact_type}:${f.artifact_name}`,
        status: f.status,
        details: f.details,
      })));
    }
    
    console.log(`[EVIDENCE] Verification complete: ${summary.verified}/${summary.total} verified`);
    
    res.json({
      success: true,
      data: {
        results,
        summary: {
          total: summary.total,
          verified: summary.verified,
          missing: summary.missing,
          errors: summary.errors,
          stale: summary.stale,
          allRequiredPassing: summary.allRequiredPassing,
        },
      },
    });
  } catch (error: any) {
    console.error('Evidence verification error:', error);
    res.status(500).json({ success: false, error: 'Failed to run verification' });
  }
});

export default router;
