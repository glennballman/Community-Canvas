# BACKEND API ENDPOINTS - REQUIRED FOR NUCLEAR REBUILD

Create these 5 endpoints EXACTLY as specified. Do not modify the response structures.

---

## FILE: server/routes/user-context.ts

```typescript
/**
 * USER CONTEXT ROUTES
 * 
 * Endpoints:
 * - GET /api/me/context - Get current user, memberships, and impersonation state
 * - POST /api/me/switch-tenant - Switch current tenant
 */

import { Router } from 'express';
import { db } from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();

/**
 * GET /api/me/context
 * 
 * Returns the current user's context including:
 * - User info
 * - Tenant memberships
 * - Current tenant ID
 * - Impersonation state
 */
router.get('/context', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const session = req.session as any;
    
    // Get user
    const userResult = await db.query(`
      SELECT 
        id,
        email,
        full_name,
        is_platform_admin
      FROM users
      WHERE id = $1
    `, [userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    // Get memberships with tenant info
    const membershipsResult = await db.query(`
      SELECT 
        tm.tenant_id,
        t.name as tenant_name,
        t.slug as tenant_slug,
        t.type as tenant_type,
        t.portal_slug,
        tm.role,
        tm.is_primary
      FROM tenant_memberships tm
      JOIN tenants t ON t.id = tm.tenant_id
      WHERE tm.user_id = $1
        AND t.status = 'active'
      ORDER BY tm.is_primary DESC, t.name ASC
    `, [userId]);
    
    const memberships = membershipsResult.rows;
    
    // Check for impersonation
    const impersonation = session?.impersonation;
    let impersonatedTenant = null;
    let currentTenantId = session?.current_tenant_id || null;
    
    if (impersonation?.tenant_id && impersonation?.expires_at) {
      // Check if impersonation is still valid
      if (new Date(impersonation.expires_at) > new Date()) {
        // Get impersonated tenant info
        const tenantResult = await db.query(`
          SELECT id, name, type, slug, portal_slug
          FROM tenants
          WHERE id = $1
        `, [impersonation.tenant_id]);
        
        if (tenantResult.rows.length > 0) {
          impersonatedTenant = tenantResult.rows[0];
          currentTenantId = impersonation.tenant_id;
        }
      } else {
        // Impersonation expired, clear it
        delete session.impersonation;
      }
    }
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        is_platform_admin: user.is_platform_admin || false,
      },
      memberships: memberships.map(m => ({
        tenant_id: m.tenant_id,
        tenant_name: m.tenant_name,
        tenant_slug: m.tenant_slug,
        tenant_type: m.tenant_type,
        portal_slug: m.portal_slug,
        role: m.role,
        is_primary: m.is_primary || false,
      })),
      current_tenant_id: currentTenantId,
      is_impersonating: !!impersonatedTenant,
      impersonated_tenant: impersonatedTenant ? {
        id: impersonatedTenant.id,
        name: impersonatedTenant.name,
        type: impersonatedTenant.type,
      } : null,
      impersonation_expires_at: impersonation?.expires_at || null,
    });
    
  } catch (error) {
    console.error('Error fetching user context:', error);
    res.status(500).json({ error: 'Failed to fetch user context' });
  }
});

/**
 * POST /api/me/switch-tenant
 * 
 * Switches the current tenant for the session.
 * User must have a membership in the target tenant.
 */
router.post('/switch-tenant', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { tenant_id } = req.body;
    
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }
    
    // Verify user has membership in this tenant
    const membershipResult = await db.query(`
      SELECT tm.tenant_id
      FROM tenant_memberships tm
      JOIN tenants t ON t.id = tm.tenant_id
      WHERE tm.user_id = $1 
        AND tm.tenant_id = $2
        AND t.status = 'active'
    `, [userId, tenant_id]);
    
    if (membershipResult.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this tenant' });
    }
    
    // Store in session
    (req.session as any).current_tenant_id = tenant_id;
    
    res.json({ success: true, tenant_id });
    
  } catch (error) {
    console.error('Error switching tenant:', error);
    res.status(500).json({ error: 'Failed to switch tenant' });
  }
});

export default router;
```

---

## FILE: server/routes/admin-impersonation.ts

