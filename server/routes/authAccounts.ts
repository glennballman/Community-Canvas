import { Router } from 'express';
import {
  registerUser, loginUser, validateSession, refreshSession,
  logoutSession, logoutAllSessions, getUserSessions,
  requestPasswordReset, resetPassword,
  getUserProfile, updateUserProfile, changePassword
} from '../services/authService';

const router = Router();

router.post('/register', async (req, res) => {
  const b = req.body || {};
  
  if (!b.email || !b.password || !b.displayName) {
    return res.status(400).json({ error: 'email, password, displayName required' });
  }
  
  try {
    const result = await registerUser({
      email: b.email,
      password: b.password,
      displayName: b.displayName,
      portalSlug: b.portalSlug,
      signupSource: b.signupSource,
      referrerId: b.referrerId,
      utmSource: b.utmSource,
      utmMedium: b.utmMedium,
      utmCampaign: b.utmCampaign
    });
    
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/login', async (req, res) => {
  const b = req.body || {};
  
  if (!b.email || !b.password) {
    return res.status(400).json({ error: 'email and password required' });
  }
  
  try {
    const result = await loginUser({
      email: b.email,
      password: b.password,
      deviceName: b.deviceName,
      deviceType: b.deviceType,
      browser: b.browser,
      os: b.os,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json(result);
  } catch (e: any) {
    res.status(401).json({ error: e.message });
  }
});

router.post('/validate', async (req, res) => {
  const { token } = req.body || {};
  
  if (!token) {
    return res.status(400).json({ error: 'token required' });
  }
  
  try {
    const result = await validateSession(token);
    if (!result) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }
    res.json(result);
  } catch (e: any) {
    res.status(401).json({ error: 'Invalid session' });
  }
});

router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body || {};
  
  if (!refreshToken) {
    return res.status(400).json({ error: 'refreshToken required' });
  }
  
  try {
    const result = await refreshSession(refreshToken);
    if (!result) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
    res.json(result);
  } catch (e: any) {
    res.status(401).json({ error: 'Token refresh failed' });
  }
});

router.post('/logout', async (req, res) => {
  const { token } = req.body || {};
  
  if (!token) {
    return res.status(400).json({ error: 'token required' });
  }
  
  try {
    const success = await logoutSession(token);
    res.json({ success });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/logout-all', async (req, res) => {
  const { userId, exceptSessionId } = req.body || {};
  
  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }
  
  try {
    const count = await logoutAllSessions(userId, exceptSessionId);
    res.json({ success: true, revokedCount: count });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/sessions/:userId', async (req, res) => {
  try {
    const sessions = await getUserSessions(req.params.userId);
    res.json({ sessions, count: sessions.length });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/password-reset/request', async (req, res) => {
  const { email } = req.body || {};
  
  if (!email) {
    return res.status(400).json({ error: 'email required' });
  }
  
  try {
    const result = await requestPasswordReset(
      email,
      req.ip,
      req.headers['user-agent']
    );
    res.json({ success: true, expiresAt: result.expiresAt });
  } catch (e: any) {
    res.json({ success: true, message: 'If email exists, reset link sent' });
  }
});

router.post('/password-reset/confirm', async (req, res) => {
  const { token, newPassword } = req.body || {};
  
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'token and newPassword required' });
  }
  
  try {
    await resetPassword(token, newPassword);
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/profile/:userId', async (req, res) => {
  try {
    const profile = await getUserProfile(req.params.userId);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    res.json({ profile });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.patch('/profile/:userId', async (req, res) => {
  const b = req.body || {};
  
  try {
    const profile = await updateUserProfile(req.params.userId, {
      displayName: b.displayName,
      avatarUrl: b.avatarUrl,
      bio: b.bio,
      timezone: b.timezone,
      locale: b.locale,
      preferences: b.preferences,
      notificationSettings: b.notificationSettings
    });
    
    res.json({ profile });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/password/change', async (req, res) => {
  const { userId, currentPassword, newPassword } = req.body || {};
  
  if (!userId || !currentPassword || !newPassword) {
    return res.status(400).json({ error: 'userId, currentPassword, newPassword required' });
  }
  
  try {
    await changePassword(userId, currentPassword, newPassword);
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
