import { db } from '../db';
import { eq, and, or, gt, isNull, asc, desc } from 'drizzle-orm';
import { ccRoles, ccUserRoles, ccPermissions, ccPortals, ccAuthAccounts, ccProperties } from '@shared/schema';

interface AssignRoleRequest {
  userId: string;
  roleId?: string;
  roleCode?: string;
  portalSlug: string;
  propertyId?: string;
  assignedBy?: string;
  expiresAt?: Date;
  notes?: string;
}

export async function getRoles(
  portalSlug?: string,
  options?: {
    includeSystem?: boolean;
    includeTemplates?: boolean;
    status?: string;
  }
): Promise<any[]> {
  const conditions: any[] = [];
  
  if (portalSlug) {
    const portal = await db.query.ccPortals.findFirst({
      where: eq(ccPortals.slug, portalSlug)
    });
    
    if (portal) {
      conditions.push(or(
        eq(ccRoles.portalId, portal.id),
        isNull(ccRoles.portalId)
      ));
    }
  }
  
  const allowedTypes: string[] = ['custom'];
  if (options?.includeSystem) {
    allowedTypes.push('system');
  }
  if (options?.includeTemplates !== false) {
    allowedTypes.push('template');
  }
  
  if (allowedTypes.length === 1) {
    conditions.push(eq(ccRoles.roleType, allowedTypes[0]));
  } else if (allowedTypes.length === 2) {
    conditions.push(or(
      eq(ccRoles.roleType, allowedTypes[0]),
      eq(ccRoles.roleType, allowedTypes[1])
    ));
  } else if (allowedTypes.length === 3) {
    conditions.push(or(
      eq(ccRoles.roleType, 'system'),
      eq(ccRoles.roleType, 'template'),
      eq(ccRoles.roleType, 'custom')
    ));
  }
  
  if (options?.status) {
    conditions.push(eq(ccRoles.status, options.status));
  } else {
    conditions.push(eq(ccRoles.status, 'active'));
  }
  
  return db.query.ccRoles.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(ccRoles.hierarchyLevel), asc(ccRoles.name)]
  });
}

export async function getRoleByCode(code: string, portalSlug?: string): Promise<any | null> {
  const conditions: any[] = [eq(ccRoles.code, code)];
  
  if (portalSlug) {
    const portal = await db.query.ccPortals.findFirst({
      where: eq(ccPortals.slug, portalSlug)
    });
    
    if (portal) {
      conditions.push(or(
        eq(ccRoles.portalId, portal.id),
        isNull(ccRoles.portalId)
      ));
    }
  }
  
  return db.query.ccRoles.findFirst({
    where: and(...conditions)
  });
}

export async function createRole(
  portalSlug: string,
  data: {
    name: string;
    code: string;
    description?: string;
    hierarchyLevel?: number;
    permissions: string[];
    color?: string;
    icon?: string;
  }
): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const [role] = await db.insert(ccRoles).values({
    portalId: portal.id,
    name: data.name,
    code: data.code,
    description: data.description,
    roleType: 'custom',
    hierarchyLevel: data.hierarchyLevel || 20,
    permissions: data.permissions,
    color: data.color,
    icon: data.icon,
    status: 'active'
  }).returning();
  
  return role;
}

export async function updateRole(
  roleId: string,
  data: {
    name?: string;
    description?: string;
    hierarchyLevel?: number;
    permissions?: string[];
    color?: string;
    icon?: string;
    status?: string;
  }
): Promise<any> {
  const role = await db.query.ccRoles.findFirst({
    where: eq(ccRoles.id, roleId)
  });
  
  if (!role) throw new Error('Role not found');
  
  if (role.roleType === 'system') {
    throw new Error('Cannot modify system roles');
  }
  
  const updates: Record<string, any> = { updatedAt: new Date() };
  
  if (data.name) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.hierarchyLevel !== undefined) updates.hierarchyLevel = data.hierarchyLevel;
  if (data.permissions) updates.permissions = data.permissions;
  if (data.color !== undefined) updates.color = data.color;
  if (data.icon !== undefined) updates.icon = data.icon;
  if (data.status) updates.status = data.status;
  
  const [updated] = await db.update(ccRoles)
    .set(updates)
    .where(eq(ccRoles.id, roleId))
    .returning();
  
  return updated;
}

export async function assignRoleToUser(req: AssignRoleRequest): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, req.portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  let role: any;
  if (req.roleId) {
    role = await db.query.ccRoles.findFirst({
      where: eq(ccRoles.id, req.roleId)
    });
  } else if (req.roleCode) {
    role = await getRoleByCode(req.roleCode, req.portalSlug);
  }
  
  if (!role) throw new Error('Role not found');
  
  const user = await db.query.ccAuthAccounts.findFirst({
    where: eq(ccAuthAccounts.id, req.userId)
  });
  
  if (!user) throw new Error('User not found');
  
  const existing = await db.query.ccUserRoles.findFirst({
    where: and(
      eq(ccUserRoles.userId, req.userId),
      eq(ccUserRoles.roleId, role.id),
      eq(ccUserRoles.portalId, portal.id),
      req.propertyId 
        ? eq(ccUserRoles.propertyId, req.propertyId)
        : isNull(ccUserRoles.propertyId)
    )
  });
  
  if (existing) {
    const [updated] = await db.update(ccUserRoles)
      .set({
        status: 'active',
        expiresAt: req.expiresAt,
        notes: req.notes,
        updatedAt: new Date()
      })
      .where(eq(ccUserRoles.id, existing.id))
      .returning();
    
    return updated;
  }
  
  const [assignment] = await db.insert(ccUserRoles).values({
    userId: req.userId,
    roleId: role.id,
    portalId: portal.id,
    propertyId: req.propertyId,
    assignedBy: req.assignedBy,
    expiresAt: req.expiresAt,
    notes: req.notes,
    status: 'active'
  }).returning();
  
  return assignment;
}

