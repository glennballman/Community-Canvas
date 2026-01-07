import express, { Request, Response } from 'express';
import { PoolClient } from 'pg';
import { serviceQuery, withServiceTransaction } from '../db/tenantDb';
import { requireAuth, requireRole } from '../middleware/guards';
import { TenantRequest } from '../middleware/tenantContext';

const router = express.Router();

// SERVICE MODE: Authorization helper - checks cross-tenant access using serviceQuery
// Justification: Access control must evaluate ownership across individual users and business tenants
async function canAccessVehicle(req: Request, vehicleId: string): Promise<boolean> {
    const tenantReq = req as TenantRequest;
    const userId = tenantReq.ctx?.individual_id;
    const isAdmin = tenantReq.ctx?.roles?.includes('admin');
    
    if (isAdmin) return true;
    if (!userId) return false;
    
    const result = await serviceQuery(`
        SELECT v.id FROM cc_vehicles v
        WHERE v.id = $1
        AND (
            (v.owner_type = 'individual' AND v.owner_user_id = $2)
            OR (v.owner_type = 'business' AND v.owner_tenant_id IN (
                SELECT tenant_id FROM cc_tenant_users WHERE user_id = $2 AND status = 'active'
            ))
            OR v.id IN (
                SELECT vehicle_id FROM cc_vehicle_driver_assignments WHERE user_id = $2 AND is_active = true
            )
        )
    `, [vehicleId, userId]);
    
    return result.rows.length > 0;
}

// SERVICE MODE: Authorization helper - checks cross-tenant trailer access
// Justification: Access control must evaluate ownership across individual users and business tenants
async function canAccessTrailer(req: Request, trailerId: string): Promise<boolean> {
    const tenantReq = req as TenantRequest;
    const userId = tenantReq.ctx?.individual_id;
    const isAdmin = tenantReq.ctx?.roles?.includes('admin');
    
    if (isAdmin) return true;
    if (!userId) return false;
    
    const result = await serviceQuery(`
        SELECT t.id FROM cc_trailers t
        WHERE t.id = $1
        AND (
            (t.owner_type = 'individual' AND t.owner_user_id = $2)
            OR (t.owner_type = 'business' AND t.owner_tenant_id IN (
                SELECT tenant_id FROM cc_tenant_users WHERE user_id = $2 AND status = 'active'
            ))
        )
    `, [trailerId, userId]);
    
    return result.rows.length > 0;
}

// GET /api/vehicles - List vehicles accessible to user
router.get('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const tenantReq = req as TenantRequest;
        const { ownerType, status, type, search, tenantId } = req.query;
        const userId = tenantReq.ctx.individual_id!;
        const isAdmin = tenantReq.ctx.roles?.includes('admin');

        let query = `
            SELECT 
                v.*,
                CASE v.owner_type
                    WHEN 'individual' THEN u.given_name || ' ' || u.family_name
                    WHEN 'business' THEN t.name
                END as owner_name
            FROM cc_vehicles v
            LEFT JOIN cc_users u ON v.owner_type = 'individual' AND v.owner_user_id = u.id
            LEFT JOIN cc_tenants t ON v.owner_type = 'business' AND v.owner_tenant_id = t.id
            WHERE 1=1
        `;
        const params: any[] = [];
        let paramCount = 0;

        if (!isAdmin) {
            paramCount++;
            query += ` AND (
                (v.owner_type = 'individual' AND v.owner_user_id = $${paramCount})
                OR (v.owner_type = 'business' AND v.owner_tenant_id IN (
                    SELECT tenant_id FROM cc_tenant_users WHERE user_id = $${paramCount} AND status = 'active'
                ))
                OR v.id IN (
                    SELECT vehicle_id FROM cc_vehicle_driver_assignments WHERE user_id = $${paramCount} AND is_active = true
                )
            )`;
            params.push(userId);
        }

        if (tenantId) {
            paramCount++;
            query += ` AND v.owner_tenant_id = $${paramCount}`;
            params.push(tenantId);
        }

        if (ownerType) {
            paramCount++;
            query += ` AND v.owner_type = $${paramCount}`;
            params.push(ownerType);
        }

        if (status) {
            paramCount++;
            query += ` AND v.status = $${paramCount}`;
            params.push(status);
        }

        if (type) {
            paramCount++;
            query += ` AND v.vehicle_type = $${paramCount}`;
            params.push(type);
        }

        if (search) {
            paramCount++;
            query += ` AND (v.name ILIKE $${paramCount} OR v.make ILIKE $${paramCount} OR v.model ILIKE $${paramCount} OR v.license_plate ILIKE $${paramCount})`;
            params.push(`%${search}%`);
        }

        query += ' ORDER BY v.name, v.created_at DESC';

        // User-scoped read: vehicles visible to this user
        const result = await req.tenantQuery(query, params);

        res.json({
            success: true,
            count: result.rows.length,
            vehicles: result.rows
        });

    } catch (error: any) {
        console.error('List vehicles error:', error);
        res.status(500).json({ success: false, error: 'Failed to list vehicles' });
    }
});

