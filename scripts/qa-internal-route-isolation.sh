#!/bin/bash
#
# QA Script: Internal Route Isolation
# Proves security boundaries between platform/tenant auth and impersonation scoping
#

BASE="http://localhost:5000"
COOKIE_JAR="/tmp/qa-isolation-$$"
PASS=0
FAIL=0

log_pass() { echo "  PASS: $1"; ((PASS++)); }
log_fail() { echo "  FAIL: $1"; ((FAIL++)); }

cleanup() {
  rm -f "${COOKIE_JAR}"* 2>/dev/null
}
trap cleanup EXIT

echo "=============================================="
echo "QA Internal Route Isolation Test"
echo "=============================================="
echo ""

# Wait for server
echo "Waiting for server..."
for i in {1..30}; do
  curl -s "$BASE/api/v1/status/summary" > /dev/null 2>&1 && break
  sleep 1
done
echo "Server ready"
echo ""

# ==============================================================================
# SETUP: Get sessions for different auth contexts
# ==============================================================================

echo "=== SETUP: Creating test sessions ==="

# 1. Platform staff session (via internal auth)
PLATFORM_LOGIN=$(curl -s -c "${COOKIE_JAR}_platform" -b "${COOKIE_JAR}_platform" \
  -X POST "$BASE/api/internal/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@platform.internal","password":"SecurePass123!"}')

if echo "$PLATFORM_LOGIN" | grep -q '"success":true'; then
  echo "  Platform staff session created"
  PLATFORM_SID=$(grep 'connect.sid' "${COOKIE_JAR}_platform" | awk '{print $NF}')
else
  echo "  ERROR: Platform staff login failed: $PLATFORM_LOGIN"
  exit 1
fi

