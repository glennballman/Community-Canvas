import { Pool } from 'pg';

interface ICalEvent {
  uid: string;
  summary?: string;
  startDate: string;
  endDate: string;
  blockType: 'reserved' | 'blocked';
}

interface SyncResult {
  success: boolean;
  eventsFound: number;
  blocksCreated: number;
  blocksUpdated: number;
  error?: string;
}

function parseICalDate(dateStr: string): string | null {
  if (!dateStr) return null;
  
  const cleanDate = dateStr.replace(/^[A-Z]+[;:]?/, '').trim();
  
  if (/^\d{8}$/.test(cleanDate)) {
    const year = cleanDate.substring(0, 4);
    const month = cleanDate.substring(4, 6);
    const day = cleanDate.substring(6, 8);
    return `${year}-${month}-${day}`;
  }
  
  if (/^\d{8}T\d{6}Z?$/.test(cleanDate)) {
    const year = cleanDate.substring(0, 4);
    const month = cleanDate.substring(4, 6);
    const day = cleanDate.substring(6, 8);
    return `${year}-${month}-${day}`;
  }
  
  const match = cleanDate.match(/(\d{4})(\d{2})(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  
  return null;
}

function parseICalEvents(icalData: string): ICalEvent[] {
  const cc_events: ICalEvent[] = [];
  
  const eventBlocks = icalData.split('BEGIN:VEVENT');
  
  for (let i = 1; i < eventBlocks.length; i++) {
    const block = eventBlocks[i].split('END:VEVENT')[0];
    
    const uidMatch = block.match(/UID[;:]([^\r\n]+)/);
    const summaryMatch = block.match(/SUMMARY[;:]([^\r\n]+)/);
    const dtstartMatch = block.match(/DTSTART[;:]?([^\r\n]+)/);
    const dtendMatch = block.match(/DTEND[;:]?([^\r\n]+)/);
    
    if (!dtstartMatch) continue;
    
    const startDate = parseICalDate(dtstartMatch[1]);
    let endDate = dtendMatch ? parseICalDate(dtendMatch[1]) : startDate;
    
    if (!startDate) continue;
    if (!endDate) endDate = startDate;
    
    const uid = uidMatch ? uidMatch[1].trim() : `generated-${Date.now()}-${i}`;
    const summary = summaryMatch ? summaryMatch[1].trim() : undefined;
    
    const summaryLower = (summary || '').toLowerCase();
    const blockType: 'reserved' | 'blocked' = 
      summaryLower.includes('reserved') || 
      summaryLower.includes('booked') || 
      summaryLower.includes('airbnb') ||
      summaryLower.includes('booking.com')
        ? 'reserved' 
        : 'blocked';
    
    cc_events.push({
      uid,
      summary,
      startDate,
      endDate,
      blockType
    });
  }
  
  return cc_events;
}

export class ICalSyncService {
  constructor(private db: Pool) {}

  async validateAndFetchIcal(url: string): Promise<{ valid: boolean; data?: string; error?: string }> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'CommunityStatusDashboard/1.0',
          'Accept': 'text/calendar, */*'
        },
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) {
        return { valid: false, error: `HTTP ${response.status}: ${response.statusText}` };
      }

      const data = await response.text();

      if (!data.includes('BEGIN:VCALENDAR') || !data.includes('END:VCALENDAR')) {
        return { valid: false, error: 'Response is not valid iCal format' };
      }

      return { valid: true, data };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { valid: false, error: message };
    }
  }

  async syncFeed(feedId: number): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      eventsFound: 0,
      blocksCreated: 0,
      blocksUpdated: 0
    };

    try {
      const feedResult = await this.db.query(
        'SELECT * FROM cc_ical_feeds WHERE id = $1',
        [feedId]
      );

      if (feedResult.rows.length === 0) {
        result.error = 'Feed not found';
        return result;
      }

      const feed = feedResult.rows[0];
      const propertyId = feed.property_id;
      const icalUrl = feed.ical_url;

      const fetchResult = await this.validateAndFetchIcal(icalUrl);

      if (!fetchResult.valid || !fetchResult.data) {
        await this.updateFeedSyncStatus(feedId, 'failed', fetchResult.error);
        result.error = fetchResult.error;
        return result;
      }

      const cc_events = parseICalEvents(fetchResult.data);
      result.eventsFound = cc_events.length;

      for (const event of cc_events) {
        const existingBlock = await this.db.query(
          'SELECT id FROM cc_availability_blocks WHERE feed_id = $1 AND uid = $2',
          [feedId, event.uid]
        );

        if (existingBlock.rows.length > 0) {
          await this.db.query(`
            UPDATE cc_availability_blocks SET
              start_date = $1,
              end_date = $2,
              block_type = $3,
              summary = $4
            WHERE feed_id = $5 AND uid = $6
          `, [event.startDate, event.endDate, event.blockType, event.summary, feedId, event.uid]);
          result.blocksUpdated++;
        } else {
          await this.db.query(`
            INSERT INTO cc_availability_blocks (property_id, feed_id, start_date, end_date, block_type, summary, uid)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [propertyId, feedId, event.startDate, event.endDate, event.blockType, event.summary, event.uid]);
          result.blocksCreated++;
        }
      }

      await this.updateFeedSyncStatus(feedId, 'success');

      result.success = true;
      return result;

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      result.error = message;
      await this.updateFeedSyncStatus(feedId, 'failed', message);
      return result;
    }
  }

  private async updateFeedSyncStatus(
    feedId: number, 
    status: 'success' | 'failed' | 'timeout', 
    error?: string
  ): Promise<void> {
    if (status === 'success') {
      await this.db.query(`
        UPDATE cc_ical_feeds SET
          last_synced_at = CURRENT_TIMESTAMP,
          last_sync_status = $1,
          last_sync_error = NULL,
          total_syncs = total_syncs + 1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [status, feedId]);
    } else {
      await this.db.query(`
        UPDATE cc_ical_feeds SET
          last_synced_at = CURRENT_TIMESTAMP,
          last_sync_status = $1,
          last_sync_error = $2,
          total_syncs = total_syncs + 1,
          failed_syncs = failed_syncs + 1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [status, error, feedId]);
    }
  }

  async syncAllActiveFeeds(): Promise<{ synced: number; failed: number; errors: string[] }> {
    const result = { synced: 0, failed: 0, errors: [] as string[] };

    try {
      const feedsResult = await this.db.query(
        'SELECT id, property_id FROM cc_ical_feeds WHERE is_active = true'
      );

      console.log(`[iCal Sync] Starting sync for ${feedsResult.rows.length} active feeds`);

      for (const feed of feedsResult.rows) {
        const syncResult = await this.syncFeed(feed.id);
        
        if (syncResult.success) {
          result.synced++;
          console.log(`[iCal Sync] Feed ${feed.id}: ${syncResult.eventsFound} cc_events, ${syncResult.blocksCreated} created, ${syncResult.blocksUpdated} updated`);
        } else {
          result.failed++;
          result.errors.push(`Feed ${feed.id}: ${syncResult.error}`);
          console.error(`[iCal Sync] Feed ${feed.id} failed: ${syncResult.error}`);
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`[iCal Sync] Complete: ${result.synced} synced, ${result.failed} failed`);

    } catch (error) {
      console.error('[iCal Sync] Error during bulk sync:', error);
    }

    return result;
  }

  async getAvailabilityBlocks(propertyId: number, days: number = 30): Promise<{ start: string; end: string; type: string }[]> {
    const result = await this.db.query(`
      SELECT start_date, end_date, block_type
      FROM cc_availability_blocks
      WHERE property_id = $1
        AND end_date >= CURRENT_DATE
        AND start_date <= CURRENT_DATE + INTERVAL '1 day' * $2
      ORDER BY start_date
    `, [propertyId, days]);

    return result.rows.map(row => ({
      start: row.start_date,
      end: row.end_date,
      type: row.block_type
    }));
  }
}
