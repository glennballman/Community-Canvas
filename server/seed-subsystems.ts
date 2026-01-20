import { pool } from './db';

const CANONICAL_SUBSYSTEMS = [
  // Electrical/Comms
  { key: 'electrical_overhead', title: 'Overhead Electrical', description: 'Overhead power lines and connections', tags: ['electrical', 'power'], isSensitive: false },
  { key: 'electrical_underground', title: 'Underground Electrical', description: 'Buried power cables and conduits', tags: ['electrical', 'power'], isSensitive: false },
  { key: 'electrical_distribution', title: 'Electrical Distribution', description: 'Main panel, sub-panels, breakers', tags: ['electrical', 'power'], isSensitive: false },
  { key: 'generator_backup_power', title: 'Generator / Backup Power', description: 'Standby generators and UPS systems', tags: ['electrical', 'power', 'emergency'], isSensitive: false },
  { key: 'lighting_exterior', title: 'Exterior Lighting', description: 'Outdoor path lights, security lights, landscape lighting', tags: ['electrical', 'lighting'], isSensitive: false },
  { key: 'low_voltage_network', title: 'Low Voltage / Network', description: 'Data, phone, cable, security wiring', tags: ['electrical', 'network', 'comms'], isSensitive: false },

  // Water/Waste/Drainage
  { key: 'water_supply', title: 'Water Supply', description: 'Main supply, pressure tank, well, cistern', tags: ['water', 'plumbing'], isSensitive: false },
  { key: 'hot_water', title: 'Hot Water System', description: 'Water heater, boiler, recirculation', tags: ['water', 'plumbing', 'heating'], isSensitive: false },
  { key: 'sewer_wastewater', title: 'Sewer / Wastewater', description: 'Septic, sewer connection, greywater', tags: ['water', 'waste'], isSensitive: false },
  { key: 'stormwater_drainage', title: 'Stormwater Drainage', description: 'Gutters, French drains, catch basins', tags: ['water', 'drainage'], isSensitive: false },

  // HVAC/Combustion
  { key: 'hvac_heating', title: 'Heating System', description: 'Furnace, heat pump, radiant floor, baseboard', tags: ['hvac', 'heating'], isSensitive: false },
  { key: 'hvac_cooling', title: 'Cooling System', description: 'AC, mini-splits, evaporative coolers', tags: ['hvac', 'cooling'], isSensitive: false },
  { key: 'ventilation_ducting', title: 'Ventilation / Ducting', description: 'HRV, ERV, exhaust fans, ductwork', tags: ['hvac', 'ventilation'], isSensitive: false },
  { key: 'chimney_fireplace', title: 'Chimney / Fireplace', description: 'Wood stove, fireplace, flue, chimney cap', tags: ['hvac', 'combustion'], isSensitive: false },

  // Gas/Fuel
  { key: 'propane_gas', title: 'Propane / Gas System', description: 'Propane tank, gas lines, regulators', tags: ['fuel', 'gas'], isSensitive: false },
  { key: 'fuel_storage', title: 'Fuel Storage', description: 'Diesel, gasoline tanks for generators/equipment', tags: ['fuel', 'storage'], isSensitive: false },

  // Structure/Envelope
  { key: 'foundation_structure', title: 'Foundation / Structure', description: 'Footings, piers, beams, framing', tags: ['structure', 'building'], isSensitive: false },
  { key: 'roof_envelope', title: 'Roof / Envelope', description: 'Roofing material, flashing, skylights', tags: ['structure', 'envelope'], isSensitive: false },
  { key: 'exterior_cladding', title: 'Exterior Cladding', description: 'Siding, stucco, brick, trim', tags: ['structure', 'envelope'], isSensitive: false },
  { key: 'windows_doors', title: 'Windows / Doors', description: 'Windows, exterior doors, weather seals', tags: ['structure', 'envelope'], isSensitive: false },

  // Site/Movement/Marine
  { key: 'site_access_last_mile', title: 'Site Access / Last Mile', description: 'Driveway, road, gate, parking', tags: ['site', 'access'], isSensitive: false },
  { key: 'stairs_elevators_lifts', title: 'Stairs / Elevators / Lifts', description: 'Stairs, ramps, lifts, elevators', tags: ['site', 'accessibility'], isSensitive: false },
  { key: 'docks_moorage_marine_access', title: 'Docks / Moorage / Marine Access', description: 'Dock, float, ramp, marine infrastructure', tags: ['marine', 'access'], isSensitive: false },
  { key: 'transport_logistics', title: 'Transport / Logistics', description: 'Loading dock, cargo handling, delivery zone', tags: ['site', 'logistics'], isSensitive: false },

  // Safety/Compliance (sensitive)
  { key: 'fire_safety', title: 'Fire Safety', description: 'Smoke detectors, extinguishers, sprinklers, alarms', tags: ['safety', 'fire', 'compliance'], isSensitive: true },
  { key: 'electrical_safety_compliance', title: 'Electrical Safety / Compliance', description: 'GFCI, arc-fault, grounding, ESA inspections', tags: ['safety', 'electrical', 'compliance'], isSensitive: true },
  { key: 'hazards_environmental', title: 'Hazards / Environmental', description: 'Asbestos, lead, mold, radon, contamination', tags: ['safety', 'environmental', 'hazards'], isSensitive: true },

  // Specialty/Operations
  { key: 'kitchen_commercial', title: 'Commercial Kitchen', description: 'Commercial appliances, exhaust hoods, grease traps', tags: ['specialty', 'kitchen'], isSensitive: false },
  { key: 'laundry', title: 'Laundry', description: 'Washers, dryers, utility sinks', tags: ['specialty', 'laundry'], isSensitive: false },
  { key: 'waterfront_infrastructure', title: 'Waterfront Infrastructure', description: 'Seawall, breakwater, erosion control', tags: ['marine', 'infrastructure'], isSensitive: false },

  // On-Site Resources (non-sensitive)
  { key: 'tools_on_site', title: 'Tools On Site', description: 'Hand tools, power tools, specialty equipment available', tags: ['resources', 'tools'], isSensitive: false },
  { key: 'materials_on_site', title: 'Materials On Site', description: 'Spare parts, consumables, materials in storage', tags: ['resources', 'materials'], isSensitive: false },
];

