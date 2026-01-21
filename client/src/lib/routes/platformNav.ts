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
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface PlatformNavItem {
  icon: LucideIcon;
  label: string;
  href: string;
  testId: string;
}

export interface PlatformNavSection {
  title: string;
  items: PlatformNavItem[];
}

/**
 * Platform Admin navigation structure
 * All routes are under /app/platform/* prefix
 */
export const PLATFORM_NAV: PlatformNavSection[] = [
  {
    title: 'Personal',
    items: [
      { icon: Map, label: 'Your Places', href: '/app/places', testId: 'nav-places-picker' },
    ],
  },
  {
    title: 'Platform',
    items: [
      { icon: Building2, label: 'All Tenants', href: '/app/platform/tenants', testId: 'nav-platform-tenants' },
      { icon: Users, label: 'All Users', href: '/app/platform/users', testId: 'nav-platform-users' },
      { icon: BarChart3, label: 'Analytics', href: '/app/platform/analytics', testId: 'nav-platform-analytics' },
      { icon: Search, label: 'System Explorer', href: '/admin/system-explorer', testId: 'nav-system-explorer' },
      { icon: Database, label: 'Data Management', href: '/admin/data/infrastructure', testId: 'nav-data-mgmt' },
      { icon: Settings, label: 'Platform Settings', href: '/admin/settings', testId: 'nav-platform-settings' },
    ],
  },
];

export function getPlatformNavSections(): PlatformNavSection[] {
  return PLATFORM_NAV;
}
