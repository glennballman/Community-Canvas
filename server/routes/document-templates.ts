import express, { Request, Response } from 'express';
import { serviceQuery } from '../db/tenantDb';
import { TenantRequest } from '../middleware/tenantContext';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { ownerLegalPartyId } = req.query;

  if (!ctx?.tenant_id) {
    return res.status(401).json({
      ok: false,
      error: 'TENANT_REQUIRED'
    });
  }

  try {
    let whereClause = `WHERE 1=1`;
    const params: any[] = [];

    if (ownerLegalPartyId) {
      params.push(ownerLegalPartyId);
      whereClause += ` AND dt.owner_legal_party_id = $${params.length}`;
    } else {
      const legalEntityResult = await serviceQuery(`
        SELECT legal_party_id FROM cc_tenant_legal_entities WHERE tenant_id = $1
      `, [ctx.tenant_id]);

      if (legalEntityResult.rows.length > 0) {
        params.push(legalEntityResult.rows[0].legal_party_id);
        whereClause += ` AND dt.owner_legal_party_id = $${params.length}`;
      } else {
        return res.json({
          ok: true,
          templates: [],
          message: 'No legal entity configured for tenant'
        });
      }
    }

    const result = await serviceQuery(`
      SELECT 
        dt.id, dt.template_type, dt.name, dt.source_media_id,
        dt.status, dt.created_at, dt.updated_at,
        p.name as legal_party_name
      FROM cc_document_templates dt
      JOIN cc_parties p ON p.id = dt.owner_legal_party_id
      ${whereClause}
      ORDER BY dt.created_at DESC
    `, params);

    res.json({
      ok: true,
      templates: result.rows
    });

  } catch (error: any) {
    console.error('List document templates error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to list document templates'
    });
  }
});

