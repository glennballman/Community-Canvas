#!/bin/bash
# P0 QA Script - Multi-Tenant Isolation Tests
# Run this script to verify tenant isolation is working correctly
#
# Usage: ./scripts/qa_tenant_isolation.sh [BASE_URL]
# Default BASE_URL: http://localhost:5000

set -e

BASE_URL="${1:-http://localhost:5000}"
PASS_COUNT=0
FAIL_COUNT=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "================================================"
echo "P0 Multi-Tenant Isolation QA Tests"
echo "Base URL: $BASE_URL"
echo "================================================"
echo ""

# Helper function for test assertions
assert_status() {
    local test_name="$1"
    local expected_status="$2"
    local actual_status="$3"
    
    if [ "$actual_status" -eq "$expected_status" ]; then
        echo -e "${GREEN}[PASS]${NC} $test_name (HTTP $actual_status)"
        ((PASS_COUNT++))
    else
        echo -e "${RED}[FAIL]${NC} $test_name (Expected $expected_status, got $actual_status)"
        ((FAIL_COUNT++))
    fi
}

assert_contains() {
    local test_name="$1"
    local expected_text="$2"
    local response="$3"
    
    if echo "$response" | grep -q "$expected_text"; then
        echo -e "${GREEN}[PASS]${NC} $test_name (contains '$expected_text')"
        ((PASS_COUNT++))
    else
        echo -e "${RED}[FAIL]${NC} $test_name (missing '$expected_text')"
        ((FAIL_COUNT++))
    fi
}

assert_not_contains() {
    local test_name="$1"
    local forbidden_text="$2"
    local response="$3"
    
    if echo "$response" | grep -q "$forbidden_text"; then
        echo -e "${RED}[FAIL]${NC} $test_name (should not contain '$forbidden_text')"
        ((FAIL_COUNT++))
    else
        echo -e "${GREEN}[PASS]${NC} $test_name (correctly excludes '$forbidden_text')"
        ((PASS_COUNT++))
    fi
}

echo "========================================"
echo "1. PUBLIC REFERENCE DATA (should work)"
echo "========================================"

# Test public CivOS signals endpoint
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/civos/signals")
assert_status "CivOS signals - public access" 200 "$STATUS"

# Test public service runs categories
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/service-runs/categories")
assert_status "Service runs categories - public access" 200 "$STATUS"

# Test public rental browse
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/rentals/browse")
assert_status "Rentals browse - public access" 200 "$STATUS"

# Test public fleet vehicles list
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/fleet/vehicles")
assert_status "Fleet vehicles - public access" 200 "$STATUS"

echo ""
echo "========================================"
echo "2. SERVICE INTERNAL ENDPOINTS (blocked)"
echo "========================================"

# Test import routes WITHOUT service key (should be blocked)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/import/batches")
assert_status "Import batches - blocked without service key" 403 "$STATUS"

# Test import routes with WRONG service key (should be blocked)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "X-Internal-Service-Key: wrong-key-12345" \
    "$BASE_URL/api/import/batches")
assert_status "Import batches - blocked with wrong service key" 403 "$STATUS"

# Test import routes with CORRECT service key (should work)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "X-Internal-Service-Key: dev-internal-key-change-in-prod" \
    "$BASE_URL/api/import/batches")
assert_status "Import batches - allowed with correct service key" 200 "$STATUS"

echo ""
echo "========================================"
echo "3. AUTHENTICATED ENDPOINTS (auth check)"
echo "========================================"

# Test individuals/me without auth (should fail)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/individuals/me")
assert_status "Individuals /me - blocked without auth" 401 "$STATUS"

# Test my-skills without auth (should fail)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"skillId":"test"}' \
    "$BASE_URL/api/individuals/my-skills")
assert_status "Individuals my-skills POST - blocked without auth" 401 "$STATUS"

# Test apify datasets without auth (should fail)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/apify/datasets")
assert_status "Apify datasets - blocked without auth" 401 "$STATUS"

# Test entities datasets without auth (should fail)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/entities/datasets")
assert_status "Entities datasets - blocked without auth" 401 "$STATUS"

echo ""
echo "========================================"
echo "4. ADMIN-ONLY ENDPOINTS (role check)"
echo "========================================"

# These require authentication AND admin role
# Without valid session, should return 401 (not 403)

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/apify/stats")
assert_status "Apify stats - blocked (requires admin)" 401 "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/entities/records")
assert_status "Entity records - blocked (requires admin)" 401 "$STATUS"

echo ""
echo "========================================"
echo "5. FOUNDATION AUTH ENDPOINTS"
echo "========================================"

# Test login with invalid credentials
RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d '{"email":"nonexistent@test.com","password":"wrongpassword"}' \
    "$BASE_URL/api/foundation/auth/login")
assert_contains "Foundation login - invalid credentials rejected" "Invalid credentials" "$RESPONSE"

# Test login without credentials
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{}' \
    "$BASE_URL/api/foundation/auth/login")
assert_status "Foundation login - empty body rejected" 400 "$STATUS"

echo ""
echo "========================================"
echo "6. HOST DASHBOARD (auth check)"
echo "========================================"

# Test host properties without auth
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/host-dashboard/properties")
assert_status "Host properties - blocked without auth" 401 "$STATUS"

# Test host bookings without auth
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/host-dashboard/bookings")
assert_status "Host bookings - blocked without auth" 401 "$STATUS"

echo ""
echo "========================================"
echo "7. RESPONSE CONTENT CHECKS"
echo "========================================"

# Verify public endpoints don't leak sensitive data
RESPONSE=$(curl -s "$BASE_URL/api/v1/fleet/vehicles")
assert_not_contains "Fleet list - no password hashes" "password" "$RESPONSE"
assert_not_contains "Fleet list - no email addresses in list" "@" "$RESPONSE"

RESPONSE=$(curl -s "$BASE_URL/api/civos/signals?limit=5")
assert_not_contains "CivOS signals - no tenant_id exposed" "tenant_id" "$RESPONSE"

echo ""
echo "========================================"
echo "8. CROSS-TENANT ACCESS (UUID tests)"
echo "========================================"

# Test accessing non-existent UUID resources
FAKE_UUID="00000000-0000-0000-0000-000000000000"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/fleet/vehicles/$FAKE_UUID")
assert_status "Fleet vehicle - 404 for non-existent UUID" 404 "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/rentals/item/$FAKE_UUID")
assert_status "Rental item - 404 for non-existent UUID" 404 "$STATUS"

echo ""
echo "========================================"
echo "SUMMARY"
echo "========================================"
echo ""
echo -e "Passed: ${GREEN}$PASS_COUNT${NC}"
echo -e "Failed: ${RED}$FAIL_COUNT${NC}"
echo ""

if [ "$FAIL_COUNT" -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed. Review the output above.${NC}"
    exit 1
fi