// GET /api/vehicles/my - Get user's personal vehicles only
router.get('/my', requireAuth, async (req: Request, res: Response) => {
    try {
        const tenantReq = req as TenantRequest;
        const userId = tenantReq.ctx.individual_id!;

        // User-scoped read: only this user's personal vehicles
        const result = await req.tenantQuery(`
            SELECT * FROM cc_vehicles 
            WHERE owner_type = 'individual' AND owner_user_id = $1
            ORDER BY name
        `, [userId]);

        res.json({
            success: true,
            count: result.rows.length,
            vehicles: result.rows
        });

    } catch (error: any) {
        console.error('Get my vehicles error:', error);
        res.status(500).json({ success: false, error: 'Failed to get vehicles' });
    }
});

// GET /api/vehicles/stats - Vehicle/trailer statistics (MUST be before /:id)
router.get('/stats', requireAuth, async (req: Request, res: Response) => {
    try {
        const tenantReq = req as TenantRequest;
        const userId = tenantReq.ctx.individual_id!;
        const isAdmin = tenantReq.ctx.roles?.includes('admin');

        let vehicleQuery = `SELECT COUNT(*) as count, vehicle_type, status FROM cc_vehicles WHERE 1=1`;
        let trailerQuery = `SELECT COUNT(*) as count, trailer_type, status FROM cc_trailers WHERE 1=1`;
        const params: any[] = [];

        if (!isAdmin) {
            vehicleQuery += ` AND (
                (owner_type = 'individual' AND owner_user_id = $1)
                OR (owner_type = 'business' AND owner_tenant_id IN (
                    SELECT tenant_id FROM cc_tenant_users WHERE user_id = $1 AND status = 'active'
                ))
            )`;
            trailerQuery += ` AND (
                (owner_type = 'individual' AND owner_user_id = $1)
                OR (owner_type = 'business' AND owner_tenant_id IN (
                    SELECT tenant_id FROM cc_tenant_users WHERE user_id = $1 AND status = 'active'
                ))
            )`;
            params.push(userId);
        }

        vehicleQuery += ' GROUP BY vehicle_type, status';
        trailerQuery += ' GROUP BY trailer_type, status';

        // User-scoped reads: statistics for vehicles/trailers accessible to this user
        const vehicleStats = await req.tenantQuery(vehicleQuery, params);
        const trailerStats = await req.tenantQuery(trailerQuery, params);

        const totalVehicles = vehicleStats.rows.reduce((sum: number, r: any) => sum + parseInt(r.count), 0);
        const totalTrailers = trailerStats.rows.reduce((sum: number, r: any) => sum + parseInt(r.count), 0);

        res.json({
            success: true,
            stats: {
                totalVehicles,
                totalTrailers,
                vehiclesByType: vehicleStats.rows,
                trailersByType: trailerStats.rows
            }
        });

    } catch (error: any) {
        console.error('Get stats error:', error);
        res.status(500).json({ success: false, error: 'Failed to get stats' });
    }
});

