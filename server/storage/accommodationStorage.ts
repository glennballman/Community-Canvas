import { Pool } from 'pg';
import type {
  AccommodationProperty,
  AccommodationHost,
  ICalFeed,
  AvailabilityBlock,
  OutreachCampaign,
  OutreachMessage,
  AccommodationBooking,
  AccommodationStats
} from '../../shared/types/accommodations';

const ALLOWED_PROPERTY_COLUMNS = new Set([
  'airbnb_id', 'booking_id', 'canvas_id', 'name', 'description', 'property_type',
  'municipality_id', 'region', 'city', 'latitude', 'longitude',
  'max_guests', 'bedrooms', 'beds', 'bathrooms',
  'has_parking', 'has_kitchen', 'has_wifi', 'has_washer', 'has_dryer',
  'amenities', 'thumbnail_url', 'images', 'source_url',
  'base_nightly_rate', 'cleaning_fee', 'min_nights',
  'overall_rating', 'review_count', 'crew_score',
  'source', 'status', 'is_verified', 'is_crew_friendly', 'last_scraped_at'
]);

const ALLOWED_HOST_COLUMNS = new Set([
  'name', 'email', 'phone', 'airbnb_host_id', 'airbnb_host_url',
  'is_superhost', 'contact_status', 'is_in_network', 'offers_direct_booking',
  'first_contacted_at', 'last_contacted_at', 'contact_attempts', 'last_response_at', 'notes'
]);

const ALLOWED_BOOKING_COLUMNS = new Set([
  'property_id', 'host_id', 'trip_id', 'trip_name',
  'external_platform', 'external_confirmation',
  'check_in_date', 'check_out_date', 'check_in_time', 'check_out_time',
  'num_guests', 'guest_names', 'primary_guest_name', 'primary_guest_phone',
  'nightly_rate', 'cleaning_fee', 'service_fee', 'taxes', 'total_cost',
  'status', 'payment_status', 'guest_rating', 'guest_review', 'would_book_again',
  'special_requests', 'internal_notes', 'created_by'
]);

function filterAllowedColumns(data: Record<string, any>, allowedColumns: Set<string>): Record<string, any> {
  const filtered: Record<string, any> = {};
  for (const key of Object.keys(data)) {
    if (allowedColumns.has(key) && data[key] !== undefined) {
      filtered[key] = data[key];
    }
  }
  return filtered;
}

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function convertKeysToCamel(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    result[snakeToCamel(key)] = obj[key];
  }
  return result;
}

function convertKeysToSnake(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    result[camelToSnake(key)] = obj[key];
  }
  return result;
}

export class AccommodationStorage {
  constructor(private db: Pool) {}

  // =====================================================
  // PROPERTIES
  // =====================================================

  async getAllProperties(filters?: {
    region?: string;
    city?: string;
    minCrewScore?: number;
    status?: string;
  }): Promise<AccommodationProperty[]> {
    let query = 'SELECT * FROM accommodation_properties WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.region) {
      params.push(filters.region);
      query += ` AND region = $${paramIndex++}`;
    }
    if (filters?.city) {
      params.push(filters.city);
      query += ` AND city ILIKE $${paramIndex++}`;
    }
    if (filters?.minCrewScore) {
      params.push(filters.minCrewScore);
      query += ` AND crew_score >= $${paramIndex++}`;
    }
    if (filters?.status) {
      params.push(filters.status);
      query += ` AND status = $${paramIndex++}`;
    }

