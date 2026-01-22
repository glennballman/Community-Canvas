# N3-CAL-03 Feed Spine Discovery

## Overview

This document describes the existing live data feed infrastructure used by the Community Canvas platform. The dependency windows service integrates with these feeds to provide real-time travel and weather constraints.

## Feed System Architecture

### Pipeline Registry

Located at `server/pipelines/index.ts`:

```typescript
export const pipelines: PipelineConfig[] = [
  { id: 'drivebc', name: 'DriveBC Road Events', intervalMinutes: 5 },
  { id: 'bcferries', name: 'BC Ferries Conditions', intervalMinutes: 10 },
  { id: 'weather', name: 'Environment Canada Weather', intervalMinutes: 30 },
  { id: 'bchydro', name: 'BC Hydro Outages', intervalMinutes: 15 },
  { id: 'earthquakes', name: 'Earthquakes Canada', intervalMinutes: 10 }
];
```

### Pipeline Data Flow

```
External Source → Pipeline.fetch() → Pipeline.transform() → Pipeline.load() → Database Tables
```

## Primary Feed Tables

### cc_alerts (main alerts table)

Used by: weather, drivebc pipelines

```sql
cc_alerts (
  id UUID PRIMARY KEY,
  entity_id UUID,
  region_id VARCHAR,
  alert_type VARCHAR,           -- 'weather', 'closure', etc.
  severity severity_level,      -- 'minor', 'warning', 'major'
  signal_type VARCHAR,          -- 'environment_canada', 'drivebc', etc.
  title VARCHAR(255),
  summary VARCHAR(255),
  message TEXT,
  details JSONB,                -- Provider-specific data
  latitude NUMERIC,
  longitude NUMERIC,
  effective_from TIMESTAMPTZ,
  effective_until TIMESTAMPTZ,
  is_active BOOLEAN,
  source_key VARCHAR,           -- Unique key per source
  observed_at TIMESTAMPTZ
)
```

### cc_transport_alerts (ferry/transport-specific)

Used by: bcferries pipeline (indirectly via entity updates)

```sql
cc_transport_alerts (
  id UUID PRIMARY KEY,
  portal_id UUID,
  operator_id UUID,
  sailing_id UUID,
  location_id UUID,
  alert_type VARCHAR,           -- 'delay', 'cancellation', 'weather_hold'
  severity VARCHAR,
  title VARCHAR,
  message TEXT,
  affected_date DATE,
  delay_minutes INTEGER,
  status VARCHAR,               -- 'active', 'resolved'
  source VARCHAR,
  source_ref VARCHAR
)
```

### cc_entities (real-time entity state)

Ferry terminals/routes, weather stations store live status in `configuration` JSONB:

```sql
cc_entities.configuration = {
  "current_status": "delayed",
  "delay_minutes": 30,
  "advisory": "High winds affecting sailings",
  "last_updated": "2026-01-22T16:00:00Z"
}
```

## Service Integration Points

### Weather Pipeline (`server/pipelines/weather.ts`)

- **Source**: Environment Canada XML feeds
- **Stations**: 20 BC weather stations (Vancouver, Victoria, Tofino, etc.)
- **Data**: Temperature, wind speed/direction/gusts, visibility, conditions
- **Alerts**: Weather warnings extracted from XML, saved to cc_alerts

Key fields for dependency windows:
- `alert_type = 'weather'`
- `signal_type = 'environment_canada'`
- `details.warning_type` (storm, wind, etc.)
- `region_id` links to cc_geo_regions

### DriveBC Pipeline (`server/pipelines/drivebc.ts`)

- **Source**: Open511 BC API
- **Data**: Road closures, incidents, construction
- **Alerts**: Saved to cc_alerts with `alert_type = 'closure'`

Key fields:
- `alert_type = 'closure'`
- `signal_type = 'drivebc'`
- `details.event_type` (ROAD_CLOSURE, INCIDENT, CONSTRUCTION)
- `details.roads` (affected road names)
- `latitude`, `longitude` for geo-matching

### BC Ferries Pipeline (`server/pipelines/bcferries.ts`)

- **Source**: bcferries.com via Firecrawl
- **Data**: Route status, capacity, delays, cancellations
- **Storage**: Updates cc_entities with ferry-terminal/ferry-route types

Key fields in entity configuration:
- `current_status`: 'on_time', 'delayed', 'cancelled'
- `delay_minutes`
- `advisory`
- `next_sailing`

## Query Patterns for Dependency Windows

### Active Weather Alerts in Time Window

```sql
SELECT * FROM cc_alerts
WHERE alert_type = 'weather'
  AND is_active = true
  AND (effective_until IS NULL OR effective_until > $1)
  AND effective_from < $2;
```

### Active Road Closures Near Location

```sql
SELECT * FROM cc_alerts
WHERE alert_type = 'closure'
  AND is_active = true
  AND (effective_until IS NULL OR effective_until > $1)
  AND effective_from < $2
  AND SQRT(POWER(latitude - $3, 2) + POWER(longitude - $4, 2)) < $5;
```

### Ferry Status for Portal Routes

```sql
SELECT configuration FROM cc_entities
WHERE entity_type_id = 'ferry-route'
  AND slug LIKE 'bcferries-route-%';
```

### Transport Alerts for Portal

```sql
SELECT * FROM cc_transport_alerts
WHERE portal_id = $1
  AND status = 'active'
  AND (affected_date IS NULL OR affected_date = $2);
```

## Zone Mapping Strategy

### Option 1: Geo-Based (Automatic)

Match cc_alerts.latitude/longitude or cc_alerts.region_id to portal zones:
1. Query portal zones with their centroids
2. Compute distance from alert to zone centroid
3. Include alert if within threshold (e.g., 50km)

### Option 2: Rule-Based (cc_portal_dependency_rules)

For non-geo sources (seaplane, specific ferry routes):

```sql
cc_portal_dependency_rules (
  id UUID PRIMARY KEY,
  portal_id UUID NOT NULL,
  dependency_type VARCHAR(30) NOT NULL,  -- 'seaplane', 'ferry', 'weather', 'road'
  rule_payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

Example rule_payload:
```json
{
  "affectedZones": ["west-bamfield", "helby-island"],
  "sourcePattern": "seaplane%",
  "severity": "critical"
}
```

## Fallback Behavior

When feed data is unavailable:
1. Check for cached alerts within 1 hour
2. If no recent data AND (NODE_ENV=development OR CC_DEV_SEED=true):
   - Return dev_seed windows with `source: 'dev_seed'`
3. Otherwise return empty array

## Related Files

- `server/pipelines/index.ts` - Pipeline scheduler
- `server/pipelines/weather.ts` - Weather feed
- `server/pipelines/drivebc.ts` - Road events feed
- `server/pipelines/bcferries.ts` - Ferry status feed
- `server/pipelines/earthquakes.ts` - Earthquake feed
- `server/pipelines/bchydro.ts` - Power outage feed
- `server/pipelines/base-pipeline.ts` - Base pipeline class
