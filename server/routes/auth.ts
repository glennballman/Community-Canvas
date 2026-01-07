import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { serviceQuery, withServiceTransaction } from '../db/tenantDb';
import { authenticateToken, generateTokens, AuthRequest, JWT_SECRET } from '../middleware/auth';
import jwt from 'jsonwebtoken';

const router = express.Router();

router.post('/register', async (req: Request, res: Response) => {
    try {
        const { email, password, firstName, lastName, phone, userType, companyName } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Email and password required' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ success: false, error: 'Invalid email format' });
        }

        if (password.length < 8) {
            return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
        }

        const existing = await serviceQuery(
            'SELECT id FROM staging_users WHERE email = $1',
            [email.toLowerCase()]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ success: false, error: 'Email already registered' });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const result = await serviceQuery(`
            INSERT INTO staging_users (
                email, password_hash, given_name, family_name, telephone,
                user_type, company_name
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, email, given_name, family_name, user_type
        `, [
            email.toLowerCase(),
            passwordHash,
            firstName || null,
            lastName || null,
            phone || null,
            userType || 'guest',
            companyName || null
        ]);

        const user = result.rows[0];

        const { accessToken, refreshToken } = generateTokens(user.id, user.email, user.user_type);

        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await serviceQuery(`
            INSERT INTO staging_sessions (user_id, refresh_token, expires_at)
            VALUES ($1, $2, $3)
        `, [user.id, refreshToken, expiresAt]);

        res.status(201).json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.given_name,
                lastName: user.family_name,
                userType: user.user_type
            },
            accessToken,
            refreshToken
        });

    } catch (error: any) {
        console.error('Register error:', error);
        res.status(500).json({ success: false, error: 'Registration failed' });
    }
});

router.post('/login', async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Email and password required' });
        }

        const result = await serviceQuery(`
            SELECT id, email, password_hash, given_name, family_name, user_type, status
            FROM staging_users WHERE email = $1
        `, [email.toLowerCase()]);

        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        const user = result.rows[0];

        if (user.status !== 'active') {
            return res.status(403).json({ success: false, error: 'Account is suspended' });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        await serviceQuery(`
            UPDATE staging_users 
            SET last_login_at = NOW(), login_count = login_count + 1
            WHERE id = $1
        `, [user.id]);

        const { accessToken, refreshToken } = generateTokens(user.id, user.email, user.user_type);

        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await serviceQuery(`
            INSERT INTO staging_sessions (user_id, refresh_token, expires_at)
            VALUES ($1, $2, $3)
        `, [user.id, refreshToken, expiresAt]);

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.given_name,
                lastName: user.family_name,
                userType: user.user_type
            },
            accessToken,
            refreshToken
        });

    } catch (error: any) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, error: 'Login failed' });
    }
});

router.post('/refresh', async (req: Request, res: Response) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ success: false, error: 'Refresh token required' });
        }

        let decoded: any;
        try {
            decoded = jwt.verify(refreshToken, JWT_SECRET);
        } catch (err) {
            return res.status(403).json({ success: false, error: 'Invalid refresh token' });
        }

        const sessionResult = await serviceQuery(`
            SELECT s.*, u.email, u.user_type, u.status
            FROM staging_sessions s
            JOIN staging_users u ON u.id = s.user_id
            WHERE s.refresh_token = $1 AND s.revoked_at IS NULL AND s.expires_at > NOW()
        `, [refreshToken]);

        if (sessionResult.rows.length === 0) {
            return res.status(403).json({ success: false, error: 'Session expired or revoked' });
        }

        const session = sessionResult.rows[0];

        if (session.status !== 'active') {
            return res.status(403).json({ success: false, error: 'Account is suspended' });
        }

        const { accessToken, refreshToken: newRefreshToken } = generateTokens(
            session.user_id, 
            session.email, 
            session.user_type
        );

        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await serviceQuery('UPDATE staging_sessions SET revoked_at = NOW() WHERE id = $1', [session.id]);
        await serviceQuery(`
            INSERT INTO staging_sessions (user_id, refresh_token, expires_at)
            VALUES ($1, $2, $3)
        `, [session.user_id, newRefreshToken, expiresAt]);

        res.json({
            success: true,
            accessToken,
            refreshToken: newRefreshToken
        });

    } catch (error: any) {
        console.error('Refresh error:', error);
        res.status(500).json({ success: false, error: 'Token refresh failed' });
    }
});

