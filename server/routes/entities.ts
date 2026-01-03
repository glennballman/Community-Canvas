import { Router, Request, Response } from "express";
import { z } from "zod";
import { serviceQuery, withServiceTransaction } from "../db/tenantDb";
import { requireAuth, requireRole } from "../middleware/guards";
import { proposeLinksForExternalRecord, createEntityFromRecord, acceptLink, rejectLink, runResolutionBatch } from "../services/entityResolution";

const router = Router();

/**
 * P0-B: Entity Management Routes - Stop cross-tenant leakage
 * 
 * Security model:
 * - Datasets/Records: Admin-only platform data, use serviceQuery
 * - Entities: Platform-global reference data with visibility scoping
 * - Claims/Inquiries: User-initiated but scoped to authenticated user
 * - All mutations require admin role or self-ownership
 */

const uuidSchema = z.string().uuid();

// GET /api/entities/datasets - List all datasets (ADMIN ONLY)
// SERVICE MODE: apify_datasets is platform configuration, not tenant-scoped
router.get("/datasets", requireAuth, requireRole('admin'), async (_req: Request, res: Response) => {
  try {
    const result = await serviceQuery(`
      SELECT 
        id, name, slug, source::text, record_type::text, 
        region, sync_enabled, last_sync_at, last_sync_record_count,
        created_at
      FROM apify_datasets
      ORDER BY name
    `);
    res.json({ success: true, datasets: result.rows });
  } catch (error) {
    console.error("Error fetching datasets:", error);
    res.status(500).json({ success: false, error: "Failed to fetch datasets" });
  }
});

// POST /api/entities/datasets - Create/update dataset (ADMIN ONLY)
// SERVICE MODE: Platform configuration mutation
router.post("/datasets", requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      slug: z.string().min(1),
      apify_actor_id: z.string().min(1),
      source: z.string().default("other"),
      record_type: z.string().default("other"),
      region: z.string().optional()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: "Invalid dataset data" });
    }

    const { name, slug, apify_actor_id, source, record_type, region } = parsed.data;

    const result = await serviceQuery(`
      INSERT INTO apify_datasets (name, slug, apify_actor_id, source, record_type, region)
      VALUES ($1, $2, $3, $4::external_source, $5::external_record_type, $6)
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        apify_actor_id = EXCLUDED.apify_actor_id,
        updated_at = NOW()
      RETURNING id
    `, [name, slug, apify_actor_id, source, record_type, region || null]);

    res.json({ success: true, datasetId: result.rows[0].id });
  } catch (error) {
    console.error("Error creating dataset:", error);
    res.status(500).json({ success: false, error: "Failed to create dataset" });
  }
});

// GET /api/entities/records - List external records (ADMIN ONLY)
// SERVICE MODE: external_records is platform-scraped data for admin curation
router.get("/records", requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const source = req.query.source as string | undefined;
    const recordType = req.query.record_type as string | undefined;
    const needsResolution = req.query.needs_resolution === "true";

    let query = `
      SELECT 
        r.id, r.source::text, r.record_type::text, r.name, r.city, r.region,
        r.external_url, r.latitude, r.longitude, r.community_id,
        r.first_seen_at, r.last_seen_at, r.pii_risk, r.do_not_contact,
        d.name as dataset_name,
        (SELECT COUNT(*) FROM entity_links l WHERE l.external_record_id = r.id AND l.status = 'accepted') > 0 as is_resolved
      FROM external_records r
      JOIN apify_datasets d ON d.id = r.dataset_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (source) {
      query += ` AND r.source = $${paramIndex}::external_source`;
      params.push(source);
      paramIndex++;
    }

    if (recordType) {
      query += ` AND r.record_type = $${paramIndex}::external_record_type`;
      params.push(recordType);
      paramIndex++;
    }

    if (needsResolution) {
      query += ` AND NOT EXISTS (
        SELECT 1 FROM entity_links l 
        WHERE l.external_record_id = r.id AND l.status = 'accepted'
      )`;
    }

    query += ` ORDER BY r.last_seen_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await serviceQuery(query, params);
    res.json({ success: true, records: result.rows });
  } catch (error) {
    console.error("Error fetching external records:", error);
    res.status(500).json({ success: false, error: "Failed to fetch records" });
  }
});

