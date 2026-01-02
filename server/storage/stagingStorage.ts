import { db, pool } from '../db';
import { sql } from 'drizzle-orm';
import type {
  StagingProperty,
  StagingSpot,
  ServiceProvider,
  StagingBooking,
  VehicleProfile,
  StagingSearchParams,
  StagingStats,
  PropertyAvailability,
} from '@shared/types/staging';

function snakeToCamel(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = obj[key];
  }
  return result;
}

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function buildSetClause(data: Record<string, any>): { clause: string; values: any[] } {
  const entries = Object.entries(data).filter(([_, v]) => v !== undefined);
  const clause = entries.map(([k], i) => `${camelToSnake(k)} = $${i + 1}`).join(', ');
  const values = entries.map(([_, v]) => v);
  return { clause, values };
}

// ============================================================================
// PROPERTIES
// ============================================================================

export interface PropertyFilters {
  status?: string;
  propertyType?: string;
  region?: string;
  city?: string;
  isVerified?: boolean;
  hasOnsiteMechanic?: boolean;
  isHorseFriendly?: boolean;
  acceptsSemiTrucks?: boolean;
  limit?: number;
  offset?: number;
}

export async function getAllProperties(filters: PropertyFilters = {}): Promise<StagingProperty[]> {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  if (filters.status) {
    conditions.push(`sp.status = $${paramIdx++}`);
    params.push(filters.status);
  }
  if (filters.propertyType) {
    conditions.push(`sp.property_type = $${paramIdx++}`);
    params.push(filters.propertyType);
  }
  if (filters.region) {
    conditions.push(`sp.region = $${paramIdx++}`);
    params.push(filters.region);
  }
  if (filters.city) {
    conditions.push(`sp.city ILIKE $${paramIdx++}`);
    params.push(`%${filters.city}%`);
  }
  if (filters.isVerified !== undefined) {
    conditions.push(`sp.is_verified = $${paramIdx++}`);
    params.push(filters.isVerified);
  }
  if (filters.hasOnsiteMechanic) {
    conditions.push(`sp.has_onsite_mechanic = true`);
  }
  if (filters.isHorseFriendly) {
    conditions.push(`sp.is_horse_friendly = true`);
  }
  if (filters.acceptsSemiTrucks) {
    conditions.push(`sp.accepts_semi_trucks = true`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  const query = `
    SELECT sp.*, 
           pr.nightly_rate as base_nightly_rate,
           pr.weekly_rate as base_weekly_rate,
           pr.monthly_rate as base_monthly_rate
    FROM staging_properties sp
    LEFT JOIN staging_pricing pr ON pr.property_id = sp.id 
      AND pr.pricing_type = 'base_nightly' AND pr.is_active = true
    ${whereClause}
    ORDER BY sp.crew_score DESC, sp.updated_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const result = await db.execute(sql.raw(query.replace(/\$(\d+)/g, (_, n) => `$${n}`)));
  
  if (params.length > 0) {
    const paramQuery = query.replace(/\$(\d+)/g, (_, n) => {
      const val = params[parseInt(n) - 1];
      if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
      if (typeof val === 'boolean') return val ? 'true' : 'false';
      return String(val);
    });
    const res = await db.execute(sql.raw(paramQuery));
    return (res.rows as any[]).map(row => snakeToCamel(row) as StagingProperty);
  }

  return (result.rows as any[]).map(row => snakeToCamel(row) as StagingProperty);
}

export async function getPropertyById(id: number): Promise<StagingProperty | null> {
  const result = await db.execute(sql`
    SELECT sp.*, 
           pr.nightly_rate as base_nightly_rate,
           pr.weekly_rate as base_weekly_rate,
           pr.monthly_rate as base_monthly_rate
    FROM staging_properties sp
    LEFT JOIN staging_pricing pr ON pr.property_id = sp.id 
      AND pr.pricing_type = 'base_nightly' AND pr.is_active = true
    WHERE sp.id = ${id}
  `);
  
  if (result.rows.length === 0) return null;
  return snakeToCamel(result.rows[0] as Record<string, any>) as StagingProperty;
}

export async function getPropertyByCanvasId(canvasId: string): Promise<StagingProperty | null> {
  const result = await db.execute(sql`
    SELECT sp.*, 
           pr.nightly_rate as base_nightly_rate,
           pr.weekly_rate as base_weekly_rate,
           pr.monthly_rate as base_monthly_rate
    FROM staging_properties sp
    LEFT JOIN staging_pricing pr ON pr.property_id = sp.id 
      AND pr.pricing_type = 'base_nightly' AND pr.is_active = true
    WHERE sp.canvas_id = ${canvasId}
  `);
  
  if (result.rows.length === 0) return null;
  return snakeToCamel(result.rows[0] as Record<string, any>) as StagingProperty;
}

export async function createProperty(data: Partial<StagingProperty>): Promise<StagingProperty> {
  const columns: string[] = [];
  const values: any[] = [];
  const placeholders: string[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && key !== 'id' && key !== 'canvasId') {
      columns.push(camelToSnake(key));
      values.push(value);
      placeholders.push(`$${idx++}`);
    }
  }

  const query = `
    INSERT INTO staging_properties (${columns.join(', ')})
    VALUES (${placeholders.join(', ')})
    RETURNING *
  `;

  const paramQuery = query.replace(/\$(\d+)/g, (_, n) => {
    const val = values[parseInt(n) - 1];
    if (val === null) return 'NULL';
    if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    if (Array.isArray(val)) return `ARRAY[${val.map(v => typeof v === 'string' ? `'${v}'` : v).join(',')}]`;
    return String(val);
  });

  const result = await db.execute(sql.raw(paramQuery));
  return snakeToCamel(result.rows[0] as Record<string, any>) as StagingProperty;
}

export async function updateProperty(id: number, data: Partial<StagingProperty>): Promise<StagingProperty | null> {
  const updates: string[] = [];
  const values: any[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && key !== 'id' && key !== 'canvasId') {
      updates.push(`${camelToSnake(key)} = $${idx++}`);
      values.push(value);
    }
  }

  if (updates.length === 0) return getPropertyById(id);

  const query = `
    UPDATE staging_properties 
    SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = $${idx}
    RETURNING *
  `;
  values.push(id);

  const paramQuery = query.replace(/\$(\d+)/g, (_, n) => {
    const val = values[parseInt(n) - 1];
    if (val === null) return 'NULL';
    if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    if (Array.isArray(val)) return `ARRAY[${val.map(v => typeof v === 'string' ? `'${v}'` : v).join(',')}]`;
    return String(val);
  });

  const result = await db.execute(sql.raw(paramQuery));
  if (result.rows.length === 0) return null;
  return snakeToCamel(result.rows[0] as Record<string, any>) as StagingProperty;
}

export async function searchAvailableProperties(params: StagingSearchParams): Promise<StagingProperty[]> {
  const result = await db.execute(sql`
    SELECT * FROM find_available_staging(
      ${params.checkIn || null}::date,
      ${params.checkOut || null}::date,
      ${params.vehicleLengthFt || null}::integer,
      ${params.needsPower || false}::boolean,
      ${params.powerAmps || null}::integer,
      ${params.needsWater || false}::boolean,
      ${params.needsSewer || false}::boolean,
      ${params.needsPullThrough || false}::boolean,
      ${params.isHorseFriendly || false}::boolean,
      ${params.acceptsSemi || false}::boolean,
      ${params.hasMechanic || false}::boolean,
      ${params.dogsAllowed || false}::boolean,
      ${params.region || null}::varchar,
      ${params.city || null}::varchar,
      ${params.propertyType || null}::varchar,
      ${params.maxNightlyRate || null}::decimal,
      ${params.sortBy || 'rv_score'}::varchar,
      ${params.limit || 50}::integer,
      ${params.offset || 0}::integer,
      ${params.hasWifi || false}::boolean,
      ${params.hasShowers || false}::boolean,
      ${params.hasLaundry || false}::boolean
    )
  `);

  return (result.rows as any[]).map(row => snakeToCamel(row) as StagingProperty);
}

// ============================================================================
// SPOTS
// ============================================================================

export async function getSpotsForProperty(propertyId: number): Promise<StagingSpot[]> {
  const result = await db.execute(sql`
    SELECT * FROM staging_spots
    WHERE property_id = ${propertyId}
    ORDER BY spot_number
  `);
  return (result.rows as any[]).map(row => snakeToCamel(row) as StagingSpot);
}

export async function getSpotById(id: number): Promise<StagingSpot | null> {
  const result = await db.execute(sql`
    SELECT * FROM staging_spots WHERE id = ${id}
  `);
  if (result.rows.length === 0) return null;
  return snakeToCamel(result.rows[0] as Record<string, any>) as StagingSpot;
}

export async function createSpot(data: Partial<StagingSpot>): Promise<StagingSpot> {
  const columns: string[] = [];
  const placeholders: string[] = [];
  const values: any[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && key !== 'id') {
      columns.push(camelToSnake(key));
      values.push(value);
      placeholders.push(`$${idx++}`);
    }
  }

  const query = `
    INSERT INTO staging_spots (${columns.join(', ')})
    VALUES (${placeholders.join(', ')})
    RETURNING *
  `;

  const paramQuery = query.replace(/\$(\d+)/g, (_, n) => {
    const val = values[parseInt(n) - 1];
    if (val === null) return 'NULL';
    if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    return String(val);
  });

  const result = await db.execute(sql.raw(paramQuery));
  return snakeToCamel(result.rows[0] as Record<string, any>) as StagingSpot;
}

export async function updateSpot(id: number, data: Partial<StagingSpot>): Promise<StagingSpot | null> {
  const updates: string[] = [];
  const values: any[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && key !== 'id') {
      updates.push(`${camelToSnake(key)} = $${idx++}`);
      values.push(value);
    }
  }

  if (updates.length === 0) return getSpotById(id);

  const query = `
    UPDATE staging_spots 
    SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = $${idx}
    RETURNING *
  `;
  values.push(id);

  const paramQuery = query.replace(/\$(\d+)/g, (_, n) => {
    const val = values[parseInt(n) - 1];
    if (val === null) return 'NULL';
    if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    return String(val);
  });

  const result = await db.execute(sql.raw(paramQuery));
  if (result.rows.length === 0) return null;
  return snakeToCamel(result.rows[0] as Record<string, any>) as StagingSpot;
}

// ============================================================================
// SERVICE PROVIDERS
// ============================================================================

export interface ProviderFilters {
  propertyId?: number;
  providerType?: string;
  isActive?: boolean;
  available24hr?: boolean;
  limit?: number;
  offset?: number;
}

export async function getProvidersForProperty(propertyId: number): Promise<ServiceProvider[]> {
  const result = await db.execute(sql`
    SELECT * FROM staging_service_providers
    WHERE property_id = ${propertyId} AND is_active = true
    ORDER BY provider_type, business_name
  `);
  return (result.rows as any[]).map(row => snakeToCamel(row) as ServiceProvider);
}

export async function getProviderById(id: number): Promise<ServiceProvider | null> {
  const result = await db.execute(sql`
    SELECT * FROM staging_service_providers WHERE id = ${id}
  `);
  if (result.rows.length === 0) return null;
  return snakeToCamel(result.rows[0] as Record<string, any>) as ServiceProvider;
}

export async function createProvider(data: Partial<ServiceProvider>): Promise<ServiceProvider> {
  const columns: string[] = [];
  const placeholders: string[] = [];
  const values: any[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && key !== 'id') {
      columns.push(camelToSnake(key));
      // Keep arrays as arrays, not JSON strings
      values.push(value);
      placeholders.push(`$${idx++}`);
    }
  }

  const query = `
    INSERT INTO staging_service_providers (${columns.join(', ')})
    VALUES (${placeholders.join(', ')})
    RETURNING *
  `;

  const paramQuery = query.replace(/\$(\d+)/g, (_, n) => {
    const val = values[parseInt(n) - 1];
    if (val === null) return 'NULL';
    // Handle arrays - convert to PostgreSQL array format using single quotes
    if (Array.isArray(val)) {
      const escaped = val.map(v => `'${String(v).replace(/'/g, "''")}'`);
      return `ARRAY[${escaped.join(',')}]::text[]`;
    }
    if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    return String(val);
  });

  const result = await db.execute(sql.raw(paramQuery));
  return snakeToCamel(result.rows[0] as Record<string, any>) as ServiceProvider;
}