export async function removeRoleFromUser(
  userId: string,
  roleId: string,
  portalSlug: string,
  propertyId?: string
): Promise<boolean> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const conditions: any[] = [
    eq(ccUserRoles.userId, userId),
    eq(ccUserRoles.roleId, roleId),
    eq(ccUserRoles.portalId, portal.id)
  ];
  
  if (propertyId) {
    conditions.push(eq(ccUserRoles.propertyId, propertyId));
  } else {
    conditions.push(isNull(ccUserRoles.propertyId));
  }
  
  const result = await db.delete(ccUserRoles)
    .where(and(...conditions))
    .returning();
  
  return result.length > 0;
}

export async function getUserRoles(
  userId: string,
  portalSlug?: string
): Promise<any[]> {
  const conditions: any[] = [
    eq(ccUserRoles.userId, userId),
    eq(ccUserRoles.status, 'active'),
    or(
      isNull(ccUserRoles.expiresAt),
      gt(ccUserRoles.expiresAt, new Date())
    )
  ];
  
  if (portalSlug) {
    const portal = await db.query.ccPortals.findFirst({
      where: eq(ccPortals.slug, portalSlug)
    });
    
    if (portal) {
      conditions.push(eq(ccUserRoles.portalId, portal.id));
    }
  }
  
  const assignments = await db.query.ccUserRoles.findMany({
    where: and(...conditions)
  });
  
  const enriched = await Promise.all(assignments.map(async (a) => {
    const role = await db.query.ccRoles.findFirst({
      where: eq(ccRoles.id, a.roleId)
    });
    
    let property = null;
    if (a.propertyId) {
      property = await db.query.ccProperties.findFirst({
        where: eq(ccProperties.id, a.propertyId)
      });
    }
    
    return {
      assignment: a,
      role,
      property: property ? { id: property.id, name: property.name } : null
    };
  }));
  
  return enriched;
}

export async function getUserPermissions(
  userId: string,
  portalSlug: string,
  propertyId?: string
): Promise<string[]> {
  const userRoles = await getUserRoles(userId, portalSlug);
  
  const allPermissions = new Set<string>();
  
  for (const { role, assignment } of userRoles) {
    if (!role) continue;
    
    if (propertyId && assignment.propertyId && assignment.propertyId !== propertyId) {
      continue;
    }
    
    if (role.permissions?.includes('*')) {
      allPermissions.add('*');
    } else {
      role.permissions?.forEach((p: string) => allPermissions.add(p));
    }
  }
  
  return Array.from(allPermissions);
}

export async function checkPermission(
  userId: string,
  portalSlug: string,
  permission: string,
  propertyId?: string
): Promise<boolean> {
  const permissions = await getUserPermissions(userId, portalSlug, propertyId);
  
  if (permissions.includes('*')) return true;
  
  if (permissions.includes(permission)) return true;
  
  const [resource, action] = permission.split('.');
  if (permissions.includes(`${resource}.manage`)) return true;
  
  return false;
}

export async function checkAnyPermission(
  userId: string,
  portalSlug: string,
  permissions: string[],
  propertyId?: string
): Promise<boolean> {
  const userPermissions = await getUserPermissions(userId, portalSlug, propertyId);
  
  if (userPermissions.includes('*')) return true;
  
  for (const permission of permissions) {
    if (userPermissions.includes(permission)) return true;
    
    const [resource] = permission.split('.');
    if (userPermissions.includes(`${resource}.manage`)) return true;
  }
  
  return false;
}

export async function checkAllPermissions(
  userId: string,
  portalSlug: string,
  permissions: string[],
  propertyId?: string
): Promise<boolean> {
  const userPermissions = await getUserPermissions(userId, portalSlug, propertyId);
  
  if (userPermissions.includes('*')) return true;
  
  for (const permission of permissions) {
    if (!userPermissions.includes(permission)) {
      const [resource] = permission.split('.');
      if (!userPermissions.includes(`${resource}.manage`)) {
        return false;
      }
    }
  }
  
  return true;
}

export async function getPermissions(category?: string): Promise<any[]> {
  if (category) {
    return db.query.ccPermissions.findMany({
      where: eq(ccPermissions.category, category),
      orderBy: [asc(ccPermissions.category), asc(ccPermissions.code)]
    });
  }
  
  return db.query.ccPermissions.findMany({
    orderBy: [asc(ccPermissions.category), asc(ccPermissions.code)]
  });
}

export async function getPermissionCategories(): Promise<string[]> {
  const permissions = await db.query.ccPermissions.findMany();
  const categories = new Set(permissions.map(p => p.category));
  return Array.from(categories).sort();
}
