#!/bin/bash
# QA Smoke Test: Impersonation UI Flow
# Tests: start -> banner visible -> stop -> banner gone + endpoints blocked

# Don't use set -e as arithmetic expressions can return non-zero

BASE_URL="${BASE_URL:-http://localhost:5000}"
CURL_TIMEOUT="--max-time 10"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0

echo "=============================================="
echo "QA Impersonation UI Smoke Test"
echo "=============================================="
echo ""

# Wait for server
echo "Waiting for server to be ready..."
for i in {1..30}; do
  if curl -s $CURL_TIMEOUT "$BASE_URL/api/health" > /dev/null 2>&1; then
    echo "Server is ready"
    break
  fi
  sleep 1
done

# Use existing test tenants or create one
echo ""
echo "Setting up test data..."

# First try to find an existing tenant
TEST_TENANT_ID=$(psql "$DATABASE_URL" -t -c "SELECT id FROM cc_tenants LIMIT 1" 2>/dev/null | tr -d ' \n')

if [ -z "$TEST_TENANT_ID" ]; then
  # Create a test tenant if none exist
  TIMESTAMP=$(date +%s)
  TEST_TENANT_NAME="UI-Smoke-Test-$TIMESTAMP"
  TEST_TENANT_SLUG="ui-smoke-$TIMESTAMP"
  
  psql "$DATABASE_URL" -c "INSERT INTO cc_tenants (id, name, slug, tenant_type) VALUES (gen_random_uuid(), '$TEST_TENANT_NAME', '$TEST_TENANT_SLUG', 'business');" 2>/dev/null
  TEST_TENANT_ID=$(psql "$DATABASE_URL" -t -c "SELECT id FROM cc_tenants WHERE slug = '$TEST_TENANT_SLUG'" 2>/dev/null | tr -d ' \n')
fi

if [ -z "$TEST_TENANT_ID" ]; then
  echo -e "${RED}Failed to find or create test tenant${NC}"
  exit 1
fi

TEST_TENANT_NAME=$(psql "$DATABASE_URL" -t -c "SELECT name FROM cc_tenants WHERE id = '$TEST_TENANT_ID'" 2>/dev/null | tr -d '\n' | sed 's/^ *//')
echo "Using test tenant: $TEST_TENANT_ID ($TEST_TENANT_NAME)"

# Login as platform staff
echo ""
echo "A) Platform Staff Login..."
COOKIE_JAR=$(mktemp)
trap "rm -f $COOKIE_JAR" EXIT

LOGIN_RESPONSE=$(curl -s $CURL_TIMEOUT -X POST "$BASE_URL/api/internal/auth/login" \
  -H "Content-Type: application/json" \
  -c "$COOKIE_JAR" \
  -d '{"email":"admin@platform.internal","password":"SecurePass123!"}')

if echo "$LOGIN_RESPONSE" | grep -q '"success":true'; then
  echo -e "  ${GREEN}PASS${NC}: Platform staff login successful"
  ((PASS++))
else
  echo -e "  ${RED}FAIL${NC}: Platform staff login failed"
  echo "  Response: $LOGIN_RESPONSE"
  ((FAIL++))
fi

# B) Verify no active impersonation initially
echo ""
echo "B) Verify No Active Impersonation..."
STATUS_BEFORE=$(curl -s $CURL_TIMEOUT "$BASE_URL/api/internal/impersonate/status" \
  -b "$COOKIE_JAR")

if echo "$STATUS_BEFORE" | grep -q '"active":false'; then
  echo -e "  ${GREEN}PASS${NC}: No active impersonation initially"
  ((PASS++))
else
  echo -e "  ${YELLOW}INFO${NC}: May have existing session, stopping it..."
  curl -s $CURL_TIMEOUT -X POST "$BASE_URL/api/internal/impersonate/stop" -b "$COOKIE_JAR" > /dev/null
  ((PASS++))
fi

# C) Verify tenant endpoint blocked before impersonation
echo ""
echo "C) Verify Tenant Endpoint Blocked Before Impersonation..."
CLAIMS_BEFORE=$(curl -s $CURL_TIMEOUT "$BASE_URL/api/v1/catalog/claims" \
  -b "$COOKIE_JAR")

if echo "$CLAIMS_BEFORE" | grep -qE "AUTH_REQUIRED|TENANT_REQUIRED|401|403"; then
  echo -e "  ${GREEN}PASS${NC}: Tenant endpoint blocked before impersonation"
  ((PASS++))
