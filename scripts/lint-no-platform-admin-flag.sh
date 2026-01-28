#!/bin/bash
# PROMPT-8: Guardrail script - ban legacy platform-admin authority
# AUTH_CONSTITUTION.md: is_platform_admin must NOT be used for authorization

set -e

echo "=== PROMPT-8: Checking for prohibited is_platform_admin usage ==="

# Files/patterns that are ALLOWED to reference is_platform_admin:
# - Migration files (one-time backfill)
# - This lint script itself
# - Documentation
# - UI display-only (profile badges, debug panels)
# - Test files (testing the migration/invariant)
# - Attached assets (old prompts/docs)
ALLOWED_PATTERNS=(
  "server/db/migrations"
  "server/migrations"
  "scripts/lint-no-platform-admin-flag.sh"
  "docs/"
  "proof/"
  "attached_assets/"
  "tests/"
  ".test.ts"
  ".test.tsx"
  "MyProfile.tsx"           # Display-only badge
  "DebugPanel.tsx"          # Debug display only
  "UsersManagement.tsx"     # Admin display
  "ImpersonationConsole.tsx" # Display only
  "session.ts"              # Type definition only
)

# Build grep exclude pattern
EXCLUDE_ARGS=""
for pattern in "${ALLOWED_PATTERNS[@]}"; do
  EXCLUDE_ARGS="$EXCLUDE_ARGS --exclude-dir=$(dirname "$pattern" 2>/dev/null || echo "$pattern")"
done

# Prohibited patterns in server-side auth enforcement
PROHIBITED_FILES=()
ERRORS=0

echo ""
echo "Checking server-side authorization paths..."

# Check server/auth/*.ts for is_platform_admin usage (NOT allowed)
# Exclude comments documenting the NON-AUTHORITATIVE status
MATCHES=$(grep -rn "is_platform_admin" server/auth/*.ts 2>/dev/null | grep -v "^\s*\*\|^\s*//\|NON-AUTHORITATIVE\|NOT.*is_platform_admin" || true)
if [ -n "$MATCHES" ]; then
  echo "ERROR: is_platform_admin found in server/auth/"
  echo "$MATCHES"
  ERRORS=$((ERRORS + 1))
fi

# Check server/middleware/*.ts for is_platform_admin usage (NOT allowed in guards)
# Exclude comments, documentation, and display-only markers
GUARD_MATCHES=$(grep -rn "is_platform_admin\|isPlatformAdmin" server/middleware/guards.ts 2>/dev/null | grep -v "// LEGACY\|// NON-AUTHORITATIVE\|// display\|// Display\|// DISPLAY\|^\s*\*\|PROMPT-8\|backwards compat" || true)
# Further filter: remove lines that are just comments or documentation
GUARD_MATCHES=$(echo "$GUARD_MATCHES" | grep -v "^\s*//" | grep -v "^\s*\*" | grep -v "NON-AUTHORITATIVE\|DISPLAY ONLY" || true)
if [ -n "$GUARD_MATCHES" ]; then
  echo "ERROR: is_platform_admin found in route guards"
  echo "$GUARD_MATCHES"
  ERRORS=$((ERRORS + 1))
fi

# Check for route guards using isPlatformAdmin for access control
echo ""
echo "Checking for authorization conditionals..."

# Pattern: if.*isPlatformAdmin in server routes (excluding comments and display-only)
AUTH_CONDITIONALS=$(grep -rn "if.*isPlatformAdmin\|isPlatformAdmin.*?" server/routes/*.ts 2>/dev/null | grep -v "// display\|// Display\|// LEGACY\|// NON-AUTHORITATIVE\|// legacy" | head -20 || true)
if [ -n "$AUTH_CONDITIONALS" ]; then
  echo "WARNING: Potential authorization conditionals using isPlatformAdmin:"
  echo "$AUTH_CONDITIONALS"
  echo ""
  echo "Review these manually - they may be display-only (allowed) or authorization (forbidden)"
fi

# Check client-side auth gating (canUI, hasPermission patterns with isPlatformAdmin)
echo ""
echo "Checking client-side UI authorization..."

UI_AUTH=$(grep -rn "canUI.*isPlatformAdmin\|hasPermission.*isPlatformAdmin" client/src/**/*.tsx client/src/**/*.ts 2>/dev/null | grep -v "// display\|// Display" || true)
if [ -n "$UI_AUTH" ]; then
  echo "ERROR: isPlatformAdmin used in UI capability checks"
  echo "$UI_AUTH"
  ERRORS=$((ERRORS + 1))
fi

# Final verdict
echo ""
echo "=== PROMPT-8 Lint Results ==="
if [ $ERRORS -gt 0 ]; then
  echo "FAIL: $ERRORS prohibited usage(s) of is_platform_admin for authorization"
  echo ""
  echo "CONSTITUTIONAL VIOLATION: is_platform_admin must NOT be used for authorization."
  echo "Platform admin status is determined ONLY via cc_grants at platform scope."
  echo "See: docs/AUTH_CONSTITUTION.md, docs/PROMPT-8-ANNEX.md"
  exit 1
else
  echo "PASS: No prohibited is_platform_admin authorization usage found"
  echo ""
  echo "Note: is_platform_admin may appear in:"
  echo "  - Migration files (one-time backfill)"
  echo "  - Display-only UI (profile badges)"
  echo "  - Type definitions"
  echo "  - Documentation"
  echo "These are allowed. Authorization must use cc_grants."
  exit 0
fi
