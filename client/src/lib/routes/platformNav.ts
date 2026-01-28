/**
 * PLATFORM_NAV - Navigation for Platform Admin Mode
 * 
 * Routes under /app/platform/*
 * Does NOT show tenant-requiring sections.
 */

import {
  Building2,
  Users,
  BarChart3,
  Search,
  Settings,
  Map,
  Shield,
  Database,
  Terminal,
  Route,
  Ship,
  Cloud,
  Zap,
  Activity,
  FileText,
  MapPin,
  Play,
  UserCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface PlatformNavItem {
  icon: LucideIcon;
  label: string;
  href: string;
  testId: string;
  requiresTenantMemberships?: boolean;
  /** PROMPT-5: Capability code required for visibility */
  requiredCapability?: string;
}

export interface PlatformNavSection {
  title: string;
  items: PlatformNavItem[];
  /** PROMPT-5: Capability code required for visibility */
  requiredCapability?: string;
}

/**
 * Platform Admin navigation structure
 * All routes are under /app/platform/* prefix
 */
export const PLATFORM_NAV: PlatformNavSection[] = [
  {
    title: 'Personal',
    items: [
      { icon: Map, label: 'Your Places', href: '/app/places', testId: 'nav-places-picker', requiresTenantMemberships: true },
    ],
  },
  {
    title: 'Platform',
    requiredCapability: 'platform.configure', // PROMPT-5: Section-level capability
    items: [
      { icon: Building2, label: 'All Tenants', href: '/app/platform/tenants', testId: 'nav-platform-tenants', requiredCapability: 'platform.manage_tenants' },
      { icon: Users, label: 'All Users', href: '/app/platform/users', testId: 'nav-platform-users', requiredCapability: 'platform.manage_users' },
      { icon: UserCheck, label: 'Impersonation', href: '/app/platform/impersonation', testId: 'nav-platform-impersonation', requiredCapability: 'platform.impersonate' },
      { icon: BarChart3, label: 'Analytics', href: '/app/platform/analytics', testId: 'nav-platform-analytics', requiredCapability: 'platform.analytics' },
      { icon: Search, label: 'System Explorer', href: '/app/platform/system-explorer', testId: 'nav-system-explorer', requiredCapability: 'platform.configure' },
      { icon: Database, label: 'Data Management', href: '/app/platform/data-management', testId: 'nav-data-mgmt', requiredCapability: 'platform.configure' },
      { icon: Settings, label: 'Platform Settings', href: '/app/platform/settings', testId: 'nav-platform-settings', requiredCapability: 'platform.configure' },
    ],
  },
  {
    title: 'Command Console',
    requiredCapability: 'platform.configure', // PROMPT-5: Section-level capability
    items: [
      { icon: Route, label: 'BC Roads (DriveBC)', href: '/app/platform/command-console/roads', testId: 'nav-cc-roads', requiredCapability: 'platform.configure' },
      { icon: Ship, label: 'BC Ferries', href: '/app/platform/command-console/ferries', testId: 'nav-cc-ferries', requiredCapability: 'platform.configure' },
      { icon: Cloud, label: 'Weather', href: '/app/platform/command-console/weather', testId: 'nav-cc-weather', requiredCapability: 'platform.configure' },
      { icon: Zap, label: 'BC Hydro', href: '/app/platform/command-console/hydro', testId: 'nav-cc-hydro', requiredCapability: 'platform.configure' },
      { icon: Activity, label: 'Earthquakes', href: '/app/platform/command-console/earthquakes', testId: 'nav-cc-earthquakes', requiredCapability: 'platform.configure' },
      { icon: FileText, label: 'Dependency Rules', href: '/app/platform/command-console/dependency-rules', testId: 'nav-cc-dependency-rules', requiredCapability: 'platform.configure' },
      { icon: MapPin, label: 'Bamfield Snapshot', href: '/app/platform/command-console/bamfield', testId: 'nav-cc-bamfield', requiredCapability: 'platform.configure' },
      { icon: Play, label: 'Demo Launcher', href: '/app/dev/demo', testId: 'nav-demo-launcher', requiredCapability: 'platform.configure' },
    ],
  },
];

export interface PlatformNavFilterContext {
  hasTenantMemberships: boolean;
  /** PROMPT-5: Capability checker function from useCanUI() */
  canUI?: (capability: string) => boolean;
}

/**
 * Check if item is visible based on context
 * PROMPT-5: Supports capability-based visibility
 */
function isItemVisible(item: PlatformNavItem, ctx: PlatformNavFilterContext): boolean {
  if (item.requiresTenantMemberships && !ctx.hasTenantMemberships) {
    return false;
  }
  
  // PROMPT-5: Capability-based visibility check
  if (item.requiredCapability && ctx.canUI) {
    return ctx.canUI(item.requiredCapability);
  }
  
  return true;
}

/**
 * Check if section is visible based on context
 * PROMPT-5: Supports capability-based visibility
 */
function isSectionVisible(section: PlatformNavSection, ctx: PlatformNavFilterContext): boolean {
  // PROMPT-5: Capability-based visibility check
  if (section.requiredCapability && ctx.canUI) {
    return ctx.canUI(section.requiredCapability);
  }
  return true;
}

export function getPlatformNavSections(ctx?: PlatformNavFilterContext): PlatformNavSection[] {
  if (!ctx) {
    return PLATFORM_NAV;
  }
  
  return PLATFORM_NAV
    .filter(section => isSectionVisible(section, ctx))
    .map(section => ({
      ...section,
      items: section.items.filter(item => isItemVisible(item, ctx)),
    }))
    .filter(section => section.items.length > 0);
}
