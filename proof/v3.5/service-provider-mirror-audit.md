# V3.5 Service Provider Mirror View - Proof-Grade Inventory Audit

**Date**: 2026-01-23  
**Author**: Platform Engineering  
**Mode**: Additive-only, evidence-based

---

## 0.1 Navigation Source-of-Truth

### Search Performed
```bash
rg -n "navItems|navigation|sideNav|leftNav|final navigation" client/src
```

### Canonical Navigation Config Files
| File | Purpose |
|------|---------|
| `client/src/lib/routes/v3Nav.ts` | V3 NAV - Single source of truth for /app/* navigation |
| `client/src/lib/routes/platformNav.ts` | Platform admin navigation |
| `client/src/lib/routes/founderNav.ts` | Founder mode navigation |

### Reference Documents Found
| File | Status |
|------|--------|
| `proof/v3.5/final-navigation-proposal.md` | EXISTS - Navigation proposal for unified nav |
| `proof/v3.5/nav-wiring-targets.md` | EXISTS - Nav wiring targets |

### Findings
- **v3Nav.ts** is the authoritative source for /app/* routes
- NO provider-specific nav entries exist in v3Nav.ts
- Provider pages are accessible via direct URL but not in main navigation

---

## 0.2 Provider Mirror Routes/Pages Inventory

### Search Performed
```bash
rg -n "ProviderInboxPage|ProviderRequestDetailPage" client/src
rg -n "/provider" client/src
```

### Provider Routes (from App.tsx)
| Route | Component | Purpose |
|-------|-----------|---------|
| `/app/provider/inbox` | `ProviderInboxPage` | Service request list for providers |
| `/app/provider/requests/:id` | `ProviderRequestDetailPage` | Request detail view |

### Provider Page Files
| File | Lines |
|------|-------|
| `client/src/pages/app/provider/ProviderInboxPage.tsx` | 253 lines |
| `client/src/pages/app/provider/ProviderRequestDetailPage.tsx` | 472 lines |

### Terminology Check
- ProviderInboxPage: Uses `actorRole: 'provider'` ✅
- ProviderRequestDetailPage: Uses `actorRole: 'provider'` ✅
- No instances of "contractor" in these files (verified via grep)

---

## 0.3 Provider Context Discovery

### Search Performed
```bash
rg -n "isProvider|providerMode|actorRole|currentRole" client/src
rg -n "useProvider|ProviderContext" client/src
```

### Provider Role Determination
| File | Method |
|------|--------|
| `ProviderInboxPage.tsx` | `useMarketActions({ actorRole: 'provider', ... })` |
| `ProviderRequestDetailPage.tsx` | `useMarketActions({ actorRole: 'provider', ... })` |

### Role Storage
- No global ProviderContext found
- Role is passed directly to useMarketActions on each page
- Role is determined by page context (provider pages use 'provider')

### Policy Files Using actorRole
| File | Usage |
|------|-------|
| `client/src/policy/marketModePolicy.ts` | Defines ActorRole type |
| `client/src/policy/useMarketActions.ts` | Consumes actorRole for CTA gating |
| `client/src/copy/useCopy.ts` | Uses actorRole for copy tokens |

---

## 0.4 Ops/Schedule Duplication Discovery

### Search Performed
```bash
rg -n "OpsCalendarBoardPage" client/src
rg -n "ScheduleBoard" client/src
rg -n "calendar" client/src
```

### Canonical Ops/Schedule View
| File | Mode Parameter |
|------|----------------|
| `client/src/pages/shared/OpsCalendarBoardPage.tsx` | `mode: 'contractor' | 'resident' | 'portal'` |
| `client/src/components/schedule/ScheduleBoard.tsx` | Time spine component (used by OpsCalendarBoardPage) |

### Canonical Routes (from App.tsx)
| Route | Mode | Audience |
|-------|------|----------|
| `/app/contractor/calendar` | `contractor` | Service providers |
| `/app/my-place/calendar` | `resident` | Residents |
| `/p/:portalSlug/calendar` | `portal` | Public portal |

### Provider-Specific Ops/Schedule Routes
**NONE FOUND** - Provider pages do not have their own ops/schedule entrypoint.

### Legacy/Deprecated Calendar Files
| File | Status |
|------|--------|
| `client/src/_deprecated/pages/PortalCalendarPage.tsx` | DEPRECATED |
| `client/src/_deprecated/pages/ResidentCalendarPage.tsx` | DEPRECATED |
| `client/src/_deprecated/pages/ContractorCalendarPage.tsx` | DEPRECATED |
| `client/src/_deprecated/calendar/CalendarGrid.tsx` | DEPRECATED |
| `client/src/_deprecated/pages/ServiceRunsCalendarPage.tsx` | DEPRECATED |

### "calendar" Mentions (Non-Deprecated)
| File | Context |
|------|---------|
| `client/src/pages/shared/OpsCalendarBoardPage.tsx` | Canonical view |
| `client/src/lib/routes/v3Nav.ts` | Uses `Calendar` icon import |
| `client/src/components/ui/calendar.tsx` | Shadcn calendar picker component |
| `client/src/pages/host/HostCalendar.tsx` | Host-specific calendar (not provider) |
| `client/src/pages/app/provider/ProviderInboxPage.tsx` | Uses `Calendar` icon import for date display |
| `client/src/pages/app/provider/ProviderRequestDetailPage.tsx` | Uses `Calendar` icon import for date display |

**Note**: Provider pages use Calendar icon for date display only - no new calendar surfaces created.

---

## 0.5 Mirror View Completeness Assessment

### ProviderInboxPage.tsx - COMPLETE ✅
| Criteria | Status | Evidence |
|----------|--------|----------|
| Renders workflow detail read-only | ✅ | Lists service requests with status, title, requester, description (line 191-245) |
| No new mutation controls outside CTAs | ✅ | Uses `RequestActionButtons` with `useMarketActions` (line 57-101) |
| MarketMode-gated CTAs | ✅ | `useMarketActions({ actorRole: 'provider', ... })` (line 58-67) |
| Links to detail page | ✅ | `<Link to={/app/provider/requests/${request.id}}>` (line 197) |
| No inline thread embedding | ✅ | No ConversationView or thread component used |

### ProviderRequestDetailPage.tsx - COMPLETE ✅
| Criteria | Status | Evidence |
|----------|--------|----------|
| Renders workflow detail read-only | ✅ | Shows request summary, requester, date, location, description, notes (line 230-290) |
| No new mutation controls outside CTAs | ✅ | Uses dialogs triggered by MarketMode-gated buttons (line 299-335) |
| MarketMode-gated CTAs | ✅ | `useMarketActions({ actorRole: 'provider', ... })` (line 104-113) |
| Action dialogs for mutations | ✅ | Accept, Propose, Decline dialogs (line 347-468) |
| No inline thread embedding | ✅ | No ConversationView - uses separate dialog-based actions |
| Links to inbox on decline | ✅ | `navigate('/app/provider/inbox')` (line 169) |

### Job Context (Provider Perspective)
| Component | Status |
|-----------|--------|
| `JobConversationPanel.tsx` | Uses MessageActionBlock for action handling (Step 2) |
| Provider job view pages | NOT FOUND - Jobs use existing `/app/jobs/*` routes |

### Reservation Context (Provider Perspective)
| Status | Finding |
|--------|---------|
| Provider reservation pages | NOT FOUND - Providers don't have dedicated reservation pages |
| Reservation thread linking | N/A - No provider-specific reservation views exist |

---

## 0.6 Summary: No Changes Required

### Navigation
- Provider has NO dedicated ops/schedule entrypoint → No duplicate to remove
- Provider pages are not in v3Nav.ts → No nav cleanup needed
- Canonical ops/schedule view (OpsCalendarBoardPage) is correctly singular

### Mirror View
- ProviderInboxPage: COMPLETE (read-only list, MarketMode CTAs, links to detail)
- ProviderRequestDetailPage: COMPLETE (read-only detail, dialog-based actions, MarketMode CTAs)
- No inline thread embedding (correct - no duplicate messaging surfaces)
- No new calendar/schedule surfaces in provider pages

### Action Flow
- All mutations via existing MarketMode-gated CTAs (accept/propose/decline)
- Dialog-based action confirmation
- No new CTA surfaces created

### Thread Linking
- Provider detail page does NOT embed ConversationView (correct per spec)
- If messaging is needed, it should link to existing ConversationView route (not currently implemented - but this is acceptable per "COMPLETE" criteria since page doesn't create parallel surfaces)

---

## 0.7 Recommendation

**SKIP MODIFICATIONS** - Provider mirror view pages meet all COMPLETE criteria:
1. ✅ Render workflow detail read-only
2. ✅ No new mutation controls outside MarketMode CTAs
3. ✅ No duplicate action buttons outside dialogs
4. ✅ No inline thread rendering (no parallel messaging surfaces)
5. ✅ MarketMode policy gates all CTAs

**Optional Enhancement (Not Required)**:
- Could add "View Messages" link to existing ConversationView route if a conversation exists for the service request
- This would be additive and not violate any rules

---

## END
