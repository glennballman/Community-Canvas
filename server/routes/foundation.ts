import express, { Request, Response, NextFunction } from 'express';
import { pool } from '../db';
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
        const result = await pool.query(`
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
            const tenantResult = await pool.query(
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

        const userResult = await pool.query(
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

        const tenantsResult = await pool.query(`
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

        await pool.query(
            'UPDATE cc_users SET last_login_at = NOW(), login_count = login_count + 1 WHERE id = $1',
            [user.id]
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                displayName: user.display_name || `${user.first_name} ${user.last_name}`,
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

router.get('/auth/me', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userResult = await pool.query(`
            SELECT id, email, first_name, last_name, display_name, avatar_url, 
                   is_platform_admin, status, last_login_at
            FROM cc_users WHERE id = $1
        `, [req.user!.userId]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const user = userResult.rows[0];

        const tenantsResult = await pool.query(`
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
                firstName: user.first_name,
                lastName: user.last_name,
                displayName: user.display_name || `${user.first_name} ${user.last_name}`,
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
                u.id, u.email, u.first_name, u.last_name, u.display_name,
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
            query += ` AND (u.email ILIKE $${paramCount} OR u.first_name ILIKE $${paramCount} OR u.last_name ILIKE $${paramCount})`;
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

        const result = await pool.query(query, params);

        const countResult = await pool.query('SELECT COUNT(*) FROM cc_users');

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

        const userResult = await pool.query(`
            SELECT * FROM cc_users WHERE id = $1
        `, [id]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const user = userResult.rows[0];

        const profileResult = await pool.query(
            'SELECT * FROM cc_user_profiles WHERE user_id = $1',
            [id]
        );

        const qualResult = await pool.query(
            'SELECT * FROM cc_user_qualifications WHERE user_id = $1 ORDER BY qualification_type, name',
            [id]
        );

        const tenantsResult = await pool.query(`
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

router.get('/tenants', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { type, status, search } = req.query;

        let query = `
            SELECT 
                t.*,
                COUNT(DISTINCT tu.user_id) as member_count,
                u.email as owner_email,
                u.first_name as owner_first_name,
                u.last_name as owner_last_name
            FROM cc_tenants t
            LEFT JOIN cc_tenant_users tu ON tu.tenant_id = t.id AND tu.status = 'active'
            LEFT JOIN cc_users u ON u.id = t.owner_user_id
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

        query += ` GROUP BY t.id, u.email, u.first_name, u.last_name ORDER BY t.tenant_type, t.name`;

        const result = await pool.query(query, params);

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

        const tenantResult = await pool.query('SELECT * FROM cc_tenants WHERE id = $1', [id]);

        if (tenantResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Tenant not found' });
        }

        const membersResult = await pool.query(`
            SELECT 
                u.id, u.email, u.first_name, u.last_name, u.avatar_url,
                tu.role, tu.title, tu.status, tu.joined_at
            FROM cc_tenant_users tu
            JOIN cc_users u ON u.id = tu.user_id
            WHERE tu.tenant_id = $1
            ORDER BY tu.role, u.first_name
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

        const result = await pool.query(query, params);

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
        const stats = await pool.query(`
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

export default router;
export { AuthRequest };
