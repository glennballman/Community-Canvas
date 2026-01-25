import express, { Request, Response, NextFunction } from 'express';
import { serviceQuery, withServiceTransaction } from '../db/tenantDb';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'cc-dev-secret-change-in-prod';

interface JWTPayload {
    userId: string;
    email: string;
    isPlatformAdmin: boolean;
    activeTenantId?: string;
}

interface AuthRequest extends Request {
    user?: JWTPayload;
    tenantContext?: {
        tenantId: string;
        tenantType: string;
        role: string;
        permissions: Record<string, boolean>;
    };
}

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ success: false, error: 'Invalid or expired token' });
    }
}

export function requirePlatformAdmin(req: AuthRequest, res: Response, next: NextFunction) {
    if (!req.user?.isPlatformAdmin) {
        return res.status(403).json({ success: false, error: 'Platform admin access required' });
    }
    next();
}

export async function loadTenantContext(req: AuthRequest, res: Response, next: NextFunction) {
    const tenantId = req.headers['x-tenant-id'] as string || req.query.tenantId as string;
    
    if (!tenantId || !req.user) {
        return next();
    }

    try {
        const result = await serviceQuery(`
            SELECT 
                t.id as tenant_id,
                t.tenant_type,
                tu.role,
                COALESCE(tu.permissions, r.default_permissions, '{}') as permissions
            FROM cc_tenants t
            JOIN cc_tenant_users tu ON tu.tenant_id = t.id
            LEFT JOIN cc_roles r ON r.tenant_type = t.tenant_type AND r.role_name = tu.role
            WHERE t.id = $1 AND tu.user_id = $2 AND tu.status = 'active'
        `, [tenantId, req.user.userId]);

        if (result.rows.length > 0) {
            req.tenantContext = {
                tenantId: result.rows[0].tenant_id,
                tenantType: result.rows[0].tenant_type,
                role: result.rows[0].role,
                permissions: result.rows[0].permissions
            };
        } else if (req.user.isPlatformAdmin) {
            const tenantResult = await serviceQuery(
                'SELECT id, tenant_type FROM cc_tenants WHERE id = $1',
                [tenantId]
            );
            if (tenantResult.rows.length > 0) {
                req.tenantContext = {
                    tenantId: tenantResult.rows[0].id,
                    tenantType: tenantResult.rows[0].tenant_type,
                    role: 'platform_admin',
                    permissions: { all: true }
                };
            }
        }
    } catch (err) {
        console.error('Error loading tenant context:', err);
    }

    next();
}

router.post('/auth/login', async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Email and password required' });
        }

        const userResult = await serviceQuery(
            'SELECT * FROM cc_users WHERE email = $1 AND status = $2',
            [email.toLowerCase(), 'active']
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        const user = userResult.rows[0];

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        const tenantsResult = await serviceQuery(`
            SELECT 
                t.id, t.name, t.slug, t.tenant_type,
                tu.role, tu.title
            FROM cc_tenant_users tu
            JOIN cc_tenants t ON t.id = tu.tenant_id
            WHERE tu.user_id = $1 AND tu.status = 'active' AND t.status = 'active'
            ORDER BY t.tenant_type, t.name
        `, [user.id]);

        const payload: JWTPayload = {
            userId: user.id,
            email: user.email,
            isPlatformAdmin: user.is_platform_admin
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

        await serviceQuery(
            'UPDATE cc_users SET last_login_at = NOW(), login_count = login_count + 1 WHERE id = $1',
            [user.id]
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.given_name,
                lastName: user.family_name,
                displayName: user.display_name || `${user.given_name} ${user.family_name}`,
                avatarUrl: user.avatar_url,
                isPlatformAdmin: user.is_platform_admin
            },
            tenants: tenantsResult.rows.map(t => ({
                id: t.id,
                name: t.name,
                slug: t.slug,
                type: t.tenant_type,
                role: t.role,
                title: t.title
            }))
        });

    } catch (error: any) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, error: 'Login failed' });
    }
});

