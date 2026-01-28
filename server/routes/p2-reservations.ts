import { Router, Request, Response, NextFunction } from "express";
import { pool } from "../db";
import { can, canAccessResource, ResourceAccessOptions } from "../auth/authorize";
import { requireAuth, requireTenant } from '../middleware/guards';
import type { TenantRequest } from '../middleware/tenantContext';

export const p2ReservationsRouter = Router();

function getTenantId(req: any): string | null {
  return req.session?.tenantId || req.headers['x-tenant-id'] as string || null;
}

/**
 * PROMPT-11: Capability-based guard for reservation read access
 */
async function requireReservationRead(req: Request, res: Response, next: NextFunction) {
  const tenantReq = req as TenantRequest;
  const tenantId = getTenantId(req) || undefined;
  
  const canReadAll = await can(req, 'reservations.read', { tenantId });
  const canReadOwn = await can(req, 'reservations.own.read', { tenantId });
  
  if (canReadAll || canReadOwn) {
    (req as any).canReadAllReservations = canReadAll;
    return next();
  }
  
  return res.status(403).json({ 
    error: 'Reservation access required',
    code: 'NOT_AUTHORIZED'
  });
}

/**
 * PROMPT-11: Check if user can access a specific reservation
 */
async function canAccessReservation(req: Request, reservationId: string): Promise<boolean> {
  const tenantId = getTenantId(req) || undefined;
  
  return canAccessResource(req, {
    capabilityOwn: 'reservations.own.read',
    capabilityAll: 'reservations.read',
    resourceTable: 'cc_pms_reservations',
    resourceId: reservationId,
    tenantId,
  });
}

/**
 * PROMPT-11: Capability-based guard for reservation mutations
 */
async function requireReservationManage(req: Request, res: Response, next: NextFunction) {
  const tenantReq = req as TenantRequest;
  const tenantId = getTenantId(req) || undefined;
  
  const canManage = await can(req, 'reservations.update', { tenantId });
  const canCheckIn = await can(req, 'reservations.checkin', { tenantId });
  
  if (canManage || canCheckIn) {
    return next();
  }
  
  return res.status(403).json({ 
    error: 'Reservation management access required',
    code: 'NOT_AUTHORIZED'
  });
}

