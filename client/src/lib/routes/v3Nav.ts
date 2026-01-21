/**
 * V3 NAV - Single Source of Truth for Left Nav IA
 * 
 * AUTHORITATIVE: All /app/* navigation flows through this config.
 * Sections and routes aligned with authoritative dashboard map.
 */

import {
  LayoutDashboard,
  Calendar,
  Car,
  Anchor,
  Home,
  Briefcase,
  ClipboardList,
  FolderKanban,
  Truck,
  ShieldAlert,
  MessageSquare,
  Settings,
  Building2,
  Users,
  BarChart3,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
  Plane,
  Bell,
  FileText,
  Wrench,
  Wallet,
  UserCog,
  Package,
  MapPin,
  Contact,
  Circle,
  Zap,
  Search,
  Image,
  Map,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  icon: LucideIcon;
  label: string;
  href: string;
  testId: string;
  requiresAuth?: boolean;
  requiresTenant?: boolean;
  requiresPortal?: boolean;
  platformAdminOnly?: boolean;
  tenantRolesAny?: string[];
  portalRolesAny?: string[];
  participantOnly?: boolean;
  hiddenInProduction?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
  requiresAuth?: boolean;
  requiresTenant?: boolean;
  requiresPortal?: boolean;
  platformAdminOnly?: boolean;
  tenantRolesAny?: string[];
  portalRolesAny?: string[];
  participantOnly?: boolean;
  hiddenInProduction?: boolean;
}

/**
 * V3_NAV - Authoritative navigation structure
 * 
 * Sections (in order):
 * 1. Personal - Dashboard, My Trips, My Applications
 * 2. Operations - Ops Board, Housekeeping, Incidents, N3 Attention
 * 3. Reservations - All Reservations, Parking, Marina, Hospitality
 * 4. Work - Jobs, Work Requests, Projects, Service Runs
 * 5. Fleet - Fleet Dashboard, Assets, Maintenance
 * 6. Assets & Inventory - Assets, Availability, Directory
 * 7. CRM - Places, People, Organizations
 * 8. Communication - Messages, Notifications, Circles
 * 9. Compliance - Enforcement
 * 10. Admin - Admin, Roles, Settings, Folios, Usage, Certifications, Operator, Portals
 * 11. Platform - Tenants, Analytics (platformAdminOnly)
 * 12. Dev - Media Dev (hiddenInProduction)
 */