router.post('/', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { templateType, name, sourceMediaId, templatePayload } = req.body;

  if (!ctx?.tenant_id) {
    return res.status(401).json({
      ok: false,
      error: 'TENANT_REQUIRED'
    });
  }

  if (!templateType || !name) {
    return res.status(400).json({
      ok: false,
      error: 'VALIDATION_ERROR',
      message: 'templateType and name are required'
    });
  }

  const validTypes = ['employment_offer', 'employment_agreement', 'nda', 'onboarding_packet', 'other'];
  if (!validTypes.includes(templateType)) {
    return res.status(400).json({
      ok: false,
      error: 'VALIDATION_ERROR',
      message: `templateType must be one of: ${validTypes.join(', ')}`
    });
  }

  try {
    const legalEntityResult = await serviceQuery(`
      SELECT legal_party_id FROM cc_tenant_legal_entities WHERE tenant_id = $1
    `, [ctx.tenant_id]);

    if (legalEntityResult.rows.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'NO_LEGAL_ENTITY',
        message: 'Tenant must have a legal entity configured to create document templates'
      });
    }

    const legalPartyId = legalEntityResult.rows[0].legal_party_id;

    const result = await serviceQuery(`
      INSERT INTO cc_document_templates 
        (owner_legal_party_id, template_type, name, source_media_id, template_payload, status)
      VALUES ($1, $2, $3, $4, $5, 'draft')
      RETURNING id
    `, [legalPartyId, templateType, name, sourceMediaId, JSON.stringify(templatePayload || {})]);

    res.status(201).json({
      ok: true,
      templateId: result.rows[0].id
    });

  } catch (error: any) {
    console.error('Create document template error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to create document template'
    });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { id } = req.params;

  if (!ctx?.tenant_id) {
    return res.status(401).json({
      ok: false,
      error: 'TENANT_REQUIRED'
    });
  }

  try {
    const legalEntityResult = await serviceQuery(`
      SELECT legal_party_id FROM cc_tenant_legal_entities WHERE tenant_id = $1
    `, [ctx.tenant_id]);

    if (legalEntityResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'TEMPLATE_NOT_FOUND'
      });
    }

    const result = await serviceQuery(`
      SELECT 
        dt.*, p.name as legal_party_name, p.display_name as legal_party_display_name
      FROM cc_document_templates dt
      JOIN cc_parties p ON p.id = dt.owner_legal_party_id
      WHERE dt.id = $1 AND dt.owner_legal_party_id = $2
    `, [id, legalEntityResult.rows[0].legal_party_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'TEMPLATE_NOT_FOUND'
      });
    }

    res.json({
      ok: true,
      template: result.rows[0]
    });

  } catch (error: any) {
    console.error('Get document template error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch document template'
    });
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { id } = req.params;
  const { status, name, templatePayload } = req.body;

  if (!ctx?.tenant_id) {
    return res.status(401).json({
      ok: false,
      error: 'TENANT_REQUIRED'
    });
  }

  try {
    const legalEntityResult = await serviceQuery(`
      SELECT legal_party_id FROM cc_tenant_legal_entities WHERE tenant_id = $1
    `, [ctx.tenant_id]);

    if (legalEntityResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'TEMPLATE_NOT_FOUND'
      });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (status !== undefined) {
      const validStatuses = ['draft', 'active', 'archived'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          ok: false,
          error: 'VALIDATION_ERROR',
          message: `status must be one of: ${validStatuses.join(', ')}`
        });
      }
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }

    if (templatePayload !== undefined) {
      updates.push(`template_payload = $${paramIndex++}`);
      values.push(JSON.stringify(templatePayload));
    }

    if (updates.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'NO_FIELDS_TO_UPDATE'
      });
    }

    updates.push(`updated_at = now()`);
    values.push(id, legalEntityResult.rows[0].legal_party_id);

    const result = await serviceQuery(`
      UPDATE cc_document_templates SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND owner_legal_party_id = $${paramIndex + 1}
      RETURNING id
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'TEMPLATE_NOT_FOUND'
      });
    }

    res.json({
      ok: true,
      message: 'Template updated'
    });

  } catch (error: any) {
    console.error('Update document template error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to update document template'
    });
  }
});

router.post('/:id/generate', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { id } = req.params;
  const { recipientData, applicationId } = req.body;

  if (!ctx?.tenant_id) {
    return res.status(401).json({
      ok: false,
      error: 'TENANT_REQUIRED'
    });
  }

  try {
    const legalEntityResult = await serviceQuery(`
      SELECT tle.legal_party_id, tle.dba_name_snapshot, 
             p.name as legal_name, p.display_name as trade_name
      FROM cc_tenant_legal_entities tle
      JOIN cc_parties p ON p.id = tle.legal_party_id
      WHERE tle.tenant_id = $1
    `, [ctx.tenant_id]);

    if (legalEntityResult.rows.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'NO_LEGAL_ENTITY'
      });
    }

    const legalEntity = legalEntityResult.rows[0];

    const templateResult = await serviceQuery(`
      SELECT * FROM cc_document_templates
      WHERE id = $1 AND owner_legal_party_id = $2 AND status = 'active'
    `, [id, legalEntity.legal_party_id]);

    if (templateResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'TEMPLATE_NOT_FOUND_OR_NOT_ACTIVE'
      });
    }

    const template = templateResult.rows[0];

    let employerLine = legalEntity.legal_name;
    if (legalEntity.dba_name_snapshot && legalEntity.dba_name_snapshot !== legalEntity.legal_name) {
      employerLine = `${legalEntity.legal_name} (dba ${legalEntity.dba_name_snapshot})`;
    }

    let mediaIds: any = {};
    const mediaResult = await serviceQuery(`
      SELECT media_id, role FROM cc_entity_media
      WHERE party_id = $1 AND role IN ('letterhead', 'brandLogo')
    `, [legalEntity.legal_party_id]);

    for (const row of mediaResult.rows) {
      mediaIds[row.role] = row.media_id;
    }

    const generatedDocument = {
      templateId: template.id,
      templateType: template.template_type,
      templateName: template.name,
      employer: {
        legalName: legalEntity.legal_name,
        tradeName: legalEntity.trade_name,
        dbaLine: employerLine,
        letterheadMediaId: mediaIds.letterhead,
        logoMediaId: mediaIds.brandLogo
      },
      recipient: recipientData,
      applicationId,
      generatedAt: new Date().toISOString(),
      status: 'generated',
      pdfUrl: null
    };

    res.json({
      ok: true,
      document: generatedDocument,
      message: 'Document generation metadata prepared. PDF rendering would be done by a background worker.'
    });

  } catch (error: any) {
    console.error('Generate document error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to generate document'
    });
  }
});

export default router;
