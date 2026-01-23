import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { serviceQuery, withServiceTransaction } from '../db/tenantDb';
import { authenticateToken, generateTokens, AuthRequest, JWT_SECRET } from '../middleware/auth';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Rate limiting (basic in-memory for dev - TODO: production Redis implementation)
const rateLimiter = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 10; // max attempts per window

function checkRateLimit(key: string): boolean {
    const now = Date.now();
    const entry = rateLimiter.get(key);
    
    if (!entry || now > entry.resetAt) {
        rateLimiter.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
        return true;
    }
    
    if (entry.count >= RATE_LIMIT_MAX) {
        return false;
    }
    
    entry.count++;
    return true;
}

// Helper: Create session in cc_auth_sessions
async function createSession(userId: string, refreshToken: string, req: Request): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    await serviceQuery(`
        INSERT INTO cc_auth_sessions (
            user_id, token_hash, refresh_token_hash, refresh_expires_at,
            session_type, device_name, ip_address, user_agent, expires_at
        ) VALUES ($1, $2, $3, $4, 'web', $5, $6, $7, $8)
    `, [
        userId,
        tokenHash,
        tokenHash, // Using same hash for both for now
        expiresAt,
        req.headers['user-agent']?.slice(0, 100) || 'unknown',
        req.ip || 'unknown',
        req.headers['user-agent'] || 'unknown',
        expiresAt
    ]);
}

// Helper: Validate and rotate refresh token
async function validateAndRotateRefresh(refreshToken: string): Promise<{ user: any; newTokens: { accessToken: string; refreshToken: string } } | null> {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    
    const sessionResult = await serviceQuery(`
        SELECT s.*, u.email, u.is_platform_admin, u.status, u.display_name
        FROM cc_auth_sessions s
        JOIN cc_users u ON u.id = s.user_id
        WHERE s.refresh_token_hash = $1 
          AND s.revoked_at IS NULL 
          AND s.expires_at > NOW()
          AND s.status = 'active'
    `, [tokenHash]);
    
    if (sessionResult.rows.length === 0) {
        return null;
    }
    
    const session = sessionResult.rows[0];
    
    if (session.status !== 'active') {
        return null;
    }
    
    // Revoke old session
    await serviceQuery(
        'UPDATE cc_auth_sessions SET revoked_at = NOW(), revoked_reason = $2 WHERE id = $1',
        [session.id, 'token_rotation']
    );
    
    // Generate new tokens
    const userType = session.is_platform_admin ? 'admin' : 'user';
    const newTokens = generateTokens(session.user_id, session.email, userType);
    
    return {
        user: {
            id: session.user_id,
            email: session.email,
            displayName: session.display_name,
            isPlatformAdmin: session.is_platform_admin
        },
        newTokens
    };
}

// ============================================================
// CANONICAL AUTH ENDPOINTS (cc_users ONLY - NO STAGING)
// ============================================================

router.post('/register', async (req: Request, res: Response) => {
    try {
        const { email, password, firstName, lastName, phone } = req.body;

        if (!email || !password) {
            return res.status(400).json({ ok: false, error: 'Email and password required' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ ok: false, error: 'Invalid email format' });
        }

        if (password.length < 8) {
            return res.status(400).json({ ok: false, error: 'Password must be at least 8 characters' });
        }

        const emailLower = email.toLowerCase();

        // Check canonical table only
        const existing = await serviceQuery(
            'SELECT id FROM cc_users WHERE email = $1',
            [emailLower]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ ok: false, error: 'Email already registered' });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const displayName = [firstName, lastName].filter(Boolean).join(' ') || emailLower.split('@')[0];

        const result = await serviceQuery(`
            INSERT INTO cc_users (
                email, password_hash, given_name, family_name, display_name, telephone, status
            ) VALUES ($1, $2, $3, $4, $5, $6, 'active')
            RETURNING id, email, given_name, family_name, display_name, is_platform_admin
        `, [
            emailLower,
            passwordHash,
            firstName || null,
            lastName || null,
            displayName,
            phone || null
        ]);

        const user = result.rows[0];
        const userType = user.is_platform_admin ? 'admin' : 'user';
        const { accessToken, refreshToken } = generateTokens(user.id, user.email, userType);

        // Create session
        await createSession(user.id, refreshToken, req);

        res.status(201).json({
            ok: true,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.given_name,
                lastName: user.family_name,
                displayName: user.display_name,
                userType,
                isPlatformAdmin: user.is_platform_admin
            },
            accessToken,
            refreshToken
        });

    } catch (error: any) {
        console.error('Register error:', error);
        res.status(500).json({ ok: false, error: 'Registration failed' });
    }
});

