# U2 Portal & Onboarding Surfaces - QA Checklist

## Overview
This checklist validates the U2 deliverable: Portal & Onboarding Surfaces (Public → App).

## Routes Covered
| Route | Purpose | Status |
|-------|---------|--------|
| `/p/:portalSlug` | Public portal landing | Implemented |
| `/p/:portalSlug/onboarding` | Public onboarding form | Implemented |
| `/p/:portalSlug/reserve` | Reserve bridge | Existing |
| `/c/:slug/*` | Community portal shell | Implemented |

---

## Manual QA Checklist

### Portal Resolution
- [ ] Domain-based portal loads correct theme/copy
- [ ] Path-based `/p/:slug` fallback works
- [ ] Path-based `/c/:slug` fallback works

### Business Portal (`/p/:portalSlug`)
- [ ] Portal home page loads with navbar
- [ ] Portal name/brand displays correctly
- [ ] Hero section renders (if enabled in portal config)
- [ ] Assets section renders available assets
- [ ] "Reserve" button in navbar links to `/p/:portalSlug/reserve`
- [ ] "Enter App" button in navbar links to `/app` (NO query params)
- [ ] Footer shows portal legal name

### Portal Onboarding (`/p/:portalSlug/onboarding`)
- [ ] Form renders with portal branding
- [ ] "Back to [Portal Name]" link works
- [ ] Name and email fields are required
- [ ] Phone field is optional
- [ ] Submit shows success screen
- [ ] Success screen has "Enter App" → `/app` (NO query params)
- [ ] Success screen has "Make a Reservation" → `/p/:portalSlug/reserve`
- [ ] Contact email shown if configured in portal settings

### Reserve Bridge (`/p/:portalSlug/reserve`)
- [ ] Portal context is present
- [ ] Date picker works
- [ ] Available assets display
- [ ] Does NOT link to `/app/reservations` (ships in U4)

### Community Portal (`/c/:slug`)
- [ ] Overview page loads with portal name/tagline
- [ ] "Enter App" CTA links to `/app` (NO query params)
- [ ] Navigation tabs work (Businesses, Services, Stay, Events, About)
- [ ] "Sign In" button in header links to `/app`

### Enter App Behavior
- [ ] All "Enter App" links go to `/app` with NO query params
- [ ] If user is authenticated, lands at `/app`
- [ ] If user is not authenticated, lands at sign-in then `/app`
- [ ] Portal context remains set server-side (not in URL params)

---

## Test Data Requirements
- At least one active portal with slug (e.g., `test-portal`)
- Portal should have:
  - Theme/brand settings configured
  - At least one section enabled (hero, assets, etc.)
  - Optional: contact email for testing contact display

---

## Automated Tests
Tests are implemented using Playwright framework:

1. `/p/:portalSlug` renders and includes portal name and CTA buttons
2. `/p/:portalSlug/onboarding` renders form
3. "Enter App" link exists on both portal pages
4. "Enter App" link does NOT contain query params

---

## Files Modified/Created in U2

### Created
- `client/src/pages/public/PortalOnboardingPage.tsx`
- `client/src/pages/portal/CommunityPortalHome.tsx`
- `docs/ui/U2_PORTAL_ONBOARDING_QA.md`

### Modified
- `client/src/App.tsx` - Added routes
- `client/src/pages/public/PortalHomePage.tsx` - Added navbar with CTAs

---

## Known Limitations
- Onboarding form is a placeholder (no backend submission endpoint yet)
- Reserve bridge links to `/app` if user needs to complete reservation flow (U4 scope)
- Portal context is preserved via TenantContext (session-based, not URL params)