else
  echo -e "  ${RED}FAIL${NC}: Tenant endpoint should be blocked"
  echo "  Response: $CLAIMS_BEFORE"
  ((FAIL++))
fi

# D) Start impersonation
echo ""
echo "D) Start Impersonation..."
REASON="UI smoke test - verifying impersonation flow works correctly"
START_RESPONSE=$(curl -s $CURL_TIMEOUT -X POST "$BASE_URL/api/internal/impersonate/start" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -c "$COOKIE_JAR" \
  -d "{\"tenant_id\":\"$TEST_TENANT_ID\",\"reason\":\"$REASON\",\"duration_hours\":1}")

if echo "$START_RESPONSE" | grep -q '"success":true'; then
  echo -e "  ${GREEN}PASS${NC}: Impersonation started successfully"
  ((PASS++))
  
  SESSION_ID=$(echo "$START_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  TENANT_NAME=$(echo "$START_RESPONSE" | grep -o '"tenant_name":"[^"]*"' | cut -d'"' -f4)
  echo "  Session ID: $SESSION_ID"
  echo "  Tenant: $TENANT_NAME"
else
  echo -e "  ${RED}FAIL${NC}: Failed to start impersonation"
  echo "  Response: $START_RESPONSE"
  ((FAIL++))
fi

# E) Verify impersonation status shows active
echo ""
echo "E) Verify Impersonation Status Active..."
STATUS_ACTIVE=$(curl -s $CURL_TIMEOUT "$BASE_URL/api/internal/impersonate/status" \
  -b "$COOKIE_JAR")

if echo "$STATUS_ACTIVE" | grep -q '"active":true'; then
  echo -e "  ${GREEN}PASS${NC}: Impersonation status shows active"
  ((PASS++))
  
  # Extract session details for banner verification
  if echo "$STATUS_ACTIVE" | grep -q "$TEST_TENANT_NAME"; then
    echo -e "  ${GREEN}PASS${NC}: Status includes correct tenant name"
    ((PASS++))
  else
    echo -e "  ${RED}FAIL${NC}: Status missing tenant name"
    ((FAIL++))
  fi
  
  if echo "$STATUS_ACTIVE" | grep -q "expires_at"; then
    echo -e "  ${GREEN}PASS${NC}: Status includes expiry time (for banner)"
    ((PASS++))
  else
    echo -e "  ${RED}FAIL${NC}: Status missing expiry time"
    ((FAIL++))
  fi
else
  echo -e "  ${RED}FAIL${NC}: Impersonation status should be active"
  echo "  Response: $STATUS_ACTIVE"
  ((FAIL++))
fi

# F) Verify impersonation_sid cookie was set
echo ""
echo "F) Verify Impersonation Cookie Set..."
if grep -q "impersonation_sid" "$COOKIE_JAR"; then
  echo -e "  ${GREEN}PASS${NC}: impersonation_sid cookie present"
  ((PASS++))
else
  echo -e "  ${RED}FAIL${NC}: impersonation_sid cookie missing"
  ((FAIL++))
fi

# G) Stop impersonation
echo ""
echo "G) Stop Impersonation..."
STOP_RESPONSE=$(curl -s $CURL_TIMEOUT -X POST "$BASE_URL/api/internal/impersonate/stop" \
  -b "$COOKIE_JAR" \
  -c "$COOKIE_JAR")

if echo "$STOP_RESPONSE" | grep -q '"success":true'; then
  echo -e "  ${GREEN}PASS${NC}: Impersonation stopped successfully"
  ((PASS++))
else
  echo -e "  ${RED}FAIL${NC}: Failed to stop impersonation"
  echo "  Response: $STOP_RESPONSE"
  ((FAIL++))
fi

# H) Verify status now shows inactive
echo ""
echo "H) Verify Status Inactive After Stop..."
STATUS_AFTER=$(curl -s $CURL_TIMEOUT "$BASE_URL/api/internal/impersonate/status" \
  -b "$COOKIE_JAR")

if echo "$STATUS_AFTER" | grep -q '"active":false'; then
  echo -e "  ${GREEN}PASS${NC}: Status shows inactive after stop"
  ((PASS++))
else
  echo -e "  ${RED}FAIL${NC}: Status should show inactive after stop"
  echo "  Response: $STATUS_AFTER"
  ((FAIL++))
fi

# I) Verify tenant endpoint blocked after stop
echo ""
echo "I) Verify Tenant Endpoint Blocked After Stop..."
CLAIMS_AFTER=$(curl -s $CURL_TIMEOUT "$BASE_URL/api/v1/catalog/claims" \
  -b "$COOKIE_JAR")

if echo "$CLAIMS_AFTER" | grep -qE "AUTH_REQUIRED|TENANT_REQUIRED|401|403"; then
  echo -e "  ${GREEN}PASS${NC}: Tenant endpoint blocked after impersonation stopped"
  ((PASS++))
else
  echo -e "  ${RED}FAIL${NC}: Tenant endpoint should be blocked after stop"
  echo "  Response: $CLAIMS_AFTER"
  ((FAIL++))
fi

# J) Verify session persistence (start new, check status, refresh simulated)
echo ""
echo "J) Verify Session Persistence Across Requests..."
START2_RESPONSE=$(curl -s $CURL_TIMEOUT -X POST "$BASE_URL/api/internal/impersonate/start" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -c "$COOKIE_JAR" \
  -d "{\"tenant_id\":\"$TEST_TENANT_ID\",\"reason\":\"$REASON\",\"duration_hours\":1}")

if echo "$START2_RESPONSE" | grep -q '"success":true'; then
  # Simulate page refresh by making new request with same cookies
  STATUS_REFRESH=$(curl -s $CURL_TIMEOUT "$BASE_URL/api/internal/impersonate/status" \
    -b "$COOKIE_JAR")
  
  if echo "$STATUS_REFRESH" | grep -q '"active":true'; then
    echo -e "  ${GREEN}PASS${NC}: Session persists across requests (simulates browser refresh)"
    ((PASS++))
  else
    echo -e "  ${RED}FAIL${NC}: Session should persist across requests"
    ((FAIL++))
  fi
  
  # Clean up
  curl -s $CURL_TIMEOUT -X POST "$BASE_URL/api/internal/impersonate/stop" -b "$COOKIE_JAR" > /dev/null
else
  echo -e "  ${RED}FAIL${NC}: Failed to start second session for persistence test"
  ((FAIL++))
fi

# K) Verify banner data available via status endpoint
echo ""
echo "K) Verify Banner Data Structure..."
START3_RESPONSE=$(curl -s $CURL_TIMEOUT -X POST "$BASE_URL/api/internal/impersonate/start" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -c "$COOKIE_JAR" \
  -d "{\"tenant_id\":\"$TEST_TENANT_ID\",\"reason\":\"$REASON\",\"duration_hours\":1}")

if echo "$START3_RESPONSE" | grep -q '"success":true'; then
  BANNER_STATUS=$(curl -s $CURL_TIMEOUT "$BASE_URL/api/internal/impersonate/status" -b "$COOKIE_JAR")
  
  # Check all required fields for banner
  MISSING_FIELDS=""
  
  if ! echo "$BANNER_STATUS" | grep -q '"tenant_name"'; then
    MISSING_FIELDS="$MISSING_FIELDS tenant_name"
  fi
  if ! echo "$BANNER_STATUS" | grep -q '"expires_at"'; then
    MISSING_FIELDS="$MISSING_FIELDS expires_at"
  fi
  if ! echo "$BANNER_STATUS" | grep -q '"remaining_seconds"'; then
    MISSING_FIELDS="$MISSING_FIELDS remaining_seconds"
  fi
  
  if [ -z "$MISSING_FIELDS" ]; then
    echo -e "  ${GREEN}PASS${NC}: All banner required fields present"
    ((PASS++))
  else
    echo -e "  ${RED}FAIL${NC}: Missing banner fields:$MISSING_FIELDS"
    ((FAIL++))
  fi
  
  # Clean up
  curl -s $CURL_TIMEOUT -X POST "$BASE_URL/api/internal/impersonate/stop" -b "$COOKIE_JAR" > /dev/null
else
  echo -e "  ${RED}FAIL${NC}: Failed to start session for banner test"
  ((FAIL++))
fi

# Note: Using existing tenant for test, no cleanup needed

echo ""
echo "=============================================="
echo "QA Summary: $PASS passed, $FAIL failed"
echo "=============================================="

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}ALL TESTS PASSED${NC}"
  exit 0
else
  echo -e "${RED}SOME TESTS FAILED${NC}"
  exit 1
fi
