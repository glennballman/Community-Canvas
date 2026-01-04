#!/bin/bash
# QA Script: Validate PostGIS Removal
# Tests location-based endpoints, distance ordering, and bounding box queries

set -e

BASE_URL="${BASE_URL:-http://localhost:5000}"
PASS=0
FAIL=0

log_pass() {
  echo "✓ PASS: $1"
  ((PASS++))
}

log_fail() {
  echo "✗ FAIL: $1"
  ((FAIL++))
}

echo "=============================================="
echo "QA: PostGIS Removal Validation"
echo "=============================================="
echo ""

# ---------------------------------------------
# Test 1: Migration files have no PostGIS types
# ---------------------------------------------
echo "--- Test 1: No PostGIS types in migrations ---"

if grep -q "GEOGRAPHY(POINT" server/migrations/018_external_data_lake_v2.sql 2>/dev/null; then
  log_fail "Migration 018 still has GEOGRAPHY(POINT"
else
  log_pass "Migration 018 has no GEOGRAPHY(POINT"
fi

if grep -q "GEOGRAPHY(POINT" server/migrations/020_unified_assets_registry.sql 2>/dev/null; then
  log_fail "Migration 020 still has GEOGRAPHY(POINT"
else
  log_pass "Migration 020 has no GEOGRAPHY(POINT"
fi

if grep -q "GEOGRAPHY(POINT" server/migrations/021_capability_architecture.sql 2>/dev/null; then
  log_fail "Migration 021 still has GEOGRAPHY(POINT"
else
  log_pass "Migration 021 has no GEOGRAPHY(POINT"
fi

if grep -q "GEOGRAPHY(POINT" server/migrations/022_construction_os_expansion.sql 2>/dev/null; then
  log_fail "Migration 022 still has GEOGRAPHY(POINT"
else
  log_pass "Migration 022 has no GEOGRAPHY(POINT"
fi

# ---------------------------------------------
# Test 2: No ST_* functions in migrations
# ---------------------------------------------
echo ""
echo "--- Test 2: No ST_* functions in migrations ---"

for migration in 018 019 020 021 022; do
  file="server/migrations/${migration}_*.sql"
  if grep -q "ST_SetSRID\|ST_MakePoint\|ST_Distance\|ST_DWithin" $file 2>/dev/null; then
    log_fail "Migration $migration still has ST_* functions"
  else
    log_pass "Migration $migration has no ST_* functions"
  fi
done

# ---------------------------------------------
# Test 3: No GIST indexes on geom columns
# ---------------------------------------------
echo ""
echo "--- Test 3: No GIST indexes on geom columns ---"

if grep -q "USING gist(geom)" server/migrations/*.sql 2>/dev/null; then
  log_fail "Still have GIST indexes on geom columns"
else
  log_pass "No GIST indexes on geom columns"
fi

if grep -q "USING gist(site_geom)" server/migrations/*.sql 2>/dev/null; then
  log_fail "Still have GIST indexes on site_geom columns"
else
  log_pass "No GIST indexes on site_geom columns"
fi

# ---------------------------------------------
# Test 4: Lat/lng indexes exist
# ---------------------------------------------
echo ""
echo "--- Test 4: Lat/lng indexes exist ---"

if grep -q "idx_external_records_lat_lng" server/migrations/018_external_data_lake_v2.sql 2>/dev/null; then
  log_pass "external_records has lat/lng index"
else
  log_fail "external_records missing lat/lng index"
fi

if grep -q "idx_unified_assets_location.*latitude.*longitude" server/migrations/020_unified_assets_registry.sql 2>/dev/null; then
  log_pass "unified_assets has lat/lng location index"
else
  log_fail "unified_assets missing lat/lng location index"
fi

if grep -q "idx_assets_lat_lng" server/migrations/021_capability_architecture.sql 2>/dev/null; then
  log_pass "assets has lat/lng index"
else
  log_fail "assets missing lat/lng index"
fi

# ---------------------------------------------
# Test 5: Distance formula present
# ---------------------------------------------
echo ""
echo "--- Test 5: Euclidean distance formula present ---"

if grep -q "POWER.*latitude.*111" server/migrations/020_unified_assets_registry.sql 2>/dev/null; then
  log_pass "Migration 020 uses Euclidean distance formula"
else
  log_fail "Migration 020 missing Euclidean distance formula"
fi

if grep -q "POWER.*latitude.*111" server/migrations/021_capability_architecture.sql 2>/dev/null; then
  log_pass "Migration 021 uses Euclidean distance formula"
else
  log_fail "Migration 021 missing Euclidean distance formula"
fi

# ---------------------------------------------
# Test 6: Bounding box filter present
# ---------------------------------------------
echo ""
echo "--- Test 6: Bounding box filter present ---"

if grep -q "BETWEEN.*p_latitude.*radius_km.*111" server/migrations/020_unified_assets_registry.sql 2>/dev/null; then
  log_pass "Migration 020 uses bounding box filter"
else
  log_fail "Migration 020 missing bounding box filter"
fi

if grep -q "BETWEEN.*p_latitude.*radius_km.*111" server/migrations/021_capability_architecture.sql 2>/dev/null; then
  log_pass "Migration 021 uses bounding box filter"
else
  log_fail "Migration 021 missing bounding box filter"
fi

# ---------------------------------------------
# Test 7: Server health check
# ---------------------------------------------
echo ""
echo "--- Test 7: Server health check ---"

if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/health" 2>/dev/null | grep -q "200"; then
  log_pass "Server is running and healthy"
else
  log_fail "Server health check failed (may not be running)"
fi

# ---------------------------------------------
# Test 8: Communities endpoint works
# ---------------------------------------------
echo ""
echo "--- Test 8: Location-based endpoints ---"

# Test communities endpoint (should not error due to PostGIS)
COMMUNITIES_RESPONSE=$(curl -s "$BASE_URL/api/communities" 2>/dev/null || echo "ERROR")
if echo "$COMMUNITIES_RESPONSE" | grep -q "ERROR\|postgis\|geography"; then
  log_fail "Communities endpoint has PostGIS error"
else
  log_pass "Communities endpoint works without PostGIS errors"
fi

# ---------------------------------------------
# Summary
# ---------------------------------------------
echo ""
echo "=============================================="
echo "QA Summary: $PASS passed, $FAIL failed"
echo "=============================================="

if [ $FAIL -gt 0 ]; then
  exit 1
fi

exit 0