```typescript
/**
 * ADMIN IMPERSONATION ROUTES
 * 
 * Endpoints:
 * - POST /api/admin/impersonation/start - Start impersonating a tenant
 * - POST /api/admin/impersonation/stop - Stop impersonation
 * 
 * All endpoints require platform admin access.
 */

import { Router } from 'express';
import { db } from '../db';
import { requireAuth, requirePlatformAdmin } from '../middleware/auth';

const router = Router();

// All routes require platform admin
router.use(requireAuth, requirePlatformAdmin);

/**
 * POST /api/admin/impersonation/start
 * 
 * Starts an impersonation session for a tenant.
 * Stores impersonation state in session.
 * Logs the impersonation for audit.
 */
router.post('/start', async (req, res) => {
  try {
    const adminUserId = req.user!.id;
    const { tenant_id, reason } = req.body;
    
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }
    
    // Get tenant info
    const tenantResult = await db.query(`
      SELECT id, name, type, slug, portal_slug
      FROM tenants
      WHERE id = $1
    `, [tenant_id]);
    
    if (tenantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    const tenant = tenantResult.rows[0];
    
    // Set expiration (1 hour from now)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    
    // Store impersonation in session
    (req.session as any).impersonation = {
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      tenant_type: tenant.type,
      admin_user_id: adminUserId,
      reason: reason || 'Admin access',
      started_at: new Date().toISOString(),
      expires_at: expiresAt,
    };
    
    // Also set as current tenant
    (req.session as any).current_tenant_id = tenant.id;
    
    // Log the impersonation (create table if needed)
    try {
      await db.query(`
        INSERT INTO impersonation_logs (
          admin_user_id,
          tenant_id,
          reason,
          started_at,
          ip_address
        ) VALUES ($1, $2, $3, NOW(), $4)
      `, [
        adminUserId,
        tenant_id,
        reason || 'Admin access',
        req.ip || 'unknown',
      ]);
    } catch (logError) {
      // Log table might not exist yet, that's okay
      console.warn('Could not log impersonation:', logError);
    }
    
    res.json({
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        type: tenant.type,
      },
      expires_at: expiresAt,
    });
    
  } catch (error) {
    console.error('Error starting impersonation:', error);
    res.status(500).json({ error: 'Failed to start impersonation' });
  }
});

/**
 * POST /api/admin/impersonation/stop
 * 
 * Stops the current impersonation session.
 */
router.post('/stop', async (req, res) => {
  try {
    const session = req.session as any;
    const impersonation = session?.impersonation;
    
    if (impersonation) {
      // Log the end of impersonation
      try {
        await db.query(`
          UPDATE impersonation_logs
          SET ended_at = NOW()
          WHERE admin_user_id = $1 
            AND tenant_id = $2
            AND ended_at IS NULL
        `, [impersonation.admin_user_id, impersonation.tenant_id]);
      } catch (logError) {
        console.warn('Could not update impersonation log:', logError);
      }
      
      // Clear impersonation
      delete session.impersonation;
      delete session.current_tenant_id;
    }
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Error stopping impersonation:', error);
    res.status(500).json({ error: 'Failed to stop impersonation' });
  }
});

/**
 * GET /api/admin/impersonation/status
 * 
 * Gets the current impersonation status.
 */
router.get('/status', async (req, res) => {
  const session = req.session as any;
  const impersonation = session?.impersonation;
  
  if (!impersonation || new Date(impersonation.expires_at) <= new Date()) {
    return res.json({ is_impersonating: false });
  }
  
  res.json({
    is_impersonating: true,
    tenant_id: impersonation.tenant_id,
    tenant_name: impersonation.tenant_name,
    tenant_type: impersonation.tenant_type,
    expires_at: impersonation.expires_at,
  });
});

export default router;
```

---

## FILE: server/routes/admin-tenants.ts

```typescript
/**
 * ADMIN TENANTS ROUTES
 * 
 * Endpoints:
 * - GET /api/admin/tenants - List all tenants
 * 
 * All endpoints require platform admin access.
 */

import { Router } from 'express';
import { db } from '../db';
import { requireAuth, requirePlatformAdmin } from '../middleware/auth';

const router = Router();

// All routes require platform admin
router.use(requireAuth, requirePlatformAdmin);

/**
 * GET /api/admin/tenants
 * 
 * Returns all tenants in the system.
 * Supports optional search/filter query params.
 */
router.get('/', async (req, res) => {
  try {
    const { search, type, status } = req.query;
    
    let query = `
      SELECT 
        id,
        name,
        slug,
        type,
        status,
        portal_slug,
        created_at
      FROM tenants
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;
    
    // Optional filters
    if (search) {
      query += ` AND (name ILIKE $${paramIndex} OR slug ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    if (type) {
      query += ` AND type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }
    
    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    query += ` ORDER BY type, name ASC`;
    
    const result = await db.query(query, params);
    
    res.json({
      tenants: result.rows.map(t => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        type: t.type,
        status: t.status || 'active',
        portal_slug: t.portal_slug,
        created_at: t.created_at,
      })),
    });
    
  } catch (error) {
    console.error('Error fetching tenants:', error);
    res.status(500).json({ error: 'Failed to fetch tenants' });
  }
});

