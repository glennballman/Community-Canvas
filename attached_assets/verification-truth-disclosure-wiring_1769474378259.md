# Community Canvas V3.5 — Verification Prompt
## Truth/Disclosure ↔ Reservation Engine Wiring Audit

**Purpose:** Diagnose whether the Truth vs Disclosure system is properly wired to the Reservation Engine and identify any gaps.

**Scope:** READ-ONLY audit. Do not modify any files. Report findings only.

---

## PHASE 1: Locate Core Services

Search for and report the existence and location of these files:

### Visibility/Disclosure Services
```
Find these files and report: EXISTS / MISSING / PARTIAL

□ server/services/visibilityService.ts
□ server/services/disclosureService.ts (alternate name)
□ shared/types/noCountsGuard.ts
```

If `visibilityService.ts` exists, report:
1. What functions are exported?
2. Does it have `getDisclosureSignal()` or equivalent?
3. Does it have `getVisibilityPolicy()` or equivalent?

### Reservation/Availability Services
```
Find these files and report: EXISTS / MISSING / PARTIAL

□ server/services/availabilityService.ts
□ server/services/reservationService.ts
□ server/routes/public.ts (or publicReservation.ts)
□ server/routes/availability.ts
```

---

## PHASE 2: Check Database Tables

Run these queries and report results:

```sql
-- Check visibility policy tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%visibility%';

-- Check if policies are seeded
SELECT COUNT(*) as policy_count FROM cc_asset_visibility_policies;

-- Check visibility profiles table
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'cc_visibility_profiles';

-- Check if profiles are seeded
SELECT COUNT(*) as profile_count FROM cc_visibility_profiles;

-- List policy modes in use
SELECT DISTINCT policy_mode FROM cc_asset_visibility_policies;
```

Report:
- Which tables exist
- How many policies/profiles are seeded
- What policy modes are configured

---

## PHASE 3: Trace the Availability Flow

### 3A: Public Availability Endpoint

Find the public availability endpoint. It's likely one of:
- `GET /api/public/portals/:slug/availability`
- `GET /api/public/availability`
- `POST /api/public/carts/:id/availability`

Once found, trace the code path and answer:

1. **Does it import visibilityService?**
   ```typescript
   // Looking for something like:
   import { getDisclosureSignal } from '../services/visibilityService';
   ```

2. **Does it call disclosure functions?**
   ```typescript
   // Looking for calls like:
   const disclosed = await getDisclosureSignal(assetId, truthSignal, ...);
   // OR
   const policy = await getVisibilityPolicy(facilityId);
   ```

3. **Does it filter results by channel?**
   ```typescript
   // Looking for channel-aware logic:
   if (channel === 'public') {
     // Apply disclosure
   } else if (channel === 'chamber_desk' || channel === 'internal_ops') {
     // Show truth
   }
   ```

4. **Does it prevent count leaks?**
   ```typescript
   // Looking for:
   import { assertNoCountLikeKeysDeep } from '../../shared/types/noCountsGuard';
   // OR response filtering that removes count fields
   ```

### 3B: Cart Item Addition

Find where cart items are added. Likely:
- `POST /api/public/carts/:id/items`
- Function in `reservationService.ts` or `cartService.ts`

Answer:
1. When adding an item, does it check disclosure policy?
2. Or does it use truth layer (allowing any valid asset)?
3. Is there a distinction between public cart and operator cart?

---

## PHASE 4: Trace Reservation Creation

Find where reservations are created. Likely:
- `POST /api/public/carts/:id/checkout`
- `POST /api/reservations`
- Function `createReservation()` in a service

Answer:
1. **Does reservation creation use TRUTH or DISCLOSURE?**
   - CORRECT: Reservations should use TRUTH (never blocked by disclosure)
   - WRONG: If it checks disclosure before allowing reservation

2. **Is there allocation logic?**
   - Does it call an allocation service?
   - Does it check real availability (truth)?

---

## PHASE 5: Check for UI Components