// GET /api/vehicles/:id - Get vehicle details
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (['my', 'trailers', 'fleets', 'stats'].includes(id)) {
            return res.status(400).json({ success: false, error: 'Invalid vehicle ID' });
        }

        const hasAccess = await canAccessVehicle(req, id);
        if (!hasAccess) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        // User-scoped read: vehicle details after authorization check
        const vehicleResult = await req.tenantQuery(`
            SELECT v.*, 
                CASE v.owner_type
                    WHEN 'individual' THEN u.given_name || ' ' || u.family_name
                    WHEN 'business' THEN t.name
                END as owner_name
            FROM cc_vehicles v
            LEFT JOIN cc_users u ON v.owner_type = 'individual' AND v.owner_user_id = u.id
            LEFT JOIN cc_tenants t ON v.owner_type = 'business' AND v.owner_tenant_id = t.id
            WHERE v.id = $1
        `, [id]);

        if (vehicleResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Vehicle not found' });
        }

        const fleetResult = await req.tenantQuery(`
            SELECT f.id, f.name, fva.assigned_at
            FROM cc_fleet_vehicle_assignments fva
            JOIN cc_fleets f ON f.id = fva.fleet_id
            WHERE fva.vehicle_id = $1 AND fva.is_active = true
        `, [id]);

        const driverResult = await req.tenantQuery(`
            SELECT u.id, u.given_name, u.family_name, u.email, vda.assignment_type, vda.valid_from
            FROM cc_vehicle_driver_assignments vda
            JOIN cc_users u ON u.id = vda.user_id
            WHERE vda.vehicle_id = $1 AND vda.is_active = true
        `, [id]);

        const maintenanceResult = await req.tenantQuery(`
            SELECT * FROM cc_maintenance_records
            WHERE vehicle_id = $1
            ORDER BY service_date DESC
            LIMIT 5
        `, [id]);

        res.json({
            success: true,
            vehicle: vehicleResult.rows[0],
            fleets: fleetResult.rows,
            drivers: driverResult.rows,
            recentMaintenance: maintenanceResult.rows
        });

    } catch (error: any) {
        console.error('Get vehicle error:', error);
        res.status(500).json({ success: false, error: 'Failed to get vehicle' });
    }
});

// POST /api/vehicles - Create vehicle
router.post('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const tenantReq = req as TenantRequest;
        const userId = tenantReq.ctx.individual_id!;
        const isAdmin = tenantReq.ctx.roles?.includes('admin');

        const {
            ownerType = 'individual',
            ownerTenantId,
            name, vin, licensePlate, licensePlateProvince,
            year, make, model, trim, color, vehicleType, fuelType,
            lengthFt, widthFt, heightFt, gvwrLbs, towingCapacityLbs,
            hasHitch, hitchClass, hitchType, brakeController,
            isRv, rvClass, slideOuts,
            isCommercial,
            status = 'available',
            notes
        } = req.body;

        let ownerUserId = null;
        let ownerTenant = null;

        if (ownerType === 'individual') {
            ownerUserId = userId;
        } else if (ownerType === 'business') {
            // SERVICE MODE: Check tenant access across business boundaries
            const tenantAccess = await serviceQuery(`
                SELECT 1 FROM cc_tenant_users 
                WHERE tenant_id = $1 AND user_id = $2 AND status = 'active'
                AND role IN ('owner', 'admin', 'fleet_manager')
            `, [ownerTenantId, userId]);

            if (tenantAccess.rows.length === 0 && !isAdmin) {
                return res.status(403).json({ success: false, error: 'Cannot add vehicle to this business' });
            }
            ownerTenant = ownerTenantId;
        }

        // User-scoped mutation: create vehicle in transaction
        const result = await req.tenantTransaction(async (client: PoolClient) => {
            const vehicleResult = await client.query(`
                INSERT INTO cc_vehicles (
                    owner_type, owner_user_id, owner_tenant_id,
                    name, vin, license_plate, license_plate_province,
                    year, make, model, trim, color, vehicle_type, fuel_type,
                    length_ft, width_ft, height_ft, gvwr_lbs, towing_capacity_lbs,
                    has_hitch, hitch_class, hitch_type, brake_controller,
                    is_rv, rv_class, slide_outs, is_commercial, status, notes
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                    $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29
                ) RETURNING *
            `, [
                ownerType, ownerUserId, ownerTenant,
                name, vin, licensePlate, licensePlateProvince,
                year, make, model, trim, color, vehicleType, fuelType,
                lengthFt, widthFt, heightFt, gvwrLbs, towingCapacityLbs,
                hasHitch, hitchClass, hitchType, brakeController,
                isRv, rvClass, slideOuts, isCommercial, status, notes
            ]);

            if (ownerType === 'individual') {
                await client.query(`
                    INSERT INTO cc_vehicle_driver_assignments (vehicle_id, user_id, assignment_type, assigned_by)
                    VALUES ($1, $2, 'primary', $2)
                `, [vehicleResult.rows[0].id, ownerUserId]);
            }

            return vehicleResult.rows[0];
        });

        res.status(201).json({
            success: true,
            vehicle: result
        });

    } catch (error: any) {
        console.error('Create vehicle error:', error);
        res.status(500).json({ success: false, error: 'Failed to create vehicle' });
    }
});

