// server/services/apifySync.ts
// Sync service compatible with V2 cc_external_records schema
// Supports Apify API and local JSON file streaming

import { createReadStream } from 'fs';
import crypto from 'crypto';
import { pool } from '../db';

// Lazy-loaded dependencies
let ApifyClient: any;
let parser: any;
let streamArray: any;

// =====================================================================
// TYPES
// =====================================================================

interface DatasetConfig {
    id: string;
    slug: string;
    source: string;
    record_type: string;
    region: string | null;
    apify_actor_id: string;
    apify_dataset_id: string | null;
}

interface SyncResult {
    success: boolean;
    recordsProcessed: number;
    recordsInserted: number;
    recordsUpdated: number;
    recordsSkipped: number;
    recordsErrored: number;
    entitiesCreated: number;
    durationSeconds: number;
    error?: string;
}

// =====================================================================
// HELPERS
// =====================================================================

function md5(data: any): string {
    return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
}

function getNested(obj: any, path: string): any {
    return path.split('.').reduce((cur, key) => cur?.[key], obj);
}

function extractCoordinates(data: any): { lat: number | null; lng: number | null } {
    const formats = [
        { lat: 'coordinates.lat', lng: 'coordinates.lng' },
        { lat: 'coordinates.latitude', lng: 'coordinates.longitude' },
        { lat: 'location.lat', lng: 'location.lng' },
        { lat: 'lat', lng: 'lng' },
        { lat: 'latitude', lng: 'longitude' },
        { lat: 'geoLocation.lat', lng: 'geoLocation.lng' },
    ];
    
    for (const f of formats) {
        const lat = getNested(data, f.lat);
        const lng = getNested(data, f.lng);
        if (lat != null && lng != null) {
            return { lat: Number(lat), lng: Number(lng) };
        }
    }
    return { lat: null, lng: null };
}

function extractPrice(data: any): number | null {
    if (typeof data.price === 'number') return data.price;
    if (typeof data.price === 'string') return parseFloat(data.price) || null;
    if (data.price?.rate) return data.price.rate;
    if (data.price?.amount) return data.price.amount;
    if (data.pricing?.rate?.amount) return data.pricing.rate.amount;
    if (data.basePrice) return data.basePrice;
    return null;
}

function extractRating(data: any): { rating: number | null; reviewCount: number | null } {
    if (typeof data.rating === 'number') {
        return { rating: data.rating, reviewCount: data.reviewsCount || data.numberOfReviews || null };
    }
    if (data.rating?.value) {
        return { rating: data.rating.value, reviewCount: data.rating.reviewsCount || null };
    }
    if (data.stars) {
        return { rating: data.stars, reviewCount: data.numberOfReviews || null };
    }
    return { rating: null, reviewCount: null };
}

function extractPhotos(data: any): any[] {
    const photos = data.photos || data.images || data.pictures || [];
    return photos.slice(0, 30).map((p: any) => {
        if (typeof p === 'string') return { url: p, caption: '' };
        return {
            url: p.url || p.picture || p.large || p.original || '',
            caption: p.caption || p.label || ''
        };
    });
}

function extractBedroomsFromPhotos(photos: any[]): number | null {
    const bedroomPhotos = photos.filter(p => 
        (p.caption || '').toLowerCase().includes('bedroom')
    );
    return bedroomPhotos.length > 0 ? bedroomPhotos.length : null;
}

// =====================================================================
// RECORD PROCESSING
// =====================================================================

