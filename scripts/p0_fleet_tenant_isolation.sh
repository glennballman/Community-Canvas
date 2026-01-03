#!/bin/bash

BASE_URL="${BASE_URL:-http://localhost:5000}"

echo "=============================================="
echo "P0 Fleet Tenant Isolation Test Script"
echo "=============================================="
echo ""

PASS_COUNT=0
FAIL_COUNT=0

pass() {
  echo "  PASS: $1"
  PASS_COUNT=$((PASS_COUNT + 1))
}

fail() {
  echo "  FAIL: $1"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

echo "=== STEP 1: Create Test Tenants ==="

psql "$DATABASE_URL" -qAt << 'SQL'
INSERT INTO cc_tenants (id, name, slug, tenant_type)
VALUES ('a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0', 'P0 Tenant A', 'p0-tenant-a', 'business')
ON CONFLICT (id) DO UPDATE SET name = 'P0 Tenant A';

INSERT INTO cc_tenants (id, name, slug, tenant_type)
VALUES ('b0b0b0b0-b0b0-b0b0-b0b0-b0b0b0b0b0b0', 'P0 Tenant B', 'p0-tenant-b', 'business')
ON CONFLICT (id) DO UPDATE SET name = 'P0 Tenant B';
SQL

echo "Tenants created"
echo ""

echo "=== STEP 2: Create Tenant A Vehicle ==="

VEHICLE_A_ID=$(psql "$DATABASE_URL" -qAt -c "
INSERT INTO vehicle_profiles (id, nickname, owner_type, vehicle_class, tenant_id)
VALUES ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'P0 Vehicle A', 'company', 'truck', 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0')
ON CONFLICT (id) DO UPDATE SET nickname = 'P0 Vehicle A', tenant_id = 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0'
RETURNING id;
")
echo "Created Vehicle A: $VEHICLE_A_ID"

psql "$DATABASE_URL" -qAt -c "
INSERT INTO vehicle_photos (id, vehicle_id, photo_type, photo_url)
VALUES ('c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1', 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'primary', 'https://tenant-a-photo.jpg')
ON CONFLICT (id) DO UPDATE SET photo_url = 'https://tenant-a-photo.jpg';
"
echo "Added photo to Vehicle A"
echo ""

echo "=== STEP 3: Test Anonymous Access (No Auth) ==="

ANON_LIST=$(curl -s "$BASE_URL/api/v1/fleet/vehicles")

if echo "$ANON_LIST" | grep -q "$VEHICLE_A_ID"; then
  fail "Anonymous sees tenant A vehicle in list"
else
  pass "Anonymous cannot see tenant A vehicle in list"
fi

ANON_SINGLE=$(curl -s "$BASE_URL/api/v1/fleet/vehicles/$VEHICLE_A_ID")
if echo "$ANON_SINGLE" | grep -q '"error"'; then
  pass "Anonymous GET /vehicles/:VA returns 404"
else
  fail "Anonymous GET /vehicles/:VA should return 404, got: $ANON_SINGLE"
fi

ANON_PHOTOS=$(curl -s "$BASE_URL/api/v1/fleet/vehicles/$VEHICLE_A_ID/photos")
if echo "$ANON_PHOTOS" | grep -q '"photos":\[\]'; then
  pass "Anonymous GET /vehicles/:VA/photos returns empty"
else
  fail "Anonymous photos should be empty for tenant vehicle, got: $ANON_PHOTOS"
fi

echo ""
echo "=== STEP 4: Test Mutation Guards (No Auth) ==="

POST_VEH=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE_URL/api/v1/fleet/vehicles" -H 'Content-Type: application/json' -d '{}')
if [ "$POST_VEH" = "401" ]; then pass "POST /vehicles returns 401"; else fail "POST /vehicles expected 401, got $POST_VEH"; fi

PATCH_VEH=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH "$BASE_URL/api/v1/fleet/vehicles/$VEHICLE_A_ID" -H 'Content-Type: application/json' -d '{}')
if [ "$PATCH_VEH" = "401" ]; then pass "PATCH /vehicles/:id returns 401"; else fail "PATCH /vehicles/:id expected 401, got $PATCH_VEH"; fi

POST_PHOTO=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE_URL/api/v1/fleet/vehicles/$VEHICLE_A_ID/photos" -H 'Content-Type: application/json' -d '{}')
if [ "$POST_PHOTO" = "401" ]; then pass "POST /vehicles/:id/photos returns 401"; else fail "POST /vehicles/:id/photos expected 401, got $POST_PHOTO"; fi

DELETE_PHOTO=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$BASE_URL/api/v1/fleet/vehicles/$VEHICLE_A_ID/photos/c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1")
if [ "$DELETE_PHOTO" = "401" ]; then pass "DELETE /vehicles/:id/photos/:id returns 401"; else fail "DELETE expected 401, got $DELETE_PHOTO"; fi

POST_TRAILER=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE_URL/api/v1/fleet/trailers" -H 'Content-Type: application/json' -d '{}')
if [ "$POST_TRAILER" = "401" ]; then pass "POST /trailers returns 401"; else fail "POST /trailers expected 401, got $POST_TRAILER"; fi

PATCH_TRAILER=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH "$BASE_URL/api/v1/fleet/trailers/fake-id" -H 'Content-Type: application/json' -d '{}')
if [ "$PATCH_TRAILER" = "401" ]; then pass "PATCH /trailers/:id returns 401"; else fail "PATCH /trailers/:id expected 401, got $PATCH_TRAILER"; fi

