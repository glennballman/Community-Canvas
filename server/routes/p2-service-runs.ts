import { Router, Request, Response } from "express";
import { pool } from "../db";

const router = Router();

// GET /api/p2/service-runs - List service runs with filters
router.get("/", async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, status, serviceType, search } = req.query;

    let query = `
      SELECT 
        id,
        company_name,
        service_type,
        destination_region,
        planned_date,
        planned_duration_days,
        total_job_slots,
        slots_filled,
        crew_size,
        crew_lead_name,
        status,
        reservation_deadline,
        reservation_notes,
        created_at
      FROM cc_service_runs
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (startDate) {
      query += ` AND planned_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND planned_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    if (status) {
      const statuses = (status as string).split(",").map(s => s.trim());
      query += ` AND status = ANY($${paramIndex}::text[])`;
      params.push(statuses);
      paramIndex++;
    }

    if (serviceType) {
      const types = (serviceType as string).split(",").map(s => s.trim());
      query += ` AND service_type = ANY($${paramIndex}::text[])`;
      params.push(types);
      paramIndex++;
    }

    if (search) {
      query += ` AND (company_name ILIKE $${paramIndex} OR destination_region ILIKE $${paramIndex} OR crew_lead_name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY planned_date ASC, created_at ASC`;

    const result = await pool.query(query, params);

    const serviceRuns = result.rows.map(row => ({
      id: row.id,
      title: `${row.company_name} - ${row.destination_region}`,
      company_name: row.company_name,
      service_type: row.service_type,
      destination_region: row.destination_region,
      scheduled_date: row.planned_date,
      planned_duration_days: row.planned_duration_days,
      total_job_slots: row.total_job_slots,
      slots_filled: row.slots_filled,
      crew_size: row.crew_size,
      crew_name: row.crew_lead_name,
      status: row.status || "draft",
      reservation_deadline: row.reservation_deadline,
      notes: row.reservation_notes,
    }));

    res.json({ ok: true, data: { serviceRuns } });
  } catch (e: any) {
    console.error("[p2-service-runs] list error:", e.message);
    res.status(500).json({
      ok: false,
      error: { code: "INTERNAL", message: e.message },
    });
  }
});

// GET /api/p2/service-runs/filters - Get available filter options
router.get("/filters", async (req: Request, res: Response) => {
  try {
    const [serviceTypesResult, statusesResult] = await Promise.all([
      pool.query(`SELECT DISTINCT service_type FROM cc_service_runs WHERE service_type IS NOT NULL ORDER BY service_type`),
      pool.query(`SELECT DISTINCT status FROM cc_service_runs WHERE status IS NOT NULL ORDER BY status`),
    ]);

    res.json({
      ok: true,
      data: {
        serviceTypes: serviceTypesResult.rows.map(r => r.service_type),
        statuses: statusesResult.rows.map(r => r.status),
      },
    });
  } catch (e: any) {
    console.error("[p2-service-runs] filters error:", e.message);
    res.status(500).json({
      ok: false,
      error: { code: "INTERNAL", message: e.message },
    });
  }
});

// GET /api/p2/service-runs/:id - Get single service run detail
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM cc_service_runs WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: { code: "NOT_FOUND", message: "Service run not found" },
      });
    }

    const row = result.rows[0];
    const serviceRun = {
      id: row.id,
      title: `${row.company_name} - ${row.destination_region}`,
      company_name: row.company_name,
      service_type: row.service_type,
      destination_region: row.destination_region,
      scheduled_date: row.planned_date,
      planned_duration_days: row.planned_duration_days,
      flexible_dates: row.flexible_dates,
      date_flexibility_days: row.date_flexibility_days,
      total_job_slots: row.total_job_slots,
      slots_filled: row.slots_filled,
      crew_size: row.crew_size,
      crew_name: row.crew_lead_name,
      vehicle_id: row.vehicle_id,
      vehicle_description: row.vehicle_description,
      status: row.status || "draft",
      published_at: row.published_at,
      confirmed_at: row.confirmed_at,
      reservation_deadline: row.reservation_deadline,
      contact_email: row.contact_email,
      contact_telephone: row.contact_telephone,
      notes: row.reservation_notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    res.json({ ok: true, data: { serviceRun } });
  } catch (e: any) {
    console.error("[p2-service-runs] detail error:", e.message);
    res.status(500).json({
      ok: false,
      error: { code: "INTERNAL", message: e.message },
    });
  }
});

export { router as p2ServiceRunsRouter };