async function processRecord(
    record: any,
    config: DatasetConfig
): Promise<{ status: 'inserted' | 'updated' | 'skipped' | 'error'; recordId?: string }> {
    try {
        // Extract external ID (required)
        const externalId = String(
            record.id || record.listingId || record.roomId ||
            record.productId || record.sku || ''
        ).trim();
        
        if (!externalId) return { status: 'skipped' };
        
        const hash = md5(record);
        const coords = extractCoordinates(record);
        const { rating, reviewCount } = extractRating(record);
        const photos = extractPhotos(record);
        
        // Try to get bedrooms from data or photos
        let bedrooms = record.bedrooms || record.bedroomCount || null;
        if (!bedrooms && config.record_type === 'property_listing') {
            bedrooms = extractBedroomsFromPhotos(photos);
        }
        
        const name = String(record.title || record.name || record.productName || 'Unknown').slice(0, 500);
        const description = String(record.description || '').slice(0, 20000);
        const address = String(record.address?.full || record.address || '').slice(0, 500);
        const city = String(record.location?.city || record.city || record.address?.city || '').slice(0, 200);
        const region = String(record.location?.region || record.region || config.region || '').slice(0, 200);
        const url = String(record.url || record.listingUrl || '').slice(0, 2000);
        
        // Check if exists
        const existing = await pool.query(
            `SELECT id, sync_hash FROM cc_external_records WHERE source = $1::external_source AND external_id = $2`,
            [config.source, externalId]
        );
        
        if (existing.rows.length > 0) {
            const row = existing.rows[0];
            
            if (row.sync_hash === hash) {
                // No changes, just update last_seen
                await pool.query(
                    `UPDATE cc_external_records SET last_seen_at = NOW() WHERE id = $1`,
                    [row.id]
                );
                return { status: 'skipped', recordId: row.id };
            }
            
            // Update existing record
            await pool.query(`
                UPDATE cc_external_records SET
                    name = $1,
                    description = $2,
                    external_url = $3,
                    address = $4,
                    latitude = $5,
                    longitude = $6,
                    city = $7,
                    region = $8,
                    community_id = resolve_community($5, $6, $7, $8),
                    contact_email = $9,
                    contact_phone = $10,
                    contact_name = $11,
                    price = $12,
                    rating = $13,
                    review_count = $14,
                    max_occupancy = $15,
                    bedrooms = $16,
                    bathrooms = $17,
                    beds = $18,
                    property_type = $19,
                    amenities = $20,
                    photos = $21,
                    host_name = $22,
                    host_id = $23,
                    raw_data = $24,
                    sync_hash = $25,
                    last_seen_at = NOW(),
                    last_changed_at = NOW(),
                    updated_at = NOW()
                WHERE id = $26
            `, [
                name,
                description,
                url,
                address,
                coords.lat,
                coords.lng,
                city,
                region,
                record.host?.email || record.contactEmail || null,
                record.host?.phone || record.contactPhone || null,
                record.host?.name || record.hostName || null,
                extractPrice(record),
                rating,
                reviewCount,
                record.maxGuests || record.personCapacity || record.guestCapacity || null,
                bedrooms,
                record.bathrooms || record.bathroomCount || null,
                record.beds || record.bedCount || null,
                record.propertyType || record.roomType || null,
                JSON.stringify(record.amenities || []),
                JSON.stringify(photos),
                record.host?.name || record.hostName || '',
                String(record.host?.id || record.hostId || ''),
                JSON.stringify(record),
                hash,
                row.id
            ]);
            
            return { status: 'updated', recordId: row.id };
        }
        
        // Insert new record
        const inserted = await pool.query(`
            INSERT INTO cc_external_records (
                dataset_id, source, record_type,
                external_id, external_url,
                name, description, address,
                latitude, longitude, city, region, country,
                community_id,
                contact_email, contact_phone, contact_name,
                price, currency, rating, review_count,
                max_occupancy, bedrooms, bathrooms, beds,
                property_type, amenities, photos,
                host_name, host_id,
                raw_data, sync_hash
            ) VALUES (
                $1, $2::external_source, $3::external_record_type,
                $4, $5,
                $6, $7, $8,
                $9, $10, $11, $12, 'Canada',
                resolve_community($9, $10, $11, $12),
                $13, $14, $15,
                $16, 'CAD', $17, $18,
                $19, $20, $21, $22,
                $23, $24, $25,
                $26, $27,
                $28, $29
            )
            RETURNING id
        `, [
            config.id,
            config.source,
            config.record_type,
            externalId,
            url,
            name,
            description,
            address,
            coords.lat,
            coords.lng,
            city,
            region,
            record.host?.email || record.contactEmail || null,
            record.host?.phone || record.contactPhone || null,
            record.host?.name || record.hostName || null,
            extractPrice(record),
            rating,
            reviewCount,
            record.maxGuests || record.personCapacity || record.guestCapacity || null,
            bedrooms,
            record.bathrooms || record.bathroomCount || null,
            record.beds || record.bedCount || null,
            record.propertyType || record.roomType || null,
            JSON.stringify(record.amenities || []),
            JSON.stringify(photos),
            record.host?.name || record.hostName || '',
            String(record.host?.id || record.hostId || ''),
            JSON.stringify(record),
            hash
        ]);
        
        return { status: 'inserted', recordId: inserted.rows[0].id };
        
    } catch (error: any) {
        console.error('Error processing record:', error.message);
        return { status: 'error' };
    }
}

// =====================================================================
// AUTO-CREATE ENTITY
// =====================================================================