export const V3_NAV: NavSection[] = [
  {
    title: 'Personal',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', href: '/app/dashboard', testId: 'nav-dashboard', requiresTenant: true },
      { icon: Map, label: 'Your Places', href: '/app/places', testId: 'nav-places-picker' },
      { icon: Plane, label: 'My Trips', href: '/app/participant/trips', testId: 'nav-my-trips', participantOnly: true },
      { icon: FileText, label: 'My Applications', href: '/app/participant/applications', testId: 'nav-my-applications', participantOnly: true },
    ],
  },
  {
    title: 'Operations',
    requiresTenant: true,
    tenantRolesAny: ['tenant_owner', 'tenant_admin', 'operator', 'staff'],
    items: [
      { icon: Calendar, label: 'Operations Board', href: '/app/ops', testId: 'nav-ops', requiresTenant: true },
      { icon: Sparkles, label: 'Housekeeping', href: '/app/ops/housekeeping', testId: 'nav-housekeeping', requiresTenant: true },
      { icon: AlertTriangle, label: 'Incidents', href: '/app/ops/incidents', testId: 'nav-incidents', requiresTenant: true },
      { icon: Zap, label: 'N3 Attention', href: '/app/n3/attention', testId: 'nav-n3-attention', requiresTenant: true },
      { icon: Users, label: 'Coordination', href: '/app/ops/coordination', testId: 'nav-coordination', requiresTenant: true, tenantRolesAny: ['tenant_owner', 'tenant_admin'] },
    ],
  },
  {
    title: 'Reservations',
    requiresTenant: true,
    tenantRolesAny: ['tenant_owner', 'tenant_admin', 'operator', 'staff'],
    items: [
      { icon: Calendar, label: 'All Reservations', href: '/app/reservations', testId: 'nav-reservations', requiresTenant: true },
      { icon: Car, label: 'Parking', href: '/app/parking', testId: 'nav-parking', requiresTenant: true },
      { icon: Anchor, label: 'Marina', href: '/app/marina', testId: 'nav-marina', requiresTenant: true },
      { icon: Home, label: 'Hospitality', href: '/app/hospitality', testId: 'nav-hospitality', requiresTenant: true },
    ],
  },
  {
    title: 'Work',
    requiresTenant: true,
    tenantRolesAny: ['tenant_owner', 'tenant_admin', 'operator', 'staff'],
    items: [
      { icon: Briefcase, label: 'Job Postings', href: '/app/jobs', testId: 'nav-jobs', requiresTenant: true },
      { icon: ClipboardList, label: 'Work Requests', href: '/app/work-requests', testId: 'nav-work-requests', requiresTenant: true },
      { icon: FolderKanban, label: 'Projects', href: '/app/projects', testId: 'nav-projects', requiresTenant: true },
      { icon: Truck, label: 'Service Runs', href: '/app/services/runs', testId: 'nav-service-runs', requiresTenant: true },
    ],
  },
  {
    title: 'Fleet',
    requiresTenant: true,
    tenantRolesAny: ['tenant_owner', 'tenant_admin', 'operator', 'staff'],
    items: [
      { icon: Truck, label: 'Fleet Dashboard', href: '/app/fleet', testId: 'nav-fleet', requiresTenant: true },
      { icon: Car, label: 'Fleet Assets', href: '/app/fleet/assets', testId: 'nav-fleet-assets', requiresTenant: true },
      { icon: Wrench, label: 'Maintenance', href: '/app/fleet/maintenance', testId: 'nav-fleet-maintenance', requiresTenant: true },
    ],
  },
  {
    title: 'Assets & Inventory',
    requiresTenant: true,
    tenantRolesAny: ['tenant_owner', 'tenant_admin', 'operator', 'staff'],
    items: [
      { icon: Package, label: 'Assets', href: '/app/assets', testId: 'nav-assets', requiresTenant: true },
      { icon: BarChart3, label: 'Availability', href: '/app/availability', testId: 'nav-availability', requiresTenant: true },
      { icon: Building2, label: 'Directory', href: '/app/directory', testId: 'nav-directory', requiresTenant: true },
    ],
  },
  {
    title: 'CRM',
    requiresTenant: true,
    tenantRolesAny: ['tenant_owner', 'tenant_admin', 'operator', 'staff'],
    items: [
      { icon: MapPin, label: 'Places', href: '/app/crm/places', testId: 'nav-places', requiresTenant: true },
      { icon: Contact, label: 'People', href: '/app/crm/people', testId: 'nav-people', requiresTenant: true },
      { icon: Building2, label: 'Organizations', href: '/app/crm/orgs', testId: 'nav-orgs', requiresTenant: true },
    ],
  },
  {
    title: 'Communication',
    requiresTenant: true,
    items: [
      { icon: MessageSquare, label: 'Messages', href: '/app/messages', testId: 'nav-messages', requiresTenant: true },
      { icon: Bell, label: 'Notifications', href: '/app/notifications', testId: 'nav-notifications', requiresTenant: true },
      { icon: Circle, label: 'Circles', href: '/app/circles', testId: 'nav-circles', requiresTenant: true },
    ],
  },
  {
    title: 'Compliance',
    requiresTenant: true,
    tenantRolesAny: ['tenant_owner', 'tenant_admin', 'operator'],
    items: [
      { icon: ShieldAlert, label: 'Enforcement', href: '/app/enforcement', testId: 'nav-enforcement', requiresTenant: true },
    ],
  },
  {
    title: 'Admin',
    requiresTenant: true,
    tenantRolesAny: ['tenant_owner', 'tenant_admin'],
    items: [
      { icon: Settings, label: 'Admin Home', href: '/app/admin', testId: 'nav-admin', tenantRolesAny: ['tenant_owner', 'tenant_admin'] },
      { icon: UserCog, label: 'Roles', href: '/app/admin/roles', testId: 'nav-roles', tenantRolesAny: ['tenant_owner', 'tenant_admin'] },
      { icon: Settings, label: 'Settings', href: '/app/admin/settings', testId: 'nav-settings', tenantRolesAny: ['tenant_owner', 'tenant_admin'] },
      { icon: Wallet, label: 'Folios', href: '/app/admin/folios', testId: 'nav-folios', tenantRolesAny: ['tenant_owner', 'tenant_admin'] },
      { icon: BarChart3, label: 'Usage', href: '/app/admin/usage', testId: 'nav-usage', tenantRolesAny: ['tenant_owner', 'tenant_admin'] },
      { icon: ShieldCheck, label: 'Certifications', href: '/app/admin/certifications', testId: 'nav-certifications', tenantRolesAny: ['tenant_owner', 'tenant_admin'] },
      { icon: Building2, label: 'Operator', href: '/app/operator', testId: 'nav-operator', tenantRolesAny: ['tenant_owner', 'tenant_admin', 'operator'] },
      { icon: Building2, label: 'Portals', href: '/app/admin/portals', testId: 'nav-portals', tenantRolesAny: ['tenant_owner', 'tenant_admin'] },
    ],
  },
  {
    title: 'Platform',
    platformAdminOnly: true,
    items: [
      { icon: Building2, label: 'All Tenants', href: '/app/platform/tenants', testId: 'nav-platform-tenants', platformAdminOnly: true },
      { icon: BarChart3, label: 'Analytics', href: '/app/platform/analytics', testId: 'nav-platform-analytics', platformAdminOnly: true },
      { icon: Search, label: 'System Explorer', href: '/admin/system-explorer', testId: 'nav-system-explorer', platformAdminOnly: true },
    ],
  },
  {
    title: 'Dev',
    hiddenInProduction: true,
    items: [
      { icon: Image, label: 'Media Dev', href: '/app/dev/media', testId: 'nav-dev-media', hiddenInProduction: true },
    ],
  },
];

