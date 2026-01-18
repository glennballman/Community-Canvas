import { Router } from "express";
import { pool } from "../db";

export const p2ReservationsRouter = Router();

function getTenantId(req: any): string | null {
  return req.session?.tenantId || req.headers['x-tenant-id'] as string || null;
}

// GET /api/p2/reservations - List reservations with filters
p2ReservationsRouter.get("/", async (req, res) => {
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
p2ReservationsRouter.post("/:id/check-in", async (req, res) => {
  try {
    const { id } = req.params;

    // Verify reservation exists and is confirmed
    const check = await pool.query(
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

// POST /api/p2/reservations/:id/check-out
p2ReservationsRouter.post("/:id/check-out", async (req, res) => {
  try {
    const { id } = req.params;

    // Verify reservation exists and is checked_in
    const check = await pool.query(
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
