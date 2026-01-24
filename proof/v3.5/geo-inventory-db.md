# V3.5 Geo Inventory - Database Audit

**Generated**: 2026-01-24  
**Purpose**: Evidence-first inventory of all geo-bearing columns in cc_* tables

## CRITICAL ENVIRONMENT NOTE

**PostGIS NOT available in production.** The Replit production PostgreSQL does not support the `geography` type. All geo calculations must use:
- Standard `numeric(10,7)` lat/lng columns
- `fn_haversine_meters()` UDF for distance calculations
- Integer `lat_cell`/`lon_cell` for grid-based indexing

---

## A1) Columns with Coordinate Names

Tables with lat/lng/longitude/latitude columns:

| Table | Column | Type |
|-------|--------|------|
| cc_accommodation_properties | latitude, longitude | numeric(10,7) |
| cc_alerts | latitude, longitude | numeric(10,7) |
| cc_asset_availability | location_latitude, location_longitude | numeric(10,7) |
| cc_assets | latitude, longitude, lat_cell, lon_cell | numeric(10,7), int |
| cc_bundle_opportunities | center_lat, center_lon | numeric |
| cc_catalog_items | latitude, longitude | numeric(10,7) |
| cc_catalog_listings | latitude, longitude | numeric(10,7) |
| cc_citations | lat, lon | numeric(9,6) |
| cc_civos_signals | latitude, longitude | numeric(10,7) |
| cc_communities | latitude, longitude | numeric |
| cc_community_constraint_packs | center_lat, center_lon | numeric |
| cc_compliance_checks | lat, lon | numeric(9,6) |
| cc_contractor_jobsites | geo_lat, geo_lng | numeric(10,7) |
| cc_contractor_photo_bundles | centroid_lat, centroid_lng | numeric |
| cc_crm_properties | latitude, longitude | numeric(10,7) |
| cc_cultural_sites | lat, lon | numeric(9,6) |
| cc_entities | latitude, longitude, lat_cell, lon_cell | numeric(10,7), int |
| cc_external_records | latitude, longitude, lat_cell, lon_cell | double precision, int |
| cc_facilities | geo_lat, geo_lon | numeric(10,7) |
| cc_fleets | default_home_base_lat, default_home_base_lng | numeric(10,7) |
| cc_geo_entity_links | lat, lng | numeric(10,7) |
| cc_geo_place_candidates | lat, lng | numeric(10,7) |
| cc_geo_regions | centroid_lat, centroid_lon | numeric(10,7) |
| cc_incident_reports | lat, lon | numeric(9,6) |
| cc_incident_responses | location_lat, location_lng | numeric |
| cc_incidents | latitude, longitude | numeric(10,7) |
| cc_jobs | latitude, longitude | numeric |
| cc_locations | lat, lon | numeric(9,6) |
| cc_media | geo_lat, geo_lng | numeric(10,7) |
| cc_organizations | latitude, longitude | numeric(10,7) |
| cc_portal_moments | location_lat, location_lng | numeric(10,7) |
| cc_procurement_requests | site_latitude, site_longitude, site_lat_cell, site_lon_cell | numeric(10,7), int |
| cc_project_photos | geo_lat, geo_lng | numeric(10,7) |
| cc_proof_of_handling | lat, lon | numeric(9,6) |
| cc_properties | lat, lon | numeric(9,6) |
| cc_property_emergency_profiles | lat, lon | numeric |
| cc_quote_drafts | geo_lat, geo_lng | numeric(10,7) |
| cc_region_boundaries | lat_min, lat_max, lng_min, lng_max | numeric(10,7) |
| cc_road_trips | start_location_lat, start_location_lng, end_location_lat, end_location_lng | numeric(10,7) |
| cc_route_segments | start_lat, start_lng, end_lat, end_lng | numeric(10,7) |
| cc_service_run_reservations | customer_location_lat, customer_location_lng | numeric(10,7) |
| cc_sr_communities | latitude, longitude, lat_cell, lon_cell | numeric(9,6), int |
| cc_sr_service_slots | property_lat, property_lng | numeric(10,7) |
| cc_staging_import_raw | latitude, longitude | numeric(10,7) |
| cc_staging_properties | latitude, longitude | numeric(10,7) |
| cc_staging_trips | origin_lat, origin_lng, destination_lat, destination_lng | numeric(10,7) |
| cc_tenant_start_addresses | latitude, longitude | numeric(10,7) |
| cc_tow_requests | latitude, longitude | numeric(10,7) |
| cc_trip_itinerary_items | location_lat, location_lng | numeric(10,7) |
| cc_trip_route_points | location_lat, location_lng | numeric(10,7) |
| cc_trip_segment_templates | location_lat, location_lng | numeric(10,7) |
| cc_trip_timepoints | location_lat, location_lng | numeric(10,7) |
| cc_trips | origin_lat, origin_lng, next_destination_lat, next_destination_lng | numeric(10,7) |
| cc_user_profiles | latitude, longitude | numeric(10,7) |
| cc_work_orders | site_latitude, site_longitude, site_lat_cell, site_lon_cell | numeric(10,7), int |

