#!/usr/bin/env bash
set -euo pipefail

# Terminology Drift Check
# This script scans ACTIVE CODE for banned terms.
# 
# Banned terms: booking, booked, bookings, is_booked, instant_book
# 
# EXCLUDED from scan:
# - Documentation (docs/, *.md)
# - Migration history (server/migrations/)
# - Backups and cache (backups/, .cache/, node_modules/, dist/)
# - External data (attached_assets/, scripts/*.json, chamber-members.ts)
# - Sample/test data (sample*.ts, *.backup, *.bak)
# - QA test scripts (scripts/qa*.sh) - test existing endpoints
# - This script and rule docs

BANNED='(\bbooking(s)?\b|\bbooked\b|\bis_booked\b|\binstant_book\b)'

echo "Scanning active code for terminology drift..."

# Search with exclusions using ripgrep
VIOLATIONS=$(rg -n --hidden \
  --glob '!.git' \
  --glob '!node_modules' \
  --glob '!.cache' \
  --glob '!dist' \
  --glob '!attached_assets' \
  --glob '!backups' \
  --glob '!docs' \
  --glob '!*.md' \
  --glob '!server/migrations/*.sql' \
  --glob '!scripts/*.json' \
  --glob '!scripts/check-terminology.sh' \
  --glob '!scripts/qa*.sh' \
  --glob '!shared/chamber-members.ts' \
  --glob '!shared/chamber-members.ts.backup' \
  --glob '!shared/chamber-members.ts.bak' \
  --glob '!**/sample*.ts' \
  -i "$BANNED" . 2>/dev/null || true)

# Filter out remaining false positives
REAL_VIOLATIONS=$(echo "$VIOLATIONS" | grep -v -E \
  -e 'bcferries\.com/manage-booking' \
  -e 'Booking\.com' \
  -e 'booking\.com' \
  -e "summaryLower\.includes\('booked'\)" \
  -e "summaryLower\.includes\('booking\.com'\)" \
  -e "blockType.*\|\|.*'booked'" \
  -e "block\.blockType.*'booked'" \
  -e 'facebook' \
  -e '^$' \
  || true)

if [ -n "$REAL_VIOLATIONS" ]; then
  echo "$REAL_VIOLATIONS"
  echo ""
  echo "❌ Terminology drift detected in active code!"
  echo "Please replace banned terms with approved alternatives:"
  echo "  - booking → reservation"
  echo "  - booked → reserved (for capacity) or scheduled (for workflow)"
  echo "  - bookings → reservations"
  echo "  - is_booked → is_reserved"
  echo "  - instant_book → instant_reserve"
  echo ""
  echo "See docs/TERMINOLOGY_STANDARDS.md for details."
  exit 1
else
  echo "✅ Terminology clean - no drift detected in active code"
  exit 0
fi
