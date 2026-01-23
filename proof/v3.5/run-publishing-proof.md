# V3.5 STEP 5B — Run Publishing Implementation Proof

**Date**: 2026-01-23  
**Feature**: Selective Publishing to Portals with MarketMode  
**Status**: ✅ COMPLETE

============================================================
## Backend Route Evidence
============================================================

### File: `server/routes/provider.ts`

### GET /api/provider/portals (Lines 488-505)

```typescript
router.get('/portals', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.ctx?.tenant_id;

    if (!tenantId) {
      return res.status(400).json({ ok: false, error: 'Tenant context required' });
    }

    const result = await pool.query(`
      SELECT id, name, slug, status
      FROM cc_portals
      WHERE owning_tenant_id = $1 AND status = 'active'
      ORDER BY name ASC
    `, [tenantId]);

    res.json({ ok: true, portals: result.rows });
  } catch (error) { ... }
});
```

### POST /api/provider/runs/:id/publish (Lines 507-585)

```typescript
router.post('/runs/:id/publish', requireAuth, async (req: AuthRequest, res: Response) => {
  // Auth + tenant validation
  const tenantId = req.ctx?.tenant_id;
  
  // TARGETED rejection
  if (marketMode === 'TARGETED') {
    return res.status(400).json({ 
      ok: false, 
      error: 'TARGETED is not valid for runs. Use OPEN, INVITE_ONLY, or CLOSED.' 
    });
  }

  // Valid modes check
  const validModes = ['OPEN', 'INVITE_ONLY', 'CLOSED'];
  if (!validModes.includes(marketMode)) {
    return res.status(400).json({ ... });
  }

  // Run ownership check
  const runResult = await pool.query(`
    SELECT id, tenant_id FROM cc_n3_runs WHERE id = $1 AND tenant_id = $2
  `, [runId, tenantId]);

  // Portal ownership check
  const portalsResult = await pool.query(`
    SELECT id FROM cc_portals WHERE id = ANY($1::uuid[]) AND owning_tenant_id = $2
  `, [portalIds, tenantId]);

  // Update market_mode
  await pool.query(`UPDATE cc_n3_runs SET market_mode = $1 WHERE id = $2`, ...);

  // Upsert publications
  for (const portalId of portalIds) {
    await pool.query(`
      INSERT INTO cc_run_portal_publications (tenant_id, run_id, portal_id, published_at)
      VALUES ($1, $2, $3, now())
      ON CONFLICT (tenant_id, run_id, portal_id) 
      DO UPDATE SET unpublished_at = NULL, published_at = now()
    `, ...);
  }
});
```

### POST /api/provider/runs/:id/unpublish (Lines 587-625)

```typescript
router.post('/runs/:id/unpublish', requireAuth, async (req: AuthRequest, res: Response) => {
  // Auth + tenant + run ownership validation
  
  await pool.query(`
    UPDATE cc_run_portal_publications 
    SET unpublished_at = now() 
    WHERE run_id = $1 AND tenant_id = $2 AND portal_id = ANY($3::uuid[])
  `, [runId, tenantId, portalIds]);
});
```

### GET /api/provider/runs/:id (Updated - Lines 404-486)

Now returns:
```typescript
{
  run: {
    ...existing,
    market_mode: run.market_mode || 'INVITE_ONLY'
  },
  publications: publicationsResult.rows  // From cc_run_portal_publications WHERE unpublished_at IS NULL
}
```

============================================================
## Frontend Modal Evidence
============================================================

### File: `client/src/components/provider/PublishRunModal.tsx`

**TWO VISUALLY SEPARATE SECTIONS:**

```typescript
// SECTION 1: VISIBILITY — Portal Selection
<div className="space-y-4">
  <div className="flex items-center gap-2">
    <Globe className="w-4 h-4 text-muted-foreground" />
    <Label>{resolve('provider.run.publish.visibility_label')}</Label>
  </div>
  <p>{resolve('provider.run.publish.visibility_helper')}</p>
  
  {/* Checkbox list of portals */}
  {portals.map((portal) => (
    <Checkbox
      checked={selectedPortals.includes(portal.id)}
      onCheckedChange={(checked) => handlePortalToggle(portal.id, checked)}
    />
  ))}
</div>

<Separator />

// SECTION 2: COMPETITION — MarketMode
<div className="space-y-4">
  <div className="flex items-center gap-2">
    <Users className="w-4 h-4 text-muted-foreground" />
    <Label>{resolve('provider.run.publish.competition_label')}</Label>
  </div>

  <RadioGroup value={marketMode} onValueChange={setMarketMode}>
    <RadioGroupItem value="OPEN" />  {/* Open for responses */}
    <RadioGroupItem value="INVITE_ONLY" />  {/* By invitation only */}
    {/* CLOSED is NOT shown */}
  </RadioGroup>
</div>
```

