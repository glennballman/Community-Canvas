/**
 * Schema Probe - N3 Service Run Monitor
 * Detects existing tables to determine segment storage strategy
 */

import { db } from "../db";
import { sql } from "drizzle-orm";

interface SchemaProbeResult {
  hasServiceRuns: boolean;
  hasTripItineraryItems: boolean;
  hasSegments: boolean;
  segmentTable: "cc_trip_itinerary_items" | "cc_segments";
  tripItineraryHasServiceRunId: boolean;
  tripItineraryHasSegmentKind: boolean;
}

export async function probeSchema(): Promise<SchemaProbeResult> {
  const tableQuery = sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('cc_service_runs', 'cc_trip_itinerary_items', 'cc_segments')
  `;
  
  const tables = await db.execute(tableQuery);
  const tableNames = new Set((tables.rows as Array<{table_name: string}>).map(r => r.table_name));
  
  const hasServiceRuns = tableNames.has('cc_service_runs');
  const hasTripItineraryItems = tableNames.has('cc_trip_itinerary_items');
  const hasSegments = tableNames.has('cc_segments');
  
  let tripItineraryHasServiceRunId = false;
  let tripItineraryHasSegmentKind = false;
  
  if (hasTripItineraryItems) {
    const columnQuery = sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'cc_trip_itinerary_items'
      AND column_name IN ('service_run_id', 'segment_kind')
    `;
    
    const columns = await db.execute(columnQuery);
    const columnNames = new Set((columns.rows as Array<{column_name: string}>).map(r => r.column_name));
    
    tripItineraryHasServiceRunId = columnNames.has('service_run_id');
    tripItineraryHasSegmentKind = columnNames.has('segment_kind');
  }
  
  const segmentTable = hasTripItineraryItems ? "cc_trip_itinerary_items" : "cc_segments";
  
  return {
    hasServiceRuns,
    hasTripItineraryItems,
    hasSegments,
    segmentTable,
    tripItineraryHasServiceRunId,
    tripItineraryHasSegmentKind,
  };
}

export async function logSchemaProbe(): Promise<void> {
  const result = await probeSchema();
  console.log("[N3 Schema Probe]", JSON.stringify(result, null, 2));
}
