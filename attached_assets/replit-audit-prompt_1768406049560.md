# REPLIT: FULL V3 PLATFORM AUDIT - What's Built vs What Remains

## Context
We have 4 condensed prompt packs totaling 74+ prompts, plus recent Prompts 24-29:

| Pack | Prompts | Focus |
|------|---------|-------|
| **30-Prompt Pack** | 30 | Cart → Reservation (generic) |
| **Bamfield Ops Pack** | 20 | Transport, Freight, Permits, PMS |
| **Onboarding-Governance Pack** | 14 | Invites, Identity, Disputes, Federation |
| **V3.3.1 Go-Live Pack** | 12 blocks | Parking + Marina flagship |
| **Prompts 24-29** | 6 | Pricing redesign, Invitations, Notifications |

## Objective
Scan the database and codebase to produce a comprehensive inventory of EVERYTHING built across ALL these packs so we know exactly where we are.

---

## A) Database Tables Inventory

### 1) Count all cc_* tables
```sql
SELECT COUNT(*) as total_cc_tables
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'cc_%';
```

### 2) List all cc_* tables grouped by prefix/domain
```sql
SELECT 
  CASE 
    WHEN table_name LIKE 'cc_activity%' THEN 'Activity/Feed'
    WHEN table_name LIKE 'cc_notification%' THEN 'Notifications'
    WHEN table_name LIKE 'cc_onboarding%' THEN 'Onboarding'
    WHEN table_name LIKE 'cc_portal%' THEN 'Portal/Governance'
    WHEN table_name LIKE 'cc_invitation%' OR table_name LIKE 'cc_referral%' OR table_name LIKE 'cc_claim%' THEN 'Invitations/Referrals'
    WHEN table_name LIKE 'cc_job%' OR table_name LIKE 'cc_community%' THEN 'Jobs/Communities'
    WHEN table_name LIKE 'cc_plan%' OR table_name LIKE 'cc_subscription%' OR table_name LIKE 'cc_actor%' THEN 'Plans/Subscriptions'
    WHEN table_name LIKE 'cc_value%' OR table_name LIKE 'cc_ledger%' THEN 'Value/Ledger'
    WHEN table_name LIKE 'cc_facility%' OR table_name LIKE 'cc_inventory%' THEN 'Facilities/Inventory'
    WHEN table_name LIKE 'cc_offer%' OR table_name LIKE 'cc_rate%' OR table_name LIKE 'cc_tax%' THEN 'Offers/Pricing'
    WHEN table_name LIKE 'cc_reservation%' THEN 'Reservations'
    WHEN table_name LIKE 'cc_allocation%' THEN 'Allocations'
    WHEN table_name LIKE 'cc_federation%' THEN 'Federation'
    WHEN table_name LIKE 'cc_visibility%' OR table_name LIKE 'cc_disclosure%' THEN 'Visibility/Disclosure'
    WHEN table_name LIKE 'cc_incident%' THEN 'Incidents'
    WHEN table_name LIKE 'cc_access%' OR table_name LIKE 'cc_credential%' THEN 'Access/Credentials'
    WHEN table_name LIKE 'cc_asset%' THEN 'Assets'
    WHEN table_name LIKE 'cc_tenant%' OR table_name LIKE 'cc_individual%' OR table_name LIKE 'cc_party%' THEN 'Core Identity'
    WHEN table_name LIKE 'cc_message%' OR table_name LIKE 'cc_conversation%' THEN 'Messages'
    WHEN table_name LIKE 'cc_transport%' OR table_name LIKE 'cc_trip%' OR table_name LIKE 'cc_sr_%' THEN 'Transport/Service Runs'
    WHEN table_name LIKE 'cc_moderation%' THEN 'Moderation'
    ELSE 'Other'
  END as domain,
  COUNT(*) as table_count,
  string_agg(table_name, ', ' ORDER BY table_name) as tables
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'cc_%'
GROUP BY 1
ORDER BY 2 DESC;
```

### 3) List all migrations applied (by number)
```sql
SELECT name, applied_at 
FROM drizzle_migrations 
ORDER BY applied_at DESC 
LIMIT 30;
```

