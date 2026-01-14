# Terminology Standards

This document defines the canonical vocabulary for the Community Canvas platform. All code, schema, and documentation must conform to these standards.

## Reservation Canon

**NEVER use:**
- `booking` / `booked` / `bookings` / `is_booked`
- `instant_book`
- `booking_change`

**ALWAYS use:**
- `reservation` / `reserved` / `reservations` / `is_reserved`
- `instant_reserve`
- `reservation_change`

### Semantic Distinction

| Term | Use Case | Example |
|------|----------|---------|
| `reserved` | Capacity is allocated (calendar/availability states) | `schedule_event_type.reserved` |
| `scheduled` | Operational timing assigned (workflow lifecycle states) | `work_request_status.scheduled` |
| `reservation_platform` | External data source type | `external_source.reservation_platform` |

### Exceptions

The following are **acceptable** because they refer to external third-party platforms:
- Parsing iCal feeds that contain "booked" in the summary field (from Airbnb, Booking.com)
- References to external platform names like "Booking.com" in data parsing

## schema.org Alignment

All JSON-LD structured data uses the `https://schema.org` context. This is validated in `tests/integration/schema-org.test.ts`.

Preferred schema.org types:
- `Reservation` (not `Booking`)
- `LodgingReservation`
- `FoodEstablishmentReservation`
- `EventReservation`

## Taxonomy Standards

The platform uses industry-standard classification systems. **Do not invent internal taxonomies.**

### NAICS (North American Industry Classification System)
- **Primary Location**: `cc_organizations.naics_code_primary`, `cc_organizations.naics_code_secondary`
- **Reference Tables**: `cc_ref_infrastructure_types.naics_code`, `cc_ref_organization_types.default_naics`
- **Services**: `cc_services.naics_code`
- **Chamber Links**: `cc_staging_chamber_links.naics_code`

### UNSPSC (United Nations Standard Products and Services Code)
- **Assets**: `cc_assets.unspsc_code`
- **Services**: `cc_services.unspsc_code`
- **Organizations**: `cc_organizations.unspsc_segment`
- **GL Accounts**: `cc_gl_accounts.unspsc_segment`
- **Transactions**: `cc_transaction_lines.unspsc_code`

### CSI MasterFormat
- **Projects**: `cc_projects.csi_division`, `cc_projects.csi_section`
- **GL Accounts**: `cc_gl_accounts.csi_division`
- **Time Entries**: `cc_time_entries.csi_division`, `cc_time_entries.csi_section`
- **Work Requests**: `cc_work_requests.csi_division`, `cc_work_requests.csi_section`
- **Transaction Lines**: `cc_transaction_lines.csi_section`

### HS Code (Harmonized System)
- **Assets**: `cc_assets.hs_code`
- **Transaction Lines**: `cc_transaction_lines.hs_code`

## Enforcement

Run the terminology check before committing:

```bash
npm run check:terminology
```

This script scans the codebase for banned terms and fails if drift is detected.

## Migration History

| Migration | Description |
|-----------|-------------|
| 108 | Terminology remediation: booking → reservation, booked → reserved/scheduled |