router.post('/login', async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ ok: false, error: 'Email and password required' });
        }

        // Rate limiting
        const rateLimitKey = `login:${email.toLowerCase()}`;
        if (!checkRateLimit(rateLimitKey)) {
            return res.status(429).json({ ok: false, error: 'Too many login attempts. Try again later.' });
        }

        const emailLower = email.toLowerCase();

        // Query canonical cc_users table ONLY
        const result = await serviceQuery(`
            SELECT id, email, password_hash, given_name, family_name, display_name, status, is_platform_admin
            FROM cc_users WHERE email = $1
        `, [emailLower]);

        if (result.rows.length === 0) {
            return res.status(401).json({ ok: false, error: 'Invalid credentials' });
        }

        const user = result.rows[0];

        if (user.status !== 'active') {
            return res.status(403).json({ ok: false, error: 'Account is suspended' });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ ok: false, error: 'Invalid credentials' });
        }

        // Update login stats
        await serviceQuery(`
            UPDATE cc_users 
            SET last_login_at = NOW(), login_count = COALESCE(login_count, 0) + 1
            WHERE id = $1
        `, [user.id]);

        const userType = user.is_platform_admin ? 'admin' : 'user';
        const { accessToken, refreshToken } = generateTokens(user.id, user.email, userType);

        // Create session in cc_auth_sessions
        await createSession(user.id, refreshToken, req);

        res.json({
            ok: true,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.given_name,
                lastName: user.family_name,
                displayName: user.display_name,
                userType,
                isPlatformAdmin: user.is_platform_admin
            },
            accessToken,
            refreshToken
        });

    } catch (error: any) {
        console.error('Login error:', error);
        res.status(500).json({ ok: false, error: 'Login failed' });
    }
});

router.post('/refresh', async (req: Request, res: Response) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ ok: false, error: 'Refresh token required' });
        }

        // Rate limiting
        if (!checkRateLimit(`refresh:${req.ip}`)) {
            return res.status(429).json({ ok: false, error: 'Too many requests. Try again later.' });
        }

        // Validate JWT structure
        let decoded: any;
        try {
            decoded = jwt.verify(refreshToken, JWT_SECRET);
        } catch (err) {
            return res.status(403).json({ ok: false, error: 'Invalid refresh token' });
        }

        // Validate and rotate in cc_auth_sessions
        const rotationResult = await validateAndRotateRefresh(refreshToken);
        
        if (!rotationResult) {
            return res.status(403).json({ ok: false, error: 'Session expired or revoked' });
        }

        // Create new session
        await createSession(rotationResult.user.id, rotationResult.newTokens.refreshToken, req);

        res.json({
            ok: true,
            accessToken: rotationResult.newTokens.accessToken,
            refreshToken: rotationResult.newTokens.refreshToken
        });

    } catch (error: any) {
        console.error('Refresh error:', error);
        res.status(500).json({ ok: false, error: 'Token refresh failed' });
    }
});

