import { Router } from 'express';
import {
  getRoles, getRoleByCode, createRole, updateRole,
  assignRoleToUser, removeRoleFromUser, getUserRoles,
  getUserPermissions, checkPermission, checkAnyPermission,
  getPermissions, getPermissionCategories
} from '../services/roleService';

const router = Router();

router.get('/', async (req, res) => {
  const { portal, includeSystem, includeTemplates, status } = req.query;
  
  try {
    const roles = await getRoles(portal as string, {
      includeSystem: includeSystem === 'true',
      includeTemplates: includeTemplates !== 'false',
      status: status as string
    });
    
    res.json({ roles, count: roles.length });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to get roles' });
  }
});

router.get('/by-code/:code', async (req, res) => {
  const { code } = req.params;
  const { portal } = req.query;
  
  try {
    const role = await getRoleByCode(code, portal as string);
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }
    res.json({ role });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to get role' });
  }
});

router.post('/portals/:slug', async (req, res) => {
  const { slug } = req.params;
  const b = req.body || {};
  
  if (!b.name || !b.code || !b.permissions) {
    return res.status(400).json({ error: 'name, code, permissions required' });
  }
  
  try {
    const role = await createRole(slug, {
      name: b.name,
      code: b.code,
      description: b.description,
      hierarchyLevel: b.hierarchyLevel,
      permissions: b.permissions,
      color: b.color,
      icon: b.icon
    });
    
    res.json({ role });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const b = req.body || {};
  
  try {
    const role = await updateRole(id, {
      name: b.name,
      description: b.description,
      hierarchyLevel: b.hierarchyLevel,
      permissions: b.permissions,
      color: b.color,
      icon: b.icon,
      status: b.status
    });
    
    res.json({ role });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/assign', async (req, res) => {
  const b = req.body || {};
  
  if (!b.userId || !b.portalSlug || (!b.roleId && !b.roleCode)) {
    return res.status(400).json({ error: 'userId, portalSlug, roleId or roleCode required' });
  }
  
  try {
    const assignment = await assignRoleToUser({
      userId: b.userId,
      roleId: b.roleId,
      roleCode: b.roleCode,
      portalSlug: b.portalSlug,
      propertyId: b.propertyId,
      assignedBy: b.assignedBy,
      expiresAt: b.expiresAt ? new Date(b.expiresAt) : undefined,
      notes: b.notes
    });
    
    res.json({ assignment });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/assign', async (req, res) => {
  const { userId, roleId, portalSlug, propertyId } = req.body || {};
  
  if (!userId || !roleId || !portalSlug) {
    return res.status(400).json({ error: 'userId, roleId, portalSlug required' });
  }
  
  try {
    const removed = await removeRoleFromUser(userId, roleId, portalSlug, propertyId);
    res.json({ success: removed });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/user/:userId', async (req, res) => {
  const { userId } = req.params;
  const { portal } = req.query;
  
  try {
    const roles = await getUserRoles(userId, portal as string);
    res.json({ roles, count: roles.length });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to get user roles' });
  }
});

router.get('/user/:userId/permissions', async (req, res) => {
  const { userId } = req.params;
  const { portal, property } = req.query;
  
  if (!portal) {
    return res.status(400).json({ error: 'portal query param required' });
  }
  
  try {
    const permissions = await getUserPermissions(userId, portal as string, property as string);
    res.json({ permissions, count: permissions.length });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to get permissions' });
  }
});

router.post('/check', async (req, res) => {
  const { userId, portalSlug, permission, propertyId } = req.body || {};
  
  if (!userId || !portalSlug || !permission) {
    return res.status(400).json({ error: 'userId, portalSlug, permission required' });
  }
  
  try {
    const hasPermission = await checkPermission(userId, portalSlug, permission, propertyId);
    res.json({ hasPermission, permission });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to check permission' });
  }
});

router.post('/check-any', async (req, res) => {
  const { userId, portalSlug, permissions, propertyId } = req.body || {};
  
  if (!userId || !portalSlug || !permissions || !Array.isArray(permissions)) {
    return res.status(400).json({ error: 'userId, portalSlug, permissions[] required' });
  }
  
  try {
    const hasPermission = await checkAnyPermission(userId, portalSlug, permissions, propertyId);
    res.json({ hasPermission, permissions });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to check permissions' });
  }
});

router.get('/permissions', async (req, res) => {
  const { category } = req.query;
  
  try {
    const permissions = await getPermissions(category as string);
    res.json({ permissions, count: permissions.length });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to get permissions' });
  }
});

router.get('/permissions/categories', async (req, res) => {
  try {
    const categories = await getPermissionCategories();
    res.json({ categories });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to get categories' });
  }
});

export default router;