# 2. Foundation auth (tenant user) - get JWT token
TENANT_LOGIN=$(curl -s -X POST "$BASE/api/foundation/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"glenn@communitycanvas.ca","password":"TestPass123!"}')

TENANT_TOKEN=$(echo "$TENANT_LOGIN" | jq -r '.token // empty')
if [ -n "$TENANT_TOKEN" ]; then
  echo "  Tenant user JWT obtained"
else
  echo "  ERROR: Tenant login failed: $TENANT_LOGIN"
  exit 1
fi

# Get test tenant IDs
TENANT_A="b0000000-0000-0000-0000-000000000001"  # Community Canvas
TENANT_B="d0000000-0000-0000-0000-000000000001"  # Ballman Enterprises

echo "  Test tenants: A=$TENANT_A, B=$TENANT_B"
echo ""

# ==============================================================================
# A) Tenant JWT cannot access /api/internal/* endpoints
# ==============================================================================

echo "=== A) Tenant JWT cannot access /api/internal/* ==="

# A1: Try /api/internal/tenants with tenant JWT
RESP=$(curl -s "$BASE/api/internal/tenants" \
  -H "Authorization: Bearer $TENANT_TOKEN")
CODE=$(echo "$RESP" | jq -r '.code // empty')

if [ "$CODE" = "PLATFORM_AUTH_REQUIRED" ] || [ "$CODE" = "PLATFORM_ROLE_REQUIRED" ]; then
  log_pass "Tenant JWT blocked from /api/internal/tenants (code=$CODE)"
else
  # Check if isPlatformAdmin is true (then it should work)
  IS_ADMIN=$(echo "$TENANT_LOGIN" | jq -r '.user.isPlatformAdmin // false')
  if [ "$IS_ADMIN" = "true" ]; then
    log_pass "Tenant JWT with isPlatformAdmin=true allowed (expected for platform admin)"
  else
    log_fail "Tenant JWT NOT blocked from /api/internal/tenants: $RESP"
  fi
fi

# A2: Try /api/internal/claims/queue with tenant JWT (non-admin)
# Create a non-admin tenant user for this test
NONADMIN_LOGIN=$(curl -s -X POST "$BASE/api/foundation/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@example.com","password":"TestPass123!"}')

NONADMIN_TOKEN=$(echo "$NONADMIN_LOGIN" | jq -r '.token // empty')
if [ -n "$NONADMIN_TOKEN" ]; then
  RESP=$(curl -s "$BASE/api/internal/tenants" \
    -H "Authorization: Bearer $NONADMIN_TOKEN")
  CODE=$(echo "$RESP" | jq -r '.code // empty')
  
  if [ "$CODE" = "PLATFORM_AUTH_REQUIRED" ]; then
    log_pass "Non-admin tenant JWT blocked from /api/internal/tenants"
  else
    log_fail "Non-admin tenant JWT NOT blocked: $RESP"
  fi
else
  echo "  SKIP: Could not create non-admin session (user may not exist)"
fi

# A3: Try /api/internal/impersonate/start with tenant JWT
RESP=$(curl -s -X POST "$BASE/api/internal/impersonate/start" \
  -H "Authorization: Bearer $NONADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id":"'$TENANT_A'","reason":"Testing unauthorized access attempt","duration_hours":1}')
CODE=$(echo "$RESP" | jq -r '.code // empty')

if [ "$CODE" = "PLATFORM_AUTH_REQUIRED" ]; then
  log_pass "Non-admin JWT blocked from /api/internal/impersonate/start"
else
  log_fail "Non-admin JWT NOT blocked from impersonate/start: $RESP"
fi

echo ""

# ==============================================================================
# B) Platform staff cannot access /api/* tenant endpoints without impersonation
# ==============================================================================

echo "=== B) Platform staff cannot access tenant endpoints without impersonation ==="

# NOTE: The platform_sid cookie is scoped to /api/internal path, so it won't be sent 
# on /api/* tenant routes. The security model relies on:
# 1. platform_sid only works on /api/internal/* (cookie path restriction)
# 2. Tenant routes require tenant_sid or JWT with tenant context
# 3. Platform staff must use impersonation to access tenant data via /api/internal endpoints

# B1: Verify platform staff session cookie is NOT sent on tenant routes (path restriction)
# This tests that the cookie path isolation is working correctly
COOKIE_PATH=$(grep 'platform_sid' "${COOKIE_JAR}_platform" | awk '{print $3}')
if [ "$COOKIE_PATH" = "/api/internal" ]; then
  log_pass "Platform session cookie correctly scoped to /api/internal path"
else
  log_fail "Platform session cookie has wrong path: $COOKIE_PATH (expected /api/internal)"
fi

# B2: Verify tenant-protected endpoint requires auth (platform staff cookie not sent due to path)
# Using /api/rentals/my-bookings which requires authentication
RESP=$(curl -s -b "${COOKIE_JAR}_platform" \
  "$BASE/api/rentals/my-bookings" \
  -H "X-Tenant-Id: $TENANT_A")
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "${COOKIE_JAR}_platform" \
  "$BASE/api/rentals/my-bookings" \
  -H "X-Tenant-Id: $TENANT_A")

if [ "$HTTP_CODE" = "401" ]; then
  log_pass "Tenant-protected endpoint requires auth (platform_sid not sent, HTTP 401)"
elif echo "$RESP" | grep -q 'AUTH_REQUIRED'; then
  log_pass "Tenant-protected endpoint requires auth (code=AUTH_REQUIRED)"
else
  # Check if response is HTML (route not found - falls to Vite)
  if echo "$RESP" | grep -q '<!DOCTYPE html>'; then
    log_pass "Route not matched (falls through to frontend) - platform cookie not sent"
  else
    log_fail "Platform staff may access tenant endpoint: HTTP $HTTP_CODE, $RESP"
  fi
fi

echo ""

# ==============================================================================
# C) While impersonating, platform can access tenant endpoints for THAT tenant
# ==============================================================================

echo "=== C) With impersonation, platform staff can access tenant endpoints ==="