// GET /api/p2/reservations - List reservations with filters
// NOTE: Tenant scoping via portal relationship. cc_pms_reservations uses portal_id, not tenant_id directly.
// PROMPT-11: Added requireReservationRead guard for capability enforcement
p2ReservationsRouter.get("/", requireAuth, requireTenant, requireReservationRead, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const {
      q,
      status,
      startDate,
      endDate,
      upcomingOnly = "true",
      page = "1",
      pageSize = "20",
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(pageSize) || 20));
    const offset = (pageNum - 1) * limit;
    const isUpcoming = upcomingOnly === "true";

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Tenant scoping via portal relationship
    if (tenantId) {
      conditions.push(`EXISTS (SELECT 1 FROM cc_portals p WHERE p.id = r.portal_id AND p.tenant_id = $${paramIndex})`);
      params.push(tenantId);
      paramIndex++;
    }

    // Status filter
    if (status && status !== "all") {
      conditions.push(`r.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    } else if (isUpcoming) {
      // Default: exclude cancelled/completed when upcomingOnly
      conditions.push(`r.status NOT IN ('cancelled', 'completed')`);
    }

    // Date filters
    if (startDate) {
      conditions.push(`r.check_in_date >= $${paramIndex}::date`);
      params.push(startDate);
      paramIndex++;
    }
    if (endDate) {
      conditions.push(`r.check_out_date <= $${paramIndex}::date`);
      params.push(endDate);
      paramIndex++;
    }

    // Upcoming only: check-out must be today or later
    if (isUpcoming && !endDate) {
      conditions.push(`r.check_out_date >= CURRENT_DATE`);
    }

    // Search filter
    if (q) {
      conditions.push(`(
        r.guest_name ILIKE $${paramIndex}
        OR r.confirmation_number ILIKE $${paramIndex}
        OR r.guest_email ILIKE $${paramIndex}
      )`);
      params.push(`%${q}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Count query
    const countResult = await pool.query(
      `SELECT count(*)::int as total FROM cc_pms_reservations r ${whereClause}`,
      params
    );
    const total = countResult.rows[0]?.total || 0;

    // Data query with unit name join
    params.push(limit);
    params.push(offset);

    const dataResult = await pool.query(
      `SELECT 
        r.id,
        r.status,
        r.guest_name,
        r.guest_email,
        r.confirmation_number,
        r.check_in_date,
        r.check_out_date,
        r.unit_id,
        COALESCE(u.name, 'Unit ' || substring(r.unit_id::text, 1, 8)) as unit_name
      FROM cc_pms_reservations r
      LEFT JOIN cc_units u ON r.unit_id = u.id
      ${whereClause}
      ORDER BY r.check_in_date ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    const reservations = dataResult.rows.map((r: any) => ({
      id: r.id,
      status: r.status,
      guest_name: r.guest_name,
      guest_email: r.guest_email,
      confirmation_number: r.confirmation_number,
      check_in_date: r.check_in_date,
      check_out_date: r.check_out_date,
      unit_id: r.unit_id,
      unit_name: r.unit_name,
    }));

    res.json({
      ok: true,
      reservations,
      total,
      page: pageNum,
      pageSize: limit,
    });
  } catch (e: any) {
    console.error("[p2-reservations] list error:", e.message);
    res.status(500).json({ ok: false, error: { code: "INTERNAL", message: e.message } });
  }
});

// POST /api/p2/reservations/:id/check-in
// PROMPT-11: Added requireReservationManage guard for capability enforcement
p2ReservationsRouter.post("/:id/check-in", requireAuth, requireTenant, requireReservationManage, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;

    // Verify reservation exists and is confirmed (with tenant scoping via portal)
    const check = tenantId
      ? await pool.query(
          `SELECT r.id, r.status FROM cc_pms_reservations r
           WHERE r.id = $1 AND EXISTS (SELECT 1 FROM cc_portals p WHERE p.id = r.portal_id AND p.tenant_id = $2)`,
          [id, tenantId]
        )
      : await pool.query(
          `SELECT id, status FROM cc_pms_reservations WHERE id = $1`,
          [id]
        );

    if (check.rows.length === 0) {
      return res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "Reservation not found" } });
    }

    if (check.rows[0].status !== "confirmed") {
      return res.status(400).json({ 
        ok: false, 
        error: { code: "INVALID_STATUS", message: "Only confirmed reservations can be checked in" } 
      });
    }

    await pool.query(
      `UPDATE cc_pms_reservations 
       SET status = 'checked_in', checked_in_at = NOW(), updated_at = NOW() 
       WHERE id = $1`,
      [id]
    );

    res.json({ ok: true });
  } catch (e: any) {
    console.error("[p2-reservations] check-in error:", e.message);
    res.status(500).json({ ok: false, error: { code: "INTERNAL", message: e.message } });
  }
});

// GET /api/p2/reservations/:id - Detail view
p2ReservationsRouter.get("/:id", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;

    // Build tenant-scoped query
    const query = tenantId
      ? `SELECT 
          r.id,
          r.status,
          r.confirmation_number,
          r.guest_name,
          r.guest_email,
          r.guest_phone,
          r.guest_count,
          r.guest_notes,
          r.check_in_date,
          r.check_out_date,
          r.expected_arrival_time,
          r.actual_arrival_time,
          r.expected_departure_time,
          r.actual_departure_time,
          r.source,
          r.cancellation_reason,
          r.portal_id,
          r.unit_id,
          r.created_at,
          r.updated_at,
          r.confirmed_at,
          r.checked_in_at,
          r.checked_out_at,
          r.cancelled_at,
          COALESCE(u.name, 'Unit ' || substring(r.unit_id::text, 1, 8)) as unit_name
        FROM cc_pms_reservations r
        LEFT JOIN cc_units u ON r.unit_id = u.id
        WHERE r.id = $1 
          AND EXISTS (SELECT 1 FROM cc_portals p WHERE p.id = r.portal_id AND p.tenant_id = $2)`
      : `SELECT 
          r.id,
          r.status,
          r.confirmation_number,
          r.guest_name,
          r.guest_email,
          r.guest_phone,
          r.guest_count,
          r.guest_notes,
          r.check_in_date,
          r.check_out_date,
          r.expected_arrival_time,
          r.actual_arrival_time,
          r.expected_departure_time,
          r.actual_departure_time,
          r.source,
          r.cancellation_reason,
          r.portal_id,
          r.unit_id,
          r.created_at,
          r.updated_at,
          r.confirmed_at,
          r.checked_in_at,
          r.checked_out_at,
          r.cancelled_at,
          COALESCE(u.name, 'Unit ' || substring(r.unit_id::text, 1, 8)) as unit_name
        FROM cc_pms_reservations r
        LEFT JOIN cc_units u ON r.unit_id = u.id
        WHERE r.id = $1`;

    const params = tenantId ? [id, tenantId] : [id];
    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "Reservation not found" } });
    }

    const row = result.rows[0];

    // Build timeline from status timestamps
    const timeline: Array<{ id: string; type: string; title: string; at: string; detail?: string | null }> = [];
    
    if (row.created_at) {
      timeline.push({
        id: `created-${row.id}`,
        type: "created",
        title: "Reservation created",
        at: row.created_at,
        detail: row.source ? `Source: ${row.source}` : null,
      });
    }
    
    if (row.confirmed_at) {
      timeline.push({
        id: `confirmed-${row.id}`,
        type: "confirmed",
        title: "Reservation confirmed",
        at: row.confirmed_at,
      });
    }
    
    if (row.checked_in_at) {
      timeline.push({
        id: `checkin-${row.id}`,
        type: "checked_in",
        title: "Guest checked in",
        at: row.checked_in_at,
      });
    }
    
    if (row.checked_out_at) {
      timeline.push({
        id: `checkout-${row.id}`,
        type: "checked_out",
        title: "Guest checked out",
        at: row.checked_out_at,
      });
    }
    
    if (row.cancelled_at) {
      timeline.push({
        id: `cancelled-${row.id}`,
        type: "cancelled",
        title: "Reservation cancelled",
        at: row.cancelled_at,
        detail: row.cancellation_reason,
      });
    }

    res.json({
      ok: true,
      reservation: {
        id: row.id,
        status: row.status,
        confirmation_number: row.confirmation_number,
        guest_name: row.guest_name,
        guest_email: row.guest_email,
        guest_phone: row.guest_phone,
        guest_count: row.guest_count,
        guest_notes: row.guest_notes,
        check_in_date: row.check_in_date,
        check_out_date: row.check_out_date,
        expected_arrival_time: row.expected_arrival_time,
        actual_arrival_time: row.actual_arrival_time,
        source: row.source,
        cancellation_reason: row.cancellation_reason,
        portal_id: row.portal_id,
        unit_id: row.unit_id,
        unit_name: row.unit_name,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
      timeline,
      allocations: [],
    });
  } catch (e: any) {
    console.error("[p2-reservations] detail error:", e.message);
    res.status(500).json({ ok: false, error: { code: "INTERNAL", message: e.message } });
  }
});

// POST /api/p2/reservations/:id/notes - Add internal note (append-only)
// NOTE: No notes table exists; returning NOT_IMPLEMENTED
p2ReservationsRouter.post("/:id/notes", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    const { message } = req.body || {};

    if (!message || typeof message !== "string" || message.trim().length < 3) {
      return res.status(400).json({ ok: false, error: { code: "INVALID_INPUT", message: "Message must be at least 3 characters" } });
    }

    // Verify reservation exists with tenant scope
    const check = tenantId
      ? await pool.query(
          `SELECT r.id FROM cc_pms_reservations r
           WHERE r.id = $1 AND EXISTS (SELECT 1 FROM cc_portals p WHERE p.id = r.portal_id AND p.tenant_id = $2)`,
          [id, tenantId]
        )
      : await pool.query(`SELECT id FROM cc_pms_reservations WHERE id = $1`, [id]);

    if (check.rows.length === 0) {
      return res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "Reservation not found" } });
    }

    // No notes table exists yet - return NOT_IMPLEMENTED
    // In future, this would insert into cc_pms_reservation_notes or similar
    return res.status(501).json({ 
      ok: false, 
      error: { code: "NOT_IMPLEMENTED", message: "Notes functionality not yet available" } 
    });
  } catch (e: any) {
    console.error("[p2-reservations] notes error:", e.message);
    res.status(500).json({ ok: false, error: { code: "INTERNAL", message: e.message } });
  }
});

// POST /api/p2/reservations/:id/change-request - Request change (request-only)
p2ReservationsRouter.post("/:id/change-request", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    const { message } = req.body || {};

    if (!message || typeof message !== "string" || message.trim().length < 3) {
      return res.status(400).json({ ok: false, error: { code: "INVALID_INPUT", message: "Message must be at least 3 characters" } });
    }

    // Verify reservation exists with tenant scope
    const check = tenantId
      ? await pool.query(
          `SELECT r.id FROM cc_pms_reservations r
           WHERE r.id = $1 AND EXISTS (SELECT 1 FROM cc_portals p WHERE p.id = r.portal_id AND p.tenant_id = $2)`,
          [id, tenantId]
        )
      : await pool.query(`SELECT id FROM cc_pms_reservations WHERE id = $1`, [id]);

    if (check.rows.length === 0) {
      return res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "Reservation not found" } });
    }

    // No request tracking table exists - return NOT_IMPLEMENTED
    return res.status(501).json({ 
      ok: false, 
      error: { code: "NOT_IMPLEMENTED", message: "Change request functionality not yet available" } 
    });
  } catch (e: any) {
    console.error("[p2-reservations] change-request error:", e.message);
    res.status(500).json({ ok: false, error: { code: "INTERNAL", message: e.message } });
  }
});

// POST /api/p2/reservations/:id/cancel-request - Request cancellation (request-only)
p2ReservationsRouter.post("/:id/cancel-request", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    const { message } = req.body || {};

    if (!message || typeof message !== "string" || message.trim().length < 3) {
      return res.status(400).json({ ok: false, error: { code: "INVALID_INPUT", message: "Message must be at least 3 characters" } });
    }

    // Verify reservation exists with tenant scope
    const check = tenantId
      ? await pool.query(
          `SELECT r.id FROM cc_pms_reservations r
           WHERE r.id = $1 AND EXISTS (SELECT 1 FROM cc_portals p WHERE p.id = r.portal_id AND p.tenant_id = $2)`,
          [id, tenantId]
        )
      : await pool.query(`SELECT id FROM cc_pms_reservations WHERE id = $1`, [id]);

    if (check.rows.length === 0) {
      return res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "Reservation not found" } });
    }

    // No request tracking table exists - return NOT_IMPLEMENTED
    return res.status(501).json({ 
      ok: false, 
      error: { code: "NOT_IMPLEMENTED", message: "Cancel request functionality not yet available" } 
    });
  } catch (e: any) {
    console.error("[p2-reservations] cancel-request error:", e.message);
    res.status(500).json({ ok: false, error: { code: "INTERNAL", message: e.message } });
  }
});

// POST /api/p2/reservations/:id/check-out
p2ReservationsRouter.post("/:id/check-out", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;

    // Verify reservation exists and is checked_in (with tenant scoping via portal)
    const check = tenantId
      ? await pool.query(
          `SELECT r.id, r.status FROM cc_pms_reservations r
           WHERE r.id = $1 AND EXISTS (SELECT 1 FROM cc_portals p WHERE p.id = r.portal_id AND p.tenant_id = $2)`,
          [id, tenantId]
        )
      : await pool.query(
          `SELECT id, status FROM cc_pms_reservations WHERE id = $1`,
          [id]
        );

    if (check.rows.length === 0) {
      return res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "Reservation not found" } });
    }

    if (check.rows[0].status !== "checked_in") {
      return res.status(400).json({ 
        ok: false, 
        error: { code: "INVALID_STATUS", message: "Only checked-in reservations can be checked out" } 
      });
    }

    await pool.query(
      `UPDATE cc_pms_reservations 
       SET status = 'checked_out', checked_out_at = NOW(), updated_at = NOW() 
       WHERE id = $1`,
      [id]
    );

    res.json({ ok: true });
  } catch (e: any) {
    console.error("[p2-reservations] check-out error:", e.message);
    res.status(500).json({ ok: false, error: { code: "INTERNAL", message: e.message } });
  }
});
