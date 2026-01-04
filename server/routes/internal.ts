import { Router, Request, Response, NextFunction } from 'express';
import pg from 'pg';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { z } from 'zod';
import {
  blockTenantAccess,
  requirePlatformRole,
  PlatformStaffRequest,
  createServiceKeyAuditEvent
} from '../middleware/guards';
import { serviceQuery, withServiceTransaction } from '../db/tenantDb';

const { Pool } = pg;
const superuserPool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

const router = Router();

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 60;
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const internalRateLimit = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  
  const existing = rateLimitMap.get(ip);
  if (!existing || now > existing.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }
  
  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({
      success: false,
      error: 'Too many requests',
      code: 'RATE_LIMITED'
    });
  }
  
  existing.count++;
  next();
};

router.use(internalRateLimit);
router.use(blockTenantAccess);

router.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password required'
      });
    }
    
    const result = await superuserPool.query(
      `SELECT id, email, password_hash, full_name, role, is_active 
       FROM cc_platform_staff 
       WHERE email = $1`,
      [email.toLowerCase()]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }
    
    const staff = result.rows[0];
    
    if (!staff.is_active) {
      return res.status(401).json({
        success: false,
        error: 'Account disabled'
      });
    }
    
    const passwordValid = await bcrypt.compare(password, staff.password_hash);
    if (!passwordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }
    
    await superuserPool.query(
      `UPDATE cc_platform_staff SET last_login_at = now() WHERE id = $1`,
      [staff.id]
    );
    
    (req as any).session.platformStaff = {
      id: staff.id,
      email: staff.email,
      full_name: staff.full_name,
      role: staff.role
    };
    
    return res.json({
      success: true,
      staff: {
        id: staff.id,
        email: staff.email,
        full_name: staff.full_name,
        role: staff.role
      }
    });
  } catch (error: any) {
    console.error('Platform login error:', error.message, error.stack);
    return res.status(500).json({
      success: false,
      error: 'Login failed',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

router.post('/auth/logout', (req: Request, res: Response) => {
  delete (req as any).session.platformStaff;
  return res.json({ success: true });
});

router.post('/bootstrap/init', async (req: Request, res: Response) => {
  try {
    const existingStaff = await superuserPool.query(
      'SELECT COUNT(*) as count FROM cc_platform_staff WHERE is_active = true'
    );
    
    if (parseInt(existingStaff.rows[0].count) > 0) {
      return res.status(403).json({
        success: false,
        error: 'Bootstrap not allowed - active staff already exist',
        code: 'BOOTSTRAP_DISABLED'
      });
    }
    
    const unclaimedTokens = await superuserPool.query(
      `SELECT COUNT(*) as count FROM cc_platform_staff_bootstrap_tokens 
       WHERE claimed_at IS NULL AND expires_at > now()`
    );
    
    if (parseInt(unclaimedTokens.rows[0].count) > 0) {
      return res.status(409).json({
        success: false,
        error: 'Unclaimed bootstrap token already exists',
        code: 'TOKEN_EXISTS'
      });
    }
    
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    
    await superuserPool.query(
      `INSERT INTO cc_platform_staff_bootstrap_tokens (token_hash, created_by_ip, expires_at)
       VALUES ($1, $2, now() + INTERVAL '1 hour')`,
      [tokenHash, clientIp]
    );
    
    console.log(`[SECURITY] Bootstrap token generated from IP: ${clientIp}`);
    
    return res.json({
      success: true,
      token: token,
      expires_in_seconds: 3600,
      message: 'Use POST /api/internal/bootstrap/claim with this token to create first admin'
    });
  } catch (error: any) {
    console.error('Bootstrap init error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate bootstrap token'
    });
  }
});

const bootstrapClaimSchema = z.object({
  token: z.string().min(64).max(64),
  email: z.string().email(),
  password: z.string().min(12),
  full_name: z.string().min(2).max(255)
});

router.post('/bootstrap/claim', async (req: Request, res: Response) => {
  try {
    const parsed = bootstrapClaimSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: parsed.error.errors
      });
    }
    
    const { token, email, password, full_name } = parsed.data;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    const tokenResult = await superuserPool.query(
      `SELECT id, expires_at, claimed_at FROM cc_platform_staff_bootstrap_tokens
       WHERE token_hash = $1`,
      [tokenHash]
    );
    
    if (tokenResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid bootstrap token',
        code: 'INVALID_TOKEN'
      });
    }
    
    const tokenRow = tokenResult.rows[0];
    
    if (tokenRow.claimed_at) {
      return res.status(409).json({
        success: false,
        error: 'Token already claimed',
        code: 'TOKEN_CLAIMED'
      });
    }
    
    if (new Date(tokenRow.expires_at) < new Date()) {
      return res.status(401).json({
        success: false,
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    const passwordHash = await bcrypt.hash(password, 12);
    
    const staffResult = await superuserPool.query(
      `INSERT INTO cc_platform_staff (email, password_hash, full_name, role, is_active)
       VALUES ($1, $2, $3, 'platform_admin', true)
       RETURNING id, email, full_name, role`,
      [email.toLowerCase(), passwordHash, full_name]
    );
    
    const newStaff = staffResult.rows[0];
    
    await superuserPool.query(
      `UPDATE cc_platform_staff_bootstrap_tokens 
       SET claimed_at = now(), claimed_by_staff_id = $1
       WHERE id = $2`,
      [newStaff.id, tokenRow.id]
    );
    
    console.log(`[SECURITY] Bootstrap complete - first admin created: ${newStaff.email}`);
    
    return res.json({
      success: true,
      staff: {
        id: newStaff.id,
        email: newStaff.email,
        full_name: newStaff.full_name,
        role: newStaff.role
      },
      message: 'First admin created successfully. You can now login.'
    });
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'Email already registered',
        code: 'EMAIL_EXISTS'
      });
    }
    console.error('Bootstrap claim error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to create admin account'
    });
  }
});

