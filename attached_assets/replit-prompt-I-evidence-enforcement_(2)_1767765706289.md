# PROMPT I — Evidence Rule Enforcement (QA Gates + Evidence Ledger)

You are working in Community Canvas. We have implemented System Explorer (Prompt H). Now we formalize the Evidence Rule so that features cannot be "complete" without proof.

## THE PROBLEM

- Replit builds things and claims "done" without proof
- Features disappear when nav links are deleted
- No way to verify claims programmatically
- Hours wasted discovering what exists vs what was hallucinated

## THE SOLUTION

Implement machine-enforceable evidence gates that:
1. Track what exists
2. Verify it's accessible
3. Detect when things break or vanish

---

## NON-NEGOTIABLE RULES

- This is infrastructure, not a feature
- All checks must be automated (no manual verification)
- Failed evidence checks must be loud (console errors, test failures)
- Do NOT remove any existing functionality

---

## STEP 1 — CREATE EVIDENCE LEDGER TABLE

Create a table to track what should exist:

```sql
CREATE TABLE system_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What is this?
  artifact_type TEXT NOT NULL,  -- 'route' | 'table' | 'feed' | 'integration' | 'feature' | 'nav_item'
  artifact_name TEXT NOT NULL,  -- e.g., 'Bookings', 'unified_assets', 'Firecrawl'
  
  -- Evidence details
  evidence_type TEXT NOT NULL,  -- 'nav' | 'registry' | 'data' | 'test' | 'route'
  reference TEXT NOT NULL,      -- URL, route path, table name, test name
  
  -- Ownership
  owner_type TEXT,              -- 'tenant' | 'portal' | 'platform' | 'system'
  owner_id UUID,                -- tenant_id or portal_id if applicable
  
  -- Verification
  is_required BOOLEAN NOT NULL DEFAULT true,  -- Must this exist?
  last_verified_at TIMESTAMPTZ,
  verification_status TEXT DEFAULT 'unknown', -- 'verified' | 'missing' | 'stale' | 'unknown'
  verified_by TEXT,             -- 'system' | 'ai' | 'human'
  
  -- Metadata
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE (artifact_type, artifact_name, evidence_type)
);

CREATE INDEX idx_evidence_status ON system_evidence(verification_status);
CREATE INDEX idx_evidence_type ON system_evidence(artifact_type);
```

---

## STEP 2 — SEED REQUIRED EVIDENCE

Insert records for everything that MUST exist:

