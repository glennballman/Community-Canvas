# V3.5 Final Navigation Proposal

**Generated:** 2026-01-20  
**Mode:** Single-user (Glenn as sole operator)  
**Goal:** Expose all features with minimal gating

---

## Design Principles

1. **All features visible** - No hiding based on tenant type
2. **Clear section labels** - Distinguish Jobs vs Work Requests vs Service Runs
3. **Flat hierarchy** - Minimize nesting, maximize discoverability
4. **Dev optional** - Dev section can be hidden in production
5. **Single nav source** - Replaces tenant-type-specific arrays

---

## Final Left-Nav Structure

```
┌─────────────────────────────────────┐
│  🌐 Community Canvas               │
│  ────────────────────────────────── │
│                                     │
│  PERSONAL                           │
│  ├─ 📊 Dashboard         /app       │
│  ├─ ✈️  My Trips          /app/participant/trips │
│  └─ 📄 My Applications   /app/participant/applications │
│                                     │
│  OPERATIONS                         │
│  ├─ 📅 Operations Board  /app/ops   │
│  ├─ ✨ Housekeeping      /app/ops/housekeeping │
│  ├─ ⚠️  Incidents        /app/ops/incidents │
│  └─ 🚨 N3 Attention      /app/n3/attention │
│                                     │
│  RESERVATIONS                       │
│  ├─ 📅 All Reservations  /app/reservations │
│  ├─ 🚗 Parking           /app/parking │
│  ├─ ⚓ Marina            /app/marina │
│  └─ 🏠 Hospitality       /app/hospitality │
│                                     │
│  WORK                               │
│  ├─ 💼 Job Postings      /app/jobs  │
│  ├─ 📋 Work Requests     /app/work-requests │
│  ├─ 📁 Projects          /app/projects │
│  └─ 🚚 Service Runs      /app/services/runs │
│                                     │
│  FLEET                              │
│  ├─ 🚛 Fleet Dashboard   /app/fleet │
│  ├─ 🚗 Fleet Assets      /app/fleet/assets │
│  └─ 🔧 Maintenance       /app/fleet/maintenance │
│                                     │
│  ASSETS & INVENTORY                 │
│  ├─ 📦 Assets            /app/assets │
│  ├─ 📊 Availability      /app/availability │
│  └─ 📂 Directory         /app/directory │
│                                     │
│  CRM                                │
│  ├─ 📍 Places            /app/crm/places │
│  ├─ 👥 People            /app/crm/people │
│  └─ 🏢 Organizations     /app/crm/orgs │
│                                     │
│  COMMUNICATION                      │
│  ├─ 💬 Messages          /app/messages │
│  ├─ 🔔 Notifications     /app/notifications │
│  └─ ⭕ Circles           /app/circles │
│                                     │
│  COMPLIANCE                         │
│  └─ 🛡️ Enforcement       /app/enforcement │
│                                     │
│  ADMIN                              │
│  ├─ ⚙️ Admin Home        /app/admin │
│  ├─ 👤 Roles             /app/admin/roles │
│  ├─ ⚙️ Settings          /app/admin/settings │
│  ├─ 💰 Folios            /app/admin/folios │
│  ├─ 📊 Usage             /app/admin/usage │
│  ├─ ✅ Certifications    /app/admin/certifications │
│  ├─ 🏢 Operator          /app/operator │
│  └─ 🌐 Portals           /app/admin/portals │
│                                     │
│  PLATFORM                           │
│  ├─ 🏢 All Tenants       /app/platform/tenants │
│  ├─ 📈 Analytics         /app/platform/analytics │
│  └─ 🔍 System Explorer   /admin/system-explorer │
│                                     │
│  DEV (optional)                     │
│  ├─ 🖼️ Media Dev         /app/dev/media │
│  └─ 🧪 Seeds             /app/dev/seeds │
│                                     │
│  ────────────────────────────────── │
│  ← My Places             /app       │
│  ⚡ Platform Admin       /admin     │
│  👤 Glenn (logout)                  │
└─────────────────────────────────────┘
```

---

## Navigation Definition (TypeScript)