router.post('/auth/logout', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        console.log(`[AUTH] User ${req.user!.userId} logged out`);
        
        res.json({
            success: true,
            message: 'Logged out successfully'
        });

    } catch (error: any) {
        console.error('Logout error:', error);
        res.status(500).json({ success: false, error: 'Logout failed' });
    }
});

router.get('/auth/whoami', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userResult = await serviceQuery(`
            SELECT id, email, given_name, family_name, display_name, avatar_url, 
                   is_platform_admin, status
            FROM cc_users WHERE id = $1
        `, [req.user!.userId]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ ok: false, error: 'User not found' });
        }

        const user = userResult.rows[0];
        
        const session = (req as any).session;
        const impersonation = session?.impersonation;
        const isImpersonating = impersonation && new Date(impersonation.expires_at) > new Date();

        res.json({
            ok: true,
            user: {
                id: user.id,
                email: user.email,
                displayName: user.display_name || `${user.given_name} ${user.family_name}`,
                isPlatformAdmin: user.is_platform_admin
            },
            impersonation: isImpersonating ? {
                active: true,
                target_user: {
                    id: impersonation.impersonated_user_id,
                    email: impersonation.impersonated_user_email,
                    display_name: impersonation.impersonated_user_name
                },
                tenant: impersonation.tenant_id ? {
                    id: impersonation.tenant_id,
                    slug: impersonation.tenant_slug || null,
                    name: impersonation.tenant_name
                } : null,
                role: impersonation.tenant_role || null,
                expires_at: impersonation.expires_at
            } : {
                active: false,
                target_user: null,
                tenant: null,
                role: null,
                expires_at: null
            }
        });

    } catch (error: any) {
        console.error('Whoami error:', error);
        res.status(500).json({ ok: false, error: 'Failed to get identity' });
    }
});

router.get('/auth/me', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userResult = await serviceQuery(`
            SELECT id, email, given_name, family_name, display_name, avatar_url, 
                   is_platform_admin, status, last_login_at
            FROM cc_users WHERE id = $1
        `, [req.user!.userId]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const user = userResult.rows[0];

        const tenantsResult = await serviceQuery(`
            SELECT t.id, t.name, t.slug, t.tenant_type, tu.role, tu.title
            FROM cc_tenant_users tu
            JOIN cc_tenants t ON t.id = tu.tenant_id
            WHERE tu.user_id = $1 AND tu.status = 'active' AND t.status = 'active'
            ORDER BY t.tenant_type, t.name
        `, [user.id]);

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.given_name,
                lastName: user.family_name,
                displayName: user.display_name || `${user.given_name} ${user.family_name}`,
                avatarUrl: user.avatar_url,
                isPlatformAdmin: user.is_platform_admin,
                status: user.status,
                lastLoginAt: user.last_login_at
            },
            tenants: tenantsResult.rows.map(t => ({
                id: t.id,
                name: t.name,
                slug: t.slug,
                type: t.tenant_type,
                role: t.role,
                title: t.title
            }))
        });

    } catch (error: any) {
        console.error('Get me error:', error);
        res.status(500).json({ success: false, error: 'Failed to get user' });
    }
});

router.get('/users', authenticateToken, requirePlatformAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const { search, status, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT 
                u.id, u.email, u.given_name, u.family_name, u.display_name,
                u.is_platform_admin, u.status, u.created_at, u.last_login_at,
                COUNT(DISTINCT tu.tenant_id) as tenant_count
            FROM cc_users u
            LEFT JOIN cc_tenant_users tu ON tu.user_id = u.id AND tu.status = 'active'
            WHERE 1=1
        `;
        const params: any[] = [];
        let paramCount = 0;

        if (search) {
            paramCount++;
            query += ` AND (u.email ILIKE $${paramCount} OR u.given_name ILIKE $${paramCount} OR u.family_name ILIKE $${paramCount})`;
            params.push(`%${search}%`);
        }

        if (status) {
            paramCount++;
            query += ` AND u.status = $${paramCount}`;
            params.push(status);
        }

        query += ` GROUP BY u.id ORDER BY u.created_at DESC`;
        query += ` LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
        params.push(parseInt(limit as string), parseInt(offset as string));

        const result = await serviceQuery(query, params);

        const countResult = await serviceQuery('SELECT COUNT(*) FROM cc_users');

        res.json({
            success: true,
            users: result.rows,
            total: parseInt(countResult.rows[0].count),
            limit: parseInt(limit as string),
            offset: parseInt(offset as string)
        });

    } catch (error: any) {
        console.error('List users error:', error);
        res.status(500).json({ success: false, error: 'Failed to list users' });
    }
});