async function createEntityForRecord(recordId: string): Promise<string | null> {
    try {
        const result = await pool.query(
            `SELECT create_entity_from_record($1)`,
            [recordId]
        );
        return result.rows[0]?.create_entity_from_record || null;
    } catch (error) {
        console.error('Error creating entity:', error);
        return null;
    }
}

// =====================================================================
// SYNC FROM JSON FILE (for large files)
// =====================================================================

export async function syncFromFile(
    datasetSlug: string,
    filePath: string
): Promise<SyncResult> {
    // Lazy load stream-json
    if (!parser) {
        const streamJson = await import('stream-json');
        const streamers = await import('stream-json/streamers/StreamArray');
        parser = streamJson.parser;
        streamArray = streamers.streamArray;
    }
    
    const startTime = Date.now();
    
    // Get dataset config
    const configResult = await pool.query(
        `SELECT id, slug, source::text, record_type::text, region, apify_actor_id, apify_dataset_id
         FROM cc_apify_datasets WHERE slug = $1`,
        [datasetSlug]
    );
    
    if (configResult.rows.length === 0) {
        throw new Error(`Dataset not found: ${datasetSlug}`);
    }
    
    const config: DatasetConfig = configResult.rows[0];
    
    // Create sync history
    const syncRecord = await pool.query(
        `INSERT INTO cc_apify_sync_history (dataset_id, triggered_by) VALUES ($1, 'file') RETURNING id`,
        [config.id]
    );
    const syncId = syncRecord.rows[0].id;
    
    const result: SyncResult = {
        success: false,
        recordsProcessed: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
        recordsErrored: 0,
        entitiesCreated: 0,
        durationSeconds: 0
    };
    
    try {
        console.log(`Reading from: ${filePath}`);
        
        const fileStream = createReadStream(filePath);
        const jsonStream = fileStream.pipe(parser()).pipe(streamArray());
        
        for await (const { value: record } of jsonStream) {
            result.recordsProcessed++;
            
            const { status, recordId } = await processRecord(record, config);
            
            switch (status) {
                case 'inserted':
                    result.recordsInserted++;
                    if (recordId) {
                        const entityId = await createEntityForRecord(recordId);
                        if (entityId) result.entitiesCreated++;
                    }
                    break;
                case 'updated':
                    result.recordsUpdated++;
                    break;
                case 'skipped':
                    result.recordsSkipped++;
                    break;
                case 'error':
                    result.recordsErrored++;
                    break;
            }
            
            if (result.recordsProcessed % 1000 === 0) {
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                const rate = (result.recordsProcessed / parseFloat(elapsed)).toFixed(0);
                console.log(`  ${result.recordsProcessed.toLocaleString()} processed (${rate}/sec)...`);
            }
        }
        
        result.success = true;
        
    } catch (error: any) {
        result.error = error.message;
        console.error('Sync from file failed:', error);
    }
    
    result.durationSeconds = Math.round((Date.now() - startTime) / 1000);
    
    // Update sync history
    await pool.query(`
        UPDATE cc_apify_sync_history SET
            completed_at = NOW(),
            status = $2,
            records_processed = $3,
            records_inserted = $4,
            records_updated = $5,
            records_skipped = $6,
            records_errored = $7,
            duration_seconds = $8,
            error_message = $9
        WHERE id = $1
    `, [
        syncId,
        result.success ? 'completed' : 'failed',
        result.recordsProcessed,
        result.recordsInserted,
        result.recordsUpdated,
        result.recordsSkipped,
        result.recordsErrored,
        result.durationSeconds,
        result.error
    ]);
    
    // Update dataset
    await pool.query(`
        UPDATE cc_apify_datasets SET 
            last_sync_at = NOW(),
            last_sync_record_count = $2,
            last_sync_error = $3
        WHERE id = $1
    `, [config.id, result.recordsProcessed, result.error]);
    
    return result;
}

// =====================================================================
// SYNC FROM APIFY API
// =====================================================================

