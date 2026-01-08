import express, { Response } from 'express';
import { serviceQuery } from '../db/tenantDb';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

router.use(authenticateToken);

router.get('/properties', async (req: AuthRequest, res: Response) => {
    try {
        const result = await serviceQuery(`
            SELECT 
                p.*,
                ph.role,
                ph.can_edit_property,
                ph.can_manage_bookings,
                ph.can_view_revenue,
                ph.is_primary_contact,
                (SELECT COUNT(*) FROM cc_staging_bookings b 
                 WHERE b.property_id = p.id AND b.status = 'pending') as pending_bookings,
                (SELECT COUNT(*) FROM cc_staging_bookings b 
                 WHERE b.property_id = p.id AND b.status = 'confirmed' 
                 AND b.check_in_date <= CURRENT_DATE AND b.check_out_date > CURRENT_DATE) as active_guests,
                (SELECT COALESCE(SUM(b.total_cost), 0) FROM cc_staging_bookings b 
                 WHERE b.property_id = p.id AND b.status IN ('confirmed', 'completed')
                 AND b.created_at >= DATE_TRUNC('month', CURRENT_DATE)) as month_revenue
            FROM cc_staging_properties p
            JOIN cc_staging_property_hosts ph ON ph.property_id = p.id
            WHERE ph.user_id = $1
            ORDER BY p.name
        `, [req.user!.id]);

        res.json({
            success: true,
            properties: result.rows.map(p => ({
                id: p.id,
                name: p.name,
                city: p.city,
                region: p.region,
                status: p.status,
                totalSpots: p.total_spots,
                thumbnailUrl: p.thumbnail_url,
                role: p.role,
                canEdit: p.can_edit_property,
                canManageBookings: p.can_manage_bookings,
                canViewRevenue: p.can_view_revenue,
                isPrimaryContact: p.is_primary_contact,
                pendingBookings: parseInt(p.pending_bookings),
                activeGuests: parseInt(p.active_guests),
                monthRevenue: parseFloat(p.month_revenue)
            }))
        });

    } catch (error: any) {
        console.error('Get host properties error:', error);
        res.status(500).json({ success: false, error: 'Failed to load properties' });
    }
});

router.get('/properties/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const accessCheck = await serviceQuery(
            'SELECT role FROM cc_staging_property_hosts WHERE property_id = $1 AND user_id = $2',
            [id, req.user!.id]
        );

        if (accessCheck.rows.length === 0) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        const propResult = await serviceQuery('SELECT * FROM cc_staging_properties WHERE id = $1', [id]);
        if (propResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Property not found' });
        }

        const pricingResult = await serviceQuery(
            'SELECT * FROM cc_staging_pricing WHERE property_id = $1 ORDER BY pricing_type',
            [id]
        );

        const spotsResult = await serviceQuery(
            'SELECT * FROM cc_staging_spots WHERE property_id = $1 ORDER BY name',
            [id]
        );

        res.json({
            success: true,
            property: propResult.rows[0],
            pricing: pricingResult.rows,
            spots: spotsResult.rows
        });

    } catch (error: any) {
        console.error('Get host property error:', error);
        res.status(500).json({ success: false, error: 'Failed to load property' });
    }
});

