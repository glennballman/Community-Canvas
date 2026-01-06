/**
 * CRM ROUTES - Places, People, Organizations
 * 
 * Endpoints:
 * - GET/POST /api/crm/places
 * - GET/PUT/DELETE /api/crm/places/:id
 * - GET/POST /api/crm/people
 * - GET/PUT/DELETE /api/crm/people/:id
 * - GET/POST /api/crm/orgs
 * - GET/PUT/DELETE /api/crm/orgs/:id
 * - POST /api/crm/places/:id/photos
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requireTenant } from '../middleware/guards';
import { TenantRequest } from '../middleware/tenantContext';

const router = Router();

// ============================================================================
// PLACES
// ============================================================================

router.get('/places', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { search, limit = '50', offset = '0' } = req.query;
    const params: any[] = [];
    let paramIndex = 1;
    
    let whereClause = '';
    if (search) {
      whereClause = `WHERE (p.name ILIKE $${paramIndex} OR p.address_line1 ILIKE $${paramIndex} OR p.city ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    const result = await tenantReq.tenantQuery!(
      `SELECT 
        p.id, p.name, p.place_type, p.address_line1, p.city, p.province, p.postal_code,
        p.latitude, p.longitude, p.notes, p.created_at, p.updated_at,
        per.first_name as owner_first_name, per.last_name as owner_last_name,
        org.name as owner_org_name,
        (SELECT COUNT(*) FROM crm_place_photos ph WHERE ph.place_id = p.id) as photo_count
      FROM crm_places p
      LEFT JOIN crm_people per ON p.owner_person_id = per.id
      LEFT JOIN crm_orgs org ON p.owner_org_id = org.id
      ${whereClause}
      ORDER BY p.updated_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, parseInt(limit as string), parseInt(offset as string)]
    );

    const countResult = await tenantReq.tenantQuery!(
      `SELECT COUNT(*) as total FROM crm_places p ${whereClause}`,
      params
    );

    res.json({
      places: result.rows,
      total: parseInt(countResult.rows[0].total, 10)
    });
  } catch (error) {
    console.error('Error fetching places:', error);
    res.status(500).json({ error: 'Failed to fetch places' });
  }
});

router.get('/places/:id', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;

    const result = await tenantReq.tenantQuery!(
      `SELECT 
        p.*,
        per.id as owner_person_id, per.first_name as owner_first_name, per.last_name as owner_last_name, per.phone as owner_phone, per.email as owner_email,
        org.id as owner_org_id, org.name as owner_org_name
      FROM crm_places p
      LEFT JOIN crm_people per ON p.owner_person_id = per.id
      LEFT JOIN crm_orgs org ON p.owner_org_id = org.id
      WHERE p.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Place not found' });
    }

    const photosResult = await tenantReq.tenantQuery!(
      `SELECT id, url, caption, taken_at, sort_order, created_at
       FROM crm_place_photos
       WHERE place_id = $1
       ORDER BY sort_order ASC, created_at DESC`,
      [id]
    );

    res.json({
      place: result.rows[0],
      photos: photosResult.rows
    });
  } catch (error) {
    console.error('Error fetching place:', error);
    res.status(500).json({ error: 'Failed to fetch place' });
  }
});

router.post('/places', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const tenantId = tenantReq.ctx!.tenant_id;
    const { name, place_type, owner_person_id, owner_org_id, address_line1, address_line2, city, province, postal_code, country, latitude, longitude, notes } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await tenantReq.tenantQuery!(
      `INSERT INTO crm_places (tenant_id, name, place_type, owner_person_id, owner_org_id, address_line1, address_line2, city, province, postal_code, country, latitude, longitude, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [tenantId, name, place_type || 'property', owner_person_id || null, owner_org_id || null, address_line1 || null, address_line2 || null, city || null, province || 'BC', postal_code || null, country || 'Canada', latitude || null, longitude || null, notes || null]
    );

    res.status(201).json({ place: result.rows[0] });
  } catch (error) {
    console.error('Error creating place:', error);
    res.status(500).json({ error: 'Failed to create place' });
  }
});

router.put('/places/:id', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;
    const { name, place_type, owner_person_id, owner_org_id, address_line1, address_line2, city, province, postal_code, country, latitude, longitude, notes } = req.body;

    const result = await tenantReq.tenantQuery!(
      `UPDATE crm_places SET
        name = COALESCE($2, name),
        place_type = COALESCE($3, place_type),
        owner_person_id = $4,
        owner_org_id = $5,
        address_line1 = COALESCE($6, address_line1),
        address_line2 = $7,
        city = COALESCE($8, city),
        province = COALESCE($9, province),
        postal_code = COALESCE($10, postal_code),
        country = COALESCE($11, country),
        latitude = $12,
        longitude = $13,
        notes = $14
      WHERE id = $1
      RETURNING *`,
      [id, name, place_type, owner_person_id, owner_org_id, address_line1, address_line2, city, province, postal_code, country, latitude, longitude, notes]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Place not found' });
    }

    res.json({ place: result.rows[0] });
  } catch (error) {
    console.error('Error updating place:', error);
    res.status(500).json({ error: 'Failed to update place' });
  }
});

router.delete('/places/:id', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;
    const result = await tenantReq.tenantQuery!(`DELETE FROM crm_places WHERE id = $1 RETURNING id`, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Place not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting place:', error);
    res.status(500).json({ error: 'Failed to delete place' });
  }
});

router.post('/places/:id/photos', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const tenantId = tenantReq.ctx!.tenant_id;
    const { id } = req.params;
    const { url, caption, taken_at } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const result = await tenantReq.tenantQuery!(
      `INSERT INTO crm_place_photos (tenant_id, place_id, url, caption, taken_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [tenantId, id, url, caption || null, taken_at || null]
    );

    res.status(201).json({ photo: result.rows[0] });
  } catch (error) {
    console.error('Error adding photo:', error);
    res.status(500).json({ error: 'Failed to add photo' });
  }
});

// ============================================================================
// PEOPLE
// ============================================================================

router.get('/people', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { search, limit = '50', offset = '0' } = req.query;
    const params: any[] = [];
    let paramIndex = 1;
    
    let whereClause = '';
    if (search) {
      whereClause = `WHERE (p.first_name ILIKE $${paramIndex} OR p.last_name ILIKE $${paramIndex} OR p.email ILIKE $${paramIndex} OR p.phone ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    const result = await tenantReq.tenantQuery!(
      `SELECT 
        p.id, p.first_name, p.last_name, p.display_name, p.phone, p.email, p.role_title,
        p.city, p.province, p.notes, p.created_at, p.updated_at,
        o.name as org_name
      FROM crm_people p
      LEFT JOIN crm_orgs o ON p.org_id = o.id
      ${whereClause}
      ORDER BY p.last_name ASC, p.first_name ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, parseInt(limit as string), parseInt(offset as string)]
    );

    const countResult = await tenantReq.tenantQuery!(
      `SELECT COUNT(*) as total FROM crm_people p ${whereClause}`,
      params
    );

    res.json({
      people: result.rows,
      total: parseInt(countResult.rows[0].total, 10)
    });
  } catch (error) {
    console.error('Error fetching people:', error);
    res.status(500).json({ error: 'Failed to fetch people' });
  }
});

router.get('/people/:id', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;

    const result = await tenantReq.tenantQuery!(
      `SELECT p.*, o.name as org_name
       FROM crm_people p
       LEFT JOIN crm_orgs o ON p.org_id = o.id
       WHERE p.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Person not found' });
    }

    const placesResult = await tenantReq.tenantQuery!(
      `SELECT id, name, address_line1, city FROM crm_places WHERE owner_person_id = $1 ORDER BY name`,
      [id]
    );

    res.json({
      person: result.rows[0],
      places: placesResult.rows
    });
  } catch (error) {
    console.error('Error fetching person:', error);
    res.status(500).json({ error: 'Failed to fetch person' });
  }
});

router.post('/people', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const tenantId = tenantReq.ctx!.tenant_id;
    const { first_name, last_name, display_name, phone, email, role_title, org_id, address_line1, address_line2, city, province, postal_code, country, notes } = req.body;

    if (!first_name) {
      return res.status(400).json({ error: 'First name is required' });
    }

    const result = await tenantReq.tenantQuery!(
      `INSERT INTO crm_people (tenant_id, first_name, last_name, display_name, phone, email, role_title, org_id, address_line1, address_line2, city, province, postal_code, country, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [tenantId, first_name, last_name || null, display_name || null, phone || null, email || null, role_title || null, org_id || null, address_line1 || null, address_line2 || null, city || null, province || 'BC', postal_code || null, country || 'Canada', notes || null]
    );

    res.status(201).json({ person: result.rows[0] });
  } catch (error) {
    console.error('Error creating person:', error);
    res.status(500).json({ error: 'Failed to create person' });
  }
});

router.put('/people/:id', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;
    const { first_name, last_name, display_name, phone, email, role_title, org_id, address_line1, address_line2, city, province, postal_code, country, notes } = req.body;

    const result = await tenantReq.tenantQuery!(
      `UPDATE crm_people SET
        first_name = COALESCE($2, first_name),
        last_name = $3,
        display_name = $4,
        phone = $5,
        email = $6,
        role_title = $7,
        org_id = $8,
        address_line1 = $9,
        address_line2 = $10,
        city = $11,
        province = COALESCE($12, province),
        postal_code = $13,
        country = COALESCE($14, country),
        notes = $15
      WHERE id = $1
      RETURNING *`,
      [id, first_name, last_name, display_name, phone, email, role_title, org_id, address_line1, address_line2, city, province, postal_code, country, notes]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Person not found' });
    }

    res.json({ person: result.rows[0] });
  } catch (error) {
    console.error('Error updating person:', error);
    res.status(500).json({ error: 'Failed to update person' });
  }
});

router.delete('/people/:id', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;
    const result = await tenantReq.tenantQuery!(`DELETE FROM crm_people WHERE id = $1 RETURNING id`, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Person not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting person:', error);
    res.status(500).json({ error: 'Failed to delete person' });
  }
});

// ============================================================================
// ORGANIZATIONS
// ============================================================================

router.get('/orgs', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { search, limit = '50', offset = '0' } = req.query;
    const params: any[] = [];
    let paramIndex = 1;
    
    let whereClause = '';
    if (search) {
      whereClause = `WHERE (o.name ILIKE $${paramIndex} OR o.email ILIKE $${paramIndex} OR o.phone ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    const result = await tenantReq.tenantQuery!(
      `SELECT 
        o.id, o.name, o.legal_name, o.phone, o.email, o.website, o.city, o.province,
        o.notes, o.created_at, o.updated_at,
        (SELECT COUNT(*) FROM crm_people p WHERE p.org_id = o.id) as people_count
      FROM crm_orgs o
      ${whereClause}
      ORDER BY o.name ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, parseInt(limit as string), parseInt(offset as string)]
    );

    const countResult = await tenantReq.tenantQuery!(
      `SELECT COUNT(*) as total FROM crm_orgs o ${whereClause}`,
      params
    );

    res.json({
      orgs: result.rows,
      total: parseInt(countResult.rows[0].total, 10)
    });
  } catch (error) {
    console.error('Error fetching orgs:', error);
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

router.get('/orgs/:id', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;

    const result = await tenantReq.tenantQuery!(
      `SELECT * FROM crm_orgs WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const peopleResult = await tenantReq.tenantQuery!(
      `SELECT id, first_name, last_name, role_title, phone, email FROM crm_people WHERE org_id = $1 ORDER BY last_name, first_name`,
      [id]
    );

    const placesResult = await tenantReq.tenantQuery!(
      `SELECT id, name, address_line1, city FROM crm_places WHERE owner_org_id = $1 ORDER BY name`,
      [id]
    );

    res.json({
      org: result.rows[0],
      people: peopleResult.rows,
      places: placesResult.rows
    });
  } catch (error) {
    console.error('Error fetching org:', error);
    res.status(500).json({ error: 'Failed to fetch organization' });
  }
});

router.post('/orgs', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const tenantId = tenantReq.ctx!.tenant_id;
    const { name, legal_name, phone, email, website, address_line1, address_line2, city, province, postal_code, country, notes } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await tenantReq.tenantQuery!(
      `INSERT INTO crm_orgs (tenant_id, name, legal_name, phone, email, website, address_line1, address_line2, city, province, postal_code, country, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [tenantId, name, legal_name || null, phone || null, email || null, website || null, address_line1 || null, address_line2 || null, city || null, province || 'BC', postal_code || null, country || 'Canada', notes || null]
    );

    res.status(201).json({ org: result.rows[0] });
  } catch (error) {
    console.error('Error creating org:', error);
    res.status(500).json({ error: 'Failed to create organization' });
  }
});

router.put('/orgs/:id', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;
    const { name, legal_name, phone, email, website, address_line1, address_line2, city, province, postal_code, country, notes } = req.body;

    const result = await tenantReq.tenantQuery!(
      `UPDATE crm_orgs SET
        name = COALESCE($2, name),
        legal_name = $3,
        phone = $4,
        email = $5,
        website = $6,
        address_line1 = $7,
        address_line2 = $8,
        city = $9,
        province = COALESCE($10, province),
        postal_code = $11,
        country = COALESCE($12, country),
        notes = $13
      WHERE id = $1
      RETURNING *`,
      [id, name, legal_name, phone, email, website, address_line1, address_line2, city, province, postal_code, country, notes]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    res.json({ org: result.rows[0] });
  } catch (error) {
    console.error('Error updating org:', error);
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

router.delete('/orgs/:id', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;
    const result = await tenantReq.tenantQuery!(`DELETE FROM crm_orgs WHERE id = $1 RETURNING id`, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting org:', error);
    res.status(500).json({ error: 'Failed to delete organization' });
  }
});

// ============================================================================
// LOOKUPS (for dropdowns)
// ============================================================================

router.get('/lookup/people', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const result = await tenantReq.tenantQuery!(
      `SELECT id, first_name, last_name, phone, email FROM crm_people ORDER BY last_name, first_name LIMIT 100`
    );
    res.json({ people: result.rows });
  } catch (error) {
    console.error('Error fetching people lookup:', error);
    res.status(500).json({ error: 'Failed to fetch people' });
  }
});

router.get('/lookup/orgs', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const result = await tenantReq.tenantQuery!(
      `SELECT id, name FROM crm_orgs ORDER BY name LIMIT 100`
    );
    res.json({ orgs: result.rows });
  } catch (error) {
    console.error('Error fetching orgs lookup:', error);
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

router.get('/lookup/places', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const result = await tenantReq.tenantQuery!(
      `SELECT id, name, address_line1, city FROM crm_places ORDER BY name LIMIT 100`
    );
    res.json({ places: result.rows });
  } catch (error) {
    console.error('Error fetching places lookup:', error);
    res.status(500).json({ error: 'Failed to fetch places' });
  }
});

export default router;
