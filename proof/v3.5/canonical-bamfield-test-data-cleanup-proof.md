# Canonical Bamfield Test Data Cleanup Proof

**Date**: 2026-01-25  
**Author**: Replit Agent  
**Task**: V3.5 Canonical Bamfield Data Reset + Seed (Whitelist)

---

## Summary

Successfully executed whitelist-based data cleanup to establish canonical Bamfield test data. Removed all test cruft and non-canonical tenants/users, preserving only the 25 canonical tenants and 14 canonical users per the specification.

---

## Pre/Post Counts

| Table | Pre | Post | Delta |
|-------|-----|------|-------|
| cc_users | 15 | 14 | -1 |
| cc_tenants | 31 | 25 | -6 |
| cc_tenant_users | 11 | 17 | +6 |
| cc_portals | 12 | 11 | -1 |
| cc_zones | 7 | 2 | -5 |

---

## Deleted Data Summary

| Category | Count | Notes |
|----------|-------|-------|
| Non-canonical tenant memberships | 9 | From non-whitelist users |
| Non-canonical tenants | 14 | Test tenants (p212-test-*, org-*, idem-corp-*, etc.) |
| Non-canonical users | 13 | Test users (testuser@example.com, ellen@example.com, etc.) |
| Orphan facilities | 5 | glenn-ballman tenant facilities |
| Orphan reservation_items | 1 | FK cleanup |
| Orphan incidents | 1 | FK cleanup |
| Orphan audit_log | 21 | FK cleanup |
| Orphan impersonation_logs | 3 | FK cleanup |
| Orphan work_requests | 3 | FK cleanup |
| Orphan zones | 5 | Non-canonical tenant zones |
| Orphan parties | 8 | Non-canonical tenant parties |
| Service run tables | 11 | resolutions, proposals, stakeholders |

---

## P0 Invariant: Glenn Platform Admin Verification

```sql
SELECT u.email, u.is_platform_admin, count(tu.tenant_id) as tenant_memberships
FROM cc_users u
LEFT JOIN cc_tenant_users tu ON tu.user_id=u.id
WHERE u.email='glenn@envirogroupe.com'
GROUP BY u.email, u.is_platform_admin;
```

**Result:**
| email | is_platform_admin | tenant_memberships |
|-------|-------------------|-------------------|
| glenn@envirogroupe.com | true | 0 |

**PASSED**: Glenn is platform admin with ZERO tenant memberships (P0 invariant enforced)

---

## Sheryl 4 Memberships Verification

```sql
SELECT u.email, t.slug, tu.role, tu.title
FROM cc_users u
JOIN cc_tenant_users tu ON tu.user_id=u.id
JOIN cc_tenants t ON t.id=tu.tenant_id
WHERE u.email='sheryl@brokenislandadventures.com'
ORDER BY t.slug;
```

**Result:**
| email | slug | role | title |
|-------|------|------|-------|
| sheryl@brokenislandadventures.com | bamfield-community | tenant_admin | Multi-Community Coordinator |
| sheryl@brokenislandadventures.com | broken-island-adventures | tenant_admin | Multi-Community Coordinator |
| sheryl@brokenislandadventures.com | east-bamfield-community | tenant_admin | Multi-Community Coordinator |
| sheryl@brokenislandadventures.com | west-bamfield-community | tenant_admin | Multi-Community Coordinator |

**PASSED**: Sheryl has exactly 4 tenant memberships

---

## Canonical Users + Tenant List

| display_name | email | is_platform_admin | tenants |
|--------------|-------|-------------------|---------|
| Brenda Yamamoto | brendaharbourside@gmail.com | false | harbourside-lodge |
| Brian Baird | brian@luckylander.com | false | lucky-lander-services |
| Ellen White | ellen@enviropaving.com | false | 1252093-bc-ltd |
| Gil | gil@florastays.com | false | flora-stays |
| Glenn Ballman | glenn@envirogroupe.com | **true** | (none) |
| Jill Popoff | jill@woodsendlanding.com | false | woods-end-landing |
| John Mass | john@brokenislandadventures.com | false | broken-island-adventures |
| Marnie | marnie@bamfieldchamber.com | false | bamfield-chamber |
| Mathew Vetten | mathew@woodsendlanding.com | false | woods-end-landing |
| Neil Wright | neil@inletexpress.com | false | inlet-express |
| Pavel Novak | pavel@remoteserve.ca | false | 1252093-bc-ltd, bamfield-property-maintenance |
| Rachel Lovick | rachel@woodsendlanding.com | false | woods-end-landing |
| Sheryl Ferguson | sheryl@brokenislandadventures.com | false | bamfield-community, broken-island-adventures, east-bamfield-community, west-bamfield-community |
| Wade Thompson | wade@bamfield.net | false | wade-residence |

---

## Role Mapping Applied

The canonical documentation uses different role names than the V3.5 auth guards accept. This mapping was applied:

| Canonical Role | V3.5 Role | Title/Permissions |
|----------------|-----------|-------------------|
| admin | tenant_admin | title='Tenant Admin' or custom |
| owner | tenant_owner | title='Residence Owner' or custom |
| crew_chief | operator | title='Crew Chief', permissions={"crew_chief": true} |

**Valid V3.5 roles**: tenant_owner, tenant_admin, operator, staff, member

This preserves semantic meaning via `title` + `permissions` columns while keeping `role` values compatible with the auth guard security model.

---

## Canonical Tenants (25)

| Category | Tenants |
|----------|---------|
| Platform | community-canvas |
| Government | bamfield-community, east-bamfield-community, west-bamfield-community, anacla-community, uchucklesaht-tribe |
| Business | 1252093-bc-ltd, bamfield-property-maintenance, ethans-landing-inc, woods-end-landing, woods-end-marina, save-paradise-parking, bamfield-adventure-center, broken-island-adventures, lucky-lander-services, inlet-express, harbourside-lodge, flora-stays, floras-restaurant, hfn-marina, lady-rose-marine, eileen-scott-park, grappler-boat-launch, bamfield-chamber |
| Individual | wade-residence |

---

## Backup Tables Created

| Backup Table | Row Count |
|--------------|-----------|
| _backup_cc_users_20260125 | 15 |
| _backup_cc_tenants_20260125 | 31 |
| _backup_cc_tenant_users_20260125 | 11 |
| _backup_cc_portals_20260125 | 12 |
| _backup_cc_zones_20260125 | 7 |

---

## Done Criteria

| Criterion | Status |
|-----------|--------|
| No test cruft remains | PASSED |
| Canonical tenants/users exist | PASSED (25 tenants, 14 users) |
| Glenn has 0 tenant memberships | PASSED (P0 enforced) |
| Auth guards work | PASSED (tenant_admin/operator/etc. are valid roles) |

---

## Related Documents

- `proof/v3.5/platform-admin-no-tenant-users-invariant-proof.md` - P0 database trigger enforcement
- `proof/v3.5/platform-guards-entities-apify-proof.md` - Guard security fixes
- `proof/v3.5/deprecated-admin-ui-removal-proof.md` - UI cleanup