export async function updateProvider(id: number, data: Partial<ServiceProvider>): Promise<ServiceProvider | null> {
  const updates: string[] = [];
  const values: any[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && key !== 'id') {
      updates.push(`${camelToSnake(key)} = $${idx++}`);
      // Keep arrays as arrays, not JSON strings
      values.push(value);
    }
  }

  if (updates.length === 0) return getProviderById(id);

  const query = `
    UPDATE staging_service_providers 
    SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = $${idx}
    RETURNING *
  `;
  values.push(id);

  const paramQuery = query.replace(/\$(\d+)/g, (_, n) => {
    const val = values[parseInt(n) - 1];
    if (val === null) return 'NULL';
    // Handle arrays - convert to PostgreSQL array format using single quotes
    if (Array.isArray(val)) {
      const escaped = val.map(v => `'${String(v).replace(/'/g, "''")}'`);
      return `ARRAY[${escaped.join(',')}]::text[]`;
    }
    if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    return String(val);
  });

  const result = await db.execute(sql.raw(paramQuery));
  if (result.rows.length === 0) return null;
  return snakeToCamel(result.rows[0] as Record<string, any>) as ServiceProvider;
}

export async function searchProviders(filters: ProviderFilters = {}): Promise<ServiceProvider[]> {
  const conditions: string[] = [];
  
  if (filters.propertyId) {
    conditions.push(`property_id = ${filters.propertyId}`);
  }
  if (filters.providerType) {
    conditions.push(`provider_type = '${filters.providerType}'`);
  }
  if (filters.isActive !== undefined) {
    conditions.push(`is_active = ${filters.isActive}`);
  }
  if (filters.available24hr) {
    conditions.push(`available_24hr = true`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  const result = await db.execute(sql.raw(`
    SELECT * FROM staging_service_providers
    ${whereClause}
    ORDER BY overall_rating DESC NULLS LAST, business_name
    LIMIT ${limit} OFFSET ${offset}
  `));

  return (result.rows as any[]).map(row => snakeToCamel(row) as ServiceProvider);
}

// ============================================================================
// BOOKINGS
// ============================================================================

export interface BookingFilters {
  propertyId?: number;
  status?: string;
  guestEmail?: string;
  checkInFrom?: string;
  checkInTo?: string;
  limit?: number;
  offset?: number;
}

export async function getBookings(filters: BookingFilters = {}): Promise<StagingBooking[]> {
  const conditions: string[] = [];
  
  if (filters.propertyId) {
    conditions.push(`b.property_id = ${filters.propertyId}`);
  }
  if (filters.status) {
    conditions.push(`b.status = '${filters.status}'`);
  }
  if (filters.guestEmail) {
    conditions.push(`b.guest_email = '${filters.guestEmail}'`);
  }
  if (filters.checkInFrom) {
    conditions.push(`b.check_in_date >= '${filters.checkInFrom}'`);
  }
  if (filters.checkInTo) {
    conditions.push(`b.check_in_date <= '${filters.checkInTo}'`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  const result = await db.execute(sql.raw(`
    SELECT b.*, 
           sp.name as property_name, sp.canvas_id as property_canvas_id,
           ss.spot_number, ss.spot_name
    FROM staging_bookings b
    LEFT JOIN staging_properties sp ON sp.id = b.property_id
    LEFT JOIN staging_spots ss ON ss.id = b.spot_id
    ${whereClause}
    ORDER BY b.check_in_date DESC
    LIMIT ${limit} OFFSET ${offset}
  `));

  return (result.rows as any[]).map(row => snakeToCamel(row) as StagingBooking);
}

export async function getBookingById(id: number): Promise<StagingBooking | null> {
  const result = await db.execute(sql`
    SELECT b.*, 
           sp.name as property_name, sp.canvas_id as property_canvas_id,
           ss.spot_number, ss.spot_name
    FROM staging_bookings b
    LEFT JOIN staging_properties sp ON sp.id = b.property_id
    LEFT JOIN staging_spots ss ON ss.id = b.spot_id
    WHERE b.id = ${id}
  `);
  if (result.rows.length === 0) return null;
  return snakeToCamel(result.rows[0] as Record<string, any>) as StagingBooking;
}

export async function getBookingByRef(ref: string): Promise<StagingBooking | null> {
  const result = await db.execute(sql`
    SELECT b.*, 
           sp.name as property_name, sp.canvas_id as property_canvas_id,
           ss.spot_number, ss.spot_name
    FROM staging_bookings b
    LEFT JOIN staging_properties sp ON sp.id = b.property_id
    LEFT JOIN staging_spots ss ON ss.id = b.spot_id
    WHERE b.booking_ref = ${ref}
  `);
  if (result.rows.length === 0) return null;
  return snakeToCamel(result.rows[0] as Record<string, any>) as StagingBooking;
}

export async function createBooking(data: Partial<StagingBooking>): Promise<StagingBooking> {
  const columns: string[] = [];
  const placeholders: string[] = [];
  const values: any[] = [];
  let idx = 1;

  // Exclude generated columns like numNights
  const excludedColumns = ['id', 'bookingRef', 'numNights'];
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && !excludedColumns.includes(key)) {
      columns.push(camelToSnake(key));
      values.push(value);
      placeholders.push(`$${idx++}`);
    }
  }

  const query = `
    INSERT INTO staging_bookings (${columns.join(', ')})
    VALUES (${placeholders.join(', ')})
    RETURNING *
  `;

  const paramQuery = query.replace(/\$(\d+)/g, (_, n) => {
    const val = values[parseInt(n) - 1];
    if (val === null) return 'NULL';
    if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    return String(val);
  });

  const result = await db.execute(sql.raw(paramQuery));
  return snakeToCamel(result.rows[0] as Record<string, any>) as StagingBooking;
}

export async function updateBooking(id: number, data: Partial<StagingBooking>): Promise<StagingBooking | null> {
  const updates: string[] = [];
  const values: any[] = [];
  let idx = 1;

  // Exclude generated columns like numNights
  const excludedColumns = ['id', 'bookingRef', 'numNights'];
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && !excludedColumns.includes(key)) {
      updates.push(`${camelToSnake(key)} = $${idx++}`);
      values.push(value);
    }
  }

  if (updates.length === 0) return getBookingById(id);

  const query = `
    UPDATE staging_bookings 
    SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = $${idx}
    RETURNING *
  `;
  values.push(id);

  const paramQuery = query.replace(/\$(\d+)/g, (_, n) => {
    const val = values[parseInt(n) - 1];
    if (val === null) return 'NULL';
    if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    return String(val);
  });

  const result = await db.execute(sql.raw(paramQuery));
  if (result.rows.length === 0) return null;
  return snakeToCamel(result.rows[0] as Record<string, any>) as StagingBooking;
}