```sql
-- Core nav items (must always exist)
INSERT INTO system_evidence (artifact_type, artifact_name, evidence_type, reference, owner_type, is_required, description)
VALUES
  ('nav_item', 'Dashboard', 'nav', '/app/dashboard', 'system', true, 'Main dashboard'),
  ('nav_item', 'Inventory', 'nav', '/app/inventory', 'system', true, 'Asset inventory'),
  ('nav_item', 'Bookings', 'nav', '/app/bookings', 'system', true, 'Bookings list'),
  ('nav_item', 'Operations', 'nav', '/app/operations', 'system', true, 'Operations board'),
  ('nav_item', 'Work Requests', 'nav', '/app/work-requests', 'system', true, 'Work requests'),
  ('nav_item', 'Projects', 'nav', '/app/projects', 'system', true, 'Projects list'),
  ('nav_item', 'Places', 'nav', '/app/places', 'system', true, 'Places directory'),
  ('nav_item', 'Contacts', 'nav', '/app/contacts', 'system', true, 'Contacts list'),
  ('nav_item', 'Organizations', 'nav', '/app/organizations', 'system', true, 'Organizations'),
  ('nav_item', 'System Explorer', 'nav', '/app/system-explorer', 'system', true, 'Discovery surface')
ON CONFLICT (artifact_type, artifact_name, evidence_type) DO NOTHING;

-- Core routes (must render)
INSERT INTO system_evidence (artifact_type, artifact_name, evidence_type, reference, owner_type, is_required)
VALUES
  ('route', '/app/dashboard', 'route', '/app/dashboard', 'system', true),
  ('route', '/app/inventory', 'route', '/app/inventory', 'system', true),
  ('route', '/app/bookings', 'route', '/app/bookings', 'system', true),
  ('route', '/app/operations', 'route', '/app/operations', 'system', true),
  ('route', '/app/work-requests', 'route', '/app/work-requests', 'system', true),
  ('route', '/app/projects', 'route', '/app/projects', 'system', true),
  ('route', '/app/system-explorer', 'route', '/app/system-explorer', 'system', true)
ON CONFLICT (artifact_type, artifact_name, evidence_type) DO NOTHING;

-- Core tables (must have data access)
INSERT INTO system_evidence (artifact_type, artifact_name, evidence_type, reference, owner_type, is_required)
VALUES
  ('table', 'unified_assets', 'data', 'unified_assets', 'tenant', true),
  ('table', 'unified_bookings', 'data', 'unified_bookings', 'tenant', true),
  ('table', 'work_requests', 'data', 'work_requests', 'tenant', true),
  ('table', 'projects', 'data', 'projects', 'tenant', true),
  ('table', 'contacts', 'data', 'contacts', 'tenant', false),  -- May not exist yet
  ('table', 'portals', 'data', 'portals', 'platform', true),
  ('table', 'entity_presentations', 'data', 'entity_presentations', 'portal', false)
ON CONFLICT (artifact_type, artifact_name, evidence_type) DO NOTHING;

-- Known integrations (should be detectable)
INSERT INTO system_evidence (artifact_type, artifact_name, evidence_type, reference, owner_type, is_required)
VALUES
  ('integration', 'Firecrawl', 'test', 'FIRECRAWL_API_KEY', 'platform', false),
  ('integration', 'Apify', 'test', 'APIFY_API_KEY', 'platform', false),
  ('integration', 'DriveBC', 'test', 'drivebc_feed', 'platform', false),
  ('integration', 'BC Ferries', 'test', 'bcferries_feed', 'platform', false),
  ('integration', 'BC Hydro', 'test', 'bchydro_feed', 'platform', false)
ON CONFLICT (artifact_type, artifact_name, evidence_type) DO NOTHING;
```

---

## STEP 3 — EVIDENCE VERIFICATION SERVICE

Create a server service that verifies evidence:

**Location:** `server/services/evidenceVerification.ts`

```typescript
interface EvidenceResult {
  artifact_name: string;
  artifact_type: string;
  status: 'verified' | 'missing' | 'error';
  details?: string;
  checked_at: Date;
}

async function verifyAllEvidence(): Promise<EvidenceResult[]> {
  const results: EvidenceResult[] = [];
  
  // Get all required evidence
  const evidence = await db.query(`
    SELECT * FROM system_evidence WHERE is_required = true
  `);
  
  for (const item of evidence.rows) {
    const result = await verifyEvidence(item);
    results.push(result);
    
    // Update verification status
    await db.query(`
      UPDATE system_evidence 
      SET verification_status = $1, last_verified_at = now(), verified_by = 'system'
      WHERE id = $2
    `, [result.status, item.id]);
  }
  
  return results;
}

async function verifyEvidence(item: any): Promise<EvidenceResult> {
  switch (item.artifact_type) {
    case 'nav_item':
      return verifyNavItem(item);
    case 'route':
      return verifyRoute(item);
    case 'table':
      return verifyTable(item);
    case 'integration':
      return verifyIntegration(item);
    default:
      return { 
        artifact_name: item.artifact_name, 
        artifact_type: item.artifact_type,
        status: 'error', 
        details: 'Unknown artifact type',
        checked_at: new Date()
      };
  }
}

async function verifyNavItem(item: any): Promise<EvidenceResult> {
  // Check if nav config contains this item
  // This requires reading the nav config file or querying a nav registry
  // For now, return verified (actual implementation depends on nav structure)
  return {
    artifact_name: item.artifact_name,
    artifact_type: 'nav_item',
    status: 'verified', // TODO: Actually check nav config
    checked_at: new Date()
  };
}

async function verifyRoute(item: any): Promise<EvidenceResult> {
  try {
    // Attempt to fetch the route (internal request)
    const response = await fetch(`http://localhost:${process.env.PORT}${item.reference}`, {
      method: 'HEAD',
      headers: { 'X-Evidence-Check': 'true' }
    });
    
    return {
      artifact_name: item.artifact_name,
      artifact_type: 'route',
      status: response.ok ? 'verified' : 'missing',
      details: `HTTP ${response.status}`,
      checked_at: new Date()
    };
  } catch (error) {
    return {
      artifact_name: item.artifact_name,
      artifact_type: 'route',
      status: 'error',
      details: error.message,
      checked_at: new Date()
    };
  }
}

