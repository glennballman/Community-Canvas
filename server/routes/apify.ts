// server/routes/apify.ts
// API routes for Apify dataset sync and external records management

import { Router } from 'express';
import { pool } from '../db';
import { syncFromApify, syncFromFile, getDatasetStatus, getEntityStats, getUnresolvedRecords, getRentalListings } from '../services/apifySync';

const router = Router();

// GET /api/apify/datasets - List all datasets with sync status
router.get('/datasets', async (req, res) => {
    try {
        const datasets = await getDatasetStatus();
        res.json({ success: true, datasets });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/apify/datasets - Create a new dataset configuration
router.post('/datasets', async (req, res) => {
    try {
        const { name, slug, source, record_type, region, apify_actor_id, apify_dataset_id, sync_enabled } = req.body;
        
        const result = await pool.query(`
            INSERT INTO apify_datasets (name, slug, source, record_type, region, apify_actor_id, apify_dataset_id, sync_enabled)
            VALUES ($1, $2, $3::external_source, $4::external_record_type, $5, $6, $7, $8)
            RETURNING *
        `, [name, slug, source || 'other', record_type || 'other', region, apify_actor_id, apify_dataset_id, sync_enabled ?? true]);
        
        res.json({ success: true, dataset: result.rows[0] });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/apify/sync/:slug - Trigger sync for a dataset
router.post('/sync/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const { filePath } = req.body;
        
        console.log(`Starting sync for ${slug}...`);
        
        const result = filePath 
            ? await syncFromFile(slug, filePath)
            : await syncFromApify(slug);
        
        console.log(`Sync completed:`, result);
        
        res.json({ success: true, result });
        
    } catch (error: any) {
        console.error('Sync error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/apify/stats - Entity statistics
router.get('/stats', async (req, res) => {
    try {
        const stats = await getEntityStats();
        const totals = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM external_records) as total_records,
                (SELECT COUNT(*) FROM entities) as total_entities,
                (SELECT COUNT(*) FROM entity_claims) as claimed_entities,
                (SELECT COUNT(*) FROM entity_inquiries WHERE status = 'pending') as pending_inquiries
        `);
        
        res.json({ success: true, stats, totals: totals.rows[0] });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/apify/records - Query external records
router.get('/records', async (req, res) => {
    try {
        const { source, record_type, community, city, search, limit = '50', offset = '0' } = req.query;
        
        let query = `
            SELECT er.*, c.name as community_name
            FROM external_records er
            LEFT JOIN sr_communities c ON c.id = er.community_id
            WHERE 1=1
        `;
        const params: any[] = [];
        let idx = 1;
        
        if (source) {
            query += ` AND er.source = $${idx++}::external_source`;
            params.push(source);
        }
        if (record_type) {
            query += ` AND er.record_type = $${idx++}::external_record_type`;
            params.push(record_type);
        }
        if (community) {
            query += ` AND er.community_id = $${idx++}`;
            params.push(community);
        }
        if (city) {
            query += ` AND LOWER(er.city) LIKE $${idx++}`;
            params.push(`%${(city as string).toLowerCase()}%`);
        }
        if (search) {
            query += ` AND (LOWER(er.name) LIKE $${idx} OR LOWER(er.description) LIKE $${idx})`;
            params.push(`%${(search as string).toLowerCase()}%`);
            idx++;
        }
        
        query += ` ORDER BY er.last_seen_at DESC LIMIT $${idx++} OFFSET $${idx}`;
        params.push(parseInt(limit as string), parseInt(offset as string));
        
        const result = await pool.query(query, params);
        res.json({ success: true, records: result.rows });
        
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/apify/records/:id - Get single record with full details
router.get('/records/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const record = await pool.query(`
            SELECT er.*, c.name as community_name, d.name as dataset_name
            FROM external_records er
            LEFT JOIN sr_communities c ON c.id = er.community_id
            LEFT JOIN apify_datasets d ON d.id = er.dataset_id
            WHERE er.id = $1
        `, [id]);
        
        if (record.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Record not found' });
        }
        
        // Get linked entities
        const links = await pool.query(`
            SELECT el.*, e.name as entity_name, e.entity_type_id
            FROM entity_links el
            JOIN entities e ON e.id = el.entity_id
            WHERE el.external_record_id = $1
        `, [id]);
        
        // Get contact points
        const contacts = await pool.query(`
            SELECT * FROM external_contact_points WHERE external_record_id = $1
        `, [id]);
        
        res.json({ 
            success: true, 
            record: record.rows[0],
            entity_links: links.rows,
            contact_points: contacts.rows
        });
        
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/apify/unresolved - Get records without accepted entity links
router.get('/unresolved', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit as string) || 100;
        const records = await getUnresolvedRecords(limit);
        res.json({ success: true, records });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/apify/rentals - Get rental listings with filters
router.get('/rentals', async (req, res) => {
    try {
        const { city, minPrice, maxPrice, bedrooms, limit } = req.query;
        
        const listings = await getRentalListings({
            city: city as string,
            minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
            maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
            bedrooms: bedrooms ? parseInt(bedrooms as string) : undefined,
            limit: limit ? parseInt(limit as string) : 50
        });
        
        res.json({ success: true, listings });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/apify/records/:id/create-entity - Create entity from record
router.post('/records/:id/create-entity', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(
            `SELECT create_entity_from_record($1::uuid)`,
            [id]
        );
        
        const entityId = result.rows[0]?.create_entity_from_record;
        
        if (!entityId) {
            return res.status(400).json({ success: false, error: 'Failed to create entity' });
        }
        
        res.json({ success: true, entity_id: entityId });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/apify/sync-history/:slug - Get sync history for a dataset
router.get('/sync-history/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const limit = parseInt(req.query.limit as string) || 20;
        
        const result = await pool.query(`
            SELECT sh.* 
            FROM apify_sync_history sh
            JOIN apify_datasets d ON d.id = sh.dataset_id
            WHERE d.slug = $1
            ORDER BY sh.started_at DESC
            LIMIT $2
        `, [slug, limit]);
        
        res.json({ success: true, history: result.rows });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// PATCH /api/apify/datasets/:id - Update dataset configuration
router.patch('/datasets/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, sync_enabled, sync_frequency_hours, apify_actor_id, apify_dataset_id, field_mapping, region } = req.body;
        
        const updates: string[] = [];
        const params: any[] = [];
        let idx = 1;
        
        if (name !== undefined) {
            updates.push(`name = $${idx++}`);
            params.push(name);
        }
        if (sync_enabled !== undefined) {
            updates.push(`sync_enabled = $${idx++}`);
            params.push(sync_enabled);
        }
        if (sync_frequency_hours !== undefined) {
            updates.push(`sync_frequency_hours = $${idx++}`);
            params.push(sync_frequency_hours);
        }
        if (apify_actor_id !== undefined) {
            updates.push(`apify_actor_id = $${idx++}`);
            params.push(apify_actor_id);
        }
        if (apify_dataset_id !== undefined) {
            updates.push(`apify_dataset_id = $${idx++}`);
            params.push(apify_dataset_id);
        }
        if (field_mapping !== undefined) {
            updates.push(`field_mapping = $${idx++}`);
            params.push(JSON.stringify(field_mapping));
        }
        if (region !== undefined) {
            updates.push(`region = $${idx++}`);
            params.push(region);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ success: false, error: 'No fields to update' });
        }
        
        updates.push(`updated_at = NOW()`);
        params.push(id);
        
        const result = await pool.query(
            `UPDATE apify_datasets SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
            params
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Dataset not found' });
        }
        
        res.json({ success: true, dataset: result.rows[0] });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/apify/datasets/:id - Delete a dataset and its records
router.delete('/datasets/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if dataset exists
        const check = await pool.query('SELECT id, name FROM apify_datasets WHERE id = $1', [id]);
        if (check.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Dataset not found' });
        }
        
        // Delete cascade handles external_records and sync_history
        await pool.query('DELETE FROM apify_datasets WHERE id = $1', [id]);
        
        res.json({ success: true, message: `Dataset "${check.rows[0].name}" deleted` });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/apify/records/:id - Delete a single external record
router.delete('/records/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const check = await pool.query('SELECT id, name FROM external_records WHERE id = $1', [id]);
        if (check.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Record not found' });
        }
        
        // Delete cascade handles entity_links and contact_points
        await pool.query('DELETE FROM external_records WHERE id = $1', [id]);
        
        res.json({ success: true, message: 'Record deleted' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/apify/records/:id/resolve - Accept/reject entity link
router.post('/records/:id/resolve', async (req, res) => {
    try {
        const { id } = req.params;
        const { entity_id, action } = req.body; // action: 'accept' | 'reject'
        
        if (!entity_id || !['accept', 'reject'].includes(action)) {
            return res.status(400).json({ success: false, error: 'entity_id and action (accept/reject) required' });
        }
        
        const newStatus = action === 'accept' ? 'accepted' : 'rejected';
        
        const result = await pool.query(`
            UPDATE entity_links 
            SET status = $1::link_status, decided_at = NOW()
            WHERE external_record_id = $2 AND entity_id = $3
            RETURNING *
        `, [newStatus, id, entity_id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Entity link not found' });
        }
        
        res.json({ success: true, link: result.rows[0] });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/apify/records/stale - Delete records not seen since a date
router.delete('/records/stale', async (req, res) => {
    try {
        const { before } = req.query; // ISO date string
        
        if (!before) {
            return res.status(400).json({ success: false, error: 'before date parameter required' });
        }
        
        const result = await pool.query(`
            DELETE FROM external_records 
            WHERE last_seen_at < $1::timestamptz
            RETURNING id
        `, [before]);
        
        res.json({ success: true, deleted_count: result.rowCount });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