export async function findBookingByIdOrRef(idOrRef: string): Promise<StagingBooking | null> {
  const numericId = parseInt(idOrRef, 10);
  
  const result = await db.execute(sql`
    SELECT * FROM staging_bookings 
    WHERE id = ${isNaN(numericId) ? -1 : numericId} 
       OR booking_ref = ${idOrRef}
    LIMIT 1
  `);
  
  if (result.rows.length === 0) return null;
  return snakeToCamel(result.rows[0] as Record<string, any>) as StagingBooking;
}

export async function cancelBooking(id: number, reason?: string): Promise<StagingBooking | null> {
  const result = await db.execute(sql`
    UPDATE staging_bookings 
    SET status = 'cancelled', 
        cancellation_reason = ${reason || null},
        cancelled_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
    RETURNING *
  `);
  if (result.rows.length === 0) return null;
  return snakeToCamel(result.rows[0] as Record<string, any>) as StagingBooking;
}

// ============================================================================
// CALENDAR
// ============================================================================

export interface CalendarBlock {
  id: number;
  propertyId: number;
  spotId?: number;
  startDate: string;
  endDate: string;
  blockType: string;
  bookingId?: number;
  notes?: string;
}

export async function getCalendar(propertyId: number, startDate: string, endDate: string): Promise<CalendarBlock[]> {
  const result = await db.execute(sql`
    SELECT * FROM staging_calendar_blocks
    WHERE property_id = ${propertyId}
      AND start_date <= ${endDate}::date
      AND end_date >= ${startDate}::date
    ORDER BY start_date
  `);
  return (result.rows as any[]).map(row => snakeToCamel(row) as CalendarBlock);
}

