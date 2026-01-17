# Job Publication Accounting Integration

## Overview

This document describes the General Ledger (GL) integration for paid job publication intents (`cc_paid_publication_intents`). The integration ensures every paid job placement has a complete financial audit trail with receipt-grade artifacts.

## Architecture

### Single Source of Truth

```
cc_paid_publication_intents (canonical intent record)
    ├── ledger_charge_entry_id → cc_ledger_entries (charge)
    ├── ledger_payment_entry_id → cc_ledger_entries (payment)
    └── ledger_refund_entry_id → cc_ledger_entries (refund)
```

**Key Design Decisions:**
- Intent table remains the canonical source for job publication payments
- GL entries provide the accounting view, posted from intent state transitions
- No hospitality folio changes - job intents are completely separate
- No wallet ledger changes - intents use direct PSP-agnostic tracking

### GL Entry Reference Contract

| Field | Value |
|-------|-------|
| `source_type` | `'paid_publication_intent'` |
| `source_id` | `cc_paid_publication_intents.id` |
| `tenant_id` | Intent's tenant_id |
| `currency` | Intent's currency (default 'CAD') |

### Entry Type Taxonomy

| Action | entry_type | line_item_code | Status |
|--------|------------|----------------|--------|
| Intent created | `charge` | `JOB_PLACEMENT_CHARGE` | pending |
| Payment recorded | `payment` | `JOB_PLACEMENT_PAYMENT` | completed |
| Refund processed | `refund` | `JOB_PLACEMENT_REFUND` | completed |

## Lifecycle Diagram

```
┌─────────────────┐
│ Publish to      │
│ Paid Portal     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Create Intent   │────►│ Post GL CHARGE  │
│ requires_action │     │ entry_type=     │
└────────┬────────┘     │ charge          │
         │              └─────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Mark Paid       │────►│ Post GL PAYMENT │
│ status='paid'   │     │ entry_type=     │
└────────┬────────┘     │ payment         │
         │              └─────────────────┘
         │
         ▼
┌─────────────────┐
│ Job Posted as   │
│ 'published'     │
└────────┬────────┘
         │
         │ (Optional)
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Process Refund  │────►│ Post GL REFUND  │
│ status=         │     │ entry_type=     │
│ 'refunded'      │     │ refund          │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│ Job Archived    │
│ is_hidden=true  │
└─────────────────┘
```

## Database Schema

### New Columns on cc_paid_publication_intents

```sql
ledger_charge_entry_id UUID REFERENCES cc_ledger_entries(id)
ledger_payment_entry_id UUID REFERENCES cc_ledger_entries(id)
ledger_refund_entry_id UUID REFERENCES cc_ledger_entries(id)
```

### New Table: cc_paid_publication_intent_events

Append-only audit log for state transitions:

```sql
CREATE TABLE cc_paid_publication_intent_events (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  intent_id UUID NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_individual_id UUID,
  event_type TEXT NOT NULL,
  note TEXT,
  ledger_entry_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Event Types:**
- `charge_posted` - GL charge entry created
- `payment_recorded` - Payment confirmed, GL payment entry created
- `refund_processed` - Refund processed, GL refund entry created
- `status_changed` - General status transition

### New Indexes on cc_ledger_entries

```sql
CREATE INDEX idx_cc_ledger_entries_source
  ON cc_ledger_entries(source_type, source_id);

CREATE INDEX idx_cc_ledger_entries_tenant_source
  ON cc_ledger_entries(tenant_id, source_type, source_id);
