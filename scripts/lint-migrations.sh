#!/bin/bash
# Migration Lint Script
# Checks that CREATE TABLE statements are accompanied by GRANT statements

set -e

MIGRATIONS_DIR="${1:-server/migrations}"
FAILURES=0

echo "=================================================="
echo "Migration Lint: Checking for missing GRANTs"
echo "=================================================="

for file in "$MIGRATIONS_DIR"/*.sql; do
  if [ ! -f "$file" ]; then
    continue
  fi

  filename=$(basename "$file")
  
  # Check if file has CREATE TABLE
  if grep -qi "CREATE TABLE" "$file"; then
    # Check if file also has GRANT ... TO cc_app
    if ! grep -qi "GRANT.*TO cc_app" "$file"; then
      echo "[FAIL] $filename: Has CREATE TABLE but missing GRANT TO cc_app"
      FAILURES=$((FAILURES + 1))
    else
      echo "[OK] $filename"
    fi
  fi
done

echo "=================================================="

if [ $FAILURES -gt 0 ]; then
  echo "[FAIL] $FAILURES migration(s) missing GRANT statements"
  echo ""
  echo "Fix by adding after each CREATE TABLE:"
  echo "  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE <table_name> TO cc_app;"
  echo "  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE <table_name> TO cc_owner;"
  exit 1
else
  echo "[PASS] All migrations with CREATE TABLE have GRANT statements"
  exit 0
fi
