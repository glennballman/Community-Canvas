# Command Console Demo Guide

This guide walks through demonstrating the Command Console feature, which provides real-time monitoring of BC infrastructure feeds for the Bamfield community portal.

## Overview

The Command Console is a Platform Admin feature that aggregates live data from multiple BC infrastructure sources:

- **BC Roads (DriveBC)**: Highway closures, delays, and road conditions
- **BC Ferries**: Ferry schedules, delays, and cancellations
- **Weather**: Environment Canada weather alerts and warnings
- **BC Hydro**: Power outages and restoration updates
- **Earthquakes**: Seismic activity from Earthquakes Canada
- **Dependency Rules**: Portal zone-specific feed monitoring rules
- **Bamfield Snapshot**: Aggregated status view for the Bamfield portal

## Prerequisites

1. Platform Admin user account (e.g., `tester@example.com`)
2. Demo data seeded (use DebugPanel "Demo Seed" button)

## Demo Steps

### 1. Seed Demo Data

First, ensure demo data is seeded:

1. Log in as a Platform Admin user
2. Open the DebugPanel (click the debug toggle in the bottom-right)
3. Click the "Demo Seed" button
4. Verify the response shows created dependency rules and demo alerts

This creates:
- Bamfield portal with 4 zones
- Demo dependency rules for seaplane, ferry, and road feeds
- Demo alerts for roads, ferries, and weather

### 2. Access Command Console

1. Navigate to `/app/platform` (Platform Admin mode)
2. In the sidebar, locate the "Command Console" section
3. You'll see 7 navigation links

### 3. Explore Feed Pages

Each feed page shows live data with scope filtering:

**BC Roads Page** (`/app/platform/command-console/roads`)
- Toggle between "Bamfield" (filtered) and "All BC" scope
- Shows road events with severity badges
- Displays highway, location, and effective dates

**BC Ferries Page** (`/app/platform/command-console/ferries`)
- Shows ferry alerts with delay/cancellation indicators
- Delay times shown in minutes

**Weather Page** (`/app/platform/command-console/weather`)
- Environment Canada alerts with warning types
- Wind, rain, and storm indicators

**BC Hydro Page** (`/app/platform/command-console/hydro`)
- Power outage information
- Shows customers affected counts

**Earthquakes Page** (`/app/platform/command-console/earthquakes`)
- Seismic events with magnitude badges
- Depth and location coordinates

**Dependency Rules Page** (`/app/platform/command-console/dependency-rules`)
- Table view of all portal dependency rules
- Shows portal, zone, feed type, source, and severity

**Bamfield Snapshot Page** (`/app/platform/command-console/bamfield`)
- Aggregated view of all feeds for Bamfield
- Overall status indicator (OK/Risky/Blocked)
- Quick links to detailed feed pages
- Portal zones and dependency rules summary

### 4. View Portal Conditions Bar

The public portal calendar now shows a conditions bar:

1. Navigate to `/p/bamfield/calendar`
2. At the top of the calendar, see the "Community Conditions" bar
3. Shows overall status and individual feed indicators
4. Status updates automatically every 5 minutes

### 5. Scope Filtering

The Bamfield region filter uses:
- **Keywords**: bamfield, alberni, tofino, ucluelet, port alberni, pacific rim, vancouver island, barkley sound
- **Geographic proximity**: ~100km radius from Bamfield (48.83, -125.13)

When "Bamfield" scope is selected, only events matching these criteria are shown.

## Data Sources

The Command Console queries two main tables:

- `cc_alerts`: General alerts from various pipelines
- `cc_transport_alerts`: Transport-specific alerts (ferries, etc.)

Pipelines run on schedule:
- DriveBC: Every 5 minutes
- BC Ferries: Every 10 minutes
- Weather: Every 30 minutes
- BC Hydro: Every 15 minutes
- Earthquakes: Every 10 minutes

## Known Limitations

1. **Firecrawl Credits**: BC Ferries and BC Hydro pipelines require Firecrawl credits. When exhausted (402 error), these feeds will not update until credits are refreshed.

2. **DriveBC API**: Sometimes returns 404 errors; the pipeline gracefully handles this.

3. **Demo Mode**: Demo alerts expire after 7 days. Re-run demo seed to refresh.

## API Endpoints

### Platform Admin (requires auth)
- `GET /api/p2/platform/command-console/roads?scope=bamfield|all`
- `GET /api/p2/platform/command-console/ferries?scope=bamfield|all`
- `GET /api/p2/platform/command-console/weather?scope=bamfield|all`
- `GET /api/p2/platform/command-console/hydro?scope=bamfield|all`
- `GET /api/p2/platform/command-console/earthquakes?scope=bamfield|all`
- `GET /api/p2/platform/command-console/dependency-rules`
- `GET /api/p2/platform/command-console/bamfield`

### Public (no auth required)
- `GET /api/public/portal/:portalSlug/conditions`

## File Locations

- **Backend API**: `server/routes/command-console.ts`
- **Public Conditions API**: `server/routes/public-portal-conditions.ts`
- **Platform Nav**: `client/src/lib/routes/platformNav.ts`
- **UI Pages**: `client/src/pages/app/platform/command-console/`
- **Conditions Bar**: `client/src/components/portal/PortalConditionsBar.tsx`
- **Demo Seed**: `server/routes/dev-demo.ts`
