/**
 * CRM ROUTES - Contacts, Properties, Organizations
 * 
 * Endpoints:
 * - GET/POST /api/crm/contacts (formerly people)
 * - GET/PUT/DELETE /api/crm/contacts/:id
 * - GET/POST /api/crm/properties (formerly places)
 * - GET/PUT/DELETE /api/crm/properties/:id
 * - GET/POST /api/crm/organizations (formerly orgs)
 * - GET/PUT/DELETE /api/crm/organizations/:id
 * - POST /api/crm/properties/:id/photos
 * 
 * Legacy aliases for backwards compatibility:
 * - /api/crm/people -> /api/crm/contacts
 * - /api/crm/places -> /api/crm/properties
 * - /api/crm/orgs -> /api/crm/organizations
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requireTenant } from '../middleware/guards';
import { TenantRequest } from '../middleware/tenantContext';

const router = Router();

// ============================================================================
// PROPERTIES (formerly PLACES)
// ============================================================================

router.get('/properties', requireAuth, requireTenant, async (req: Request, res: Response) => {
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
        c.first_name as owner_first_name, c.last_name as owner_last_name,
        org.name as owner_org_name,
        (SELECT COUNT(*) FROM crm_property_photos ph WHERE ph.property_id = p.id) as photo_count
      FROM crm_properties p
      LEFT JOIN crm_contacts c ON p.owner_contact_id = c.id
      LEFT JOIN crm_organizations org ON p.owner_organization_id = org.id
      ${whereClause}
      ORDER BY p.updated_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, parseInt(limit as string), parseInt(offset as string)]
    );

    const countResult = await tenantReq.tenantQuery!(
      `SELECT COUNT(*) as total FROM crm_properties p ${whereClause}`,
      params
    );

    res.json({
      properties: result.rows,
      total: parseInt(countResult.rows[0].total, 10)
    });
  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

router.get('/properties/:id', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;

    const result = await tenantReq.tenantQuery!(
      `SELECT 
        p.*,
        c.id as owner_contact_id, c.first_name as owner_first_name, c.last_name as owner_last_name, c.phone as owner_phone, c.email as owner_email,
        org.id as owner_organization_id, org.name as owner_org_name
      FROM crm_properties p
      LEFT JOIN crm_contacts c ON p.owner_contact_id = c.id
      LEFT JOIN crm_organizations org ON p.owner_organization_id = org.id
      WHERE p.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const photosResult = await tenantReq.tenantQuery!(
      `SELECT id, url, caption, taken_at, sort_order, created_at
       FROM crm_property_photos
       WHERE property_id = $1
       ORDER BY sort_order ASC, created_at DESC`,
      [id]
    );

    res.json({
      property: result.rows[0],
      photos: photosResult.rows
    });
  } catch (error) {
    console.error('Error fetching property:', error);
    res.status(500).json({ error: 'Failed to fetch property' });
  }
});

router.post('/properties', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const tenantId = tenantReq.ctx!.tenant_id;
    const { name, place_type, owner_contact_id, owner_organization_id, address_line1, address_line2, city, province, postal_code, country, latitude, longitude, notes } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await tenantReq.tenantQuery!(
      `INSERT INTO crm_properties (tenant_id, name, place_type, owner_contact_id, owner_organization_id, address_line1, address_line2, city, province, postal_code, country, latitude, longitude, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [tenantId, name, place_type || 'property', owner_contact_id || null, owner_organization_id || null, address_line1 || null, address_line2 || null, city || null, province || 'BC', postal_code || null, country || 'Canada', latitude || null, longitude || null, notes || null]
    );

    res.status(201).json({ property: result.rows[0] });
  } catch (error) {
    console.error('Error creating property:', error);
    res.status(500).json({ error: 'Failed to create property' });
  }
});

router.put('/properties/:id', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;
    const { name, place_type, owner_contact_id, owner_organization_id, address_line1, address_line2, city, province, postal_code, country, latitude, longitude, notes } = req.body;

    const result = await tenantReq.tenantQuery!(
      `UPDATE crm_properties SET
        name = COALESCE($2, name),
        place_type = COALESCE($3, place_type),
        owner_contact_id = $4,
        owner_organization_id = $5,
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
      [id, name, place_type, owner_contact_id, owner_organization_id, address_line1, address_line2, city, province, postal_code, country, latitude, longitude, notes]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }

    res.json({ property: result.rows[0] });
  } catch (error) {
    console.error('Error updating property:', error);
    res.status(500).json({ error: 'Failed to update property' });
  }
});

router.delete('/properties/:id', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;
    const result = await tenantReq.tenantQuery!(`DELETE FROM crm_properties WHERE id = $1 RETURNING id`, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting property:', error);
    res.status(500).json({ error: 'Failed to delete property' });
  }
});

router.post('/properties/:id/photos', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const tenantId = tenantReq.ctx!.tenant_id;
    const { id } = req.params;
    const { url, caption, taken_at } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const result = await tenantReq.tenantQuery!(
      `INSERT INTO crm_property_photos (tenant_id, property_id, url, caption, taken_at)
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

// Legacy alias: /places -> /properties (reuse same handler)
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
        c.first_name as owner_first_name, c.last_name as owner_last_name,
        org.name as owner_org_name,
        (SELECT COUNT(*) FROM crm_property_photos ph WHERE ph.property_id = p.id) as photo_count
      FROM crm_properties p
      LEFT JOIN crm_contacts c ON p.owner_contact_id = c.id
      LEFT JOIN crm_organizations org ON p.owner_organization_id = org.id
      ${whereClause}
      ORDER BY p.updated_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, parseInt(limit as string), parseInt(offset as string)]
    );

    const countResult = await tenantReq.tenantQuery!(
      `SELECT COUNT(*) as total FROM crm_properties p ${whereClause}`,
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

// ============================================================================
// CONTACTS (formerly PEOPLE)
// ============================================================================

router.get('/contacts', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { search, limit = '50', offset = '0' } = req.query;
    const params: any[] = [];
    let paramIndex = 1;
    
    let whereClause = '';
    if (search) {
      whereClause = `WHERE (c.first_name ILIKE $${paramIndex} OR c.last_name ILIKE $${paramIndex} OR c.email ILIKE $${paramIndex} OR c.phone ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    const result = await tenantReq.tenantQuery!(
      `SELECT 
        c.id, c.first_name, c.last_name, c.display_name, c.phone, c.email, c.role_title,
        c.city, c.province, c.notes, c.created_at, c.updated_at,
        o.name as org_name
      FROM crm_contacts c
      LEFT JOIN crm_organizations o ON c.organization_id = o.id
      ${whereClause}
      ORDER BY c.last_name ASC, c.first_name ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, parseInt(limit as string), parseInt(offset as string)]
    );

    const countResult = await tenantReq.tenantQuery!(
      `SELECT COUNT(*) as total FROM crm_contacts c ${whereClause}`,
      params
    );

    res.json({
      contacts: result.rows,
      total: parseInt(countResult.rows[0].total, 10)
    });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

router.get('/contacts/:id', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;

    const result = await tenantReq.tenantQuery!(
      `SELECT c.*, o.name as org_name
       FROM crm_contacts c
       LEFT JOIN crm_organizations o ON c.organization_id = o.id
       WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const propertiesResult = await tenantReq.tenantQuery!(
      `SELECT id, name, address_line1, city FROM crm_properties WHERE owner_contact_id = $1 ORDER BY name`,
      [id]
    );

    res.json({
      contact: result.rows[0],
      properties: propertiesResult.rows
    });
  } catch (error) {
    console.error('Error fetching contact:', error);
    res.status(500).json({ error: 'Failed to fetch contact' });
  }
});

router.post('/contacts', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const tenantId = tenantReq.ctx!.tenant_id;
    const { first_name, last_name, display_name, phone, email, role_title, organization_id, address_line1, address_line2, city, province, postal_code, country, notes } = req.body;

    if (!first_name) {
      return res.status(400).json({ error: 'First name is required' });
    }

    const result = await tenantReq.tenantQuery!(
      `INSERT INTO crm_contacts (tenant_id, first_name, last_name, display_name, phone, email, role_title, organization_id, address_line1, address_line2, city, province, postal_code, country, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [tenantId, first_name, last_name || null, display_name || null, phone || null, email || null, role_title || null, organization_id || null, address_line1 || null, address_line2 || null, city || null, province || 'BC', postal_code || null, country || 'Canada', notes || null]
    );

    res.status(201).json({ contact: result.rows[0] });
  } catch (error) {
    console.error('Error creating contact:', error);
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

router.put('/contacts/:id', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;
    const { first_name, last_name, display_name, phone, email, role_title, organization_id, address_line1, address_line2, city, province, postal_code, country, notes } = req.body;

    const result = await tenantReq.tenantQuery!(
      `UPDATE crm_contacts SET
        first_name = COALESCE($2, first_name),
        last_name = $3,
        display_name = $4,
        phone = $5,
        email = $6,
        role_title = $7,
        organization_id = $8,
        address_line1 = $9,
        address_line2 = $10,
        city = $11,
        province = COALESCE($12, province),
        postal_code = $13,
        country = COALESCE($14, country),
        notes = $15
      WHERE id = $1
      RETURNING *`,
      [id, first_name, last_name, display_name, phone, email, role_title, organization_id, address_line1, address_line2, city, province, postal_code, country, notes]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json({ contact: result.rows[0] });
  } catch (error) {
    console.error('Error updating contact:', error);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

router.delete('/contacts/:id', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;
    const result = await tenantReq.tenantQuery!(`DELETE FROM crm_contacts WHERE id = $1 RETURNING id`, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting contact:', error);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

// Legacy alias: /people -> /contacts (reuse same handler)
router.get('/people', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { search, limit = '50', offset = '0' } = req.query;
    const params: any[] = [];
    let paramIndex = 1;
    
    let whereClause = '';
    if (search) {
      whereClause = `WHERE (c.first_name ILIKE $${paramIndex} OR c.last_name ILIKE $${paramIndex} OR c.email ILIKE $${paramIndex} OR c.phone ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    const result = await tenantReq.tenantQuery!(
      `SELECT 
        c.id, c.first_name, c.last_name, c.display_name, c.phone, c.email, c.role_title,
        c.city, c.province, c.notes, c.created_at, c.updated_at,
        o.name as org_name
      FROM crm_contacts c
      LEFT JOIN crm_organizations o ON c.organization_id = o.id
      ${whereClause}
      ORDER BY c.last_name ASC, c.first_name ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, parseInt(limit as string), parseInt(offset as string)]
    );

    const countResult = await tenantReq.tenantQuery!(
      `SELECT COUNT(*) as total FROM crm_contacts c ${whereClause}`,
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

// ============================================================================
// ORGANIZATIONS (formerly ORGS)
// ============================================================================

router.get('/organizations', requireAuth, requireTenant, async (req: Request, res: Response) => {
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
        (SELECT COUNT(*) FROM crm_contacts c WHERE c.organization_id = o.id) as contacts_count
      FROM crm_organizations o
      ${whereClause}
      ORDER BY o.name ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, parseInt(limit as string), parseInt(offset as string)]
    );

    const countResult = await tenantReq.tenantQuery!(
      `SELECT COUNT(*) as total FROM crm_organizations o ${whereClause}`,
      params
    );

    res.json({
      organizations: result.rows,
      total: parseInt(countResult.rows[0].total, 10)
    });
  } catch (error) {
    console.error('Error fetching organizations:', error);
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

router.get('/organizations/:id', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;

    const result = await tenantReq.tenantQuery!(
      `SELECT * FROM crm_organizations WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const contactsResult = await tenantReq.tenantQuery!(
      `SELECT id, first_name, last_name, role_title, phone, email FROM crm_contacts WHERE organization_id = $1 ORDER BY last_name, first_name`,
      [id]
    );

    const propertiesResult = await tenantReq.tenantQuery!(
      `SELECT id, name, address_line1, city FROM crm_properties WHERE owner_organization_id = $1 ORDER BY name`,
      [id]
    );

    res.json({
      organization: result.rows[0],
      contacts: contactsResult.rows,
      properties: propertiesResult.rows
    });
  } catch (error) {
    console.error('Error fetching organization:', error);
    res.status(500).json({ error: 'Failed to fetch organization' });
  }
});

router.post('/organizations', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const tenantId = tenantReq.ctx!.tenant_id;
    const { name, legal_name, phone, email, website, address_line1, address_line2, city, province, postal_code, country, notes } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await tenantReq.tenantQuery!(
      `INSERT INTO crm_organizations (tenant_id, name, legal_name, phone, email, website, address_line1, address_line2, city, province, postal_code, country, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [tenantId, name, legal_name || null, phone || null, email || null, website || null, address_line1 || null, address_line2 || null, city || null, province || 'BC', postal_code || null, country || 'Canada', notes || null]
    );

    res.status(201).json({ organization: result.rows[0] });
  } catch (error) {
    console.error('Error creating organization:', error);
    res.status(500).json({ error: 'Failed to create organization' });
  }
});

router.put('/organizations/:id', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;
    const { name, legal_name, phone, email, website, address_line1, address_line2, city, province, postal_code, country, notes } = req.body;

    const result = await tenantReq.tenantQuery!(
      `UPDATE crm_organizations SET
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

    res.json({ organization: result.rows[0] });
  } catch (error) {
    console.error('Error updating organization:', error);
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

router.delete('/organizations/:id', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;
    const result = await tenantReq.tenantQuery!(`DELETE FROM crm_organizations WHERE id = $1 RETURNING id`, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting organization:', error);
    res.status(500).json({ error: 'Failed to delete organization' });
  }
});

// Legacy alias: /orgs -> /organizations (reuse same handler)
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
        (SELECT COUNT(*) FROM crm_contacts c WHERE c.organization_id = o.id) as contacts_count
      FROM crm_organizations o
      ${whereClause}
      ORDER BY o.name ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, parseInt(limit as string), parseInt(offset as string)]
    );

    const countResult = await tenantReq.tenantQuery!(
      `SELECT COUNT(*) as total FROM crm_organizations o ${whereClause}`,
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

// ============================================================================
// LOOKUPS (for dropdowns)
// ============================================================================

router.get('/lookup/contacts', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const result = await tenantReq.tenantQuery!(
      `SELECT id, first_name, last_name, phone, email FROM crm_contacts ORDER BY last_name, first_name LIMIT 100`
    );
    res.json({ contacts: result.rows });
  } catch (error) {
    console.error('Error fetching contacts lookup:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// Legacy alias
router.get('/lookup/people', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const result = await tenantReq.tenantQuery!(
      `SELECT id, first_name, last_name, phone, email FROM crm_contacts ORDER BY last_name, first_name LIMIT 100`
    );
    res.json({ people: result.rows });
  } catch (error) {
    console.error('Error fetching people lookup:', error);
    res.status(500).json({ error: 'Failed to fetch people' });
  }
});

router.get('/lookup/organizations', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const result = await tenantReq.tenantQuery!(
      `SELECT id, name FROM crm_organizations ORDER BY name LIMIT 100`
    );
    res.json({ organizations: result.rows });
  } catch (error) {
    console.error('Error fetching organizations lookup:', error);
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

// Legacy alias
router.get('/lookup/orgs', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const result = await tenantReq.tenantQuery!(
      `SELECT id, name FROM crm_organizations ORDER BY name LIMIT 100`
    );
    res.json({ orgs: result.rows });
  } catch (error) {
    console.error('Error fetching orgs lookup:', error);
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

router.get('/lookup/properties', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const result = await tenantReq.tenantQuery!(
      `SELECT id, name, address_line1, city FROM crm_properties ORDER BY name LIMIT 100`
    );
    res.json({ properties: result.rows });
  } catch (error) {
    console.error('Error fetching properties lookup:', error);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

// Legacy alias
router.get('/lookup/places', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const result = await tenantReq.tenantQuery!(
      `SELECT id, name, address_line1, city FROM crm_properties ORDER BY name LIMIT 100`
    );
    res.json({ places: result.rows });
  } catch (error) {
    console.error('Error fetching places lookup:', error);
    res.status(500).json({ error: 'Failed to fetch places' });
  }
});

export default router;