### 4) Count all custom enums
```sql
SELECT typname as enum_name, 
       (SELECT COUNT(*) FROM pg_enum e WHERE e.enumtypid = t.oid) as value_count
FROM pg_type t 
WHERE typtype = 'e' 
  AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY typname;
```

### 5) List all SECURITY DEFINER functions (platform helpers)
```sql
SELECT routine_name, security_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE 'cc_%'
  AND security_type = 'DEFINER'
ORDER BY routine_name;
```

---

## B) 30-PROMPT PACK STATUS (Cart → Reservation)

### Foundation Tables (Prompt 01)
```sql
SELECT 
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_reservation_carts') as carts,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_reservation_cart_items') as cart_items,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_reservation_cart_adjustments') as cart_adjustments,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_partner_reservation_requests') as partner_requests,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_weather_trends') as weather;

-- Count weather seed data
SELECT COUNT(*) as weather_months FROM cc_weather_trends WHERE location_code = 'BAMFIELD';
```

### Trip & Party Tables (Prompts 05-08)
```sql
SELECT 
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_trips') as trips,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_trip_party_profiles') as party_profiles,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_trip_invitations') as trip_invitations,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_trip_handoffs') as handoffs,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_trip_alerts') as alerts;
```

### Portal Moments (Prompt 06)
```sql
SELECT 
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_portal_moments') as portal_moments;
SELECT COUNT(*) as moment_count FROM cc_portal_moments;
```

---

## C) BAMFIELD OPS PACK STATUS (20 Prompts)

### Transport Tables (Prompts 01-06)
```sql
SELECT 
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_locations') as locations,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_transport_operators') as transport_operators,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_transport_assets') as transport_assets,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_sailing_schedules') as sailing_schedules,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_sailings') as sailings,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_port_calls') as port_calls,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_transport_requests') as transport_requests,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_transport_alerts') as transport_alerts;
```

### Freight Tables (Prompts 07-09)
```sql
SELECT 
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_freight_manifests') as manifests,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_freight_items') as freight_items,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_proof_of_handling') as proof_handling;
```

### Permit Tables (Prompts 10-13)
```sql
SELECT 
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_authorities') as authorities,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_permit_types') as permit_types,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_permits') as permits,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_trip_permits') as trip_permits,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_territory_notices') as territory_notices;
```

### PMS Tables (Prompts 14-16)
```sql
SELECT 
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_folios') as folios,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_folio_ledger') as folio_ledger,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_rate_plans') as rate_plans;
```

### Enforcement Tables (Prompts 17-18)
```sql
SELECT 
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_enforcement_actions') as enforcement,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_tow_requests') as tow_requests;
```

### Community Identity Tables (Prompts 19-20)
```sql
SELECT 
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_community_identities') as community_ids,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_community_charges') as community_charges,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_settlement_batches') as settlements;
```

---

## D) ONBOARDING-GOVERNANCE PACK STATUS (14 Prompts)

### Invite System (Prompts 01-02)
```sql
SELECT 
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_invites') as invites,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_invite_acceptances') as acceptances,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_onboarding_events') as onboarding_events,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_onboarding_scripts') as scripts;
```

### Community & Identity (Prompts 03-06)
```sql
SELECT 
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_communities') as communities,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_community_referrals') as referrals,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_certifications') as certifications,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_training_modules') as training,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_identities') as identities;
```

### Governance (Prompts 07-08)
```sql
SELECT 
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_disputes') as disputes,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_dispute_evidence') as evidence,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_incidents') as incidents;
```

### Data & Federation (Prompts 09-10)
```sql
SELECT 
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_data_exports') as exports,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_federation_agreements') as federation,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_federated_tokens') as fed_tokens;
```

### Institutional (Prompts 11-14)
```sql
SELECT 
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_financial_events') as financials,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_ai_suggestions') as ai_suggestions,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_gov_connectors') as gov_connectors,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_backups') as backups;
```

---

## E) V3.3.1 GO-LIVE PACK STATUS (12 Blocks)

### Block 01: Truth/Disclosure Layer
```sql
SELECT 
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_visibility_profiles') as visibility_profiles,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_asset_visibility_rules') as visibility_rules,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_disclosure_surface_sets') as disclosure_surfaces,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_asset_groups') as asset_groups;
```

