import { Router } from "express";
import { pool } from "../db";

export const p2DashboardRouter = Router();

function getTenantId(req: any): string | null {
  return req.session?.tenantId || req.headers['x-tenant-id'] as string || null;
}

p2DashboardRouter.get("/reservations/summary", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const today = new Date().toISOString().split("T")[0];

    const result = tenantId 
      ? await pool.query(`
          SELECT 
            count(*)::int as total,
            count(*) FILTER (
              WHERE check_in_date::date = $1::date 
              OR check_out_date::date = $1::date
            )::int as active_today
          FROM cc_pms_reservations
          WHERE tenant_id = $2 AND status NOT IN ('cancelled', 'completed')
        `, [today, tenantId])
      : await pool.query(`
          SELECT 
            count(*)::int as total,
            count(*) FILTER (
              WHERE check_in_date::date = $1::date 
              OR check_out_date::date = $1::date
            )::int as active_today
          FROM cc_pms_reservations
          WHERE status NOT IN ('cancelled', 'completed')
        `, [today]);

    const row = result.rows[0] || { total: 0, active_today: 0 };
    res.json({ 
      ok: true, 
      total: row.total || 0, 
      activeToday: row.active_today || 0 
    });
  } catch (e: any) {
    console.error("[p2-dashboard] reservations/summary error:", e.message);
    res.status(500).json({ ok: false, error: { code: "INTERNAL", message: e.message } });
  }
});

p2DashboardRouter.get("/service-runs/summary", async (req, res) => {
  try {
    const tenantId = getTenantId(req);

    const result = tenantId
      ? await pool.query(`
          SELECT count(*)::int as upcoming
          FROM cc_service_runs
          WHERE tenant_id = $1
            AND scheduled_date >= CURRENT_DATE
            AND scheduled_date <= CURRENT_DATE + interval '7 days'
            AND status NOT IN ('cancelled', 'completed')
        `, [tenantId])
      : await pool.query(`
          SELECT count(*)::int as upcoming
          FROM cc_service_runs
          WHERE scheduled_date >= CURRENT_DATE
            AND scheduled_date <= CURRENT_DATE + interval '7 days'
            AND status NOT IN ('cancelled', 'completed')
        `);

    res.json({ ok: true, upcoming: result.rows[0]?.upcoming || 0 });
  } catch (e: any) {
    console.error("[p2-dashboard] service-runs/summary error:", e.message);
    res.status(500).json({ ok: false, error: { code: "INTERNAL", message: e.message } });
  }
});

p2DashboardRouter.get("/jobs/summary", async (req, res) => {
  try {
    const tenantId = getTenantId(req);

    const result = tenantId
      ? await pool.query(`
          SELECT count(*)::int as open_postings
          FROM cc_job_postings jp
          JOIN cc_jobs j ON jp.job_id = j.id
          WHERE j.tenant_id = $1 AND jp.status = 'open'
        `, [tenantId])
      : await pool.query(`
          SELECT count(*)::int as open_postings
          FROM cc_job_postings
          WHERE status = 'open'
        `);

    res.json({ ok: true, openPostings: result.rows[0]?.open_postings || 0 });
  } catch (e: any) {
    console.error("[p2-dashboard] jobs/summary error:", e.message);
    res.status(500).json({ ok: false, error: { code: "INTERNAL", message: e.message } });
  }
});

p2DashboardRouter.get("/messages/unread-count", async (req, res) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    const tenantId = getTenantId(req);
    
    // Require both user and tenant context for security
    // This prevents cross-tenant data leakage
    if (!userId || !tenantId) {
      return res.json({ ok: true, count: 0 });
    }

    // Look up party_id for tenant-based participation (owner/contractor)
    const partyResult = await pool.query(`
      SELECT id FROM cc_parties
      WHERE tenant_id = $1 AND party_kind = 'organization'
      ORDER BY created_at ASC
      LIMIT 1
    `, [tenantId]);
    const partyId: string | null = partyResult.rows[0]?.id || null;

    // Count unread messages for conversations the user participates in
    // A message is unread if:
    // - read_at IS NULL
    // - conversation_id matches a conversation where user is an active participant
    // - message was not sent by the user (sender_participant_id != user's participant)
    // - message was created after user joined the conversation
    // 
    // User participates via three modes:
    // A) individual_id = user_id (direct individual participation)
    // B) party_id = tenant's party (owner/contractor participation)
    // C) circle_id where user is an active member of that circle
    // 
    // UNION (not UNION ALL) + DISTINCT prevents double-counting
    // Tenant scoping: cm.tenant_id = $3 enforces circle membership is tenant-scoped (non-optional)
    const result = await pool.query(`
      WITH user_participations AS (
        -- Direct participation (individual or party)
        SELECT DISTINCT
          p.id AS participant_id,
          p.conversation_id,
          p.joined_at
        FROM cc_conversation_participants p
        WHERE p.is_active = true
          AND (
            (p.individual_id IS NOT NULL AND p.individual_id = $1)
            OR
            (p.party_id IS NOT NULL AND p.party_id = $2)
          )

        UNION

        -- Circle-derived participation (tenant-scoped, non-optional)
        SELECT DISTINCT
          p.id AS participant_id,
          p.conversation_id,
          p.joined_at
        FROM cc_conversation_participants p
        JOIN cc_circle_members cm
          ON cm.circle_id = p.circle_id
         AND cm.individual_id = $1
         AND cm.is_active = true
         AND cm.tenant_id = $3::uuid
        WHERE p.is_active = true
          AND p.circle_id IS NOT NULL
      )
      SELECT COUNT(*)::int AS unread
      FROM cc_messages m
      JOIN user_participations up ON m.conversation_id = up.conversation_id
      WHERE m.read_at IS NULL
        AND m.deleted_at IS NULL
        AND m.sender_participant_id IS DISTINCT FROM up.participant_id
        AND m.created_at >= COALESCE(up.joined_at, '1970-01-01'::timestamptz)
    `, [userId, partyId, tenantId]);

    res.json({ ok: true, count: result.rows[0]?.unread || 0 });
  } catch (e: any) {
    console.error("[p2-dashboard] messages/unread-count error:", e.message);
    res.status(500).json({ ok: false, error: { code: "INTERNAL", message: e.message } });
  }
});