router.post('/logout', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { refreshToken } = req.body;

        if (refreshToken) {
            await serviceQuery(
                'UPDATE staging_sessions SET revoked_at = NOW() WHERE refresh_token = $1',
                [refreshToken]
            );
        }

        res.json({ success: true, message: 'Logged out successfully' });

    } catch (error: any) {
        console.error('Logout error:', error);
        res.status(500).json({ success: false, error: 'Logout failed' });
    }
});

router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const result = await serviceQuery(`
            SELECT id, email, given_name, family_name, telephone, avatar_url,
                   user_type, company_name, company_role,
                   email_verified, preferences, notification_settings,
                   created_at, last_login_at
            FROM staging_users WHERE id = $1
        `, [req.user!.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const user = result.rows[0];

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.given_name,
                lastName: user.family_name,
                phone: user.telephone,
                avatarUrl: user.avatar_url,
                userType: user.user_type,
                companyName: user.company_name,
                companyRole: user.company_role,
                emailVerified: user.email_verified,
                preferences: user.preferences,
                notificationSettings: user.notification_settings,
                createdAt: user.created_at,
                lastLoginAt: user.last_login_at
            }
        });

    } catch (error: any) {
        console.error('Get me error:', error);
        res.status(500).json({ success: false, error: 'Failed to get user' });
    }
});

router.put('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { firstName, lastName, phone, companyName, companyRole, preferences, notificationSettings } = req.body;

        const result = await serviceQuery(`
            UPDATE staging_users SET
                given_name = COALESCE($2, given_name),
                family_name = COALESCE($3, family_name),
                telephone = COALESCE($4, telephone),
                company_name = COALESCE($5, company_name),
                company_role = COALESCE($6, company_role),
                preferences = COALESCE($7, preferences),
                notification_settings = COALESCE($8, notification_settings),
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, email, given_name, family_name, telephone, user_type, company_name, company_role
        `, [
            req.user!.id,
            firstName,
            lastName,
            phone,
            companyName,
            companyRole,
            preferences ? JSON.stringify(preferences) : null,
            notificationSettings ? JSON.stringify(notificationSettings) : null
        ]);

        const user = result.rows[0];

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.given_name,
                lastName: user.family_name,
                phone: user.telephone,
                userType: user.user_type,
                companyName: user.company_name,
                companyRole: user.company_role
            }
        });

    } catch (error: any) {
        console.error('Update me error:', error);
        res.status(500).json({ success: false, error: 'Failed to update user' });
    }
});

router.post('/password/change', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, error: 'Current and new password required' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
        }

        const result = await serviceQuery(
            'SELECT password_hash FROM staging_users WHERE id = $1',
            [req.user!.id]
        );

        const validPassword = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
        if (!validPassword) {
            return res.status(401).json({ success: false, error: 'Current password is incorrect' });
        }

        const newHash = await bcrypt.hash(newPassword, 12);
        await serviceQuery(
            'UPDATE staging_users SET password_hash = $2, updated_at = NOW() WHERE id = $1',
            [req.user!.id, newHash]
        );

        await serviceQuery(
            'UPDATE staging_sessions SET revoked_at = NOW() WHERE user_id = $1',
            [req.user!.id]
        );

        res.json({ success: true, message: 'Password changed successfully' });

    } catch (error: any) {
        console.error('Password change error:', error);
        res.status(500).json({ success: false, error: 'Failed to change password' });
    }
});

