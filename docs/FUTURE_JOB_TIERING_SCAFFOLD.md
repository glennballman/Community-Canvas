# Future Job Tiering Scaffold

## Overview

This document describes the scaffolded infrastructure for job visibility tiers and hiring assistance tiers. This feature is **DISABLED BY DEFAULT** and controlled via the `job_tiers_enabled` feature flag in the `cc_feature_flags` table.

## Feature Summary

When enabled, tenants can purchase additional visibility or assistance tiers for their job postings on paid portals. These tiers are additive to the base portal posting price.

### Attention Tiers (Visibility Boost)
- **Standard** (default): No additional cost
- **Featured** (+$1.00/day or $10/month): Highlighted placement in search results
- **Urgent** ($7.00 flat for 7 days): "Urgently Hiring" badge displayed, timeboxed to max 7 days

### Assistance Tiers (Platform Support)
- **None** (default): Self-service applicant management
- **Assisted** ($9.00/month): Platform screening assistance for applicants

## Feature Flag Scope Precedence

Feature flags are resolved in the following priority order:

1. **Portal-scoped** (highest priority): `scope_type='portal' AND scope_id=<portalId>`
2. **Tenant-scoped**: `scope_type='tenant' AND scope_id=<tenantId>`
3. **Global**: `scope_type='global' AND scope_id IS NULL`
4. **Default** (lowest priority): `false` when no flag exists

This means a portal can override a tenant setting, and a tenant can override the global setting.

### Example Flag Records

```sql
-- Global flag (applies to all unless overridden)
INSERT INTO cc_feature_flags (key, is_enabled, scope_type, config)
VALUES ('job_tiers_enabled', false, 'global', '{"featured_daily_cents": 100}');

-- Tenant override (enable for specific tenant)
INSERT INTO cc_feature_flags (key, is_enabled, scope_type, scope_id, config)
VALUES ('job_tiers_enabled', true, 'tenant', 'tenant-uuid-here', '{}');

-- Portal override (disable for specific portal even if tenant has it enabled)
INSERT INTO cc_feature_flags (key, is_enabled, scope_type, scope_id, config)
VALUES ('job_tiers_enabled', false, 'portal', 'portal-uuid-here', '{}');
```

## Config Keys and Defaults

The feature flag config JSONB can contain pricing overrides:

```json
{
  "attention_tiers": {
    "featured": {
      "price_cents_per_day": 100,      // $1.00/day (default)
      "price_cents_per_month": 1000,   // $10/month (default)
      "label": "Featured Job",
      "description": "Highlighted in search results"
    },
    "urgent": {
      "price_cents_flat": 700,         // $7.00 flat (default)
      "duration_days": 7,              // 7 days max (default)
      "label": "Urgently Hiring",
      "description": "Urgent badge for 7 days"
    }
  },
  "assistance_tiers": {
    "assisted": {
      "price_cents_per_month": 900,    // $9.00/month (default)
      "label": "Assisted Hiring",
      "description": "Platform screening assistance"
    }
  }
}
```

**Server-side defaults** (when config is missing):
- `featured_daily_cents`: 100 ($1.00/day)
- `featured_monthly_cents`: 1000 ($10/month)
- `urgent_flat_cents`: 700 ($7.00 flat)
- `urgent_duration_days`: 7 days
- `assisted_monthly_cents`: 900 ($9.00/month)

**Currency**: All prices are in CAD (Canadian Dollars).

## Database Schema

### Migration 142: `server/migrations/142_future_job_tiers_scaffold.sql`

Adds the following:

1. **Enum Types**:
   - `job_attention_tier`: `'standard'`, `'featured'`, `'urgent'`
   - `job_assistance_tier`: `'none'`, `'assisted'`

2. **Columns on `cc_paid_publication_intents`**:
   - `attention_tier` (NOT NULL, defaults to 'standard')
   - `assistance_tier` (NOT NULL, defaults to 'none')
   - `tier_price_cents` (integer, NOT NULL, defaults to 0)
   - `tier_currency` (CHAR(3), NOT NULL, defaults to 'CAD')
   - `tier_metadata` (JSONB, NOT NULL, defaults to '{}')

3. **Feature Flags Table** (`cc_feature_flags`):
   - `key` (TEXT primary key, unique identifier)
   - `is_enabled` (boolean, NOT NULL, default false)
   - `scope_type` (text: 'global', 'portal', 'tenant')
   - `scope_id` (UUID, nullable, for portal/tenant-specific overrides)
   - `config` (JSONB, NOT NULL, for additional configuration)
   - `description` (TEXT, nullable)
   - `created_at`, `updated_at` timestamps

4. **Initial Feature Flag**:
   - `job_tiers_enabled` is inserted with `is_enabled = false` and `scope_type = 'global'`

## Service Layer

### `server/services/jobs/tiering.ts`

Provides two main functions:

