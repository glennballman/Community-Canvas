/**
 * STEP 11C: Public Invitation Routes
 * STEP 11C.1: Invitation Claim Flow
 * STEP 11C Phase 2A: Revoked handling + inviter notifications on view/claim
 * 
 * Public endpoint for viewing invitation context (read-only).
 * No authentication required - token-based access.
 * Claim endpoint allows linking invitation to authenticated user.
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { authenticateUser, registerUser } from './auth';

const router = Router();

async function createInviteNotification(
  recipientIndividualId: string,
  category: string,
  body: string,
  shortBody: string,
  contextType: string,
  contextId: string,
  actionUrl: string
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO cc_notifications (
        recipient_individual_id,
        category,
        priority,
        channels,
        context_type,
        context_id,
        body,
        short_body,
        action_url,
        status
      ) VALUES ($1, $2, 'normal', ARRAY['in_app'], $3, $4, $5, $6, $7, 'pending')`,
      [recipientIndividualId, category, contextType, contextId, body, shortBody, actionUrl]
    );
  } catch (error) {
    console.error('[PublicInvitation] Failed to create notification:', error);
  }
}

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
 * STEP 11C Phase 2A: Handles revoked status + notifies inviter on first view
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

    const checkResult = await pool.query(
      `SELECT id, status, revoked_at, revocation_reason, context_name
       FROM cc_invitations WHERE claim_token = $1`,
      [token]
    );

    if (checkResult.rows.length > 0 && checkResult.rows[0].status === 'revoked') {
      const revokedInvite = checkResult.rows[0];
      return res.json({ 
        ok: true, 
        status: 'revoked',
        context_name: revokedInvite.context_name,
        revoked_at: revokedInvite.revoked_at,
        revocation_reason: revokedInvite.revocation_reason,
        message: 'This invitation has been revoked'
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
        inviter_individual_id,
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
    const isFirstView = invitation.status === 'sent';

    if (isFirstView) {
      await pool.query(
        `UPDATE cc_invitations 
         SET status = 'viewed', viewed_at = now(), updated_at = now() 
         WHERE id = $1 AND status = 'sent'`,
        [invitation.id]
      );
      invitation.status = 'viewed';
      invitation.viewed_at = new Date();

      if (invitation.inviter_individual_id) {
        const runName = invitation.context_name || 'Service Run';
        const maskedEmail = maskEmail(invitation.invitee_email);
        
        await createInviteNotification(
          invitation.inviter_individual_id,
          'invitation',
          `Your invitation to "${runName}" was viewed by ${maskedEmail}`,
          'Invitation viewed',
          'invitation',
          invitation.id,
          `/app/provider/runs/${invitation.context_id}`
        );
      }
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

/**
 * POST /api/i/:token/claim
 * Claim an invitation by signing in or registering
 * Links invitation to authenticated user identity
 */
router.post('/:token/claim', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { mode, email, password, display_name } = req.body;

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

    if (!mode || !['signin', 'register'].includes(mode)) {
      return res.status(400).json({ 
        ok: false, 
        error: 'error.invite.invalid_mode' 
      });
    }

    if (!email || !password) {
      return res.status(400).json({ 
        ok: false, 
        error: 'error.invite.email_password_required' 
      });
    }

    const emailLower = email.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailLower)) {
      return res.status(400).json({ 
        ok: false, 
        error: 'error.invite.invalid_email' 
      });
    }

    const inviteResult = await pool.query(
      `SELECT 
        id,
        invitee_email,
        status,
        claim_token_expires_at,
        claimed_by_individual_id,
        inviter_tenant_id,
        inviter_individual_id,
        context_id,
        context_name
      FROM cc_invitations
      WHERE claim_token = $1
        AND context_type = 'service_run'
        AND status <> 'revoked'
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

    if (invitation.status === 'claimed') {
      return res.json({
        ok: true,
        status: 'claimed',
        message: 'Invitation already claimed'
      });
    }

    if (invitation.invitee_email && 
        invitation.invitee_email.toLowerCase().trim() !== emailLower) {
      return res.status(400).json({
        ok: false,
        error: 'error.invite.email_mismatch'
      });
    }

    // Use shared auth helpers from auth.ts (pass req for session creation)
    let authResult;
    if (mode === 'signin') {
      authResult = await authenticateUser(emailLower, password, req);
    } else {
      authResult = await registerUser(emailLower, password, display_name, req);
    }

    if (!authResult.ok || !authResult.user) {
      const statusCode = authResult.error?.includes('email_in_use') ? 409 
        : authResult.error?.includes('invalid_credentials') ? 401 
        : authResult.error?.includes('account_suspended') ? 403 
        : 400;
      return res.status(statusCode).json({
        ok: false,
        error: authResult.error
      });
    }

    const { user, accessToken, refreshToken } = authResult;

    // Resolve individual and tenant for claim attribution
    let individualId: string | null = null;
    const individualResult = await pool.query(
      `SELECT id FROM cc_individuals WHERE lower(email) = $1 LIMIT 1`,
      [emailLower]
    );
    
    if (individualResult.rows.length > 0) {
      individualId = individualResult.rows[0].id;
    }

    // Use invitation's inviter_tenant_id for claimed_by_tenant_id attribution
    const claimedByTenantId = invitation.inviter_tenant_id || null;

    await pool.query(
      `UPDATE cc_invitations
       SET status = 'claimed',
           claimed_at = now(),
           claimed_by_individual_id = COALESCE($2, claimed_by_individual_id),
           claimed_by_tenant_id = COALESCE($3, claimed_by_tenant_id),
           updated_at = now()
       WHERE id = $1
         AND status <> 'claimed'`,
      [invitation.id, individualId, claimedByTenantId]
    );

    if (invitation.inviter_individual_id) {
      const runName = invitation.context_name || 'Service Run';
      const maskedEmail = maskEmail(invitation.invitee_email);
      
      await createInviteNotification(
        invitation.inviter_individual_id,
        'invitation',
        `Your invitation to "${runName}" was claimed by ${maskedEmail}`,
        'Invitation claimed',
        'invitation',
        invitation.id,
        `/app/provider/runs/${invitation.context_id}`
      );
    }

    res.json({
      ok: true,
      status: 'claimed',
      invitation_id: invitation.id,
      claimed_at: new Date().toISOString(),
      claimed_by: {
        individual_id: individualId,
        user_id: user.id
      },
      accessToken,
      refreshToken
    });

  } catch (error: any) {
    console.error('Invitation claim error:', error);
    res.status(500).json({ ok: false, error: 'error.invite.claim_failed' });
  }
});

export default router;