export async function createBlock(data: Partial<CalendarBlock>): Promise<CalendarBlock> {
  const result = await db.execute(sql`
    INSERT INTO staging_calendar_blocks (property_id, spot_id, start_date, end_date, block_type, booking_id, notes)
    VALUES (${data.propertyId}, ${data.spotId || null}, ${data.startDate}, ${data.endDate}, ${data.blockType || 'blocked'}, ${data.bookingId || null}, ${data.notes || null})
    RETURNING *
  `);
  return snakeToCamel(result.rows[0] as Record<string, any>) as CalendarBlock;
}

export async function updateBlock(id: number, data: Partial<CalendarBlock>): Promise<CalendarBlock | null> {
  const updates: string[] = [];
  
  if (data.startDate) updates.push(`start_date = '${data.startDate}'`);
  if (data.endDate) updates.push(`end_date = '${data.endDate}'`);
  if (data.blockType) updates.push(`block_type = '${data.blockType}'`);
  if (data.notes !== undefined) updates.push(`notes = ${data.notes ? `'${data.notes}'` : 'NULL'}`);

  if (updates.length === 0) {
    const existing = await db.execute(sql`SELECT * FROM staging_calendar_blocks WHERE id = ${id}`);
    if (existing.rows.length === 0) return null;
    return snakeToCamel(existing.rows[0] as Record<string, any>) as CalendarBlock;
  }

  const result = await db.execute(sql.raw(`
    UPDATE staging_calendar_blocks 
    SET ${updates.join(', ')}
    WHERE id = ${id}
    RETURNING *
  `));
  if (result.rows.length === 0) return null;
  return snakeToCamel(result.rows[0] as Record<string, any>) as CalendarBlock;
}

