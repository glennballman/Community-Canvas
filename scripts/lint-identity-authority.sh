#!/bin/bash
# Phase 2C-16: Identity Authority Guardrail Script
# 
# Ensures TenantContext is not used for user identity - AuthContext is the single source.
# Run this script in CI or before commits to prevent regressions.
#
# FORBIDDEN PATTERNS:
# 1. Destructuring `user` from useTenant() - user identity must come from useAuth()
# 2. Using TenantContext.User type imports - no identity types in TenantContext
# 3. Accessing user.is_platform_admin (snake_case) - must use user.isPlatformAdmin (camelCase)
# 4. Accessing user.full_name (snake_case) - must use user.displayName (camelCase)

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS_FOUND=0
CLIENT_SRC="client/src"

echo "Phase 2C-16: Identity Authority Lint Check"
echo "==========================================="
echo ""

# Pattern 1: Check for user destructured from useTenant
echo "Checking for user destructured from useTenant()..."
PATTERN1_MATCHES=$(grep -rn "const.*{.*user.*}.*=.*useTenant" "$CLIENT_SRC" --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v "TenantContext.tsx" || true)
if [ -n "$PATTERN1_MATCHES" ]; then
  echo -e "${RED}ERROR: Found 'user' destructured from useTenant(). Use useAuth() instead:${NC}"
  echo "$PATTERN1_MATCHES"
  ERRORS_FOUND=$((ERRORS_FOUND + 1))
else
  echo -e "${GREEN}OK: No user destructured from useTenant()${NC}"
fi
echo ""

# Pattern 2: Check for is_platform_admin (snake_case) usage with user from hooks (not API data)
echo "Checking for user.is_platform_admin (snake_case) from hooks..."
# Exclude: AuthContext.tsx (transforms API data), API responses (context.user, data.user),
# DebugPanel.tsx (shows raw API data), UsersManagement.tsx (lists users from API)
PATTERN2_MATCHES=$(grep -rn "user\.\s*is_platform_admin\|user?\.\s*is_platform_admin" "$CLIENT_SRC" --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v "AuthContext.tsx" | grep -v "// Parse" | grep -v "data.user" | grep -v "context.user" | grep -v "DebugPanel.tsx" | grep -v "UsersManagement.tsx" || true)
if [ -n "$PATTERN2_MATCHES" ]; then
  echo -e "${RED}ERROR: Found user.is_platform_admin (snake_case). Use user.isPlatformAdmin instead:${NC}"
  echo "$PATTERN2_MATCHES"
  ERRORS_FOUND=$((ERRORS_FOUND + 1))
else
  echo -e "${GREEN}OK: No user.is_platform_admin snake_case usage${NC}"
fi
echo ""

# Pattern 3: Check for full_name (snake_case) usage with user from AuthContext
echo "Checking for user.full_name (snake_case) outside API parsing..."
PATTERN3_MATCHES=$(grep -rn "user\.\s*full_name\|user?\.\s*full_name" "$CLIENT_SRC" --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v "AuthContext.tsx" | grep -v "// Parse" | grep -v "data.user" || true)
if [ -n "$PATTERN3_MATCHES" ]; then
  echo -e "${RED}ERROR: Found user.full_name (snake_case). Use user.displayName instead:${NC}"
  echo "$PATTERN3_MATCHES"
  ERRORS_FOUND=$((ERRORS_FOUND + 1))
else
  echo -e "${GREEN}OK: No user.full_name snake_case usage${NC}"
fi
echo ""

# Pattern 4: Check for User type imports from TenantContext
echo "Checking for User type imports from TenantContext..."
PATTERN4_MATCHES=$(grep -rn "import.*{.*User.*}.*from.*TenantContext" "$CLIENT_SRC" --include="*.tsx" --include="*.ts" 2>/dev/null || true)
if [ -n "$PATTERN4_MATCHES" ]; then
  echo -e "${RED}ERROR: Found User type imported from TenantContext:${NC}"
  echo "$PATTERN4_MATCHES"
  ERRORS_FOUND=$((ERRORS_FOUND + 1))
else
  echo -e "${GREEN}OK: No User type imported from TenantContext${NC}"
fi
echo ""

# Summary
echo "==========================================="
if [ $ERRORS_FOUND -gt 0 ]; then
  echo -e "${RED}FAILED: Found $ERRORS_FOUND identity authority violation(s)${NC}"
  echo ""
  echo "FIX GUIDE:"
  echo "- User identity MUST come from useAuth() hook (AuthContext)"
  echo "- Use camelCase: isPlatformAdmin, displayName, firstName, lastName"
  echo "- TenantContext only for: memberships, currentTenant, impersonation, isCommunityOperator"
  exit 1
else
  echo -e "${GREEN}PASSED: Identity authority checks passed${NC}"
  exit 0
fi