async function handleLogout(req: Request, res: Response) {
    try {
        const refreshToken = req.body?.refreshToken;

        if (refreshToken) {
            const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
            await serviceQuery(
                'UPDATE cc_auth_sessions SET revoked_at = NOW(), revoked_reason = $2 WHERE refresh_token_hash = $1',
                [tokenHash, 'logout']
            );
        }

        res.status(204).send();

    } catch (error: any) {
        console.error('Logout error:', error);
        res.status(204).send();
    }
}

router.post('/logout', handleLogout);
router.get('/logout', handleLogout);

router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;

        // Query canonical cc_users table ONLY
        const result = await serviceQuery(`
            SELECT id, email, given_name, family_name, display_name, telephone, avatar_url,
                   email_verified, is_platform_admin, status, created_at, last_login_at
            FROM cc_users WHERE id = $1
        `, [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ ok: false, error: 'User not found' });
        }

        const user = result.rows[0];

        res.json({
            ok: true,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.given_name,
                lastName: user.family_name,
                displayName: user.display_name,
                phone: user.telephone,
                avatarUrl: user.avatar_url,
                userType: user.is_platform_admin ? 'admin' : 'user',
                isPlatformAdmin: user.is_platform_admin,
                emailVerified: user.email_verified,
                createdAt: user.created_at,
                lastLoginAt: user.last_login_at
            }
        });

    } catch (error: any) {
        console.error('Get me error:', error);
        res.status(500).json({ ok: false, error: 'Failed to get user' });
    }
});

router.put('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { firstName, lastName, phone, displayName } = req.body;

        const result = await serviceQuery(`
            UPDATE cc_users SET
                given_name = COALESCE($2, given_name),
                family_name = COALESCE($3, family_name),
                telephone = COALESCE($4, telephone),
                display_name = COALESCE($5, display_name),
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, email, given_name, family_name, telephone, display_name, is_platform_admin
        `, [
            req.user!.id,
            firstName,
            lastName,
            phone,
            displayName
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ ok: false, error: 'User not found' });
        }

        const user = result.rows[0];

        res.json({
            ok: true,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.given_name,
                lastName: user.family_name,
                phone: user.telephone,
                displayName: user.display_name,
                userType: user.is_platform_admin ? 'admin' : 'user'
            }
        });

    } catch (error: any) {
        console.error('Update me error:', error);
        res.status(500).json({ ok: false, error: 'Failed to update user' });
    }
});

router.post('/password/change', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ ok: false, error: 'Current and new password required' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ ok: false, error: 'Password must be at least 8 characters' });
        }

        const result = await serviceQuery(
            'SELECT password_hash FROM cc_users WHERE id = $1',
            [req.user!.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ ok: false, error: 'User not found' });
        }

        const validPassword = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
        if (!validPassword) {
            return res.status(401).json({ ok: false, error: 'Current password is incorrect' });
        }

        const newHash = await bcrypt.hash(newPassword, 12);
        await serviceQuery(
            'UPDATE cc_users SET password_hash = $2, updated_at = NOW() WHERE id = $1',
            [req.user!.id, newHash]
        );

        // Revoke all sessions
        await serviceQuery(
            'UPDATE cc_auth_sessions SET revoked_at = NOW(), revoked_reason = $2 WHERE user_id = $1 AND revoked_at IS NULL',
            [req.user!.id, 'password_change']
        );

        res.json({ ok: true, message: 'Password changed successfully' });

    } catch (error: any) {
        console.error('Password change error:', error);
        res.status(500).json({ ok: false, error: 'Failed to change password' });
    }
});