// GET /api/entities/entities - List entities with visibility filtering
// SERVICE MODE: entities are platform-global but filtered by visibility
router.get("/entities", requireAuth, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const entityType = req.query.entity_type as string | undefined;
    const unclaimed = req.query.unclaimed === "true";

    // Filter by visibility - only show public entities unless admin
    const tenantReq = req as any;
    const isAdmin = tenantReq.ctx?.roles?.includes('admin');
    
    let query = `
      SELECT 
        e.id, e.entity_type_id, e.name as display_name, e.description,
        e.city, e.province as region, e.latitude, e.longitude, e.community_id,
        e.visibility, e.created_at,
        c.claimed_by_individual_id IS NOT NULL as is_claimed,
        (SELECT COUNT(*) FROM entity_links l WHERE l.entity_id = e.id AND l.status = 'accepted') as linked_records
      FROM entities e
      LEFT JOIN entity_claims c ON c.entity_id = e.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    // Non-admins only see public entities
    if (!isAdmin) {
      query += ` AND e.visibility = 'public'`;
    }

    if (entityType) {
      query += ` AND e.entity_type_id = $${paramIndex}`;
      params.push(entityType);
      paramIndex++;
    }

    if (unclaimed) {
      query += ` AND c.entity_id IS NULL`;
    }

    query += ` ORDER BY e.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await serviceQuery(query, params);
    res.json({ success: true, entities: result.rows });
  } catch (error) {
    console.error("Error fetching entities:", error);
    res.status(500).json({ success: false, error: "Failed to fetch entities" });
  }
});

// POST /api/entities/entities - Create entity (ADMIN ONLY)
// SERVICE MODE: Entity creation is admin operation
router.post("/entities", requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      entity_type: z.string(),
      display_name: z.string().min(1),
      description: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      region: z.string().optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      community_id: z.string().uuid().optional()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: "Invalid entity data" });
    }

    const data = parsed.data;

    const result = await serviceQuery(`
      INSERT INTO entities (
        entity_type_id, name, description, address_line1, city, province,
        latitude, longitude, community_id, visibility
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, 'private'
      )
      RETURNING id
    `, [
      data.entity_type,
      data.display_name,
      data.description || null,
      data.address || null,
      data.city || null,
      data.region || 'BC',
      data.latitude || null,
      data.longitude || null,
      data.community_id || null
    ]);

    res.json({ success: true, entityId: result.rows[0].id });
  } catch (error) {
    console.error("Error creating entity:", error);
    res.status(500).json({ success: false, error: "Failed to create entity" });
  }
});

// POST /api/entities/entities/from-record/:recordId - Create entity from record (ADMIN ONLY)
router.post("/entities/from-record/:recordId", requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const recordId = uuidSchema.parse(req.params.recordId);
    const entityType = (req.body.entity_type as string) || "other";

    const entityId = await createEntityFromRecord(recordId, entityType);
    if (!entityId) {
      return res.status(404).json({ success: false, error: "Record not found" });
    }

    res.json({ success: true, entityId });
  } catch (error) {
    console.error("Error creating entity from record:", error);
    res.status(500).json({ success: false, error: "Failed to create entity" });
  }
});

// GET /api/entities/links/queue - Get resolution queue (ADMIN ONLY)
// SERVICE MODE: Admin curation view
router.get("/links/queue", requireAuth, requireRole('admin'), async (_req: Request, res: Response) => {
  try {
    const result = await serviceQuery(`
      SELECT * FROM v_entity_resolution_queue LIMIT 100
    `);
    res.json({ success: true, links: result.rows });
  } catch (error) {
    console.error("Error fetching resolution queue:", error);
    res.status(500).json({ success: false, error: "Failed to fetch queue" });
  }
});

// POST /api/entities/links/:linkId/accept - Accept link (ADMIN ONLY)
router.post("/links/:linkId/accept", requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const linkId = uuidSchema.parse(req.params.linkId);
    const userEmail = (req as any).user?.email || (req as any).ctx?.email;

    const success = await acceptLink(linkId, userEmail);
    if (!success) {
      return res.status(404).json({ success: false, error: "Link not found or already decided" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error accepting link:", error);
    res.status(500).json({ success: false, error: "Failed to accept link" });
  }
});

// POST /api/entities/links/:linkId/reject - Reject link (ADMIN ONLY)
router.post("/links/:linkId/reject", requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const linkId = uuidSchema.parse(req.params.linkId);
    const userEmail = (req as any).user?.email || (req as any).ctx?.email;

    const success = await rejectLink(linkId, userEmail);
    if (!success) {
      return res.status(404).json({ success: false, error: "Link not found or already decided" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error rejecting link:", error);
    res.status(500).json({ success: false, error: "Failed to reject link" });
  }
});

// POST /api/entities/resolution/run-batch - Run resolution batch (ADMIN ONLY)
router.post("/resolution/run-batch", requireAuth, requireRole('admin'), async (_req: Request, res: Response) => {
  try {
    const result = await runResolutionBatch(100);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Error running resolution batch:", error);
    res.status(500).json({ success: false, error: "Failed to run resolution" });
  }
});

// POST /api/entities/records/:recordId/propose-links - Propose links (ADMIN ONLY)
router.post("/records/:recordId/propose-links", requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const recordId = uuidSchema.parse(req.params.recordId);
    const linksCreated = await proposeLinksForExternalRecord(recordId);
    res.json({ success: true, linksCreated });
  } catch (error) {
    console.error("Error proposing links:", error);
    res.status(500).json({ success: false, error: "Failed to propose links" });
  }
});