export async function syncFromApify(datasetSlug: string): Promise<SyncResult> {
    // Lazy load apify-client
    if (!ApifyClient) {
        const apify = await import('apify-client');
        ApifyClient = apify.ApifyClient;
    }
    
    const startTime = Date.now();
    
    // Get dataset config
    const configResult = await pool.query(
        `SELECT id, slug, source::text, record_type::text, region, apify_actor_id, apify_dataset_id
         FROM cc_apify_datasets WHERE slug = $1`,
        [datasetSlug]
    );
    
    if (configResult.rows.length === 0) {
        throw new Error(`Dataset not found: ${datasetSlug}`);
    }
    
    const config: DatasetConfig = configResult.rows[0];
    
    // Create sync history
    const syncRecord = await pool.query(
        `INSERT INTO cc_apify_sync_history (dataset_id, triggered_by) VALUES ($1, 'api') RETURNING id`,
        [config.id]
    );
    const syncId = syncRecord.rows[0].id;
    
    const result: SyncResult = {
        success: false,
        recordsProcessed: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
        recordsErrored: 0,
        entitiesCreated: 0,
        durationSeconds: 0
    };
    
    try {
        const client = new ApifyClient({
            token: process.env.APIFY_API_TOKEN
        });
        
        // Get dataset ID
        let datasetId = config.apify_dataset_id;
        
        if (!datasetId) {
            const runs = await client.actor(config.apify_actor_id).runs().list({ limit: 1 });
            if (runs.items.length === 0) {
                throw new Error('No runs found for actor');
            }
            datasetId = runs.items[0].defaultDatasetId;
        }
        
        console.log(`Fetching from Apify dataset: ${datasetId}`);
        
        const dataset = client.dataset(datasetId);
        const { items } = await dataset.listItems();
        
        console.log(`Processing ${items.length} records...`);
        
        for (const record of items) {
            result.recordsProcessed++;
            
            const { status, recordId } = await processRecord(record, config);
            
            switch (status) {
                case 'inserted':
                    result.recordsInserted++;
                    if (recordId) {
                        const entityId = await createEntityForRecord(recordId);
                        if (entityId) result.entitiesCreated++;
                    }
                    break;
                case 'updated':
                    result.recordsUpdated++;
                    break;
                case 'skipped':
                    result.recordsSkipped++;
                    break;
                case 'error':
                    result.recordsErrored++;
                    break;
            }
            
            if (result.recordsProcessed % 500 === 0) {
                console.log(`  ${result.recordsProcessed.toLocaleString()} processed...`);
            }
        }
        
        result.success = true;
        
    } catch (error: any) {
        result.error = error.message;
        console.error('Sync failed:', error);
    }
    
    result.durationSeconds = Math.round((Date.now() - startTime) / 1000);
    
    // Update sync history
    await pool.query(`
        UPDATE cc_apify_sync_history SET
            completed_at = NOW(),
            status = $2,
            records_processed = $3,
            records_inserted = $4,
            records_updated = $5,
            records_skipped = $6,
            records_errored = $7,
            duration_seconds = $8,
            error_message = $9
        WHERE id = $1
    `, [
        syncId,
        result.success ? 'completed' : 'failed',
        result.recordsProcessed,
        result.recordsInserted,
        result.recordsUpdated,
        result.recordsSkipped,
        result.recordsErrored,
        result.durationSeconds,
        result.error
    ]);
    
    // Update dataset
    await pool.query(`
        UPDATE cc_apify_datasets SET 
            last_sync_at = NOW(),
            last_sync_record_count = $2,
            last_sync_error = $3
        WHERE id = $1
    `, [config.id, result.recordsProcessed, result.error]);
    
    return result;
}

// =====================================================================
// UTILITY EXPORTS
// =====================================================================

export async function getDatasetStatus() {
    const result = await pool.query(`SELECT * FROM v_dataset_sync_status`);
    return result.rows;
}

export async function getEntityStats() {
    const result = await pool.query(`SELECT * FROM v_entity_stats`);
    return result.rows;
}

export async function getUnresolvedRecords(limit: number = 100) {
    const result = await pool.query(
        `SELECT * FROM v_unresolved_records LIMIT $1`,
        [limit]
    );
    return result.rows;
}

export async function getRentalListings(filters?: {
    city?: string;
    minPrice?: number;
    maxPrice?: number;
    bedrooms?: number;
    limit?: number;
}) {
    let query = `SELECT * FROM v_rental_listings WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;
    
    if (filters?.city) {
        query += ` AND LOWER(city) LIKE $${idx++}`;
        params.push(`%${filters.city.toLowerCase()}%`);
    }
    if (filters?.minPrice) {
        query += ` AND price >= $${idx++}`;
        params.push(filters.minPrice);
    }
    if (filters?.maxPrice) {
        query += ` AND price <= $${idx++}`;
        params.push(filters.maxPrice);
    }
    if (filters?.bedrooms) {
        query += ` AND bedrooms >= $${idx++}`;
        params.push(filters.bedrooms);
    }
    
    query += ` LIMIT $${idx}`;
    params.push(filters?.limit || 50);
    
    const result = await pool.query(query, params);
    return result.rows;
}
