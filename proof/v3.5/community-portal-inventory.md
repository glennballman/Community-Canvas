# Community Portal Inventory

Generated: 2026-01-20

## Summary

| Metric | Count |
|--------|-------|
| Total Portals | 12 |
| Community Portals | 5 |
| Business Service Portals | 6 |
| Experience Editorial Portals | 1 |
| Portals with Custom Domains | 9 |
| Portals with Verified Domains | 10 |

## System-wide Live Data Counts

| Table | Count |
|-------|-------|
| cc_assets | 5,094 |
| cc_reservations | 7 |
| cc_service_runs | 3 |
| cc_coordination_circles | 1 |
| cc_jobs | 0 |
| cc_job_postings | 0 |
| cc_conversations | 0 |

---

## Portal Details

### 1. AdrenalineCanada
| Field | Value |
|-------|-------|
| **portal_id** | `96f6541c-2b38-4666-92e3-04f68d64b8ef` |
| **tenant_id** | `null` (platform-level) |
| **slug** | `adrenalinecanada` |
| **portal_type** | `community` |
| **status** | `active` |
| **primary_audience** | `worker` |
| **tagline** | Work hard. Play harder. See Canada. |
| **base_url** | https://adrenalinecanada.communitycanvas.ca |

**Domains:**
| Domain | Primary | Status |
|--------|---------|--------|
| adrenalinecanada.com | Yes | pending |

**Branding (site_config):** Empty `{}`

**Settings:** Empty `{}`

**Enabled Modules:** No feature flags configured

**Live Data:** No tenant-scoped data (platform-level portal)

**Public Routes:**
- `/p/adrenalinecanada` - Portal home
- `/p/adrenalinecanada/reserve` - Reservation flow
- `/b/adrenalinecanada/jobs` - Jobs listing

**Private Routes:**
- `/app/mod/portals/:portalId/growth` - Portal growth
- `/app/admin/portals/:portalId/appearance` - Portal appearance

---

### 2. Bamfield Community Portal
| Field | Value |
|-------|-------|
| **portal_id** | `df5561a8-8550-4498-9dc7-f02054bbbea4` |
| **tenant_id** | `e0000000-0000-0000-0000-000000000001` (Bamfield Community) |
| **slug** | `bamfield` |
| **portal_type** | `community` |
| **status** | `active` |
| **primary_audience** | `traveler` |
| **tagline** | Gateway to the Pacific Rim |
| **base_url** | https://bamfield.communitycanvas.ca |

**Domains:**
| Domain | Primary | Status |
|--------|---------|--------|
| bamfield.communitycanvas.ca | Yes | verified |

**Branding (site_config.theme):**
```json
{
  "primary_color": "#0f766e",
  "secondary_color": "#115e59",
  "accent_color": "#f59e0b"
}
```

**Settings:**
```json
{
  "city": "Bamfield",
  "region": "Alberni-Clayoquot",
  "show_alerts": true,
  "show_ferries": true,
  "show_weather": true,
  "show_businesses": true,
  "show_service_runs": true,
  "show_accommodations": true,
  "ferry_routes": ["Bamfield-Port Alberni"]
}
```

**Enabled Modules:** Service runs, weather, ferries, businesses, accommodations, alerts (via settings)

**Live Data:** Tenant hosts community data

**Public Routes:**
- `/p/bamfield` - Portal home
- `/p/bamfield/reserve` - Reservation flow
- `/b/bamfield/jobs` - Jobs listing

---

### 3. Bamfield Adventure Center
| Field | Value |
|-------|-------|
| **portal_id** | `4ead0e01-e45b-4d03-83ae-13d86271ff25` |
| **tenant_id** | `7ed7da14-b7fb-40af-a69a-ba72c8fe2888` (Bamfield Adventure Center) |
| **slug** | `bamfield-adventure` |
| **portal_type** | `business_service` |
| **status** | `active` |
| **primary_audience** | `traveler` |
| **tagline** | Your gateway to West Coast wilderness |
| **base_url** | (not set) |

**Domains:**
| Domain | Primary | Status |
|--------|---------|--------|
| bamfieldadventure.com | Yes | verified |

**Branding (site_config.theme):**
```json
{
  "primary_color": "#0369a1",
  "secondary_color": "#0284c7",
  "accent_color": "#f97316"
}
```

**Settings:** Empty `{}`

**Sections Enabled:** hero, services, assets, availability, weather, articles, contact

**Live Data:** Tenant-scoped

**Public Routes:**
- `/p/bamfield-adventure` - Portal home
- `/p/bamfield-adventure/reserve` - Reservation flow

---

### 4. Bamfield QA Portal
| Field | Value |
|-------|-------|
| **portal_id** | `3bacc506-dcf8-4974-89ea-a5c76dee1eff` |
| **tenant_id** | `b0000000-0000-0000-0000-000000000001` (Community Canvas) |
| **slug** | `bamfield-qa` |
| **portal_type** | `community` |
| **status** | `active` |
| **primary_audience** | `traveler` |
| **base_url** | (not set) |