// PUT /api/vehicles/:id - Update vehicle
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const hasAccess = await canAccessVehicle(req, id);
        if (!hasAccess) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        const fields = req.body;
        const allowedFields = [
            'name', 'vin', 'license_plate', 'license_plate_province',
            'year', 'make', 'model', 'trim', 'color', 'vehicle_type', 'fuel_type',
            'length_ft', 'width_ft', 'height_ft', 'gvwr_lbs', 'towing_capacity_lbs',
            'has_hitch', 'hitch_class', 'hitch_type', 'brake_controller',
            'is_rv', 'rv_class', 'slide_outs', 'is_commercial', 'status', 'notes', 'current_odometer'
        ];

        const updates: string[] = [];
        const params: any[] = [id];
        let paramCount = 1;

        for (const [key, value] of Object.entries(fields)) {
            const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            if (allowedFields.includes(snakeKey)) {
                paramCount++;
                updates.push(`${snakeKey} = $${paramCount}`);
                params.push(value);
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({ success: false, error: 'No valid fields to update' });
        }

        updates.push('updated_at = NOW()');

        // User-scoped mutation: update vehicle in transaction
        const result = await req.tenantTransaction(async (client: PoolClient) => {
            const updateResult = await client.query(
                `UPDATE cc_vehicles SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
                params
            );
            return updateResult.rows[0];
        });

        res.json({ success: true, vehicle: result });

    } catch (error: any) {
        console.error('Update vehicle error:', error);
        res.status(500).json({ success: false, error: 'Failed to update vehicle' });
    }
});

// DELETE /api/vehicles/:id
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
    try {
        const tenantReq = req as TenantRequest;
        const userId = tenantReq.ctx.individual_id!;
        const isAdmin = tenantReq.ctx.roles?.includes('admin');
        const { id } = req.params;

        // SERVICE MODE: Check vehicle existence and ownership across tenants
        const vehicle = await serviceQuery('SELECT * FROM cc_vehicles WHERE id = $1', [id]);
        if (vehicle.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Vehicle not found' });
        }

        const v = vehicle.rows[0];
        const canDelete = isAdmin || 
            (v.owner_type === 'individual' && v.owner_user_id === userId);

        if (!canDelete) {
            return res.status(403).json({ success: false, error: 'Only owner can delete vehicle' });
        }

        // User-scoped mutation: delete vehicle in transaction
        await req.tenantTransaction(async (client: PoolClient) => {
            await client.query('DELETE FROM cc_vehicles WHERE id = $1', [id]);
        });

        res.json({ success: true, message: 'Vehicle deleted' });

    } catch (error: any) {
        console.error('Delete vehicle error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete vehicle' });
    }
});

// TRAILER ROUTES

// GET /api/vehicles/trailers/list - List trailers
router.get('/trailers/list', requireAuth, async (req: Request, res: Response) => {
    try {
        const tenantReq = req as TenantRequest;
        const { ownerType, status, type, tenantId } = req.query;
        const userId = tenantReq.ctx.individual_id!;
        const isAdmin = tenantReq.ctx.roles?.includes('admin');

        let query = `
            SELECT t.*, 
                CASE t.owner_type
                    WHEN 'individual' THEN u.given_name || ' ' || u.family_name
                    WHEN 'business' THEN tn.name
                END as owner_name
            FROM cc_trailers t
            LEFT JOIN cc_users u ON t.owner_type = 'individual' AND t.owner_user_id = u.id
            LEFT JOIN cc_tenants tn ON t.owner_type = 'business' AND t.owner_tenant_id = tn.id
            WHERE 1=1
        `;
        const params: any[] = [];
        let paramCount = 0;

        if (!isAdmin) {
            paramCount++;
            query += ` AND (
                (t.owner_type = 'individual' AND t.owner_user_id = $${paramCount})
                OR (t.owner_type = 'business' AND t.owner_tenant_id IN (
                    SELECT tenant_id FROM cc_tenant_users WHERE user_id = $${paramCount} AND status = 'active'
                ))
            )`;
            params.push(userId);
        }

        if (tenantId) {
            paramCount++;
            query += ` AND t.owner_tenant_id = $${paramCount}`;
            params.push(tenantId);
        }

        if (ownerType) {
            paramCount++;
            query += ` AND t.owner_type = $${paramCount}`;
            params.push(ownerType);
        }

        if (status) {
            paramCount++;
            query += ` AND t.status = $${paramCount}`;
            params.push(status);
        }

        if (type) {
            paramCount++;
            query += ` AND t.trailer_type = $${paramCount}`;
            params.push(type);
        }

        query += ' ORDER BY t.name';

        // User-scoped read: trailers visible to this user
        const result = await req.tenantQuery(query, params);

        res.json({
            success: true,
            count: result.rows.length,
            trailers: result.rows
        });

    } catch (error: any) {
        console.error('List trailers error:', error);
        res.status(500).json({ success: false, error: 'Failed to list trailers' });
    }
});

// GET /api/vehicles/trailers/my - Get user's personal trailers
router.get('/trailers/my', requireAuth, async (req: Request, res: Response) => {
    try {
        const tenantReq = req as TenantRequest;
        const userId = tenantReq.ctx.individual_id!;

        // User-scoped read: only this user's personal trailers
        const result = await req.tenantQuery(`
            SELECT * FROM cc_trailers 
            WHERE owner_type = 'individual' AND owner_user_id = $1
            ORDER BY name
        `, [userId]);

        res.json({
            success: true,
            count: result.rows.length,
            trailers: result.rows
        });

    } catch (error: any) {
        console.error('Get my trailers error:', error);
        res.status(500).json({ success: false, error: 'Failed to get trailers' });
    }
});

// GET /api/vehicles/trailers/:id - Get trailer details
router.get('/trailers/:id', requireAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        
        if (['list', 'my'].includes(id)) {
            return res.status(400).json({ success: false, error: 'Invalid trailer ID' });
        }

        const hasAccess = await canAccessTrailer(req, id);
        if (!hasAccess) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        // User-scoped read: trailer details after authorization check
        const result = await req.tenantQuery(`
            SELECT t.*, 
                CASE t.owner_type
                    WHEN 'individual' THEN u.given_name || ' ' || u.family_name
                    WHEN 'business' THEN tn.name
                END as owner_name
            FROM cc_trailers t
            LEFT JOIN cc_users u ON t.owner_type = 'individual' AND t.owner_user_id = u.id
            LEFT JOIN cc_tenants tn ON t.owner_type = 'business' AND t.owner_tenant_id = tn.id
            WHERE t.id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Trailer not found' });
        }

        const fleetResult = await req.tenantQuery(`
            SELECT f.id, f.name, fta.assigned_at
            FROM cc_fleet_trailer_assignments fta
            JOIN cc_fleets f ON f.id = fta.fleet_id
            WHERE fta.trailer_id = $1 AND fta.is_active = true
        `, [id]);

        const maintenanceResult = await req.tenantQuery(`
            SELECT * FROM cc_maintenance_records
            WHERE trailer_id = $1
            ORDER BY service_date DESC
            LIMIT 5
        `, [id]);

        res.json({
            success: true,
            trailer: result.rows[0],
            fleets: fleetResult.rows,
            recentMaintenance: maintenanceResult.rows
        });

    } catch (error: any) {
        console.error('Get trailer error:', error);
        res.status(500).json({ success: false, error: 'Failed to get trailer' });
    }
});