### Block 02: Participation Mode + Payment
```sql
SELECT 
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_payment_references') as payment_refs,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_activity_ledger') as activity_ledger;

-- Check participation_mode on assets
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'cc_assets' AND column_name = 'participation_mode';
```

### Block 03: Facilities + Inventory Units
```sql
SELECT 
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_facilities') as facilities,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_inventory_units') as inventory_units;

-- Count data if exists
SELECT 'facilities' as entity, COUNT(*) FROM cc_facilities
UNION ALL SELECT 'inventory_units', COUNT(*) FROM cc_inventory_units;
```

### Block 04: Offers + Rate Rules
```sql
SELECT 
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_offers') as offers,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_rate_rules') as rate_rules,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_tax_rules') as tax_rules;

-- Count data if exists
SELECT 'offers' as entity, COUNT(*) FROM cc_offers
UNION ALL SELECT 'rate_rules', COUNT(*) FROM cc_rate_rules
UNION ALL SELECT 'tax_rules', COUNT(*) FROM cc_tax_rules;
```

### Block 05: Reservations
```sql
-- Check reservation columns (should have 60+ columns after V3.3.1)
SELECT COUNT(*) as column_count FROM information_schema.columns 
WHERE table_name = 'cc_reservations';

SELECT 
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_reservation_items') as res_items,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_reservation_allocations') as allocations;
```

### Block 07: Allocation Engine
```sql
SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_allocations') as allocations_table;
SELECT routine_name FROM information_schema.routines 
WHERE routine_name LIKE '%allocat%' AND routine_schema = 'public';
```

### Block 09: Incidents
```sql
SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_incidents') as incidents;
```

### Block 11: Access Credentials
```sql
SELECT 
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_access_credentials') as credentials,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_access_events') as access_events;
```

---

## F) PROMPTS 24-29 STATUS (Recent Pricing/Viral Work)

### Prompt 24A: Multi-Role Tenants + Plans (Migrations 099-101)
```sql
SELECT 
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_actor_types') as actor_types,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_tenant_actor_roles') as tenant_roles,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_plans') as plans,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_plan_entitlements') as entitlements,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_subscriptions') as subscriptions;

-- Count seed data
SELECT 'actor_types' as entity, COUNT(*) FROM cc_actor_types
UNION ALL SELECT 'plans', COUNT(*) FROM cc_plans;
```

### Prompt 24B: Jobs Cold Start (Migration 102)
```sql
SELECT 
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_jobs') as jobs,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_job_postings') as job_postings,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_job_applications') as job_apps,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_job_matches') as job_matches;
```

### Prompt 24C: Value Events (Migration 103)
```sql
SELECT 
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_value_events') as value_events,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_value_event_types') as event_types,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_ledger_entries') as ledger_entries,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_invoices') as invoices;
```

### Prompt 25: Invitations & Referrals (Migration 104)
```sql
SELECT 
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_invitations') as invitations,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_referrals') as referrals,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_claim_links') as claim_links;
```

### Prompt 26: Portal Governance (Migration 105)
```sql
SELECT 
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_portal_members') as portal_members,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_portal_settings') as portal_settings,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_portal_roles') as portal_roles,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_moderation_queue') as moderation_queue;
```

### Prompt 27: Onboarding Wizard (Migration 106)
```sql
SELECT 
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_onboarding_flows') as flows,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_onboarding_steps') as steps,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_onboarding_sessions') as sessions,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_onboarding_progress') as progress,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_onboarding_checklist_items') as checklist;

-- Count seed data
SELECT COUNT(*) as flow_count FROM cc_onboarding_flows;
```

### Prompt 28: Notifications (Migration 107)
```sql
SELECT 
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_tenant_individuals') as tenant_individuals,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_notification_templates') as templates,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_notifications') as notifications,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_notification_preferences') as preferences,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_notification_deliveries') as deliveries,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_notification_digests') as digests;

-- Count templates
SELECT COUNT(*) as template_count FROM cc_notification_templates;
```

### Prompt 29: Activity Feed (Migration 109)
```sql
SELECT 
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_activity_events') as activity_events,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_activity_feed_state') as feed_state,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_activity_bookmarks') as bookmarks;

-- Check for activity_verb enum (not activity_type)
SELECT typname FROM pg_type WHERE typname = 'activity_verb';
```

