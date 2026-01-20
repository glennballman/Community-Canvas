/**
 * P-UI-17: Admin Roles & Settings API
 * 
 * Endpoints for tenant admin role management and settings configuration.
 * All endpoints enforce tenant admin/owner permission.
 */

import { Router } from 'express';
import { db } from '../db';
import { pool } from '../db';
import { 
  ccTenantIndividuals,
  ccPortalMembers,
  ccPortalSettings,
  ccPortals,
  ccNotificationPreferences,
} from '@shared/schema';
import { eq, and, sql, desc, ilike, or } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();

async function requireTenantAdmin(req: any, res: any): Promise<{ tenantId: string; userId: string } | null> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ ok: false, error: 'Authentication required' });
    return null;
  }
  
  const tenantId = req.headers['x-tenant-id'] as string;
  if (!tenantId) {
    res.status(400).json({ ok: false, error: 'Tenant context required' });
    return null;
  }
  
  const membership = await db.query.ccTenantIndividuals.findFirst({
    where: and(
      eq(ccTenantIndividuals.tenantId, tenantId),
      eq(ccTenantIndividuals.individualId, userId),
      eq(ccTenantIndividuals.status, 'active')
    ),
  });
  
  if (!membership || !['admin', 'owner'].includes(membership.role || '')) {
    const isPlatformAdmin = req.user?.isPlatformAdmin === true;
    if (!isPlatformAdmin) {
      res.status(403).json({ ok: false, error: 'Admin access required' });
      return null;
    }
  }
  
  return { tenantId, userId };
}

/**
 * GET /api/p2/admin/roles/catalog
 * Returns available role types for tenant + portal
 */
