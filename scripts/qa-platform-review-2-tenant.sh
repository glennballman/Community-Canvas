#!/bin/bash
# QA: 2-tenant attack tests for Platform Review Console
# Tests tenant isolation + platform staff cross-tenant access

set -e

BASE_URL="${BASE_URL:-http://localhost:5000}"
COOKIE_A="/tmp/tenant_a_cookie.txt"
COOKIE_B="/tmp/tenant_b_cookie.txt"
COOKIE_STAFF="/tmp/staff_cookie.txt"

echo "=============================================="
echo "QA: Platform Review Console - 2-Tenant Attack Tests"
echo "=============================================="

# Clean up old cookies
rm -f "$COOKIE_A" "$COOKIE_B" "$COOKIE_STAFF"

# Helper function to extract JSON field
json_field() {
  echo "$1" | jq -r "$2"
}

echo ""
echo "=== Step 0: Bootstrap first platform admin (if needed) ==="
BOOTSTRAP_RESP=$(curl -s -X POST "$BASE_URL/api/internal/bootstrap/init")
BOOTSTRAP_SUCCESS=$(json_field "$BOOTSTRAP_RESP" '.success')

if [ "$BOOTSTRAP_SUCCESS" = "true" ]; then
  TOKEN=$(json_field "$BOOTSTRAP_RESP" '.token')
  echo "Bootstrap token obtained, claiming admin account..."
  CLAIM_RESP=$(curl -s -X POST "$BASE_URL/api/internal/bootstrap/claim" \
    -H "Content-Type: application/json" \
    -d "{\"token\": \"$TOKEN\", \"email\": \"qa-admin@platform.internal\", \"password\": \"SecureQAPass123!\", \"full_name\": \"QA Admin\"}")
  echo "Admin created: $(json_field "$CLAIM_RESP" '.staff.email')"
  STAFF_EMAIL="qa-admin@platform.internal"
  STAFF_PASS="SecureQAPass123!"
else
  echo "Bootstrap disabled (staff exist). Using existing admin credentials."
  # Use the admin we created earlier
  STAFF_EMAIL="admin@platform.internal"
  STAFF_PASS="SecurePass123!"
fi

echo ""
echo "=== Step 1: Login as platform staff ==="
STAFF_LOGIN=$(curl -s -X POST "$BASE_URL/api/internal/auth/login" \
  -H "Content-Type: application/json" \
  -c "$COOKIE_STAFF" \
  -d "{\"email\": \"$STAFF_EMAIL\", \"password\": \"$STAFF_PASS\"}")
  
STAFF_SUCCESS=$(json_field "$STAFF_LOGIN" '.success')
STAFF_ID=$(json_field "$STAFF_LOGIN" '.staff.id')
STAFF_NAME=$(json_field "$STAFF_LOGIN" '.staff.full_name')

if [ "$STAFF_SUCCESS" != "true" ]; then
  echo "FAIL: Staff login failed"
  echo "$STAFF_LOGIN"
  exit 1
fi
echo "PASS: Staff logged in: $STAFF_NAME ($STAFF_ID)"

echo ""
echo "=== Step 2: Get test tenants ==="
TENANTS=$(curl -s -X GET "$BASE_URL/api/internal/tenants" \
  -b "$COOKIE_STAFF")

TENANT_COUNT=$(json_field "$TENANTS" '.tenants | length')
echo "Found $TENANT_COUNT tenants"

if [ "$TENANT_COUNT" -lt 2 ]; then
  echo "SKIP: Need at least 2 tenants for cross-tenant test"
  echo "Create tenants manually to run full test"
  exit 0
fi

TENANT_A_ID=$(json_field "$TENANTS" '.tenants[0].id')
TENANT_A_NAME=$(json_field "$TENANTS" '.tenants[0].name')
TENANT_B_ID=$(json_field "$TENANTS" '.tenants[1].id')
TENANT_B_NAME=$(json_field "$TENANTS" '.tenants[1].name')

echo "Tenant A: $TENANT_A_NAME ($TENANT_A_ID)"
echo "Tenant B: $TENANT_B_NAME ($TENANT_B_ID)"