router.post('/password/forgot', async (req: Request, res: Response) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, error: 'Email required' });
        }

        const result = await serviceQuery(
            'SELECT id FROM staging_users WHERE email = $1 AND status = $2',
            [email.toLowerCase(), 'active']
        );

        if (result.rows.length === 0) {
            return res.json({ success: true, message: 'If email exists, reset link will be sent' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

        await serviceQuery(`
            INSERT INTO staging_password_resets (user_id, token, expires_at)
            VALUES ($1, $2, $3)
        `, [result.rows[0].id, token, expiresAt]);

        console.log(`Password reset token for ${email}: ${token}`);

        res.json({ success: true, message: 'If email exists, reset link will be sent' });

    } catch (error: any) {
        console.error('Password forgot error:', error);
        res.status(500).json({ success: false, error: 'Failed to process request' });
    }
});

router.post('/password/reset', async (req: Request, res: Response) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ success: false, error: 'Token and new password required' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
        }

        const result = await serviceQuery(`
            SELECT pr.*, u.id as user_id
            FROM staging_password_resets pr
            JOIN staging_users u ON u.id = pr.user_id
            WHERE pr.token = $1 AND pr.expires_at > NOW() AND pr.used_at IS NULL
        `, [token]);

        if (result.rows.length === 0) {
            return res.status(400).json({ success: false, error: 'Invalid or expired reset token' });
        }

        const resetRecord = result.rows[0];
        const newHash = await bcrypt.hash(newPassword, 12);

        await serviceQuery(
            'UPDATE staging_users SET password_hash = $2, updated_at = NOW() WHERE id = $1',
            [resetRecord.user_id, newHash]
        );

        await serviceQuery(
            'UPDATE staging_password_resets SET used_at = NOW() WHERE id = $1',
            [resetRecord.id]
        );

        await serviceQuery(
            'UPDATE staging_sessions SET revoked_at = NOW() WHERE user_id = $1',
            [resetRecord.user_id]
        );

        res.json({ success: true, message: 'Password reset successfully' });

    } catch (error: any) {
        console.error('Password reset error:', error);
        res.status(500).json({ success: false, error: 'Failed to reset password' });
    }
});

router.get('/vehicles', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const result = await serviceQuery(`
            SELECT * FROM staging_user_vehicles 
            WHERE user_id = $1 AND is_active = true
            ORDER BY is_primary DESC, created_at DESC
        `, [req.user!.id]);

        res.json({
            success: true,
            vehicles: result.rows.map(v => ({
                id: v.id,
                nickname: v.nickname,
                vehicleType: v.vehicle_type,
                make: v.make,
                model: v.model,
                year: v.year,
                lengthFt: v.length_ft,
                widthFt: v.width_ft,
                heightFt: v.height_ft,
                combinedLengthFt: v.combined_length_ft,
                powerAmpRequirement: v.power_amp_requirement,
                hasSlideouts: v.has_slideouts,
                numSlideouts: v.num_slideouts,
                hasGenerator: v.has_generator,
                licensePlate: v.license_plate,
                isPrimary: v.is_primary
            }))
        });

    } catch (error: any) {
        console.error('Get vehicles error:', error);
        res.status(500).json({ success: false, error: 'Failed to get vehicles' });
    }
});