router.get('/users/:id', authenticateToken, requirePlatformAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const userResult = await serviceQuery(`
            SELECT * FROM cc_users WHERE id = $1
        `, [id]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const user = userResult.rows[0];

        const profileResult = await serviceQuery(
            'SELECT * FROM cc_user_profiles WHERE user_id = $1',
            [id]
        );

        const qualResult = await serviceQuery(
            'SELECT * FROM cc_user_qualifications WHERE user_id = $1 ORDER BY qualification_type, name',
            [id]
        );

        const tenantsResult = await serviceQuery(`
            SELECT t.*, tu.role, tu.title, tu.status as membership_status, tu.joined_at
            FROM cc_tenant_users tu
            JOIN cc_tenants t ON t.id = tu.tenant_id
            WHERE tu.user_id = $1
            ORDER BY t.tenant_type, t.name
        `, [id]);

        res.json({
            success: true,
            user: {
                ...user,
                password_hash: undefined
            },
            profile: profileResult.rows[0] || null,
            qualifications: qualResult.rows,
            tenants: tenantsResult.rows
        });

    } catch (error: any) {
        console.error('Get user error:', error);
        res.status(500).json({ success: false, error: 'Failed to get user' });
    }
});

router.patch('/users/:id', authenticateToken, requirePlatformAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { email, given_name, family_name, status } = req.body;

        const userResult = await serviceQuery('SELECT * FROM cc_users WHERE id = $1', [id]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const updates: string[] = [];
        const params: any[] = [];
        let paramCount = 0;

        if (email) {
            paramCount++;
            updates.push(`email = $${paramCount}`);
            params.push(email);
        }
        if (given_name !== undefined) {
            paramCount++;
            updates.push(`given_name = $${paramCount}`);
            params.push(given_name);
        }
        if (family_name !== undefined) {
            paramCount++;
            updates.push(`family_name = $${paramCount}`);
            params.push(family_name);
        }
        if (status) {
            paramCount++;
            updates.push(`status = $${paramCount}`);
            params.push(status);
        }

        if (updates.length === 0) {
            return res.status(400).json({ success: false, error: 'No fields to update' });
        }

        paramCount++;
        updates.push(`updated_at = NOW()`);
        params.push(id);

        await serviceQuery(
            `UPDATE cc_users SET ${updates.join(', ')} WHERE id = $${paramCount}`,
            params
        );

        console.log(`[ADMIN] User ${id} updated by platform admin ${req.user!.userId}`);

        res.json({ success: true, message: 'User updated successfully' });

    } catch (error: any) {
        console.error('Update user error:', error);
        res.status(500).json({ success: false, error: 'Failed to update user' });
    }
});

router.patch('/users/:id/password', authenticateToken, requirePlatformAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { new_password } = req.body;

        if (!new_password || new_password.length < 8) {
            return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
        }

        const userResult = await serviceQuery('SELECT * FROM cc_users WHERE id = $1', [id]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const bcrypt = await import('bcryptjs');
        const hashedPassword = await bcrypt.hash(new_password, 12);

        await serviceQuery(
            'UPDATE cc_users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
            [hashedPassword, id]
        );

        console.log(`[ADMIN] Password reset for user ${id} by platform admin ${req.user!.userId}`);

        res.json({ success: true, message: 'Password updated successfully' });

    } catch (error: any) {
        console.error('Reset password error:', error);
        res.status(500).json({ success: false, error: 'Failed to reset password' });
    }
});