// POST /api/entities/claims - Submit claim request (SELF)
router.post("/claims", requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantReq = req as any;
    const userEmail = tenantReq.user?.email || tenantReq.ctx?.email;
    if (!userEmail) {
      return res.status(401).json({ success: false, error: "Not authenticated" });
    }

    const schema = z.object({
      entity_id: z.string().uuid(),
      verification_method: z.string().optional(),
      verification_data: z.record(z.any()).optional()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: "Invalid claim data" });
    }

    const { entity_id, verification_method, verification_data } = parsed.data;

    // Use tenantTransaction - user can only claim for themselves
    const result = await req.tenantTransaction(async (client) => {
      const individualResult = await client.query(
        `SELECT id, full_name FROM cc_individuals WHERE email = $1`,
        [userEmail]
      );

      if (individualResult.rows.length === 0) {
        return { error: "Profile required to claim", status: 400 };
      }

      const individual = individualResult.rows[0];

      const insertResult = await client.query(`
        INSERT INTO entity_claim_requests (
          entity_id, claimant_individual_id, claimant_email, claimant_name,
          verification_method, verification_data, status
        ) VALUES ($1, $2, $3, $4, $5, $6, 'pending'::claim_status)
        RETURNING id
      `, [
        entity_id,
        individual.id,
        userEmail,
        individual.full_name,
        verification_method || null,
        JSON.stringify(verification_data || {})
      ]);

      return { claimRequestId: insertResult.rows[0].id };
    });

    if (result.error) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }

    res.json({ success: true, claimRequestId: result.claimRequestId });
  } catch (error) {
    console.error("Error creating claim request:", error);
    res.status(500).json({ success: false, error: "Failed to create claim" });
  }
});

// GET /api/entities/claims/pending - Get pending claims (ADMIN ONLY)
// SERVICE MODE: Admin review queue
router.get("/claims/pending", requireAuth, requireRole('admin'), async (_req: Request, res: Response) => {
  try {
    const result = await serviceQuery(`
      SELECT 
        cr.id, cr.entity_id, cr.claimant_email, cr.claimant_name,
        cr.verification_method, cr.status::text, cr.created_at,
        e.name as entity_name, e.entity_type_id
      FROM entity_claim_requests cr
      JOIN entities e ON e.id = cr.entity_id
      WHERE cr.status = 'pending'
      ORDER BY cr.created_at
    `);
    res.json({ success: true, claims: result.rows });
  } catch (error) {
    console.error("Error fetching pending claims:", error);
    res.status(500).json({ success: false, error: "Failed to fetch claims" });
  }
});

// POST /api/entities/claims/:claimId/approve - Approve claim (ADMIN ONLY)
router.post("/claims/:claimId/approve", requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const claimId = uuidSchema.parse(req.params.claimId);

    // SERVICE MODE: Admin operation affecting platform data
    await withServiceTransaction(async (client) => {
      const claimResult = await client.query(
        `SELECT entity_id, claimant_individual_id, claimant_tenant_id 
         FROM entity_claim_requests WHERE id = $1 AND status = 'pending'`,
        [claimId]
      );

      if (claimResult.rows.length === 0) {
        throw new Error("Claim not found or not pending");
      }

      const claim = claimResult.rows[0];

      await client.query(
        `UPDATE entity_claim_requests SET status = 'approved', reviewed_at = NOW() WHERE id = $1`,
        [claimId]
      );

      await client.query(`
        INSERT INTO entity_claims (entity_id, claimed_by_individual_id, claimed_by_tenant_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (entity_id) DO UPDATE SET
          claimed_by_individual_id = EXCLUDED.claimed_by_individual_id,
          claimed_by_tenant_id = EXCLUDED.claimed_by_tenant_id,
          claimed_at = NOW()
      `, [claim.entity_id, claim.claimant_individual_id, claim.claimant_tenant_id]);
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error approving claim:", error);
    if (error.message === "Claim not found or not pending") {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: "Failed to approve claim" });
  }
});

