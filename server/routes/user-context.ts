import express, { Response } from 'express';
import { serviceQuery } from '../db/tenantDb';
import { authenticateToken, AuthRequest } from './foundation';

const router = express.Router();

router.get('/me/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    const result = await serviceQuery(`
      SELECT 
        id,
        email,
        first_name,
        last_name,
        display_name,
        phone,
        avatar_url,
        bio,
        timezone,
        locale,
        notification_preferences,
        is_platform_admin,
        status,
        created_at,
        updated_at
      FROM cc_users 
      WHERE id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    const user = result.rows[0];

    res.json({
      success: true,
      profile: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        display_name: user.display_name,
        phone: user.phone,
        avatar_url: user.avatar_url,
        bio: user.bio,
        timezone: user.timezone || 'America/Vancouver',
        locale: user.locale || 'en-CA',
        notification_preferences: user.notification_preferences || {},
        is_platform_admin: user.is_platform_admin,
        status: user.status,
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    });

  } catch (error: any) {
    console.error('Get profile error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get profile' 
    });
  }
});

router.put('/me/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const {
      first_name,
      last_name,
      display_name,
      phone,
      bio,
      timezone,
      locale,
      notification_preferences
    } = req.body;

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (first_name !== undefined) {
      updates.push(`first_name = $${paramIndex}`);
      params.push(first_name);
      paramIndex++;
    }

    if (last_name !== undefined) {
      updates.push(`last_name = $${paramIndex}`);
      params.push(last_name);
      paramIndex++;
    }

    if (display_name !== undefined) {
      updates.push(`display_name = $${paramIndex}`);
      params.push(display_name);
      paramIndex++;
    }

    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex}`);
      params.push(phone);
      paramIndex++;
    }

    if (bio !== undefined) {
      updates.push(`bio = $${paramIndex}`);
      params.push(bio);
      paramIndex++;
    }

    if (timezone !== undefined) {
      updates.push(`timezone = $${paramIndex}`);
      params.push(timezone);
      paramIndex++;
    }

    if (locale !== undefined) {
      updates.push(`locale = $${paramIndex}`);
      params.push(locale);
      paramIndex++;
    }

    if (notification_preferences !== undefined) {
      updates.push(`notification_preferences = $${paramIndex}`);
      params.push(JSON.stringify(notification_preferences));
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No fields to update' 
      });
    }

    updates.push(`updated_at = now()`);
    params.push(userId);

    const result = await serviceQuery(`
      UPDATE cc_users 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING 
        id, email, first_name, last_name, display_name, 
        phone, bio, timezone, locale, notification_preferences,
        updated_at
    `, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    res.json({
      success: true,
      profile: result.rows[0]
    });

  } catch (error: any) {
    console.error('Update profile error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update profile' 
    });
  }
});

export default router;
