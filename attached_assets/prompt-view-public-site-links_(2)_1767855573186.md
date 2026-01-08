# PROMPT — Add "View Public Site" Links Throughout Admin

**Goal:** Make it easy for admins to preview public portal sites from anywhere in the admin interface.

---

## LOCATIONS FOR "VIEW PUBLIC SITE" LINKS

**⚠️ IMPORTANT: Do NOT put "View Site" in the yellow/orange impersonation banner.** That banner is only for impersonation controls (tenant name, timer, exit button). The View Site link belongs in the locations below.

### 1. Impersonation Console Page (Next to Impersonate Buttons)

On the Impersonation Console page (`/admin/impersonation`), add a **"View Site"** button/link **to the LEFT of each purple "Impersonate" button** for every tenant row.

```tsx
// In ImpersonationConsole.tsx - each tenant row

<div className="flex items-center justify-between p-4 ...">
  <div className="flex items-center gap-3">
    {/* Tenant icon and info */}
    <div className="...">
      <span>{tenant.name}</span>
      <span className="text-sm text-gray-500">{tenant.slug} • {tenant.type}</span>
    </div>
  </div>
  
  {/* Buttons on the right - View Site THEN Impersonate */}
  <div className="flex items-center gap-2">
    {/* View Site button - LEFT of Impersonate */}
    {tenant.portals?.[0] && (
      <a
        href={`/p/${tenant.portals[0].slug}`}
        target="_blank"
        rel="noopener noreferrer"
        className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded flex items-center gap-1.5"
      >
        <ExternalLinkIcon className="w-4 h-4" />
        View Site
      </a>
    )}
    
    {/* Impersonate button - stays purple on the right */}
    <button 
      onClick={() => impersonate(tenant.id)} 
      className="px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-500 text-white rounded"
    >
      Impersonate
    </button>
  </div>
</div>
```

If tenant has multiple portals, either show the primary one or add a small dropdown.

### 2. Tenant Detail Panel (Right Side)

When you click on a tenant and see the detail panel (like "Bamfield Adventure Center" in the screenshot), add a **"View Public Site"** button below the tenant info.

```tsx
// In TenantDetailPanel.tsx

<div className="space-y-3 mt-4">
  <Button variant="outline" className="w-full" onClick={() => setEditOpen(true)}>
    <EditIcon className="w-4 h-4 mr-2" />
    Edit Tenant
  </Button>
  
  <Button variant="outline" className="w-full" onClick={() => setMembersOpen(true)}>
    <UsersIcon className="w-4 h-4 mr-2" />
    Manage Members
  </Button>
  
  {/* NEW: View Public Site button */}
  {tenant.portals?.length > 0 && (
    <a
      href={`/p/${tenant.portals[0].slug}`}
      target="_blank"
      rel="noopener noreferrer"
      className="w-full"
    >
      <Button variant="outline" className="w-full">
        <ExternalLinkIcon className="w-4 h-4 mr-2" />
        View Public Site
      </Button>
    </a>
  )}
</div>
```

### 3. Tenant's Own Navigation (NOT the impersonation banner)

**IMPORTANT:** Do NOT put this in the yellow impersonation banner. That banner is only for impersonation controls.

Add a **"View My Site"** link in the **tenant's sidebar or header** so actual tenant users (not just impersonating admins) can see their public site.

```tsx
// In TenantSidebar.tsx or TenantHeader.tsx (the tenant's own nav, NOT impersonation banner)

// Option A: In the sidebar, near the top
<nav className="...">
  {currentTenant?.portals?.[0] && (
    <a
      href={`/p/${currentTenant.portals[0].slug}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded"
    >
      <GlobeIcon className="w-4 h-4" />
      View My Public Site
    </a>
  )}
  {/* rest of nav items */}
</nav>

// Option B: In the header, top-right area (but NOT in impersonation banner)
<header className="...">
  {/* ... other header content ... */}
  {currentTenant?.portals?.[0] && (
    <a
      href={`/p/${currentTenant.portals[0].slug}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1 px-3 py-2 text-sm text-blue-400 hover:text-blue-300"
    >
      <ExternalLinkIcon className="w-4 h-4" />
      View Site
    </a>
  )}
</header>
```

**Why this matters:** Real tenant users (not just admins impersonating) need to see and access their public site. Putting it only in the impersonation banner means actual business owners can't find it.

### 4. Portal Config Page

On the Portal Config page, each portal row should have a "View" link that opens the public site.

```tsx
// In PortalConfig.tsx - each portal row

<a
  href={`/p/${portal.slug}`}
  target="_blank"
  rel="noopener noreferrer"
  className="text-blue-400 hover:text-blue-300"
>
  <ExternalLinkIcon className="w-4 h-4" />
</a>
```

---

## DATA REQUIREMENTS

To show these links, we need to know the portal slug for each tenant. 

### Option A: Eager load portals with tenants

```typescript
// When fetching tenants, include their portals
const tenants = await db.query.tenants.findMany({
  with: {
    portals: {
      where: eq(portals.status, 'active'),
      orderBy: [desc(portals.is_primary)],
      limit: 3
    }
  }
});
```

### Option B: Add primary_portal_slug to tenant

```sql
-- Add convenience column
ALTER TABLE cc_tenants ADD COLUMN primary_portal_slug TEXT;

-- Update from portals
UPDATE cc_tenants t
SET primary_portal_slug = (
  SELECT slug FROM portals p 
  WHERE p.owning_tenant_id = t.id 
  AND p.status = 'active'
  ORDER BY p.created_at
  LIMIT 1
);
```

---

## URL STRUCTURE

The public site URL pattern is: `/p/{portal_slug}`

Examples:
- `/p/save-paradise-parking`
- `/p/woods-end-landing`
- `/p/bamfield-adventure`

All links should open in a **new tab** (`target="_blank"`).

---

## ICONS TO USE

Use consistent icons:
- `ExternalLink` (lucide-react) for "opens in new tab"
- `Globe` (lucide-react) for "public site"

---

## VERIFICATION

After implementation:

1. [ ] **REMOVE** any "View Site" link from the yellow/orange impersonation banner
2. [ ] Impersonation Console page shows "View Site" button TO THE LEFT of each purple "Impersonate" button
3. [ ] Tenant detail panel shows "View Public Site" button
4. [ ] Tenant's own sidebar/header shows "View My Site" link (visible to actual tenant users, not just impersonators)
5. [ ] Portal Config page shows view links for each portal
6. [ ] All links open in new tab
7. [ ] Links work and load the public portal page

---

BEGIN.