### File: `client/src/pages/app/provider/ProviderRunDetailPage.tsx`

**Publish CTA:**
```typescript
<Button
  onClick={() => setPublishModalOpen(true)}
  data-testid="button-publish"
>
  <Globe className="w-4 h-4 mr-2" />
  {resolve('provider.run.publish.cta')}
</Button>

<PublishRunModal
  open={publishModalOpen}
  onOpenChange={setPublishModalOpen}
  runId={id}
  currentMarketMode={run.market_mode}
  currentPublications={publications}
/>
```

============================================================
## Copy Tokens Evidence
============================================================

### File: `client/src/copy/entryPointCopy.ts`

Added to `generic` and `service` entry points:

```typescript
// V3.5 Provider Run Publish tokens
'provider.run.publish.cta': 'Publish to Portals',
'provider.run.publish.modal_title': 'Publish Service Run',
'provider.run.publish.visibility_label': 'Visibility — Where this run appears',
'provider.run.publish.visibility_helper': 'Select which community portals will display this run.',
'provider.run.publish.competition_label': 'Competition — Who can respond',
'provider.run.publish.market_mode_open': 'Open for responses',
'provider.run.publish.market_mode_open_helper': 'Anyone can attach requests to this run. Does not commit you to any requests.',
'provider.run.publish.market_mode_invite_only': 'By invitation only',
'provider.run.publish.market_mode_invite_only_helper': 'Only invited requesters can attach. Does not commit you to any requests.',
'provider.run.publish.confirm': 'Publish Run',
'provider.run.publish.success': 'Run published successfully',
'provider.run.publish.no_portals': 'No community portals available',
'error.run.publish.invalid_market_mode': 'Invalid market mode. TARGETED is not valid for runs.',
```

============================================================
## Test Results (Test Auth Bootstrap)
============================================================

### Test 1: GET /api/provider/portals
```json
{
  "ok": true,
  "portals": [
    {"id": "df5561a8-...", "name": "Bamfield Community Portal", "slug": "bamfield", "status": "active"}
  ]
}
```

### Test 2: GET /api/provider/runs/:id (with market_mode)
```json
{
  "ok": true,
  "run": {"id": "2f0b495c-...", "title": "Marina Lot Paving", "market_mode": "INVITE_ONLY"},
  "publications": []
}
```

### Test 3: POST /api/provider/runs/:id/publish (OPEN)
```json
{
  "ok": true,
  "runId": "2f0b495c-...",
  "marketMode": "OPEN",
  "publications": [
    {"portal_id": "df5561a8-...", "portal_name": "Bamfield Community Portal", "published_at": "2026-01-23T23:09:03.831Z"}
  ]
}
```

### Test 4: Verify market_mode=OPEN in GET
```json
{
  "market_mode": "OPEN",
  "publications": [{"portal_id": "df5561a8-...", "portal_name": "Bamfield Community Portal"}]
}
```

### Test 5: TARGETED returns 400
```json
{
  "ok": false,
  "error": "TARGETED is not valid for runs. Use OPEN, INVITE_ONLY, or CLOSED."
}
```

### Test 6: POST /api/provider/runs/:id/unpublish
```json
{
  "ok": true,
  "runId": "2f0b495c-...",
  "publications": []
}
```

### Test 7: Verify publications empty after unpublish
```json
{
  "market_mode": "OPEN",
  "publications": []
}
```

============================================================
## Verification Checkboxes
============================================================

- [x] Visibility ≠ Competition (two UI sections with Separator)
- [x] TARGETED returns 400 error on runs
- [x] market_mode updates correctly
- [x] Multi-portal via join table (cc_run_portal_publications) works
- [x] No "job" used for service work (using "service request")
- [x] No "calendar" introduced (using "schedule/starts_at")
- [x] Test auth bootstrap used (POST /api/test/auth/login with X-TEST-AUTH)
- [x] No new inbox/thread UIs created
- [x] Publishing ≠ Commitment (helper text confirms this)

============================================================
## Files Changed
============================================================

1. `server/routes/provider.ts` - Added GET /portals, POST /publish, POST /unpublish, updated GET /runs/:id
2. `client/src/components/provider/PublishRunModal.tsx` - NEW: Modal with two sections
3. `client/src/pages/app/provider/ProviderRunDetailPage.tsx` - Added publish button + modal
4. `client/src/copy/entryPointCopy.ts` - Added provider.run.publish.* tokens

END.