export async function deleteBlock(id: number): Promise<boolean> {
  const result = await db.execute(sql`
    DELETE FROM staging_calendar_blocks WHERE id = ${id}
  `);
  return (result.rowCount ?? 0) > 0;
}

export async function checkAvailability(
  propertyId: number, 
  checkIn: string, 
  checkOut: string, 
  vehicleLengthFt?: number
): Promise<PropertyAvailability> {
  const blocksResult = await db.execute(sql`
    SELECT start_date, end_date FROM staging_calendar_blocks
    WHERE property_id = ${propertyId}
      AND spot_id IS NULL
      AND start_date < ${checkOut}::date
      AND end_date > ${checkIn}::date
  `);

  const propertyResult = await db.execute(sql`
    SELECT sp.*, pr.nightly_rate
    FROM staging_properties sp
    LEFT JOIN staging_pricing pr ON pr.property_id = sp.id 
      AND pr.pricing_type = 'base_nightly' AND pr.is_active = true
    WHERE sp.id = ${propertyId}
  `);

  const property = propertyResult.rows[0] as any;
  const blockedDates = (blocksResult.rows as any[]).flatMap(row => {
    const dates: string[] = [];
    const start = new Date(row.start_date);
    const end = new Date(row.end_date);
    for (let d = start; d < end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  });

  const numNights = Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24));
  const nightly = Number(property?.nightly_rate) || 0;

  let vehicleFits = true;
  if (vehicleLengthFt && property?.max_combined_length_ft) {
    vehicleFits = vehicleLengthFt <= property.max_combined_length_ft;
  }

  return {
    propertyId,
    checkIn,
    checkOut,
    isAvailable: blocksResult.rows.length === 0 && vehicleFits,
    availableSpots: property?.total_spots || 0,
    blockedDates,
    pricing: {
      nightly,
      total: nightly * numNights,
      fees: {}
    }
  };
}

