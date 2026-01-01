import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { AccommodationStorage } from '../storage/accommodationStorage';
import type { ApifyListing, ImportResult } from '../../shared/types/accommodations';

function calculateCrewScore(description: string, title: string = ''): number {
  const text = `${title} ${description}`.toLowerCase();
  let score = 0;

  if (/parking|driveway|garage/i.test(text)) score += 20;
  if (/truck|trailer|rv/i.test(text)) score += 15;
  if (/kitchen|cook|stove/i.test(text)) score += 15;
  if (/wifi|internet/i.test(text)) score += 10;
  if (/washer|dryer|laundry/i.test(text)) score += 10;
  if (/workspace|desk|office/i.test(text)) score += 8;
  if (/bedrooms?|sleeps [4-9]|sleeps 1[0-9]/i.test(text)) score += 10;
  if (/weekly|monthly|long.?term/i.test(text)) score += 7;
  if (/self.?check|keypad|lockbox/i.test(text)) score += 5;

  return Math.min(score, 100);
}

export function createAccommodationsRouter(db: Pool) {
  const router = Router();
  const storage = new AccommodationStorage(db);

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

  router.get('/bookings', async (req: Request, res: Response) => {
    try {
      const { status, propertyId, upcoming } = req.query;
      
      const bookings = await storage.getAllBookings({
        status: status as string,
        propertyId: propertyId ? parseInt(propertyId as string) : undefined,
        startDate: upcoming === 'true' ? new Date() : undefined
      });

      res.json({ bookings });
    } catch (error) {
      console.error('Error fetching bookings:', error);
      res.status(500).json({ error: 'Failed to fetch bookings' });
    }
  });

  router.get('/bookings/:id', async (req: Request, res: Response) => {
    try {
      const booking = await storage.getBookingById(parseInt(req.params.id));
      if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }
      res.json(booking);
    } catch (error) {
      console.error('Error fetching booking:', error);
      res.status(500).json({ error: 'Failed to fetch booking' });
    }
  });

  router.post('/bookings', async (req: Request, res: Response) => {
    try {
      const booking = await storage.createBooking(req.body);
      res.status(201).json(booking);
    } catch (error) {
      console.error('Error creating booking:', error);
      res.status(500).json({ error: 'Failed to create booking' });
    }
  });

  router.put('/bookings/:id', async (req: Request, res: Response) => {
    try {
      const booking = await storage.updateBooking(parseInt(req.params.id), req.body);
      if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }
      res.json(booking);
    } catch (error) {
      console.error('Error updating booking:', error);
      res.status(500).json({ error: 'Failed to update booking' });
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
        'SELECT * FROM outreach_campaigns WHERE id = $1',
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

  router.post('/outreach/messages', async (req: Request, res: Response) => {
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

      const result: ImportResult = {
        total: listings.length,
        imported: 0,
        updated: 0,
        skipped: 0,
        errors: []
      };

      for (const listing of listings) {
        try {
          const existing = await storage.getPropertyByAirbnbId(listing.id);
          
          const regionResult = await db.query(
            'SELECT get_region_from_coords($1, $2) as region',
            [listing.coordinates?.latitude, listing.coordinates?.longitude]
          );
          const region = regionResult.rows[0]?.region || 'Other BC';

          const crewScore = calculateCrewScore(listing.description || '', listing.title || '');
          
          const priceMatch = listing.price?.price?.match(/[\d,]+/);
          const baseNightlyRate = priceMatch ? parseFloat(priceMatch[0].replace(',', '')) : undefined;

          const propertyData = {
            airbnbId: listing.id,
            name: listing.title,
            description: listing.description,
            thumbnailUrl: listing.thumbnail,
            sourceUrl: listing.url,
            latitude: listing.coordinates?.latitude,
            longitude: listing.coordinates?.longitude,
            region,
            overallRating: listing.rating?.guestSatisfaction,
            reviewCount: listing.rating?.reviewsCount || 0,
            crewScore,
            baseNightlyRate,
            source: 'airbnb' as const,
            status: 'discovered' as const,
            isVerified: false,
            isCrewFriendly: crewScore >= 50,
            hasParking: /parking|driveway|garage/i.test(listing.description || ''),
            hasKitchen: /kitchen|cook|stove/i.test(listing.description || ''),
            hasWifi: /wifi|internet/i.test(listing.description || ''),
            hasWasher: /washer|laundry/i.test(listing.description || ''),
            hasDryer: /dryer/i.test(listing.description || ''),
            lastScrapedAt: new Date().toISOString()
          };

          await storage.upsertPropertyByAirbnbId(listing.id, propertyData);
          
          if (existing) {
            result.updated++;
          } else {
            result.imported++;
          }
        } catch (err) {
          result.skipped++;
          result.errors.push(`Failed to import ${listing.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

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
      
      const feedResult = await db.query('SELECT * FROM ical_feeds WHERE id = $1', [feedId]);
      if (feedResult.rows.length === 0) {
        return res.status(404).json({ error: 'Feed not found' });
      }

      const feed = feedResult.rows[0];
      
      try {
        const response = await fetch(feed.ical_url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const icalData = await response.text();
        
        const events: Array<{ uid: string; start: string; end: string; summary: string }> = [];
        const lines = icalData.split('\n');
        let currentEvent: any = null;

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed === 'BEGIN:VEVENT') {
            currentEvent = {};
          } else if (trimmed === 'END:VEVENT' && currentEvent) {
            if (currentEvent.uid && currentEvent.start && currentEvent.end) {
              events.push(currentEvent);
            }
            currentEvent = null;
          } else if (currentEvent) {
            if (trimmed.startsWith('UID:')) {
              currentEvent.uid = trimmed.substring(4);
            } else if (trimmed.startsWith('DTSTART')) {
              const dateStr = trimmed.split(':')[1];
              currentEvent.start = dateStr ? dateStr.substring(0, 8) : null;
            } else if (trimmed.startsWith('DTEND')) {
              const dateStr = trimmed.split(':')[1];
              currentEvent.end = dateStr ? dateStr.substring(0, 8) : null;
            } else if (trimmed.startsWith('SUMMARY:')) {
              currentEvent.summary = trimmed.substring(8);
            }
          }
        }

        await storage.clearBlocksForFeed(feedId);
        
        for (const event of events) {
          const startDate = `${event.start.substring(0, 4)}-${event.start.substring(4, 6)}-${event.start.substring(6, 8)}`;
          const endDate = `${event.end.substring(0, 4)}-${event.end.substring(4, 6)}-${event.end.substring(6, 8)}`;
          
          await storage.upsertAvailabilityBlock({
            propertyId: feed.property_id,
            feedId,
            startDate,
            endDate,
            blockType: 'booked',
            summary: event.summary,
            uid: event.uid
          });
        }

        await storage.updateFeedSyncStatus(feedId, 'success');
        
        res.json({ 
          success: true, 
          eventsProcessed: events.length 
        });
      } catch (syncError) {
        await storage.updateFeedSyncStatus(feedId, 'failed', syncError instanceof Error ? syncError.message : 'Unknown error');
        throw syncError;
      }
    } catch (error) {
      console.error('Error syncing feed:', error);
      res.status(500).json({ error: 'Failed to sync feed' });
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
