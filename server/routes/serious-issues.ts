import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { resolveActorParty } from '../lib/partyResolver';

const router = Router();

function isAdmin(req: any): boolean {
  const roles = req?.ctx?.roles || [];
  return roles.includes('admin') || roles.includes('platform_admin');
}

// ============================================================
// FILE SERIOUS ISSUE REPORT (Any User - Owner, Contractor, or Operator)
// ============================================================
router.post('/work-requests/:id/serious-issue', async (req: Request, res: Response) => {
  try {
    const { id: work_request_id } = req.params;
    const { 
      subject_party_id,
      subject_type,
      category,
      description,
      evidence,
      conversation_id,
      reporter_role = 'owner'
    } = req.body;

    const validRoles = ['owner', 'contractor', 'operator'];
    const role = validRoles.includes(reporter_role) ? reporter_role : 'owner';

    const actor = await resolveActorParty(req, role as any);
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!subject_party_id || !category || !description) {
      return res.status(400).json({ error: 'subject_party_id, category, and description required' });
    }

    const validCategories = ['fraud', 'safety', 'harassment', 'non_payment', 'abandonment', 'property_damage', 'other'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    const client = await pool.connect();
    try {
      const patternCheck = await client.query(
        `SELECT id FROM cc_serious_issue_reports 
         WHERE subject_party_id = $1 
         AND category = $2
         AND created_at > now() - interval '6 months'`,
        [subject_party_id, category]
      );

      const isPattern = patternCheck.rows.length > 0;
      const relatedIds = patternCheck.rows.map(r => r.id);

      const result = await client.query(
        `INSERT INTO cc_serious_issue_reports (
          work_request_id, conversation_id,
          reporter_party_id, reporter_individual_id,
          subject_party_id, subject_type,
          category, description, evidence,
          is_pattern_match, related_report_ids
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::issue_category, $8, $9, $10, $11)
        RETURNING id, created_at`,
        [
          work_request_id,
          conversation_id || null,
          actor.actor_party_id,
          actor.individual_id,
          subject_party_id,
          subject_type || 'contractor',
          category,
          description,
          evidence ? JSON.stringify(evidence) : null,
          isPattern,
          relatedIds.length > 0 ? relatedIds : null
        ]
      );

      res.status(201).json({
        report_id: result.rows[0].id,
        message: 'Your report has been submitted and will be reviewed by our team.',
        is_pattern: isPattern
      });

    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error filing serious issue:', error);
    res.status(500).json({ error: 'Failed to file report' });
  }
});

// ============================================================
// ADMIN: LIST SERIOUS ISSUES
// ============================================================
router.get('/admin/serious-issues', async (req: Request, res: Response) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { status, category, limit = '50', offset = '0' } = req.query;

    let query = `
      SELECT sir.*,
             reporter.trade_name as reporter_name,
             subject.trade_name as subject_name,
             wr.title as work_request_title,
             wr.work_request_ref
      FROM cc_serious_issue_reports sir
      LEFT JOIN cc_parties reporter ON sir.reporter_party_id = reporter.id
      LEFT JOIN cc_parties subject ON sir.subject_party_id = subject.id
      LEFT JOIN cc_work_requests wr ON sir.work_request_id = wr.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      query += ` AND sir.status = $${paramCount}::issue_status`;
      params.push(status);
    }

    if (category) {
      paramCount++;
      query += ` AND sir.category = $${paramCount}::issue_category`;
      params.push(category);
    }

    query += ` ORDER BY 
      CASE WHEN sir.is_pattern_match THEN 0 ELSE 1 END,
      sir.created_at DESC`;

    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(parseInt(limit as string));

    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(parseInt(offset as string));

    const result = await pool.query(query, params);

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM cc_serious_issue_reports WHERE status NOT IN ('resolved_no_action', 'resolved_action_taken', 'dismissed')`
    );

    res.json({
      issues: result.rows,
      pending_count: parseInt(countResult.rows[0].count)
    });
  } catch (error) {
    console.error('Error fetching serious issues:', error);
    res.status(500).json({ error: 'Failed to fetch issues' });
  }
});