p2DashboardRouter.get("/upcoming-activity", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const limit = Math.min(parseInt(req.query.limit as string) || 5, 10);
    const now = new Date();
    const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const result = tenantId
      ? await pool.query(`
          SELECT 
            id, 
            guest_name as title,
            unit_id,
            check_in_date as date,
            status
          FROM cc_pms_reservations
          WHERE tenant_id = $4
            AND check_in_date >= $1::date
            AND check_in_date <= $2::date
            AND status NOT IN ('cancelled', 'completed')
          ORDER BY check_in_date ASC
          LIMIT $3
        `, [now.toISOString().split("T")[0], in48Hours.toISOString().split("T")[0], limit, tenantId])
      : await pool.query(`
          SELECT 
            id, 
            guest_name as title,
            unit_id,
            check_in_date as date,
            status
          FROM cc_pms_reservations
          WHERE check_in_date >= $1::date
            AND check_in_date <= $2::date
            AND status NOT IN ('cancelled', 'completed')
          ORDER BY check_in_date ASC
          LIMIT $3
        `, [now.toISOString().split("T")[0], in48Hours.toISOString().split("T")[0], limit]);

    const items = result.rows.map((r: any) => ({
      id: r.id,
      title: r.title || "Guest",
      subtitle: r.unit_id ? `Unit ${r.unit_id.substring(0, 8)}` : undefined,
      date: r.date,
      status: r.status,
      href: `/app/reservations/${r.id}`,
    }));

    res.json({ ok: true, items });
  } catch (e: any) {
    console.error("[p2-dashboard] upcoming-activity error:", e.message);
    res.status(500).json({ ok: false, error: { code: "INTERNAL", message: e.message } });
  }
});

p2DashboardRouter.get("/attention", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const items: any[] = [];

    const arrivalsQuery = tenantId
      ? pool.query(`
          SELECT id, guest_name, unit_id
          FROM cc_pms_reservations
          WHERE tenant_id = $1
            AND check_in_date::date = CURRENT_DATE
            AND status = 'confirmed'
          LIMIT 3
        `, [tenantId])
      : pool.query(`
          SELECT id, guest_name, unit_id
          FROM cc_pms_reservations
          WHERE check_in_date::date = CURRENT_DATE
            AND status = 'confirmed'
          LIMIT 3
        `);

    const arrivals = await arrivalsQuery;
    arrivals.rows.forEach((r: any) => {
      items.push({
        id: `arrival-${r.id}`,
        type: "arrival",
        title: `Arrival: ${r.guest_name || "Guest"}`,
        href: `/app/reservations/${r.id}`,
        priority: "medium",
      });
    });

    const departuresQuery = tenantId
      ? pool.query(`
          SELECT id, guest_name, unit_id
          FROM cc_pms_reservations
          WHERE tenant_id = $1
            AND check_out_date::date = CURRENT_DATE
            AND status = 'confirmed'
          LIMIT 3
        `, [tenantId])
      : pool.query(`
          SELECT id, guest_name, unit_id
          FROM cc_pms_reservations
          WHERE check_out_date::date = CURRENT_DATE
            AND status = 'confirmed'
          LIMIT 3
        `);

    const departures = await departuresQuery;
    departures.rows.forEach((r: any) => {
      items.push({
        id: `departure-${r.id}`,
        type: "departure",
        title: `Departure: ${r.guest_name || "Guest"}`,
        href: `/app/reservations/${r.id}`,
        priority: "medium",
      });
    });

    const overdueQuery = tenantId
      ? pool.query(`
          SELECT id, guest_name
          FROM cc_pms_reservations
          WHERE tenant_id = $1
            AND check_out_date < CURRENT_DATE
            AND status NOT IN ('cancelled', 'completed', 'checked_out')
          LIMIT 2
        `, [tenantId])
      : pool.query(`
          SELECT id, guest_name
          FROM cc_pms_reservations
          WHERE check_out_date < CURRENT_DATE
            AND status NOT IN ('cancelled', 'completed', 'checked_out')
          LIMIT 2
        `);

    const overdue = await overdueQuery;
    overdue.rows.forEach((r: any) => {
      items.push({
        id: `overdue-${r.id}`,
        type: "overdue",
        title: `Overdue checkout: ${r.guest_name || "Guest"}`,
        href: `/app/reservations/${r.id}`,
        priority: "high",
      });
    });

    res.json({ ok: true, items });
  } catch (e: any) {
    console.error("[p2-dashboard] attention error:", e.message);
    res.status(500).json({ ok: false, error: { code: "INTERNAL", message: e.message } });
  }
});
