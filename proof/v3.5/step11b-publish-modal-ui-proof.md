# STEP 11B-FIX: Publish Modal UI Proof

**Date**: 2026-01-24  
**Component**: `client/src/components/provider/PublishRunModal.tsx`  
**Copy Tokens**: `client/src/copy/entryPointCopy.ts`

---

## 1. Copy Tokens Added

```typescript
// Rule block (STEP 11B-FIX)
'provider.publish.rule.title': 'Visible to you ≠ Published by you',
'provider.publish.rule.body': 'Visibility shows where this run may appear through the network. Publishing controls where the public can see it.',

// Portal grouping (STEP 11B-FIX)
'provider.publish.portals.tenant_owned.title': 'Your portals',
'provider.publish.portals.tenant_owned.help': 'Portals owned by your tenant.',
'provider.publish.portals.tenant_owned.empty': 'No tenant portals are available.',
'provider.publish.portals.community.title': 'Community portals',
'provider.publish.portals.community.help': 'Publishing here makes this run visible in a community feed.',
'provider.publish.portals.community.empty': 'No community portals are available for publishing.',

// Badges (STEP 11B-FIX)
'provider.publish.badge.owned': 'Owned',
'provider.publish.badge.community': 'Community',
'provider.publish.suggestions.badge.tenant_zone': 'Nearby zone',
'provider.publish.suggestions.badge.community_portal': 'Nearby community',

// Add/Added buttons (STEP 11B-FIX)
'provider.publish.suggestions.add': 'Add',
'provider.publish.suggestions.added': 'Added',

// Preview CTA (STEP 11A)
'provider.publish.preview.cta': 'Preview reach',
```

---

## 2. Portal Grouping Logic

```typescript
// Tenant Owned Portals (includes undefined source per spec)
const tenantOwnedPortals = portals
  .filter(p => p.source === 'tenant_owned' || !p.source)
  .sort((a, b) => a.name.localeCompare(b.name));

// Community Portals (strict match)
const communityPortals = portals
  .filter(p => p.source === 'community')
  .sort((a, b) => a.name.localeCompare(b.name));
```

**Key behavior**:
- `source === 'tenant_owned'` → "Your portals" section with "Owned" badge
- `source === 'community'` → "Community portals" section with "Community" badge
- `undefined` or missing source → defaults to "Your portals" (per spec)

---

## 3. Suggestions Rendering

```typescript
const isCommunityPortal = suggestion.suggestion_source === 'community_portal';

// Badge mapping
<Badge variant="outline" className="text-xs flex-shrink-0">
  {isCommunityPortal 
    ? resolve('provider.publish.suggestions.badge.community_portal')  // "Nearby community"
    : resolve('provider.publish.suggestions.badge.tenant_zone')}       // "Nearby zone"
</Badge>

// Add/Added button
<Button
  variant={isAlreadySelected ? 'ghost' : 'outline'}
  size="sm"
  onClick={() => handleSuggestionClick(suggestion)}
  disabled={isAlreadySelected}
>
  {isAlreadySelected ? (
    <>
      <Check className="w-3 h-3 mr-1" />
      {resolve('provider.publish.suggestions.added')}  // "Added"
    </>
  ) : (
    <>
      <Plus className="w-3 h-3 mr-1" />
      {resolve('provider.publish.suggestions.add')}    // "Add"
    </>
  )}
</Button>
```

**handleSuggestionClick action**:
```typescript
const handleSuggestionClick = (suggestion: Suggestion) => {
  if (!selectedPortals.includes(suggestion.portal_id)) {
    setSelectedPortals([...selectedPortals, suggestion.portal_id]);
  }
};
```

---

## 4. Rule Block UI

```typescript
{/* V3.5 STEP 11B-FIX: Rule Block */}
<div className="rounded-md border p-3 bg-muted/30" data-testid="section-rule-block">
  <div className="flex items-start gap-2">
    <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
    <div>
      <p className="text-sm font-medium" data-testid="text-rule-title">
        {resolve('provider.publish.rule.title')}
      </p>
      <p className="text-xs text-muted-foreground mt-1" data-testid="text-rule-body">
        {resolve('provider.publish.rule.body')}
      </p>
    </div>
  </div>
</div>
```

**Rendered text**:
- Title: "Visible to you ≠ Published by you"
- Body: "Visibility shows where this run may appear through the network. Publishing controls where the public can see it."

---

## 5. UI Structure (Text Capture)

```
┌─────────────────────────────────────────────────┐
│ Publish Run                                      │
├─────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────┐ │
│ │ ℹ Visible to you ≠ Published by you         │ │
│ │   Visibility shows where this run may       │ │
│ │   appear through the network. Publishing    │ │
│ │   controls where the public can see it.     │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ 💡 Suggested additional areas                    │
│ ┌─────────────────────────────────────────────┐ │
│ │ Zone Name          [Nearby zone]    [Add]   │ │
│ │ In: Portal Name                             │ │
│ │ ~5.2 km away                                │ │
│ └─────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────┐ │
│ │ Community Name  [Nearby community]  [Added] │ │
│ │ ~12.1 km away                               │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ─────────────────────────────────────────────── │
│                                                 │
│ 🌐 Visibility                                    │
│   Select portals where this run should appear   │
│                                                 │
│ YOUR PORTALS                                    │
│ ☑ Woods End Landing Portal        [Owned]      │
│ ☐ Other Tenant Portal             [Owned]      │
│                                                 │
│ COMMUNITY PORTALS                               │
│   Publishing here makes this run visible in a   │
│   community feed.                               │
│ ☑ Bamfield Community              [Community]  │
│ ☐ Other Community Portal          [Community]  │
│                                                 │
│ 👁 Also visible in                               │
│   Direct: Portal A                [Direct]     │
│   Via: Portal B                   [Via rollup] │
│                                                 │
│              [Cancel]  [Publish Run]            │
└─────────────────────────────────────────────────┘
```

---

## 6. Test IDs Added

| Test ID | Purpose |
|---------|---------|
| `section-rule-block` | Rule block container |
| `text-rule-title` | Rule title text |
| `text-rule-body` | Rule body text |
| `section-suggestions` | Suggestions section |
| `suggestion-{id}` | Individual suggestion item |
| `badge-source-{id}` | Source badge on suggestion |
| `button-add-suggestion-{id}` | Add/Added button |
| `section-portals-tenant-owned` | Tenant owned portals group |
| `section-portals-community` | Community portals group |
| `text-tenant-owned-title` | "Your portals" header |
| `text-community-title` | "Community portals" header |
| `badge-owned-{id}` | "Owned" badge on portal |
| `badge-community-{id}` | "Community" badge on portal |

---

## 7. Compliance Checklist

| Requirement | Status |
|------------|--------|
| Rule block at top | ✅ |
| Portals grouped by source | ✅ |
| Undefined source → tenant_owned | ✅ |
| Suggestion badges (zone/community) | ✅ |
| Add/Added buttons on suggestions | ✅ |
| Copy tokens (no hardcoded strings) | ✅ |
| No forbidden terms (booking, contractor, calendar) | ✅ |
| shadcn/ui components used | ✅ |

---

## Certification

**STEP 11B-FIX UI Implementation**: ✅ COMPLETE

All UI enhancements implemented per spec:
- Rule block explains visibility ≠ publishing
- Portal grouping with tenant_owned/community sections
- Suggestion badges indicate source type
- Add/Added action buttons work correctly
- All text uses copy token system