router.get('/bookings', async (req: AuthRequest, res: Response) => {
    try {
        const { propertyId, status, startDate, endDate } = req.query;

        let query = `
            SELECT 
                b.*,
                p.name as property_name,
                p.city
            FROM cc_staging_bookings b
            JOIN cc_staging_properties p ON p.id = b.property_id
            JOIN cc_staging_property_hosts ph ON ph.property_id = p.id
            WHERE ph.user_id = $1
        `;
        const params: any[] = [req.user!.id];
        let paramCount = 1;

        if (propertyId) {
            paramCount++;
            query += ` AND b.property_id = $${paramCount}`;
            params.push(propertyId);
        }

        if (status) {
            paramCount++;
            query += ` AND b.status = $${paramCount}`;
            params.push(status);
        }

        if (startDate) {
            paramCount++;
            query += ` AND b.check_in_date >= $${paramCount}`;
            params.push(startDate);
        }

        if (endDate) {
            paramCount++;
            query += ` AND b.check_out_date <= $${paramCount}`;
            params.push(endDate);
        }

        query += ' ORDER BY b.check_in_date DESC';

        const result = await serviceQuery(query, params);

        res.json({
            success: true,
            bookings: result.rows.map(b => ({
                id: b.id,
                bookingRef: b.confirmation_number,
                propertyId: b.property_id,
                propertyName: b.property_name,
                city: b.city,
                guestName: b.guest_name,
                guestEmail: b.guest_email,
                guestPhone: b.guest_phone,
                companyName: b.company_name,
                checkInDate: b.check_in_date,
                checkOutDate: b.check_out_date,
                numNights: b.num_nights,
                numAdults: b.num_adults,
                numChildren: b.num_children,
                numPets: b.num_pets,
                vehicleDescription: b.vehicle_description,
                vehicleLengthFt: b.vehicle_length_ft,
                specialRequests: b.special_requests,
                totalCost: parseFloat(b.total_cost),
                status: b.status,
                createdAt: b.created_at
            }))
        });

    } catch (error: any) {
        console.error('Get host bookings error:', error);
        res.status(500).json({ success: false, error: 'Failed to load bookings' });
    }
});

router.put('/bookings/:id/status', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;

        const accessCheck = await serviceQuery(`
            SELECT b.id FROM cc_staging_bookings b
            JOIN cc_staging_property_hosts ph ON ph.property_id = b.property_id
            WHERE b.id = $1 AND ph.user_id = $2 AND ph.can_manage_bookings = true
        `, [id, req.user!.id]);

        if (accessCheck.rows.length === 0) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed', 'no_show'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, error: 'Invalid status' });
        }

        const result = await serviceQuery(`
            UPDATE cc_staging_bookings 
            SET status = $2, 
                host_notes = COALESCE($3, host_notes),
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, confirmation_number, status
        `, [id, status, notes]);

        res.json({ success: true, booking: result.rows[0] });

    } catch (error: any) {
        console.error('Update booking status error:', error);
        res.status(500).json({ success: false, error: 'Failed to update booking' });
    }
});

router.get('/properties/:id/calendar', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { startDate, endDate } = req.query;

        const accessCheck = await serviceQuery(
            'SELECT role FROM cc_staging_property_hosts WHERE property_id = $1 AND user_id = $2',
            [id, req.user!.id]
        );

        if (accessCheck.rows.length === 0) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        const start = startDate || new Date().toISOString().split('T')[0];
        const end = endDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const bookingsResult = await serviceQuery(`
            SELECT id, confirmation_number, guest_name, check_in_date, check_out_date, status, num_nights
            FROM cc_staging_bookings
            WHERE property_id = $1 
            AND status IN ('pending', 'confirmed')
            AND check_out_date >= $2 AND check_in_date <= $3
            ORDER BY check_in_date
        `, [id, start, end]);

        const blocksResult = await serviceQuery(`
            SELECT id, block_type, title, start_date, end_date
            FROM cc_staging_calendar_blocks
            WHERE property_id = $1 
            AND end_date >= $2 AND start_date <= $3
            ORDER BY start_date
        `, [id, start, end]);

        const overridesResult = await serviceQuery(`
            SELECT id, name, override_type, start_date, end_date, nightly_rate, rate_multiplier
            FROM cc_cc_staging_pricing_overrides
            WHERE property_id = $1 
            AND end_date >= $2 AND start_date <= $3
            AND is_active = true
            ORDER BY start_date
        `, [id, start, end]);

        res.json({
            success: true,
            calendar: {
                startDate: start,
                endDate: end,
                bookings: bookingsResult.rows,
                blocks: blocksResult.rows,
                pricingOverrides: overridesResult.rows
            }
        });

    } catch (error: any) {
        console.error('Get calendar error:', error);
        res.status(500).json({ success: false, error: 'Failed to load calendar' });
    }
});