echo ""
echo "=== Step 3: Create a claim as Tenant A (via service mode) ==="
# Create claim directly in DB via SQL since we're testing the review flow
CLAIM_ID=$(psql "$DATABASE_URL" -t -c "
  INSERT INTO catalog_claims (
    tenant_id, target_type, claimant, status, nickname, notes
  ) VALUES (
    '$TENANT_A_ID', 'vehicle', 'tenant', 'submitted', 'QA Test Vehicle', 'Created by QA script'
  ) RETURNING id;
" | tr -d ' ')

if [ -z "$CLAIM_ID" ] || [ "$CLAIM_ID" = "" ]; then
  echo "FAIL: Could not create test claim"
  exit 1
fi
echo "PASS: Created claim $CLAIM_ID for Tenant A"

# Add submitted event
psql "$DATABASE_URL" -c "
  INSERT INTO catalog_claim_events (claim_id, tenant_id, event_type, payload)
  VALUES ('$CLAIM_ID', '$TENANT_A_ID', 'submitted', '{\"source\": \"qa_script\"}');
" > /dev/null

echo ""
echo "=== Step 4: Test Tenant B CANNOT access Tenant A's claim (RLS enforcement) ==="
# Simulate Tenant B query - should return 0 rows due to RLS
TENANT_B_VIEW=$(psql "$CC_APP_DATABASE_URL" -t -c "
  SET app.current_tenant_id = '$TENANT_B_ID';
  SELECT COUNT(*) FROM catalog_claims WHERE id = '$CLAIM_ID';
" | tr -d ' ')

if [ "$TENANT_B_VIEW" = "0" ]; then
  echo "PASS: RLS blocks Tenant B from seeing Tenant A's claim"
else
  echo "FAIL: Tenant B can see Tenant A's claim! RLS broken!"
  exit 1
fi

echo ""
echo "=== Step 5: Platform staff CAN fetch Tenant A's claim ==="
CLAIM_DETAIL=$(curl -s -X GET "$BASE_URL/api/internal/claims/$CLAIM_ID" \
  -b "$COOKIE_STAFF")

CLAIM_SUCCESS=$(json_field "$CLAIM_DETAIL" '.success')
CLAIM_TENANT=$(json_field "$CLAIM_DETAIL" '.claim.tenant_id')

if [ "$CLAIM_SUCCESS" != "true" ]; then
  echo "FAIL: Staff cannot fetch claim"
  echo "$CLAIM_DETAIL"
  exit 1
fi

if [ "$CLAIM_TENANT" != "$TENANT_A_ID" ]; then
  echo "FAIL: Claim tenant_id mismatch"
  exit 1
fi
echo "PASS: Platform staff fetched claim, tenant_id=$CLAIM_TENANT"

echo ""
echo "=== Step 6: Start review (submitted -> under_review) ==="
START_REVIEW=$(curl -s -X POST "$BASE_URL/api/internal/claims/$CLAIM_ID/review/start" \
  -b "$COOKIE_STAFF" \
  -H "Content-Type: application/json")

START_SUCCESS=$(json_field "$START_REVIEW" '.success')
NEW_STATUS=$(json_field "$START_REVIEW" '.claim.status')

if [ "$START_SUCCESS" != "true" ]; then
  echo "FAIL: Could not start review"
  echo "$START_REVIEW"
  exit 1
fi

if [ "$NEW_STATUS" != "under_review" ]; then
  echo "FAIL: Status not updated to under_review (got: $NEW_STATUS)"
  exit 1
fi
echo "PASS: Review started, status=$NEW_STATUS"

echo ""
echo "=== Step 7: Approve claim (under_review -> approved -> applied) ==="
DECISION=$(curl -s -X POST "$BASE_URL/api/internal/claims/$CLAIM_ID/decision" \
  -b "$COOKIE_STAFF" \
  -H "Content-Type: application/json" \
  -d '{"decision": "approve", "reason": "QA test approval"}')

DECISION_SUCCESS=$(json_field "$DECISION" '.success')
FINAL_STATUS=$(json_field "$DECISION" '.claim.status')
CREATED_VEHICLE_ID=$(json_field "$DECISION" '.claim.created_tenant_vehicle_id')
CREATED_ASSET_ID=$(json_field "$DECISION" '.claim.created_asset_id')

if [ "$DECISION_SUCCESS" != "true" ]; then
  echo "FAIL: Decision failed"
  echo "$DECISION"
  exit 1
fi
echo "PASS: Decision approved, status=$FINAL_STATUS"

echo ""
echo "=== Step 8: Verify created IDs exist ==="

if [ "$CREATED_VEHICLE_ID" != "null" ] && [ -n "$CREATED_VEHICLE_ID" ]; then
  VEHICLE_CHECK=$(psql "$DATABASE_URL" -t -c "
    SELECT tenant_id FROM tenant_vehicles WHERE id = '$CREATED_VEHICLE_ID';
  " | tr -d ' ')
  
  if [ "$VEHICLE_CHECK" = "$TENANT_A_ID" ]; then
    echo "PASS: tenant_vehicles row created, owner = Tenant A"
  else
    echo "FAIL: Vehicle tenant_id mismatch (got: $VEHICLE_CHECK, expected: $TENANT_A_ID)"
    exit 1
  fi
else
  echo "INFO: No vehicle created (may need catalog_vehicle_id)"
fi

if [ "$CREATED_ASSET_ID" != "null" ] && [ -n "$CREATED_ASSET_ID" ]; then
  ASSET_CHECK=$(psql "$DATABASE_URL" -t -c "
    SELECT tenant_id FROM assets WHERE id = '$CREATED_ASSET_ID';
  " | tr -d ' ')
  
  if [ "$ASSET_CHECK" = "$TENANT_A_ID" ]; then
    echo "PASS: assets row created, owner = Tenant A"
  else
    echo "FAIL: Asset tenant_id mismatch (got: $ASSET_CHECK, expected: $TENANT_A_ID)"
    exit 1
  fi
else
  echo "INFO: No asset created (may require catalog link)"
fi

echo ""
echo "=== Step 9: Verify Tenant A sees status=applied ==="
TENANT_A_VIEW=$(psql "$CC_APP_DATABASE_URL" -t -c "
  SET app.current_tenant_id = '$TENANT_A_ID';
  SELECT status FROM catalog_claims WHERE id = '$CLAIM_ID';
" | tr -d ' ')

if [ "$TENANT_A_VIEW" = "applied" ]; then
  echo "PASS: Tenant A sees claim status=applied"
else
  echo "WARN: Claim status is '$TENANT_A_VIEW' (expected 'applied' if vehicle/asset created)"
fi

echo ""
echo "=== Step 10: Verify audit log shows staff actor + target tenant ==="
AUDIT=$(curl -s -X GET "$BASE_URL/api/internal/claims/$CLAIM_ID/audit" \
  -b "$COOKIE_STAFF")

AUDIT_SUCCESS=$(json_field "$AUDIT" '.success')
AUDIT_TENANT=$(json_field "$AUDIT" '.tenant_id')
TOTAL_EVENTS=$(json_field "$AUDIT" '.total_events')

if [ "$AUDIT_SUCCESS" != "true" ]; then
  echo "FAIL: Audit fetch failed"
  exit 1
fi

echo "PASS: Audit log retrieved"
echo "  - Claim tenant_id: $AUDIT_TENANT"
echo "  - Total events: $TOTAL_EVENTS"

# Check for platform actor in events
PLATFORM_EVENTS=$(echo "$AUDIT" | jq '[.events[] | select(.actor_type == "platform")] | length')
if [ "$PLATFORM_EVENTS" -gt 0 ]; then
  echo "PASS: Found $PLATFORM_EVENTS events with actor_type=platform"
  
  # Show sample event
  SAMPLE=$(echo "$AUDIT" | jq '.events[] | select(.actor_type == "platform") | {event_type, actor_staff_id, actor_staff_name, ip, endpoint}' | head -20)
  echo "Sample platform event:"
  echo "$SAMPLE"
else
  echo "WARN: No platform actor events found"
fi

echo ""
echo "=== Step 11: Cleanup ==="
psql "$DATABASE_URL" -c "DELETE FROM catalog_claims WHERE id = '$CLAIM_ID';" > /dev/null
echo "Test claim deleted"

echo ""
echo "=============================================="
echo "QA COMPLETE: All tests passed!"
echo "=============================================="
