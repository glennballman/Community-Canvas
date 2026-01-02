import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { pool } from '../db';
import { authenticateToken, generateTokens, AuthRequest, JWT_SECRET } from '../middleware/auth';
import jwt from 'jsonwebtoken';

const router = express.Router();

router.post('/register', async (req: Request, res: Response) => {
    try {
        const { email, password, firstName, lastName, phone, userType, companyName } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Email and password required' });
        }

        if (password.length < 8) {
            return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
        }

        const existing = await pool.query(
            'SELECT id FROM staging_users WHERE email = $1',
            [email.toLowerCase()]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ success: false, error: 'Email already registered' });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const result = await pool.query(`
            INSERT INTO staging_users (
                email, password_hash, first_name, last_name, phone,
                user_type, company_name
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, email, first_name, last_name, user_type
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
        await pool.query(`
            INSERT INTO staging_sessions (user_id, refresh_token, expires_at)
            VALUES ($1, $2, $3)
        `, [user.id, refreshToken, expiresAt]);

        res.status(201).json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
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

        const result = await pool.query(`
            SELECT id, email, password_hash, first_name, last_name, user_type, status
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

        await pool.query(`
            UPDATE staging_users 
            SET last_login_at = NOW(), login_count = login_count + 1
            WHERE id = $1
        `, [user.id]);

        const { accessToken, refreshToken } = generateTokens(user.id, user.email, user.user_type);

        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await pool.query(`
            INSERT INTO staging_sessions (user_id, refresh_token, expires_at)
            VALUES ($1, $2, $3)
        `, [user.id, refreshToken, expiresAt]);

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
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

        const sessionResult = await pool.query(`
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
        await pool.query('UPDATE staging_sessions SET revoked_at = NOW() WHERE id = $1', [session.id]);
        await pool.query(`
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
            await pool.query(
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
        const result = await pool.query(`
            SELECT id, email, first_name, last_name, phone, avatar_url,
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
                firstName: user.first_name,
                lastName: user.last_name,
                phone: user.phone,
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

        const result = await pool.query(`
            UPDATE staging_users SET
                first_name = COALESCE($2, first_name),
                last_name = COALESCE($3, last_name),
                phone = COALESCE($4, phone),
                company_name = COALESCE($5, company_name),
                company_role = COALESCE($6, company_role),
                preferences = COALESCE($7, preferences),
                notification_settings = COALESCE($8, notification_settings),
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, email, first_name, last_name, phone, user_type, company_name, company_role
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
                firstName: user.first_name,
                lastName: user.last_name,
                phone: user.phone,
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

        const result = await pool.query(
            'SELECT password_hash FROM staging_users WHERE id = $1',
            [req.user!.id]
        );

        const validPassword = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
        if (!validPassword) {
            return res.status(401).json({ success: false, error: 'Current password is incorrect' });
        }

        const newHash = await bcrypt.hash(newPassword, 12);
        await pool.query(
            'UPDATE staging_users SET password_hash = $2, updated_at = NOW() WHERE id = $1',
            [req.user!.id, newHash]
        );

        await pool.query(
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

        const result = await pool.query(
            'SELECT id FROM staging_users WHERE email = $1 AND status = $2',
            [email.toLowerCase(), 'active']
        );

        if (result.rows.length === 0) {
            return res.json({ success: true, message: 'If email exists, reset link will be sent' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

        await pool.query(`
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

        const result = await pool.query(`
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

        await pool.query(
            'UPDATE staging_users SET password_hash = $2, updated_at = NOW() WHERE id = $1',
            [resetRecord.user_id, newHash]
        );

        await pool.query(
            'UPDATE staging_password_resets SET used_at = NOW() WHERE id = $1',
            [resetRecord.id]
        );

        await pool.query(
            'UPDATE staging_sessions SET revoked_at = NOW() WHERE user_id = $1',
            [resetRecord.user_id]
        );

        res.json({ success: true, message: 'Password reset successfully' });

    } catch (error: any) {
        console.error('Password reset error:', error);
        res.status(500).json({ success: false, error: 'Failed to reset password' });
    }
});

export default router;
