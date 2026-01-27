# Impersonation Forensic Evidence Report

## 1. Instrumented Files List

### client/src/lib/debugImpersonation.ts (NEW)
- Created debug logger utility
- Exports: `dbg()`, `now()`, `safePath()`, `shortUser()`, `shortImp()`
- All logs prefixed with `[IMPERSONATION_DBG]`

### client/src/components/routing/AppRouterSwitch.tsx
- **Line ~50**: Top-of-render dump `[AppRouterSwitch/render]`
- **Line ~100**: Before redirect `[AppRouterSwitch/redirect:beforeNavigate]`

### client/src/layouts/PlatformLayout.tsx
- **Line ~60**: Top-of-render dump `[PlatformLayout/render]`
- **Line ~122**: Early return for impersonation `[PlatformLayout/early:impersonating]`
- **Line ~140**: Early return for loading `[PlatformLayout/early:notReadyOrLoading]`
- **Line ~159**: Early return for no user `[PlatformLayout/early:noUser]`
- **Line ~166**: Early return for non-admin `[PlatformLayout/early:notAdmin]`
- **Line ~180**: Successful render `[PlatformLayout/render:success]`

### client/src/layouts/TenantAppLayout.tsx
- **Line ~91**: Top-of-render dump `[TenantAppLayout/render]`

### client/src/layouts/UserShellLayout.tsx
- **Line ~36**: Top-of-render dump `[UserShellLayout/render]`

### client/src/pages/app/platform/ImpersonationConsole.tsx
- **Line ~172**: Before fetch `[ImpersonationConsole/start:beforeFetch]`
- **Line ~194**: After fetch `[ImpersonationConsole/start:afterFetch]`
- **Line ~210**: After refresh `[ImpersonationConsole/start:afterRefresh]`
- **Line ~218**: Before navigate `[ImpersonationConsole/start:beforeNavigate]`
- **Line ~228**: After navigate `[ImpersonationConsole/start:afterNavigate]`

### client/src/components/ImpersonationBanner.tsx
- **Line ~83**: Before fetch `[ImpersonationBanner/stop:beforeFetch]`
- **Line ~99**: After fetch `[ImpersonationBanner/stop:afterFetch]`
- **Line ~117**: After refresh `[ImpersonationBanner/stop:afterRefresh]`
- **Line ~124**: Before navigate `[ImpersonationBanner/stop:beforeNavigate]`
- **Line ~131**: After navigate `[ImpersonationBanner/stop:afterNavigate]`

---

## 2. Runtime Capture Instructions

### Test Scenario A: Start Impersonation
1. Navigate to `/app/platform/impersonation`
2. Search for "mathew" or another test user
3. Click "Impersonate" button for that user
4. **OBSERVE**: What URL do you land on? What's visible?
5. Open browser console, filter for `[IMPERSONATION_DBG]`
6. Copy all logs

### Test Scenario B: Exit Impersonation
1. While impersonating, click "Exit Impersonation" (yellow banner button)
2. **OBSERVE**: What URL do you land on? What's visible? (blank/dark/correct?)
3. Open browser console, filter for `[IMPERSONATION_DBG]`
4. Copy all logs

---

## 3. Raw Console Log Output

**Paste filtered `[IMPERSONATION_DBG]` logs here:**

```
(paste logs here after running test scenarios)
```

---

## 4. Preliminary Observations (NO FIXES)

After reviewing logs, answer these questions:

### 4.1 Start Impersonation Flow
- What URL are we on when the user lands?
- Which layout(s) render at that moment?
- Did AppRouterSwitch redirect fire? From/to/reason?
- What is `impersonation.active` during each render?
- What is `authReady` during each render?

### 4.2 Exit Impersonation Flow (Blank Screen)
- What URL are we on when blank screen happens?
- Which layout(s) render at that moment?
- Which PlatformLayout early-return branch fired last?
- Did AppRouterSwitch redirect fire? If yes, from/to/reason?
- What is `impersonation.active` and `authReady` during each render?

### 4.3 Key Timing Questions
- Is there a gap between navigate() call and layout re-render?
- Does `authReady` become false during refresh, causing loading state?
- Does `impersonation.active` stay true after stop API returns?

---

## 5. Log Analysis Template

| Timestamp | Label | Key Values |
|-----------|-------|------------|
| | | |

---

**REMINDER: DO NOT SUGGEST FIXES IN THIS DOCUMENT. Observations only.**
