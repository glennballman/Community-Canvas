# V3.5 Service Runs Management (Provider Phase 2) - Proof Document

**Date**: 2026-01-23  
**Feature**: STEP 4 - Service Runs Management  
**Status**: ✅ COMPLETE

## 1. DB Evidence

### cc_n3_runs Table Exists
Confirmed via SQL query. Key columns:

| Column | Type | Nullable |
|--------|------|----------|
| id | uuid | NO |
| tenant_id | uuid | NO |
| name | text | NO |
| description | text | YES |
| status | text | NO |
| starts_at | timestamp with time zone | YES |
| ends_at | timestamp with time zone | YES |
| metadata | jsonb | YES |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |
| portal_id | uuid | YES |
| zone_id | uuid | YES |

### Attachment Linkage Pattern
**NO ATTACHMENT LINKAGE FOUND — returning empty array**

Probed in order:
1. ❌ No `cc_run_requests` join table exists
2. ❌ No `run_id` column on `cc_service_requests`
3. ❌ No `request_ids` array on `cc_n3_runs`

Per spec, returning `attached_requests: []` with read-only detection only. Creation is STEP 6.

## 2. Backend Route Evidence

### File Path
`server/routes/provider.ts`

### Authentication & Tenant Context

```typescript
// Line 9 - Import tenant context
import type { TenantRequest } from '../middleware/tenantContext';

// Lines 13-16 - Auth interface with ctx
interface AuthRequest extends Request {
  user?: { id: string; tenantId?: string };
  ctx?: { tenant_id: string | null };
}

// Lines 18-22 - requireAuth middleware
function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user?.id) {
    return res.status(401).json({ ok: false, error: 'Authentication required' });
  }
  next();
}
```

### GET /api/provider/runs (Lines 318-401)

```typescript
router.get('/runs', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const tenantId = req.ctx?.tenant_id;

    if (!tenantId) {
      return res.status(400).json({ ok: false, error: 'Tenant context required' });
    }

    // ... filter and search handling ...

    const query = `
      SELECT 
        r.id, r.name as title, r.description, r.status,
        r.starts_at, r.ends_at, r.portal_id, r.zone_id,
        r.metadata, r.created_at, r.updated_at,
        p.name as portal_name, z.name as zone_name,
        0 as requests_attached
      FROM cc_n3_runs r
      LEFT JOIN cc_portals p ON r.portal_id = p.id
      LEFT JOIN cc_zones z ON r.zone_id = z.id
      WHERE r.tenant_id = $1
        ${statusCondition}
        ${searchCondition}
      ORDER BY r.starts_at DESC NULLS LAST, r.created_at DESC
      LIMIT 100
    `;
    
    const result = await pool.query(query, params);
    res.json({ ok: true, runs: result.rows.map(row => ({...})) });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch runs' });
  }
});
```

### GET /api/provider/runs/:id (Lines 404-478)

```typescript
router.get('/runs/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const tenantId = req.ctx?.tenant_id;
    const runId = req.params.id;

    if (!tenantId) {
      return res.status(400).json({ ok: false, error: 'Tenant context required' });
    }

    if (!isValidUUID(runId)) {
      return res.status(400).json({ ok: false, error: 'Invalid run ID' });
    }

    const result = await pool.query(`
      SELECT r.*, p.name as portal_name, z.name as zone_name
      FROM cc_n3_runs r
      LEFT JOIN cc_portals p ON r.portal_id = p.id
      LEFT JOIN cc_zones z ON r.zone_id = z.id
      WHERE r.id = $1 AND r.tenant_id = $2
    `, [runId, tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Run not found' });
    }

    // Publications derived from portal_id
    const publications = run.portal_id ? [{
      portal_id: run.portal_id,
      portal_name: run.portal_name || 'Unknown Portal'
    }] : [];

    res.json({
      ok: true,
      run: { ... },
      attached_requests: [],  // Empty per spec - no linkage exists
      publications
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch run' });
  }
});
```

## 3. Frontend Evidence

### File Paths
- List page: `client/src/pages/app/provider/ProviderRunsPage.tsx`
- Detail page: `client/src/pages/app/provider/ProviderRunDetailPage.tsx`

### Read-Only Rendering (ProviderRunsPage.tsx)

```typescript
// Lines 152-157 - List items are Link elements (read-only navigation)
<Link 
  key={run.id} 
  href={`/app/provider/runs/${run.id}`}
  className="block"
  data-testid={`link-run-${run.id}`}
>
  <Card className="hover-elevate cursor-pointer">
    // Display-only content: badges, title, schedule, zone
  </Card>
</Link>
```

### MarketMode Gating (ProviderRunDetailPage.tsx)

```typescript
// Lines 88-93 - MarketMode actions hook
const { primaryAction, secondaryActions } = useMarketActions({
  objectType: 'service_run',
  actorRole: 'provider',
  marketMode: 'TARGETED',
  visibility: 'PRIVATE'
});

// Lines 270-288 - Stubbed CTAs
<Button
  className="w-full"
  variant="outline"
  disabled  // STUBBED per spec
  data-testid="button-publish-stub"
>
  <Globe className="w-4 h-4 mr-2" />
  Publish to Portals (Coming Soon)
</Button>

<Button
  className="w-full"
  variant="outline"
  disabled  // STUBBED per spec
  data-testid="button-attach-stub"
>
  <FileText className="w-4 h-4 mr-2" />
  Attach {nouns.request}s (Coming Soon)
</Button>
```

