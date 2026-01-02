import express, { Response } from 'express';
import { pool } from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import multer from 'multer';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authenticateToken);

// GET /api/import/batches - List import batches
router.get('/batches', async (req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query(`
            SELECT * FROM staging_import_batches
            ORDER BY created_at DESC
            LIMIT 50
        `);

        res.json({ success: true, batches: result.rows });
    } catch (error: any) {
        res.status(500).json({ success: false, error: 'Failed to load batches' });
    }
});

// GET /api/import/batches/:id - Get batch details with records
router.get('/batches/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const batchResult = await pool.query(
            'SELECT * FROM staging_import_batches WHERE id = $1',
            [id]
        );

        if (batchResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Batch not found' });
        }

        const recordsResult = await pool.query(`
            SELECT id, name, city, status, matched_property_id, confidence_score, processing_notes
            FROM staging_import_raw
            WHERE batch_id = $1
            ORDER BY name
        `, [id]);

        res.json({
            success: true,
            batch: batchResult.rows[0],
            records: recordsResult.rows
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: 'Failed to load batch' });
    }
});

// POST /api/import/csv - Upload and parse CSV
router.post('/csv', upload.single('file'), async (req: AuthRequest, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        const { sourceName, sourceType } = req.body;
        const csvContent = req.file.buffer.toString('utf-8');

        const lines = csvContent.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
            return res.status(400).json({ success: false, error: 'CSV must have headers and at least one row' });
        }

        const headers = parseCSVLine(lines[0]);
        const records: any[] = [];

        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            if (values.length === headers.length) {
                const record: any = {};
                headers.forEach((h, idx) => {
                    record[h.toLowerCase().trim().replace(/\s+/g, '_')] = values[idx];
                });
                records.push(record);
            }
        }

        const batchResult = await pool.query(`
            INSERT INTO staging_import_batches 
            (batch_name, source_type, source_name, status, total_records, created_by)
            VALUES ($1, $2, $3, 'processing', $4, $5)
            RETURNING id
        `, [
            `CSV Import - ${req.file.originalname}`,
            sourceType || 'csv',
            sourceName || req.file.originalname,
            records.length,
            req.user!.id
        ]);

        const batchId = batchResult.rows[0].id;

        for (const record of records) {
            await pool.query(`
                INSERT INTO staging_import_raw (batch_id, raw_data, name, city, latitude, longitude, phone, email, website)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [
                batchId,
                JSON.stringify(record),
                record.name || record.park_name || record.facility_name,
                record.city || record.location,
                record.latitude || record.lat,
                record.longitude || record.lng || record.lon,
                record.phone || record.telephone,
                record.email,
                record.website || record.url
            ]);
        }

        await pool.query(`
            UPDATE staging_import_batches 
            SET status = 'pending_review', processed_records = $2
            WHERE id = $1
        `, [batchId, records.length]);

        res.json({
            success: true,
            batchId,
            recordCount: records.length,
            headers
        });

    } catch (error: any) {
        console.error('CSV import error:', error);
        res.status(500).json({ success: false, error: 'Failed to import CSV' });
    }
});

function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

// POST /api/import/batches/:id/detect-duplicates
router.post('/batches/:id/detect-duplicates', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const rawRecords = await pool.query(`
            SELECT id, name, city, latitude, longitude
            FROM staging_import_raw
            WHERE batch_id = $1 AND status = 'pending'
        `, [id]);

        let matchedCount = 0;
        let newCount = 0;

        for (const record of rawRecords.rows) {
            let matchQuery = `
                SELECT id, name, city, 
                    CASE 
                        WHEN LOWER(name) = LOWER($1) THEN 100
                        WHEN LOWER(name) LIKE LOWER($1) || '%' THEN 80
                        WHEN LOWER(name) LIKE '%' || LOWER($1) || '%' THEN 60
                        ELSE 0
                    END as name_score
                FROM staging_properties
                WHERE 1=1
            `;
            const params: any[] = [record.name];

            if (record.latitude && record.longitude) {
                matchQuery = `
                    SELECT id, name, city,
                        CASE 
                            WHEN LOWER(name) = LOWER($1) THEN 100
                            WHEN LOWER(name) LIKE LOWER($1) || '%' THEN 80
                            ELSE 0
                        END as name_score,
                        (111.0 * SQRT(
                            POW(latitude - $2, 2) + 
                            POW((longitude - $3) * COS(RADIANS($2)), 2)
                        )) as distance_km
                    FROM staging_properties
                    WHERE latitude IS NOT NULL
                    ORDER BY distance_km
                    LIMIT 5
                `;
                params.push(record.latitude, record.longitude);
            }

            const matches = await pool.query(matchQuery + ' LIMIT 5', params);

            let bestMatch = null;
            let confidence = 0;

            for (const match of matches.rows) {
                const nameScore = match.name_score || 0;
                const distanceScore = match.distance_km 
                    ? Math.max(0, 100 - (match.distance_km * 10)) 
                    : 0;
                const totalScore = (nameScore * 0.6) + (distanceScore * 0.4);

                if (totalScore > confidence && totalScore >= 50) {
                    bestMatch = match;
                    confidence = totalScore;
                }
            }

            if (bestMatch && confidence >= 70) {
                await pool.query(`
                    UPDATE staging_import_raw 
                    SET status = 'matched', 
                        matched_property_id = $2, 
                        confidence_score = $3,
                        processing_notes = $4,
                        processed_at = NOW()
                    WHERE id = $1
                `, [record.id, bestMatch.id, confidence, `Matched to: ${bestMatch.name}`]);
                matchedCount++;
            } else if (bestMatch && confidence >= 50) {
                await pool.query(`
                    UPDATE staging_import_raw 
                    SET status = 'review', 
                        matched_property_id = $2, 
                        confidence_score = $3,
                        processing_notes = $4,
                        processed_at = NOW()
                    WHERE id = $1
                `, [record.id, bestMatch.id, confidence, `Possible match: ${bestMatch.name} (${confidence.toFixed(0)}%)`]);
            } else {
                await pool.query(`
                    UPDATE staging_import_raw 
                    SET status = 'new', 
                        confidence_score = 0,
                        processing_notes = 'No existing match found',
                        processed_at = NOW()
                    WHERE id = $1
                `, [record.id]);
                newCount++;
            }
        }

        await pool.query(`
            UPDATE staging_import_batches
            SET imported_records = (SELECT COUNT(*) FROM staging_import_raw WHERE batch_id = $1 AND status = 'matched'),
                skipped_records = (SELECT COUNT(*) FROM staging_import_raw WHERE batch_id = $1 AND status = 'review')
            WHERE id = $1
        `, [id]);

        res.json({
            success: true,
            processed: rawRecords.rows.length,
            matched: matchedCount,
            new: newCount,
            needsReview: rawRecords.rows.length - matchedCount - newCount
        });

    } catch (error: any) {
        console.error('Duplicate detection error:', error);
        res.status(500).json({ success: false, error: 'Failed to detect duplicates' });
    }
});

// POST /api/import/batches/:id/import - Import new records as properties
router.post('/batches/:id/import', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { recordIds } = req.body;

        let query = `
            SELECT * FROM staging_import_raw
            WHERE batch_id = $1 AND status = 'new'
        `;
        const params: any[] = [id];

        if (recordIds && recordIds.length > 0) {
            query += ` AND id = ANY($2)`;
            params.push(recordIds);
        }

        const records = await pool.query(query, params);

        let importedCount = 0;
        const errors: any[] = [];

        for (const record of records.rows) {
            try {
                const rawData = record.raw_data;

                let propertyType = 'rv_park';
                let propertySubtype = 'general';
                
                const nameLower = (record.name || '').toLowerCase();
                if (nameLower.includes('campground') || nameLower.includes('camping')) {
                    propertyType = 'campground';
                } else if (nameLower.includes('resort')) {
                    propertySubtype = 'resort';
                } else if (nameLower.includes('provincial') || nameLower.includes('park')) {
                    propertyType = 'campground';
                    propertySubtype = 'provincial';
                }

                const propResult = await pool.query(`
                    INSERT INTO staging_properties (
                        name, description, short_description,
                        property_type, property_subtype,
                        region, city, address, postal_code,
                        latitude, longitude,
                        phone, email, website,
                        status, source, source_id
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                        'pending_review', 'import', $15
                    )
                    RETURNING id
                `, [
                    record.name,
                    rawData.description || `Imported from batch ${id}`,
                    rawData.short_description || record.name,
                    propertyType,
                    propertySubtype,
                    rawData.region || determineRegion(record.city),
                    record.city,
                    rawData.address || rawData.street_address,
                    rawData.postal_code || rawData.zip,
                    record.latitude,
                    record.longitude,
                    record.phone,
                    record.email,
                    record.website,
                    `import_${id}_${record.id}`
                ]);

                await pool.query(`
                    UPDATE staging_import_raw
                    SET status = 'imported', matched_property_id = $2, processed_at = NOW()
                    WHERE id = $1
                `, [record.id, propResult.rows[0].id]);

                importedCount++;

            } catch (err: any) {
                errors.push({ recordId: record.id, name: record.name, error: err.message });
                await pool.query(`
                    UPDATE staging_import_raw
                    SET status = 'error', processing_notes = $2, processed_at = NOW()
                    WHERE id = $1
                `, [record.id, err.message]);
            }
        }

        await pool.query(`
            UPDATE staging_import_batches
            SET imported_records = imported_records + $2,
                error_records = error_records + $3,
                error_log = error_log || $4::jsonb,
                status = CASE WHEN $3 = 0 THEN 'completed' ELSE 'completed_with_errors' END,
                completed_at = NOW()
            WHERE id = $1
        `, [id, importedCount, errors.length, JSON.stringify(errors)]);

        res.json({
            success: true,
            imported: importedCount,
            errors: errors.length,
            errorDetails: errors
        });

    } catch (error: any) {
        console.error('Import error:', error);
        res.status(500).json({ success: false, error: 'Failed to import records' });
    }
});

function determineRegion(city: string): string {
    if (!city) return 'Unknown';
    
    const cityLower = city.toLowerCase();
    
    const regionMap: Record<string, string[]> = {
        'Vancouver Island': ['victoria', 'nanaimo', 'duncan', 'parksville', 'courtenay', 'campbell river', 'port alberni', 'tofino', 'ucluelet', 'sooke', 'sidney'],
        'Okanagan': ['kelowna', 'penticton', 'vernon', 'osoyoos', 'oliver', 'summerland', 'peachland'],
        'Kootenays': ['nelson', 'trail', 'castlegar', 'cranbrook', 'fernie', 'revelstoke', 'golden', 'invermere'],
        'Sea-to-Sky': ['whistler', 'squamish', 'pemberton'],
        'Fraser Valley': ['abbotsford', 'chilliwack', 'mission', 'hope', 'langley', 'maple ridge'],
        'Sunshine Coast': ['sechelt', 'gibsons', 'powell river'],
        'Northern BC': ['prince george', 'prince rupert', 'terrace', 'fort nelson', 'dawson creek'],
        'Cariboo': ['williams lake', 'quesnel', '100 mile house'],
        'Thompson': ['kamloops', 'merritt', 'salmon arm']
    };

    for (const [region, cities] of Object.entries(regionMap)) {
        if (cities.some(c => cityLower.includes(c))) {
            return region;
        }
    }

    return 'British Columbia';
}

// GET /api/import/sources - List data sources
router.get('/sources', async (req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query('SELECT * FROM staging_data_sources ORDER BY name');
        res.json({ success: true, sources: result.rows });
    } catch (error: any) {
        res.status(500).json({ success: false, error: 'Failed to load sources' });
    }
});

export default router;
