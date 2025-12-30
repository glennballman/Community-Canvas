import { pool } from "../server/db";
import {
  BC_INTERCITY_BUS,
  BC_TRANSIT_SYSTEMS,
  BC_CHARTER_BUS,
  BC_COURIER_SERVICES,
  BC_TRUCKING_SERVICES,
  BC_RAIL_SERVICES,
  getRailTier,
  getTruckingTier,
  getTruckingDomain,
  getCourierTier,
  getPeopleCarrierTier,
  type CriticalityTier,
  type LifelineDomain
} from "../shared/ground-transport";

const BATCH_SIZE = 100;

// Map service types to entity types
const ENTITY_TYPE_MAP = {
  intercity_bus: "bus-service",
  transit_system: "transit-system",
  charter_bus: "bus-service",
  courier: "courier-service",
  trucking: "trucking-service",
  rail_service: "rail-service",
  rail_station: "rail-station",
  bus_hub: "bus-hub",
  courier_facility: "courier-facility",
  trucking_terminal: "trucking-terminal"
} as const;

async function importGroundTransport() {
  console.log("Starting ground transport import...");
  
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    let totalEntities = 0;
    
    // ========== INTERCITY BUS SERVICES ==========
    console.log("\n=== Importing Intercity Bus Services ===");
    for (const bus of BC_INTERCITY_BUS) {
      const metadata = {
        service_type: bus.type,
        routes: bus.routes,
        notes: bus.notes,
        criticality_tier: getPeopleCarrierTier(),
        lifeline_domain: "mobility" as LifelineDomain
      };
      
      // Get first hub's coordinates for main entity
      const primaryHub = bus.hubs[0];
      
      await client.query(`
        INSERT INTO entities (
          id, entity_type_id, name, slug, city,
          phone, website, latitude, longitude,
          configuration, is_active, verification_status
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4,
          $5, $6, $7, $8,
          $9, true, 'verified'
        )
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          configuration = EXCLUDED.configuration
      `, [
        ENTITY_TYPE_MAP.intercity_bus,
        bus.name,
        bus.id,
        primaryHub?.municipality ?? null,
        bus.phone?.substring(0, 30) ?? null,
        bus.website ?? null,
        primaryHub?.lat ?? null,
        primaryHub?.lng ?? null,
        JSON.stringify(metadata)
      ]);
      totalEntities++;
      
      // Create hub entities
      for (const hub of bus.hubs) {
        const hubSlug = `${bus.id}-hub-${hub.municipality.toLowerCase().replace(/\s+/g, '-')}`;
        await client.query(`
          INSERT INTO entities (
            id, entity_type_id, name, slug, city,
            latitude, longitude, configuration,
            is_active, verification_status
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4,
            $5, $6, $7,
            true, 'verified'
          )
          ON CONFLICT (slug) DO UPDATE SET
            name = EXCLUDED.name,
            configuration = EXCLUDED.configuration
        `, [
          ENTITY_TYPE_MAP.bus_hub,
          hub.name,
          hubSlug,
          hub.municipality,
          hub.lat,
          hub.lng,
          JSON.stringify({
            parent_service_id: bus.id,
            parent_service_name: bus.name,
            criticality_tier: getPeopleCarrierTier(),
            lifeline_domain: "mobility"
          })
        ]);
        totalEntities++;
      }
    }
    console.log(`  Imported ${BC_INTERCITY_BUS.length} intercity bus services with hubs`);
    
    // ========== TRANSIT SYSTEMS ==========
    console.log("\n=== Importing Transit Systems ===");
    for (const transit of BC_TRANSIT_SYSTEMS) {
      const metadata = {
        system_type: transit.type,
        operator: transit.operator,
        municipalities_served: transit.municipalities_served,
        notes: transit.notes,
        criticality_tier: getPeopleCarrierTier(),
        lifeline_domain: "mobility" as LifelineDomain
      };
      
      await client.query(`
        INSERT INTO entities (
          id, entity_type_id, name, slug, city,
          website, latitude, longitude,
          configuration, is_active, verification_status
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4,
          $5, $6, $7,
          $8, true, 'verified'
        )
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          configuration = EXCLUDED.configuration
      `, [
        ENTITY_TYPE_MAP.transit_system,
        transit.name,
        transit.id,
        transit.hub_location?.name ?? transit.municipalities_served[0] ?? null,
        transit.website ?? null,
        transit.hub_location?.lat ?? null,
        transit.hub_location?.lng ?? null,
        JSON.stringify(metadata)
      ]);
      totalEntities++;
    }
    console.log(`  Imported ${BC_TRANSIT_SYSTEMS.length} transit systems`);
    
    // ========== CHARTER BUS OPERATORS ==========
    console.log("\n=== Importing Charter Bus Operators ===");
    for (const charter of BC_CHARTER_BUS) {
      const metadata = {
        service_type: charter.type,
        service_area: charter.service_area,
        fleet_size: charter.fleet_size,
        notes: charter.notes,
        criticality_tier: getPeopleCarrierTier(),
        lifeline_domain: "mobility" as LifelineDomain
      };
      
      await client.query(`
        INSERT INTO entities (
          id, entity_type_id, name, slug, city,
          address_line1, phone, website,
          latitude, longitude, configuration,
          is_active, verification_status
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4,
          $5, $6, $7,
          $8, $9, $10,
          true, 'verified'
        )
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          configuration = EXCLUDED.configuration
      `, [
        ENTITY_TYPE_MAP.charter_bus,
        charter.name,
        charter.id,
        charter.base_location.municipality,
        charter.base_location.address ?? null,
        charter.phone?.substring(0, 30) ?? null,
        charter.website ?? null,
        charter.base_location.lat,
        charter.base_location.lng,
        JSON.stringify(metadata)
      ]);
      totalEntities++;
    }
    console.log(`  Imported ${BC_CHARTER_BUS.length} charter bus operators`);
    
    // ========== COURIER SERVICES ==========
    console.log("\n=== Importing Courier Services ===");
    for (const courier of BC_COURIER_SERVICES) {
      const metadata = {
        service_type: courier.type,
        service_coverage: courier.service_coverage,
        tracking_url: courier.tracking_url,
        notes: courier.notes,
        criticality_tier: getCourierTier(),
        lifeline_domain: "messaging" as LifelineDomain
      };
      
      const primaryFacility = courier.facilities[0];
      
      await client.query(`
        INSERT INTO entities (
          id, entity_type_id, name, slug, city,
          phone, website, latitude, longitude,
          configuration, is_active, verification_status
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4,
          $5, $6, $7, $8,
          $9, true, 'verified'
        )
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          configuration = EXCLUDED.configuration
      `, [
        ENTITY_TYPE_MAP.courier,
        courier.name,
        courier.id,
        primaryFacility?.municipality ?? null,
        courier.phone?.substring(0, 30) ?? null,
        courier.website ?? null,
        primaryFacility?.lat ?? null,
        primaryFacility?.lng ?? null,
        JSON.stringify(metadata)
      ]);
      totalEntities++;
      
      // Create facility entities
      for (const facility of courier.facilities) {
        const facilitySlug = `${courier.id}-${facility.facility_type}-${facility.municipality.toLowerCase().replace(/\s+/g, '-')}`;
        await client.query(`
          INSERT INTO entities (
            id, entity_type_id, name, slug, city,
            address_line1, latitude, longitude, configuration,
            is_active, verification_status
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4,
            $5, $6, $7, $8,
            true, 'verified'
          )
          ON CONFLICT (slug) DO UPDATE SET
            name = EXCLUDED.name,
            configuration = EXCLUDED.configuration
        `, [
          ENTITY_TYPE_MAP.courier_facility,
          facility.name,
          facilitySlug,
          facility.municipality,
          facility.address ?? null,
          facility.lat,
          facility.lng,
          JSON.stringify({
            parent_service_id: courier.id,
            parent_service_name: courier.name,
            facility_type: facility.facility_type,
            criticality_tier: getCourierTier(),
            lifeline_domain: "messaging"
          })
        ]);
        totalEntities++;
      }
    }
    console.log(`  Imported ${BC_COURIER_SERVICES.length} courier services with facilities`);
    
    // ========== TRUCKING SERVICES ==========
    console.log("\n=== Importing Trucking Services ===");
    for (const truck of BC_TRUCKING_SERVICES) {
      const tier = getTruckingTier(truck.type);
      const domain = getTruckingDomain(truck.type);
      
      const metadata = {
        service_type: truck.type,
        service_coverage: truck.service_coverage,
        fleet_size: truck.fleet_size,
        notes: truck.notes,
        criticality_tier: tier,
        lifeline_domain: domain
      };
      
      const primaryTerminal = truck.terminals[0];
      
      await client.query(`
        INSERT INTO entities (
          id, entity_type_id, name, slug, city,
          phone, website, latitude, longitude,
          configuration, is_active, verification_status
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4,
          $5, $6, $7, $8,
          $9, true, 'verified'
        )
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          configuration = EXCLUDED.configuration
      `, [
        ENTITY_TYPE_MAP.trucking,
        truck.name,
        truck.id,
        primaryTerminal?.municipality ?? null,
        truck.phone?.substring(0, 30) ?? null,
        truck.website ?? null,
        primaryTerminal?.lat ?? null,
        primaryTerminal?.lng ?? null,
        JSON.stringify(metadata)
      ]);
      totalEntities++;
      
      // Create terminal entities
      for (const terminal of truck.terminals) {
        const terminalSlug = `${truck.id}-${terminal.facility_type}-${terminal.municipality.toLowerCase().replace(/\s+/g, '-')}`;
        await client.query(`
          INSERT INTO entities (
            id, entity_type_id, name, slug, city,
            address_line1, latitude, longitude, configuration,
            is_active, verification_status
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4,
            $5, $6, $7, $8,
            true, 'verified'
          )
          ON CONFLICT (slug) DO UPDATE SET
            name = EXCLUDED.name,
            configuration = EXCLUDED.configuration
        `, [
          ENTITY_TYPE_MAP.trucking_terminal,
          terminal.name,
          terminalSlug,
          terminal.municipality,
          terminal.address ?? null,
          terminal.lat,
          terminal.lng,
          JSON.stringify({
            parent_service_id: truck.id,
            parent_service_name: truck.name,
            facility_type: terminal.facility_type,
            criticality_tier: tier,
            lifeline_domain: domain
          })
        ]);
        totalEntities++;
      }
    }
    console.log(`  Imported ${BC_TRUCKING_SERVICES.length} trucking services with terminals`);
    
    // ========== RAIL SERVICES ==========
    console.log("\n=== Importing Rail Services ===");
    for (const rail of BC_RAIL_SERVICES) {
      const tier = getRailTier(rail.type);
      const domain: LifelineDomain = rail.type === 'class_1_freight' || rail.type === 'shortline' ? 'freight' : 'mobility';
      
      const metadata = {
        service_type: rail.type,
        routes: rail.routes,
        service_coverage: rail.service_coverage,
        notes: rail.notes,
        criticality_tier: tier,
        lifeline_domain: domain
      };
      
      const primaryStation = rail.stations[0];
      
      await client.query(`
        INSERT INTO entities (
          id, entity_type_id, name, slug, city,
          phone, website, latitude, longitude,
          configuration, is_active, verification_status
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4,
          $5, $6, $7, $8,
          $9, true, 'verified'
        )
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          configuration = EXCLUDED.configuration
      `, [
        ENTITY_TYPE_MAP.rail_service,
        rail.name,
        rail.id,
        primaryStation?.municipality ?? null,
        rail.phone?.substring(0, 30) ?? null,
        rail.website ?? null,
        primaryStation?.lat ?? null,
        primaryStation?.lng ?? null,
        JSON.stringify(metadata)
      ]);
      totalEntities++;
      
      // Create station entities
      for (const station of rail.stations) {
        const stationSlug = `${rail.id}-station-${station.municipality.toLowerCase().replace(/\s+/g, '-')}`;
        await client.query(`
          INSERT INTO entities (
            id, entity_type_id, name, slug, city,
            latitude, longitude, configuration,
            is_active, verification_status
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4,
            $5, $6, $7,
            true, 'verified'
          )
          ON CONFLICT (slug) DO UPDATE SET
            name = EXCLUDED.name,
            configuration = EXCLUDED.configuration
        `, [
          ENTITY_TYPE_MAP.rail_station,
          station.name,
          stationSlug,
          station.municipality,
          station.lat,
          station.lng,
          JSON.stringify({
            parent_service_id: rail.id,
            parent_service_name: rail.name,
            station_type: station.station_type,
            subdivision: station.subdivision,
            criticality_tier: tier,
            lifeline_domain: domain
          })
        ]);
        totalEntities++;
      }
    }
    console.log(`  Imported ${BC_RAIL_SERVICES.length} rail services with stations`);
    
    await client.query("COMMIT");
    console.log(`\n=== Import complete! Total entities: ${totalEntities} ===`);
    
    // Verification queries
    const typeCount = await client.query(`
      SELECT entity_type_id, COUNT(*) as count
      FROM entities 
      WHERE entity_type_id IN (
        'transit-system', 'rail-station', 'rail-service',
        'bus-service', 'bus-hub', 'courier-service', 'courier-facility',
        'trucking-service', 'trucking-terminal'
      )
      GROUP BY entity_type_id
      ORDER BY count DESC
    `);
    
    console.log("\nEntities by type:");
    let typeTotal = 0;
    for (const row of typeCount.rows) {
      console.log(`  ${row.entity_type_id}: ${row.count}`);
      typeTotal += parseInt(row.count);
    }
    console.log(`  TOTAL: ${typeTotal}`);
    
    // Criticality tier breakdown
    const tierCount = await client.query(`
      SELECT 
        configuration->>'criticality_tier' as tier,
        COUNT(*) as count
      FROM entities 
      WHERE configuration->>'criticality_tier' IS NOT NULL
      GROUP BY configuration->>'criticality_tier'
      ORDER BY tier
    `);
    
    console.log("\nBy Criticality Tier:");
    for (const row of tierCount.rows) {
      const tierName = row.tier === '1' ? 'LIFELINE' : 
                       row.tier === '2' ? 'SUPPLY CHAIN' :
                       row.tier === '3' ? 'MOBILITY' : 'MESSAGING';
      console.log(`  Tier ${row.tier} (${tierName}): ${row.count}`);
    }
    
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error importing ground transport:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

importGroundTransport().catch(console.error);
