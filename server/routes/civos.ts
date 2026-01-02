import express, { Request, Response } from 'express';
import { pool } from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// ============================================================================
// PUBLIC ENDPOINTS (for CivOS to pull data)
// ============================================================================

router.get('/signals', async (req: Request, res: Response) => {
    try {
        const { region, severity, signalCode, limit = 100 } = req.query;

        let query = `
            SELECT 
                s.*,
                st.signal_name,
                st.category,
                p.name as property_name,
                p.city
            FROM civos_signals s
            JOIN civos_signal_types st ON st.id = s.signal_type_id
            LEFT JOIN staging_properties p ON p.id = s.property_id
            WHERE s.status = 'active'
            AND (s.expires_at IS NULL OR s.expires_at > NOW())
        `;
        const params: any[] = [];
        let paramCount = 0;

        if (region) {
            paramCount++;
            query += ` AND s.region = $${paramCount}`;
            params.push(region);
        }

        if (severity) {
            paramCount++;
            query += ` AND s.severity = $${paramCount}`;
            params.push(severity);
        }

        if (signalCode) {
            paramCount++;
            query += ` AND s.signal_code = $${paramCount}`;
            params.push(signalCode);
        }

        query += ` ORDER BY 
            CASE s.severity 
                WHEN 'critical' THEN 1 
                WHEN 'high' THEN 2 
                WHEN 'medium' THEN 3 
                ELSE 4 
            END,
            s.detected_at DESC
            LIMIT $${paramCount + 1}`;
        params.push(parseInt(limit as string) || 100);

        const result = await pool.query(query, params);

        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            count: result.rows.length,
            signals: result.rows.map(s => ({
                id: s.id,
                signalCode: s.signal_code,
                signalName: s.signal_name,
                category: s.category,
                severity: s.severity,
                property: s.property_id ? {
                    id: s.property_id,
                    name: s.property_name,
                    city: s.city
                } : null,
                region: s.region,
                coordinates: {
                    lat: s.latitude ? parseFloat(s.latitude) : null,
                    lng: s.longitude ? parseFloat(s.longitude) : null
                },
                data: s.signal_value,
                message: s.message,
                detectedAt: s.detected_at,
                expiresAt: s.expires_at
            }))
        });

    } catch (error: any) {
        console.error('Get signals error:', error);
        res.status(500).json({ success: false, error: 'Failed to get signals' });
    }
});

router.get('/capacity', async (req: Request, res: Response) => {
    try {
        const { region } = req.query;

        const overallResult = await pool.query(`
            SELECT 
                COUNT(*) as total_properties,
                COALESCE(SUM(total_spots), 0) as total_spots,
                COALESCE(SUM(CASE WHEN has_shore_power THEN total_spots ELSE 0 END), 0) as powered_spots,
                COALESCE(SUM(num_truck_spots), 0) as truck_spots,
                COUNT(*) FILTER (WHERE has_onsite_mechanic) as properties_with_mechanic
            FROM staging_properties
            WHERE status = 'active'
            ${region ? 'AND region = $1' : ''}
        `, region ? [region] : []);

        const regionResult = await pool.query(`
            SELECT 
                region,
                COUNT(*) as properties,
                COALESCE(SUM(total_spots), 0) as spots,
                COALESCE(SUM(CASE WHEN has_shore_power THEN total_spots ELSE 0 END), 0) as powered_spots,
                ROUND(AVG(NULLIF(rv_score, 0))::numeric, 1) as avg_rv_score,
                ROUND(AVG(NULLIF(crew_score, 0))::numeric, 1) as avg_crew_score
            FROM staging_properties
            WHERE status = 'active'
            GROUP BY region
            ORDER BY spots DESC
        `);

        const utilizationResult = await pool.query(`
            SELECT 
                p.region,
                COUNT(DISTINCT b.id) as active_bookings
            FROM staging_bookings b
            JOIN staging_properties p ON p.id = b.property_id
            WHERE b.status IN ('confirmed', 'pending')
            AND b.check_in_date <= CURRENT_DATE
            AND b.check_out_date > CURRENT_DATE
            GROUP BY p.region
        `);

        const overall = overallResult.rows[0];

        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            capacity: {
                total: {
                    properties: parseInt(overall.total_properties),
                    spots: parseInt(overall.total_spots),
                    poweredSpots: parseInt(overall.powered_spots),
                    truckSpots: parseInt(overall.truck_spots),
                    propertiesWithMechanic: parseInt(overall.properties_with_mechanic)
                },
                byRegion: regionResult.rows.map(r => ({
                    region: r.region,
                    properties: parseInt(r.properties),
                    spots: parseInt(r.spots),
                    poweredSpots: parseInt(r.powered_spots),
                    avgRvScore: parseFloat(r.avg_rv_score) || 0,
                    avgCrewScore: parseFloat(r.avg_crew_score) || 0
                })),
                utilization: utilizationResult.rows.map(u => ({
                    region: u.region,
                    activeBookings: parseInt(u.active_bookings)
                }))
            }
        });

    } catch (error: any) {
        console.error('Get capacity error:', error);
        res.status(500).json({ success: false, error: 'Failed to get capacity' });
    }
});