router.get('/roles/catalog', async (req, res) => {
  try {
    const auth = await requireTenantAdmin(req, res);
    if (!auth) return;

    const catalog = {
      tenant_roles: [
        { value: 'owner', label: 'Owner', description: 'Full access, can transfer ownership' },
        { value: 'admin', label: 'Admin', description: 'Manage users, settings, and all operations' },
        { value: 'manager', label: 'Manager', description: 'Manage day-to-day operations' },
        { value: 'staff', label: 'Staff', description: 'Limited operational access' },
        { value: 'viewer', label: 'Viewer', description: 'Read-only access' },
      ],
      portal_roles: [
        { value: 'owner', label: 'Owner', description: 'Full portal control' },
        { value: 'admin', label: 'Admin', description: 'Manage portal settings and members' },
        { value: 'moderator', label: 'Moderator', description: 'Review and moderate content' },
        { value: 'editor', label: 'Editor', description: 'Create and edit content' },
        { value: 'member', label: 'Member', description: 'Standard member access' },
        { value: 'guest', label: 'Guest', description: 'Limited guest access' },
      ],
    };

    res.json({ ok: true, catalog });
  } catch (error: any) {
    console.error('[Admin] GET roles/catalog error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * GET /api/p2/admin/users
 * List tenant users (from ccTenantIndividuals)
 */
router.get('/users', async (req, res) => {
  try {
    const auth = await requireTenantAdmin(req, res);
    if (!auth) return;

    const { role, status, search } = req.query;

    const result = await pool.query(`
      SELECT 
        ti.id,
        ti.individual_id,
        ti.role,
        ti.status,
        ti.created_at,
        ti.updated_at,
        i.email,
        i.full_name,
        i.avatar_url
      FROM cc_tenant_individuals ti
      LEFT JOIN cc_individuals i ON ti.individual_id = i.id
      WHERE ti.tenant_id = $1
      ORDER BY ti.created_at DESC
    `, [auth.tenantId]);

    let users = result.rows;

    if (role && typeof role === 'string') {
      users = users.filter((u: any) => u.role === role);
    }
    if (status && typeof status === 'string') {
      users = users.filter((u: any) => u.status === status);
    }
    if (search && typeof search === 'string') {
      const s = search.toLowerCase();
      users = users.filter((u: any) => 
        u.email?.toLowerCase().includes(s) ||
        u.full_name?.toLowerCase().includes(s)
      );
    }

    res.json({
      ok: true,
      users: users.map((u: any) => ({
        id: u.id,
        individual_id: u.individual_id,
        role: u.role,
        status: u.status,
        email: u.email,
        display_name: u.full_name || u.email,
        avatar_url: u.avatar_url,
        created_at: u.created_at,
        updated_at: u.updated_at,
      })),
      total: users.length,
    });
  } catch (error: any) {
    console.error('[Admin] GET users error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

const updateUserSchema = z.object({
  role: z.enum(['owner', 'admin', 'manager', 'staff', 'viewer']).optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
});

/**
 * PATCH /api/p2/admin/users/:id
 * Update user role or status
 */
router.patch('/users/:id', async (req, res) => {
  try {
    const auth = await requireTenantAdmin(req, res);
    if (!auth) return;

    const { id } = req.params;
    const body = updateUserSchema.parse(req.body);

    const existing = await db.query.ccTenantIndividuals.findFirst({
      where: and(
        eq(ccTenantIndividuals.id, id),
        eq(ccTenantIndividuals.tenantId, auth.tenantId)
      ),
    });

    if (!existing) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    if (existing.role === 'owner' && body.role && body.role !== 'owner') {
      return res.status(400).json({ ok: false, error: 'Cannot demote owner without transfer' });
    }

    const updates: any = { updatedAt: new Date() };
    if (body.role) updates.role = body.role;
    if (body.status) updates.status = body.status;

    const [updated] = await db
      .update(ccTenantIndividuals)
      .set(updates)
      .where(eq(ccTenantIndividuals.id, id))
      .returning();

    res.json({ ok: true, user: updated });
  } catch (error: any) {
    console.error('[Admin] PATCH users error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * GET /api/p2/admin/portal-members
 * List portal members for portals owned by this tenant
 */
router.get('/portal-members', async (req, res) => {
  try {
    const auth = await requireTenantAdmin(req, res);
    if (!auth) return;

    const { portalId, role, search } = req.query;

    const tenantPortals = await db
      .select({ id: ccPortals.id, name: ccPortals.name })
      .from(ccPortals)
      .where(eq(ccPortals.owningTenantId, auth.tenantId));

    const portalIds = tenantPortals.map(p => p.id);
    if (portalIds.length === 0) {
      return res.json({ ok: true, members: [], portals: [], total: 0 });
    }

    const targetPortalIds = portalId && typeof portalId === 'string' && portalIds.includes(portalId)
      ? [portalId]
      : portalIds;

    const memberResult = await pool.query(`
      SELECT 
        pm.id,
        pm.portal_id,
        pm.tenant_id,
        pm.individual_id,
        pm.role,
        pm.is_active,
        pm.can_post_jobs,
        pm.can_post_listings,
        pm.can_invite_members,
        pm.can_moderate,
        pm.can_edit_settings,
        pm.joined_at,
        i.email,
        i.full_name
      FROM cc_portal_members pm
      LEFT JOIN cc_individuals i ON pm.individual_id = i.id
      WHERE pm.portal_id = ANY($1)
      ORDER BY pm.joined_at DESC
    `, [targetPortalIds]);

    let members = memberResult.rows;

    if (role && typeof role === 'string') {
      members = members.filter((m: any) => m.role === role);
    }
    if (search && typeof search === 'string') {
      const s = search.toLowerCase();
      members = members.filter((m: any) =>
        m.email?.toLowerCase().includes(s) ||
        m.full_name?.toLowerCase().includes(s)
      );
    }

    res.json({
      ok: true,
      members: members.map((m: any) => ({
        id: m.id,
        portal_id: m.portal_id,
        tenant_id: m.tenant_id,
        individual_id: m.individual_id,
        role: m.role,
        is_active: m.is_active,
        permissions: {
          can_post_jobs: m.can_post_jobs,
          can_post_listings: m.can_post_listings,
          can_invite_members: m.can_invite_members,
          can_moderate: m.can_moderate,
          can_edit_settings: m.can_edit_settings,
        },
        email: m.email,
        display_name: m.full_name || m.email,
        joined_at: m.joined_at,
      })),
      portals: tenantPortals.map(p => ({ id: p.id, name: p.name })),
      total: members.length,
    });
  } catch (error: any) {
    console.error('[Admin] GET portal-members error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

const updatePortalMemberSchema = z.object({
  role: z.enum(['owner', 'admin', 'moderator', 'editor', 'member', 'guest']).optional(),
  is_active: z.boolean().optional(),
  permissions: z.object({
    can_post_jobs: z.boolean().optional(),
    can_post_listings: z.boolean().optional(),
    can_invite_members: z.boolean().optional(),
    can_moderate: z.boolean().optional(),
    can_edit_settings: z.boolean().optional(),
  }).optional(),
});

/**
 * PATCH /api/p2/admin/portal-members/:id
 * Update portal member role or permissions
 */
router.patch('/portal-members/:id', async (req, res) => {
  try {
    const auth = await requireTenantAdmin(req, res);
    if (!auth) return;

    const { id } = req.params;
    const body = updatePortalMemberSchema.parse(req.body);

    const existing = await db
      .select({
        member: ccPortalMembers,
        portalOwnerId: ccPortals.owningTenantId,
      })
      .from(ccPortalMembers)
      .innerJoin(ccPortals, eq(ccPortalMembers.portalId, ccPortals.id))
      .where(eq(ccPortalMembers.id, id))
      .limit(1);

    if (!existing.length || existing[0].portalOwnerId !== auth.tenantId) {
      return res.status(404).json({ ok: false, error: 'Portal member not found' });
    }

    const updates: any = { updatedAt: new Date() };
    if (body.role) updates.role = body.role;
    if (body.is_active !== undefined) updates.isActive = body.is_active;
    if (body.permissions) {
      if (body.permissions.can_post_jobs !== undefined) updates.canPostJobs = body.permissions.can_post_jobs;
      if (body.permissions.can_post_listings !== undefined) updates.canPostListings = body.permissions.can_post_listings;
      if (body.permissions.can_invite_members !== undefined) updates.canInviteMembers = body.permissions.can_invite_members;
      if (body.permissions.can_moderate !== undefined) updates.canModerate = body.permissions.can_moderate;
      if (body.permissions.can_edit_settings !== undefined) updates.canEditSettings = body.permissions.can_edit_settings;
    }

    const [updated] = await db
      .update(ccPortalMembers)
      .set(updates)
      .where(eq(ccPortalMembers.id, id))
      .returning();

    res.json({ ok: true, member: updated });
  } catch (error: any) {
    console.error('[Admin] PATCH portal-members error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * GET /api/p2/admin/settings/portal
 * Get portal settings for tenant's portals
 */
router.get('/settings/portal', async (req, res) => {
  try {
    const auth = await requireTenantAdmin(req, res);
    if (!auth) return;

    const { portalId } = req.query;

    const tenantPortals = await db
      .select({ id: ccPortals.id, name: ccPortals.name })
      .from(ccPortals)
      .where(eq(ccPortals.owningTenantId, auth.tenantId));

    if (tenantPortals.length === 0) {
      return res.json({ ok: true, settings: null, portals: [] });
    }

    const targetPortalId = portalId && typeof portalId === 'string' && tenantPortals.some(p => p.id === portalId)
      ? portalId
      : tenantPortals[0].id;

    const settings = await db.query.ccPortalSettings.findFirst({
      where: eq(ccPortalSettings.portalId, targetPortalId),
    });

    res.json({
      ok: true,
      settings: settings ? {
        id: settings.id,
        portal_id: settings.portalId,
        branding: {
          logo_url: settings.logoUrl,
          favicon_url: settings.faviconUrl,
          primary_color: settings.primaryColor,
          secondary_color: settings.secondaryColor,
          custom_css: settings.customCss,
        },
        moderation: {
          moderation_enabled: settings.moderationEnabled,
          silent_rejection: settings.silentRejection,
          rejection_notification_enabled: settings.rejectionNotificationEnabled,
          auto_expire_days: settings.autoExpireDays,
        },
        features: {
          jobs_enabled: settings.jobsEnabled,
          listings_enabled: settings.listingsEnabled,
          auto_approve_jobs: settings.autoApproveJobs,
          auto_approve_listings: settings.autoApproveListings,
          require_verification_for_posting: settings.requireVerificationForPosting,
          allow_anonymous_applications: settings.allowAnonymousApplications,
        },
      } : null,
      portals: tenantPortals.map(p => ({ id: p.id, name: p.name })),
    });
  } catch (error: any) {
    console.error('[Admin] GET settings/portal error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

const updatePortalSettingsSchema = z.object({
  portal_id: z.string().uuid(),
  branding: z.object({
    logo_url: z.string().nullable().optional(),
    favicon_url: z.string().nullable().optional(),
    primary_color: z.string().optional(),
    secondary_color: z.string().optional(),
    custom_css: z.string().nullable().optional(),
  }).optional(),
  moderation: z.object({
    moderation_enabled: z.boolean().optional(),
    silent_rejection: z.boolean().optional(),
    rejection_notification_enabled: z.boolean().optional(),
    auto_expire_days: z.number().int().min(1).max(365).optional(),
  }).optional(),
  features: z.object({
    jobs_enabled: z.boolean().optional(),
    listings_enabled: z.boolean().optional(),
    auto_approve_jobs: z.boolean().optional(),
    auto_approve_listings: z.boolean().optional(),
    require_verification_for_posting: z.boolean().optional(),
    allow_anonymous_applications: z.boolean().optional(),
  }).optional(),
});

/**
 * PATCH /api/p2/admin/settings/portal
 * Update portal settings
 */
router.patch('/settings/portal', async (req, res) => {
  try {
    const auth = await requireTenantAdmin(req, res);
    if (!auth) return;

    const body = updatePortalSettingsSchema.parse(req.body);

    const portal = await db.query.ccPortals.findFirst({
      where: and(
        eq(ccPortals.id, body.portal_id),
        eq(ccPortals.owningTenantId, auth.tenantId)
      ),
    });

    if (!portal) {
      return res.status(404).json({ ok: false, error: 'Portal not found' });
    }

    const existingSettings = await db.query.ccPortalSettings.findFirst({
      where: eq(ccPortalSettings.portalId, body.portal_id),
    });

    const updates: any = { updatedAt: new Date() };
    
    if (body.branding) {
      if (body.branding.logo_url !== undefined) updates.logoUrl = body.branding.logo_url;
      if (body.branding.favicon_url !== undefined) updates.faviconUrl = body.branding.favicon_url;
      if (body.branding.primary_color !== undefined) updates.primaryColor = body.branding.primary_color;
      if (body.branding.secondary_color !== undefined) updates.secondaryColor = body.branding.secondary_color;
      if (body.branding.custom_css !== undefined) updates.customCss = body.branding.custom_css;
    }
    
    if (body.moderation) {
      if (body.moderation.moderation_enabled !== undefined) updates.moderationEnabled = body.moderation.moderation_enabled;
      if (body.moderation.silent_rejection !== undefined) updates.silentRejection = body.moderation.silent_rejection;
      if (body.moderation.rejection_notification_enabled !== undefined) updates.rejectionNotificationEnabled = body.moderation.rejection_notification_enabled;
      if (body.moderation.auto_expire_days !== undefined) updates.autoExpireDays = body.moderation.auto_expire_days;
    }
    
    if (body.features) {
      if (body.features.jobs_enabled !== undefined) updates.jobsEnabled = body.features.jobs_enabled;
      if (body.features.listings_enabled !== undefined) updates.listingsEnabled = body.features.listings_enabled;
      if (body.features.auto_approve_jobs !== undefined) updates.autoApproveJobs = body.features.auto_approve_jobs;
      if (body.features.auto_approve_listings !== undefined) updates.autoApproveListings = body.features.auto_approve_listings;
      if (body.features.require_verification_for_posting !== undefined) updates.requireVerificationForPosting = body.features.require_verification_for_posting;
      if (body.features.allow_anonymous_applications !== undefined) updates.allowAnonymousApplications = body.features.allow_anonymous_applications;
    }

    let result;
    if (existingSettings) {
      [result] = await db
        .update(ccPortalSettings)
        .set(updates)
        .where(eq(ccPortalSettings.portalId, body.portal_id))
        .returning();
    } else {
      [result] = await db
        .insert(ccPortalSettings)
        .values({
          portalId: body.portal_id,
          ...updates,
        })
        .returning();
    }

    res.json({ ok: true, settings: result });
  } catch (error: any) {
    console.error('[Admin] PATCH settings/portal error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * GET /api/p2/admin/settings/notifications
 * Get notification preferences for current user or tenant
 */
router.get('/settings/notifications', async (req, res) => {
  try {
    const auth = await requireTenantAdmin(req, res);
    if (!auth) return;

    const prefs = await db.query.ccNotificationPreferences.findFirst({
      where: eq(ccNotificationPreferences.tenantId, auth.tenantId),
    });

    res.json({
      ok: true,
      preferences: prefs ? {
        id: prefs.id,
        email_enabled: prefs.emailEnabled,
        sms_enabled: prefs.smsEnabled,
        push_enabled: prefs.pushEnabled,
        in_app_enabled: prefs.inAppEnabled,
        email_address: prefs.emailAddress,
        phone_number: prefs.phoneNumber,
        digest_frequency: prefs.digestFrequency,
        digest_hour: prefs.digestHour,
        timezone: prefs.timezone,
        enabled_categories: prefs.enabledCategories,
        quiet_hours_enabled: prefs.quietHoursEnabled,
        quiet_hours_start: prefs.quietHoursStart,
        quiet_hours_end: prefs.quietHoursEnd,
      } : null,
    });
  } catch (error: any) {
    console.error('[Admin] GET settings/notifications error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

const updateNotificationPrefsSchema = z.object({
  email_enabled: z.boolean().optional(),
  sms_enabled: z.boolean().optional(),
  push_enabled: z.boolean().optional(),
  in_app_enabled: z.boolean().optional(),
  email_address: z.string().email().nullable().optional(),
  phone_number: z.string().nullable().optional(),
  digest_frequency: z.enum(['immediate', 'hourly', 'daily', 'weekly']).optional(),
  digest_hour: z.number().int().min(0).max(23).optional(),
  timezone: z.string().optional(),
  enabled_categories: z.array(z.string()).optional(),
  quiet_hours_enabled: z.boolean().optional(),
  quiet_hours_start: z.string().optional(),
  quiet_hours_end: z.string().optional(),
});

/**
 * PATCH /api/p2/admin/settings/notifications
 * Update notification preferences
 */
router.patch('/settings/notifications', async (req, res) => {
  try {
    const auth = await requireTenantAdmin(req, res);
    if (!auth) return;

    const body = updateNotificationPrefsSchema.parse(req.body);

    const existing = await db.query.ccNotificationPreferences.findFirst({
      where: eq(ccNotificationPreferences.tenantId, auth.tenantId),
    });

    const updates: any = { updatedAt: new Date() };
    if (body.email_enabled !== undefined) updates.emailEnabled = body.email_enabled;
    if (body.sms_enabled !== undefined) updates.smsEnabled = body.sms_enabled;
    if (body.push_enabled !== undefined) updates.pushEnabled = body.push_enabled;
    if (body.in_app_enabled !== undefined) updates.inAppEnabled = body.in_app_enabled;
    if (body.email_address !== undefined) updates.emailAddress = body.email_address;
    if (body.phone_number !== undefined) updates.phoneNumber = body.phone_number;
    if (body.digest_frequency !== undefined) updates.digestFrequency = body.digest_frequency;
    if (body.digest_hour !== undefined) updates.digestHour = body.digest_hour;
    if (body.timezone !== undefined) updates.timezone = body.timezone;
    if (body.enabled_categories !== undefined) updates.enabledCategories = body.enabled_categories;
    if (body.quiet_hours_enabled !== undefined) updates.quietHoursEnabled = body.quiet_hours_enabled;
    if (body.quiet_hours_start !== undefined) updates.quietHoursStart = body.quiet_hours_start;
    if (body.quiet_hours_end !== undefined) updates.quietHoursEnd = body.quiet_hours_end;

    let result;
    if (existing) {
      [result] = await db
        .update(ccNotificationPreferences)
        .set(updates)
        .where(eq(ccNotificationPreferences.tenantId, auth.tenantId))
        .returning();
    } else {
      [result] = await db
        .insert(ccNotificationPreferences)
        .values({
          tenantId: auth.tenantId,
          ...updates,
        })
        .returning();
    }

    res.json({ ok: true, preferences: result });
  } catch (error: any) {
    console.error('[Admin] PATCH settings/notifications error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * GET /api/p2/admin/portals/:portalId/qa
 * QA Launchpad - Returns portal info with all testable links
 * (campaigns, trips, proposals with pay tokens)
 */
router.get('/portals/:portalId/qa', async (req: any, res) => {
  try {
    const auth = await requireTenantAdmin(req, res);
    if (!auth) return;

    const { portalId } = req.params;
    const isPlatformAdmin = req.user?.isPlatformAdmin === true;

    // Get portal (verify tenant access)
    const portalResult = await pool.query(`
      SELECT id, slug, name, settings
      FROM cc_portals
      WHERE id = $1
        AND (owning_tenant_id = $2 OR $3 = true)
    `, [portalId, auth.tenantId, isPlatformAdmin]);

    if (portalResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Portal not found or access denied' });
    }

    const portal = portalResult.rows[0];
    const settings = portal.settings || {};
    
    // Get enabled campaigns from portal settings
    const enabledCampaignKeys = settings.enabled_campaigns || ['hospitality_all', 'trades_all', 'crew_all', 'all_roles'];
    const campaigns = enabledCampaignKeys.map((key: string) => ({
      key,
      title: key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
      status: 'active',
    }));

    // Get recent trips for this portal
    const tripsResult = await pool.query(`
      SELECT id, access_code, status, group_name, start_date, created_at
      FROM cc_trips
      WHERE portal_id = $1
        AND access_code IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 20
    `, [portalId]);

    const trips = tripsResult.rows.map((t: any) => ({
      id: t.id,
      accessCode: t.access_code,
      status: t.status,
      groupName: t.group_name,
      startDate: t.start_date,
    }));

    // Get proposals (trips that have invitation tokens for payment)
    const proposalsResult = await pool.query(`
      SELECT 
        t.id,
        t.group_name as title,
        t.status,
        ti.token as pay_token,
        ti.invitation_type
      FROM cc_trips t
      LEFT JOIN cc_trip_invitations ti ON ti.trip_id = t.id AND ti.invitation_type IN ('pay', 'forward', 'approve')
      WHERE t.portal_id = $1
      ORDER BY t.created_at DESC
      LIMIT 20
    `, [portalId]);

    // Dedupe proposals by trip id, keeping first token found
    const proposalMap = new Map<string, any>();
    for (const row of proposalsResult.rows) {
      if (!proposalMap.has(row.id)) {
        proposalMap.set(row.id, {
          id: row.id,
          title: row.title || 'Untitled Proposal',
          status: row.status,
          payToken: row.pay_token || null,
        });
      } else if (row.pay_token && !proposalMap.get(row.id).payToken) {
        proposalMap.get(row.id).payToken = row.pay_token;
      }
    }

    const proposals = Array.from(proposalMap.values());

    res.json({
      ok: true,
      portal: {
        id: portal.id,
        slug: portal.slug,
        name: portal.name,
      },
      campaigns,
      trips,
      proposals,
    });
  } catch (error: any) {
    console.error('[Admin] GET portals/:portalId/qa error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;
