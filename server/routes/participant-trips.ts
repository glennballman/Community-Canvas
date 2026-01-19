import { Router, Response } from 'express';
import { serviceQuery } from '../db/tenantDb';
import { requireAuth } from '../middleware/guards';
import { TenantRequest } from '../middleware/tenantContext';

export function createParticipantTripsRouter() {
  const router = Router();

  router.get('/', requireAuth, async (req, res: Response) => {
    try {
      const tenantReq = req as TenantRequest;
      const userId = tenantReq.ctx?.individual_id;
      if (!userId) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
      }

      const result = await serviceQuery(`
        SELECT 
          t.id,
          t.group_name as title,
          t.start_date as "startDate",
          t.end_date as "endDate",
          t.status,
          t.current_alert_level as "alertLevel",
          t.origin_name as "originName",
          t.monitoring_active as "monitoringActive",
          (SELECT COUNT(*) FROM cc_trip_itinerary_items WHERE trip_id = t.id) as "itemCount",
          (SELECT COUNT(*) FROM cc_trip_itinerary_items WHERE trip_id = t.id AND is_reserved = true) as "reservedCount",
          (SELECT location_name FROM cc_trip_itinerary_items WHERE trip_id = t.id ORDER BY day_date, start_time LIMIT 1) as "primaryLocation"
        FROM cc_trips t
        LEFT JOIN cc_trip_participants tp ON tp.trip_id = t.id AND tp.participant_id = $1
        WHERE t.lead_participant_id = $1 OR tp.participant_id = $1
        ORDER BY t.start_date DESC
      `, [userId]);

      const now = new Date();
      const trips = result.rows.map(trip => ({
        ...trip,
        isUpcoming: trip.startDate ? new Date(trip.startDate) >= now : false,
        isPast: trip.endDate ? new Date(trip.endDate) < now : false
      }));

      res.json({
        ok: true,
        trips,
        count: trips.length
      });
    } catch (error: any) {
      console.error('Error fetching participant trips:', error);
      res.status(500).json({ ok: false, error: 'Failed to fetch trips' });
    }
  });

  router.get('/:tripId', requireAuth, async (req, res: Response) => {
    try {
      const tenantReq = req as TenantRequest;
      const userId = tenantReq.ctx?.individual_id;
      const { tripId } = req.params;

      if (!userId) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
      }

      const tripResult = await serviceQuery(`
        SELECT 
          t.*,
          t.group_name as title,
          t.origin_name as "originName",
          t.current_alert_level as "alertLevel"
        FROM cc_trips t
        LEFT JOIN cc_trip_participants tp ON tp.trip_id = t.id AND tp.participant_id = $2
        WHERE t.id = $1 AND (t.lead_participant_id = $2 OR tp.participant_id = $2)
      `, [tripId, userId]);

      if (tripResult.rows.length === 0) {
        return res.status(404).json({ ok: false, error: 'Trip not found' });
      }

      const trip = tripResult.rows[0];

      const itineraryResult = await serviceQuery(`
        SELECT 
          id,
          item_type as "itemType",
          title,
          description,
          is_reserved as "isReserved",
          reservation_id as "reservationId",
          status,
          day_date as "dayDate",
          start_time as "startTime",
          end_time as "endTime",
          all_day as "allDay",
          everyone,
          location_name as "locationName",
          location_lat as "locationLat",
          location_lng as "locationLng",
          weather_sensitive as "weatherSensitive",
          icon,
          color,
          sort_order as "sortOrder"
        FROM cc_trip_itinerary_items
        WHERE trip_id = $1
        ORDER BY day_date, COALESCE(start_time, '00:00:00'), sort_order
      `, [tripId]);

      const participantsResult = await serviceQuery(`
        SELECT 
          tp.id,
          tp.participant_id as "participantId",
          tp.role,
          tp.skills_verified as "skillsVerified",
          tp.equipment_verified as "equipmentVerified"
        FROM cc_trip_participants tp
        WHERE tp.trip_id = $1
      `, [tripId]);

      const itineraryByDay: Record<string, any[]> = {};
      for (const item of itineraryResult.rows) {
        const dayKey = item.dayDate || 'unscheduled';
        if (!itineraryByDay[dayKey]) {
          itineraryByDay[dayKey] = [];
        }
        itineraryByDay[dayKey].push(item);
      }

      res.json({
        ok: true,
        trip: {
          id: trip.id,
          title: trip.title || trip.group_name,
          startDate: trip.start_date,
          endDate: trip.end_date,
          status: trip.status,
          alertLevel: trip.alertLevel,
          originName: trip.originName,
          groupSize: trip.group_size,
          notes: trip.notes,
          monitoringActive: trip.monitoring_active
        },
        itinerary: itineraryResult.rows,
        itineraryByDay,
        participants: participantsResult.rows
      });
    } catch (error: any) {
      console.error('Error fetching trip detail:', error);
      res.status(500).json({ ok: false, error: 'Failed to fetch trip details' });
    }
  });

  router.get('/:tripId/reservations', requireAuth, async (req, res: Response) => {
    try {
      const tenantReq = req as TenantRequest;
      const userId = tenantReq.ctx?.individual_id;
      const { tripId } = req.params;

      if (!userId) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
      }

      const accessCheck = await serviceQuery(`
        SELECT 1 FROM cc_trips t
        LEFT JOIN cc_trip_participants tp ON tp.trip_id = t.id AND tp.participant_id = $2
        WHERE t.id = $1 AND (t.lead_participant_id = $2 OR tp.participant_id = $2)
      `, [tripId, userId]);

      if (accessCheck.rows.length === 0) {
        return res.status(404).json({ ok: false, error: 'Trip not found' });
      }

      const reservationsResult = await serviceQuery(`
        SELECT 
          i.id as "itineraryItemId",
          i.title as "itemTitle",
          i.reservation_id as "reservationId",
          i.day_date as "dayDate",
          r.status as "reservationStatus",
          r.total_amount as "totalAmount",
          r.currency
        FROM cc_trip_itinerary_items i
        LEFT JOIN cc_reservations r ON r.id = i.reservation_id
        WHERE i.trip_id = $1 AND i.is_reserved = true AND i.reservation_id IS NOT NULL
        ORDER BY i.day_date, i.start_time
      `, [tripId]);

      res.json({
        ok: true,
        reservations: reservationsResult.rows
      });
    } catch (error: any) {
      console.error('Error fetching trip reservations:', error);
      res.status(500).json({ ok: false, error: 'Failed to fetch reservations' });
    }
  });

  return router;
}