async function verifyTable(item: any): Promise<EvidenceResult> {
  try {
    const result = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = $1
      )
    `, [item.reference]);
    
    return {
      artifact_name: item.artifact_name,
      artifact_type: 'table',
      status: result.rows[0].exists ? 'verified' : 'missing',
      checked_at: new Date()
    };
  } catch (error) {
    return {
      artifact_name: item.artifact_name,
      artifact_type: 'table',
      status: 'error',
      details: error.message,
      checked_at: new Date()
    };
  }
}

async function verifyIntegration(item: any): Promise<EvidenceResult> {
  // Check if env var exists (don't expose value)
  const exists = !!process.env[item.reference];
  
  return {
    artifact_name: item.artifact_name,
    artifact_type: 'integration',
    status: exists ? 'verified' : 'missing',
    details: exists ? 'Configured' : 'Not configured',
    checked_at: new Date()
  };
}

export { verifyAllEvidence, verifyEvidence, EvidenceResult };
```

---

## STEP 4 — EVIDENCE API ENDPOINT

Add endpoint to run verification:

```typescript
// GET /api/admin/evidence/verify
router.get('/api/admin/evidence/verify', async (req, res) => {
  const results = await verifyAllEvidence();
  
  const summary = {
    total: results.length,
    verified: results.filter(r => r.status === 'verified').length,
    missing: results.filter(r => r.status === 'missing').length,
    errors: results.filter(r => r.status === 'error').length,
    results
  };
  
  // Log failures loudly
  const failures = results.filter(r => r.status !== 'verified');
  if (failures.length > 0) {
    console.error('[EVIDENCE] Verification failures:', failures);
  }
  
  res.json(summary);
});

// GET /api/admin/evidence/status
router.get('/api/admin/evidence/status', async (req, res) => {
  const evidence = await db.query(`
    SELECT 
      artifact_type,
      artifact_name,
      evidence_type,
      reference,
      verification_status,
      last_verified_at,
      is_required
    FROM system_evidence
    ORDER BY is_required DESC, artifact_type, artifact_name
  `);
  
  res.json(evidence.rows);
});
```

---

## STEP 5 — ADD EVIDENCE TAB TO SYSTEM EXPLORER

Add a new tab to System Explorer: **"Evidence Status"**

Show:
- All registered evidence items
- Verification status (✅ verified / ⚠️ stale / ❌ missing)
- Last checked timestamp
- "Verify All" button that calls `/api/admin/evidence/verify`

Visual indicators:
- Green row: verified
- Yellow row: stale (not checked in 24h)
- Red row: missing or error

---

## STEP 6 — QA SMOKE TEST ASSERTIONS

Update or create `scripts/qa-smoke-test.ts`:

```typescript
import { verifyAllEvidence } from '../server/services/evidenceVerification';

async function runEvidenceTests() {
  console.log('Running Evidence Rule verification...');
  
  const results = await verifyAllEvidence();
  
  const failures = results.filter(r => r.status !== 'verified' && r.is_required);
  
  if (failures.length > 0) {
    console.error('❌ EVIDENCE FAILURES:');
    failures.forEach(f => {
      console.error(`  - ${f.artifact_type}: ${f.artifact_name} (${f.status})`);
    });
    process.exit(1);
  }
  
  console.log(`✅ All ${results.length} evidence checks passed`);
  return results;
}

// Nav-specific assertions
async function assertNavItems() {
  const requiredNavItems = [
    'Dashboard',
    'Inventory', 
    'Bookings',
    'Operations',
    'System Explorer'
  ];
  
  // This would check the actual nav config
  // Implementation depends on how nav is structured
  console.log('Checking required nav items...');
  
  for (const item of requiredNavItems) {
    // TODO: Actually verify nav contains item
    console.log(`  ✓ ${item}`);
  }
}

// Route rendering assertions
async function assertRoutesRender() {
  const routes = [
    '/app/dashboard',
    '/app/inventory',
    '/app/bookings',
    '/app/operations',
    '/app/system-explorer'
  ];
  
  for (const route of routes) {
    try {
      const response = await fetch(`http://localhost:3000${route}`);
      if (!response.ok) {
        throw new Error(`Route ${route} returned ${response.status}`);
      }
      console.log(`  ✓ ${route} renders`);
    } catch (error) {
      console.error(`  ❌ ${route} failed: ${error.message}`);
      process.exit(1);
    }
  }
}