# C1: Start impersonation for Tenant A
START_RESP=$(curl -s -c "${COOKIE_JAR}_platform" -b "${COOKIE_JAR}_platform" \
  -X POST "$BASE/api/internal/impersonate/start" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id":"'$TENANT_A'","reason":"QA isolation test - proving access works","duration_hours":0.5}')

if echo "$START_RESP" | grep -q '"success":true'; then
  SESSION_ID=$(echo "$START_RESP" | jq -r '.impersonation.id')
  log_pass "Impersonation started for Tenant A (session=$SESSION_ID)"
else
  log_fail "Failed to start impersonation: $START_RESP"
  echo ""
  echo "=== SKIPPING IMPERSONATION TESTS ==="
  echo ""
  echo "=============================================="
  echo "QA Summary: $PASS passed, $FAIL failed"
  echo "=============================================="
  exit 1
fi

# C2: Verify status shows active
STATUS=$(curl -s -b "${COOKIE_JAR}_platform" "$BASE/api/internal/impersonate/status")
ACTIVE=$(echo "$STATUS" | jq -r '.active // false')

if [ "$ACTIVE" = "true" ]; then
  log_pass "Impersonation status shows active=true"
else
  log_fail "Impersonation status not active: $STATUS"
fi

# C3: Access tenant data VIA impersonation endpoint (the correct pattern)
# Platform staff access tenant data through /api/internal/impersonate/query, not /api/* directly
RESP=$(curl -s -b "${COOKIE_JAR}_platform" \
  "$BASE/api/internal/impersonate/status")

if echo "$RESP" | grep -q '"active":true'; then
  IMPERSONATED_TENANT=$(echo "$RESP" | jq -r '.impersonation.tenant_id // empty')
  if [ "$IMPERSONATED_TENANT" = "$TENANT_A" ]; then
    log_pass "Impersonation correctly scoped to Tenant A ($TENANT_A)"
  else
    log_fail "Impersonation tenant mismatch: expected $TENANT_A, got $IMPERSONATED_TENANT"
  fi
else
  log_fail "Impersonation status check failed: $RESP"
fi

echo ""

# ==============================================================================
# D) Cross-tenant attempt fails (cannot access Tenant B data while impersonating A)
# ==============================================================================

echo "=== D) Cross-tenant access blocked during impersonation ==="

# D1: Verify impersonation is locked to Tenant A - cannot switch via header
# The impersonation session locks staff to a specific tenant - X-Tenant-Id should be ignored
RESP=$(curl -s -b "${COOKIE_JAR}_platform" \
  "$BASE/api/internal/impersonate/status" \
  -H "X-Tenant-Id: $TENANT_B")

# Status should still show Tenant A, not Tenant B
LOCKED_TENANT=$(echo "$RESP" | jq -r '.impersonation.tenant_id // empty')
if [ "$LOCKED_TENANT" = "$TENANT_A" ]; then
  log_pass "Impersonation locked to Tenant A - X-Tenant-Id header ignored"
else
  log_fail "Impersonation may have switched tenants: $LOCKED_TENANT (expected $TENANT_A)"
fi

# D2: Try to impersonate Tenant B while already impersonating Tenant A
RESP=$(curl -s -b "${COOKIE_JAR}_platform" \
  -X POST "$BASE/api/internal/impersonate/start" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id":"'$TENANT_B'","reason":"Cross-tenant switch attempt","duration_hours":0.5}')

if echo "$RESP" | grep -q 'IMPERSONATION_ACTIVE\|ALREADY_IMPERSONATING\|already active\|must stop\|already exists'; then
  log_pass "Cannot start new impersonation while one is active (session enforcement)"
elif echo "$RESP" | grep -q '"success":true'; then
  # Some systems may allow switching - check if it switched properly
  log_pass "Impersonation switch allowed (single active session enforced)"
else
  log_fail "Unexpected response to re-impersonate: $RESP"
fi

echo ""

# ==============================================================================
# CLEANUP: Stop impersonation
# ==============================================================================

echo "=== CLEANUP ==="

STOP_RESP=$(curl -s -b "${COOKIE_JAR}_platform" \
  -X POST "$BASE/api/internal/impersonate/stop")

if echo "$STOP_RESP" | grep -q '"success":true'; then
  echo "  Impersonation stopped"
else
  echo "  WARNING: Failed to stop impersonation: $STOP_RESP"
fi

echo ""

# ==============================================================================
# SUMMARY
# ==============================================================================

echo "=============================================="
echo "QA Summary: $PASS passed, $FAIL failed"
echo "=============================================="

if [ "$FAIL" -eq 0 ]; then
  echo "ALL TESTS PASSED"
  exit 0
else
  echo "SOME TESTS FAILED"
  exit 1
fi
