# Prompt C — Search + Results Implementation Proof

**Date:** 2026-01-27  
**Scope:** Experience Bamfield Search page, Results list, V3.5 reserve handoff

## 1. Routes Added/Modified

### New Route (App.tsx line 334)

```tsx
<Route path="/p/:portalSlug/search" element={<PortalSearchPage />} />
```

**Location:** `client/src/App.tsx`  
**Line:** 334

### Import Added (App.tsx line 263)

```tsx
import PortalSearchPage from './pages/public/PortalSearchPage';
```

## 2. Files Created

| File | Purpose |
|------|---------|
| `client/src/pages/public/PortalSearchPage.tsx` | Search page with date picker, category tabs, results list |

**Lines:** ~460 total

## 3. Files Modified

| File | Changes |
|------|---------|
| `client/src/App.tsx` | Added route and import for PortalSearchPage |
| `client/src/pages/public/PortalReservePage.tsx` | Added query param parsing for start/end/partySize prefill |
| `client/src/pages/public/PortalHomePage.tsx` | Updated ctaHref logic to support 'search' action |

## 4. How Search Calls Availability Endpoint

**Component:** `PortalSearchPage.tsx`  
**Query:** Lines 310-314

```tsx
const { data: availability, isLoading: availabilityLoading } = useQuery<AvailabilityResult>({
  queryKey: [`/api/public/cc_portals/${portalSlug}/availability?start=${startStr}&end=${endStr}`],
  enabled: !!portalSlug && !!startDate && !!endDate,
});
```

**Endpoint Called:**
```
GET /api/public/cc_portals/experience-bamfield/availability?start=2026-01-28&end=2026-01-29
```

## 5. Category Tab Filtering

Results are filtered client-side by asset_type based on active category tab:

| Category | Asset Types |
|----------|-------------|
| Accommodations | accommodation, cabin, cottage, lodge, room |
| Parking | parking, rv_site, campsite |
| Moorage | moorage, slip, dock, marina |
| Activities | activity, tour, rental, experience |

**Implementation:** Lines 289-292

```tsx
const categoryAssetTypes = CATEGORY_CONFIG[activeCategory].assetTypes;
const filteredAssets = results.assets.filter(asset => 
  categoryAssetTypes.includes(asset.asset_type)
);
```

## 6. Reserve Handoff URL

**Component:** `ResultCard` in PortalSearchPage.tsx  
**Lines:** 168-172

```tsx
const handleReserve = () => {
  const startISO = startDate.toISOString().split('T')[0];
  const endISO = endDate.toISOString().split('T')[0];
  const url = `/p/${portalSlug}/reserve/${asset.asset_id}?start=${startISO}&end=${endISO}${partySize > 0 ? `&partySize=${partySize}` : ''}`;
  navigate(url);
};
```

**Exact Handoff URL Pattern:**
```
/p/experience-bamfield/reserve/<assetId>?start=2026-01-28&end=2026-01-29&partySize=2
```

## 7. Query Param Parsing in PortalReservePage

**File:** `client/src/pages/public/PortalReservePage.tsx`  
**Lines:** 407-433

```tsx
const initialDates = useMemo(() => {
  const startParam = searchParams.get('start');
  const endParam = searchParams.get('end');
  const partySizeParam = searchParams.get('partySize');
  
  let start: Date | undefined;
  let end: Date | undefined;
  
  if (startParam) {
    const parsed = new Date(startParam);
    if (!isNaN(parsed.getTime())) {
      start = parsed;
    }
  }
  if (endParam) {
    const parsed = new Date(endParam);
    if (!isNaN(parsed.getTime())) {
      end = parsed;
    }
  }
  
  return {
    start: start || addDays(new Date(), 1),
    end: end || addDays(new Date(), 2),
    partySize: partySizeParam ? parseInt(partySizeParam, 10) || 0 : 0
  };
}, [searchParams]);
```

**Imports Added:**
- `useSearchParams` from react-router-dom
- `useMemo` from react

## 8. Homepage CTA Update

**File:** `client/src/pages/public/PortalHomePage.tsx`  
**Lines:** 107-113

```tsx
const ctaHref = cta?.action === 'reserve' 
  ? `/p/${portalSlug}/reserve` 
  : cta?.action === 'search'
  ? `/p/${portalSlug}/search`
  : cta?.action === 'quote'
  ? `/p/${portalSlug}/quote`
  : `/p/${portalSlug}/search`;
```

Default now falls through to `/search` if no action specified.

**Database Update:**
```sql
UPDATE cc_portals
SET site_config = jsonb_set(
  site_config,
  '{hero,cta}',
  '{"label": "Check Availability", "action": "search"}'::jsonb
)
WHERE slug = 'experience-bamfield';
```

## 9. Component Structure

```
PortalSearchPage
├── DateRangePicker (start/end date selection)
├── Party Size Input
├── Category Tabs (Accommodations, Parking, Moorage, Activities)
└── ResultsList
    └── ResultCard (per asset)
        └── Reserve Button → navigate to /p/:portalSlug/reserve/:assetId
```

## 10. Data Flow

```
1. User visits /p/experience-bamfield/search
2. DateRangePicker sets start/end dates
3. useQuery fetches GET /api/public/cc_portals/experience-bamfield/availability?start=...&end=...
4. Results filtered by active category tab
5. User clicks "Reserve" on a result card
6. Navigate to /p/experience-bamfield/reserve/<assetId>?start=...&end=...&partySize=...
7. PortalReservePage parses query params and pre-fills dates
8. Availability query auto-runs with pre-filled dates
```
