# REPLIT: V1 UI Inventory Audit

Generate a complete inventory of the current UI so we can plan the V3 rebuild.

---

## Part 1: Route Tree

Output all frontend routes in the application.

```bash
# If using file-based routing (Next.js style)
find client/src -name "*.tsx" -path "*/pages/*" -o -name "*.tsx" -path "*/app/*" | sort

# If using react-router
grep -r "path=" client/src --include="*.tsx" | grep -E "Route|path:" | head -100
```

**Deliverable:** List every route with its file path:
```
/dashboard → client/src/pages/Dashboard.tsx
/reservations → client/src/pages/Reservations.tsx
/reservations/:id → client/src/pages/ReservationDetail.tsx
...
```

---

## Part 2: Navigation Structure

Find and output the left navigation component:

```bash
# Common locations
cat client/src/components/nav/*.tsx 2>/dev/null
cat client/src/components/layout/Sidebar.tsx 2>/dev/null
cat client/src/components/shell/*.tsx 2>/dev/null

# Or search for nav-related components
grep -r "nav" client/src/components --include="*.tsx" -l
```

**Deliverable:** 
1. The file path of the main navigation component
2. The full source code of that component
3. List of nav items currently shown

---

## Part 3: API Endpoints Used by UI

Find all API calls from the frontend:

```bash
# Search for fetch/axios calls
grep -r "fetch\|axios\|useQuery\|useMutation" client/src --include="*.tsx" --include="*.ts" | grep -E "/api/" | head -100

# Or search for API route patterns
grep -r '"/api/' client/src --include="*.tsx" --include="*.ts" | sort -u
```

**Deliverable:** List of all `/api/*` endpoints the UI currently calls.

---

## Part 4: Major Components Inventory

List all shared/reusable components:

```bash
ls -la client/src/components/
ls -la client/src/components/ui/ 2>/dev/null
ls -la client/src/components/shared/ 2>/dev/null
```

For each major component directory, list:
- Component name
- What it does (table, form, modal, card, etc.)
- Where it's used

---

## Part 5: Current Shell/Layout Structure

Find the main layout wrapper:

```bash
grep -r "children" client/src/components --include="*.tsx" | grep -i "layout\|shell\|wrapper" | head -20

# Output the main layout file
cat client/src/components/layout/MainLayout.tsx 2>/dev/null
cat client/src/App.tsx | head -100
```

**Deliverable:** The shell/layout component that wraps all pages.

---

## Part 6: Screenshot Descriptions

For each major page that exists, describe:
1. Page name and route
2. What data it displays
3. What actions are available
4. Current state (working, broken, placeholder)

Pages to check:
- [ ] Dashboard (`/dashboard` or `/`)
- [ ] Reservations list (`/reservations`)
- [ ] Reservation detail (`/reservations/:id`)
- [ ] Assets/Inventory (`/assets` or `/inventory`)
- [ ] People/Contacts (`/people` or `/contacts`)
- [ ] Organizations (`/organizations`)
- [ ] Work Requests (`/work-requests`)
- [ ] Projects (`/projects`)
- [ ] Operations Board (`/operations`)
- [ ] Settings (`/settings`)
- [ ] Any portal pages (`/portal/*`)

---

## Part 7: Role/Permission UI Elements

Find any role-based UI logic:

```bash
grep -r "role\|permission\|isAdmin\|canEdit\|hasAccess" client/src --include="*.tsx" | head -50
```

**Deliverable:** List of UI elements that change based on user role.

---

## Part 8: Current Terminology Check

Search for banned terminology that needs to be fixed:

```bash
# These should NOT exist in V3
grep -ri "booking" client/src --include="*.tsx" --include="*.ts" | wc -l
grep -ri "booked" client/src --include="*.tsx" --include="*.ts" | wc -l
grep -ri "booker" client/src --include="*.tsx" --include="*.ts" | wc -l
grep -ri "inventory" client/src --include="*.tsx" --include="*.ts" | wc -l
grep -ri "contacts" client/src --include="*.tsx" --include="*.ts" | wc -l

# List the actual occurrences
grep -rni "booking\|booked\|booker" client/src --include="*.tsx" --include="*.ts"
```

**Deliverable:** Count and location of all banned terminology.

---

## Output Format

Create a markdown file `docs/ui/V1_UI_INVENTORY.md` with this structure:

```markdown
# V1 UI Inventory

Generated: [date]

## 1. Route Tree
| Route | File | Status |
|-------|------|--------|
| /dashboard | client/src/pages/Dashboard.tsx | Working |
| ... | ... | ... |

## 2. Navigation Structure
**File:** `client/src/components/nav/Sidebar.tsx`

Current nav items:
- Dashboard
- Reservations
- ...

## 3. API Endpoints Used
| Endpoint | Method | Used By |
|----------|--------|---------|
| /api/reservations | GET | Reservations.tsx |
| ... | ... | ... |

## 4. Component Library
| Component | Type | Location |
|-----------|------|----------|
| DataTable | table | components/ui/DataTable.tsx |
| ... | ... | ... |

## 5. Shell/Layout
**File:** `client/src/components/layout/MainLayout.tsx`

Structure:
- Header (tenant context)
- Sidebar (navigation)
- Main content area
- Footer (if any)

## 6. Page Status
| Page | Route | Data Source | Status |
|------|-------|-------------|--------|
| Dashboard | / | multiple | Working |
| ... | ... | ... | ... |

## 7. Role-Based Elements
| Element | Roles Affected | Logic |
|---------|----------------|-------|
| Admin menu | platform_admin | isAdmin check |
| ... | ... | ... |

## 8. Terminology Violations
| Term | Count | Files |
|------|-------|-------|
| booking | 12 | page1.tsx, page2.tsx |
| ... | ... | ... |
```

---

## After This Audit

Once you produce `V1_UI_INVENTORY.md`, paste it back and I will:

1. Create `V3_UI_GUARDRAILS.md` (locked terminology, banned patterns)
2. Create `V3_ROUTE_MAP.md` (complete page list for V3)
3. Create `V3Shell.tsx` specification
4. Create first slice page specs (Dashboard + Wallet Overview)

BEGIN AUDIT.
