import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { serviceQuery } from '../db/tenantDb';
import { AccommodationStorage } from '../storage/accommodationStorage';
import { AccommodationImportService } from '../services/accommodationImportService';
import { ICalSyncService } from '../services/icalSyncService';
import type { ApifyListing } from '../../shared/types/accommodations';

export function createAccommodationsRouter(db: Pool) {
  const router = Router();
  const storage = new AccommodationStorage(db);
  const importService = new AccommodationImportService(db);
  const icalService = new ICalSyncService(db);

  // =====================================================
  // PROPERTIES
  // =====================================================

  router.get('/', async (req: Request, res: Response) => {
    try {
      const { region, city, minCrewScore, status, limit, offset } = req.query;
      
      let properties = await storage.getAllProperties({
        region: region as string,
        city: city as string,
        minCrewScore: minCrewScore ? parseInt(minCrewScore as string) : undefined,
        status: status as string
      });

      const total = properties.length;
      
      if (offset) {
        properties = properties.slice(parseInt(offset as string));
      }
      if (limit) {
        properties = properties.slice(0, parseInt(limit as string));
      }

      res.json({ properties, total });
    } catch (error) {
      console.error('Error fetching properties:', error);
      res.status(500).json({ error: 'Failed to fetch properties' });
    }
  });

  router.get('/stats', async (req: Request, res: Response) => {
    try {
      const stats = await storage.getPropertyStats();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  });

  router.get('/reservations', async (req: Request, res: Response) => {
    try {
      const { status, propertyId, upcoming } = req.query;
      
      const reservations = await storage.getAllReservations({
        status: status as string,
        propertyId: propertyId ? parseInt(propertyId as string) : undefined,
        startDate: upcoming === 'true' ? new Date() : undefined
      });

      res.json({ reservations });
    } catch (error) {
      console.error('Error fetching reservations:', error);
      res.status(500).json({ error: 'Failed to fetch reservations' });
    }
  });

  router.get('/reservations/:id', async (req: Request, res: Response) => {
    try {
      const reservation = await storage.getReservationById(parseInt(req.params.id));
      if (!reservation) {
        return res.status(404).json({ error: 'Reservation not found' });
      }
      res.json(reservation);
    } catch (error) {
      console.error('Error fetching reservation:', error);
      res.status(500).json({ error: 'Failed to fetch reservation' });
    }
  });

  router.post('/reservations', async (req: Request, res: Response) => {
    try {
      const reservation = await storage.createReservation(req.body);
      res.status(201).json(reservation);
    } catch (error) {
      console.error('Error creating reservation:', error);
      res.status(500).json({ error: 'Failed to create reservation' });
    }
  });

  router.put('/reservations/:id', async (req: Request, res: Response) => {
    try {
      const reservation = await storage.updateReservation(parseInt(req.params.id), req.body);
      if (!reservation) {
        return res.status(404).json({ error: 'Reservation not found' });
      }
      res.json(reservation);
    } catch (error) {
      console.error('Error updating reservation:', error);
      res.status(500).json({ error: 'Failed to update reservation' });
    }
  });

  router.get('/outreach/campaigns', async (req: Request, res: Response) => {
    try {
      const campaigns = await storage.getCampaigns();
      res.json({ campaigns });
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      res.status(500).json({ error: 'Failed to fetch campaigns' });
    }
  });

  router.post('/outreach/campaigns', async (req: Request, res: Response) => {
    try {
      const campaign = await storage.createCampaign(req.body);
      res.status(201).json(campaign);
    } catch (error) {
      console.error('Error creating campaign:', error);
      res.status(500).json({ error: 'Failed to create campaign' });
    }
  });

  router.get('/outreach/campaigns/:id/targets', async (req: Request, res: Response) => {
    try {
      const campaignId = parseInt(req.params.id);
      const result = await db.query(
        'SELECT * FROM cc_outreach_campaigns WHERE id = $1',
        [campaignId]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      const campaign = result.rows[0];
      const properties = await storage.getAllProperties({
        region: campaign.target_region,
        minCrewScore: campaign.target_min_crew_score,
        status: 'discovered'
      });

      res.json({ targets: properties });
    } catch (error) {
      console.error('Error fetching campaign targets:', error);
      res.status(500).json({ error: 'Failed to fetch campaign targets' });
    }
  });

  router.post('/outreach/cc_messages', async (req: Request, res: Response) => {
    try {
      const message = await storage.createOutreachMessage(req.body);
      res.status(201).json(message);
    } catch (error) {
      console.error('Error creating outreach message:', error);
      res.status(500).json({ error: 'Failed to create outreach message' });
    }
  });

  router.post('/import', async (req: Request, res: Response) => {
    try {
      const { listings } = req.body as { listings: ApifyListing[] };
      
      if (!listings || !Array.isArray(listings)) {
        return res.status(400).json({ error: 'listings array is required' });
      }

      const result = await importService.importListings(listings);
      res.json(result);
    } catch (error) {
      console.error('Error importing listings:', error);
      res.status(500).json({ error: 'Failed to import listings' });
    }
  });

  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const property = await storage.getPropertyById(parseInt(req.params.id));
      if (!property) {
        return res.status(404).json({ error: 'Property not found' });
      }
      res.json(property);
    } catch (error) {
      console.error('Error fetching property:', error);
      res.status(500).json({ error: 'Failed to fetch property' });
    }
  });

  router.post('/', async (req: Request, res: Response) => {
    try {
      const property = await storage.createProperty({
        ...req.body,
        source: req.body.source || 'manual',
        status: req.body.status || 'discovered',
        reviewCount: req.body.reviewCount || 0,
        crewScore: req.body.crewScore || 0,
        isVerified: req.body.isVerified || false,
        isCrewFriendly: req.body.isCrewFriendly || false,
        hasParking: req.body.hasParking || false,
        hasKitchen: req.body.hasKitchen || false,
        hasWifi: req.body.hasWifi || false,
        hasWasher: req.body.hasWasher || false,
        hasDryer: req.body.hasDryer || false
      });
      res.status(201).json(property);
    } catch (error) {
      console.error('Error creating property:', error);
      res.status(500).json({ error: 'Failed to create property' });
    }
  });

  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const property = await storage.updateProperty(parseInt(req.params.id), req.body);
      if (!property) {
        return res.status(404).json({ error: 'Property not found' });
      }
      res.json(property);
    } catch (error) {
      console.error('Error updating property:', error);
      res.status(500).json({ error: 'Failed to update property' });
    }
  });

  // =====================================================
  // ICAL FEEDS
  // =====================================================

  router.get('/:id/feeds', async (req: Request, res: Response) => {
    try {
      const feeds = await storage.getFeedsByPropertyId(parseInt(req.params.id));
      res.json({ feeds });
    } catch (error) {
      console.error('Error fetching feeds:', error);
      res.status(500).json({ error: 'Failed to fetch feeds' });
    }
  });

  router.post('/:id/feeds', async (req: Request, res: Response) => {
    try {
      const { icalUrl, feedName } = req.body;
      
      if (!icalUrl) {
        return res.status(400).json({ error: 'icalUrl is required' });
      }

      try {
        const response = await fetch(icalUrl, { method: 'HEAD' });
        if (!response.ok) {
          return res.status(400).json({ error: 'iCal URL is not accessible' });
        }
      } catch {
        return res.status(400).json({ error: 'Failed to validate iCal URL' });
      }

      const feed = await storage.createFeed({
        propertyId: parseInt(req.params.id),
        icalUrl,
        feedName
      });
      res.status(201).json(feed);
    } catch (error) {
      console.error('Error creating feed:', error);
      res.status(500).json({ error: 'Failed to create feed' });
    }
  });

  router.post('/feeds/:feedId/sync', async (req: Request, res: Response) => {
    try {
      const feedId = parseInt(req.params.feedId);
      const result = await icalService.syncFeed(feedId);
      
      if (!result.success) {
        return res.status(400).json({ 
          success: false, 
          error: result.error 
        });
      }

      res.json({
        success: true,
        eventsFound: result.eventsFound,
        blocksCreated: result.blocksCreated,
        blocksUpdated: result.blocksUpdated
      });
    } catch (error) {
      console.error('Error syncing feed:', error);
      res.status(500).json({ error: 'Failed to sync feed' });
    }
  });

  router.post('/feeds/sync-all', async (req: Request, res: Response) => {
    try {
      const result = await icalService.syncAllActiveFeeds();
      res.json(result);
    } catch (error) {
      console.error('Error syncing all feeds:', error);
      res.status(500).json({ error: 'Failed to sync feeds' });
    }
  });

  router.post('/feeds/validate', async (req: Request, res: Response) => {
    try {
      const { url } = req.body;
      
      if (!url) {
        return res.status(400).json({ valid: false, error: 'URL is required' });
      }

      const result = await icalService.validateAndFetchIcal(url);
      res.json(result);
    } catch (error) {
      console.error('Error validating iCal URL:', error);
      res.status(500).json({ valid: false, error: 'Failed to validate URL' });
    }
  });

  router.get('/:id/blocks', async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const blocks = await icalService.getAvailabilityBlocks(parseInt(req.params.id), days);
      res.json({ blocks });
    } catch (error) {
      console.error('Error fetching availability blocks:', error);
      res.status(500).json({ error: 'Failed to fetch availability blocks' });
    }
  });

  router.get('/:id/availability', async (req: Request, res: Response) => {
    try {
      const { checkIn, checkOut } = req.query;
      
      if (!checkIn || !checkOut) {
        return res.status(400).json({ error: 'checkIn and checkOut dates are required' });
      }

      const isAvailable = await storage.checkAvailability(
        parseInt(req.params.id),
        new Date(checkIn as string),
        new Date(checkOut as string)
      );

      const blocks = await storage.getAvailabilityBlocks(
        parseInt(req.params.id),
        new Date(checkIn as string),
        new Date(checkOut as string)
      );

      res.json({ 
        available: isAvailable,
        conflictingBlocks: blocks
      });
    } catch (error) {
      console.error('Error checking availability:', error);
      res.status(500).json({ error: 'Failed to check availability' });
    }
  });

  return router;
}
