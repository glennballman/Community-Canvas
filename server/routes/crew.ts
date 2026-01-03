import { Router } from 'express';
import { serviceQuery } from '../db/tenantDb';
import { z } from 'zod';

const searchFiltersSchema = z.object({
  searchMode: z.enum(['browse', 'work_order']),
  nearLocation: z.string().optional(),
  radiusKm: z.number().default(50),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  totalPeople: z.number().min(1).default(1),
  privateBedroomsNeeded: z.number().min(0).default(0),
  vehicleSituation: z.enum(['none', 'has_trailer', 'needs_rental', 'needs_spot']).default('none'),
  trailerLengthFt: z.number().default(25),
  maxDailyRate: z.number().nullable().optional(),
  selectedAmenities: z.array(z.string()).default([]),
  includeProperties: z.boolean().default(true),
  includeSpots: z.boolean().default(true),
  includeTrailers: z.boolean().default(true),
  workOrderId: z.string().nullable().optional(),
});

export function createCrewRouter() {
  const router = Router();

  router.post('/accommodation-search', async (req, res) => {
    try {
      const filters = searchFiltersSchema.parse(req.body);
      
      if (filters.searchMode === 'work_order' && filters.workOrderId) {
        const woResult = await serviceQuery(
          `SELECT * FROM work_orders WHERE id = $1`,
          [filters.workOrderId]
        );
        
        if (woResult.rows.length === 0) {
          return res.status(404).json({ error: 'Work order not found' });
        }

        const matchResult = await serviceQuery(`
          SELECT * FROM match_work_order_requirements($1)
        `, [filters.workOrderId]);

        const assets: Record<string, unknown>[] = [];
        for (const row of matchResult.rows) {
          if (row.matching) {
            for (const match of row.matching) {
              if (!assets.find((a: Record<string, unknown>) => a.id === match.asset_id)) {
                assets.push({
                  id: match.asset_id,
                  name: match.name,
                  asset_type: match.asset_type,
                  thumbnail_url: match.thumbnail_url,
                  rate_daily: match.rate_daily,
                  capabilities: [{ type: row.capability_type, attrs: match.capability_attrs }],
                });
              }
            }
          }
        }

        return res.json({
          results: assets,
          total: assets.length,
          mode: 'work_order',
        });
      }

      let locationLat: number | null = null;
      let locationLng: number | null = null;

      if (filters.nearLocation && filters.nearLocation.trim()) {
        const geoQuery = await serviceQuery(`
          SELECT latitude, longitude 
          FROM bc_municipalities 
          WHERE name ILIKE $1 
          LIMIT 1
        `, [`%${filters.nearLocation}%`]);
        
        if (geoQuery.rows.length > 0) {
          locationLat = geoQuery.rows[0].latitude;
          locationLng = geoQuery.rows[0].longitude;
        } else {
          const regionQuery = await serviceQuery(`
            SELECT latitude, longitude 
            FROM regional_districts 
            WHERE name ILIKE $1 
            LIMIT 1
          `, [`%${filters.nearLocation}%`]);
          
          if (regionQuery.rows.length > 0) {
            locationLat = regionQuery.rows[0].latitude;
            locationLng = regionQuery.rows[0].longitude;
          }
        }
      }

      const conditions: string[] = ['a.status = $1'];
      const params: unknown[] = ['active'];
      let paramIndex = 2;

      if (filters.totalPeople > 1) {
        conditions.push(`EXISTS (
          SELECT 1 FROM asset_capabilities sleeping_cap 
          WHERE sleeping_cap.asset_id = a.id 
          AND sleeping_cap.capability_type = 'sleeping' 
          AND sleeping_cap.is_active = true
          AND (sleeping_cap.attributes->>'people')::int >= $${paramIndex}
        )`);
        params.push(filters.totalPeople);
        paramIndex++;
      }

      if (filters.privateBedroomsNeeded > 0) {
        conditions.push(`EXISTS (
          SELECT 1 FROM asset_capabilities br_cap 
          WHERE br_cap.asset_id = a.id 
          AND br_cap.capability_type = 'sleeping' 
          AND br_cap.is_active = true
          AND (br_cap.attributes->>'private_bedrooms')::int >= $${paramIndex}
        )`);
        params.push(filters.privateBedroomsNeeded);
        paramIndex++;
      }

      if (filters.maxDailyRate) {
        conditions.push(`(t.rate_daily IS NULL OR t.rate_daily <= $${paramIndex})`);
        params.push(filters.maxDailyRate);
        paramIndex++;
      }

      if (filters.vehicleSituation === 'has_trailer' || filters.vehicleSituation === 'needs_spot') {
        if (filters.trailerLengthFt) {
          conditions.push(`EXISTS (
            SELECT 1 FROM asset_capabilities pac 
            WHERE pac.asset_id = a.id 
            AND pac.capability_type = 'parking'
            AND pac.is_active = true
            AND (pac.attributes->>'max_length_ft')::int >= $${paramIndex}
          )`);
          params.push(filters.trailerLengthFt);
          paramIndex++;
        } else {
          conditions.push(`EXISTS (
            SELECT 1 FROM asset_capabilities pac 
            WHERE pac.asset_id = a.id 
            AND pac.capability_type = 'parking'
            AND pac.is_active = true
          )`);
        }
      }

      const assetTypes: string[] = [];
      if (filters.includeProperties) assetTypes.push('property');
      if (filters.includeSpots) assetTypes.push('spot');
      if (filters.includeTrailers) assetTypes.push('trailer', 'vehicle');
      
      if (assetTypes.length > 0 && assetTypes.length < 4) {
        conditions.push(`a.asset_type = ANY($${paramIndex})`);
        params.push(assetTypes);
        paramIndex++;
      }

      if (filters.selectedAmenities && filters.selectedAmenities.length > 0) {
        const amenityConditions: string[] = [];
        
        for (const amenity of filters.selectedAmenities) {
          switch (amenity) {
            case 'has_wifi':
            case 'has_kitchen':
            case 'has_laundry':
            case 'has_hot_tub':
            case 'has_pool':
            case 'has_bbq_grills':
            case 'has_fire_pits':
            case 'has_coffee_maker':
            case 'is_waterfront':
            case 'has_boat_launch':
            case 'has_hiking_trails':
            case 'has_fishing':
            case 'has_kayak_rental':
            case 'pets_allowed':
            case 'has_dog_park':
            case 'has_playground':
            case 'bedding_provided':
              amenityConditions.push(`(
                (a.source_table = 'external_records' AND a.source_id ~ '^[0-9a-f]{8}-' AND EXISTS (
                  SELECT 1 FROM external_records er 
                  WHERE er.id = a.source_id::uuid 
                  AND (er.metadata->>'${amenity}')::boolean = true
                ))
                OR
                (a.source_table = 'staging_properties' AND a.source_id ~ '^\\d+$' AND EXISTS (
                  SELECT 1 FROM staging_properties sp 
                  WHERE sp.id = a.source_id::integer 
                  AND sp.${amenity} = true
                ))
              )`);
              break;
            case 'has_shore_power':
            case 'has_water_hookup':
            case 'has_sewer_hookup':
            case 'has_dump_station':
            case 'has_propane_refill':
              amenityConditions.push(`EXISTS (
                SELECT 1 FROM asset_capabilities ac_rv 
                WHERE ac_rv.asset_id = a.id 
                AND ac_rv.capability_type IN ('power_supply', 'water_supply', 'waste_handling')
                AND ac_rv.is_active = true
              )`);
              break;
            case 'has_workspace':
              amenityConditions.push(`EXISTS (
                SELECT 1 FROM asset_capabilities ac_ws 
                WHERE ac_ws.asset_id = a.id 
                AND ac_ws.capability_type = 'workspace'
                AND ac_ws.is_active = true
              )`);
              break;
            case 'long_term_ok':
              amenityConditions.push(`(t.max_nights IS NULL OR t.max_nights >= 30)`);
              break;
            case 'crew_friendly':
              amenityConditions.push(`(a.crew_score IS NOT NULL AND a.crew_score >= 70)`);
              break;
          }
        }
        
        if (amenityConditions.length > 0) {
          conditions.push(`(${amenityConditions.join(' AND ')})`);
        }
      }

      let distanceSelect = '';
      let distanceOrder = '';
      
      if (locationLat && locationLng) {
        distanceSelect = `, 
          CASE WHEN a.latitude IS NOT NULL AND a.longitude IS NOT NULL 
          THEN ST_Distance(
            ST_MakePoint(a.longitude, a.latitude)::geography,
            ST_MakePoint($${paramIndex}, $${paramIndex + 1})::geography
          ) / 1000.0
          ELSE NULL END as distance_km`;
        params.push(locationLng, locationLat);
        
        conditions.push(`(
          a.latitude IS NULL OR a.longitude IS NULL OR
          ST_DWithin(
            ST_MakePoint(a.longitude, a.latitude)::geography,
            ST_MakePoint($${paramIndex}, $${paramIndex + 1})::geography,
            $${paramIndex + 2} * 1000
          )
        )`);
        params.push(filters.radiusKm);
        paramIndex += 3;
        
        distanceOrder = 'distance_km ASC NULLS LAST,';
      }

      const query = `
        SELECT DISTINCT ON (a.id)
          a.id,
          a.name,
          a.asset_type,
          a.source_table,
          a.city,
          a.region,
          a.thumbnail_url,
          a.overall_rating,
          a.review_count,
          a.crew_score,
          t.rate_daily,
          (SELECT (attributes->>'people')::int 
           FROM asset_capabilities 
           WHERE asset_id = a.id AND capability_type = 'sleeping' 
           LIMIT 1) as sleeps_total,
          (SELECT jsonb_agg(jsonb_build_object('type', capability_type, 'attrs', attributes))
           FROM asset_capabilities
           WHERE asset_id = a.id AND is_active = true) as capabilities
          ${distanceSelect}
        FROM assets a
        LEFT JOIN asset_terms t ON t.asset_id = a.id
        WHERE ${conditions.join(' AND ')}
        ORDER BY a.id, ${distanceOrder} a.crew_score DESC NULLS LAST, a.overall_rating DESC NULLS LAST
        LIMIT 100
      `;

      const result = await serviceQuery(query, params);

      return res.json({
        results: result.rows,
        total: result.rows.length,
        mode: 'browse',
        location: locationLat && locationLng ? { lat: locationLat, lng: locationLng } : null,
      });

    } catch (error) {
      console.error('Accommodation search error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid search parameters', details: error.errors });
      }
      return res.status(500).json({ error: 'Search failed' });
    }
  });

  router.get('/work-orders', async (req, res) => {
    try {
      const result = await serviceQuery(`
        SELECT id, work_order_ref, title, status, crew_size_min, crew_size_max
        FROM work_orders
        WHERE status IN ('draft', 'pending', 'active')
        ORDER BY created_at DESC
        LIMIT 50
      `);
      return res.json(result.rows);
    } catch (error) {
      console.error('Error fetching work orders:', error);
      return res.json([]);
    }
  });

  return router;
}

export default createCrewRouter;