// ============================================================================
// VEHICLE PROFILES
// ============================================================================

export async function getVehicleProfiles(hostAccountId: number): Promise<VehicleProfile[]> {
  const result = await db.execute(sql`
    SELECT * FROM staging_vehicle_profiles
    WHERE host_account_id = ${hostAccountId}
    ORDER BY name
  `);
  return (result.rows as any[]).map(row => snakeToCamel(row) as VehicleProfile);
}

export async function createVehicleProfile(data: Partial<VehicleProfile>): Promise<VehicleProfile> {
  const columns: string[] = [];
  const placeholders: string[] = [];
  const values: any[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && key !== 'id') {
      columns.push(camelToSnake(key));
      values.push(Array.isArray(value) ? JSON.stringify(value) : value);
      placeholders.push(`$${idx++}`);
    }
  }

  const query = `
    INSERT INTO staging_vehicle_profiles (${columns.join(', ')})
    VALUES (${placeholders.join(', ')})
    RETURNING *
  `;

  const paramQuery = query.replace(/\$(\d+)/g, (_, n) => {
    const val = values[parseInt(n) - 1];
    if (val === null) return 'NULL';
    if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    return String(val);
  });

  const result = await db.execute(sql.raw(paramQuery));
  return snakeToCamel(result.rows[0] as Record<string, any>) as VehicleProfile;
}