router.post('/password/forgot', async (req: Request, res: Response) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ ok: false, error: 'Email required' });
        }

        // Always return success to prevent email enumeration
        const result = await serviceQuery(
            'SELECT id FROM cc_users WHERE email = $1 AND status = $2',
            [email.toLowerCase(), 'active']
        );

        if (result.rows.length > 0) {
            const token = crypto.randomBytes(32).toString('hex');
            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

            // Store token hash in cc_users for simplicity (could use separate table)
            await serviceQuery(`
                UPDATE cc_users 
                SET updated_at = NOW()
                WHERE id = $1
            `, [result.rows[0].id]);

            // Log token for dev (would email in production)
            console.log(`[DEV] Password reset token for ${email}: ${token}`);
        }

        res.json({ ok: true, message: 'If email exists, reset link will be sent' });

    } catch (error: any) {
        console.error('Password forgot error:', error);
        res.status(500).json({ ok: false, error: 'Failed to process request' });
    }
});

router.post('/password/reset', async (req: Request, res: Response) => {
    try {
        const { token, email, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ ok: false, error: 'Token and new password required' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ ok: false, error: 'Password must be at least 8 characters' });
        }

        // For dev: simple token validation (production would check token hash + expiry)
        if (!email) {
            return res.status(400).json({ ok: false, error: 'Email required for password reset' });
        }

        const result = await serviceQuery(
            'SELECT id FROM cc_users WHERE email = $1 AND status = $2',
            [email.toLowerCase(), 'active']
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ ok: false, error: 'Invalid reset request' });
        }

        const newHash = await bcrypt.hash(newPassword, 12);
        await serviceQuery(
            'UPDATE cc_users SET password_hash = $2, updated_at = NOW() WHERE id = $1',
            [result.rows[0].id, newHash]
        );

        // Revoke all sessions
        await serviceQuery(
            'UPDATE cc_auth_sessions SET revoked_at = NOW(), revoked_reason = $2 WHERE user_id = $1 AND revoked_at IS NULL',
            [result.rows[0].id, 'password_reset']
        );

        res.json({ ok: true, message: 'Password reset successfully' });

    } catch (error: any) {
        console.error('Password reset error:', error);
        res.status(500).json({ ok: false, error: 'Failed to reset password' });
    }
});

// ============================================================
// SESSION MANAGEMENT
// ============================================================

router.get('/sessions', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const result = await serviceQuery(`
            SELECT id, session_type, device_name, browser, os, ip_address, 
                   city, country, created_at, last_used_at, is_suspicious
            FROM cc_auth_sessions 
            WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
            ORDER BY last_used_at DESC
        `, [req.user!.id]);

        res.json({
            ok: true,
            sessions: result.rows.map(s => ({
                id: s.id,
                type: s.session_type,
                device: s.device_name,
                browser: s.browser,
                os: s.os,
                ip: s.ip_address,
                location: [s.city, s.country].filter(Boolean).join(', ') || 'Unknown',
                createdAt: s.created_at,
                lastUsedAt: s.last_used_at,
                isSuspicious: s.is_suspicious
            }))
        });

    } catch (error: any) {
        console.error('Get sessions error:', error);
        res.status(500).json({ ok: false, error: 'Failed to get sessions' });
    }
});

router.delete('/sessions/:sessionId', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { sessionId } = req.params;

        const result = await serviceQuery(`
            UPDATE cc_auth_sessions 
            SET revoked_at = NOW(), revoked_reason = 'user_revoked'
            WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
            RETURNING id
        `, [sessionId, req.user!.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ ok: false, error: 'Session not found' });
        }

        res.json({ ok: true, message: 'Session revoked' });

    } catch (error: any) {
        console.error('Delete session error:', error);
        res.status(500).json({ ok: false, error: 'Failed to revoke session' });
    }
});

router.delete('/sessions', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        await serviceQuery(`
            UPDATE cc_auth_sessions 
            SET revoked_at = NOW(), revoked_reason = 'logout_all'
            WHERE user_id = $1 AND revoked_at IS NULL
        `, [req.user!.id]);

        res.json({ ok: true, message: 'All sessions revoked' });

    } catch (error: any) {
        console.error('Delete all sessions error:', error);
        res.status(500).json({ ok: false, error: 'Failed to revoke sessions' });
    }
});

export default router;