router.post('/vehicles', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const {
            nickname, vehicleType, make, model, year,
            lengthFt, widthFt, heightFt, combinedLengthFt,
            powerAmpRequirement, hasSlideouts, numSlideouts, hasGenerator,
            licensePlate, licenseState, isPrimary
        } = req.body;

        if (!vehicleType) {
            return res.status(400).json({ success: false, error: 'Vehicle type required' });
        }

        if (isPrimary) {
            await serviceQuery(
                'UPDATE staging_user_vehicles SET is_primary = false WHERE user_id = $1',
                [req.user!.id]
            );
        }

        const result = await serviceQuery(`
            INSERT INTO staging_user_vehicles (
                user_id, nickname, vehicle_type, make, model, year,
                length_ft, width_ft, height_ft, combined_length_ft,
                power_amp_requirement, has_slideouts, num_slideouts, has_generator,
                license_plate, license_state, is_primary
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            RETURNING *
        `, [
            req.user!.id, nickname, vehicleType, make, model, year,
            lengthFt, widthFt, heightFt, combinedLengthFt,
            powerAmpRequirement, hasSlideouts || false, numSlideouts || 0, hasGenerator || false,
            licensePlate, licenseState, isPrimary || false
        ]);

        res.status(201).json({ success: true, vehicle: result.rows[0] });

    } catch (error: any) {
        console.error('Add vehicle error:', error);
        res.status(500).json({ success: false, error: 'Failed to add vehicle' });
    }
});

router.put('/vehicles/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const check = await serviceQuery(
            'SELECT id FROM staging_user_vehicles WHERE id = $1 AND user_id = $2',
            [id, req.user!.id]
        );

        if (check.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Vehicle not found' });
        }

        if (updates.isPrimary) {
            await serviceQuery(
                'UPDATE staging_user_vehicles SET is_primary = false WHERE user_id = $1',
                [req.user!.id]
            );
        }

        const result = await serviceQuery(`
            UPDATE staging_user_vehicles SET
                nickname = COALESCE($2, nickname),
                vehicle_type = COALESCE($3, vehicle_type),
                make = COALESCE($4, make),
                model = COALESCE($5, model),
                year = COALESCE($6, year),
                length_ft = COALESCE($7, length_ft),
                combined_length_ft = COALESCE($8, combined_length_ft),
                power_amp_requirement = COALESCE($9, power_amp_requirement),
                license_plate = COALESCE($10, license_plate),
                is_primary = COALESCE($11, is_primary),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
        `, [id, updates.nickname, updates.vehicleType, updates.make, updates.model,
            updates.year, updates.lengthFt, updates.combinedLengthFt,
            updates.powerAmpRequirement, updates.licensePlate, updates.isPrimary]);

        res.json({ success: true, vehicle: result.rows[0] });

    } catch (error: any) {
        console.error('Update vehicle error:', error);
        res.status(500).json({ success: false, error: 'Failed to update vehicle' });
    }
});

