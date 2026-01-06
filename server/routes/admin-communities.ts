import express, { Response } from 'express';
import { serviceQuery } from '../db/tenantDb';
import { authenticateToken, requirePlatformAdmin, AuthRequest } from './foundation';

const router = express.Router();

// All routes require platform admin
router.use(authenticateToken, requirePlatformAdmin);

// GET /api/admin/communities - List all communities (government/community type tenants)
router.get('/', async (req, res) => {
  try {
    const { search, filter } = req.query;
    
    let query = `
      SELECT 
        t.id,
        t.name,
        t.slug,
        t.tenant_type as type,
        t.slug as portal_slug,
        t.created_at,
        COUNT(DISTINCT tm.user_id) as member_count
      FROM cc_tenants t
      LEFT JOIN cc_tenant_users tm ON t.id = tm.tenant_id
      WHERE t.tenant_type IN ('government', 'community')
    `;
    
    const params: any[] = [];
    let paramIndex = 1;
    
    if (search && typeof search === 'string' && search.trim()) {
      query += ` AND (t.name ILIKE $${paramIndex} OR t.slug ILIKE $${paramIndex})`;
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }
    
    if (filter === 'government') {
      query += ` AND t.tenant_type = 'government'`;
    } else if (filter === 'community') {
      query += ` AND t.tenant_type = 'community'`;
    } else if (filter === 'has_portal') {
      query += ` AND t.slug IS NOT NULL AND t.slug != ''`;
    } else if (filter === 'no_portal') {
      query += ` AND (t.slug IS NULL OR t.slug = '')`;
    }
    
    query += ` GROUP BY t.id, t.name, t.slug, t.tenant_type, t.created_at ORDER BY t.name ASC`;
    
    const result = await serviceQuery(query, params);
    
    console.log('[admin-communities] GET / - Found communities:', result.rows.length);
    
    res.json({ 
      communities: result.rows.map(row => ({
        ...row,
        member_count: parseInt(row.member_count) || 0
      }))
    });
  } catch (error) {
    console.error('Error fetching communities:', error);
    res.status(500).json({ error: 'Failed to fetch communities' });
  }
});

// POST /api/admin/communities - Create a new community
router.post('/', async (req, res) => {
  try {
    const { name, slug, portal_slug, type, source_type, source_id } = req.body;
    
    if (!name || !slug) {
      return res.status(400).json({ message: 'Name and slug are required' });
    }
    
    // Check if slug already exists
    const existingCheck = await serviceQuery(
      'SELECT id FROM cc_tenants WHERE slug = $1',
      [slug]
    );
    
    if (existingCheck.rows.length > 0) {
      return res.status(400).json({ message: 'A community with this slug already exists' });
    }
    
    // Create the tenant
    const result = await serviceQuery(`
      INSERT INTO cc_tenants (name, slug, tenant_type, status, created_at)
      VALUES ($1, $2, $3, 'active', NOW())
      RETURNING id, name, slug, tenant_type as type
    `, [name, slug, type || 'community']);
    
    const community = result.rows[0];
    
    res.status(201).json({
      community: {
        id: community.id,
        name: community.name,
        slug: community.slug,
        portal_slug: portal_slug || community.slug,
      }
    });
  } catch (error) {
    console.error('Error creating community:', error);
    res.status(500).json({ message: 'Failed to create community' });
  }
});

// =====================================================
// SEED ROUTES - MUST BE BEFORE /:id to avoid route conflict
// =====================================================

// GET /api/admin/communities/seed/counts - Get counts for seed sources
router.get('/seed/counts', async (_req, res) => {
  try {
    console.log('[admin-communities] GET /seed/counts - Fetching counts');
    // Return mock counts for now - in production these would query actual data tables
    res.json({
      counts: {
        municipalities: 162,
        regional_districts: 27,
        first_nations: 203,
      }
    });
  } catch (error) {
    console.error('Error fetching seed counts:', error);
    res.status(500).json({ error: 'Failed to fetch counts' });
  }
});