Search the client code for visibility/disclosure UI:

```
Find in client/src/:

□ Any file containing "visibility" in name
□ Any file containing "disclosure" in name
□ Any component with "scarcity" in name
□ Settings pages that might configure disclosure
```

Look for routes like:
- `/app/settings/visibility`
- `/app/settings/disclosure`
- `/app/settings/participation`
- `/app/assets/:id/visibility`

Report what exists and what's missing.

---

## PHASE 6: Verify Scarcity Band Display

Search for where scarcity bands are displayed to users:

```typescript
// Looking for UI that shows:
// "Available" | "Limited" | "Scarce" | "Call to Confirm"

// NOT looking for (these would be leaks):
// "3 available" | "74 remaining" | actual counts
```

Find in:
- `AvailabilityResults.tsx` or similar
- `AvailabilityResultCard.tsx`
- Any search results component

Answer:
1. Are scarcity bands displayed?
2. Are actual counts hidden from public views?
3. Do operator views show real counts?

---

## PHASE 7: Generate Wiring Report

Create a summary table:

```
TRUTH/DISCLOSURE → RESERVATION ENGINE WIRING REPORT
═══════════════════════════════════════════════════

DATABASE LAYER
├── cc_asset_visibility_policies:  [EXISTS/MISSING] ([N] records)
├── cc_visibility_profiles:        [EXISTS/MISSING] ([N] records)
└── cc_visibility_profile_windows: [EXISTS/MISSING] ([N] records)

SERVICE LAYER
├── visibilityService.ts:          [EXISTS/MISSING]
│   ├── getDisclosureSignal():     [EXISTS/MISSING]
│   ├── getVisibilityPolicy():     [EXISTS/MISSING]
│   └── checkSeasonalOverride():   [EXISTS/MISSING]
├── availabilityService.ts:        [EXISTS/MISSING]
│   └── Calls visibilityService:   [YES/NO]
└── noCountsGuard.ts:              [EXISTS/MISSING]

API LAYER
├── Public availability endpoint:  [EXISTS/MISSING]
│   ├── Uses disclosure layer:     [YES/NO]
│   ├── Filters by channel:        [YES/NO]
│   └── Prevents count leaks:      [YES/NO]
├── Cart item addition:            [EXISTS/MISSING]
│   └── Respects disclosure:       [YES/NO/N/A]
└── Reservation creation:          [EXISTS/MISSING]
    └── Uses truth layer:          [YES/NO]

UI LAYER
├── Visibility settings page:      [EXISTS/MISSING]
├── Participation mode selector:   [EXISTS/MISSING]
├── Seasonal rules editor:         [EXISTS/MISSING]
├── Scarcity bands in results:     [YES/NO]
└── Count leak in public UI:       [YES/NO] ⚠️

CRITICAL WIRING GAPS
════════════════════
1. [List any missing connections]
2. [List any incomplete implementations]
3. [List any policy violations found]
```

---

## PHASE 8: Specific File Checks

If you find the key files, report these specific details:

### From visibilityService.ts (if exists):
```
- Line count: ___
- Exports: [list all]
- Database queries: [list tables accessed]
- Called by: [list files that import it]
```

### From availabilityService.ts (if exists):
```
- Does getPublicAvailability() exist? [YES/NO]
- Does getOperatorAvailability() exist? [YES/NO]
- Does it import visibilityService? [YES/NO]
- Does it apply scarcity bands? [YES/NO]
```

### From public reservation routes:
```
- Endpoint for availability search: [path]
- Does it pass channel parameter? [YES/NO]
- Does it call disclosure functions? [YES/NO]
```

---

## DELIVERABLE

Return a comprehensive report with:

1. **Wiring Status Table** (from Phase 7)
2. **Gap Analysis** - What's missing or disconnected
3. **Risk Assessment** - Could counts leak to public?
4. **Recommendations** - What needs to be built/wired

Format as a clear diagnostic report I can review.

**DO NOT MODIFY ANY FILES. This is a read-only audit.**
