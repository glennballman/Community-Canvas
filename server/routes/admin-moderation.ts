import { Router } from 'express';
import { pool } from '../db';

const router = Router();

// GET /api/admin/moderation/submissions - Get Good News submissions for review
router.get('/submissions', async (req, res) => {
  try {
    const { search, status, visitor_only } = req.query;
    
    // For now, return empty array since the submissions table may not exist
    // In production, this would query a good_news_submissions table
    const submissions: Array<{
      id: string;
      community_tenant_id: string;
      community_name: string;
      story_raw: string;
      is_visitor: boolean;
      suggested_recipient_text: string | null;
      status: string;
      created_at: string;
    }> = [];
    
    // Return mock data for demonstration
    // In production, remove this and query the actual database
    
    res.json({ submissions });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// POST /api/admin/moderation/submissions/:id/approve - Approve a submission
router.post('/submissions/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    
    // In production, this would update the submission status in the database
    console.log(`Approving submission ${id}`);
    
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
    const { reason } = req.body;
    
    // In production, this would update the submission status in the database
    console.log(`Declining submission ${id} with reason: ${reason}`);
    
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error declining submission:', error);
    res.status(500).json({ error: 'Failed to decline submission' });
  }
});

// GET /api/admin/moderation/flagged - Get flagged content
router.get('/flagged', async (req, res) => {
  try {
    const { search, type, status } = req.query;
    
    // For now, return empty array since the flagged_content table may not exist
    // In production, this would query a flagged_content table
    const items: Array<{
      id: string;
      content_type: string;
      content_id: string;
      content_preview: string;
      reason: string;
      reporter_email: string;
      status: string;
      created_at: string;
    }> = [];
    
    res.json({ items });
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
    
    // In production, this would update the flagged item status
    console.log(`Resolving flagged item ${id} with action: ${action}`);
    
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
    const { reason } = req.body;
    
    // In production, this would update the flagged item status
    console.log(`Dismissing flagged item ${id} with reason: ${reason}`);
    
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error dismissing flagged item:', error);
    res.status(500).json({ error: 'Failed to dismiss flagged item' });
  }
});

export default router;