---

## G) All Migrations Applied
```sql
SELECT name, applied_at 
FROM drizzle_migrations 
ORDER BY name DESC 
LIMIT 50;
```

---

## H) All Custom Enums
```sql
SELECT typname as enum_name, 
       (SELECT COUNT(*) FROM pg_enum e WHERE e.enumtypid = t.oid) as value_count
FROM pg_type t 
WHERE typtype = 'e' 
  AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY typname;
```

---

## I) All Platform Helper Functions
```sql
SELECT routine_name, security_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE 'cc_%'
ORDER BY routine_name;
```

---

## J) Service Routes Check
```bash
ls -la server/routes/*.ts 2>/dev/null | head -30
```

---

## K) Services Check
```bash
ls -la server/services/*.ts 2>/dev/null | head -30
```

---

## L) Schema Line Count
```bash
wc -l shared/schema.ts
```

---

## M) Migration File Count
```bash
ls server/migrations/*.sql | wc -l
```

---

## DELIVERABLE FORMAT

Please organize findings into this format:

## DELIVERABLE FORMAT

Please organize findings into this format:

```
## FULL V3 PLATFORM AUDIT RESULTS

### Summary
- Total cc_* tables: ___
- Total migrations: ___
- Total enums: ___
- Total helper functions: ___

### 30-PROMPT PACK (Cart → Reservation)
| Prompt | Focus | Built? | Data |
|--------|-------|--------|------|
| 01 | Foundation (carts, weather) | | |
| 02 | Cart API | | |
| 03 | Recommendations | | |
| 04 | Checkout | | |
| 05 | Trips | | |
| 06 | Portal Moments | | |
| 07 | Party Profiles | | |
| 08 | Handoffs/Alerts | | |

### BAMFIELD OPS PACK (20 Prompts)
| Domain | Prompts | Built? | Tables |
|--------|---------|--------|--------|
| Transport | 01-06 | | |
| Freight | 07-09 | | |
| Permits | 10-13 | | |
| PMS | 14-16 | | |
| Enforcement | 17-18 | | |
| Identity | 19-20 | | |

### ONBOARDING-GOVERNANCE PACK (14 Prompts)
| Domain | Prompts | Built? | Tables |
|--------|---------|--------|--------|
| Viral Engine | 01-02 | | |
| Discovery | 03-04 | | |
| Trust/Training | 05-06 | | |
| Governance | 07-08 | | |
| Data/Federation | 09-10 | | |
| Institutional | 11-14 | | |

### V3.3.1 GO-LIVE PACK (12 Blocks)
| Block | Focus | Built? | Tables/Data |
|-------|-------|--------|-------------|
| 00 | Architecture Lock | | |
| 01 | Truth/Disclosure | | |
| 02 | Participation Mode | | |
| 03 | Facilities/Units | | |
| 04 | Offers/Rates | | |
| 05 | Reservations | | |
| 06 | Federation | | |
| 07 | Allocations | | |
| 08 | Activity Ledger | | |
| 09 | Incidents | | |
| 10 | Dashboard | | |
| 11 | Credentials | | |
| 12 | QA/Seed | | |

### PROMPTS 24-29 (Pricing Redesign)
| Prompt | Focus | Built? | Tables |
|--------|-------|--------|--------|
| 24A | Actors/Plans | | |
| 24B | Jobs Cold Start | | |
| 24C | Value Events | | |
| 25 | Invitations | | |
| 26 | Portal Governance | | |
| 27 | Onboarding | | |
| 28 | Notifications | | |
| 29 | Activity Feed | | |

### WHAT'S NOT BUILT YET
(List all missing tables/features organized by pack)

### POTENTIAL CONFLICTS/ISSUES
(Any overlapping tables, orphaned data, missing RLS, etc.)

### RECOMMENDED NEXT STEPS
(Based on what's built vs what remains)
```

---

## Notes

This comprehensive audit will:
1. Confirm what's actually in the database across ALL 4 packs
2. Identify gaps and overlaps between packs
3. Determine the correct next step based on dependencies
4. Ensure we don't rebuild something that already exists
5. Surface any schema conflicts or technical debt
