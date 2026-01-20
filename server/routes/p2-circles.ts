/**
 * P2 Circles API
 * Full CRUD for Coordination Circles, Members, and Delegations
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db';
import type { PoolClient } from 'pg';

const router = Router();

// Type for tenant-scoped request
interface TenantRequest extends Request {
    ctx: {
        individual_id?: string;
        tenant_id?: string;
        roles?: string[];
    };
    tenantQuery: (sql: string, params?: any[]) => Promise<any>;
    tenantTransaction: (fn: (client: PoolClient) => Promise<any>) => Promise<any>;
}

// Auth middleware
function requireAuth(req: Request, res: Response, next: Function) {
    const tenantReq = req as TenantRequest;
    if (!tenantReq.ctx?.individual_id) {
        return res.status(401).json({ ok: false, error: 'Authentication required' });
    }
    next();
}

// Check if user is circle admin/owner (scoped to circle membership only)
async function isCircleAdmin(req: Request, circleId: string): Promise<boolean> {
    const tenantReq = req as TenantRequest;
    const userId = tenantReq.ctx.individual_id;
    
    if (!userId) return false;
    
    // Check if circle member with admin or owner role (no tenant-wide bypass)
    const result = await tenantReq.tenantQuery(`
        SELECT cm.id, cr.level
        FROM cc_circle_members cm
        JOIN cc_circle_roles cr ON cm.role_id = cr.id
        WHERE cm.circle_id = $1
        AND cm.individual_id = $2
        AND cm.is_active = true
        AND cr.level IN ('owner', 'admin')
    `, [circleId, userId]);
    
    return result.rows.length > 0;
}

// Check if user is circle member
async function isCircleMember(req: Request, circleId: string): Promise<boolean> {
    const tenantReq = req as TenantRequest;
    const userId = tenantReq.ctx.individual_id;
    
    if (!userId) return false;
    
    const result = await tenantReq.tenantQuery(`
        SELECT id FROM cc_circle_members
        WHERE circle_id = $1
        AND individual_id = $2
        AND is_active = true
    `, [circleId, userId]);
    
    return result.rows.length > 0;
}

// GET /api/p2/circles - List circles user can access (must be a member)
router.get('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const tenantReq = req as TenantRequest;
        const userId = tenantReq.ctx.individual_id!;
        const { search, status } = req.query;
        
        // Only return circles where user is an active member
        let query = `
            SELECT DISTINCT c.*,
                (SELECT COUNT(*) FROM cc_circle_members WHERE circle_id = c.id AND is_active = true) as member_count,
                cm.role_id as user_role_id,
                cr.name as user_role_name,
                cr.level as user_role_level
            FROM cc_coordination_circles c
            INNER JOIN cc_circle_members cm ON c.id = cm.circle_id AND cm.individual_id = $1 AND cm.is_active = true
            LEFT JOIN cc_circle_roles cr ON cm.role_id = cr.id
            WHERE 1=1
        `;
        const params: any[] = [userId];
        let paramCount = 1;
        
        // Filter by status
        if (status && status !== 'all') {
            paramCount++;
            query += ` AND c.status = $${paramCount}`;
            params.push(status);
        }
        
        // Search by name/description
        if (search) {
            paramCount++;
            query += ` AND (c.name ILIKE $${paramCount} OR c.description ILIKE $${paramCount})`;
            params.push(`%${search}%`);
        }
        
        query += ' ORDER BY c.name ASC';
        
        const result = await tenantReq.tenantQuery(query, params);
        
        res.json({ 
            ok: true, 
            circles: result.rows 
        });
        
    } catch (error: any) {
        console.error('List circles error:', error);
        res.status(500).json({ ok: false, error: 'Failed to list circles' });
    }
});

// POST /api/p2/circles - Create new circle
router.post('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const tenantReq = req as TenantRequest;
        const userId = tenantReq.ctx.individual_id!;
        const tenantId = tenantReq.ctx.tenant_id;
        
        const { name, description, status = 'active' } = req.body;
        
        if (!name?.trim()) {
            return res.status(400).json({ ok: false, error: 'Circle name is required' });
        }
        
        // Generate slug from name
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        
        const result = await tenantReq.tenantTransaction(async (client: PoolClient) => {
            // Create circle
            const circleResult = await client.query(`
                INSERT INTO cc_coordination_circles (name, slug, description, status, hub_tenant_id)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            `, [name.trim(), slug, description || null, status, tenantId || null]);
            
            const circle = circleResult.rows[0];
            
            // Create owner role for this circle
            const roleResult = await client.query(`
                INSERT INTO cc_circle_roles (circle_id, name, level, scopes)
                VALUES ($1, 'Owner', 'owner', ARRAY['*'])
                RETURNING id
            `, [circle.id]);
            
            const ownerRoleId = roleResult.rows[0].id;
            
            // Add creator as owner
            await client.query(`
                INSERT INTO cc_circle_members (circle_id, member_type, individual_id, tenant_id, role_id, is_active)
                VALUES ($1, 'individual', $2, $3, $4, true)
            `, [circle.id, userId, tenantId || null, ownerRoleId]);
            
            // Create default admin and member roles
            await client.query(`
                INSERT INTO cc_circle_roles (circle_id, name, level, scopes)
                VALUES 
                    ($1, 'Admin', 'admin', ARRAY['manage_members', 'manage_delegations', 'send_messages']),
                    ($1, 'Member', 'member', ARRAY['view', 'send_messages'])
            `, [circle.id]);
            
            return circle;
        });
        
        res.status(201).json({ ok: true, circle: result });
        
    } catch (error: any) {
        console.error('Create circle error:', error);
        res.status(500).json({ ok: false, error: 'Failed to create circle' });
    }
});

// GET /api/p2/circles/:circleId - Get circle details
router.get('/:circleId', requireAuth, async (req: Request, res: Response) => {
    try {
        const tenantReq = req as TenantRequest;
        const { circleId } = req.params;
        const userId = tenantReq.ctx.individual_id!;
        
        // Check membership
        const isMember = await isCircleMember(req, circleId);
        const isAdmin = await isCircleAdmin(req, circleId);
        
        if (!isMember && !isAdmin) {
            return res.status(403).json({ ok: false, error: 'Access denied to this circle' });
        }
        
        const result = await tenantReq.tenantQuery(`
            SELECT c.*,
                (SELECT COUNT(*) FROM cc_circle_members WHERE circle_id = c.id AND is_active = true) as member_count,
                (SELECT COUNT(*) FROM cc_circle_delegations WHERE circle_id = c.id AND status = 'active') as delegation_count
            FROM cc_coordination_circles c
            WHERE c.id = $1
        `, [circleId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ ok: false, error: 'Circle not found' });
        }
        
        res.json({ 
            ok: true, 
            circle: result.rows[0],
            is_admin: isAdmin,
            is_member: isMember
        });
        
    } catch (error: any) {
        console.error('Get circle error:', error);
        res.status(500).json({ ok: false, error: 'Failed to get circle' });
    }
});

// PATCH /api/p2/circles/:circleId - Update circle
router.patch('/:circleId', requireAuth, async (req: Request, res: Response) => {
    try {
        const tenantReq = req as TenantRequest;
        const { circleId } = req.params;
        
        const isAdmin = await isCircleAdmin(req, circleId);
        if (!isAdmin) {
            return res.status(403).json({ ok: false, error: 'Only circle admins can update' });
        }
        
        const { name, description, status } = req.body;
        const updates: string[] = [];
        const params: any[] = [circleId];
        let paramCount = 1;
        
        if (name !== undefined) {
            paramCount++;
            updates.push(`name = $${paramCount}`);
            params.push(name);
            
            // Update slug
            const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            paramCount++;
            updates.push(`slug = $${paramCount}`);
            params.push(slug);
        }
        
        if (description !== undefined) {
            paramCount++;
            updates.push(`description = $${paramCount}`);
            params.push(description);
        }
        
        if (status !== undefined) {
            paramCount++;
            updates.push(`status = $${paramCount}`);
            params.push(status);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ ok: false, error: 'No updates provided' });
        }
        
        updates.push('updated_at = NOW()');
        
        const result = await tenantReq.tenantTransaction(async (client: PoolClient) => {
            const updateResult = await client.query(
                `UPDATE cc_coordination_circles SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
                params
            );
            return updateResult.rows[0];
        });
        
        res.json({ ok: true, circle: result });
        
    } catch (error: any) {
        console.error('Update circle error:', error);
        res.status(500).json({ ok: false, error: 'Failed to update circle' });
    }
});

// GET /api/p2/circles/:circleId/members - List circle members
router.get('/:circleId/members', requireAuth, async (req: Request, res: Response) => {
    try {
        const tenantReq = req as TenantRequest;
        const { circleId } = req.params;
        
        // Check access
        const isMember = await isCircleMember(req, circleId);
        const isAdmin = await isCircleAdmin(req, circleId);
        
        if (!isMember && !isAdmin) {
            return res.status(403).json({ ok: false, error: 'Access denied' });
        }
        
        const result = await tenantReq.tenantQuery(`
            SELECT cm.*,
                cr.name as role_name,
                cr.level as role_level,
                i.email as individual_email,
                COALESCE(i.display_name, i.email) as individual_name,
                t.name as tenant_name
            FROM cc_circle_members cm
            LEFT JOIN cc_circle_roles cr ON cm.role_id = cr.id
            LEFT JOIN cc_individuals i ON cm.individual_id = i.id
            LEFT JOIN cc_tenants t ON cm.tenant_id = t.id
            WHERE cm.circle_id = $1
            ORDER BY cr.level ASC, cm.joined_at ASC
        `, [circleId]);
        
        res.json({ ok: true, members: result.rows, is_admin: isAdmin });
        
    } catch (error: any) {
        console.error('List members error:', error);
        res.status(500).json({ ok: false, error: 'Failed to list members' });
    }
});

// POST /api/p2/circles/:circleId/members - Add member
router.post('/:circleId/members', requireAuth, async (req: Request, res: Response) => {
    try {
        const tenantReq = req as TenantRequest;
        const { circleId } = req.params;
        
        const isAdmin = await isCircleAdmin(req, circleId);
        if (!isAdmin) {
            return res.status(403).json({ ok: false, error: 'Only circle admins can add members' });
        }
        
        const { member_type, individual_id, tenant_id, party_id, role_id } = req.body;
        
        if (!member_type) {
            return res.status(400).json({ ok: false, error: 'member_type is required' });
        }
        
        // Get default member role if not specified
        let memberRoleId = role_id;
        if (!memberRoleId) {
            const roleResult = await tenantReq.tenantQuery(`
                SELECT id FROM cc_circle_roles 
                WHERE circle_id = $1 AND level = 'member'
                LIMIT 1
            `, [circleId]);
            
            if (roleResult.rows.length > 0) {
                memberRoleId = roleResult.rows[0].id;
            }
        }
        
        const result = await tenantReq.tenantTransaction(async (client: PoolClient) => {
            const insertResult = await client.query(`
                INSERT INTO cc_circle_members (circle_id, member_type, individual_id, tenant_id, party_id, role_id, is_active)
                VALUES ($1, $2, $3, $4, $5, $6, true)
                ON CONFLICT DO NOTHING
                RETURNING *
            `, [circleId, member_type, individual_id || null, tenant_id || null, party_id || null, memberRoleId]);
            
            return insertResult.rows[0];
        });
        
        if (!result) {
            return res.status(409).json({ ok: false, error: 'Member already exists' });
        }
        
        res.status(201).json({ ok: true, member: result });
        
    } catch (error: any) {
        console.error('Add member error:', error);
        res.status(500).json({ ok: false, error: 'Failed to add member' });
    }
});

// PATCH /api/p2/circles/:circleId/members/:memberId - Update member
router.patch('/:circleId/members/:memberId', requireAuth, async (req: Request, res: Response) => {
    try {
        const tenantReq = req as TenantRequest;
        const { circleId, memberId } = req.params;
        
        const isAdmin = await isCircleAdmin(req, circleId);
        if (!isAdmin) {
            return res.status(403).json({ ok: false, error: 'Only circle admins can update members' });
        }
        
        const { role_id, is_active } = req.body;
        const updates: string[] = [];
        const params: any[] = [memberId, circleId];
        let paramCount = 2;
        
        if (role_id !== undefined) {
            paramCount++;
            updates.push(`role_id = $${paramCount}`);
            params.push(role_id);
        }
        
        if (is_active !== undefined) {
            paramCount++;
            updates.push(`is_active = $${paramCount}`);
            params.push(is_active);
            
            if (!is_active) {
                updates.push(`left_at = NOW()`);
            }
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ ok: false, error: 'No updates provided' });
        }
        
        updates.push('updated_at = NOW()');
        
        const result = await tenantReq.tenantTransaction(async (client: PoolClient) => {
            const updateResult = await client.query(
                `UPDATE cc_circle_members SET ${updates.join(', ')} WHERE id = $1 AND circle_id = $2 RETURNING *`,
                params
            );
            return updateResult.rows[0];
        });
        
        if (!result) {
            return res.status(404).json({ ok: false, error: 'Member not found' });
        }
        
        res.json({ ok: true, member: result });
        
    } catch (error: any) {
        console.error('Update member error:', error);
        res.status(500).json({ ok: false, error: 'Failed to update member' });
    }
});

// DELETE /api/p2/circles/:circleId/members/:memberId - Remove member
router.delete('/:circleId/members/:memberId', requireAuth, async (req: Request, res: Response) => {
    try {
        const tenantReq = req as TenantRequest;
        const { circleId, memberId } = req.params;
        
        const isAdmin = await isCircleAdmin(req, circleId);
        if (!isAdmin) {
            return res.status(403).json({ ok: false, error: 'Only circle admins can remove members' });
        }
        
        await tenantReq.tenantTransaction(async (client: PoolClient) => {
            await client.query(`
                UPDATE cc_circle_members 
                SET is_active = false, left_at = NOW(), updated_at = NOW()
                WHERE id = $1 AND circle_id = $2
            `, [memberId, circleId]);
        });
        
        res.json({ ok: true, message: 'Member removed' });
        
    } catch (error: any) {
        console.error('Remove member error:', error);
        res.status(500).json({ ok: false, error: 'Failed to remove member' });
    }
});

// GET /api/p2/circles/:circleId/roles - List available roles
router.get('/:circleId/roles', requireAuth, async (req: Request, res: Response) => {
    try {
        const tenantReq = req as TenantRequest;
        const { circleId } = req.params;
        
        const isMember = await isCircleMember(req, circleId);
        if (!isMember) {
            return res.status(403).json({ ok: false, error: 'Access denied' });
        }
        
        const result = await tenantReq.tenantQuery(`
            SELECT * FROM cc_circle_roles
            WHERE circle_id = $1
            ORDER BY level ASC
        `, [circleId]);
        
        res.json({ ok: true, roles: result.rows });
        
    } catch (error: any) {
        console.error('List roles error:', error);
        res.status(500).json({ ok: false, error: 'Failed to list roles' });
    }
});

// GET /api/p2/circles/:circleId/delegations - List delegations
router.get('/:circleId/delegations', requireAuth, async (req: Request, res: Response) => {
    try {
        const tenantReq = req as TenantRequest;
        const { circleId } = req.params;
        
        const isMember = await isCircleMember(req, circleId);
        const isAdmin = await isCircleAdmin(req, circleId);
        
        if (!isMember && !isAdmin) {
            return res.status(403).json({ ok: false, error: 'Access denied' });
        }
        
        const result = await tenantReq.tenantQuery(`
            SELECT d.*,
                i1.email as delegator_email,
                COALESCE(i1.display_name, i1.email) as delegator_name,
                i2.email as delegatee_email,
                COALESCE(i2.display_name, i2.email) as delegatee_name,
                t.name as delegatee_tenant_name
            FROM cc_circle_delegations d
            LEFT JOIN cc_individuals i1 ON d.delegated_by_individual_id = i1.id
            LEFT JOIN cc_individuals i2 ON d.delegatee_individual_id = i2.id
            LEFT JOIN cc_tenants t ON d.delegatee_tenant_id = t.id
            WHERE d.circle_id = $1
            ORDER BY d.created_at DESC
        `, [circleId]);
        
        res.json({ ok: true, delegations: result.rows, is_admin: isAdmin });
        
    } catch (error: any) {
        console.error('List delegations error:', error);
        res.status(500).json({ ok: false, error: 'Failed to list delegations' });
    }
});

// POST /api/p2/circles/:circleId/delegations - Create delegation
router.post('/:circleId/delegations', requireAuth, async (req: Request, res: Response) => {
    try {
        const tenantReq = req as TenantRequest;
        const { circleId } = req.params;
        const userId = tenantReq.ctx.individual_id!;
        
        // Only circle members can create delegations (delegating their own access)
        const isMember = await isCircleMember(req, circleId);
        if (!isMember) {
            return res.status(403).json({ ok: false, error: 'Only circle members can create delegations' });
        }
        
        const { 
            delegatee_member_type,
            delegatee_individual_id,
            delegatee_tenant_id,
            delegatee_party_id,
            scopes = ['view'],
            expires_at
        } = req.body;
        
        if (!delegatee_member_type) {
            return res.status(400).json({ ok: false, error: 'delegatee_member_type is required' });
        }
        
        const result = await tenantReq.tenantTransaction(async (client: PoolClient) => {
            const insertResult = await client.query(`
                INSERT INTO cc_circle_delegations (
                    circle_id, delegated_by_individual_id,
                    delegatee_member_type, delegatee_individual_id, delegatee_tenant_id, delegatee_party_id,
                    scopes, status, expires_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8)
                RETURNING *
            `, [
                circleId, userId,
                delegatee_member_type, delegatee_individual_id || null, delegatee_tenant_id || null, delegatee_party_id || null,
                scopes, expires_at || null
            ]);
            
            return insertResult.rows[0];
        });
        
        res.status(201).json({ ok: true, delegation: result });
        
    } catch (error: any) {
        console.error('Create delegation error:', error);
        res.status(500).json({ ok: false, error: 'Failed to create delegation' });
    }
});

// DELETE /api/p2/circles/:circleId/delegations/:delegationId - Revoke delegation
router.delete('/:circleId/delegations/:delegationId', requireAuth, async (req: Request, res: Response) => {
    try {
        const tenantReq = req as TenantRequest;
        const { circleId, delegationId } = req.params;
        const userId = tenantReq.ctx.individual_id!;
        
        const isAdmin = await isCircleAdmin(req, circleId);
        
        // Check if user is admin or the delegator
        const delegation = await tenantReq.tenantQuery(`
            SELECT * FROM cc_circle_delegations
            WHERE id = $1 AND circle_id = $2
        `, [delegationId, circleId]);
        
        if (delegation.rows.length === 0) {
            return res.status(404).json({ ok: false, error: 'Delegation not found' });
        }
        
        const canRevoke = isAdmin || delegation.rows[0].delegated_by_individual_id === userId;
        if (!canRevoke) {
            return res.status(403).json({ ok: false, error: 'Only the delegator or admin can revoke' });
        }
        
        await tenantReq.tenantTransaction(async (client: PoolClient) => {
            await client.query(`
                UPDATE cc_circle_delegations 
                SET status = 'revoked', revoked_at = NOW(), updated_at = NOW()
                WHERE id = $1 AND circle_id = $2
            `, [delegationId, circleId]);
        });
        
        res.json({ ok: true, message: 'Delegation revoked' });
        
    } catch (error: any) {
        console.error('Revoke delegation error:', error);
        res.status(500).json({ ok: false, error: 'Failed to revoke delegation' });
    }
});

export default router;
