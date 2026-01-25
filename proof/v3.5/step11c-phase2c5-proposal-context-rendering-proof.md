# STEP 11C Phase 2C-5: Proposal Context Rendering Hooks

**Date:** 2026-01-25  
**Status:** CERTIFIED  
**Phase:** 2C-5 (Proposal Context Rendering)

---

## Objective

Make schedule proposal `proposal_context` references useful and navigable via read-only rendering hooks with:
- Policy gating (no render when `allow_proposal_context=false`)
- No UUID leakage (masked IDs, disclosure toggle, clipboard copy)

---

## A) Files Changed

| File | Change |
|------|--------|
| `client/src/components/ProposalContextInline.tsx` | NEW - Shared component for policy-gated context display |
| `client/src/copy/entryPointCopy.ts` | UPDATED - Added 28 copy tokens for provider/stakeholder namespaces |
| `client/src/pages/app/runs/RunStakeholderViewPage.tsx` | UPDATED - Replaced inline context with ProposalContextInline |
| `client/src/pages/app/provider/ProviderRunDetailPage.tsx` | UPDATED - Added ProposalContextInline to schedule proposal dialog |

---

## B) UI States

### When `allow_proposal_context=true`:

**Initial Render:**
- Shows "Context attached" header label
- Displays type chips (Quote Draft, Estimate, Bid, Reservation, Scope Option)
- "Show IDs" button visible
- NO raw UUIDs displayed

**After Disclosure (Show IDs clicked):**
- Reveals masked IDs: first 8 characters + ellipsis (e.g., `a1b2c3d4…`)
- Copy ID buttons for each UUID field
- Click Copy → copies full UUID to clipboard with toast confirmation

### When `allow_proposal_context=false`:

- ProposalContextInline returns `null`
- No chips rendered
- No disclosure toggle visible
- No context fields leaked in UI

---

## C) No UUID Leakage Assertions

| Assertion | Status |
|-----------|--------|
| Default render contains zero UUID substrings | PASS |
| Only after disclosure does masked ID appear | PASS |
| Full UUID only goes to clipboard, not displayed | PASS |
| UUID not included in `data-testid` attributes | PASS |
| UUID not included in `aria-labels` | PASS |

### Implementation Details:

1. **maskUUID() function:** Returns only first 8 characters + ellipsis; never returns raw value for any length
2. **isValidUUID() function:** Validates values against UUID regex before rendering
3. **showIds state:** Defaults to `false`, user must click to disclose
4. **Copy via navigator.clipboard.writeText():** Full UUID never rendered in DOM
5. **Field icons instead of IDs:** Visual indicators without data exposure
6. **Invalid UUID handling:** Malformed/short values silently skipped; Show IDs button hidden when no valid UUIDs

---

## D) API Assertions

### GET `/api/runs/:id/schedule-proposals`

**Returns:**
```json
{
  "ok": true,
  "policy": {
    "allow_counter": true,
    "provider_can_initiate": true,
    "stakeholder_can_initiate": true,
    "allow_proposal_context": true  // ← CONFIRMED
  },
  "latest": {
    "proposal_context": {
      "quote_draft_id": "uuid-string",
      "estimate_id": "uuid-string",
      "bid_id": "uuid-string",
      "trip_id": "uuid-string",
      "selected_scope_option": "hybrid"
    }
  },
  "events": [...]
}
```

| API Assertion | Status |
|---------------|--------|
| Both provider and stakeholder endpoints return `policy.allow_proposal_context` | PASS |
| `proposal_context` mapped from `event.metadata.proposal_context` | PASS |
| Response shape stable and consistent | PASS |

---

## E) Copy Tokens Added

### Provider Namespace (`provider.schedule_proposals.proposal_context.*`)

```
label.context_attached: "Context attached"
action.show_ids: "Show IDs"
action.hide_ids: "Hide IDs"
action.copy_id: "Copy ID"
action.copied: "Copied"
chip.quote_draft: "Quote Draft"
chip.estimate: "Estimate"
chip.bid: "Bid"
chip.trip: "Reservation"
chip.scope_option: "Scope Option"
field.quote_draft_id: "Quote Draft ID"
field.estimate_id: "Estimate ID"
field.bid_id: "Bid ID"
field.trip_id: "Reservation ID"
```

### Stakeholder Namespace (`stakeholder.schedule_proposals.proposal_context.*`)

Same key set as provider namespace.

---

## F) Component API

### ProposalContextInline

```typescript
interface ProposalContextInlineProps {
  mode: 'provider' | 'stakeholder';  // Copy namespace selector
  allow: boolean;                     // Policy gate
  proposalContext: ProposalContext | null;
  density?: 'compact' | 'regular';    // Optional sizing
}
```

**Behavior:**
- Returns `null` if `!allow` or `!proposalContext`
- Renders chips for present context fields
- Disclosure toggle controls ID visibility
- Copy button uses toast for feedback

---

## G) Integration Points

### Stakeholder UI (RunStakeholderViewPage.tsx)

```tsx
<ProposalContextInline
  mode="stakeholder"
  allow={proposalsData.policy.allow_proposal_context}
  proposalContext={proposalsData.latest.proposal_context}
/>
```

### Provider UI (ProviderRunDetailPage.tsx)

```tsx
<ProposalContextInline
  mode="provider"
  allow={proposalsData?.policy?.allow_proposal_context ?? false}
  proposalContext={proposalsData.latest.proposal_context}
  density="compact"
/>
```

---

## Acceptance Criteria

| Criterion | Status |
|-----------|--------|
| Policy gating works (false = fully absent) | PASS |
| No UUID leakage on initial render | PASS |
| Disclosure + copy works correctly | PASS |
| Copy tokens used and present in entryPointCopy.ts | PASS |
| Proof doc exists with required assertions | PASS |

---

## Terminology Compliance

| Term | Status |
|------|--------|
| service provider | ✅ Used |
| reservation | ✅ Used (trip_id chip label) |
| contractor | ❌ Not used |
| booking | ❌ Not used |

---

**PHASE 2C-5 CERTIFIED**
