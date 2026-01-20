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
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  icon: LucideIcon;
  label: string;
  href: string;
  testId: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/**
 * V3_NAV - Authoritative navigation structure
 * 
 * Sections (in order):
 * 1. Operations - Dashboard, Ops Board
 * 2. Reservations - Reservations, Parking, Marina, Hospitality
 * 3. Work - Jobs, Work Requests, Projects, Service Runs
 * 4. Compliance - Enforcement
 * 5. Communication - Messages
 * 6. Admin - Admin, Operator, Portals, Tenants
 */
export const V3_NAV: NavSection[] = [
  {
    title: 'Personal',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', href: '/app', testId: 'nav-dashboard' },
      { icon: Plane, label: 'My Trips', href: '/app/participant/trips', testId: 'nav-my-trips' },
      { icon: FileText, label: 'My Applications', href: '/app/participant/applications', testId: 'nav-my-applications' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { icon: Calendar, label: 'Operations Board', href: '/app/ops', testId: 'nav-ops' },
      { icon: Sparkles, label: 'Housekeeping', href: '/app/ops/housekeeping', testId: 'nav-housekeeping' },
      { icon: AlertTriangle, label: 'Incidents', href: '/app/ops/incidents', testId: 'nav-incidents' },
    ],
  },
  {
    title: 'Reservations',
    items: [
      { icon: Calendar, label: 'Reservations', href: '/app/reservations', testId: 'nav-reservations' },
      { icon: Car, label: 'Parking', href: '/app/parking', testId: 'nav-parking' },
      { icon: Anchor, label: 'Marina', href: '/app/marina', testId: 'nav-marina' },
      { icon: Home, label: 'Hospitality', href: '/app/hospitality', testId: 'nav-hospitality' },
    ],
  },
  {
    title: 'Work',
    items: [
      { icon: Briefcase, label: 'Jobs', href: '/app/jobs', testId: 'nav-jobs' },
      { icon: ClipboardList, label: 'Work Requests', href: '/app/work-requests', testId: 'nav-work-requests' },
      { icon: FolderKanban, label: 'Projects', href: '/app/projects', testId: 'nav-projects' },
      { icon: Truck, label: 'Service Runs', href: '/app/services/runs', testId: 'nav-service-runs' },
    ],
  },
  {
    title: 'Fleet',
    items: [
      { icon: Truck, label: 'Fleet Dashboard', href: '/app/fleet', testId: 'nav-fleet' },
      { icon: Car, label: 'Assets', href: '/app/fleet/assets', testId: 'nav-fleet-assets' },
      { icon: Wrench, label: 'Maintenance', href: '/app/fleet/maintenance', testId: 'nav-fleet-maintenance' },
    ],
  },
  {
    title: 'Compliance',
    items: [
      { icon: ShieldAlert, label: 'Enforcement', href: '/app/enforcement', testId: 'nav-enforcement' },
    ],
  },
  {
    title: 'Communication',
    items: [
      { icon: MessageSquare, label: 'Messages', href: '/app/messages', testId: 'nav-messages' },
      { icon: Bell, label: 'Notifications', href: '/app/notifications', testId: 'nav-notifications' },
    ],
  },
  {
    title: 'Admin',
    items: [
      { icon: Settings, label: 'Admin', href: '/app/admin', testId: 'nav-admin' },
      { icon: BarChart3, label: 'Usage', href: '/app/admin/usage', testId: 'nav-usage' },
      { icon: ShieldCheck, label: 'Certifications', href: '/app/admin/certifications', testId: 'nav-certifications' },
      { icon: Building2, label: 'Operator', href: '/app/operator', testId: 'nav-operator' },
      { icon: Building2, label: 'Portals', href: '/app/admin/portals', testId: 'nav-portals' },
      { icon: Users, label: 'Tenants', href: '/app/admin/tenants', testId: 'nav-tenants' },
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