router.get('/auth/me', (req: Request, res: Response) => {
  const staffSession = (req as any).session?.platformStaff;
  if (!staffSession?.id) {
    return res.status(401).json({
      success: false,
      error: 'Not authenticated'
    });
  }
  return res.json({
    success: true,
    staff: staffSession
  });
});

const claimsQueueSchema = z.object({
  status: z.enum(['submitted', 'under_review', 'approved', 'rejected', 'draft']).optional(),
  tenant_id: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0)
});

router.get(
  '/claims/queue',
  requirePlatformRole('platform_reviewer', 'platform_admin'),
  async (req: Request, res: Response) => {
    try {
      const platformReq = req as PlatformStaffRequest;
      const parsed = claimsQueueSchema.safeParse(req.query);
      
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid query parameters',
          details: parsed.error.errors
        });
      }
      
      const { status, tenant_id, limit, offset } = parsed.data;
      
      let query = `
        SELECT 
          c.id,
          c.target_type,
          c.claimant,
          c.tenant_id,
          t.name as tenant_name,
          c.individual_id,
          i.full_name as individual_name,
          c.status,
          c.desired_action,
          c.nickname,
          c.submitted_at,
          c.created_at,
          c.updated_at,
          (SELECT COUNT(*) FROM catalog_claim_evidence WHERE claim_id = c.id) as evidence_count
        FROM catalog_claims c
        LEFT JOIN cc_tenants t ON t.id = c.tenant_id
        LEFT JOIN cc_individuals i ON i.id = c.individual_id
        WHERE 1=1
      `;
      const params: any[] = [];
      let paramIdx = 1;
      
      if (status) {
        query += ` AND c.status = $${paramIdx++}`;
        params.push(status);
      }
      if (tenant_id) {
        query += ` AND c.tenant_id = $${paramIdx++}`;
        params.push(tenant_id);
      }
      
      query += ` ORDER BY 
        CASE c.status 
          WHEN 'submitted' THEN 1 
          WHEN 'under_review' THEN 2 
          ELSE 3 
        END,
        c.submitted_at DESC NULLS LAST,
        c.created_at DESC`;
      
      query += ` LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
      params.push(limit, offset);
      
      const countQuery = `
        SELECT COUNT(*) as total
        FROM catalog_claims c
        WHERE 1=1
        ${status ? `AND c.status = '${status}'` : ''}
        ${tenant_id ? `AND c.tenant_id = '${tenant_id}'` : ''}
      `;
      
      const [claimsResult, countResult] = await Promise.all([
        serviceQuery(query, params),
        serviceQuery(countQuery, [])
      ]);
      
      return res.json({
        success: true,
        claims: claimsResult.rows,
        pagination: {
          total: parseInt(countResult.rows[0].total),
          limit,
          offset
        },
        actor: {
          staff_id: platformReq.platformStaff?.id,
          staff_name: platformReq.platformStaff?.full_name
        }
      });
    } catch (error) {
      console.error('Claims queue error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch claims queue'
      });
    }
  }
);

router.get(
  '/claims/:id',
  requirePlatformRole('platform_reviewer', 'platform_admin'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const platformReq = req as PlatformStaffRequest;
      
      const claimResult = await serviceQuery(
        `SELECT 
          c.*,
          t.name as tenant_name,
          i.full_name as individual_name,
          i.email as individual_email
        FROM catalog_claims c
        LEFT JOIN cc_tenants t ON t.id = c.tenant_id
        LEFT JOIN cc_individuals i ON i.id = c.individual_id
        WHERE c.id = $1`,
        [id]
      );
      
      if (claimResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Claim not found'
        });
      }
      
      const [evidenceResult, eventsResult] = await Promise.all([
        serviceQuery(
          `SELECT id, evidence_type, data, created_at 
           FROM catalog_claim_evidence 
           WHERE claim_id = $1 
           ORDER BY created_at`,
          [id]
        ),
        serviceQuery(
          `SELECT 
            e.id,
            e.event_type,
            e.actor_type,
            e.actor_individual_id,
            e.actor_staff_id,
            e.payload,
            e.created_at,
            i.full_name as actor_individual_name,
            s.full_name as actor_staff_name
           FROM catalog_claim_events e
           LEFT JOIN cc_individuals i ON i.id = e.actor_individual_id
           LEFT JOIN cc_platform_staff s ON s.id = e.actor_staff_id
           WHERE e.claim_id = $1
           ORDER BY e.created_at DESC`,
          [id]
        )
      ]);
      
      return res.json({
        success: true,
        claim: claimResult.rows[0],
        evidence: evidenceResult.rows,
        events: eventsResult.rows,
        actor: {
          staff_id: platformReq.platformStaff?.id,
          staff_name: platformReq.platformStaff?.full_name
        }
      });
    } catch (error) {
      console.error('Claim detail error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch claim'
      });
    }
  }
);

router.post(
  '/claims/:id/review/start',
  requirePlatformRole('platform_reviewer', 'platform_admin'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const platformReq = req as PlatformStaffRequest;
      const staffId = platformReq.platformStaff?.id;
      const staffName = platformReq.platformStaff?.full_name;
      
      const result = await withServiceTransaction(async (client) => {
        const claimResult = await client.query(
          `SELECT id, status, tenant_id FROM catalog_claims WHERE id = $1 FOR UPDATE`,
          [id]
        );
        
        if (claimResult.rows.length === 0) {
          throw new Error('CLAIM_NOT_FOUND');
        }
        
        const claim = claimResult.rows[0];
        
        if (claim.status !== 'submitted') {
          throw new Error(`INVALID_STATUS:${claim.status}`);
        }
        
        await client.query(
          `UPDATE catalog_claims 
           SET status = 'under_review', 
               reviewed_at = now(),
               updated_at = now()
           WHERE id = $1`,
          [id]
        );
        
        await client.query(
          `INSERT INTO catalog_claim_events 
           (claim_id, tenant_id, event_type, actor_type, actor_staff_id, payload, ip, user_agent, endpoint, http_method)
           VALUES ($1, $2, 'review_started', 'platform', $3, $4, $5, $6, $7, $8)`,
          [
            id,
            claim.tenant_id,
            staffId,
            JSON.stringify({
              reviewer_staff_id: staffId,
              reviewer_name: staffName,
              timestamp: new Date().toISOString()
            }),
            req.ip || req.socket.remoteAddress || 'unknown',
            req.headers['user-agent'] || 'unknown',
            `/api/internal/claims/${id}/review/start`,
            'POST'
          ]
        );
        
        const updatedClaim = await client.query(
          `SELECT * FROM catalog_claims WHERE id = $1`,
          [id]
        );
        
        return updatedClaim.rows[0];
      });
      
      return res.json({
        success: true,
        claim: result,
        actor: {
          staff_id: staffId,
          staff_name: staffName
        }
      });
    } catch (error: any) {
      console.error('Review start error:', error);
      
      if (error.message === 'CLAIM_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          error: 'Claim not found'
        });
      }
      
      if (error.message?.startsWith('INVALID_STATUS:')) {
        const currentStatus = error.message.split(':')[1];
        return res.status(409).json({
          success: false,
          error: 'Claim must be in submitted status to start review',
          code: 'INVALID_STATUS',
          current_status: currentStatus
        });
      }
      
      if (error.message?.includes('Invalid catalog_claims status transition')) {
        return res.status(409).json({
          success: false,
          error: 'Invalid status transition',
          code: 'INVALID_TRANSITION'
        });
      }
      
      return res.status(500).json({
        success: false,
        error: 'Failed to start review'
      });
    }
  }
);

router.get(
  '/claims/:id/audit',
  requirePlatformRole('platform_reviewer', 'platform_admin'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const platformReq = req as PlatformStaffRequest;
      
      const claimResult = await serviceQuery(
        `SELECT id, tenant_id, status FROM catalog_claims WHERE id = $1`,
        [id]
      );
      
      if (claimResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Claim not found'
        });
      }
      
      const eventsResult = await serviceQuery(
        `SELECT 
          e.id,
          e.claim_id,
          e.tenant_id,
          e.event_type,
          e.actor_type,
          e.actor_individual_id,
          e.actor_staff_id,
          e.payload,
          e.ip,
          e.user_agent,
          e.endpoint,
          e.http_method,
          e.created_at,
          i.full_name as actor_individual_name,
          i.email as actor_individual_email,
          s.full_name as actor_staff_name,
          s.email as actor_staff_email
         FROM catalog_claim_events e
         LEFT JOIN cc_individuals i ON i.id = e.actor_individual_id
         LEFT JOIN cc_platform_staff s ON s.id = e.actor_staff_id
         WHERE e.claim_id = $1
         ORDER BY e.created_at ASC`,
        [id]
      );
      
      return res.json({
        success: true,
        claim_id: id,
        tenant_id: claimResult.rows[0].tenant_id,
        status: claimResult.rows[0].status,
        events: eventsResult.rows,
        total_events: eventsResult.rows.length,
        actor: {
          staff_id: platformReq.platformStaff?.id,
          staff_name: platformReq.platformStaff?.full_name
        }
      });
    } catch (error) {
      console.error('Audit fetch error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch audit log'
      });
    }
  }
);

const decisionSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  reason: z.string().min(1).max(2000).optional()
});

router.post(
  '/claims/:id/decision',
  requirePlatformRole('platform_reviewer', 'platform_admin'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const platformReq = req as PlatformStaffRequest;
      const staffId = platformReq.platformStaff?.id;
      const staffName = platformReq.platformStaff?.full_name;
      
      const parsed = decisionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request body',
          details: parsed.error.errors
        });
      }
      
      const { decision, reason } = parsed.data;
      
      const result = await withServiceTransaction(async (client) => {
        const claimResult = await client.query(
          `SELECT id, status, tenant_id, target_type FROM catalog_claims WHERE id = $1 FOR UPDATE`,
          [id]
        );
        
        if (claimResult.rows.length === 0) {
          throw new Error('CLAIM_NOT_FOUND');
        }
        
        const claim = claimResult.rows[0];
        
        if (claim.status !== 'under_review') {
          throw new Error(`INVALID_STATUS:${claim.status}`);
        }
        
        const newStatus = decision === 'approve' ? 'approved' : 'rejected';
        
        await client.query(
          `UPDATE catalog_claims 
           SET status = $1, 
               decision = $2,
               decision_reason = $3,
               decided_at = now(),
               reviewed_by_individual_id = NULL,
               updated_at = now()
           WHERE id = $4`,
          [newStatus, decision, reason || null, id]
        );
        
        await client.query(
          `INSERT INTO catalog_claim_events 
           (claim_id, tenant_id, event_type, actor_type, actor_staff_id, payload, ip, user_agent, endpoint, http_method)
           VALUES ($1, $2, $3, 'platform', $4, $5, $6, $7, $8, $9)`,
          [
            id,
            claim.tenant_id,
            decision === 'approve' ? 'approved' : 'rejected',
            staffId,
            JSON.stringify({
              decision,
              reason: reason || null,
              reviewer_staff_id: staffId,
              reviewer_name: staffName,
              timestamp: new Date().toISOString()
            }),
            req.ip || req.socket.remoteAddress || 'unknown',
            req.headers['user-agent'] || 'unknown',
            `/api/internal/claims/${id}/decision`,
            'POST'
          ]
        );
        
        // Note: fn_apply_catalog_claim is automatically called by the 
        // trg_claim_auto_apply trigger when status changes to 'approved'
        // No need to call it manually here
        
        const updatedClaim = await client.query(
          `SELECT * FROM catalog_claims WHERE id = $1`,
          [id]
        );
        
        return updatedClaim.rows[0];
      });
      
      return res.json({
        success: true,
        claim: result,
        actor: {
          staff_id: staffId,
          staff_name: staffName
        }
      });
    } catch (error: any) {
      console.error('Decision error:', error);
      
      if (error.message === 'CLAIM_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          error: 'Claim not found'
        });
      }
      
      if (error.message?.startsWith('INVALID_STATUS:')) {
        const currentStatus = error.message.split(':')[1];
        return res.status(409).json({
          success: false,
          error: 'Claim must be in under_review status to make decision',
          code: 'INVALID_STATUS',
          current_status: currentStatus
        });
      }
      
      if (error.message?.includes('Invalid catalog_claims status transition')) {
        return res.status(409).json({
          success: false,
          error: 'Invalid status transition',
          code: 'INVALID_TRANSITION'
        });
      }
      
      return res.status(500).json({
        success: false,
        error: 'Decision failed'
      });
    }
  }
);

router.get(
  '/tenants',
  requirePlatformRole('platform_reviewer', 'platform_admin'),
  async (req: Request, res: Response) => {
    try {
      const result = await serviceQuery(
        `SELECT id, name, slug, created_at 
         FROM cc_tenants 
         ORDER BY name`,
        []
      );
      
      return res.json({
        success: true,
        tenants: result.rows
      });
    } catch (error) {
      console.error('Tenants list error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch tenants'
      });
    }
  }
);

export default router;