router.get('/tenants', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { type, status, search } = req.query;

        let query = `
            SELECT 
                t.*,
                COUNT(DISTINCT tu.user_id) as member_count,
                u.email as owner_email,
                u.given_name as owner_given_name,
                u.family_name as owner_family_name,
                p.slug as portal_slug
            FROM cc_tenants t
            LEFT JOIN cc_tenant_users tu ON tu.tenant_id = t.id AND tu.status = 'active'
            LEFT JOIN cc_users u ON u.id = t.owner_user_id
            LEFT JOIN LATERAL (
                SELECT slug FROM cc_portals 
                WHERE owning_tenant_id = t.id AND status = 'active'
                ORDER BY created_at LIMIT 1
            ) p ON true
            WHERE 1=1
        `;
        const params: any[] = [];
        let paramCount = 0;

        if (!req.user!.isPlatformAdmin) {
            paramCount++;
            query += ` AND t.id IN (SELECT tenant_id FROM cc_tenant_users WHERE user_id = $${paramCount} AND status = 'active')`;
            params.push(req.user!.userId);
        }

        if (type) {
            paramCount++;
            query += ` AND t.tenant_type = $${paramCount}`;
            params.push(type);
        }

        if (status) {
            paramCount++;
            query += ` AND t.status = $${paramCount}`;
            params.push(status);
        }

        if (search) {
            paramCount++;
            query += ` AND (t.name ILIKE $${paramCount} OR t.slug ILIKE $${paramCount})`;
            params.push(`%${search}%`);
        }

        query += ` GROUP BY t.id, u.email, u.given_name, u.family_name, p.slug ORDER BY t.tenant_type, t.name`;

        const result = await serviceQuery(query, params);

        res.json({
            success: true,
            tenants: result.rows
        });

    } catch (error: any) {
        console.error('List tenants error:', error);
        res.status(500).json({ success: false, error: 'Failed to list tenants' });
    }
});

router.get('/tenants/:id', authenticateToken, loadTenantContext, async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        if (!req.user!.isPlatformAdmin && !req.tenantContext) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        const tenantResult = await serviceQuery(`
            SELECT t.*, p.slug as portal_slug
            FROM cc_tenants t
            LEFT JOIN LATERAL (
                SELECT slug FROM cc_portals 
                WHERE owning_tenant_id = t.id AND status = 'active'
                ORDER BY created_at LIMIT 1
            ) p ON true
            WHERE t.id = $1
        `, [id]);

        if (tenantResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Tenant not found' });
        }

        const membersResult = await serviceQuery(`
            SELECT 
                u.id, u.email, u.given_name, u.family_name, u.avatar_url,
                tu.role, tu.title, tu.status, tu.joined_at
            FROM cc_tenant_users tu
            JOIN cc_users u ON u.id = tu.user_id
            WHERE tu.tenant_id = $1
            ORDER BY tu.role, u.given_name
        `, [id]);

        res.json({
            success: true,
            tenant: tenantResult.rows[0],
            members: membersResult.rows,
            currentUserRole: req.tenantContext?.role || (req.user!.isPlatformAdmin ? 'platform_admin' : null)
        });

    } catch (error: any) {
        console.error('Get tenant error:', error);
        res.status(500).json({ success: false, error: 'Failed to get tenant' });
    }
});

router.get('/roles', async (req: Request, res: Response) => {
    try {
        const { tenantType } = req.query;

        let query = 'SELECT * FROM cc_roles';
        const params: any[] = [];

        if (tenantType) {
            query += ' WHERE tenant_type = $1';
            params.push(tenantType);
        }

        query += ' ORDER BY tenant_type, role_name';

        const result = await serviceQuery(query, params);

        res.json({
            success: true,
            roles: result.rows
        });

    } catch (error: any) {
        console.error('Get roles error:', error);
        res.status(500).json({ success: false, error: 'Failed to get roles' });
    }
});

