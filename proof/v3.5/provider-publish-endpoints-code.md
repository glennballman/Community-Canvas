# Provider Publish Endpoints - Exact Code

## GET /api/provider/portals (lines 571-591)

```typescript
router.get('/portals', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.ctx?.tenant_id || req.user?.tenantId;

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
  } catch (error: any) {
    console.error('Provider portals error:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch portals' });
  }
});
```

---

## POST /api/provider/runs/:id/publish (lines 593-689)

```typescript
router.post('/runs/:id/publish', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const tenantId = req.ctx?.tenant_id || req.user?.tenantId;
    const runId = req.params.id;
    const { portalIds, marketMode } = req.body;

    if (!tenantId) {
      return res.status(400).json({ ok: false, error: 'Tenant context required' });
    }

    if (!isValidUUID(runId)) {
      return res.status(400).json({ ok: false, error: 'Invalid run ID' });
    }

    if (marketMode === 'TARGETED') {
      return res.status(400).json({ 
        ok: false, 
        error: 'TARGETED is not valid for runs. Use OPEN, INVITE_ONLY, or CLOSED.' 
      });
    }

    const validModes = ['OPEN', 'INVITE_ONLY', 'CLOSED'];
    if (!validModes.includes(marketMode)) {
      return res.status(400).json({ 
        ok: false, 
        error: `Invalid market mode. Must be one of: ${validModes.join(', ')}` 
      });
    }

    if (!Array.isArray(portalIds) || portalIds.length === 0) {
      return res.status(400).json({ ok: false, error: 'At least one portal ID is required' });
    }

    for (const portalId of portalIds) {
      if (!isValidUUID(portalId)) {
        return res.status(400).json({ ok: false, error: `Invalid portal ID: ${portalId}` });
      }
    }

    const runResult = await pool.query(`
      SELECT id, tenant_id FROM cc_n3_runs WHERE id = $1 AND tenant_id = $2
    `, [runId, tenantId]);

    if (runResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Run not found' });
    }

    const portalsResult = await pool.query(`
      SELECT id FROM cc_portals WHERE id = ANY($1::uuid[]) AND owning_tenant_id = $2
    `, [portalIds, tenantId]);

    if (portalsResult.rows.length !== portalIds.length) {
      return res.status(400).json({ ok: false, error: 'One or more portals not found or not accessible' });
    }

    await pool.query(`
      UPDATE cc_n3_runs SET market_mode = $1, updated_at = now() WHERE id = $2
    `, [marketMode, runId]);

    for (const portalId of portalIds) {
      await pool.query(`
        INSERT INTO cc_run_portal_publications (tenant_id, run_id, portal_id, published_at)
        VALUES ($1, $2, $3, now())
        ON CONFLICT (tenant_id, run_id, portal_id) 
        DO UPDATE SET unpublished_at = NULL, published_at = now()
      `, [tenantId, runId, portalId]);
    }

    await pool.query(`
      UPDATE cc_run_portal_publications 
      SET unpublished_at = now() 
      WHERE run_id = $1 AND tenant_id = $2 AND portal_id != ALL($3::uuid[]) AND unpublished_at IS NULL
    `, [runId, tenantId, portalIds]);

    const publicationsResult = await pool.query(`
      SELECT rpp.portal_id, p.name as portal_name, rpp.published_at
      FROM cc_run_portal_publications rpp
      JOIN cc_portals p ON rpp.portal_id = p.id
      WHERE rpp.run_id = $1 AND rpp.tenant_id = $2 AND rpp.unpublished_at IS NULL
    `, [runId, tenantId]);

    res.json({
      ok: true,
      runId,
      marketMode,
      publications: publicationsResult.rows.map(row => ({
        portal_id: row.portal_id,
        portal_name: row.portal_name,
        published_at: row.published_at
      }))
    });
  } catch (error: any) {
    console.error('Provider publish run error:', error);
    res.status(500).json({ ok: false, error: 'Failed to publish run' });
  }
});
```

---

## Key Variables

| Variable | Source | Purpose |
|----------|--------|---------|
| `tenantId` | `req.ctx?.tenant_id \|\| req.user?.tenantId` | Current tenant context |
| `runId` | `req.params.id` | Run ID from URL |
| `portalIds` | `req.body.portalIds` | Array of portal UUIDs to publish to |
| `marketMode` | `req.body.marketMode` | OPEN, INVITE_ONLY, or CLOSED |

## Key Eligibility Rules

1. **Tenant scoped**: `owning_tenant_id = $1` (only tenant's own portals)
2. **Active only**: `status = 'active'`
3. **No portal_type filter**: Business and community portals treated identically
4. **No cross-tenant**: Direct publishing only to owned portals
