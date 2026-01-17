# QA Golden Path: Bench Depth + Emergency Replacement

## Overview

This script seeds deterministic test data and runs assertions for:
- **Bench depth layers** (readiness states: on_site, ready, cleared, prospect)
- **Housing waitlist tiering + staging** (tier assignment, priority scores)
- **Emergency replacement ranking + dedupe** (candidate ordering, routing idempotency)

## What It Seeds

### Portal
- Uses or creates portal with slug `bamfield-qa`

### Individuals (6 total)
| Name | Readiness State | Days Since Activity | Housing Needed | Staging |
|------|-----------------|---------------------|----------------|---------|
| Alice OnSite Hostel | on_site | 1 | Yes | hostel |
| Bob OnSite Campground | on_site | 3 | Yes | campground |
| Carol Ready One | ready | 2 | No | - |
| Dan Ready Two | ready | 5 | Yes | - |
| Eve Ready Three | ready | 7 | No | - |
| Frank Cleared | cleared | 10 | No | - |

### Bench Entries
- All 6 individuals are upserted into `cc_portal_candidate_bench`
- Different `last_activity_at` timestamps (staggered)
- Mixed `housing_needed` values

### Housing Waitlist Entries (2)
| Candidate | Tier Assigned | Priority Score | Staging Location |
|-----------|---------------|----------------|------------------|
| Alice OnSite Hostel | temporary | 80 | hostel |
| Bob OnSite Campground | emergency | 50 | campground |

### Emergency Replacement Request (1)
- Urgency: `today`
- Role: `Housekeeper (Emergency Replacement)`
- Status: `open`

## Assertions

The script validates:

1. **Bench upsert** - Exactly 6 records created for portal
2. **Waitlist entries** - Exactly 2 entries with tier + staging
3. **Candidate ordering** - Sorted correctly:
   - `on_site` candidates before `ready`
   - Within `on_site`, higher priority_score first
   - `ready` before `cleared`
4. **First routing** - Successfully fills emergency request
5. **Second routing** - Correctly rejected (idempotent, no duplicate)

## How to Run

```bash
# Direct execution
tsx scripts/qa-bench-emergency-golden-path.ts

# Or with npx
npx tsx scripts/qa-bench-emergency-golden-path.ts
```

## Expected Output

```
========================================
QA Golden Path: Bench + Emergency
========================================

🧹 Cleaning up previous QA data...

📍 Step 1: Ensuring portal exists...
   Using existing portal: f0cb44d0-beb2-46ac-8128-e66fc430b23f

👤 Step 2: Creating 6 test individuals...
   Created 6 individuals

📋 Step 3: Upserting bench entries...
✅ PASS: Bench upsert - created exactly 6 records for portal

🏠 Step 4: Creating housing waitlist entries with tiering...
✅ PASS: Waitlist entries - created exactly 2 entries with tier + staging

🚨 Step 5: Creating emergency replacement request...
   Created emergency request: abc123...

📊 Step 6: Testing candidate ordering...
   Ordered candidates:
     1. Alice OnSite Hostel (on_site, priority=80)
     2. Bob OnSite Campground (on_site, priority=50)
     3. Carol Ready One (ready, priority=0)
     4. Dan Ready Two (ready, priority=0)
     5. Eve Ready Three (ready, priority=0)
     6. Frank Cleared (cleared, priority=0)

✅ PASS: Candidate ordering - on_site (by priority) > ready > cleared

🔄 Step 7: Testing routing idempotency...
✅ PASS: First routing - emergency request filled successfully
✅ PASS: Second routing - correctly rejected (idempotent - no duplicate)

========================================
SUMMARY
========================================

✅ Bench upsert: created exactly 6 records for portal
✅ Waitlist entries: created exactly 2 entries with tier + staging
✅ Candidate ordering: on_site (by priority) > ready > cleared
✅ First routing: emergency request filled successfully
✅ Second routing: correctly rejected (idempotent - no duplicate)

5 passed, 0 failed
```

## Idempotency

The script is safe to run repeatedly:
- All test data uses `qa_bench_emergency_` prefix
- Previous QA data is cleaned up at start
- Uses `ON CONFLICT DO UPDATE` for bench entries
- Routing uses `WHERE filled_by_bench_id IS NULL` guard

## Exit Codes

- `0` - All assertions passed
- `1` - One or more assertions failed