```typescript
export const FINAL_NAV: NavSection[] = [
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
      { icon: Zap, label: 'N3 Attention', href: '/app/n3/attention', testId: 'nav-n3-attention' },
    ],
  },
  {
    title: 'Reservations',
    items: [
      { icon: Calendar, label: 'All Reservations', href: '/app/reservations', testId: 'nav-reservations' },
      { icon: Car, label: 'Parking', href: '/app/parking', testId: 'nav-parking' },
      { icon: Anchor, label: 'Marina', href: '/app/marina', testId: 'nav-marina' },
      { icon: Home, label: 'Hospitality', href: '/app/hospitality', testId: 'nav-hospitality' },
    ],
  },
  {
    title: 'Work',
    items: [
      { icon: Briefcase, label: 'Job Postings', href: '/app/jobs', testId: 'nav-jobs' },
      { icon: ClipboardList, label: 'Work Requests', href: '/app/work-requests', testId: 'nav-work-requests' },
      { icon: FolderKanban, label: 'Projects', href: '/app/projects', testId: 'nav-projects' },
      { icon: Truck, label: 'Service Runs', href: '/app/services/runs', testId: 'nav-service-runs' },
    ],
  },
  {
    title: 'Fleet',
    items: [
      { icon: Truck, label: 'Fleet Dashboard', href: '/app/fleet', testId: 'nav-fleet' },
      { icon: Car, label: 'Fleet Assets', href: '/app/fleet/assets', testId: 'nav-fleet-assets' },
      { icon: Wrench, label: 'Maintenance', href: '/app/fleet/maintenance', testId: 'nav-fleet-maintenance' },
    ],
  },
  {
    title: 'Assets & Inventory',
    items: [
      { icon: Package, label: 'Assets', href: '/app/assets', testId: 'nav-assets' },
      { icon: BarChart, label: 'Availability', href: '/app/availability', testId: 'nav-availability' },
      { icon: Building2, label: 'Directory', href: '/app/directory', testId: 'nav-directory' },
    ],
  },
  {
    title: 'CRM',
    items: [
      { icon: MapPin, label: 'Places', href: '/app/crm/places', testId: 'nav-places' },
      { icon: Users, label: 'People', href: '/app/crm/people', testId: 'nav-people' },
      { icon: Building2, label: 'Organizations', href: '/app/crm/orgs', testId: 'nav-orgs' },
    ],
  },
  {
    title: 'Communication',
    items: [
      { icon: MessageSquare, label: 'Messages', href: '/app/messages', testId: 'nav-messages' },
      { icon: Bell, label: 'Notifications', href: '/app/notifications', testId: 'nav-notifications' },
      { icon: Circle, label: 'Circles', href: '/app/circles', testId: 'nav-circles' },
    ],
  },
  {
    title: 'Compliance',
    items: [
      { icon: ShieldAlert, label: 'Enforcement', href: '/app/enforcement', testId: 'nav-enforcement' },
    ],
  },
  {
    title: 'Admin',
    items: [
      { icon: Settings, label: 'Admin Home', href: '/app/admin', testId: 'nav-admin' },
      { icon: UserCog, label: 'Roles', href: '/app/admin/roles', testId: 'nav-roles' },
      { icon: Settings, label: 'Settings', href: '/app/admin/settings', testId: 'nav-settings' },
      { icon: Wallet, label: 'Folios', href: '/app/admin/folios', testId: 'nav-folios' },
      { icon: BarChart3, label: 'Usage', href: '/app/admin/usage', testId: 'nav-usage' },
      { icon: ShieldCheck, label: 'Certifications', href: '/app/admin/certifications', testId: 'nav-certifications' },
      { icon: Building2, label: 'Operator', href: '/app/operator', testId: 'nav-operator' },
      { icon: Globe, label: 'Portals', href: '/app/admin/portals', testId: 'nav-portals' },
    ],
  },
  {
    title: 'Platform',
    items: [
      { icon: Building2, label: 'All Tenants', href: '/app/platform/tenants', testId: 'nav-platform-tenants' },
      { icon: BarChart3, label: 'Analytics', href: '/app/platform/analytics', testId: 'nav-platform-analytics' },
      { icon: Search, label: 'System Explorer', href: '/admin/system-explorer', testId: 'nav-system-explorer' },
    ],
  },
  {
    title: 'Dev',
    hiddenInProduction: true,
    items: [
      { icon: Image, label: 'Media Dev', href: '/app/dev/media', testId: 'nav-dev-media' },
    ],
  },
];
```

---

## Label Clarifications

| Old/Confusing | New (Clear) | Meaning |
|---------------|-------------|---------|
| Jobs | Job Postings | Employment advertisements |
| Work Requests | Work Requests | Contractor bid requests |
| Service Runs | Service Runs | Bundled service trips |
| Operations | Operations Board | 15-minute scheduling grid |
| Tenants (admin) | Removed | Use Platform → All Tenants |
| Settings (sidebar) | Admin Home | Full admin suite |

---

## Route Count by Section

| Section | Routes |
|---------|--------|
| Personal | 3 |
| Operations | 4 |
| Reservations | 4 |
| Work | 4 |
| Fleet | 3 |
| Assets & Inventory | 3 |
| CRM | 3 |
| Communication | 3 |
| Compliance | 1 |
| Admin | 8 |
| Platform | 3 |
| Dev | 1 |
| **Total** | **40** |

---

## Comparison: Current vs Proposed

### Current State
- 3 tenant-type nav arrays (COMMUNITY_NAV, BUSINESS_NAV, INDIVIDUAL_NAV)
- 42 routes without nav entries
- Jobs, Fleet, Circles, Admin hidden

### Proposed State
- 1 unified nav array (FINAL_NAV)
- 0 routes without nav entries (all exposed)
- All subsystems discoverable

---

## Implementation Notes

1. **Single source:** Replace all nav arrays with FINAL_NAV
2. **No role gating:** All sections always visible
3. **Dev gating:** Optional `hiddenInProduction` flag
4. **Footer items:** Keep "My Places" and "Platform Admin" links
5. **Badges:** Preserve unread count on Messages