router.delete('/vehicles/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const result = await serviceQuery(`
            UPDATE staging_user_vehicles 
            SET is_active = false, updated_at = NOW()
            WHERE id = $1 AND user_id = $2
            RETURNING id
        `, [id, req.user!.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Vehicle not found' });
        }

        res.json({ success: true, message: 'Vehicle removed' });

    } catch (error: any) {
        console.error('Delete vehicle error:', error);
        res.status(500).json({ success: false, error: 'Failed to remove vehicle' });
    }
});

router.get('/favorites', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const result = await serviceQuery(`
            SELECT 
                f.id as favorite_id,
                f.notes,
                f.created_at as favorited_at,
                p.id, p.name, p.city, p.region,
                p.total_spots, p.rv_score, p.crew_score, p.trucker_score,
                p.thumbnail_url,
                pr.nightly_rate
            FROM staging_user_favorites f
            JOIN staging_properties p ON p.id = f.property_id
            LEFT JOIN staging_pricing pr ON pr.property_id = p.id 
                AND pr.pricing_type = 'base_nightly' AND pr.is_active = true
            WHERE f.user_id = $1
            ORDER BY f.created_at DESC
        `, [req.user!.id]);

        res.json({
            success: true,
            favorites: result.rows.map(f => ({
                favoriteId: f.favorite_id,
                notes: f.notes,
                favoritedAt: f.favorited_at,
                property: {
                    id: f.id,
                    name: f.name,
                    city: f.city,
                    region: f.region,
                    totalSpots: f.total_spots,
                    rvScore: f.rv_score,
                    crewScore: f.crew_score,
                    truckerScore: f.trucker_score,
                    thumbnailUrl: f.thumbnail_url,
                    nightlyRate: f.nightly_rate ? parseFloat(f.nightly_rate) : null
                }
            }))
        });

    } catch (error: any) {
        console.error('Get favorites error:', error);
        res.status(500).json({ success: false, error: 'Failed to get favorites' });
    }
});

router.post('/favorites', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { propertyId, notes } = req.body;

        if (!propertyId) {
            return res.status(400).json({ success: false, error: 'Property ID required' });
        }

        const propCheck = await serviceQuery('SELECT id FROM staging_properties WHERE id = $1', [propertyId]);
        if (propCheck.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Property not found' });
        }

        const result = await serviceQuery(`
            INSERT INTO staging_user_favorites (user_id, property_id, notes)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, property_id) DO UPDATE SET notes = $3
            RETURNING id
        `, [req.user!.id, propertyId, notes]);

        res.status(201).json({ success: true, favoriteId: result.rows[0].id });

    } catch (error: any) {
        console.error('Add favorite error:', error);
        res.status(500).json({ success: false, error: 'Failed to add favorite' });
    }
});

router.delete('/favorites/:propertyId', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { propertyId } = req.params;

        const result = await serviceQuery(`
            DELETE FROM staging_user_favorites 
            WHERE user_id = $1 AND property_id = $2
            RETURNING id
        `, [req.user!.id, propertyId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Favorite not found' });
        }

        res.json({ success: true, message: 'Removed from favorites' });

    } catch (error: any) {
        console.error('Remove favorite error:', error);
        res.status(500).json({ success: false, error: 'Failed to remove favorite' });
    }
});

router.get('/bookings', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const result = await serviceQuery(`
            SELECT 
                b.*,
                p.name as property_name,
                p.city,
                p.region,
                p.thumbnail_url
            FROM staging_bookings b
            JOIN staging_properties p ON p.id = b.property_id
            WHERE b.user_id = $1 OR b.guest_email = $2
            ORDER BY b.check_in_date DESC
        `, [req.user!.id, req.user!.email]);

        res.json({
            success: true,
            bookings: result.rows.map(b => ({
                id: b.id,
                bookingRef: b.booking_ref,
                propertyId: b.property_id,
                propertyName: b.property_name,
                city: b.city,
                region: b.region,
                thumbnailUrl: b.thumbnail_url,
                checkInDate: b.check_in_date,
                checkOutDate: b.check_out_date,
                numNights: b.num_nights,
                totalCost: parseFloat(b.total_cost),
                status: b.status,
                createdAt: b.created_at
            }))
        });

    } catch (error: any) {
        console.error('Get bookings error:', error);
        res.status(500).json({ success: false, error: 'Failed to get bookings' });
    }
});

router.get('/trips', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const result = await serviceQuery(`
            SELECT 
                t.*,
                (SELECT COUNT(*) FROM staging_trip_stops WHERE trip_id = t.id) as stop_count
            FROM staging_trips t
            WHERE t.user_id = $1
            ORDER BY t.created_at DESC
        `, [req.user!.id]);

        res.json({
            success: true,
            trips: result.rows.map(t => ({
                id: t.id,
                tripRef: t.trip_ref,
                name: t.name,
                originName: t.origin_name,
                destinationName: t.destination_name,
                totalDistanceKm: t.total_distance_km ? parseFloat(t.total_distance_km) : null,
                departureDate: t.departure_date,
                stopCount: parseInt(t.stop_count),
                createdAt: t.created_at
            }))
        });

    } catch (error: any) {
        console.error('Get trips error:', error);
        res.status(500).json({ success: false, error: 'Failed to get trips' });
    }
});

export default router;