```

## API Endpoints

### Publish Job (Creates Charge)

```
POST /api/p2/app/jobs/:id/publish
```

When publishing to a paid portal:
1. Creates `cc_paid_publication_intents` row
2. Calls `postIntentCharge()` to create GL charge entry
3. Links `ledger_charge_entry_id` on intent

### Mark Payment (Records Payment)

```
POST /api/p2/app/mod/paid-publications/:intentId/mark-paid
```

Request body:
```json
{
  "pspProvider": "stripe",
  "pspReference": "pi_xxx",
  "pspMetadata": {},
  "note": "Manual confirmation"
}
```

Actions:
1. Creates GL payment entry
2. Updates intent status to `paid`
3. Links `ledger_payment_entry_id`
4. Publishes job posting

### Process Refund

```
POST /api/p2/app/mod/paid-publications/:intentId/refund
```

Request body:
```json
{
  "reason": "Customer requested refund",
  "amountCents": 2900,
  "note": "Full refund processed"
}
```

Actions:
1. Creates GL refund entry
2. Updates intent status to `refunded`
3. Links `ledger_refund_entry_id`
4. Archives job posting

### Get Audit Trail

```
GET /api/p2/app/mod/paid-publications/:intentId
```

Response:
```json
{
  "ok": true,
  "intent": { ... },
  "ledgerEntries": [ ... ],
  "events": [ ... ]
}
```

### Get Receipt

```
GET /api/p2/app/mod/paid-publications/:intentId/receipt
```

Response:
```json
{
  "ok": true,
  "receipt": {
    "receiptId": "uuid",
    "issuedAt": "2026-01-17T12:00:00Z",
    "seller": {
      "portalId": "uuid",
      "portalName": "AdrenalineCanada",
      "legalName": "1252093 BC LTD",
      "dbaName": "AdrenalineCanada"
    },
    "buyer": {
      "tenantId": "uuid",
      "tenantName": "Employer Name"
    },
    "lineItems": [
      {
        "description": "Job placement: Software Developer",
        "quantity": 1,
        "unitPriceCents": 2900,
        "totalCents": 2900,
        "code": "JOB_BASE_PLACEMENT"
      }
    ],
    "totals": {
      "subtotalCents": 2900,
      "taxCents": 0,
      "grandTotalCents": 2900,
      "currency": "CAD"
    },
    "paymentInfo": {
      "status": "paid",
      "pspProvider": "stripe",
      "pspReference": "pi_xxx",
      "paidAt": "2026-01-17T12:00:00Z"
    },
    "ledgerEntryIds": {
      "charge": "uuid",
      "payment": "uuid",
      "refund": null
    }
  }
}
```

## Service Functions

Located in: `server/services/jobs/jobPublicationAccounting.ts`

### postIntentCharge(client, intent)

Creates GL charge entry when intent is created.

### recordIntentPayment(client, intent, paymentInfo)

Records payment, creates GL payment entry, publishes job.

### recordIntentRefund(client, intent, refundInfo)

Processes refund, creates GL refund entry, archives job.

### getIntentAuditTrail(client, intentId, tenantId)

Retrieves full audit trail with linked ledger entries and events.

### generateReceiptPayload(client, intentId, tenantId)

Generates receipt-grade JSON payload for display/export.

## Verification

### SQL Queries

```sql
-- Verify GL entries for an intent
SELECT le.*
FROM cc_ledger_entries le
WHERE le.source_type = 'paid_publication_intent'
  AND le.source_id = 'intent-uuid';

-- Verify intent has ledger links
SELECT id, status, 
       ledger_charge_entry_id,
       ledger_payment_entry_id,
       ledger_refund_entry_id
FROM cc_paid_publication_intents
WHERE id = 'intent-uuid';

-- Verify event audit trail
SELECT * FROM cc_paid_publication_intent_events
WHERE intent_id = 'intent-uuid'
ORDER BY created_at;
```

### Test Commands

```bash
# Run accounting integration tests
npx vitest run tests/job-publication-accounting.test.ts
```

## Migration

Migration file: `server/migrations/143_job_intent_gl_integration.sql`

Changes:
1. Adds `ledger_*_entry_id` columns to `cc_paid_publication_intents`
2. Creates `cc_paid_publication_intent_events` table
3. Adds indexes on `cc_ledger_entries` for source lookups
4. RLS policies for tenant isolation

## Confirmation

- ✅ No hospitality folio changes
- ✅ No wallet ledger changes
- ✅ Intent remains canonical source of truth
- ✅ GL provides accounting view
- ✅ Full audit trail via events table
- ✅ Receipt-grade JSON payloads