export async function updateVehicleProfile(id: number, data: Partial<VehicleProfile>): Promise<VehicleProfile | null> {
  const updates: string[] = [];
  const values: any[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && key !== 'id') {
      updates.push(`${camelToSnake(key)} = $${idx++}`);
      values.push(Array.isArray(value) ? JSON.stringify(value) : value);
    }
  }

  if (updates.length === 0) {
    const existing = await db.execute(sql`SELECT * FROM staging_vehicle_profiles WHERE id = ${id}`);
    if (existing.rows.length === 0) return null;
    return snakeToCamel(existing.rows[0] as Record<string, any>) as VehicleProfile;
  }

  const query = `
    UPDATE staging_vehicle_profiles 
    SET ${updates.join(', ')}
    WHERE id = $${idx}
    RETURNING *
  `;
  values.push(id);

  const paramQuery = query.replace(/\$(\d+)/g, (_, n) => {
    const val = values[parseInt(n) - 1];
    if (val === null) return 'NULL';
    if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    return String(val);
  });

  const result = await db.execute(sql.raw(paramQuery));
  if (result.rows.length === 0) return null;
  return snakeToCamel(result.rows[0] as Record<string, any>) as VehicleProfile;
}

// ============================================================================
// PRICING
// ============================================================================

export interface PricingRecord {
  id: number;
  propertyId: number;
  spotId?: number;
  pricingType: string;
  nightlyRate?: number;
  weeklyRate?: number;
  monthlyRate?: number;
  seasonName?: string;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
}

export async function getPricingForProperty(propertyId: number): Promise<PricingRecord[]> {
  const result = await db.execute(sql`
    SELECT * FROM staging_pricing
    WHERE property_id = ${propertyId}
    ORDER BY pricing_type, start_date NULLS FIRST
  `);
  return (result.rows as any[]).map(row => snakeToCamel(row) as PricingRecord);
}

export interface PriceCalculationOptions {
  spotId?: number;
  vehicleLengthFt?: number;
  numAdults?: number;
  numPets?: number;
}

export async function calculatePrice(
  propertyId: number, 
  checkIn: string, 
  checkOut: string, 
  options: PriceCalculationOptions = {}
): Promise<{ nightly: number; subtotal: number; fees: Record<string, number>; total: number }> {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const numNights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

  const pricingResult = await db.execute(sql`
    SELECT * FROM staging_pricing
    WHERE property_id = ${propertyId}
      AND is_active = true
      AND (spot_id IS NULL OR spot_id = ${options.spotId || null})
    ORDER BY 
      CASE WHEN pricing_type = 'seasonal' AND start_date <= ${checkIn}::date AND end_date >= ${checkIn}::date THEN 0 ELSE 1 END,
      pricing_type
  `);

  let nightly = 0;
  const pricing = pricingResult.rows as any[];
  
  const seasonal = pricing.find(p => 
    p.pricing_type === 'seasonal' && 
    p.start_date <= checkIn && 
    p.end_date >= checkIn
  );
  
  if (seasonal) {
    nightly = Number(seasonal.nightly_rate) || 0;
  } else {
    const base = pricing.find(p => p.pricing_type === 'base_nightly');
    nightly = Number(base?.nightly_rate) || 0;
  }

  const subtotal = nightly * numNights;
  const fees: Record<string, number> = {};

  const propertyResult = await db.execute(sql`
    SELECT pet_fee_per_night FROM staging_properties WHERE id = ${propertyId}
  `);
  const property = propertyResult.rows[0] as any;

  if (options.numPets && options.numPets > 0 && property?.pet_fee_per_night) {
    fees['Pet Fee'] = Number(property.pet_fee_per_night) * options.numPets * numNights;
  }

  const totalFees = Object.values(fees).reduce((sum, fee) => sum + fee, 0);

  return {
    nights: numNights,
    nightly,
    subtotal,
    fees,
    total: subtotal + totalFees
  };
}