POST_HITCH=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE_URL/api/v1/fleet/trailers/fake-id/hitch" -H 'Content-Type: application/json' -d '{}')
if [ "$POST_HITCH" = "401" ]; then pass "POST /trailers/:id/hitch returns 401"; else fail "POST /trailers/:id/hitch expected 401, got $POST_HITCH"; fi

POST_UNHITCH=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE_URL/api/v1/fleet/trailers/fake-id/unhitch" -H 'Content-Type: application/json' -d '{}')
if [ "$POST_UNHITCH" = "401" ]; then pass "POST /trailers/:id/unhitch returns 401"; else fail "POST /trailers/:id/unhitch expected 401, got $POST_UNHITCH"; fi

POST_COMPAT=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE_URL/api/v1/fleet/compatibility-check" -H 'Content-Type: application/json' -d '{}')
if [ "$POST_COMPAT" = "401" ]; then pass "POST /compatibility-check returns 401"; else fail "POST /compatibility-check expected 401, got $POST_COMPAT"; fi

POST_DRIVER=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE_URL/api/v1/fleet/check-driver-qualification" -H 'Content-Type: application/json' -d '{}')
if [ "$POST_DRIVER" = "401" ]; then pass "POST /check-driver-qualification returns 401"; else fail "POST /check-driver-qualification expected 401, got $POST_DRIVER"; fi

echo ""
echo "=== STEP 5: Test Driver Qualification Endpoints (No Auth) ==="

DQ_SUMMARY=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/api/v1/fleet/driver-qualification-summary/a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0")
if [ "$DQ_SUMMARY" = "401" ]; then pass "GET /driver-qualification-summary/:id returns 401"; else fail "Expected 401, got $DQ_SUMMARY"; fi

DQ_GET=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/api/v1/fleet/driver-qualifications/a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0")
if [ "$DQ_GET" = "401" ]; then pass "GET /driver-qualifications/:id returns 401"; else fail "Expected 401, got $DQ_GET"; fi

DQ_PATCH=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH "$BASE_URL/api/v1/fleet/driver-qualifications/a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0" -H 'Content-Type: application/json' -d '{}')
if [ "$DQ_PATCH" = "401" ]; then pass "PATCH /driver-qualifications/:id returns 401"; else fail "Expected 401, got $DQ_PATCH"; fi

echo ""
echo "=== STEP 6: Cleanup ==="

psql "$DATABASE_URL" -q << 'SQL'
DELETE FROM vehicle_photos WHERE id = 'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1';
DELETE FROM vehicle_profiles WHERE id = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1';
DELETE FROM cc_tenants WHERE id IN ('a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0', 'b0b0b0b0-b0b0-b0b0-b0b0-b0b0b0b0b0b0');
SQL

echo "Cleanup complete"
echo ""

echo "=============================================="
echo "SUMMARY"
echo "=============================================="
echo "PASSED: $PASS_COUNT"
echo "FAILED: $FAIL_COUNT"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
  echo "P0 Fleet Tenant Isolation: PASS"
  exit 0
else
  echo "P0 Fleet Tenant Isolation: FAIL"
  exit 1
fi
