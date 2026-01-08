# PROMPT — Add "View Public Site" Links Throughout Admin

**Goal:** Make it easy for admins to preview public portal sites from anywhere in the admin interface.

---

## LOCATIONS FOR "VIEW PUBLIC SITE" LINKS

### 1. Impersonation Console

On each tenant row in the Impersonation Console, add a **"View Site"** button/icon next to the "Impersonate" button.

```tsx
// In ImpersonationConsole.tsx - each tenant row

<div className="flex items-center gap-2">
  {tenant.portals?.[0] && (
    <a
      href={`/p/${tenant.portals[0].slug}`}
      target="_blank"
      rel="noopener noreferrer"
      className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded flex items-center gap-1"
      title="View public site"
    >
      <ExternalLinkIcon className="w-4 h-4" />
      View Site
    </a>
  )}
  <button onClick={() => impersonate(tenant.id)} className="...">
    Impersonate
  </button>
</div>
```

If tenant has multiple portals, show a dropdown or show the primary portal.

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

### 3. Top-Right Header (When Impersonating or in Tenant Context)

When a user is impersonating a tenant OR when viewing as a tenant user, add a **globe icon** or **"View Site"** link in the top-right header area.

```tsx
// In Header.tsx or TopNav.tsx

{currentTenant?.portals?.[0] && (
  <a
    href={`/p/${currentTenant.portals[0].slug}`}
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center gap-1 px-3 py-2 text-sm text-gray-300 hover:text-white"
    title="View your public site"
  >
    <GlobeIcon className="w-4 h-4" />
    <span className="hidden md:inline">View Site</span>
  </a>
)}
```

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

1. [ ] Impersonation Console shows "View Site" button for each tenant with a portal
2. [ ] Tenant detail panel shows "View Public Site" button
3. [ ] Top-right header shows globe icon when in tenant context
4. [ ] Portal Config page shows view links for each portal
5. [ ] All links open in new tab
6. [ ] Links work and load the public portal page

---

BEGIN.
