import { BC_EMERGENCY_SERVICES } from "../shared/emergency-services";
import { pool } from "../server/db";

const TYPE_MAP: Record<string, string> = {
  "hospital": "hospital",
  "fire_station": "fire-station",
  "rcmp_detachment": "police-rcmp",
  "municipal_police": "police-municipal",
  "ambulance_station": "ambulance-station"
};

async function importEmergencyServices() {
  console.log("Starting emergency services import...");
  console.log(`Found ${BC_EMERGENCY_SERVICES.length} services to import`);
  
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    let imported = 0;
    for (const service of BC_EMERGENCY_SERVICES) {
      const entityTypeId = TYPE_MAP[service.type];
      if (!entityTypeId) {
        console.log(`  Skipping ${service.id}: unknown type ${service.type}`);
        continue;
      }
      
      const metadata: Record<string, unknown> = {
        notes: service.notes ?? null
      };
      
      if (service.type === "hospital") {
        metadata.health_authority = service.health_authority ?? null;
        metadata.has_helipad = service.has_helipad ?? false;
        metadata.helipad_icao = service.helipad_icao ?? null;
        metadata.is_trauma_centre = service.is_trauma_centre ?? false;
        metadata.is_tertiary = service.is_tertiary ?? false;
        metadata.emergency_department = service.emergency_department ?? false;
      }
      
      const query = `
        INSERT INTO entities (
          id, entity_type_id, name, slug,
          city, address_line1, phone,
          latitude, longitude, configuration,
          is_active, verification_status
        ) VALUES (
          gen_random_uuid(), $1, $2, $3,
          $4, $5, $6,
          $7, $8, $9,
          true, 'verified'
        )
        ON CONFLICT (slug) DO UPDATE SET
          entity_type_id = EXCLUDED.entity_type_id,
          name = EXCLUDED.name,
          city = EXCLUDED.city,
          address_line1 = EXCLUDED.address_line1,
          phone = EXCLUDED.phone,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          configuration = EXCLUDED.configuration,
          is_active = EXCLUDED.is_active
      `;
      
      const values = [
        entityTypeId,
        service.name,
        service.id,
        service.municipality ?? null,
        service.address ?? null,
        service.phone ?? null,
        service.latitude,
        service.longitude,
        JSON.stringify(metadata)
      ];
      
      await client.query(query, values);
      imported++;
    }
    
    await client.query("COMMIT");
    console.log(`\nImport complete! Imported ${imported} emergency services.`);
    
    const result = await client.query(`
      SELECT entity_type_id, COUNT(*) as count 
      FROM entities 
      WHERE entity_type_id IN ('hospital', 'fire-station', 'police-rcmp', 'police-municipal', 'ambulance-station')
      GROUP BY entity_type_id
      ORDER BY count DESC
    `);
    
    console.log("\nEmergency services by type:");
    let total = 0;
    for (const row of result.rows) {
      console.log(`  ${row.entity_type_id}: ${row.count}`);
      total += parseInt(row.count);
    }
    console.log(`  TOTAL: ${total}`);
    
    const traumaResult = await client.query(`
      SELECT name, configuration->>'health_authority' as health_authority, configuration->>'is_trauma_centre' as trauma
      FROM entities 
      WHERE entity_type_id = 'hospital'
      AND (configuration->>'is_trauma_centre')::boolean = true
    `);
    
    console.log("\nTrauma centres:");
    for (const row of traumaResult.rows) {
      console.log(`  ${row.name} (${row.health_authority})`);
    }
    
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error importing emergency services:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

importEmergencyServices().catch(console.error);