    query += ' ORDER BY crew_score DESC, overall_rating DESC';
    const result = await this.db.query(query, params);
    return result.rows.map(convertKeysToCamel) as AccommodationProperty[];
  }

  async getPropertyById(id: number): Promise<AccommodationProperty | null> {
    const result = await this.db.query(
      'SELECT * FROM accommodation_properties WHERE id = $1',
      [id]
    );
    return result.rows[0] ? convertKeysToCamel(result.rows[0]) as AccommodationProperty : null;
  }

  async getPropertyByAirbnbId(airbnbId: string): Promise<AccommodationProperty | null> {
    const result = await this.db.query(
      'SELECT * FROM accommodation_properties WHERE airbnb_id = $1',
      [airbnbId]
    );
    return result.rows[0] ? convertKeysToCamel(result.rows[0]) as AccommodationProperty : null;
  }

  async createProperty(property: Partial<AccommodationProperty>): Promise<AccommodationProperty> {
    const snakeData = convertKeysToSnake(property);
    const filtered = filterAllowedColumns(snakeData, ALLOWED_PROPERTY_COLUMNS);
    const columns = Object.keys(filtered);
    const values = Object.values(filtered);
    const placeholders = columns.map((_, i) => `$${i + 1}`);

    const query = `
      INSERT INTO accommodation_properties (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;
    const result = await this.db.query(query, values);
    return convertKeysToCamel(result.rows[0]) as AccommodationProperty;
  }

  async updateProperty(id: number, updates: Partial<AccommodationProperty>): Promise<AccommodationProperty | null> {
    const snakeData = convertKeysToSnake(updates);
    const filtered = filterAllowedColumns(snakeData, ALLOWED_PROPERTY_COLUMNS);
    const columns = Object.keys(filtered);
    if (columns.length === 0) return this.getPropertyById(id);

    const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
    const values = [...Object.values(filtered), id];

    const query = `
      UPDATE accommodation_properties
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length}
      RETURNING *
    `;
    const result = await this.db.query(query, values);
    return result.rows[0] ? convertKeysToCamel(result.rows[0]) as AccommodationProperty : null;
  }

  async upsertPropertyByAirbnbId(airbnbId: string, data: Partial<AccommodationProperty>): Promise<AccommodationProperty> {
    const existing = await this.getPropertyByAirbnbId(airbnbId);
    if (existing) {
      return (await this.updateProperty(existing.id, data))!;
    }
    return this.createProperty({ ...data, airbnbId });
  }

  async getPropertyStats(): Promise<AccommodationStats> {
    const stats = await this.db.query(`
      SELECT 
        COUNT(*)::int as total_properties,
        COUNT(*) FILTER (WHERE is_crew_friendly = true)::int as crew_friendly,
        COUNT(*) FILTER (WHERE status = 'active')::int as in_network,
        COUNT(DISTINCT p.id) FILTER (WHERE f.id IS NOT NULL)::int as with_ical,
        COALESCE(AVG(crew_score), 0)::float as avg_crew_score,
        COALESCE(AVG(overall_rating), 0)::float as avg_rating,
        COALESCE(AVG(base_nightly_rate), 0)::float as avg_nightly_rate
      FROM accommodation_properties p
      LEFT JOIN ical_feeds f ON f.property_id = p.id
    `);

    const byRegion = await this.db.query(`
      SELECT region, COUNT(*)::int as count 
      FROM accommodation_properties 
      WHERE region IS NOT NULL
      GROUP BY region
    `);

    const byStatus = await this.db.query(`
      SELECT status, COUNT(*)::int as count 
      FROM accommodation_properties 
      GROUP BY status
    `);

    const row = stats.rows[0];
    return {
      totalProperties: row.total_properties,
      crewFriendly: row.crew_friendly,
      inNetwork: row.in_network,
      withIcal: row.with_ical,
      avgCrewScore: row.avg_crew_score,
      avgRating: row.avg_rating,
      avgNightlyRate: row.avg_nightly_rate,
      byRegion: Object.fromEntries(byRegion.rows.map(r => [r.region, r.count])),
      byStatus: Object.fromEntries(byStatus.rows.map(r => [r.status, r.count]))
    };
  }

  // =====================================================
  // HOSTS
  // =====================================================

  async getAllHosts(filters?: { contactStatus?: string; isInNetwork?: boolean }): Promise<AccommodationHost[]> {
    let query = 'SELECT * FROM accommodation_hosts WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.contactStatus) {
      params.push(filters.contactStatus);
      query += ` AND contact_status = $${paramIndex++}`;
    }
    if (filters?.isInNetwork !== undefined) {
      params.push(filters.isInNetwork);
      query += ` AND is_in_network = $${paramIndex++}`;
    }

    query += ' ORDER BY name';
    const result = await this.db.query(query, params);
    return result.rows.map(convertKeysToCamel) as AccommodationHost[];
  }

  async getHostById(id: number): Promise<AccommodationHost | null> {
    const result = await this.db.query('SELECT * FROM accommodation_hosts WHERE id = $1', [id]);
    return result.rows[0] ? convertKeysToCamel(result.rows[0]) as AccommodationHost : null;
  }

  async createHost(host: Partial<AccommodationHost>): Promise<AccommodationHost> {
    const snakeData = convertKeysToSnake(host);
    const filtered = filterAllowedColumns(snakeData, ALLOWED_HOST_COLUMNS);
    const columns = Object.keys(filtered);
    const values = Object.values(filtered);
    const placeholders = columns.map((_, i) => `$${i + 1}`);

    const query = `
      INSERT INTO accommodation_hosts (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;
    const result = await this.db.query(query, values);
    return convertKeysToCamel(result.rows[0]) as AccommodationHost;
  }

  async updateHost(id: number, updates: Partial<AccommodationHost>): Promise<AccommodationHost | null> {
    const snakeData = convertKeysToSnake(updates);
    const filtered = filterAllowedColumns(snakeData, ALLOWED_HOST_COLUMNS);
    const columns = Object.keys(filtered);
    if (columns.length === 0) return this.getHostById(id);

    const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
    const values = [...Object.values(filtered), id];

    const query = `
      UPDATE accommodation_hosts
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length}
      RETURNING *
    `;
    const result = await this.db.query(query, values);
    return result.rows[0] ? convertKeysToCamel(result.rows[0]) as AccommodationHost : null;
  }

  async linkHostToProperty(hostId: number, propertyId: number, isPrimary = true): Promise<void> {
    await this.db.query(`
      INSERT INTO host_properties (host_id, property_id, is_primary_host)
      VALUES ($1, $2, $3)
      ON CONFLICT (host_id, property_id) DO UPDATE SET is_primary_host = $3
    `, [hostId, propertyId, isPrimary]);
  }

  // =====================================================
  // ICAL FEEDS
  // =====================================================

  async getFeedsByPropertyId(propertyId: number): Promise<ICalFeed[]> {
    const result = await this.db.query(
      'SELECT * FROM ical_feeds WHERE property_id = $1 ORDER BY feed_name',
      [propertyId]
    );
    return result.rows.map(convertKeysToCamel) as ICalFeed[];
  }

  async createFeed(feed: Partial<ICalFeed>): Promise<ICalFeed> {
    const result = await this.db.query(`
      INSERT INTO ical_feeds (property_id, host_id, ical_url, feed_name, sync_frequency_minutes)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [feed.propertyId, feed.hostId, feed.icalUrl, feed.feedName, feed.syncFrequencyMinutes || 60]);
    return convertKeysToCamel(result.rows[0]) as ICalFeed;
  }

  async updateFeedSyncStatus(feedId: number, status: string, error?: string): Promise<void> {
    await this.db.query(`
      UPDATE ical_feeds
      SET last_synced_at = CURRENT_TIMESTAMP,
          last_sync_status = $2,
          last_sync_error = $3,
          total_syncs = total_syncs + 1,
          failed_syncs = failed_syncs + CASE WHEN $2 = 'failed' THEN 1 ELSE 0 END
      WHERE id = $1
    `, [feedId, status, error]);
  }

  async getFeedsDueForSync(): Promise<ICalFeed[]> {
    const result = await this.db.query(`
      SELECT * FROM ical_feeds
      WHERE is_active = true
        AND (last_synced_at IS NULL 
             OR last_synced_at < NOW() - INTERVAL '1 minute' * sync_frequency_minutes)
      ORDER BY last_synced_at NULLS FIRST
    `);
    return result.rows.map(convertKeysToCamel) as ICalFeed[];
  }

  // =====================================================
  // AVAILABILITY
  // =====================================================

  async getAvailabilityBlocks(propertyId: number, startDate: Date, endDate: Date): Promise<AvailabilityBlock[]> {
    const result = await this.db.query(`
      SELECT * FROM availability_blocks
      WHERE property_id = $1
        AND start_date <= $3
        AND end_date >= $2
      ORDER BY start_date
    `, [propertyId, startDate, endDate]);
    return result.rows.map(convertKeysToCamel) as AvailabilityBlock[];
  }

  async upsertAvailabilityBlock(block: Partial<AvailabilityBlock>): Promise<AvailabilityBlock> {
    const result = await this.db.query(`
      INSERT INTO availability_blocks (property_id, feed_id, start_date, end_date, block_type, summary, uid)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (property_id, uid) DO UPDATE SET
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        block_type = EXCLUDED.block_type,
        summary = EXCLUDED.summary
      RETURNING *
    `, [block.propertyId, block.feedId, block.startDate, block.endDate, block.blockType || 'booked', block.summary, block.uid]);
    return convertKeysToCamel(result.rows[0]) as AvailabilityBlock;
  }

  async clearBlocksForFeed(feedId: number): Promise<void> {
    await this.db.query('DELETE FROM availability_blocks WHERE feed_id = $1', [feedId]);
  }

  async checkAvailability(propertyId: number, checkIn: Date, checkOut: Date): Promise<boolean> {
    const result = await this.db.query(`
      SELECT COUNT(*) as conflicts
      FROM availability_blocks
      WHERE property_id = $1
        AND start_date < $3
        AND end_date > $2
    `, [propertyId, checkIn, checkOut]);
    return parseInt(result.rows[0].conflicts) === 0;
  }

  // =====================================================
  // BOOKINGS
  // =====================================================

  async getAllBookings(filters?: {
    status?: string;
    propertyId?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<AccommodationBooking[]> {
    let query = `
      SELECT b.*, p.name as property_name, p.city as property_city
      FROM accommodation_bookings b
      LEFT JOIN accommodation_properties p ON b.property_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.status) {
      params.push(filters.status);
      query += ` AND b.status = $${paramIndex++}`;
    }
    if (filters?.propertyId) {
      params.push(filters.propertyId);
      query += ` AND b.property_id = $${paramIndex++}`;
    }
    if (filters?.startDate) {
      params.push(filters.startDate);
      query += ` AND b.check_out_date >= $${paramIndex++}`;
    }
    if (filters?.endDate) {
      params.push(filters.endDate);
      query += ` AND b.check_in_date <= $${paramIndex++}`;
    }

    query += ' ORDER BY b.check_in_date DESC';
    const result = await this.db.query(query, params);
    return result.rows.map(convertKeysToCamel) as AccommodationBooking[];
  }

  async getBookingById(id: number): Promise<AccommodationBooking | null> {
    const result = await this.db.query(`
      SELECT b.*, p.name as property_name, p.city as property_city
      FROM accommodation_bookings b
      LEFT JOIN accommodation_properties p ON b.property_id = p.id
      WHERE b.id = $1
    `, [id]);
    return result.rows[0] ? convertKeysToCamel(result.rows[0]) as AccommodationBooking : null;
  }

  async createBooking(booking: Partial<AccommodationBooking>): Promise<AccommodationBooking> {
    const snakeData = convertKeysToSnake(booking);
    const filtered = filterAllowedColumns(snakeData, ALLOWED_BOOKING_COLUMNS);
    const columns = Object.keys(filtered);
    const values = Object.values(filtered);
    const placeholders = columns.map((_, i) => `$${i + 1}`);

    const query = `
      INSERT INTO accommodation_bookings (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;
    const result = await this.db.query(query, values);
    return convertKeysToCamel(result.rows[0]) as AccommodationBooking;
  }

  async updateBooking(id: number, updates: Partial<AccommodationBooking>): Promise<AccommodationBooking | null> {
    const snakeData = convertKeysToSnake(updates);
    const filtered = filterAllowedColumns(snakeData, ALLOWED_BOOKING_COLUMNS);
    const columns = Object.keys(filtered);
    if (columns.length === 0) return this.getBookingById(id);

    const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
    const values = [...Object.values(filtered), id];

    const query = `
      UPDATE accommodation_bookings
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length}
      RETURNING *
    `;
    const result = await this.db.query(query, values);
    return result.rows[0] ? convertKeysToCamel(result.rows[0]) as AccommodationBooking : null;
  }

  // =====================================================
  // OUTREACH
  // =====================================================

  async getCampaigns(): Promise<OutreachCampaign[]> {
    const result = await this.db.query('SELECT * FROM outreach_campaigns ORDER BY created_at DESC');
    return result.rows.map(convertKeysToCamel) as OutreachCampaign[];
  }

  async createCampaign(campaign: Partial<OutreachCampaign>): Promise<OutreachCampaign> {
    const result = await this.db.query(`
      INSERT INTO outreach_campaigns (name, description, target_region, target_cities, target_min_crew_score, template_id, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      campaign.name,
      campaign.description,
      campaign.targetRegion,
      campaign.targetCities,
      campaign.targetMinCrewScore || 50,
      campaign.templateId,
      campaign.status || 'draft'
    ]);
    return convertKeysToCamel(result.rows[0]) as OutreachCampaign;
  }

  async getMessagesForCampaign(campaignId: number): Promise<OutreachMessage[]> {
    const result = await this.db.query(
      'SELECT * FROM outreach_messages WHERE campaign_id = $1 ORDER BY created_at DESC',
      [campaignId]
    );
    return result.rows.map(convertKeysToCamel) as OutreachMessage[];
  }

  async createOutreachMessage(message: Partial<OutreachMessage>): Promise<OutreachMessage> {
    const result = await this.db.query(`
      INSERT INTO outreach_messages (campaign_id, host_id, property_id, channel, subject, message_body, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      message.campaignId,
      message.hostId,
      message.propertyId,
      message.channel,
      message.subject,
      message.messageBody,
      message.status || 'pending'
    ]);
    return convertKeysToCamel(result.rows[0]) as OutreachMessage;
  }

  async updateMessageStatus(messageId: number, status: string, responseText?: string): Promise<void> {
    const updates: string[] = ['status = $2'];
    const params: any[] = [messageId, status];
    let paramIndex = 3;

    if (status === 'sent') {
      updates.push('sent_at = CURRENT_TIMESTAMP');
    } else if (status === 'delivered') {
      updates.push('delivered_at = CURRENT_TIMESTAMP');
    } else if (status === 'opened') {
      updates.push('opened_at = CURRENT_TIMESTAMP');
    } else if (status === 'responded' && responseText) {
      updates.push('responded_at = CURRENT_TIMESTAMP');
      updates.push(`response_text = $${paramIndex++}`);
      params.push(responseText);
    }

    await this.db.query(`
      UPDATE outreach_messages
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, params);
  }
}
