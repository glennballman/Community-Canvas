# V3.5 Nav Wiring Targets

**Generated:** 2026-01-20  
**Goal:** Identify exact files and changes to wire final nav config

---

## Current Navigation Architecture

### Source Files

| File | Purpose | Status |
|------|---------|--------|
| `client/src/lib/routes/v3Nav.ts` | Authoritative V3_NAV definition | ✅ Defined, not wired |
| `client/src/layouts/TenantAppLayout.tsx` | Sidebar renderer | ❌ Uses legacy arrays |
| `client/src/layouts/PlatformAdminLayout.tsx` | Platform admin sidebar | ✅ Uses ADMIN_NAV |
| `client/src/layouts/PublicPortalLayout.tsx` | Public portal tabs | ✅ Correct |

### Current Implementation

**TenantAppLayout.tsx (Lines 62-97):**
```typescript
const COMMUNITY_NAV: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/app/dashboard' },
  { icon: Phone, label: 'Availability', href: '/app/availability' },
  // ... 12 more items
];

const BUSINESS_NAV: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/app/dashboard' },
  { icon: Package, label: 'Assets', href: '/app/assets' },
  // ... 9 more items
];

const INDIVIDUAL_NAV: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/app/dashboard' },
  { icon: MessageSquare, label: 'Messages', href: '/app/messages' },
  { icon: Settings, label: 'Settings', href: '/app/settings' },
];
```

**Navigation Selection (Lines 230-244):**
```typescript
function getNavItems(): NavItem[] {
  if (!currentTenant) return [];
  
  switch (currentTenant.tenant_type) {
    case 'community':
    case 'government':
      return COMMUNITY_NAV;
    case 'business':
      return BUSINESS_NAV;
    case 'individual':
      return INDIVIDUAL_NAV;
    default:
      return BUSINESS_NAV;
  }
}
```

---

## Wiring Plan

### Step 1: Update v3Nav.ts

**File:** `client/src/lib/routes/v3Nav.ts`

**Changes:**
1. Add new FINAL_NAV export with all sections
2. Add missing routes (N3 Attention, Circles, Assets & Inventory, CRM)
3. Add `hiddenInProduction` flag for Dev section

**Lines to modify:** Entire file (new export)

### Step 2: Modify TenantAppLayout.tsx

**File:** `client/src/layouts/TenantAppLayout.tsx`

**Changes:**

1. **Remove legacy nav arrays** (Lines 62-97)
   - Delete COMMUNITY_NAV
   - Delete BUSINESS_NAV
   - Delete INDIVIDUAL_NAV

2. **Import FINAL_NAV** (Top of file)
   ```typescript
   import { FINAL_NAV, NavSection } from '@/lib/routes/v3Nav';
   ```

3. **Replace getNavItems()** (Lines 230-244)
   ```typescript
   function getNavSections(): NavSection[] {
     // Single-user mode: show everything
     return FINAL_NAV.filter(section => 
       !section.hiddenInProduction || process.env.NODE_ENV !== 'production'
     );
   }
   ```

4. **Update nav rendering** (Lines 500-556)
   - Change from flat item list to sectioned rendering
   - Add section headers between groups
   - Preserve active state logic

### Step 3: Update Sidebar Rendering

**Current rendering (simplified):**
```tsx
<nav style={styles.nav}>
  {navItems.map((item) => (
    <NavLink key={item.href} to={item.href}>
      <item.icon size={20} />
      {!sidebarCollapsed && <span>{item.label}</span>}
    </NavLink>
  ))}
</nav>
```

**Proposed rendering:**
```tsx
<nav style={styles.nav}>
  {navSections.map((section) => (
    <div key={section.title}>
      {!sidebarCollapsed && (
        <div style={styles.sectionTitle}>{section.title}</div>
      )}
      {section.items.map((item) => (
        <NavLink key={item.href} to={item.href} data-testid={item.testId}>
          <item.icon size={20} />
          {!sidebarCollapsed && <span>{item.label}</span>}
        </NavLink>
      ))}
    </div>
  ))}
</nav>
```

---

## Minimal Patch Summary

| File | Action | Lines |
|------|--------|-------|
| `v3Nav.ts` | Add FINAL_NAV export | +80 lines |
| `TenantAppLayout.tsx` | Remove legacy arrays | -40 lines |
| `TenantAppLayout.tsx` | Import FINAL_NAV | +1 line |
| `TenantAppLayout.tsx` | Replace getNavItems() | ~10 lines |
| `TenantAppLayout.tsx` | Update nav rendering | ~30 lines |

**Net change:** ~+70 lines

---

## Files NOT to Modify

| File | Reason |
|------|--------|
| `PlatformAdminLayout.tsx` | Already correct (ADMIN_NAV) |
| `PublicPortalLayout.tsx` | Already correct (tabs) |
| `App.tsx` | Routes are correct |
| Server routes | Backend unchanged |

---

## Testing Checklist

After wiring:

1. [ ] All 40 nav items visible in sidebar
2. [ ] Section headers render correctly
3. [ ] Collapsed sidebar shows icons only
4. [ ] Active state highlights current route
5. [ ] Messages badge still shows unread count
6. [ ] Dev section hidden in production (if flag set)
7. [ ] Platform Admin link still in footer
8. [ ] My Places link still in footer
9. [ ] All data-testid attributes present

---

## Rollback Plan

If issues arise:
1. Revert `TenantAppLayout.tsx` to previous version
2. Keep v3Nav.ts changes (non-breaking)
3. Resume legacy nav arrays temporarily

---

## Timeline Estimate

| Task | Time |
|------|------|
| Update v3Nav.ts | 15 min |
| Modify TenantAppLayout.tsx | 30 min |
| Test all sections | 20 min |
| Fix edge cases | 15 min |
| **Total** | **~1 hour** |

---

## Dependencies

- No database changes
- No API changes
- No new packages
- Pure frontend change
