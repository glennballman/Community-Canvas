# Cart Touchpoints Proof - V3.5 Reserve Flow

**Date:** January 26, 2026  
**Conclusion:** Reserve flow does **NOT** touch cart.

---

## Summary

The `/p/:portalSlug/reserve` flow operates completely independently from the cart system. The cart system exists as a **separate, parallel reservation mechanism** used by `/reserve/:portalSlug/:offerSlug` routes.

---

## Evidence

### 1. Client-Side: PortalReservePage.tsx

**Search Command:**
```bash
grep -n "cart\|Cart\|addItem\|CreateCart" client/src/pages/public/PortalReservePage.tsx
```

**Result:**
```
No matches found
```

**API Calls Made (from code review):**
- Line 414: `GET /api/public/cc_portals/${portalSlug}/availability`
- Line 232: `POST /api/public/cc_portals/${portalSlug}/cc_reservations`

Neither endpoint references cart.

---

### 2. Client-Side: No Cart Imports in /pages/public/

**Search Command:**
```bash
grep -r "cartService\|CreateCartRequest\|AddItemRequest\|/api/cart" client/src/pages/public/
```

**Result:**
```
No matches found
```

The entire `/pages/public/` directory contains no cart references.

---

### 3. Server-Side: POST /cc_reservations Handler

**File:** `server/routes/public-portal.ts`  
**Lines:** 1388-1535

**Search for cart in handler:**
```bash
# Within lines 1388-1535 of the POST /cc_reservations handler:
# - No imports of cartService used
# - No calls to createCart, getCart, addItem
# - Direct INSERT into cc_reservations
```

**Actual INSERT statement (lines 1478-1490):**
```sql
INSERT INTO cc_reservations (
  confirmation_number, asset_id, provider_id,
  primary_guest_name, primary_guest_email, primary_guest_telephone,
  start_date, end_date, status, payment_status, portal_id,
  special_requests, schema_type
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', 'unpaid', $9, $10, 'Reservation')
```

No cart_id reference. Direct database insert.

---

### 4. Server-Side: Cart Imports in public-portal.ts

**Found (line 5-8):**
```typescript
import { createCart, getCart, addItem, updateItem, removeItem, addAdjustment, updateCartGuest } from '../services/cartService';
import { checkout, confirmQuote, abandonCart } from '../services/checkoutService';
```

**But these are used ONLY by separate endpoints:**
- `/api/public/carts` (line 1899+) - Create cart
- `/api/public/carts/:cartId` (line 1936+) - Get cart
- `/api/public/carts/:cartId/items` (line 1955+) - Add item
- `/api/public/carts/:cartId/checkout` (line 2240+) - Checkout

These are part of the **ReserveShell** multi-item cart flow (`/reserve/:portalSlug/:offerSlug`), which is a **completely separate UI** from PortalReservePage.

---

### 5. Two Parallel Reservation Systems

| System | UI Route | API Endpoints | Database Tables |
|--------|----------|---------------|-----------------|
| **V3.5 Direct** | `/p/:portalSlug/reserve` | `/api/public/cc_portals/:slug/cc_reservations` | `cc_reservations`, `cc_resource_schedule_events` |
| **Cart-Based** | `/reserve/:portalSlug/:offerSlug` | `/api/public/carts/*` | `cc_reservation_carts`, `cc_reservation_cart_items`, `cc_reservation_cart_adjustments` |

---

## Conclusion

**Reserve flow touches cart: NO**

The `/p/:portalSlug/reserve` flow:
1. Uses `PortalReservePage.tsx` (no cart imports)
2. Calls availability + create endpoints (no cart references)
3. Writes directly to `cc_reservations` table
4. Does NOT create/use cart records

The cart system exists but is used by a different flow (`/reserve/:portalSlug/:offerSlug` with `ReserveShell`).

---

## Recommendation

Experience Bamfield can safely wire into the V3.5 Direct system:
- Use `/api/public/cc_portals/:slug/availability` for availability checks
- Use `/api/public/cc_portals/:slug/cc_reservations` for reservation creation
- No cart integration needed or recommended
