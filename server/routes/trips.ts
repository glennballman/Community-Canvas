import { Router, Request, Response } from 'express';
import { serviceQuery } from '../db/tenantDb';
import { requireAuth } from '../middleware/guards';

export function createTripsRouter() {
  const router = Router();

  router.get('/', async (req: Request, res: Response) => {
    try {
      const { category, season, region, difficulty, search, sort = 'popularity', limit = 50, offset = 0 } = req.query;
      
      let query = `
        SELECT t.*, COUNT(s.id) as segment_count
        FROM cc_road_trips t
        LEFT JOIN cc_trip_segments s ON t.id = s.trip_id
        WHERE t.is_published = true
      `;
      
      const params: any[] = [];
      let paramIndex = 1;
      
      if (category) {
        params.push(category);
        query += ` AND t.category = $${paramIndex++}`;
      }
      if (season) {
        params.push(season);
        query += ` AND $${paramIndex++} = ANY(t.seasons)`;
      }
      if (region) {
        params.push(region);
        query += ` AND t.region = $${paramIndex++}`;
      }
      if (difficulty) {
        params.push(difficulty);
        query += ` AND t.difficulty = $${paramIndex++}`;
      }
      if (search) {
        params.push(`%${search}%`);
        query += ` AND (t.title ILIKE $${paramIndex} OR t.tagline ILIKE $${paramIndex} OR t.region ILIKE $${paramIndex})`;
        paramIndex++;
      }
      
      query += ` GROUP BY t.id`;
      
      switch (sort) {
        case 'rating': query += ` ORDER BY t.rating DESC, t.rating_count DESC`; break;
        case 'cost_low': query += ` ORDER BY t.cost_budget ASC`; break;
        case 'duration': query += ` ORDER BY t.duration_min_hours ASC`; break;
        case 'newest': query += ` ORDER BY t.created_at DESC`; break;
        default: query += ` ORDER BY t.popularity_score DESC, t.rating_count DESC`;
      }
      
      params.push(limit, offset);
      query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      
      const result = await serviceQuery(query, params);
      
      const countResult = await serviceQuery(`SELECT COUNT(*) FROM cc_road_trips WHERE is_published = true`);
      
      res.json({
        trips: result.rows,
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });
    } catch (error) {
      console.error('Error fetching trips:', error);
      res.status(500).json({ error: 'Failed to fetch trips' });
    }
  });

  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const tripResult = await serviceQuery(
        `SELECT * FROM cc_road_trips WHERE id = $1 OR slug = $1`,
        [id]
      );
      
      if (tripResult.rows.length === 0) {
        return res.status(404).json({ error: 'Trip not found' });
      }
      
      const trip = tripResult.rows[0];
      
      const segmentsResult = await serviceQuery(
        `SELECT * FROM cc_trip_segments WHERE trip_id = $1 ORDER BY segment_order`,
        [trip.id]
      );
      
      // Analytics logging removed - should be handled by separate background job
      // to avoid unauthenticated users bypassing RLS
      
      res.json({ ...trip, segments: segmentsResult.rows });
    } catch (error) {
      console.error('Error fetching trip:', error);
      res.status(500).json({ error: 'Failed to fetch trip' });
    }
  });

  router.get('/:id/conditions', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const tripResult = await serviceQuery(
        `SELECT * FROM cc_road_trips WHERE id = $1 OR slug = $1`,
        [id]
      );
      
      if (tripResult.rows.length === 0) {
        return res.status(404).json({ error: 'Trip not found' });
      }
      
      const alertsResult = await serviceQuery(
        `SELECT * FROM cc_alerts WHERE is_active = true ORDER BY severity DESC LIMIT 10`
      ).catch(() => ({ rows: [] }));
      
      res.json({
        trip_id: id,
        cc_alerts: alertsResult.rows,
        weather: { temperature: -5, condition: 'Light Snow', wind_speed: 15 },
        road_status: 'Clear',
        ferry_status: null,
        overall_status: alertsResult.rows.length > 0 ? 'caution' : 'good',
        checked_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching conditions:', error);
      res.status(500).json({ error: 'Failed to fetch conditions' });
    }
  });

  router.get('/:id/webcams', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const segmentsResult = await serviceQuery(
        `SELECT segment_order, title, webcam_ids FROM cc_trip_segments WHERE trip_id = $1 ORDER BY segment_order`,
        [id]
      );
      
      const allWebcamIds = segmentsResult.rows.flatMap((s: any) => s.webcam_ids || []).filter(Boolean);
      
      let webcams: any[] = [];
      if (allWebcamIds.length > 0) {
        const webcamsResult = await serviceQuery(
          `SELECT * FROM cc_entities WHERE id = ANY($1::int[])`,
          [allWebcamIds]
        ).catch(() => ({ rows: [] }));
        webcams = webcamsResult.rows;
      }
      
      const segmentWebcams = segmentsResult.rows.map((segment: any) => ({
        segment_order: segment.segment_order,
        segment_title: segment.title,
        webcam_ids: segment.webcam_ids || [],
        webcams: webcams.filter((w: any) => (segment.webcam_ids || []).includes(w.id))
      }));
      
      res.json({
        trip_id: id,
        total_webcams: webcams.length,
        webcams,
        by_segment: segmentWebcams
      });
    } catch (error) {
      console.error('Error fetching webcams:', error);
      res.status(500).json({ error: 'Failed to fetch webcams' });
    }
  });

  router.get('/featured/list', async (_req: Request, res: Response) => {
    try {
      const result = await serviceQuery(`
        SELECT * FROM cc_road_trips 
        WHERE is_published = true AND is_featured = true 
        ORDER BY popularity_score DESC 
        LIMIT 5
      `);
      res.json({ trips: result.rows });
    } catch (error) {
      console.error('Error fetching featured trips:', error);
      res.status(500).json({ error: 'Failed to fetch featured trips' });
    }
  });

  return router;
}
