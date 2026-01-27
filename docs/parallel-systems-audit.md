# Parallel Systems Audit

**Audit Date:** 2026-01-27  
**Purpose:** Determine which parallel table systems are actively used vs. deprecated.

---

## Part 1: Service Runs - Which Version is Active?

### Row Counts & Activity

| System | Total Rows | Created Last 90 Days | Most Recent Created | Most Recent Updated |
|--------|------------|---------------------|--------------------|--------------------|
| **cc_service_runs (V1)** | 3 | 3 | 2025-12-31 | 2025-12-31 |
| **cc_sr_service_runs (V2)** | 2 | 2 | 2026-01-03 | 2026-01-03 |
| **cc_n3_runs (V3)** | 18 | 18 | 2026-01-24 | 2026-01-24 |

### Code References

| Table | Code References |
|-------|-----------------|
| cc_service_runs | 15 |
| cc_sr_service_runs | 6 |
| cc_n3_runs | **40** |

### Foreign Key Dependencies

**cc_service_runs (V1):**
- `cc_service_run_reservations.service_run_id`
- `cc_contractor_invites.service_run_id`
- `cc_run_outreach_campaigns.run_id`
- `cc_service_run_members.run_id`

**cc_sr_service_runs (V2):**
- `cc_rental_reservations.service_run_id`
- `cc_sr_service_slots.run_id`
- `cc_sr_contractor_bids.run_id`

**cc_n3_runs (V3):**
- `cc_n3_segments.run_id`
- `cc_monitor_state.run_id`
- `cc_replan_bundles.run_id`
- `cc_n3_surface_requirements.run_id`
- `cc_n3_run_maintenance_requests.run_id`
- `cc_run_portal_publications.run_id`
- `cc_run_request_attachments.run_id`
- `cc_service_run_stakeholders.run_id`
- `cc_service_run_stakeholder_responses.run_id`
- `cc_service_run_response_resolutions.run_id`
- `cc_service_run_schedule_proposals.run_id`

### Recommendation: Service Runs

| System | Recommendation | Rationale |
|--------|---------------|-----------|
| **cc_service_runs (V1)** | **DEPRECATE** | Low activity (3 rows), superseded by V3. Limited code references. |
| **cc_sr_service_runs (V2)** | **DEPRECATE** | Minimal activity (2 rows), superseded by V3. Has bidding features but cc_bids exists separately. |
| **cc_n3_runs (V3)** | **KEEP** | Most active (18 rows, most recent), most code references (40), most FK dependencies. This is the canonical service run system. |

---

## Part 2: Bids - Are Both Systems Active?

### Row Counts & Activity

| System | Total Rows | Created Last 90 Days | Most Recent |
|--------|------------|---------------------|-------------|
| **cc_bids** (procurement) | 0 | 0 | - |
| **cc_sr_contractor_bids** (service run) | 0 | 0 | - |

### Code References

| Table | Code References |
|-------|-----------------|
| cc_bids | **30** |
| cc_sr_contractor_bids | 1 |

### Foreign Key Dependencies

**cc_bids:**
- `cc_bid_breakdown_lines.bid_id`
- `cc_bid_messages.bid_id`
- `cc_contracts.bid_id`

**cc_sr_contractor_bids:**
- References `cc_sr_service_runs.run_id`

### Recommendation: Bids

| System | Recommendation | Rationale |
|--------|---------------|-----------|
| **cc_bids** | **KEEP** | Active in code (30 refs), linked to contracts. This is the canonical bid system. |
| **cc_sr_contractor_bids** | **DEPRECATE** | Only 1 code reference, no data, depends on deprecated cc_sr_service_runs. |

---

## Part 3: Full Summary

### Tables to KEEP (Canonical)

| Table | Purpose | Evidence |
|-------|---------|----------|
| `cc_n3_runs` | Service runs (V3) | Most active, most code refs (40), most FK deps |
| `cc_bids` | Procurement bids | 30 code refs, linked to contracts |
| `cc_projects` | Tenant-owned work | Canonical work container |
| `cc_work_orders` | Community work | Canonical community work |
| `cc_estimates` | Formal quotes | Versioned pricing |
| `cc_quote_drafts` | AI/ingestion quotes | Event mode captures |

### Tables to DEPRECATE

| Table | Reason | Migration Path |
|-------|--------|----------------|
| `cc_service_runs` (V1) | Superseded by cc_n3_runs | Migrate 3 rows to cc_n3_runs |
| `cc_sr_service_runs` (V2) | Superseded by cc_n3_runs | Migrate 2 rows to cc_n3_runs |
| `cc_sr_contractor_bids` | Depends on deprecated V2 | Use cc_bids instead |

### Tables to CLARIFY (Different Purposes)

| Tables | Clarification |
|--------|---------------|
| `cc_work_requests` vs `cc_projects` | Different stages: WR = leads, Projects = active work |
| `cc_work_orders` vs `cc_projects` | Different owners: WO = community, Projects = tenant |
| `cc_estimates` vs `cc_quote_drafts` | Different formality: Estimates = versioned, Quote Drafts = informal |

---

## Part 4: Authorization Implications

### Active Domain Tables

For the authorization framework, use these canonical tables:

| Capability Domain | Primary Table | Related Tables |
|-------------------|---------------|----------------|
| `service_runs` | `cc_n3_runs` | cc_n3_segments, cc_n3_*, cc_service_run_stakeholders |
| `bids` | `cc_bids` | cc_bid_breakdown_lines, cc_bid_messages |
| `projects` | `cc_projects` | cc_project_line_items, cc_project_photos |
| `work_orders` | `cc_work_orders` | cc_work_order_materials, cc_work_order_requirements |
| `estimates` | `cc_estimates` | cc_estimate_line_items, cc_estimate_versions |
| `quotes` | `cc_quote_drafts` | cc_ingestion_quote_links |
| `work_requests` | `cc_work_requests` | cc_work_request_media, cc_work_request_notes |

### Deprecated Tables (Exclude from Authorization)

Do NOT create capability domains for:
- `cc_service_runs` (use `cc_n3_runs`)
- `cc_sr_service_runs` (use `cc_n3_runs`)
- `cc_sr_contractor_bids` (use `cc_bids`)

---

## Part 5: Migration Recommendations

### Phase 1: Document Deprecation
1. Add comments to deprecated tables marking them as deprecated
2. Update replit.md to document canonical vs deprecated systems

### Phase 2: Soft Deprecation
1. Add warning logs when deprecated tables are accessed
2. Update code to use canonical tables

### Phase 3: Data Migration (Future)
1. Migrate cc_service_runs (3 rows) → cc_n3_runs
2. Migrate cc_sr_service_runs (2 rows) → cc_n3_runs
3. Update all FKs to point to cc_n3_runs

### Phase 4: Hard Deprecation (Future)
1. Drop deprecated tables after data migration
2. Remove deprecated code paths