router.post('/properties/:id/blocks', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { blockType, title, description, startDate, endDate, spotId } = req.body;

        const accessCheck = await serviceQuery(
            'SELECT role FROM cc_staging_property_hosts WHERE property_id = $1 AND user_id = $2 AND can_manage_calendar = true',
            [id, req.user!.id]
        );

        if (accessCheck.rows.length === 0) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        if (!blockType || !startDate || !endDate) {
            return res.status(400).json({ success: false, error: 'Block type and dates required' });
        }

        const result = await serviceQuery(`
            INSERT INTO cc_staging_calendar_blocks 
            (property_id, spot_id, block_type, title, description, start_date, end_date, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [id, spotId || null, blockType, title, description, startDate, endDate, req.user!.id]);

        res.status(201).json({ success: true, block: result.rows[0] });

    } catch (error: any) {
        console.error('Add block error:', error);
        res.status(500).json({ success: false, error: 'Failed to add block' });
    }
});

router.delete('/properties/:id/blocks/:blockId', async (req: AuthRequest, res: Response) => {
    try {
        const { id, blockId } = req.params;

        const accessCheck = await serviceQuery(
            'SELECT role FROM cc_staging_property_hosts WHERE property_id = $1 AND user_id = $2 AND can_manage_calendar = true',
            [id, req.user!.id]
        );

        if (accessCheck.rows.length === 0) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        const result = await serviceQuery(
            'DELETE FROM cc_staging_calendar_blocks WHERE id = $1 AND property_id = $2 RETURNING id',
            [blockId, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Block not found' });
        }

        res.json({ success: true, message: 'Block removed' });

    } catch (error: any) {
        console.error('Delete block error:', error);
        res.status(500).json({ success: false, error: 'Failed to remove block' });
    }
});

router.post('/properties/:id/pricing-overrides', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { overrideType, name, description, startDate, endDate, nightlyRate, rateMultiplier, minimumNights } = req.body;

        const accessCheck = await serviceQuery(
            'SELECT role FROM cc_staging_property_hosts WHERE property_id = $1 AND user_id = $2',
            [id, req.user!.id]
        );

        if (accessCheck.rows.length === 0) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        if (!overrideType || !startDate || !endDate) {
            return res.status(400).json({ success: false, error: 'Override type and dates required' });
        }

        const result = await serviceQuery(`
            INSERT INTO cc_cc_staging_pricing_overrides 
            (property_id, override_type, name, description, start_date, end_date, nightly_rate, rate_multiplier, minimum_nights, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `, [id, overrideType, name, description, startDate, endDate, nightlyRate, rateMultiplier, minimumNights, req.user!.id]);

        res.status(201).json({ success: true, override: result.rows[0] });

    } catch (error: any) {
        console.error('Add pricing override error:', error);
        res.status(500).json({ success: false, error: 'Failed to add pricing override' });
    }
});

router.delete('/properties/:id/pricing-overrides/:overrideId', async (req: AuthRequest, res: Response) => {
    try {
        const { id, overrideId } = req.params;

        const accessCheck = await serviceQuery(
            'SELECT role FROM cc_staging_property_hosts WHERE property_id = $1 AND user_id = $2',
            [id, req.user!.id]
        );

        if (accessCheck.rows.length === 0) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        const result = await serviceQuery(
            'DELETE FROM cc_cc_staging_pricing_overrides WHERE id = $1 AND property_id = $2 RETURNING id',
            [overrideId, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Override not found' });
        }

        res.json({ success: true, message: 'Override removed' });

    } catch (error: any) {
        console.error('Delete pricing override error:', error);
        res.status(500).json({ success: false, error: 'Failed to remove override' });
    }
});

router.get('/notifications', async (req: AuthRequest, res: Response) => {
    try {
        const { unreadOnly } = req.query;

        let query = `
            SELECT n.*, p.name as property_name
            FROM cc_staging_host_notifications n
            LEFT JOIN cc_staging_properties p ON p.id = n.property_id
            WHERE n.user_id = $1
        `;

        if (unreadOnly === 'true') {
            query += ' AND n.is_read = false';
        }

        query += ' ORDER BY n.created_at DESC LIMIT 50';

        const result = await serviceQuery(query, [req.user!.id]);

        res.json({
            success: true,
            notifications: result.rows.map(n => ({
                id: n.id,
                type: n.notification_type,
                title: n.title,
                message: n.message,
                propertyId: n.property_id,
                propertyName: n.property_name,
                relatedType: n.related_type,
                relatedId: n.related_id,
                isRead: n.is_read,
                createdAt: n.created_at
            }))
        });

    } catch (error: any) {
        console.error('Get notifications error:', error);
        res.status(500).json({ success: false, error: 'Failed to load notifications' });
    }
});

router.put('/notifications/:id/read', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        await serviceQuery(
            'UPDATE cc_staging_host_notifications SET is_read = true, read_at = NOW() WHERE id = $1 AND user_id = $2',
            [id, req.user!.id]
        );

        res.json({ success: true });

    } catch (error: any) {
        console.error('Mark notification read error:', error);
        res.status(500).json({ success: false, error: 'Failed to update notification' });
    }
});

router.put('/notifications/read-all', async (req: AuthRequest, res: Response) => {
    try {
        await serviceQuery(
            'UPDATE cc_staging_host_notifications SET is_read = true, read_at = NOW() WHERE user_id = $1 AND is_read = false',
            [req.user!.id]
        );

        res.json({ success: true, message: 'All notifications marked as read' });

    } catch (error: any) {
        console.error('Mark all read error:', error);
        res.status(500).json({ success: false, error: 'Failed to update notifications' });
    }
});

router.get('/dashboard/stats', async (req: AuthRequest, res: Response) => {
    try {
        const statsResult = await serviceQuery(`
            SELECT 
                COUNT(DISTINCT p.id) as total_properties,
                COALESCE(SUM(p.total_spots), 0) as total_spots,
                (SELECT COUNT(*) FROM cc_staging_bookings b 
                 JOIN cc_staging_property_hosts ph ON ph.property_id = b.property_id 
                 WHERE ph.user_id = $1 AND b.status = 'pending') as pending_bookings,
                (SELECT COUNT(*) FROM cc_staging_bookings b 
                 JOIN cc_staging_property_hosts ph ON ph.property_id = b.property_id 
                 WHERE ph.user_id = $1 AND b.status = 'confirmed'
                 AND b.check_in_date <= CURRENT_DATE AND b.check_out_date > CURRENT_DATE) as active_guests,
                (SELECT COALESCE(SUM(b.total_cost), 0) FROM cc_staging_bookings b 
                 JOIN cc_staging_property_hosts ph ON ph.property_id = b.property_id 
                 WHERE ph.user_id = $1 AND b.status IN ('confirmed', 'completed')
                 AND b.created_at >= DATE_TRUNC('month', CURRENT_DATE)) as month_revenue,
                (SELECT COUNT(*) FROM cc_staging_host_notifications n 
                 WHERE n.user_id = $1 AND n.is_read = false) as unread_notifications
            FROM cc_staging_properties p
            JOIN cc_staging_property_hosts ph ON ph.property_id = p.id
            WHERE ph.user_id = $1
        `, [req.user!.id]);

        const stats = statsResult.rows[0];

        res.json({
            success: true,
            stats: {
                totalProperties: parseInt(stats.total_properties) || 0,
                totalSpots: parseInt(stats.total_spots) || 0,
                pendingBookings: parseInt(stats.pending_bookings) || 0,
                activeGuests: parseInt(stats.active_guests) || 0,
                monthRevenue: parseFloat(stats.month_revenue) || 0,
                unreadNotifications: parseInt(stats.unread_notifications) || 0
            }
        });

    } catch (error: any) {
        console.error('Get dashboard stats error:', error);
        res.status(500).json({ success: false, error: 'Failed to load stats' });
    }
});

export default router;
