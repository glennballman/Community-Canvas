/**
 * STEP 11C: Public Invitation Routes
 * 
 * Public endpoint for viewing invitation context (read-only).
 * No authentication required - token-based access.
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db';

const router = Router();

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***';
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

/**
 * GET /api/i/:token
 * Public read-only view of service run context for invited stakeholders
 */
router.get('/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    if (!token || token.length < 32) {
      return res.status(400).json({ 
        ok: false, 
        error: 'error.invite.invalid_token' 
      });
    }

    const hexRegex = /^[0-9a-f]+$/i;
    if (!hexRegex.test(token)) {
      return res.status(400).json({ 
        ok: false, 
        error: 'error.invite.invalid_token' 
      });
    }

    const inviteResult = await pool.query(
      `SELECT 
        id,
        context_type,
        context_id,
        context_name,
        invitee_email,
        invitee_name,
        status,
        claim_token_expires_at,
        message,
        viewed_at
      FROM cc_invitations
      WHERE claim_token = $1
        AND context_type = 'service_run'
        AND status IN ('sent', 'viewed', 'claimed')
        AND (claim_token_expires_at IS NULL OR claim_token_expires_at > now())`,
      [token]
    );

    if (inviteResult.rows.length === 0) {
      return res.status(404).json({ 
        ok: false, 
        error: 'error.invite.invalid_or_expired' 
      });
    }

    const invitation = inviteResult.rows[0];

    if (invitation.status === 'sent') {
      await pool.query(
        `UPDATE cc_invitations 
         SET status = 'viewed', viewed_at = now(), updated_at = now() 
         WHERE id = $1 AND status = 'sent'`,
        [invitation.id]
      );
      invitation.status = 'viewed';
      invitation.viewed_at = new Date();
    }

    const runResult = await pool.query(
      `SELECT id, name, starts_at, ends_at, market_mode
       FROM cc_n3_runs
       WHERE id = $1`,
      [invitation.context_id]
    );

    const run = runResult.rows[0] || null;

    res.json({
      ok: true,
      invitation: {
        status: invitation.status,
        invitee_name: invitation.invitee_name,
        invitee_email_masked: maskEmail(invitation.invitee_email),
        expires_at: invitation.claim_token_expires_at,
        message: invitation.message
      },
      run: run ? {
        id: run.id,
        name: run.name,
        starts_at: run.starts_at,
        ends_at: run.ends_at,
        market_mode: run.market_mode
      } : null,
      copy: {
        title: "You've been invited to view a service run",
        disclaimer: "This link provides read-only access."
      }
    });
  } catch (error: any) {
    console.error('Public invitation view error:', error);
    res.status(500).json({ ok: false, error: 'error.invite.load_failed' });
  }
});

export default router;