**Domains:** None configured

**Branding (site_config):** Empty `{}`

**Settings:** Empty `{}`

**Enabled Modules:** None (QA testing portal)

**Live Data:** Test data only

---

### 5. CanadaDirect
| Field | Value |
|-------|-------|
| **portal_id** | `f47ac10b-58cc-4372-a567-0e02b2c3d479` |
| **tenant_id** | `null` (platform-level) |
| **slug** | `canadadirect` |
| **portal_type** | `community` |
| **status** | `active` |
| **primary_audience** | `worker` |
| **default_route** | `/jobs` |
| **base_url** | (not set) |

**Domains:** None configured

**Branding (site_config):** Empty `{}`

**Settings:** Empty `{}`

**Enabled Modules:** Jobs (implied by default_route)

**Live Data:** No tenant-scoped data

---

### 6. Enviro Bright Lights
| Field | Value |
|-------|-------|
| **portal_id** | `6cc5ca1a-ebda-45a5-b3c0-1e61bf576686` |
| **tenant_id** | `b1252093-0000-4000-8000-000000000001` (1252093 BC LTD) |
| **slug** | `enviro-bright` |
| **portal_type** | `business_service` |
| **status** | `active` |
| **primary_audience** | `buyer` |
| **tagline** | Sustainable lighting solutions |
| **legal_dba_name** | Enviro Bright Lights |
| **base_url** | https://enviro-bright.communitycanvas.ca |

**Domains:**
| Domain | Primary | Status |
|--------|---------|--------|
| envirobright.ca | Yes | verified |
| enviro-bright.communitycanvas.ca | No | verified |

**Branding (site_config.theme):**
```json
{
  "primary_color": "#dc2626",
  "secondary_color": "#b91c1c",
  "accent_color": "#22c55e"
}
```

**Sections Enabled:** hero, services, gallery, contact

**Live Data:** Shares tenant with Enviropaving, Remote Serve

---

### 7. Enviropaving BC
| Field | Value |
|-------|-------|
| **portal_id** | `5db6402b-2ec7-4d6d-a60c-1734f185dd30` |
| **tenant_id** | `b1252093-0000-4000-8000-000000000001` (1252093 BC LTD) |
| **slug** | `enviropaving` |
| **portal_type** | `business_service` |
| **status** | `active` |
| **primary_audience** | `buyer` |
| **tagline** | Eco-friendly paving solutions for BC communities |
| **legal_dba_name** | Enviropaving BC |
| **base_url** | https://enviropaving.communitycanvas.ca |

**Domains:**
| Domain | Primary | Status |
|--------|---------|--------|
| enviropaving.ca | Yes | verified |
| enviropaving.communitycanvas.ca | No | verified |

**Branding (site_config.theme):**
```json
{
  "primary_color": "#16a34a",
  "secondary_color": "#15803d",
  "accent_color": "#eab308"
}
```

**Sections Enabled:** hero, services, gallery, articles, contact

**Live Data:** Shares tenant with Enviro Bright, Remote Serve

---

### 8. OffpeakAirBNB
| Field | Value |
|-------|-------|
| **portal_id** | `f0cb44d0-beb2-46ac-8128-e66fc430b23f` |
| **tenant_id** | `null` (platform-level) |
| **slug** | `offpeakairbnb` |
| **portal_type** | `community` |
| **status** | `active` |
| **primary_audience** | `host` |
| **tagline** | Fill your off-season with working crews |
| **supported_locales** | en-CA, fr-CA |
| **base_url** | https://offpeakairbnb.communitycanvas.ca |

**Domains:**
| Domain | Primary | Status |
|--------|---------|--------|
| offpeakairbnb.ca | Yes | pending |

**Branding (site_config):** Empty `{}`

**Settings:** Empty `{}`

**Enabled Modules:** None configured

**Live Data:** No tenant-scoped data

---

### 9. Parts Unknown BC
| Field | Value |
|-------|-------|
| **portal_id** | `5f0d45a1-4434-45a1-9359-dfe2130b04a1` |
| **tenant_id** | `null` (platform-level) |
| **slug** | `parts-unknown-bc` |
| **portal_type** | `experience_editorial` |
| **status** | `active` |
| **primary_audience** | `buyer` |
| **base_url** | https://parts-unknown-bc.communitycanvas.ca |

**Domains:** None configured

**Branding (site_config):** Empty `{}`

**Settings:** `{"portal_type": "experience_editorial"}`

**Enabled Modules:** Editorial content (experience-focused)

**Live Data:** No tenant-scoped data

---

### 10. Remote Serve
| Field | Value |
|-------|-------|
| **portal_id** | `9a4e1b47-1b66-4d68-81df-0721bd85a654` |
| **tenant_id** | `b1252093-0000-4000-8000-000000000001` (1252093 BC LTD) |
| **slug** | `remote-serve` |
| **portal_type** | `business_service` |
| **status** | `active` |
| **primary_audience** | `buyer` |
| **tagline** | Reliable services for remote BC communities |
| **legal_dba_name** | Remote Serve |
| **base_url** | https://remote-serve.communitycanvas.ca |

