# Payment Abstraction Policy

## Core Principle

**Community Canvas NEVER processes payments.**

CC is a coordination and booking platform. All payment processing is the responsibility of the tenant's external systems.

---

## What CC Does

1. **Calculates pricing** - Uses `cc_offers` → `cc_rate_rules` → `cc_tax_rules` stack
2. **Records reservations** - Stores booking details and pricing snapshots
3. **Tracks payment status** - `pending` | `paid` | `partial` | `failed` (external status only)
4. **Stores external references** - Optional fields for tenant's payment system IDs

---

## What CC Does NOT Do

1. ❌ Process credit cards
2. ❌ Handle payment disputes
3. ❌ Store sensitive payment credentials (PCI scope)
4. ❌ Integrate directly with payment processors
5. ❌ Handle refunds or chargebacks
6. ❌ Require any payment processor dependency

---

## Database Design

### cc_reservations (Payment-Related Columns)

```sql
-- Status tracking (external state only)
payment_status VARCHAR(20) DEFAULT 'pending'
  CHECK (payment_status IN ('pending', 'paid', 'partial', 'failed', 'refunded', 'waived'))

-- External reference (optional, tenant-managed)
external_payment_ref VARCHAR(255)
  -- Examples: 'stripe:pi_1234', 'square:abc123', 'cash:receipt-456'

-- Calculated totals (frozen at booking)
pricing_snapshot JSONB
  -- { subtotal, fees, taxes, total, currency, calculated_at }
```

### cc_payment_events (Audit Trail)

```sql
-- Immutable event log for payment state changes
id UUID PRIMARY KEY
reservation_id UUID REFERENCES cc_reservations
event_type VARCHAR(50)  -- 'initiated', 'completed', 'failed', 'refunded'
external_ref VARCHAR(255)
amount_cents INTEGER
currency CHAR(3)
recorded_at TIMESTAMPTZ DEFAULT now()
recorded_by UUID  -- actor who recorded the change
notes TEXT
```

---

## Integration Patterns

### Pattern 1: No External System (Manual Tracking)
```
1. Guest books via CC portal
2. Host contacts guest for payment (outside CC)
3. Host marks reservation as 'paid' in CC
4. CC records status change in cc_payment_events
```

### Pattern 2: External Payment Link
```
1. Guest books via CC portal
2. CC calculates total and displays it
3. Host sends payment link from their Stripe/Square/etc.
4. Host updates CC when payment received
5. Optional: Host stores external ref in CC for audit
```

### Pattern 3: Future Adapter Integration
```
1. Tenant configures payment adapter in cc_tenant_settings
2. CC sends booking webhook to adapter endpoint
3. Adapter processes payment externally
4. Adapter calls CC callback to update status
5. CC stores external_payment_ref for reconciliation
```

---

## API Design

### Recording Payment Status

```typescript
// PATCH /api/reservations/:id/payment-status
{
  "payment_status": "paid",
  "external_payment_ref": "stripe:pi_1234567890",
  "notes": "Paid via Stripe checkout"
}
```

### Pricing Calculation (No Payment)

```typescript
// POST /api/reservations/calculate-price
// Returns calculated pricing WITHOUT processing payment
{
  "unit_id": "...",
  "start_date": "2026-06-01",
  "end_date": "2026-06-05",
  "party_size": 2
}

// Response
{
  "subtotal": 400.00,
  "cleaning_fee": 50.00,
  "service_fee": 25.00,
  "taxes": {
    "GST": 23.75,
    "PST": 35.00
  },
  "total": 533.75,
  "currency": "CAD"
}
```

---

## No Stripe Dependency

CC does NOT require Stripe or any payment processor:

- No `STRIPE_SECRET_KEY` required
- No Stripe SDK in dependencies
- No payment webhooks to handle
- No PCI compliance scope

Tenants who want integrated payments can:
1. Use their own processor externally
2. Build custom adapters (future feature)
3. Use CC purely for booking/coordination

---

## Canadian Tax Compliance

CC calculates Canadian taxes but does NOT collect or remit them:

| Responsibility | Owner |
|----------------|-------|
| Tax calculation | CC (via cc_tax_rules) |
| Tax collection | Tenant |
| Tax remittance | Tenant |
| GST/HST registration | Tenant |

CC provides:
- Accurate tax rate lookups by jurisdiction
- Breakdown in pricing_snapshot
- Audit trail for tax reporting

---

## Security Considerations

1. **No PCI Scope**: CC never touches cardholder data
2. **External Refs Only**: We store identifiers, not credentials
3. **Immutable Audit**: cc_payment_events is append-only
4. **Tenant Isolation**: RLS ensures payment data is tenant-scoped

---

## Document History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-01-12 | 1.0 | Agent | Initial payment abstraction policy |