router.get('/export', async (req: Request, res: Response) => {
    try {
        const result = await pool.query('SELECT get_civos_export_payload() as payload');
        
        res.json({
            success: true,
            ...result.rows[0].payload
        });

    } catch (error: any) {
        console.error('Export error:', error);
        res.status(500).json({ success: false, error: 'Failed to generate export' });
    }
});

router.get('/properties', async (req: Request, res: Response) => {
    try {
        const { region, hasMechanic, hasPower } = req.query;

        let query = `
            SELECT 
                p.id, p.name, p.city, p.region,
                p.latitude, p.longitude,
                p.total_spots, p.max_combined_length_ft,
                p.has_shore_power, p.has_water_hookup, p.has_sewer_hookup,
                p.has_onsite_mechanic, p.accepts_semi_trucks,
                p.rv_score, p.crew_score, p.trucker_score,
                (SELECT COUNT(*) FROM staging_service_providers sp 
                 WHERE sp.property_id = p.id AND sp.is_active = true) as service_provider_count
            FROM staging_properties p
            WHERE p.status = 'active'
        `;
        const params: any[] = [];
        let paramCount = 0;

        if (region) {
            paramCount++;
            query += ` AND p.region = $${paramCount}`;
            params.push(region);
        }

        if (hasMechanic === 'true') {
            query += ' AND p.has_onsite_mechanic = true';
        }

        if (hasPower === 'true') {
            query += ' AND p.has_shore_power = true';
        }

        query += ' ORDER BY p.region, p.name';

        const result = await pool.query(query, params);

        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            count: result.rows.length,
            properties: result.rows.map((p: any) => ({
                id: p.id,
                name: p.name,
                location: {
                    city: p.city,
                    region: p.region,
                    coordinates: {
                        lat: p.latitude ? parseFloat(p.latitude) : null,
                        lng: p.longitude ? parseFloat(p.longitude) : null
                    }
                },
                capacity: {
                    totalSpots: p.total_spots,
                    maxVehicleLengthFt: p.max_combined_length_ft
                },
                amenities: {
                    hasPower: p.has_shore_power,
                    hasWater: p.has_water_hookup,
                    hasSewer: p.has_sewer_hookup,
                    hasMechanic: p.has_onsite_mechanic,
                    acceptsSemiTrucks: p.accepts_semi_trucks
                },
                scores: {
                    rv: p.rv_score,
                    crew: p.crew_score,
                    trucker: p.trucker_score
                },
                serviceProviderCount: parseInt(p.service_provider_count)
            }))
        });

    } catch (error: any) {
        console.error('Get properties error:', error);
        res.status(500).json({ success: false, error: 'Failed to get properties' });
    }
});

router.get('/signal-types', async (req: Request, res: Response) => {
    try {
        const result = await pool.query(`
            SELECT signal_code, signal_name, category, severity_levels, description
            FROM civos_signal_types
            WHERE is_active = true
            ORDER BY category, signal_code
        `);

        res.json({
            success: true,
            signalTypes: result.rows
        });

    } catch (error: any) {
        console.error('Get signal types error:', error);
        res.status(500).json({ success: false, error: 'Failed to get signal types' });
    }
});

// ============================================================================
// ADMIN ENDPOINTS (for managing signals) - Auth disabled for dev/testing
// ============================================================================

router.post('/signals/generate', async (req: Request, res: Response) => {
    try {
        const properties = await pool.query(
            'SELECT id FROM staging_properties WHERE status = $1',
            ['active']
        );

        let generated = 0;
        let failed = 0;

        for (const prop of properties.rows) {
            try {
                const result = await pool.query('SELECT generate_capacity_signal($1) as signal_id', [prop.id]);
                if (result.rows[0].signal_id) {
                    generated++;
                }
            } catch (err) {
                failed++;
                console.error(`Failed to generate signal for property ${prop.id}:`, err);
            }
        }

        res.json({
            success: true,
            message: `Generated ${generated} signals (${failed} failed)`,
            generated,
            failed,
            total: properties.rows.length
        });

    } catch (error: any) {
        console.error('Generate signals error:', error);
        res.status(500).json({ success: false, error: 'Failed to generate signals' });
    }
});

