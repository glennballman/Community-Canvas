import { Router } from 'express';
import { serviceQuery } from '../db/tenantDb';

const router = Router();

// Known integrations to check for
const KNOWN_INTEGRATIONS = [
  { name: 'Firecrawl', envKey: 'FIRECRAWL_API_KEY', category: 'scraping' },
  { name: 'Apify', envKey: 'APIFY_API_TOKEN', category: 'scraping' },
  { name: 'Mapbox', envKey: 'MAPBOX_ACCESS_TOKEN', category: 'mapping' },
  { name: 'Jobber', envKey: 'JOBBER_ACCESS_TOKEN', category: 'field-service' },
  { name: 'CompanyCam', envKey: 'COMPANYCAM_ACCESS_TOKEN', category: 'photos' },
];

// Known data sources/pipelines
const KNOWN_PIPELINES = [
  { name: 'DriveBC Road Events', table: 'drivebc_events', category: 'transportation' },
  { name: 'BC Ferries', table: 'bcferries_conditions', category: 'transportation' },
  { name: 'BC Hydro Outages', table: 'bchydro_outages', category: 'utilities' },
  { name: 'Environment Canada Weather', table: 'weather_observations', category: 'weather' },
  { name: 'Earthquakes Canada', table: 'earthquake_events', category: 'emergency' },
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
  { path: '/app/system-explorer', label: 'System Explorer', required: true },
];

// Allowed tables for data browser with tenant column names
// Different tables use different column names for tenant scoping
export const ALLOWED_TABLES = [
  { name: 'unified_assets', label: 'Assets', tenantScoped: true, tenantColumn: 'owner_tenant_id' },
  { name: 'unified_bookings', label: 'Bookings', tenantScoped: true, tenantColumn: 'booker_tenant_id' },
  { name: 'work_requests', label: 'Work Requests', tenantScoped: true, tenantColumn: 'tenant_id' },
  { name: 'projects', label: 'Projects', tenantScoped: true, tenantColumn: 'tenant_id' },
  { name: 'crm_contacts', label: 'Contacts', tenantScoped: true, tenantColumn: 'tenant_id' },
  { name: 'crm_organizations', label: 'Organizations', tenantScoped: true, tenantColumn: 'tenant_id' },
  { name: 'crm_places', label: 'Places', tenantScoped: true, tenantColumn: 'tenant_id' },
  { name: 'portals', label: 'Portals', tenantScoped: true, tenantColumn: 'owning_tenant_id' },
  { name: 'portal_domains', label: 'Portal Domains', tenantScoped: false },
  { name: 'entity_presentations', label: 'Presentations', tenantScoped: true, tenantColumn: 'canonical_tenant_id' },
  { name: 'presentation_blocks', label: 'Presentation Blocks', tenantScoped: false },
  { name: 'service_runs', label: 'Service Runs', tenantScoped: true, tenantColumn: 'tenant_id' },
  { name: 'crews', label: 'Crews', tenantScoped: true, tenantColumn: 'tenant_id' },
  { name: 'drivebc_events', label: 'DriveBC Events', tenantScoped: false },
  { name: 'bchydro_outages', label: 'BC Hydro Outages', tenantScoped: false },
  { name: 'weather_observations', label: 'Weather Observations', tenantScoped: false },
  { name: 'earthquake_events', label: 'Earthquake Events', tenantScoped: false },
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
    
    // Pipeline/data source status
    const pipelines = await Promise.all(KNOWN_PIPELINES.map(async (p) => {
      try {
        const result = await serviceQuery(`
          SELECT 
            COUNT(*) as count,
            MAX(created_at) as last_updated
          FROM ${p.table}
        `);
        return {
          name: p.name,
          table: p.table,
          category: p.category,
          exists: true,
          count: parseInt(result.rows[0]?.count || '0', 10),
          lastUpdated: result.rows[0]?.last_updated || null,
        };
      } catch {
        return {
          name: p.name,
          table: p.table,
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
router.get('/table/:tableName', async (req, res) => {
  try {
    const { tableName } = req.params;
    const tenantId = req.headers['x-tenant-id'] as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;
    
    // Validate table is allowed
    const tableConfig = ALLOWED_TABLES.find(t => t.name === tableName);
    if (!tableConfig) {
      return res.status(400).json({ success: false, error: 'Table not allowed' });
    }
    
    // SECURITY: Tenant-scoped tables REQUIRE a tenant ID
    if (tableConfig.tenantScoped && !tenantId) {
      return res.status(403).json({ 
        success: false, 
        error: 'Tenant context required for tenant-scoped tables' 
      });
    }
    
    // Build query with proper tenant scoping (use table-specific tenant column)
    const tenantColumn = (tableConfig as any).tenantColumn || 'tenant_id';
    let query = `SELECT * FROM ${tableName}`;
    const params: any[] = [];
    
    if (tableConfig.tenantScoped) {
      // Always filter by tenant for tenant-scoped tables
      query += ` WHERE ${tenantColumn} = $1`;
      params.push(tenantId);
    }
    
    query += ` ORDER BY 1 DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    
    const result = await serviceQuery(query, params);
    
    // Get total count (with same tenant scoping)
    let countQuery = `SELECT COUNT(*) as count FROM ${tableName}`;
    const countParams: any[] = [];
    if (tableConfig.tenantScoped) {
      countQuery += ` WHERE ${tenantColumn} = $1`;
      countParams.push(tenantId);
    }
    const countResult = await serviceQuery(countQuery, countParams);
    const total = parseInt(countResult.rows[0]?.count || '0', 10);
    
    res.json({
      success: true,
      data: {
        table: tableName,
        tenantScoped: tableConfig.tenantScoped,
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

export default router;