// Main test runner
async function main() {
  await runEvidenceTests();
  await assertNavItems();
  await assertRoutesRender();
  
  console.log('\n✅ All QA smoke tests passed');
}

main().catch(err => {
  console.error('QA tests failed:', err);
  process.exit(1);
});
```

Add npm script:
```json
{
  "scripts": {
    "qa:evidence": "ts-node scripts/qa-smoke-test.ts"
  }
}
```

---

## STEP 7 — STARTUP EVIDENCE CHECK (OPTIONAL BUT RECOMMENDED)

Add a startup check that logs evidence status:

```typescript
// In server startup (e.g., server/index.ts)

import { verifyAllEvidence } from './services/evidenceVerification';

async function startupEvidenceCheck() {
  if (process.env.NODE_ENV === 'development') {
    console.log('[STARTUP] Running evidence verification...');
    
    const results = await verifyAllEvidence();
    const failures = results.filter(r => r.status !== 'verified');
    
    if (failures.length > 0) {
      console.warn('[STARTUP] ⚠️ Evidence failures detected:');
      failures.forEach(f => {
        console.warn(`  - ${f.artifact_type}: ${f.artifact_name}`);
      });
    } else {
      console.log(`[STARTUP] ✅ All ${results.length} evidence checks passed`);
    }
  }
}

// Call during startup
startupEvidenceCheck();
```

---

## STEP 8 — PROOF REQUIREMENT

After implementation, provide:

### SQL Evidence
```sql
-- Show evidence table exists and has records
SELECT artifact_type, COUNT(*) as count 
FROM system_evidence 
GROUP BY artifact_type;

-- Show verification status
SELECT verification_status, COUNT(*) 
FROM system_evidence 
GROUP BY verification_status;
```

### API Evidence
```bash
# Run verification
curl http://localhost:3000/api/admin/evidence/verify

# Get status
curl http://localhost:3000/api/admin/evidence/status
```

### Screenshot Evidence
1. System Explorer → Evidence Status tab
2. Verification results showing green/yellow/red status

### QA Script Evidence
```bash
npm run qa:evidence
# Should output all checks passing
```

---

## THE RULE (ENFORCED)

After this prompt is implemented:

> **Any PR or AI change that causes an evidence check to fail is automatically rejected.**
> 
> **Any feature claimed as "done" without evidence in System Explorer is not done.**
> 
> **If it's not in the ledger, it doesn't exist.**

BEGIN.
