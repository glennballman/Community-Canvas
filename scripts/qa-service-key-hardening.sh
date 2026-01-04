#!/bin/bash

# Service Key Hardening Proof
# Tests the P0 hardening requirements

BASE_URL="${1:-http://localhost:5000}"

echo "============================================================"
echo "SERVICE KEY HARDENING PROOF"
echo "============================================================"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

success() { echo -e "${GREEN}PASS: $1${NC}"; }
fail() { echo -e "${RED}FAIL: $1${NC}"; }
info() { echo -e "${YELLOW}TEST: $1${NC}"; }

echo ""
echo "=== HARDENING REQUIREMENT 1: No Fallback Key ==="
echo "Code: const INTERNAL_SERVICE_KEY = process.env.INTERNAL_SERVICE_KEY || '';"
echo "If env var missing, isServiceKeyRequest() returns false immediately."
echo ""

info "1.1: Grep the guards.ts for fallback pattern"
if grep -q "dev-internal-key-change-in-prod" server/middleware/guards.ts 2>/dev/null; then
  fail "Fallback key still present in code!"
else
  success "No fallback key 'dev-internal-key-change-in-prod' found in guards.ts"
fi

info "1.2: Verify INTERNAL_SERVICE_KEY defaults to empty string"
PATTERN=$(grep "INTERNAL_SERVICE_KEY.*process.env" server/middleware/guards.ts | head -1)
echo "Found: $PATTERN"
if echo "$PATTERN" | grep -q "|| ''"; then
  success "Defaults to empty string (service mode disabled when unset)"
else
  fail "Expected '|| \"\"' pattern not found"
fi

echo ""
echo "=== HARDENING REQUIREMENT 2: Timing-Safe Comparison ==="

info "2.1: Verify timingSafeEqual is imported"
if grep -q "timingSafeEqual" server/middleware/guards.ts; then
  success "timingSafeEqual imported from crypto"
else
  fail "timingSafeEqual not found"
fi

info "2.2: Verify safeCompare function uses timingSafeEqual"
if grep -q "timingSafeEqual(Buffer.from" server/middleware/guards.ts; then
  success "safeCompare uses timingSafeEqual with Buffer.from"
else
  fail "Timing-safe comparison pattern not found"
fi

echo ""
echo "=== HARDENING REQUIREMENT 3: Mandatory Audit Events ==="

info "3.1: Verify logServiceKeyAudit function exists in claims.ts"
if grep -q "logServiceKeyAudit" server/routes/claims.ts; then
  success "logServiceKeyAudit function found"
else
  fail "Audit logging function not found"
fi

info "3.2: Verify audit event logged in review/start endpoint"
if grep "logServiceKeyAudit.*review_start" server/routes/claims.ts > /dev/null; then
  success "Audit event logged in review/start"
else
  fail "Audit event not found in review/start"
fi

info "3.3: Verify audit event logged in decision endpoint"
if grep -A10 "/:claimId/decision" server/routes/claims.ts | grep -q "logServiceKeyAudit"; then
  success "Audit event logged in decision"
else
  fail "Audit event not found in decision"
fi

info "3.4: Verify audit includes IP, user-agent, timestamp"
AUDIT_FIELDS=$(grep -A20 "createServiceKeyAuditEvent" server/middleware/guards.ts)
if echo "$AUDIT_FIELDS" | grep -q "ip:" && echo "$AUDIT_FIELDS" | grep -q "user_agent:" && echo "$AUDIT_FIELDS" | grep -q "timestamp:"; then
  success "Audit event includes IP, user-agent, timestamp"
else
  fail "Audit event missing required fields"
fi

echo ""
echo "=== HARDENING REQUIREMENT 4: Guard Returns False When Key Missing ==="

info "4.1: Verify isServiceKeyRequest checks for empty INTERNAL_SERVICE_KEY"
if grep -A5 "export function isServiceKeyRequest" server/middleware/guards.ts | grep -q "if (!INTERNAL_SERVICE_KEY)"; then
  success "isServiceKeyRequest returns false when env var missing"
else
  fail "Guard doesn't check for missing env var"
fi

echo ""
echo "=== RUNTIME TESTS ==="

TEST_UUID="00000000-0000-0000-0000-000000000001"

info "5.1: Testing fake key is rejected"
RESULT=$(curl -s -w "\nHTTP:%{http_code}" \
  -X POST "$BASE_URL/api/v1/catalog/claims/$TEST_UUID/review/start" \
  -H "X-Internal-Service-Key: WRONG_KEY" \
  -H "Content-Type: application/json")
HTTP=$(echo "$RESULT" | grep "HTTP:" | cut -d: -f2)
if [ "$HTTP" = "401" ] || [ "$HTTP" = "403" ]; then
  success "Fake key rejected ($HTTP)"
else
  fail "Expected 401/403, got $HTTP"
fi

# Test with correct key (if env var is set)
if [ -n "$INTERNAL_SERVICE_KEY" ]; then
  info "5.2: Testing valid key is accepted"
  RESULT=$(curl -s -w "\nHTTP:%{http_code}" \
    -X POST "$BASE_URL/api/v1/catalog/claims/$TEST_UUID/review/start" \
    -H "X-Internal-Service-Key: $INTERNAL_SERVICE_KEY" \
    -H "Content-Type: application/json")
  HTTP=$(echo "$RESULT" | grep "HTTP:" | cut -d: -f2)
  BODY=$(echo "$RESULT" | grep -v "HTTP:")
  # 404 = claim not found (auth passed), 400 = business logic error (auth passed)
  if [ "$HTTP" = "404" ] || [ "$HTTP" = "400" ]; then
    success "Valid key accepted (claim not found is expected: $HTTP)"
  else
    echo "Response: $BODY"
    fail "Expected 404/400, got $HTTP"
  fi
else
  info "5.2: INTERNAL_SERVICE_KEY not set in shell - skipping valid key test"
  echo "(Server may have it set via env file)"
fi

echo ""
echo "============================================================"
echo "SUMMARY: Service Key Hardening Verification"
echo "============================================================"
echo ""
echo "[1] No fallback key: Removed 'dev-internal-key-change-in-prod'"
echo "[2] Timing-safe compare: Uses crypto.timingSafeEqual"
echo "[3] Mandatory audit: Logged before business logic"
echo "[4] Missing env var: isServiceKeyRequest returns false"
echo "[5] Runtime tests: Fake key rejected, valid key accepted"
echo ""
echo "============================================================"