// ============================================================================
// STATS
// ============================================================================

export async function getOverallStats(): Promise<StagingStats> {
  const result = await db.execute(sql`
    SELECT 
      COUNT(*) as total_properties,
      COUNT(*) FILTER (WHERE status = 'active') as active_properties,
      COALESCE(SUM(total_spots), 0) as total_spots,
      COUNT(*) FILTER (WHERE has_onsite_mechanic = true) as with_mechanic,
      COUNT(*) FILTER (WHERE is_horse_friendly = true) as horse_friendly,
      COUNT(*) FILTER (WHERE accepts_semi_trucks = true) as accepts_semi,
      ROUND(AVG(crew_score)::numeric, 1) as avg_crew_score,
      ROUND(AVG(rv_score)::numeric, 1) as avg_rv_score
    FROM staging_properties
  `);

  const byTypeResult = await db.execute(sql`
    SELECT property_type, COUNT(*) as count
    FROM staging_properties
    GROUP BY property_type
  `);

  const byRegionResult = await db.execute(sql`
    SELECT region, COUNT(*) as count
    FROM staging_properties
    WHERE region IS NOT NULL
    GROUP BY region
    ORDER BY count DESC
  `);

  const stats = result.rows[0] as any;
  const byType: Record<string, number> = {};
  const byRegion: Record<string, number> = {};

  for (const row of byTypeResult.rows as any[]) {
    byType[row.property_type] = Number(row.count);
  }

  for (const row of byRegionResult.rows as any[]) {
    byRegion[row.region] = Number(row.count);
  }

  return {
    totalProperties: Number(stats.total_properties),
    activeProperties: Number(stats.active_properties),
    totalSpots: Number(stats.total_spots),
    byType: byType as any,
    byRegion,
    withMechanic: Number(stats.with_mechanic),
    horseFriendly: Number(stats.horse_friendly),
    acceptsSemi: Number(stats.accepts_semi),
    avgCrewScore: Number(stats.avg_crew_score) || 0,
    avgRvScore: Number(stats.avg_rv_score) || 0,
  };
}

export async function getPropertyStats(propertyId: number): Promise<{
  totalBookings: number;
  upcomingBookings: number;
  totalRevenue: number;
  occupancyRate: number;
  avgRating: number;
}> {
  const bookingStats = await db.execute(sql`
    SELECT 
      COUNT(*) as total_bookings,
      COUNT(*) FILTER (WHERE check_in_date > CURRENT_DATE AND status != 'cancelled') as upcoming_bookings,
      COALESCE(SUM(total_cost) FILTER (WHERE payment_status = 'paid'), 0) as total_revenue
    FROM staging_bookings
    WHERE property_id = ${propertyId}
  `);

  const propertyResult = await db.execute(sql`
    SELECT overall_rating FROM staging_properties WHERE id = ${propertyId}
  `);

  const stats = bookingStats.rows[0] as any;
  const property = propertyResult.rows[0] as any;

  return {
    totalBookings: Number(stats.total_bookings),
    upcomingBookings: Number(stats.upcoming_bookings),
    totalRevenue: Number(stats.total_revenue),
    occupancyRate: 0,
    avgRating: Number(property?.overall_rating) || 0,
  };
}

// ============================================================================
// RAW QUERY HELPER
// ============================================================================

export async function rawQuery(query: string, params: any[] = []): Promise<{ rows: any[] }> {
  const result = await pool.query(query, params);
  return { rows: result.rows };
}