**Domains:**
| Domain | Primary | Status |
|--------|---------|--------|
| remoteserve.ca | Yes | verified |
| remote-serve.communitycanvas.ca | No | verified |

**Branding (site_config):** Empty `{}`

**Settings:** Empty `{}`

**Enabled Modules:** None configured

**Live Data:** Shares tenant with Enviropaving, Enviro Bright

---

### 11. Save Paradise Parking
| Field | Value |
|-------|-------|
| **portal_id** | `19a451b8-fd3f-4bfa-81cc-93b288c69145` |
| **tenant_id** | `7d8e6df5-bf12-4965-85a9-20b4312ce6c8` (Save Paradise Parking) |
| **slug** | `save-paradise-parking` |
| **portal_type** | `business_service` |
| **status** | `active` |
| **primary_audience** | `traveler` |
| **tagline** | Secure parking at the gateway to Bamfield |
| **legal_dba_name** | Save Paradise Parking |
| **base_url** | (not set) |

**Domains:**
| Domain | Primary | Status |
|--------|---------|--------|
| saveparadiseparking.com | Yes | verified |

**Branding (site_config.theme):**
```json
{
  "primary_color": "#2563eb",
  "secondary_color": "#1e40af",
  "accent_color": "#fbbf24"
}
```

**Sections Enabled:** hero, availability, assets, map, contact

**Live Data:** Tenant has parking assets

---

### 12. Woods End Landing Cottages
| Field | Value |
|-------|-------|
| **portal_id** | `4813f3fd-02df-47c5-a705-9cfc3ac4d059` |
| **tenant_id** | `d0000000-0000-0000-0000-000000000001` (Woods End Landing) |
| **slug** | `woods-end-landing` |
| **portal_type** | `business_service` |
| **status** | `active` |
| **primary_audience** | `traveler` |
| **tagline** | Waterfront cottages in the heart of Bamfield |
| **legal_dba_name** | Woods End Landing |
| **base_url** | (not set) |

**Domains:**
| Domain | Primary | Status |
|--------|---------|--------|
| woodsendlanding.com | Yes | verified |

**Branding (site_config.theme):**
```json
{
  "primary_color": "#065f46",
  "secondary_color": "#047857",
  "accent_color": "#fcd34d"
}
```

**Sections Enabled:** hero, assets, availability, gallery, articles, weather, travel_info, contact

**Live Data:** Tenant has cottage assets

---

## Public Routes (All Portals)

| Route Pattern | Description |
|---------------|-------------|
| `/p/:portalSlug` | Portal home page |
| `/p/:portalSlug/onboarding` | Onboarding flow |
| `/p/:portalSlug/reserve` | Reservation flow |
| `/p/:portalSlug/reserve/:assetId` | Asset-specific reservation |
| `/b/:portalSlug/jobs` | Jobs listing |
| `/b/:portalSlug/jobs/:postingId` | Job detail |
| `/b/:portalSlug/jobs/:postingId/apply` | Job application |
| `/b/:portalSlug/apply/:campaignKey` | Campaign application |
| `/b/:portalSlug/employers/:employerId` | Employer profile |
| `/portal/:portalSlug/p/:presentationSlug` | Presentation viewer |

## Private Routes (Authenticated)

| Route Pattern | Description |
|---------------|-------------|
| `/app/admin/portals` | Portals list (admin) |
| `/app/admin/portals/:portalId/appearance` | Portal appearance settings |
| `/app/mod/portals/:portalId/growth` | Portal growth metrics |
| `/app/mod/portals/:portalId/housing-waitlist` | Housing waitlist |
| `/app/mod/portals/:portalId/bench` | Candidate bench |
| `/app/mod/portals/:portalId/emergency` | Emergency mode |
| `/app/portals/:portalId/housing` | Housing offers |

## API Endpoints

### Public Portal API
- `GET /api/public/portal-context` - Portal context from domain/path
- `GET /b/:portalSlug/api/public/*` - Portal-scoped public API

### Admin Portal API
- `GET/POST /api/p2/admin/portals/*` - Portal management

---

## Notes

1. **Multi-Portal Tenants:** Tenant `b1252093-0000-4000-8000-000000000001` (1252093 BC LTD) operates 3 business portals (Enviropaving, Enviro Bright, Remote Serve)

2. **Platform-Level Portals:** 4 portals have no owning tenant (AdrenalineCanada, CanadaDirect, OffpeakAirBNB, Parts Unknown BC)

3. **Domain Verification:** 10 of 12 portal domains have verified status

4. **Feature Flags:** No portal-specific feature flags are currently configured in `cc_portal_feature_flags`

5. **Live Data Distribution:**
   - Assets primarily owned by platform (5,087 of 5,094)
   - 7 reservations system-wide
   - 3 service runs (all Bamfield region)
   - 1 coordination circle
   - No active job postings
   - No active conversations