export async function seedSubsystemCatalog(): Promise<void> {
  console.log('[Subsystems] Seeding canonical subsystem catalog...');
  
  for (const sub of CANONICAL_SUBSYSTEMS) {
    await pool.query(`
      INSERT INTO cc_subsystem_catalog (key, title, description, tags, is_sensitive)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (key) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        tags = EXCLUDED.tags,
        is_sensitive = EXCLUDED.is_sensitive,
        updated_at = NOW()
    `, [sub.key, sub.title, sub.description, sub.tags, sub.isSensitive]);
  }
  
  console.log(`[Subsystems] Seeded ${CANONICAL_SUBSYSTEMS.length} canonical subsystems`);
}

export async function createSubsystemTables(): Promise<void> {
  console.log('[Subsystems] Creating subsystem tables...');
  
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cc_subsystem_catalog (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      key text UNIQUE NOT NULL,
      title text NOT NULL,
      description text,
      tags text[] NOT NULL DEFAULT '{}',
      is_sensitive boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS cc_subsystem_catalog_tags_idx ON cc_subsystem_catalog USING gin(tags);
  `);
  
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cc_property_subsystems (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      property_id uuid NOT NULL REFERENCES cc_properties(id) ON DELETE CASCADE,
      catalog_key text REFERENCES cc_subsystem_catalog(key) ON DELETE SET NULL,
      custom_key text,
      title text NOT NULL,
      description text,
      tags text[] NOT NULL DEFAULT '{}',
      visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'contractor')),
      is_sensitive boolean NOT NULL DEFAULT false,
      created_by uuid,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW(),
      CONSTRAINT exactly_one_key CHECK (
        (catalog_key IS NOT NULL AND custom_key IS NULL) OR
        (catalog_key IS NULL AND custom_key IS NOT NULL)
      ),
      CONSTRAINT custom_key_prefix CHECK (
        custom_key IS NULL OR custom_key LIKE 'custom:%'
      ),
      CONSTRAINT unique_catalog_key UNIQUE (tenant_id, property_id, catalog_key),
      CONSTRAINT unique_custom_key UNIQUE (tenant_id, property_id, custom_key)
    );
    
    CREATE INDEX IF NOT EXISTS cc_property_subsystems_tenant_property_idx 
      ON cc_property_subsystems(tenant_id, property_id);
    CREATE INDEX IF NOT EXISTS cc_property_subsystems_tags_idx 
      ON cc_property_subsystems USING gin(tags);
  `);
  
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cc_on_site_resources (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      property_id uuid NOT NULL REFERENCES cc_properties(id) ON DELETE CASCADE,
      resource_type text NOT NULL CHECK (resource_type IN ('tool', 'material')),
      name text NOT NULL,
      description text,
      quantity numeric(10,2),
      unit text,
      condition text,
      tags text[] NOT NULL DEFAULT '{}',
      unspsc_code text,
      storage_location text,
      share_policy text NOT NULL DEFAULT 'private' CHECK (share_policy IN ('private', 'disclosable', 'offerable')),
      suggested_price_amount numeric(10,2),
      suggested_price_currency text DEFAULT 'CAD',
      created_by uuid,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS cc_on_site_resources_tenant_property_idx 
      ON cc_on_site_resources(tenant_id, property_id);
    CREATE INDEX IF NOT EXISTS cc_on_site_resources_tags_idx 
      ON cc_on_site_resources USING gin(tags);
  `);
  
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cc_on_site_resource_media (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      resource_id uuid NOT NULL REFERENCES cc_on_site_resources(id) ON DELETE CASCADE,
      url text NOT NULL,
      media_type varchar(50) DEFAULT 'photo',
      caption text,
      tags text[] NOT NULL DEFAULT '{}',
      sort_order integer NOT NULL DEFAULT 0,
      created_by uuid,
      created_at timestamptz NOT NULL DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS cc_on_site_resource_media_resource_idx 
      ON cc_on_site_resource_media(tenant_id, resource_id);
  `);
  
  // Add subsystem_id to cc_work_media if not exists
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'cc_work_media' AND column_name = 'subsystem_id'
      ) THEN
        ALTER TABLE cc_work_media ADD COLUMN subsystem_id uuid;
        CREATE INDEX IF NOT EXISTS cc_work_media_subsystem_idx ON cc_work_media(tenant_id, subsystem_id);
      END IF;
    END $$;
  `);
  
  // Add member_type to cc_asset_group_members if not exists
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'cc_asset_group_members' AND column_name = 'member_type'
      ) THEN
        ALTER TABLE cc_asset_group_members ADD COLUMN member_type text NOT NULL DEFAULT 'asset';
      END IF;
    END $$;
  `);
  
  // Add CHECK constraint for exactly-one target in cc_work_media
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'cc_work_media_exactly_one_target'
      ) THEN
        ALTER TABLE cc_work_media ADD CONSTRAINT cc_work_media_exactly_one_target CHECK (
          (CASE WHEN work_area_id IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN portal_id IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN subsystem_id IS NOT NULL THEN 1 ELSE 0 END) = 1
        );
      END IF;
    EXCEPTION
      WHEN check_violation THEN
        RAISE NOTICE 'Existing data violates constraint, skipping constraint creation';
    END $$;
  `);
  
  console.log('[Subsystems] Tables created successfully');
}

export async function initSubsystems(): Promise<void> {
  await createSubsystemTables();
  await seedSubsystemCatalog();
}