router.post('/signals', async (req: Request, res: Response) => {
    try {
        const { 
            signalCode, 
            propertyId, 
            region, 
            severity = 'medium', 
            message, 
            data,
            expiresInHours = 24
        } = req.body;

        if (!signalCode) {
            return res.status(400).json({ success: false, error: 'Signal code required' });
        }

        const typeResult = await pool.query(
            'SELECT id FROM civos_signal_types WHERE signal_code = $1',
            [signalCode]
        );

        if (typeResult.rows.length === 0) {
            return res.status(400).json({ success: false, error: 'Invalid signal code' });
        }

        let lat = null, lng = null, propRegion = region;
        if (propertyId) {
            const propResult = await pool.query(
                'SELECT latitude, longitude, region FROM staging_properties WHERE id = $1',
                [propertyId]
            );
            if (propResult.rows.length > 0) {
                lat = propResult.rows[0].latitude;
                lng = propResult.rows[0].longitude;
                propRegion = propResult.rows[0].region;
            }
        }

        const result = await pool.query(`
            INSERT INTO civos_signals (
                signal_type_id, signal_code, property_id, region,
                latitude, longitude, severity, message, signal_value, expires_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id, signal_code, severity, message
        `, [
            typeResult.rows[0].id,
            signalCode,
            propertyId || null,
            propRegion,
            lat,
            lng,
            severity,
            message,
            data ? JSON.stringify(data) : null,
            new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
        ]);

        res.status(201).json({
            success: true,
            signal: result.rows[0]
        });

    } catch (error: any) {
        console.error('Create signal error:', error);
        res.status(500).json({ success: false, error: 'Failed to create signal' });
    }
});

router.put('/signals/:id/resolve', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const currentSignal = await pool.query(
            'SELECT severity, status FROM civos_signals WHERE id = $1',
            [id]
        );

        if (currentSignal.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Signal not found' });
        }

        const result = await pool.query(`
            UPDATE civos_signals
            SET status = 'resolved', resolved_at = NOW(), updated_at = NOW()
            WHERE id = $1
            RETURNING id, signal_code, status
        `, [id]);

        await pool.query(`
            INSERT INTO civos_signal_history (signal_id, previous_status, new_status, change_reason, changed_by)
            VALUES ($1, $2, 'resolved', $3, $4)
        `, [id, currentSignal.rows[0].status, reason || 'Manually resolved', req.user!.email]);

        res.json({ success: true, signal: result.rows[0] });

    } catch (error: any) {
        console.error('Resolve signal error:', error);
        res.status(500).json({ success: false, error: 'Failed to resolve signal' });
    }
});

router.get('/stats', async (req: Request, res: Response) => {
    try {
        const statsResult = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM civos_signals WHERE status = 'active') as active_signals,
                (SELECT COUNT(*) FROM civos_signals WHERE status = 'active' AND severity = 'critical') as critical_signals,
                (SELECT COUNT(*) FROM civos_signals WHERE status = 'active' AND severity = 'high') as high_signals,
                (SELECT COUNT(*) FROM civos_signals WHERE status = 'resolved' AND resolved_at > NOW() - INTERVAL '24 hours') as resolved_24h,
                (SELECT COUNT(DISTINCT region) FROM civos_signals WHERE status = 'active') as regions_with_signals
        `);

        const capacityResult = await pool.query(`
            SELECT 
                COUNT(*) as total_properties,
                COALESCE(SUM(total_spots), 0) as total_spots,
                COUNT(*) FILTER (WHERE has_onsite_mechanic) as with_mechanic
            FROM staging_properties
            WHERE status = 'active'
        `);

        res.json({
            success: true,
            stats: {
                signals: {
                    active: parseInt(statsResult.rows[0].active_signals),
                    critical: parseInt(statsResult.rows[0].critical_signals),
                    high: parseInt(statsResult.rows[0].high_signals),
                    resolved24h: parseInt(statsResult.rows[0].resolved_24h),
                    regionsAffected: parseInt(statsResult.rows[0].regions_with_signals)
                },
                capacity: {
                    properties: parseInt(capacityResult.rows[0].total_properties),
                    spots: parseInt(capacityResult.rows[0].total_spots),
                    withMechanic: parseInt(capacityResult.rows[0].with_mechanic)
                }
            }
        });

    } catch (error: any) {
        console.error('Get stats error:', error);
        res.status(500).json({ success: false, error: 'Failed to get stats' });
    }
});

router.get('/config', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query('SELECT key, value, description FROM civos_config');
        
        const config: Record<string, any> = {};
        result.rows.forEach(row => {
            config[row.key] = {
                value: row.value,
                description: row.description
            };
        });

        res.json({ success: true, config });

    } catch (error: any) {
        res.status(500).json({ success: false, error: 'Failed to get config' });
    }
});

export default router;
