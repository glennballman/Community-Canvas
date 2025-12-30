import { GEO_HIERARCHY } from "../shared/geography";
import { pool } from "../server/db";

async function importGeoRegions() {
  console.log("Starting geo_regions import...");
  
  const nodesToImport = Object.values(GEO_HIERARCHY).filter(
    node => node.level === "province" || node.level === "region"
  );
  
  console.log(`Found ${nodesToImport.length} nodes to import (province + regions)`);
  
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    for (const node of nodesToImport) {
      const slug = node.id;
      const regionType = node.level;
      
      const query = `
        INSERT INTO geo_regions (
          id, name, slug, region_type, parent_id, 
          centroid_lat, centroid_lon, population, official_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          slug = EXCLUDED.slug,
          region_type = EXCLUDED.region_type,
          parent_id = EXCLUDED.parent_id,
          centroid_lat = EXCLUDED.centroid_lat,
          centroid_lon = EXCLUDED.centroid_lon,
          population = EXCLUDED.population,
          official_name = EXCLUDED.official_name
      `;
      
      const values = [
        node.id,
        node.name,
        slug,
        regionType,
        node.parentId,
        node.coordinates?.latitude ?? null,
        node.coordinates?.longitude ?? null,
        node.metadata?.population ?? null,
        node.shortName ?? null
      ];
      
      await client.query(query, values);
      console.log(`  Imported: ${node.id} (${node.level})`);
    }
    
    await client.query("COMMIT");
    console.log("\nImport complete!");
    
    const result = await client.query(`
      SELECT region_type, COUNT(*) as count 
      FROM geo_regions 
      GROUP BY region_type 
      ORDER BY region_type
    `);
    
    console.log("\nVerification:");
    for (const row of result.rows) {
      console.log(`  ${row.region_type}: ${row.count}`);
    }
    
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error importing geo regions:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

importGeoRegions().catch(console.error);
