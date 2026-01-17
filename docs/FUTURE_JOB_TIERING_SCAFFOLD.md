# Future Job Tiering Scaffold

## Overview

This document describes the scaffolded infrastructure for job visibility tiers and hiring assistance tiers. This feature is **DISABLED BY DEFAULT** and controlled via the `job_tiers_enabled` feature flag in the `cc_feature_flags` table.

## Feature Summary

When enabled, tenants can purchase additional visibility or assistance tiers for their job postings on paid portals. These tiers are additive to the base portal posting price.

### Attention Tiers (Visibility Boost)
- **Featured** (+$1.00/day): Highlighted placement in search results
- **Urgent** ($7.00 flat for 7 days): "Urgently Hiring" badge displayed

### Assistance Tiers (Platform Support)
- **Assisted** ($9.00/month): Platform screening assistance for applicants

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

## Testing

Run the tiering scaffold tests:

```bash
npm run test -- tests/tiering-scaffold.test.ts
```

Tests verify:
- Tiering availability returns disabled when flag is off
- Price computation returns zero when disabled
- Feature flags endpoints exist and respond appropriately
- Publish endpoint accepts tier fields without error
- Database schema is valid

## Future Work

When enabling this feature:

1. Implement actual tier pricing in `computeTierPrice`
2. Store tier selections in `cc_paid_publication_intents`
3. Display tier badges on published jobs
4. Add tier filtering to public job listings
5. Enable UI checkboxes in JobDestinationsPage
6. Add tier management to moderation dashboard
7. Implement tier duration tracking and expiration