router.get('/stats', authenticateToken, requirePlatformAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const stats = await serviceQuery(`
            SELECT
                (SELECT COUNT(*) FROM cc_users) as total_users,
                (SELECT COUNT(*) FROM cc_users WHERE status = 'active') as active_users,
                (SELECT COUNT(*) FROM cc_users WHERE is_platform_admin = true) as platform_admins,
                (SELECT COUNT(*) FROM cc_tenants) as total_tenants,
                (SELECT COUNT(*) FROM cc_tenants WHERE tenant_type = 'government') as government_tenants,
                (SELECT COUNT(*) FROM cc_tenants WHERE tenant_type = 'business') as business_tenants,
                (SELECT COUNT(*) FROM cc_tenants WHERE tenant_type = 'property') as property_tenants,
                (SELECT COUNT(*) FROM cc_tenants WHERE tenant_type = 'individual') as individual_tenants,
                (SELECT COUNT(*) FROM cc_tenant_users) as total_memberships
        `);

        res.json({
            success: true,
            stats: stats.rows[0]
        });

    } catch (error: any) {
        console.error('Get stats error:', error);
        res.status(500).json({ success: false, error: 'Failed to get stats' });
    }
});

router.post('/me/switch-tenant', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { tenant_id } = req.body;
        const userId = req.user?.userId;

        if (!tenant_id) {
            return res.status(400).json({ success: false, error: 'tenant_id is required' });
        }

        const membershipResult = await serviceQuery(`
            SELECT 
                t.id as tenant_id,
                t.name as tenant_name,
                t.slug,
                t.tenant_type,
                tu.role,
                tu.is_primary
            FROM cc_tenant_users tu
            JOIN cc_tenants t ON t.id = tu.tenant_id
            WHERE tu.user_id = $1 AND tu.tenant_id = $2 AND tu.status = 'active' AND t.status = 'active'
        `, [userId, tenant_id]);

        if (membershipResult.rows.length === 0) {
            if (req.user?.isPlatformAdmin) {
                const tenantResult = await serviceQuery(
                    'SELECT id, name, slug, tenant_type FROM cc_tenants WHERE id = $1 AND status = $2',
                    [tenant_id, 'active']
                );
                if (tenantResult.rows.length === 0) {
                    return res.status(404).json({ success: false, error: 'Tenant not found' });
                }
                return res.json({
                    success: true,
                    tenant: {
                        id: tenantResult.rows[0].id,
                        name: tenantResult.rows[0].name,
                        slug: tenantResult.rows[0].slug,
                        type: tenantResult.rows[0].tenant_type,
                        role: 'platform_admin'
                    }
                });
            }
            return res.status(403).json({ success: false, error: 'Access denied to this tenant' });
        }

        const tenant = membershipResult.rows[0];

        res.json({
            success: true,
            tenant: {
                id: tenant.tenant_id,
                name: tenant.tenant_name,
                slug: tenant.slug,
                type: tenant.tenant_type,
                role: tenant.role
            }
        });

    } catch (error: any) {
        console.error('Switch tenant error:', error);
        res.status(500).json({ success: false, error: 'Failed to switch tenant' });
    }
});

router.get('/me/context', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;

        const userResult = await serviceQuery(
            'SELECT id, email, given_name, family_name, display_name, is_platform_admin FROM cc_users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const user = userResult.rows[0];

        const membershipsResult = await serviceQuery(`
            SELECT 
                t.id as tenant_id,
                t.name as tenant_name,
                t.slug as tenant_slug,
                t.tenant_type,
                p.slug as portal_slug,
                tu.role,
                tu.is_primary
            FROM cc_tenant_users tu
            JOIN cc_tenants t ON t.id = tu.tenant_id
            LEFT JOIN cc_portals p ON p.tenant_id = t.id
            WHERE tu.user_id = $1 AND tu.status = 'active' AND t.status = 'active'
            ORDER BY tu.is_primary DESC, t.tenant_type, t.name
        `, [userId]);

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                full_name: user.display_name || `${user.given_name} ${user.family_name}`,
                is_platform_admin: user.is_platform_admin
            },
            memberships: membershipsResult.rows.map(m => ({
                tenant_id: m.tenant_id,
                tenant_name: m.tenant_name,
                tenant_slug: m.tenant_slug,
                tenant_type: m.tenant_type,
                portal_slug: m.portal_slug,
                role: m.role,
                is_primary: m.is_primary
            }))
        });

    } catch (error: any) {
        console.error('Get context error:', error);
        res.status(500).json({ success: false, error: 'Failed to get user context' });
    }
});

export default router;
export { AuthRequest };