```typescript
getTieringAvailability(portalId: string, tenantId: string): Promise<TieringAvailability>
```
Returns whether tiering is enabled for a specific portal/tenant context.

```typescript
computeTierPrice(params: TierPriceParams): Promise<TierPriceResult>
```
Calculates the additional cost for selected tiers. Returns 0 when disabled.

## API Endpoints

### Feature Flags Admin (`/api/p2/admin/feature-flags`)

- `GET /` - List all feature flags
- `GET /:key` - Get specific flag by key
- `POST /` - Create or upsert flag
- `PATCH /:key` - Partial update flag
- `DELETE /:key` - Delete flag

**Authentication**: Requires service key authentication via `X-Service-Key` header.

### Tiering Endpoints (Future)

When enabled, the following endpoints will be available:
- `GET /api/p2/app/jobs/tiering/availability` - Check tier availability
- `POST /api/p2/app/jobs/tiering/compute-price` - Calculate tier pricing

## Frontend Integration

### JobDestinationsPage UI

The `client/src/pages/app/jobs/JobDestinationsPage.tsx` includes two disabled collapsible cards:

1. **Boost Visibility** section:
   - Featured Job checkbox (disabled)
   - Urgently Hiring checkbox (disabled)
   - Shows "Coming Soon" badge

2. **Save Time** section:
   - Assisted Hiring checkbox (disabled)
   - Shows "Coming Soon" badge

These sections only appear when the user has selected paid portal destinations.

## Publish Endpoint Integration

The publish endpoint (`POST /api/p2/app/jobs/:id/publish`) accepts tier fields:
- `attentionTier`: 'standard' | 'featured' | 'urgent' | null
- `assistanceTier`: 'none' | 'assisted' | null
- `durationDays`: number (for featured tier daily pricing)

When `job_tiers_enabled` is false, these fields are ignored and no tier pricing is applied.

## Enabling the Feature

To enable job tiers:

```sql
UPDATE cc_feature_flags 
SET is_enabled = true, updated_at = NOW() 
WHERE key = 'job_tiers_enabled' AND scope_type = 'global';
```

Or use the admin API (requires service key authentication):

```bash
curl -X PATCH /api/p2/admin/feature-flags/job_tiers_enabled \
  -H "Content-Type: application/json" \
  -H "X-Service-Key: your-service-key" \
  -d '{"is_enabled": true}'
```

## Warning Behavior When Disabled

When tiering is disabled:

1. **Tier prices are zero**: `computeTierPrice()` returns `tierPriceCents: 0`
2. **Warning included**: Response includes `warning: 'TIERS_DISABLED'`
3. **Source tracked**: `source: 'default'` or the scope that disabled it
4. **No urgentEndsAt**: The urgent timebox is not set
5. **Breakdown still included**: For auditability, breakdown fields are present but zero

Example response when disabled:
```json
{
  "tierPriceCents": 0,
  "breakdown": {
    "attentionPriceCents": 0,
    "assistancePriceCents": 0,
    "attentionTier": "featured",
    "assistanceTier": "assisted"
  },
  "enabled": false,
  "source": "global",
  "warning": "TIERS_DISABLED"
}
```

## Pricing Breakdown (Auditability)

The publish endpoint returns a detailed pricing breakdown for each paid destination:

```json
{
  "pricing": {
    "currency": "CAD",
    "basePriceCents": 2900,
    "tierPriceCents": 0,
    "totalPriceCents": 2900,
    "breakdown": {
      "portal": {
        "portalId": "uuid",
        "name": "AdrenalineCanada",
        "basePriceCents": 2900,
        "billingInterval": "day",
        "durationDays": 30
      },
      "tiers": {
        "attentionTier": "standard",
        "assistanceTier": "none",
        "tierPriceCents": 0,
        "urgentEndsAt": null
      },
      "flags": {
        "tiersEnabled": false,
        "source": "global",
        "warning": "TIERS_DISABLED"
      }
    }
  }
}
```

## Testing

Run the tiering scaffold tests:

```bash
npx vitest run tests/tiering-scaffold.test.ts tests/tiering-scaffold-hardening.test.ts
```

Tests verify:
- Tiering availability returns disabled when flag is off
- Price computation returns zero when disabled
- Feature flags endpoints exist and respond appropriately
- Publish endpoint accepts tier fields without error
- Database schema is valid
- **CHECK 1**: Scope precedence (portal > tenant > global)
- **CHECK 2**: Deterministic pricing from config, not hardcoded
- **CHECK 3**: Tier + duration compatibility (urgentEndsAt timebox)
- **CHECK 4**: Pricing breakdown for auditability

## Future Work

When enabling this feature:

1. Implement actual tier pricing in `computeTierPrice`
2. Store tier selections in `cc_paid_publication_intents`
3. Display tier badges on published jobs
4. Add tier filtering to public job listings
5. Enable UI checkboxes in JobDestinationsPage
6. Add tier management to moderation dashboard
7. Implement tier duration tracking and expiration
