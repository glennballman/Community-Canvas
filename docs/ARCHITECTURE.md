# System Architecture

> Last Updated: December 29, 2025
> Version: 1.0.0

This document describes the technical architecture of the Community Status Dashboard.

---

## Overview

Bloomberg-terminal style community status dashboard for monitoring infrastructure and chamber of commerce data across North America.

---

## Technology Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| React 18 | UI framework |
| TypeScript | Type safety |
| Vite | Build tool |
| TanStack Query | Server state & caching |
| Wouter | Client-side routing |
| Tailwind CSS | Styling |
| shadcn/ui | Component library |
| Framer Motion | Animations |
| Mapbox GL | Interactive maps |

### Backend
| Technology | Purpose |
|------------|---------|
| Node.js | Runtime |
| Express.js | HTTP server |
| TypeScript | Type safety |
| Drizzle ORM | Database access |

### Database
| Technology | Purpose |
|------------|---------|
| PostgreSQL | Primary data store |
| JSONB | Flexible data storage |

### External Services
| Service | Purpose |
|---------|---------|
| Firecrawl | AI-powered web scraping |
| Mapbox | Map rendering |

---

## File Structure

```
project/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   └── ui/           # shadcn components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── lib/              # Utilities
│   │   ├── pages/            # Route components
│   │   │   ├── Dashboard.tsx
│   │   │   ├── AdminChambers.tsx
│   │   │   └── AdminNAICS.tsx
│   │   ├── App.tsx           # Root component
│   │   └── main.tsx          # Entry point
│   └── index.html
├── server/
│   ├── routes.ts             # API endpoints
│   ├── storage.ts            # Database interface
│   └── index.ts              # Server entry
├── shared/
│   ├── schema.ts             # Database schema
│   ├── chambers-of-commerce.ts
│   ├── chamber-members.ts
│   ├── chamber-progress.ts
│   └── [infrastructure datasets]
├── docs/
│   ├── DATA_COLLECTION.md
│   ├── ARCHITECTURE.md
│   └── index.md
└── package.json
```

---

## Data Models

### Chamber of Commerce

```typescript
interface ChamberOfCommerce {
  id: string;           // Unique identifier (slug)
  name: string;         // Official name
  region: string;       // Regional district
  municipality: string; // City/town
  location: {
    lat: number;
    lng: number;
  };
  phone?: string;
  email?: string;
  website?: string;
  members?: string;     // Raw member count string from website
  founded?: number;
}
```

### Chamber Member

```typescript
interface ChamberMember {
  id: string;           // Unique identifier
  chamberId: string;    // Foreign key to chamber
  name: string;         // Business name
  businessType?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  naicsCode?: string;   // 2-6 digit NAICS code
  dateAdded: string;    // ISO 8601 date (REQUIRED)
}
```

### Chamber Progress

```typescript
interface ChamberProgress {
  chamberId: string;
  chamberName: string;
  region: string;
  municipality: string;
  status: 'pending' | 'in_progress' | 'partial' | 'completed' | 'blocked';
  actualMembers: number;
  expectedMembers: number | null;
  estimatedMembers: number;
  naicsCoverage: number | null;
  partialReasons: ('below_member_threshold' | 'below_percent_complete')[];
  lastUpdated: string | null;
  notes: string | null;
  blockedReason: string | null;
}
```

### Chamber Override (Database)

```sql
CREATE TABLE chamber_overrides (
  chamber_id TEXT PRIMARY KEY,
  expected_members INTEGER,
  estimated_members INTEGER,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## API Endpoints

### Public Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/chambers/locations` | Chamber map markers with status |
| GET | `/api/mapbox/token` | Mapbox access token |

### Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/chamber-progress` | Full progress list with overrides |
| GET | `/api/admin/chamber-overrides` | All manual overrides |
| PUT | `/api/admin/chamber-overrides/:id` | Set/update chamber override |
| GET | `/api/admin/naics` | NAICS code data |

---

## Progress Calculation Flow

```
1. Load base progress from getChamberProgressList()
   ├── Count members per chamber from chamber-members.ts
   ├── Get Expected from chamber metadata (parsed)
   ├── Calculate Estimated (actual×1.2 or region default)
   └── Determine initial status

2. Fetch overrides from database
   └── SELECT * FROM chamber_overrides

3. Apply overrides to progress list
   ├── Override expectedMembers if set
   ├── Override estimatedMembers if set
   └── Recalculate status based on new targets

4. Return adjusted progress with summary statistics
```

### Status Calculation Logic

```typescript
function determineStatus(actual: number, expected: number | null, estimated: number) {
  if (actual === 0) return 'pending';
  
  const MEMBER_THRESHOLD = 30;
  const PERCENT_THRESHOLD = 80;
  
  const hasSufficientMembers = actual >= MEMBER_THRESHOLD;
  const target = expected ?? estimated;
  const percentComplete = Math.floor((actual / target) * 100);
  const hasSufficientPercent = percentComplete >= PERCENT_THRESHOLD;
  
  if (hasSufficientMembers && hasSufficientPercent) {
    return 'completed';
  }
  return 'partial';
}
```

---

## Infrastructure Datasets

Located in `shared/` directory, each dataset includes:
- GPS coordinates for map plotting
- Geographic correlation to municipalities/regions
- Operational metadata

| Dataset | File | Count |
|---------|------|-------|
| Aviation | `aviation.ts` | 45+ airports |
| Weather Stations | `weather-stations.ts` | 60+ stations |
| Marine | `marine.ts` | 170+ facilities |
| Emergency Services | `emergency-services.ts` | 150+ facilities |
| Search and Rescue | `search-rescue.ts` | 78 GSAR groups |
| Ground Transport | `ground-transport.ts` | Multi-category |
| Taxi Services | `taxi-services.ts` | 80+ companies |
| Pharmacies | `pharmacies.ts` | 400+ locations |
| Community Facilities | `community-facilities.ts` | 158+ facilities |
| Schools | `schools.ts` | 314+ institutions |
| Chambers of Commerce | `chambers-of-commerce.ts` | 107 chambers |
| Municipal Offices | `municipal-offices.ts` | 200+ offices |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `FIRECRAWL_API_KEY` | Yes | Firecrawl API access |
| `MAPBOX_ACCESS_TOKEN` | Yes | Mapbox API access |
| `SESSION_SECRET` | Yes | Express session secret |

---

## Development Commands

```bash
npm run dev      # Start development server
npm run db:push  # Push schema to database
npm run build    # Production build
```

---

## Deployment Notes

- Frontend and backend served on same port (5000)
- PostgreSQL database via Replit's built-in service
- Static assets bundled by Vite
- Auto-restart on code changes

---

*This document is version-controlled and should be updated with architectural changes.*