// GET /api/admin/communities/seed/:source_type - Get options for a seed source
router.get('/seed/:source_type', async (req, res) => {
  try {
    const { source_type } = req.params;
    const { search } = req.query;
    
    console.log('[admin-communities] GET /seed/:source_type -', source_type, 'search:', search);
    
    // Return mock data for now - in production this would query actual geographic data
    const mockOptions: Record<string, Array<{ id: string; name: string; type?: string; population?: number; regional_district?: string }>> = {
      municipalities: [
        { id: 'muni-1', name: 'Bamfield', type: 'unincorporated', population: 182, regional_district: 'Alberni-Clayoquot' },
        { id: 'muni-2', name: 'Tofino', type: 'District', population: 2100, regional_district: 'Alberni-Clayoquot' },
        { id: 'muni-3', name: 'Ucluelet', type: 'District', population: 1700, regional_district: 'Alberni-Clayoquot' },
        { id: 'muni-4', name: 'Port Alberni', type: 'City', population: 17700, regional_district: 'Alberni-Clayoquot' },
        { id: 'muni-5', name: 'Parksville', type: 'City', population: 13000, regional_district: 'Nanaimo' },
        { id: 'muni-6', name: 'Victoria', type: 'City', population: 91867, regional_district: 'Capital' },
        { id: 'muni-7', name: 'Vancouver', type: 'City', population: 662248, regional_district: 'Metro Vancouver' },
        { id: 'muni-8', name: 'Surrey', type: 'City', population: 568322, regional_district: 'Metro Vancouver' },
        { id: 'muni-9', name: 'Burnaby', type: 'City', population: 249125, regional_district: 'Metro Vancouver' },
        { id: 'muni-10', name: 'Richmond', type: 'City', population: 209937, regional_district: 'Metro Vancouver' },
      ],
      regional_districts: [
        { id: 'rd-1', name: 'Alberni-Clayoquot Regional District' },
        { id: 'rd-2', name: 'Capital Regional District' },
        { id: 'rd-3', name: 'Cowichan Valley Regional District' },
        { id: 'rd-4', name: 'Nanaimo Regional District' },
        { id: 'rd-5', name: 'Metro Vancouver' },
        { id: 'rd-6', name: 'Fraser Valley Regional District' },
        { id: 'rd-7', name: 'Central Okanagan Regional District' },
      ],
      first_nations: [
        { id: 'fn-1', name: 'Huu-ay-aht First Nations' },
        { id: 'fn-2', name: 'Tla-o-qui-aht First Nations' },
        { id: 'fn-3', name: 'Tseshaht First Nation' },
        { id: 'fn-4', name: 'Uchucklesaht Tribe' },
        { id: 'fn-5', name: 'Musqueam Indian Band' },
        { id: 'fn-6', name: 'Squamish Nation' },
        { id: 'fn-7', name: 'Tsleil-Waututh Nation' },
        { id: 'fn-8', name: 'Snuneymuxw First Nation' },
      ],
    };
    
    let options = mockOptions[source_type] || [];
    
    if (search && typeof search === 'string' && search.trim()) {
      const searchLower = search.toLowerCase();
      options = options.filter(o => o.name.toLowerCase().includes(searchLower));
    }
    
    console.log('[admin-communities] Returning', options.length, 'options for', source_type);
    
    res.json({ options });
  } catch (error) {
    console.error('Error fetching seed options:', error);
    res.status(500).json({ error: 'Failed to fetch options' });
  }
});

// =====================================================
// PARAMETERIZED ROUTES - MUST BE AFTER static routes
// =====================================================

// GET /api/admin/communities/:id - Get community details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await serviceQuery(`
      SELECT 
        t.id,
        t.name,
        t.slug,
        t.tenant_type as type,
        t.slug as portal_slug,
        t.created_at,
        COUNT(DISTINCT tm.user_id) as member_count
      FROM cc_tenants t
      LEFT JOIN cc_tenant_users tm ON t.id = tm.tenant_id
      WHERE t.id = $1
      GROUP BY t.id, t.name, t.slug, t.tenant_type, t.created_at
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Community not found' });
    }
    
    res.json({ community: result.rows[0] });
  } catch (error) {
    console.error('Error fetching community:', error);
    res.status(500).json({ error: 'Failed to fetch community' });
  }
});

// GET /api/admin/communities/:id/portal-config - Get portal configuration
router.get('/:id/portal-config', async (req, res) => {
  try {
    const { id } = req.params;
    
    // For now, return default config since portal_config table may not exist
    // In production, this would query a portal_configs table
    const defaultConfig = {
      theme: {
        primary_color: '#3b82f6',
        accent_color: '#f59e0b',
        background_color: '#0c1829',
        logo_url: '',
        tagline: '',
      },
      sections: [
        { key: 'hero', label: 'Hero', visible: true },
        { key: 'businesses', label: 'Businesses', visible: true },
        { key: 'services', label: 'Services', visible: true },
        { key: 'events', label: 'Events', visible: true },
        { key: 'good_news', label: 'Good News', visible: true },
        { key: 'about', label: 'About', visible: true },
      ],
      area_groups: [],
      seo: {
        meta_title: '',
        meta_description: '',
        social_image_url: '',
      },
    };
    
    res.json({ config: defaultConfig });
  } catch (error) {
    console.error('Error fetching portal config:', error);
    res.status(500).json({ error: 'Failed to fetch portal config' });
  }
});

// PUT /api/admin/communities/:id/portal-config - Update portal configuration
router.put('/:id/portal-config', async (req, res) => {
  try {
    const { id } = req.params;
    const config = req.body;
    
    // For now, just return success since portal_config table may not exist
    // In production, this would upsert into a portal_configs table
    console.log(`Saving portal config for community ${id}:`, config);
    
    res.json({ success: true, config });
  } catch (error) {
    console.error('Error saving portal config:', error);
    res.status(500).json({ error: 'Failed to save portal config' });
  }
});

export default router;
