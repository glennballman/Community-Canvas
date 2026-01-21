/**
 * FOUNDER_NAV - Navigation for Founder Solo Mode
 * 
 * Routes under /app/founder/*
 * Aggregate view across all tenants the user owns.
 * Does NOT show tenant-requiring sections until tenant is selected.
 */

import {
  LayoutDashboard,
  Map,
  Building2,
  Briefcase,
  BarChart3,
  Calendar,
  Image,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface FounderNavItem {
  icon: LucideIcon;
  label: string;
  href: string;
  testId: string;
  hiddenInProduction?: boolean;
}

export interface FounderNavSection {
  title: string;
  items: FounderNavItem[];
  hiddenInProduction?: boolean;
}

/**
 * Founder Solo navigation structure
 * Shows aggregate views across all tenants
 */
export const FOUNDER_NAV: FounderNavSection[] = [
  {
    title: 'Personal',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', href: '/app/founder', testId: 'nav-founder-dashboard' },
      { icon: Map, label: 'Your Places', href: '/app/places', testId: 'nav-places-picker' },
    ],
  },
  {
    title: 'Overview',
    items: [
      { icon: Building2, label: 'All Organizations', href: '/app/founder/organizations', testId: 'nav-founder-orgs' },
      { icon: Briefcase, label: 'Work Summary', href: '/app/founder/work', testId: 'nav-founder-work' },
      { icon: Calendar, label: 'Reservations', href: '/app/founder/reservations', testId: 'nav-founder-reservations' },
      { icon: BarChart3, label: 'Analytics', href: '/app/founder/analytics', testId: 'nav-founder-analytics' },
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

export function getFounderNavSections(): FounderNavSection[] {
  if (process.env.NODE_ENV === 'production') {
    return FOUNDER_NAV.filter(section => !section.hiddenInProduction).map(section => ({
      ...section,
      items: section.items.filter(item => !item.hiddenInProduction),
    }));
  }
  return FOUNDER_NAV;
}