/**
 * Flat list of all required routes for route audit
 */
export const V3_REQUIRED_ROUTES = V3_NAV.flatMap(section => 
  section.items.map(item => item.href)
);

/**
 * Get all nav items as flat array
 */
export function getAllNavItems(): NavItem[] {
  return V3_NAV.flatMap(section => section.items);
}

/**
 * Filter navigation based on user context
 */
export interface NavFilterContext {
  isAuthenticated: boolean;
  hasTenant: boolean;
  hasPortal: boolean;
  isPlatformAdmin: boolean;
  tenantRole?: string;
  portalRole?: string;
  founderNavEnabled?: boolean;
}

/**
 * Check if a user's role matches any of the allowed roles
 */
function hasAnyRole(userRole: string | undefined, allowedRoles: string[] | undefined): boolean {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  if (!userRole) return false;
  return allowedRoles.includes(userRole);
}

/**
 * Check if an item should be visible based on context
 */
function isItemVisible(item: NavItem, ctx: NavFilterContext): boolean {
  // Founder nav shows more items, but still respects tenant requirements
  // This prevents showing tenant-requiring nav items when no tenant is selected
  if (ctx.founderNavEnabled) {
    // Still hide items that require a tenant if no tenant is selected
    if (item.requiresTenant && !ctx.hasTenant) {
      return false;
    }
    // Show dev/hidden items in founder mode
    if (item.hiddenInProduction) return true;
    // Show platform admin items in founder mode
    if (item.platformAdminOnly) return true;
    // Show all other items
    return true;
  }
  
  if (item.hiddenInProduction && process.env.NODE_ENV === 'production') {
    return false;
  }
  
  if (item.platformAdminOnly && !ctx.isPlatformAdmin) {
    return false;
  }
  
  if (item.requiresTenant && !ctx.hasTenant) {
    return false;
  }
  
  if (item.requiresPortal && !ctx.hasPortal) {
    return false;
  }
  
  if (item.tenantRolesAny && !hasAnyRole(ctx.tenantRole, item.tenantRolesAny)) {
    return false;
  }
  
  if (item.portalRolesAny && !hasAnyRole(ctx.portalRole, item.portalRolesAny)) {
    return false;
  }
  
  return true;
}

/**
 * Check if a section should be visible based on context
 */
function isSectionVisible(section: NavSection, ctx: NavFilterContext): boolean {
  // Founder nav shows more sections, but still respects tenant requirements
  if (ctx.founderNavEnabled) {
    // Still hide sections that require a tenant if no tenant is selected
    if (section.requiresTenant && !ctx.hasTenant) {
      return false;
    }
    return true;
  }
  
  if (section.hiddenInProduction && process.env.NODE_ENV === 'production') {
    return false;
  }
  
  if (section.platformAdminOnly && !ctx.isPlatformAdmin) {
    return false;
  }
  
  if (section.requiresTenant && !ctx.hasTenant) {
    return false;
  }
  
  if (section.requiresPortal && !ctx.hasPortal) {
    return false;
  }
  
  if (section.tenantRolesAny && !hasAnyRole(ctx.tenantRole, section.tenantRolesAny)) {
    return false;
  }
  
  if (section.portalRolesAny && !hasAnyRole(ctx.portalRole, section.portalRolesAny)) {
    return false;
  }
  
  return true;
}

/**
 * Get filtered navigation sections based on user context
 */
export function getFilteredNavSections(ctx: NavFilterContext): NavSection[] {
  return V3_NAV
    .filter(section => isSectionVisible(section, ctx))
    .map(section => ({
      ...section,
      items: section.items.filter(item => isItemVisible(item, ctx)),
    }))
    .filter(section => section.items.length > 0);
}