// ============================================================
// ADMIN: GET SINGLE ISSUE WITH HISTORY
// ============================================================
router.get('/admin/serious-issues/:id', async (req: Request, res: Response) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;

    const result = await pool.query(
      `SELECT sir.*,
              reporter.trade_name as reporter_name,
              reporter.primary_contact_email as reporter_email,
              subject.trade_name as subject_name,
              subject.primary_contact_email as subject_email,
              wr.title as work_request_title,
              wr.work_request_ref
       FROM cc_serious_issue_reports sir
       LEFT JOIN cc_parties reporter ON sir.reporter_party_id = reporter.id
       LEFT JOIN cc_parties subject ON sir.subject_party_id = subject.id
       LEFT JOIN cc_work_requests wr ON sir.work_request_id = wr.id
       WHERE sir.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    const issue = result.rows[0];

    let relatedIssues: any[] = [];
    if (issue.related_report_ids?.length > 0) {
      const relatedResult = await pool.query(
        `SELECT id, category, status, description, created_at 
         FROM cc_serious_issue_reports 
         WHERE id = ANY($1)`,
        [issue.related_report_ids]
      );
      relatedIssues = relatedResult.rows;
    }

    const historyResult = await pool.query(
      `SELECT id, category, status, created_at, resolution_summary
       FROM cc_serious_issue_reports
       WHERE subject_party_id = $1 AND id != $2
       ORDER BY created_at DESC LIMIT 10`,
      [issue.subject_party_id, id]
    );

    res.json({
      issue,
      related_issues: relatedIssues,
      subject_history: historyResult.rows
    });
  } catch (error) {
    console.error('Error fetching issue:', error);
    res.status(500).json({ error: 'Failed to fetch issue' });
  }
});

// ============================================================
// ADMIN: UPDATE ISSUE STATUS
// ============================================================
router.patch('/admin/serious-issues/:id', async (req: Request, res: Response) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const { 
      status,
      assigned_to,
      internal_notes,
      resolution_summary,
      action_taken
    } = req.body;

    const updates: string[] = [];
    const params: any[] = [id];
    let paramCount = 1;

    if (status) {
      paramCount++;
      updates.push(`status = $${paramCount}::issue_status`);
      params.push(status);

      if (['resolved_no_action', 'resolved_action_taken', 'dismissed'].includes(status)) {
        updates.push(`resolution_date = now()`);
      }
    }

    if (assigned_to !== undefined) {
      paramCount++;
      updates.push(`assigned_to = $${paramCount}`);
      params.push(assigned_to);
    }

    if (internal_notes !== undefined) {
      paramCount++;
      updates.push(`internal_notes = $${paramCount}`);
      params.push(internal_notes);
    }

    if (resolution_summary !== undefined) {
      paramCount++;
      updates.push(`resolution_summary = $${paramCount}`);
      params.push(resolution_summary);
    }

    if (action_taken !== undefined) {
      paramCount++;
      updates.push(`action_taken = $${paramCount}`);
      params.push(action_taken);
      updates.push(`action_date = now()`);
    }

    updates.push(`updated_at = now()`);

    const result = await pool.query(
      `UPDATE cc_serious_issue_reports SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    res.json({ issue: result.rows[0] });
  } catch (error) {
    console.error('Error updating issue:', error);
    res.status(500).json({ error: 'Failed to update issue' });
  }
});

// ============================================================
// ADMIN: GET PATTERN ANALYSIS
// ============================================================
router.get('/admin/serious-issues/analysis/patterns', async (req: Request, res: Response) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await pool.query(`
      SELECT 
        subject_party_id,
        p.trade_name as subject_name,
        COUNT(*) as total_reports,
        COUNT(DISTINCT category) as category_count,
        array_agg(DISTINCT category) as categories,
        MIN(sir.created_at) as first_report,
        MAX(sir.created_at) as latest_report
      FROM cc_serious_issue_reports sir
      JOIN cc_parties p ON sir.subject_party_id = p.id
      WHERE sir.created_at > now() - interval '1 year'
      GROUP BY subject_party_id, p.trade_name
      HAVING COUNT(*) >= 2
      ORDER BY COUNT(*) DESC
      LIMIT 20
    `);

    res.json({ patterns: result.rows });
  } catch (error) {
    console.error('Error fetching patterns:', error);
    res.status(500).json({ error: 'Failed to fetch patterns' });
  }
});

export default router;
