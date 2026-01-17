# Jobs Backend "Don't Get Burned" Verification Report
**Date:** 2026-01-17

## CHECK 1 — Portal Context Source of Truth

### Findings

**A) Portal Resolution Code Path**

Location: `server/middleware/tenantContext.ts` lines 79-131

```typescript
// Priority 1: Domain-based portal resolution
const portalResult = await serviceQuery(`
  SELECT d.portal_id, p.owning_tenant_id, p.slug, p.name, p.legal_dba_name, p.portal_type
  FROM cc_portal_domains d 
  JOIN cc_portals p ON p.id = d.portal_id
  WHERE d.domain = $1 
    AND d.status IN ('verified', 'active') 
    AND p.status = 'active'
  LIMIT 1
`, [domain]);

if (portalResult.rows.length > 0) {
  req.ctx.portal_id = row.portal_id;
  // ...
} else {
  // Priority 2: /b/:slug path prefix for dev
  const pathMatch = req.path.match(/^\/b\/([^\/]+)/);
  if (pathMatch) {
    // resolve from cc_portals by slug
  }
}
```

**B) Determinism**
- Domain wins if found (Priority 1)
- Path prefix `/b/:slug` is fallback (Priority 2)
- **X-Portal-Slug header is NOT supported** - only domain and path

**C) Curl Tests**

```bash
# Path-based resolution (works)
curl -s http://localhost:5000/b/bamfield/api/public/jobs | jq '.ok'
# Result: true

# Header-based resolution (NOT SUPPORTED)
curl -s http://localhost:5000/api/public/jobs -H 'X-Portal-Slug: bamfield' | jq '.error'
# Result: "PORTAL_NOT_FOUND"
```

### Verdict: **PASS (with note)**
Portal context is deterministic. Domain > Path. X-Portal-Slug header is not supported but not required per spec.

---

## CHECK 2 — CORS Caching Correctness for Embeds

### Findings

**A) Embed Handler Inspection**

Location: `server/routes/embeds.ts` lines 187-192

```typescript
if (origin) {
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
}
```

- **Vary: Origin** ✓ Set correctly
- **Cache-Control** ✗ NOT SET - dynamic content could be cached incorrectly

**B) Origin Allowlist Enforcement**

```typescript
if (!verifyDomainAllowlist(origin, host, surface.allowed_domains)) {
  return res.status(403).json({
    ok: false,
    error: 'DOMAIN_NOT_ALLOWED'
  });
}
```

- Origin validated before data return ✓
- Falls back to Host if no Origin ✓
- If `allowed_domains` is empty, allows all requests (intentional for dev)

**C) Curl Tests**

```bash
# Invalid embed key
curl -s http://localhost:5000/api/embed/feed/invalid-key -H 'Origin: https://evil.com'
# Result: {"ok":false,"error":"EMBED_SURFACE_NOT_FOUND"}

# Check headers (no Cache-Control returned)
curl -sI http://localhost:5000/api/embed/feed/test-key -H 'Origin: https://test.com'
# Result: No Cache-Control header
```

### Verdict: **FAIL**
Missing `Cache-Control` header. Could cause CDN caching of dynamic per-origin responses.

### Required Patch:
Add `Cache-Control: private, max-age=60` to embed responses.

---

## CHECK 3 — Media Lifecycle Cleanup (Abandoned Upload Sessions)

### Findings

**A) Schema Confirmed**

```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'cc_public_upload_sessions';
-- expires_at, used_at, consumed_at columns exist ✓
```

**B) Storage Linkage**
- `cc_public_upload_session_media` links uploads to sessions via `session_id`
- Media stored via `media_id` (uuid) reference

**C) Cleanup Job**
- **No cleanup job exists**
- Grep for `cleanup|cron|scheduled.*job` returned no matches

### Verdict: **FAIL**
No scheduled cleanup for expired/abandoned sessions. Media will accumulate indefinitely.

### Required Patch:
Add cleanup script at `server/jobs/cleanupUploadSessions.ts`

---

## CHECK 4 — Default Destinations Policy Correctness

### Findings

**A) Destinations Endpoint**
- Grep for `destinations|default_selected` in `server/routes/jobs.ts` returned no matches
- **Endpoint does not exist**

### Verdict: **FAIL**
`GET /api/p2/app/jobs/:id/destinations` not implemented.

### Required Patch:
Add destinations endpoint to jobs router. (Deferred - not in scope for this verification patch)

---

## SUMMARY

| Check | Status | Issue |
|-------|--------|-------|
| 1. Portal Context | PASS | X-Portal-Slug header not supported (acceptable) |
| 2. CORS Caching | FAIL | Missing Cache-Control header |
| 3. Media Cleanup | FAIL | No cleanup job for abandoned sessions |
| 4. Destinations | FAIL | Endpoint not implemented (deferred) |

## PATCHES APPLIED

1. **Cache-Control header** added to embed routes (`server/routes/embeds.ts`)
   - Added `Cache-Control: private, max-age=60` to both GET and OPTIONS handlers
   - Header only applied on successful responses (404 errors don't need caching)

2. **Cleanup script** created for abandoned upload sessions (`server/jobs/cleanupUploadSessions.ts`)
   - Finds expired sessions where `used_at IS NULL`
   - Marks associated media for garbage collection via `garbage_collect_after` column
   - Deletes session and media link records
   - Supports `--dry-run` mode for testing
   - Run via: `npx tsx server/jobs/cleanupUploadSessions.ts --dry-run`

## HOW TO VERIFY

```bash
# 1. Verify cleanup script works
npx tsx server/jobs/cleanupUploadSessions.ts --dry-run

# 2. Verify Cache-Control header (need valid embed key to see success response)
# For now, verified via code inspection that header is set on line 196

# 3. Verify path-based portal resolution
curl -s http://localhost:5000/b/bamfield/api/public/jobs | jq '.ok'
# Expected: true

# 4. Verify role/MIME validation still works
curl -s -X POST http://localhost:5000/api/public/jobs/upload-url \
  -H 'Content-Type: application/json' \
  -d '{"sessionToken":"test","role":"maliciousRole","mimeType":"application/pdf"}'
# Expected: {"ok":false,"error":"INVALID_ROLE",...}
```

## DEFERRED ITEMS

- **Destinations endpoint** (`GET /api/p2/app/jobs/:id/destinations`) - Not in scope for this verification patch