// POST /api/vehicles/trailers - Create trailer
router.post('/trailers', requireAuth, async (req: Request, res: Response) => {
    try {
        const tenantReq = req as TenantRequest;
        const userId = tenantReq.ctx.individual_id!;
        const isAdmin = tenantReq.ctx.roles?.includes('admin');

        const {
            ownerType = 'individual',
            ownerTenantId,
            name, vin, serialNumber, licensePlate, licensePlateProvince,
            year, make, model, trailerType,
            lengthFt, widthFt, heightFt, deckHeightIn, gvwrLbs, payloadCapacityLbs,
            axleCount, axleType, hasBrakes, brakeType,
            hitchType, ballSizeInches, couplerHeightInches, tongueWeightLbs,
            hasRamps, rampType, hasSideDoor,
            isRv, hasLivingQuarters, sleeps,
            isLivestock, stallCount,
            status = 'available',
            notes
        } = req.body;

        let ownerUserId = null;
        let ownerTenant = null;

        if (ownerType === 'individual') {
            ownerUserId = userId;
        } else if (ownerType === 'business') {
            // SERVICE MODE: Check tenant access across business boundaries
            const tenantAccess = await serviceQuery(`
                SELECT 1 FROM cc_tenant_users 
                WHERE tenant_id = $1 AND user_id = $2 AND status = 'active'
                AND role IN ('owner', 'admin', 'fleet_manager')
            `, [ownerTenantId, userId]);

            if (tenantAccess.rows.length === 0 && !isAdmin) {
                return res.status(403).json({ success: false, error: 'Cannot add trailer to this business' });
            }
            ownerTenant = ownerTenantId;
        }

        // User-scoped mutation: create trailer in transaction
        const result = await req.tenantTransaction(async (client: PoolClient) => {
            const trailerResult = await client.query(`
                INSERT INTO cc_trailers (
                    owner_type, owner_user_id, owner_tenant_id,
                    name, vin, serial_number, license_plate, license_plate_province,
                    year, make, model, trailer_type,
                    length_ft, width_ft, height_ft, deck_height_in, gvwr_lbs, payload_capacity_lbs,
                    axle_count, axle_type, has_brakes, brake_type,
                    hitch_type, ball_size_inches, coupler_height_inches, tongue_weight_lbs,
                    has_ramps, ramp_type, has_side_door,
                    is_rv, has_living_quarters, sleeps,
                    is_livestock, stall_count,
                    status, notes
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
                    $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36
                ) RETURNING *
            `, [
                ownerType, ownerUserId, ownerTenant,
                name, vin, serialNumber, licensePlate, licensePlateProvince,
                year, make, model, trailerType,
                lengthFt, widthFt, heightFt, deckHeightIn, gvwrLbs, payloadCapacityLbs,
                axleCount, axleType, hasBrakes, brakeType,
                hitchType, ballSizeInches, couplerHeightInches, tongueWeightLbs,
                hasRamps, rampType, hasSideDoor,
                isRv, hasLivingQuarters, sleeps,
                isLivestock, stallCount,
                status, notes
            ]);
            return trailerResult.rows[0];
        });

        res.status(201).json({
            success: true,
            trailer: result
        });

    } catch (error: any) {
        console.error('Create trailer error:', error);
        res.status(500).json({ success: false, error: 'Failed to create trailer' });
    }
});

