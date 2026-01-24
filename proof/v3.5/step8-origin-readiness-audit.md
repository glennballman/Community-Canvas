# V3.5 STEP 8 — Origin Readiness Audit

**Generated**: 2026-01-24  
**Status**: AUDIT COMPLETE — Ready to proceed

---

## Section A: Audit Findings

### A1) StartAddressPickerModal Location
**File**: `client/src/components/provider/StartAddressPickerModal.tsx`

**Current State**:
- Has tabs: "Choose Saved" and "Add New"
- Create form includes: label, address_line_1, city, region, postal_code, notes, is_default
- **Missing**: latitude/longitude fields in the create form
- Interface `StartAddress` already defines `latitude: number | null` and `longitude: number | null`
- No edit mode exists - only create new or select existing

### A2) Backend Endpoints

**POST /api/provider/start-addresses** (lines 1145-1232)
- Already accepts `latitude` and `longitude` from body
- No validation for both-or-none rule
- Returns latitude/longitude in response

**PATCH /api/provider/start-addresses/:id** (lines 1235-1360)
- Already accepts `latitude` and `longitude` from body
- No validation for both-or-none rule
- Returns latitude/longitude in response

### A3) PublishRunModal Fetches

**File**: `client/src/components/provider/PublishRunModal.tsx`

Current fetches:
1. `GET /api/provider/runs/:id/publish-suggestions` - returns `origin.start_address_id`, `origin_lat`, `origin_lng`
2. Uses `suggestionsData?.origin.origin_lat == null` to show no-origin notice

**Missing**:
- No distinction between "no start address" vs "start address exists but no coords"
- No edit mode for existing address from modal

### A4) Existing Validation Patterns

Found in provider.ts:
```typescript
// Label validation
if (!label || typeof label !== 'string' || label.trim().length === 0) {
  return res.status(400).json({ ok: false, error: 'error.request.invalid', message: 'Label is required' });
}
```

Pattern: Return `{ ok: false, error: string, message?: string }` with status 400

---

## Implementation Plan

| Section | Task | Status |
|---------|------|--------|
| B | Add both-or-none coordinate validation to POST/PATCH | Pending |
| C | Add lat/lng fields to StartAddressPickerModal | Pending |
| D | Add origin readiness preflight banners | Pending |
| E | Add `no_origin_coords` confidence mode | Pending |
| F | Add copy tokens | Pending |
| G/H | Test and proof | Pending |

---

**AUDIT COMPLETE** — No blockers found. All required files and patterns identified.