/**
 * GET /api/admin/tenants/:id
 * 
 * Returns a single tenant with full details.
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(`
      SELECT *
      FROM tenants
      WHERE id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    const tenant = result.rows[0];
    
    // Get member count
    const memberResult = await db.query(`
      SELECT COUNT(*) as count
      FROM tenant_memberships
      WHERE tenant_id = $1
    `, [id]);
    
    res.json({
      tenant: {
        ...tenant,
        member_count: parseInt(memberResult.rows[0].count, 10),
      },
    });
    
  } catch (error) {
    console.error('Error fetching tenant:', error);
    res.status(500).json({ error: 'Failed to fetch tenant' });
  }
});

export default router;
```

---

## FILE: server/middleware/auth.ts (if not exists, or update existing)

```typescript
/**
 * AUTH MIDDLEWARE
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../db';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        is_platform_admin: boolean;
      };
    }
  }
}

/**
 * Requires user to be authenticated.
 * Populates req.user with user data.
 */
export async function requireAuth(
  req: Request, 
  res: Response, 
  next: NextFunction
) {
  try {
    const session = req.session as any;
    const userId = session?.userId || session?.user_id || session?.passport?.user;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Get user from database
    const result = await db.query(`
      SELECT id, email, full_name, is_platform_admin
      FROM users
      WHERE id = $1
    `, [userId]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    req.user = {
      id: result.rows[0].id,
      email: result.rows[0].email,
      is_platform_admin: result.rows[0].is_platform_admin || false,
    };
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
}

/**
 * Requires user to be a platform admin.
 * Must be used AFTER requireAuth.
 */
export function requirePlatformAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.user?.is_platform_admin) {
    return res.status(403).json({ error: 'Platform admin access required' });
  }
  next();
}
```

---

## REGISTER ROUTES IN server/index.ts (or server/app.ts)

Add these lines where routes are registered:

```typescript
// Import routes
import userContextRoutes from './routes/user-context';
import adminImpersonationRoutes from './routes/admin-impersonation';
import adminTenantsRoutes from './routes/admin-tenants';

// Register routes
app.use('/api/me', userContextRoutes);
app.use('/api/admin/impersonation', adminImpersonationRoutes);
app.use('/api/admin/tenants', adminTenantsRoutes);
```

---

## OPTIONAL: Create impersonation_logs table

```sql
-- Run this migration if it doesn't exist
CREATE TABLE IF NOT EXISTS impersonation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES users(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  reason TEXT,
  ip_address TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_impersonation_logs_admin 
  ON impersonation_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_logs_tenant 
  ON impersonation_logs(tenant_id);
```

---

## VERIFICATION

After implementing, test each endpoint:

```bash
# 1. Test /api/me/context (should return user + memberships)
curl -X GET http://localhost:5000/api/me/context \
  -H "Cookie: <your_session_cookie>" | jq .

# 2. Test /api/me/switch-tenant
curl -X POST http://localhost:5000/api/me/switch-tenant \
  -H "Content-Type: application/json" \
  -H "Cookie: <your_session_cookie>" \
  -d '{"tenant_id": "<valid_tenant_id>"}'

# 3. Test /api/admin/tenants (admin only)
curl -X GET http://localhost:5000/api/admin/tenants \
  -H "Cookie: <admin_session_cookie>" | jq .

# 4. Test /api/admin/impersonation/start (admin only)
curl -X POST http://localhost:5000/api/admin/impersonation/start \
  -H "Content-Type: application/json" \
  -H "Cookie: <admin_session_cookie>" \
  -d '{"tenant_id": "<valid_tenant_id>", "reason": "testing"}'

# 5. Test /api/admin/impersonation/stop (admin only)
curl -X POST http://localhost:5000/api/admin/impersonation/stop \
  -H "Cookie: <admin_session_cookie>"
```

All endpoints must return expected responses before proceeding to Phase 1.
