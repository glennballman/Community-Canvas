# V3.5 Reservation Engine Discovery Audit

**Date:** January 26, 2026  
**Scope:** `/p/:portalSlug/reserve` and `/p/:portalSlug/reserve/:assetId`

---

## Overview Diagram (Text)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PUBLIC RESERVATION FLOW                             │
│                        (V3.5 - NO CART SYSTEM)                               │
└─────────────────────────────────────────────────────────────────────────────┘

BROWSER                           SERVER                           DATABASE
───────                           ──────                           ────────
                                  
/p/:portalSlug/reserve            
    │                             
    ├──GET──▶ /api/public/cc_portals/:slug/availability ──▶ cc_assets
    │         (lines 1166-1280)                            cc_reservations
    │                                                      cc_resource_schedule_events
    │                             
    │  ◀──JSON── { assets[], summary }
    │                             
[User selects asset + dates]      
    │                             
    ├──POST──▶ /api/public/cc_portals/:slug/cc_reservations
    │          (lines 1388-1535)              
    │                                         ├──INSERT──▶ cc_reservations
    │                                         ├──INSERT──▶ cc_resource_schedule_events
    │                             
    │  ◀──JSON── { confirmation_number, reservation_id }
    │                             
[Confirmation View]               
```

---

## 1. UI Entry Points

### Primary Component
| File | Component | Lines |
|------|-----------|-------|
| `client/src/pages/public/PortalReservePage.tsx` | `PortalReservePage` | 1-517 |

### Route Registration
| File | Route | Element | Line |
|------|-------|---------|------|
| `client/src/App.tsx` | `/p/:portalSlug/reserve` | `<PortalReservePage />` | 332 |
| `client/src/App.tsx` | `/p/:portalSlug/reserve/:assetId` | `<PortalReservePage />` | 333 |

### Sub-Components (Internal to PortalReservePage)
| Component | Lines | Purpose |
|-----------|-------|---------|
| `DateRangePicker` | 58-127 | Check-in/out date selection |
| `AssetCard` | 138-202 | Display asset with availability badge |
| `ReservationForm` | 205-358 | Guest details form + submit |
| `ConfirmationView` | 361-396 | Shows confirmation number |

### Data Flow from Route Params
```typescript
// PortalReservePage.tsx:398-401
const params = useParams();
const portalSlug = params.portalSlug as string;
const assetIdParam = params.assetId as string | undefined;
```

---

## 2. Portal Context Dependency

### Endpoint Used for Portal Info
The reserve page does **NOT** call `/api/public/portal-context`.  
Instead, it fetches portal data implicitly via the availability endpoint response.

### Availability Endpoint Returns Portal Context
```json
// GET /api/public/cc_portals/:slug/availability
{
  "success": true,
  "portal": { "id": "uuid", "slug": "string", "name": "string" },
  "query": { "start": "ISO", "end": "ISO" },
  "assets": [...],
  "summary": { "total": N, "available": N, "reserved": N }
}
```

### Settings Flags Affecting Reservations
Currently **none** specific to reservation behavior. The portal `settings` JSONB is used for:
- `region` / `city` - geographic scoping
- `ferry_routes` - not used in reserve flow

---

## 3. API Calls Inventory (from UI)

| UI File | Function | Endpoint | Server Handler File | Handler Function | Notes |
|---------|----------|----------|---------------------|------------------|-------|
| `PortalReservePage.tsx:413-416` | `useQuery` | `GET /api/public/cc_portals/:slug/availability?start=X&end=Y` | `server/routes/public-portal.ts` | lines 1166-1280 | Checks asset availability |
| `PortalReservePage.tsx:230-244` | `useMutation` | `POST /api/public/cc_portals/:slug/cc_reservations` | `server/routes/public-portal.ts` | lines 1388-1535 | Creates reservation |

### Request/Response Shapes

**GET /api/public/cc_portals/:slug/availability**
```
Query Params: start (ISO), end (ISO), asset_id? (uuid), asset_type? (string)
Response: {
  success: boolean,
  portal: { id, slug, name },
  query: { start, end },
  assets: [{ asset_id, name, asset_type, available, busy_periods[] }],
  summary: { total, available, reserved }
}
```

**POST /api/public/cc_portals/:slug/cc_reservations**
```
Body: {
  asset_id: uuid,
  start: ISO,
  end: ISO,
  customer: { name, email, telephone? },
  notes?: string
}
Response: {
  success: boolean,
  reservation_id: uuid,
  confirmation_number: string,
  status: "pending",
  payment_status: "unpaid",
  asset: { id, name, type },
  dates: { start, end },
  customer: { name, email }
}
```

---

## 4. Server Route Map

### Route File
`server/routes/public-portal.ts`

### Handlers

| Endpoint | Handler Lines | Service Invoked | Scoping Mechanism |
|----------|---------------|-----------------|-------------------|
| `GET /cc_portals/:slug/availability` | 1166-1280 | Direct SQL (serviceQuery) | `portalSlug` → `cc_portals.owning_tenant_id` |
| `GET /cc_portals/:slug/availability/calendar` | 1287-1378 | Direct SQL (serviceQuery) | `portalSlug` → `cc_portals.owning_tenant_id` |
| `POST /cc_portals/:slug/cc_reservations` | 1388-1535 | Direct SQL (serviceQuery) | `portalSlug` → `cc_portals.owning_tenant_id` |

### Authorization / Tenant Scoping
- **No authentication required** - public endpoints
- Portal slug → Portal ID lookup → `owning_tenant_id` used to scope assets
- Asset verified to belong to tenant before reservation creation
- Conflict checking happens against both `cc_reservations` and `cc_resource_schedule_events`

---

## 5. Database Tables (Canonical V3.5)

### Tables Written by Reserve Flow

| Table | Written By | Purpose | Evidence |
|-------|------------|---------|----------|
| `cc_reservations` | POST `/cc_reservations` | Primary reservation record | public-portal.ts:1478-1490 |
| `cc_resource_schedule_events` | POST `/cc_reservations` | Blocks time slot | public-portal.ts:1506-1511 |

### Tables Read by Reserve Flow

| Table | Read By | Purpose |
|-------|---------|---------|
| `cc_portals` | All endpoints | Portal + tenant resolution |
| `cc_assets` | Availability + Create | Asset lookup + ownership verification |
| `cc_reservations` | Availability + Create | Conflict detection |
| `cc_resource_schedule_events` | Availability + Create | Schedule conflict detection |

### cc_reservations Schema (Key Columns)
```
id (uuid PK)
confirmation_number (varchar)
asset_id (uuid FK → cc_assets)
customer_id (uuid, nullable) -- NULL for public guests
provider_id (uuid) -- tenant who owns asset
primary_guest_name, primary_guest_email, primary_guest_telephone
start_date, end_date (timestamptz)
status ('pending' | 'confirmed' | 'cancelled' | etc.)
payment_status ('unpaid' | 'paid' | etc.)
portal_id (uuid) -- which portal originated reservation
schema_type (text) -- 'Reservation'
```

### Related Tables (Not Used by Public Reserve Flow)

| Table | Purpose | Notes |
|-------|---------|-------|
| `cc_folios` | Guest billing folio | Written at checkout/confirmation, not public reserve |
| `cc_folio_ledger` | Folio line items | Written at checkout |
| `cc_hold_requests` | Pre-reservation holds | Not used by current public flow |
| `cc_reservation_carts` | Cart-based multi-item | **SEPARATE SYSTEM** |
| `cc_reservation_cart_items` | Cart items | **SEPARATE SYSTEM** |

---

## 6. Scoping Model

### Portal → Tenant Resolution
```
1. portalSlug (from URL path)
2. cc_portals.slug = portalSlug
3. cc_portals.owning_tenant_id = tenantId
4. cc_assets.owner_tenant_id = tenantId
```

### Prefill Parameters Supported
| Parameter | Source | Used For |
|-----------|--------|----------|
| `portalSlug` | URL path | Portal scoping |
| `assetId` | URL path (optional) | Pre-select specific asset |
| `startDate` | Component state (default: tomorrow) | Date picker init |
| `endDate` | Component state (default: day after tomorrow) | Date picker init |

**Not currently supported from URL:**
- `?start=` / `?end=` query params
- `?guests=` / `?partySize=`

---

## 7. Gaps Identified (No Implementation)

1. **No payment integration** - Status is always `payment_status: 'unpaid'`
2. **No holds** - No `hold_expires_at` used; immediate reservation creation
3. **No pricing calculation** - `rate_daily`/`rate_hourly` not calculated into total
4. **No prefill from URL** - Query params ignored for dates/party size
5. **No folio creation** - No ledger entries created at reservation time
6. **No email confirmation** - Note says "email will be sent" but no actual sending