// POST /api/entities/claims/:claimId/reject - Reject claim (ADMIN ONLY)
router.post("/claims/:claimId/reject", requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const claimId = uuidSchema.parse(req.params.claimId);
    const reason = (req.body.reason as string) || null;

    // SERVICE MODE: Admin operation
    const result = await serviceQuery(
      `UPDATE entity_claim_requests SET status = 'rejected', reviewed_at = NOW(), rejection_reason = $2
       WHERE id = $1 AND status = 'pending'
       RETURNING id`,
      [claimId, reason]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: "Claim not found or not pending" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error rejecting claim:", error);
    res.status(500).json({ success: false, error: "Failed to reject claim" });
  }
});

// GET /api/entities/inquiries - List inquiries (ADMIN ONLY for all, or self for own)
router.get("/inquiries", requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantReq = req as any;
    const isAdmin = tenantReq.ctx?.roles?.includes('admin');
    const status = req.query.status as string | undefined;
    
    let query: string;
    const params: any[] = [];

    if (isAdmin) {
      // SERVICE MODE: Admin sees all inquiries
      query = `
        SELECT 
          i.id, i.entity_id, i.external_record_id, i.inquiry_type, 
          i.message, i.status, i.created_at,
          e.name as entity_name,
          ind.full_name as inquirer_name,
          ind.email as inquirer_email
        FROM entity_inquiries i
        LEFT JOIN entities e ON e.id = i.entity_id
        JOIN cc_individuals ind ON ind.id = i.inquirer_individual_id
        WHERE 1=1
      `;

      if (status) {
        query += ` AND i.status = $1`;
        params.push(status);
      }

      query += ` ORDER BY i.created_at DESC LIMIT 100`;

      const result = await serviceQuery(query, params);
      res.json({ success: true, inquiries: result.rows });
    } else {
      // Non-admin: Only see own inquiries via tenant context
      const result = await req.tenantQuery(`
        SELECT 
          i.id, i.entity_id, i.external_record_id, i.inquiry_type, 
          i.message, i.status, i.created_at,
          e.name as entity_name
        FROM entity_inquiries i
        LEFT JOIN entities e ON e.id = i.entity_id
        JOIN cc_individuals ind ON ind.id = i.inquirer_individual_id
        WHERE ind.email = $1
        ORDER BY i.created_at DESC LIMIT 100
      `, [tenantReq.ctx?.email]);
      res.json({ success: true, inquiries: result.rows });
    }
  } catch (error) {
    console.error("Error fetching inquiries:", error);
    res.status(500).json({ success: false, error: "Failed to fetch inquiries" });
  }
});

// POST /api/entities/inquiries - Create inquiry (SELF)
router.post("/inquiries", requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantReq = req as any;
    const userEmail = tenantReq.user?.email || tenantReq.ctx?.email;
    if (!userEmail) {
      return res.status(401).json({ success: false, error: "Not authenticated" });
    }

    const schema = z.object({
      entity_id: z.string().uuid().optional(),
      external_record_id: z.string().uuid().optional(),
      inquiry_type: z.string(),
      message: z.string().optional(),
      requested_dates: z.record(z.any()).optional()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: "Invalid inquiry data" });
    }

    const data = parsed.data;
    if (!data.entity_id && !data.external_record_id) {
      return res.status(400).json({ success: false, error: "Entity or record required" });
    }

    // Use tenantTransaction for self-mutation
    const result = await req.tenantTransaction(async (client) => {
      const individualResult = await client.query(
        `SELECT id FROM cc_individuals WHERE email = $1`,
        [userEmail]
      );

      if (individualResult.rows.length === 0) {
        return { error: "Profile required", status: 400 };
      }

      const individualId = individualResult.rows[0].id;

      const insertResult = await client.query(`
        INSERT INTO entity_inquiries (
          entity_id, external_record_id, inquirer_individual_id,
          inquiry_type, message, requested_dates, status,
          expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW() + INTERVAL '30 days')
        RETURNING id
      `, [
        data.entity_id || null,
        data.external_record_id || null,
        individualId,
        data.inquiry_type,
        data.message || null,
        data.requested_dates ? JSON.stringify(data.requested_dates) : null
      ]);

      return { inquiryId: insertResult.rows[0].id };
    });

    if (result.error) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }

    res.json({ success: true, inquiryId: result.inquiryId });
  } catch (error) {
    console.error("Error creating inquiry:", error);
    res.status(500).json({ success: false, error: "Failed to create inquiry" });
  }
});

export default router;