**Total: 50+ tables with coordinate columns**

---

## A2) Location/Community/Geo Tables

Tables with location/community/place/geo in name:

| Table | Purpose |
|-------|---------|
| cc_community_charges | Community fee records |
| cc_community_constraint_packs | Community constraint boundaries |
| cc_community_events | Community event records |
| cc_community_identities | Community identity verification |
| cc_community_verifications | Community verification records |
| cc_geo_entity_links | Entity-to-geo binding |
| cc_geo_place_candidates | Geocoding place candidates |
| cc_geo_regions | BC regional districts hierarchy |
| cc_locations | Canonical location entities (terminals, stops, etc.) |
| cc_sr_community_bundles | Service run community bundles |

---

## A3) Key Geo-Bearing Table Schemas

### cc_locations (Canonical Locations)
```
id                      uuid NOT NULL
tenant_id               uuid
portal_id               uuid
name                    text NOT NULL
code                    varchar
location_type           text NOT NULL
lat                     numeric(9,6)
lon                     numeric(9,6)
region                  varchar
timezone                varchar
address_line1           text
address_city            text
address_province        varchar
address_postal_code     varchar
authority_type          varchar
authority_name          text
authority_rules         jsonb NOT NULL
stop_capabilities       jsonb NOT NULL
contact_*               text (name, phone, email)
operating_hours_json    jsonb
connected_locations     text[]
travel_time_minutes_json jsonb
status                  varchar
```

### cc_communities (Public Communities)
```
id                  uuid NOT NULL
name                text NOT NULL
slug                text NOT NULL
region_name         text
province            text
country             text
latitude            numeric
longitude           numeric
timezone            text
population_estimate integer
is_remote           boolean
portal_id           uuid
```

### cc_sr_communities (Service Run Communities)
```
id                      uuid NOT NULL
tenant_id               uuid
name                    text NOT NULL
region                  text NOT NULL
country                 text NOT NULL
latitude                numeric(9,6)
longitude               numeric(9,6)
climate_region_id       uuid NOT NULL
remote_multiplier       numeric NOT NULL
lat_cell                integer
lon_cell                integer
```

### cc_geo_regions (BC Geographic Hierarchy)
```
id              varchar NOT NULL
name            varchar NOT NULL
slug            varchar NOT NULL
region_type     varchar NOT NULL (e.g., 'province', 'regional_district', 'municipality')
parent_id       varchar (FK to self)
centroid_lat    numeric(10,7)
centroid_lon    numeric(10,7)
boundary        jsonb
timezone        varchar
population      integer
```

### cc_assets (Rentable Assets)
```
latitude        numeric(10,7)
longitude       numeric(10,7)
lat_cell        integer
lon_cell        integer
```