// PUT /api/vehicles/trailers/:id - Update trailer
router.put('/trailers/:id', requireAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const hasAccess = await canAccessTrailer(req, id);
        if (!hasAccess) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        const fields = req.body;
        const allowedFields = [
            'name', 'vin', 'serial_number', 'license_plate', 'license_plate_province',
            'year', 'make', 'model', 'trailer_type',
            'length_ft', 'width_ft', 'height_ft', 'deck_height_in', 'gvwr_lbs', 'payload_capacity_lbs',
            'axle_count', 'axle_type', 'has_brakes', 'brake_type',
            'hitch_type', 'ball_size_inches', 'coupler_height_inches', 'tongue_weight_lbs',
            'has_ramps', 'ramp_type', 'has_side_door',
            'is_rv', 'has_living_quarters', 'sleeps',
            'is_livestock', 'stall_count',
            'status', 'notes'
        ];

        const updates: string[] = [];
        const params: any[] = [id];
        let paramCount = 1;

        for (const [key, value] of Object.entries(fields)) {
            const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            if (allowedFields.includes(snakeKey)) {
                paramCount++;
                updates.push(`${snakeKey} = $${paramCount}`);
                params.push(value);
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({ success: false, error: 'No valid fields to update' });
        }

        updates.push('updated_at = NOW()');

        // User-scoped mutation: update trailer in transaction
        const result = await req.tenantTransaction(async (client: PoolClient) => {
            const updateResult = await client.query(
                `UPDATE cc_trailers SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
                params
            );
            return updateResult.rows[0];
        });

        res.json({ success: true, trailer: result });

    } catch (error: any) {
        console.error('Update trailer error:', error);
        res.status(500).json({ success: false, error: 'Failed to update trailer' });
    }
});

// DELETE /api/vehicles/trailers/:id
router.delete('/trailers/:id', requireAuth, async (req: Request, res: Response) => {
    try {
        const tenantReq = req as TenantRequest;
        const userId = tenantReq.ctx.individual_id!;
        const isAdmin = tenantReq.ctx.roles?.includes('admin');
        const { id } = req.params;

        // SERVICE MODE: Check trailer existence and ownership across tenants
        const trailer = await serviceQuery('SELECT * FROM cc_trailers WHERE id = $1', [id]);
        if (trailer.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Trailer not found' });
        }

        const t = trailer.rows[0];
        const canDelete = isAdmin || 
            (t.owner_type === 'individual' && t.owner_user_id === userId);

        if (!canDelete) {
            return res.status(403).json({ success: false, error: 'Only owner can delete trailer' });
        }

        // User-scoped mutation: delete trailer in transaction
        await req.tenantTransaction(async (client: PoolClient) => {
            await client.query('DELETE FROM cc_trailers WHERE id = $1', [id]);
        });

        res.json({ success: true, message: 'Trailer deleted' });

    } catch (error: any) {
        console.error('Delete trailer error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete trailer' });
    }
});

// FLEET ROUTES

// GET /api/vehicles/fleets/list - List fleets
router.get('/fleets/list', requireAuth, async (req: Request, res: Response) => {
    try {
        const tenantReq = req as TenantRequest;
        const userId = tenantReq.ctx.individual_id!;
        const isAdmin = tenantReq.ctx.roles?.includes('admin');

        let query = `SELECT * FROM v_fleet_summary WHERE 1=1`;
        const params: any[] = [];

        if (!isAdmin) {
            query += ` AND tenant_id IN (
                SELECT tenant_id FROM cc_tenant_users WHERE user_id = $1 AND status = 'active'
            )`;
            params.push(userId);
        }

        // User-scoped read: fleets visible to this user
        const result = await req.tenantQuery(query, params);

        res.json({
            success: true,
            count: result.rows.length,
            fleets: result.rows
        });

    } catch (error: any) {
        console.error('List fleets error:', error);
        res.status(500).json({ success: false, error: 'Failed to list fleets' });
    }
});

// GET /api/vehicles/fleets/:id - Get fleet details with vehicles and trailers
router.get('/fleets/:id', requireAuth, async (req: Request, res: Response) => {
    try {
        const tenantReq = req as TenantRequest;
        const userId = tenantReq.ctx.individual_id!;
        const isAdmin = tenantReq.ctx.roles?.includes('admin');
        const { id } = req.params;
        
        if (['list'].includes(id)) {
            return res.status(400).json({ success: false, error: 'Invalid fleet ID' });
        }

        // User-scoped read: fleet details
        const fleet = await req.tenantQuery(`
            SELECT f.*, t.name as tenant_name
            FROM cc_fleets f
            JOIN cc_tenants t ON t.id = f.tenant_id
            WHERE f.id = $1
        `, [id]);

        if (fleet.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Fleet not found' });
        }

        if (!isAdmin) {
            // SERVICE MODE: Check tenant access for fleet
            const access = await serviceQuery(`
                SELECT 1 FROM cc_tenant_users 
                WHERE tenant_id = $1 AND user_id = $2 AND status = 'active'
            `, [fleet.rows[0].tenant_id, userId]);

            if (access.rows.length === 0) {
                return res.status(403).json({ success: false, error: 'Access denied' });
            }
        }

        const vehicles = await req.tenantQuery(`
            SELECT v.*, fva.assigned_at
            FROM cc_fleet_vehicle_assignments fva
            JOIN cc_vehicles v ON v.id = fva.vehicle_id
            WHERE fva.fleet_id = $1 AND fva.is_active = true
        `, [id]);

        const trailers = await req.tenantQuery(`
            SELECT t.*, fta.assigned_at
            FROM cc_fleet_trailer_assignments fta
            JOIN cc_trailers t ON t.id = fta.trailer_id
            WHERE fta.fleet_id = $1 AND fta.is_active = true
        `, [id]);

        res.json({
            success: true,
            fleet: fleet.rows[0],
            vehicles: vehicles.rows,
            trailers: trailers.rows
        });

    } catch (error: any) {
        console.error('Get fleet error:', error);
        res.status(500).json({ success: false, error: 'Failed to get fleet' });
    }
});

// POST /api/vehicles/fleets - Create fleet
router.post('/fleets', requireAuth, async (req: Request, res: Response) => {
    try {
        const tenantReq = req as TenantRequest;
        const userId = tenantReq.ctx.individual_id!;
        const isAdmin = tenantReq.ctx.roles?.includes('admin');
        const { tenantId, name, description } = req.body;

        if (!tenantId || !name) {
            return res.status(400).json({ success: false, error: 'tenantId and name are required' });
        }

        // SERVICE MODE: Check tenant access for fleet creation
        const tenantAccess = await serviceQuery(`
            SELECT 1 FROM cc_tenant_users 
            WHERE tenant_id = $1 AND user_id = $2 AND status = 'active'
            AND role IN ('owner', 'admin', 'fleet_manager')
        `, [tenantId, userId]);

        if (tenantAccess.rows.length === 0 && !isAdmin) {
            return res.status(403).json({ success: false, error: 'Cannot create fleet for this business' });
        }

        // User-scoped mutation: create fleet in transaction
        const result = await req.tenantTransaction(async (client: PoolClient) => {
            const fleetResult = await client.query(`
                INSERT INTO cc_fleets (tenant_id, name, description)
                VALUES ($1, $2, $3)
                RETURNING *
            `, [tenantId, name, description]);
            return fleetResult.rows[0];
        });

        res.status(201).json({
            success: true,
            fleet: result
        });

    } catch (error: any) {
        console.error('Create fleet error:', error);
        res.status(500).json({ success: false, error: 'Failed to create fleet' });
    }
});

// POST /api/vehicles/fleets/:id/assign-vehicle
router.post('/fleets/:id/assign-vehicle', requireAuth, async (req: Request, res: Response) => {
    try {
        const tenantReq = req as TenantRequest;
        const userId = tenantReq.ctx.individual_id!;
        const { id } = req.params;
        const { vehicleId } = req.body;

        // SERVICE MODE: Check fleet existence
        const fleet = await serviceQuery('SELECT * FROM cc_fleets WHERE id = $1', [id]);
        if (fleet.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Fleet not found' });
        }

        const hasAccess = await canAccessVehicle(req, vehicleId);
        if (!hasAccess) {
            return res.status(403).json({ success: false, error: 'Cannot assign this vehicle' });
        }

        // User-scoped mutation: assign vehicle to fleet in transaction
        await req.tenantTransaction(async (client: PoolClient) => {
            await client.query(`
                INSERT INTO cc_fleet_vehicle_assignments (fleet_id, vehicle_id, assigned_by)
                VALUES ($1, $2, $3)
                ON CONFLICT (fleet_id, vehicle_id, is_active) DO NOTHING
            `, [id, vehicleId, userId]);
        });

        res.json({ success: true, message: 'Vehicle assigned to fleet' });

    } catch (error: any) {
        console.error('Assign vehicle error:', error);
        res.status(500).json({ success: false, error: 'Failed to assign vehicle' });
    }
});

// POST /api/vehicles/fleets/:id/assign-trailer
router.post('/fleets/:id/assign-trailer', requireAuth, async (req: Request, res: Response) => {
    try {
        const tenantReq = req as TenantRequest;
        const userId = tenantReq.ctx.individual_id!;
        const { id } = req.params;
        const { trailerId } = req.body;

        // SERVICE MODE: Check fleet existence
        const fleet = await serviceQuery('SELECT * FROM cc_fleets WHERE id = $1', [id]);
        if (fleet.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Fleet not found' });
        }

        const hasAccess = await canAccessTrailer(req, trailerId);
        if (!hasAccess) {
            return res.status(403).json({ success: false, error: 'Cannot assign this trailer' });
        }

        // User-scoped mutation: assign trailer to fleet in transaction
        await req.tenantTransaction(async (client: PoolClient) => {
            await client.query(`
                INSERT INTO cc_fleet_trailer_assignments (fleet_id, trailer_id, assigned_by)
                VALUES ($1, $2, $3)
                ON CONFLICT (fleet_id, trailer_id, is_active) DO NOTHING
            `, [id, trailerId, userId]);
        });

        res.json({ success: true, message: 'Trailer assigned to fleet' });

    } catch (error: any) {
        console.error('Assign trailer error:', error);
        res.status(500).json({ success: false, error: 'Failed to assign trailer' });
    }
});

export default router;
