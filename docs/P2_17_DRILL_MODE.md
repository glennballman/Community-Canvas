# P2.17 Emergency Drill Mode + Synthetic Incident Generator

## Overview

P2.17 provides safe rehearsal capabilities for emergency scenarios without contaminating production records. Drill sessions create isolated synthetic data that is clearly marked and can be easily purged after exercises complete.

## Key Features

- **Drill Sessions**: Named, time-bounded exercise sessions with scenario types
- **Synthetic Records**: Auto-generated test data for emergency runs, evidence bundles, claims, disputes
- **Drill Scripts**: Reusable scenario templates with SHA-256 deduplication
- **Drill Isolation**: `is_drill` flag and `drill_id` FK prevent cross-contamination
- **RLS Integration**: `include_drill_records()` function controls visibility

## Database Schema

### New Tables

```sql
-- Drill session tracking
cc_drill_sessions (
  id, tenant_id, portal_id, circle_id, title, scenario_type, status,
  started_at, started_by_individual_id, completed_at, completed_by_individual_id,
  notes, client_request_id, metadata
)

-- Reusable scenario templates
cc_drill_scripts (
  id, tenant_id, title, scenario_type, script_json, script_sha256,
  created_at, created_by_individual_id, metadata
)
```

### Modified Tables (is_drill + drill_id columns)

- cc_emergency_runs
- cc_record_captures
- cc_evidence_bundles
- cc_evidence_objects
- cc_insurance_claims
- cc_claim_dossiers
- cc_disputes
- cc_defense_packs

## Scenario Types

| Type | Description | Evidence Count | Emergency Run | Claim | Dispute |
|------|-------------|----------------|---------------|-------|---------|
| tsunami | Tsunami warning response | 5 | Yes | Yes | No |
| wildfire | Wildfire evacuation | 8 | Yes | Yes | Yes |
| power_outage | Extended power outage | 4 | Yes | No | No |
| storm | Winter storm response | 6 | Yes | Yes | No |
| evacuation | Community evacuation | 7 | Yes | No | No |
| multi_hazard | Multiple concurrent hazards | 10 | Yes | Yes | Yes |
| other | Custom scenario | 3 | No | No | No |

## API Endpoints

All endpoints require service-key authentication via `x-internal-service-key` header.

### Sessions

```
POST   /api/drills/sessions          - Start new drill session
GET    /api/drills/sessions/:id      - Get drill session details
GET    /api/drills/sessions          - List drill sessions (query: tenantId, status, limit)
POST   /api/drills/sessions/:id/complete  - Complete drill session
POST   /api/drills/sessions/:id/cancel    - Cancel drill session
POST   /api/drills/sessions/:id/generate  - Generate synthetic records
GET    /api/drills/sessions/:id/counts    - Get record counts for drill
DELETE /api/drills/sessions/:id/records   - Purge all drill records
```

### Scripts

```
POST   /api/drills/scripts           - Create drill script
GET    /api/drills/scripts/:id       - Get drill script
GET    /api/drills/scripts           - List drill scripts (query: tenantId, scenarioType, limit)
```

## Usage Examples

### Start a Drill Session

```bash
curl -X POST http://localhost:5000/api/drills/sessions \
  -H "x-internal-service-key: $INTERNAL_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "550e8400-e29b-41d4-a716-446655440000",
    "scenarioType": "wildfire",
    "title": "2026 Wildfire Response Exercise"
  }'
```

### Generate Synthetic Records

```bash
curl -X POST http://localhost:5000/api/drills/sessions/{drillId}/generate \
  -H "x-internal-service-key: $INTERNAL_SERVICE_KEY"
```

### Complete and Purge Drill

```bash
# Complete the drill
curl -X POST http://localhost:5000/api/drills/sessions/{drillId}/complete \
  -H "x-internal-service-key: $INTERNAL_SERVICE_KEY" \
  -d '{"notes": "Exercise completed successfully"}'

# Purge all generated records
curl -X DELETE http://localhost:5000/api/drills/sessions/{drillId}/records \
  -H "x-internal-service-key: $INTERNAL_SERVICE_KEY"
```

## Drill Isolation

### Application-Level Filtering

By default, application queries should exclude drill records:

```sql
SELECT * FROM cc_emergency_runs 
WHERE (NOT is_drill OR include_drill_records());
```

### Including Drill Records

To include drill records in queries, set the session variable:

```sql
SET app.include_drills = true;
SELECT * FROM cc_emergency_runs WHERE drill_id = '{drill_id}';
```

## Integration with QA/Smoke Tests

Smoke tests can run in drill mode by:

1. Starting a drill session before tests
2. Using the drill_id to filter generated records
3. Purging all drill records after test completion

```typescript
// Start drill
const drillId = await startDrillSession({
  tenantId,
  scenarioType: 'multi_hazard',
  title: 'QA Smoke Test Run'
});

// Run tests with drill context
// ... test code ...

// Cleanup
await purgeDrillRecords(drillId);
await completeDrillSession(drillId);
```

## Security Considerations

- Drill endpoints require service-key authentication
- RLS policies isolate drill sessions by tenant
- Drill records are clearly marked with `is_drill = true`
- Production queries should filter out drill records by default

## File Locations

- **Generator**: `server/lib/drills/generate.ts`
- **API Routes**: `server/routes/drills.ts`
- **Schema Types**: `shared/schema.ts` (ccDrillSessions, ccDrillScripts)