### Link-Out Messaging (ProviderRunDetailPage.tsx)

```typescript
// Lines 292-297 - View Messages is link-out only, no embedded thread
<Button asChild variant="ghost" className="w-full">
  <Link href="/app/messages" data-testid="link-view-messages">
    <MessageSquare className="w-4 h-4 mr-2" />
    View Messages
  </Link>
</Button>
```

## 4. Nav Wiring Evidence

### File Path
`client/src/lib/routes/v3Nav.ts`

### Provider Section (Lines 175-182)

```typescript
{
  title: 'Provider',
  requiresTenant: true,
  items: [
    { icon: ClipboardList, label: 'Inbox', href: '/app/provider/inbox', testId: 'nav-provider-inbox', requiresTenant: true },
    { icon: Truck, label: 'My Runs', href: '/app/provider/runs', testId: 'nav-provider-runs', requiresTenant: true },
  ],
},
```

**Placement**: After "Communication" section, before "Compliance" section.

## 5. Copy Token Evidence

### File Path
Using existing tokens from `client/src/copy/entryPointCopy.ts` via `useCopy({ entryPoint: 'service' })`

### Tokens Used

| Token Key | Resolved Value |
|-----------|----------------|
| `label.noun.run` | "service run" |
| `label.noun.request` | "request" |
| `label.noun.provider` | "provider" |

### Usage Examples (ProviderRunsPage.tsx)

```typescript
// Line 60 - Hook initialization
const { nouns, resolve } = useCopy({ entryPoint: 'service' });

// Line 114 - Page title
<h1 className="text-xl font-bold" data-testid="text-runs-title">My {nouns.run}s</h1>

// Line 119 - Search placeholder  
placeholder={`Search ${nouns.run}s...`}

// Line 141 - Empty state
<h2>No {nouns.run}s found</h2>

// Line 188 - Request count
{run.requests_attached} {nouns.request}s
```

## 6. Verification Statements

- [x] **No new "calendar" term introduced in any new code** — uses "schedule/starts_at/ends_at" only
- [x] **No attachment linkage created — detection/read only** — returning empty array, creation is STEP 6
- [x] **Read-only by default preserved** — no inline edit/delete controls on list or detail
- [x] **All CTAs MarketMode-gated or stubbed** — Publish and Attach buttons are disabled with "(Coming Soon)"
- [x] **No new inbox/thread UIs created** — "View Messages" is link-out to /app/messages only
- [x] **Test auth bootstrap used (no UI login)** — verified via POST /api/test/auth/login with X-TEST-AUTH header

## 7. Test Results

### Test Auth Bootstrap Success

```bash
curl -s -X POST http://localhost:5000/api/test/auth/login \
  -H "Content-Type: application/json" \
  -H "X-TEST-AUTH: $TEST_AUTH_SECRET" \
  -d '{"persona": "ellen"}'
```

**Response:**
```json
{
  "ok": true,
  "userId": "b6d52935-4ab3-4bc0-9db2-61d8c7319abf",
  "tenantId": "e0000000-0000-0000-0000-000000000001",
  "user": {
    "id": "b6d52935-4ab3-4bc0-9db2-61d8c7319abf",
    "email": "ellen@example.com",
    "displayName": "Ellen Test",
    "isPlatformAdmin": false
  },
  "tenant": {
    "id": "e0000000-0000-0000-0000-000000000001",
    "name": "Bamfield Community",
    "slug": "bamfield",
    "role": "admin"
  }
}
```

### GET /api/provider/runs Success

```bash
curl -s http://localhost:5000/api/provider/runs \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-Id: e0000000-0000-0000-0000-000000000001"
```

**Response:**
```json
{
  "ok": true,
  "runs": [
    {
      "id": "2f0b495c-cc53-4206-96b5-dccbd790d40c",
      "title": "Marina Lot Paving",
      "description": "Demo run for deer-group",
      "status": "scheduled",
      "starts_at": "2026-01-23T11:00:00.000Z",
      "ends_at": "2026-01-23T13:00:00.000Z",
      "requests_attached": 0
    },
    // ... 5 more runs ...
  ]
}
```

### GET /api/provider/runs/:id Success

```bash
curl -s http://localhost:5000/api/provider/runs/2f0b495c-cc53-4206-96b5-dccbd790d40c \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-Id: e0000000-0000-0000-0000-000000000001"
```

**Response:**
```json
{
  "ok": true,
  "run": {
    "id": "2f0b495c-cc53-4206-96b5-dccbd790d40c",
    "title": "Marina Lot Paving",
    "description": "Demo run for deer-group",
    "status": "scheduled",
    "starts_at": "2026-01-23T11:00:00.000Z",
    "ends_at": "2026-01-23T13:00:00.000Z"
  },
  "attached_requests": [],
  "publications": []
}
```

## Files Changed

1. `server/routes/provider.ts` - Added GET /runs and GET /runs/:id with tenant context
2. `client/src/pages/app/provider/ProviderRunsPage.tsx` - List page with copy tokens
3. `client/src/pages/app/provider/ProviderRunDetailPage.tsx` - Detail page with stubbed CTAs
4. `client/src/lib/routes/v3Nav.ts` - Added Provider nav section
5. `client/src/App.tsx` - Added provider/runs routes
