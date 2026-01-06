import { Router } from 'express';
import { serviceQuery } from '../db/tenantDb';

const router = Router();

// GET /api/admin/moderation/submissions - Get Good News submissions for review
router.get('/submissions', async (req, res) => {
  try {
    const { search, status = 'pending', visitor_only } = req.query;
    
    let query = `
      SELECT 
        s.*,
        t.name as community_name
      FROM good_news.submissions s
      JOIN cc_tenants t ON s.community_tenant_id = t.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;
    
    if (status && status !== 'all') {
      query += ` AND s.status = $${paramIndex}::good_news.submission_status`;
      params.push(status);
      paramIndex++;
    }
    
    if (visitor_only === 'true') {
      query += ` AND s.is_visitor = true`;
    }
    
    if (search) {
      query += ` AND (s.story_raw ILIKE $${paramIndex} OR s.suggested_recipient_text ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    query += ` ORDER BY s.created_at DESC LIMIT 100`;
    
    const result = await serviceQuery(query, params);
    
    // Get stats
    const statsResult = await serviceQuery(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending') as waiting,
        COUNT(*) FILTER (WHERE status != 'pending' AND reviewed_at > NOW() - INTERVAL '24 hours') as reviewed_today,
        COUNT(*) FILTER (WHERE status = 'pending' AND ai_severity = 'high') as high_priority,
        COUNT(*) FILTER (WHERE status = 'pending' AND review_notes LIKE '%ESCALATED%') as escalated
      FROM good_news.submissions
    `);
    
    const statsRow = statsResult.rows[0] || {};
    
    res.json({
      submissions: result.rows.map(row => ({
        id: row.id,
        community_tenant_id: row.community_tenant_id,
        community_name: row.community_name,
        story_raw: row.story_raw,
        story_public: row.story_public,
        is_visitor: row.is_visitor,
        suggested_recipient_text: row.suggested_recipient_text,
        status: row.status,
        created_at: row.created_at,
        ai_flagged: row.ai_flagged,
        severity: row.ai_severity,
        ai_reasons: row.ai_reasons || [],
        signature_public: row.signature_public,
        attribution_preference: row.attribution_preference,
        review_notes: row.review_notes,
      })),
      stats: {
        waiting: parseInt(statsRow.waiting) || 0,
        reviewed_today: parseInt(statsRow.reviewed_today) || 0,
        high_priority: parseInt(statsRow.high_priority) || 0,
        escalated: parseInt(statsRow.escalated) || 0,
      }
    });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// POST /api/admin/moderation/submissions/:id/approve - Approve a submission
router.post('/submissions/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { story_public } = req.body;
    const userId = (req as any).user?.id;
    
    await serviceQuery(`
      UPDATE good_news.submissions
      SET 
        status = 'approved',
        story_public = COALESCE($2, story_raw),
        reviewed_by = $3,
        reviewed_at = NOW(),
        visible_from = NOW()
      WHERE id = $1
    `, [id, story_public || null, userId || null]);
    
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error approving submission:', error);
    res.status(500).json({ error: 'Failed to approve submission' });
  }
});

// POST /api/admin/moderation/submissions/:id/decline - Decline a submission
router.post('/submissions/:id/decline', async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const userId = (req as any).user?.id;
    
    await serviceQuery(`
      UPDATE good_news.submissions
      SET 
        status = 'declined',
        reviewed_by = $2,
        reviewed_at = NOW(),
        review_notes = $3
      WHERE id = $1
    `, [id, userId || null, note || null]);
    
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error declining submission:', error);
    res.status(500).json({ error: 'Failed to decline submission' });
  }
});

// POST /api/admin/moderation/submissions/:id/approve_hide - Approve but hide
router.post('/submissions/:id/approve_hide', async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const userId = (req as any).user?.id;
    
    await serviceQuery(`
      UPDATE good_news.submissions
      SET 
        status = 'hidden',
        reviewed_by = $2,
        reviewed_at = NOW(),
        review_notes = $3
      WHERE id = $1
    `, [id, userId || null, note || null]);
    
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error approving submission:', error);
    res.status(500).json({ error: 'Failed to approve submission' });
  }
});

// POST /api/admin/moderation/submissions/:id/request_edit - Request edit
router.post('/submissions/:id/request_edit', async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const userId = (req as any).user?.id;
    
    await serviceQuery(`
      UPDATE good_news.submissions
      SET 
        status = 'pending',
        review_notes = $2,
        reviewed_by = $3
      WHERE id = $1
    `, [id, note ? `Edit requested: ${note}` : 'Edit requested', userId || null]);
    
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error requesting edit:', error);
    res.status(500).json({ error: 'Failed to request edit' });
  }
});

// POST /api/admin/moderation/submissions/:id/escalate - Escalate to platform admin
router.post('/submissions/:id/escalate', async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const userId = (req as any).user?.id;
    
    await serviceQuery(`
      UPDATE good_news.submissions
      SET 
        ai_severity = 'high',
        review_notes = CONCAT(COALESCE(review_notes, ''), ' [ESCALATED: ', $2, ']'),
        reviewed_by = $3
      WHERE id = $1
    `, [id, note || 'No reason provided', userId || null]);
    
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error escalating submission:', error);
    res.status(500).json({ error: 'Failed to escalate submission' });
  }
});

// GET /api/admin/moderation/flagged - Get flagged content
router.get('/flagged', async (req, res) => {
  try {
    const { search, type, reason, status = 'pending' } = req.query;
    
    let query = `
      SELECT 
        f.*,
        t.name as community_name
      FROM cc_flagged_content f
      LEFT JOIN cc_tenants t ON f.community_tenant_id = t.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;
    
    if (status && status !== 'all') {
      query += ` AND f.status = $${paramIndex}::cc_flag_status`;
      params.push(status);
      paramIndex++;
    }
    
    if (type && type !== 'all') {
      query += ` AND f.content_type = $${paramIndex}::cc_flagged_content_type`;
      params.push(type);
      paramIndex++;
    }
    
    if (reason && reason !== 'all') {
      query += ` AND f.reason = $${paramIndex}::cc_flag_reason`;
      params.push(reason);
      paramIndex++;
    }
    
    if (search) {
      query += ` AND (f.content_preview ILIKE $${paramIndex} OR f.reason_text ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    query += ` ORDER BY f.created_at DESC LIMIT 100`;
    
    const result = await serviceQuery(query, params);
    
    res.json({ 
      items: result.rows.map(row => ({
        id: row.id,
        content_type: row.content_type,
        content_id: row.content_id,
        content_preview: row.content_preview,
        community_tenant_id: row.community_tenant_id,
        community_name: row.community_name,
        reporter_user_id: row.reporter_user_id,
        reporter_email: row.reporter_email,
        reason: row.reason,
        reason_text: row.reason_text,
        status: row.status,
        resolved_by: row.resolved_by,
        resolved_at: row.resolved_at,
        resolution_action: row.resolution_action,
        resolution_notes: row.resolution_notes,
        created_at: row.created_at,
      }))
    });
  } catch (error) {
    console.error('Error fetching flagged content:', error);
    res.status(500).json({ error: 'Failed to fetch flagged content' });
  }
});

// POST /api/admin/moderation/flagged/:id/resolve - Resolve a flagged item
router.post('/flagged/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, notes } = req.body;
    const userId = (req as any).user?.id;
    
    await serviceQuery(`
      UPDATE cc_flagged_content
      SET 
        status = 'resolved',
        resolved_by = $2,
        resolved_at = NOW(),
        resolution_action = $3,
        resolution_notes = $4
      WHERE id = $1
    `, [id, userId || null, action || 'resolved', notes || null]);
    
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error resolving flagged item:', error);
    res.status(500).json({ error: 'Failed to resolve flagged item' });
  }
});

// POST /api/admin/moderation/flagged/:id/dismiss - Dismiss a flagged item
router.post('/flagged/:id/dismiss', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    
    await serviceQuery(`
      UPDATE cc_flagged_content
      SET 
        status = 'dismissed',
        resolved_by = $2,
        resolved_at = NOW(),
        resolution_action = 'dismissed'
      WHERE id = $1
    `, [id, userId || null]);
    
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error dismissing flagged item:', error);
    res.status(500).json({ error: 'Failed to dismiss flagged item' });
  }
});

// POST /api/admin/moderation/flagged/:id/hide - Hide flagged content
router.post('/flagged/:id/hide', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    
    await serviceQuery(`
      UPDATE cc_flagged_content
      SET 
        status = 'resolved',
        resolved_by = $2,
        resolved_at = NOW(),
        resolution_action = 'hidden'
      WHERE id = $1
    `, [id, userId || null]);
    
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error hiding flagged item:', error);
    res.status(500).json({ error: 'Failed to hide flagged item' });
  }
});

// POST /api/admin/moderation/flagged/:id/edit_privacy - Edit for privacy
router.post('/flagged/:id/edit_privacy', async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const userId = (req as any).user?.id;
    
    await serviceQuery(`
      UPDATE cc_flagged_content
      SET 
        status = 'resolved',
        resolved_by = $2,
        resolved_at = NOW(),
        resolution_action = 'edited',
        resolution_notes = $3
      WHERE id = $1
    `, [id, userId || null, notes || null]);
    
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error editing flagged item:', error);
    res.status(500).json({ error: 'Failed to edit flagged item' });
  }
});

// POST /api/admin/moderation/flagged/:id/escalate - Escalate to safety review
router.post('/flagged/:id/escalate', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = (req as any).user?.id;
    
    await serviceQuery(`
      UPDATE cc_flagged_content
      SET 
        resolution_notes = CONCAT(COALESCE(resolution_notes, ''), ' [ESCALATED: ', $2, ']'),
        resolved_by = $3
      WHERE id = $1
    `, [id, reason || 'No reason provided', userId || null]);
    
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error escalating flagged item:', error);
    res.status(500).json({ error: 'Failed to escalate flagged item' });
  }
});

export default router;