### cc_properties (Managed Properties)
```
lat             numeric(9,6)
lon             numeric(9,6)
location_id     uuid FK → cc_locations
zone_id         uuid FK → cc_zones
```

---

## A4) Foreign Keys to Geo-Bearing Tables

### To cc_locations (17 FKs)
| From Table | Column | Purpose |
|------------|--------|---------|
| cc_cultural_sites | location_id | Cultural site location |
| cc_freight_manifests | origin_location_id | Shipment origin |
| cc_freight_manifests | destination_location_id | Shipment dest |
| cc_freight_manifests | consignee_location_id | Consignee |
| cc_incident_reports | location_id | Incident site |
| cc_maintenance_requests | location_id | Work location |
| cc_port_calls | location_id | Port/terminal |
| cc_proof_of_handling | location_id | Handling evidence |
| cc_properties | location_id | Property anchor |
| cc_sailing_schedules | origin_location_id | Ferry origin |
| cc_sailing_schedules | destination_location_id | Ferry dest |
| cc_sailings | origin_location_id | Sailing origin |
| cc_sailings | destination_location_id | Sailing dest |
| cc_transport_alerts | location_id | Alert location |
| cc_transport_requests | origin_location_id | Transport origin |
| cc_transport_requests | destination_location_id | Transport dest |
| cc_trip_permits | source_location_id | Permit source |
| cc_visitor_permits | location_id | Visitor site |

### To cc_sr_communities (10 FKs)
| From Table | Column | Purpose |
|------------|--------|---------|
| cc_apify_datasets | community_id | Data source community |
| cc_entities | community_id | Entity's community |
| cc_external_records | community_id | Scraped record community |
| cc_individual_tools | current_community_id | Tool location |
| cc_individuals | home_community_id | Home community |
| cc_individuals | current_community_id | Current location |
| cc_rental_items | home_community_id | Rental home base |
| cc_sr_service_runs | community_id | Run community |
| cc_tenant_trailers | home_community_id | Trailer home |
| cc_tenant_vehicles | home_community_id | Vehicle home |

### To cc_communities (7 FKs)
| From Table | Column | Purpose |
|------------|--------|---------|
| cc_activity_events | community_id | Activity community |
| cc_contemporaneous_notes | community_id | Note community |
| cc_incident_prompts | community_id | Prompt community |
| cc_incident_responses | community_id | Response community |
| cc_jobs | community_id | Job community |
| cc_record_bundles | community_id | Bundle community |

### To cc_geo_regions (3 FKs)
| From Table | Column | Purpose |
|------------|--------|---------|
| cc_accommodation_properties | municipality_id | Property municipality |
| cc_alerts | region_id | Alert region |
| cc_entities | primary_region_id | Entity region |

### To cc_assets (14 FKs)
Direct geo via cc_assets.latitude/longitude:
- cc_reservations, cc_folios, cc_enforcement_actions, cc_bond_coverage, etc.

### To cc_properties (16 FKs)
Direct geo via cc_properties.lat/lon:
- cc_units, cc_pms_reservations, cc_housekeeping_*, cc_compliance_*, etc.

---

## Summary: Primary Geo Anchor Tables

| Rank | Table | Has lat/lng | FK'd By | Role |
|------|-------|-------------|---------|------|
| 1 | cc_locations | YES (9,6) | 17 tables | Canonical terminals/stops |
| 2 | cc_sr_communities | YES (9,6) | 10 tables | Service run communities |
| 3 | cc_communities | YES | 7 tables | Public communities |
| 4 | cc_geo_regions | YES (10,7) | 3 tables | BC geo hierarchy |
| 5 | cc_assets | YES (10,7) | 14 tables | Rentable assets |
| 6 | cc_properties | YES (9,6) | 16 tables | Managed properties |
| 7 | cc_tenant_start_addresses | YES (10,7) | cc_n3_runs | Run start addresses |
