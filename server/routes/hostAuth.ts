import { Router, Request, Response, NextFunction } from 'express';
import * as hostAuthService from '../services/hostAuthService';
import type { HostAccount, HostSession } from '../services/hostAuthService';

const router = Router();

// Extended request with host info
export interface HostAuthRequest extends Request {
  hostAccount?: HostAccount;
  hostSession?: HostSession;
}

// ============================================================================
// MIDDLEWARE: Require Host Authentication
// ============================================================================

export async function requireHostAuth(req: HostAuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.substring(7);
  const validation = await hostAuthService.verifySession(token);

  if (!validation.valid || !validation.host) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  req.hostAccount = validation.host;
  req.hostSession = validation.session;
  next();
}

// Optional auth - attaches host if token provided, but doesn't require it
export async function optionalHostAuth(req: HostAuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const validation = await hostAuthService.verifySession(token);
    
    if (validation.valid && validation.host) {
      req.hostAccount = validation.host;
      req.hostSession = validation.session;
    }
  }
  
  next();
}

// ============================================================================
// PUBLIC ENDPOINTS
// ============================================================================

// POST /api/host/auth/signup - Register new host account
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, phone, businessName, businessType } = req.body;

    // Validation
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'Email, password, first name, and last name are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const result = await hostAuthService.signUp(
      email,
      password,
      firstName,
      lastName,
      phone,
      businessName,
      businessType
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // In production, send verification email here
    // For now, return success with verification token for testing
    res.status(201).json({
      message: 'Account created. Please verify your email.',
      hostId: result.host?.id,
      // Remove in production - only for testing
      verifyToken: result.verifyToken
    });
  } catch (error) {
    console.error('[HostAuth Route] Signup error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// POST /api/host/auth/login - Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password, rememberMe } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await hostAuthService.login(email, password, rememberMe, ipAddress, userAgent);

    if (!result.success) {
      return res.status(401).json({ error: result.error });
    }

    res.json({
      token: result.token,
      host: {
        id: result.host?.id,
        email: result.host?.email,
        givenName: result.host?.givenName,
        familyName: result.host?.familyName,
        businessName: result.host?.businessName,
        emailVerified: result.host?.emailVerified,
        status: result.host?.status
      }
    });
  } catch (error) {
    console.error('[HostAuth Route] Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/host/auth/verify-email - Verify email address
router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Verification token required' });
    }

    const result = await hostAuthService.verifyEmail(token);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('[HostAuth Route] Verify email error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// POST /api/host/auth/forgot-password - Request password reset
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const result = await hostAuthService.requestPasswordReset(email);

    // Always return success to prevent email enumeration
    res.json({ 
      message: 'If an account exists with this email, a reset link will be sent.',
      // Remove in production - only for testing
      resetToken: result.token
    });
  } catch (error) {
    console.error('[HostAuth Route] Forgot password error:', error);
    res.status(500).json({ error: 'Request failed' });
  }
});

// POST /api/host/auth/reset-password - Reset password with token
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const result = await hostAuthService.resetPassword(token, newPassword);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('[HostAuth Route] Reset password error:', error);
    res.status(500).json({ error: 'Reset failed' });
  }
});

// ============================================================================
// PROTECTED ENDPOINTS (require authentication)
// ============================================================================

// POST /api/host/auth/logout - Logout
router.post('/logout', requireHostAuth as any, async (req: HostAuthRequest, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.substring(7);

    if (token) {
      await hostAuthService.logout(token);
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('[HostAuth Route] Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// GET /api/host/auth/me - Get current user
router.get('/me', requireHostAuth as any, async (req: HostAuthRequest, res: Response) => {
  try {
    const host = req.hostAccount!;

    res.json({
      success: true,
      host: {
        id: host.id,
        email: host.email,
        givenName: host.givenName,
        familyName: host.familyName,
        telephone: host.telephone,
        profilePhotoUrl: host.profilePhotoUrl,
        businessName: host.businessName,
        businessType: host.businessType,
        emailVerified: host.emailVerified,
        phoneVerified: host.phoneVerified,
        status: host.status,
        totalProperties: host.totalProperties || 0,
        totalBookings: host.totalBookings || 0,
        memberSince: host.memberSince || host.createdAt,
        lastLoginAt: host.lastLoginAt,
        timezone: host.timezone || 'America/Vancouver',
        createdAt: host.createdAt
      }
    });
  } catch (error) {
    console.error('[HostAuth Route] Get me error:', error);
    res.status(500).json({ success: false, error: 'Failed to get user info' });
  }
});

// POST /api/host/auth/change-password - Change password (logged in)
router.post('/change-password', requireHostAuth as any, async (req: HostAuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const result = await hostAuthService.updatePassword(
      req.hostAccount!.id,
      currentPassword,
      newPassword
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('[HostAuth Route] Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// GET /api/host/auth/sessions - List active sessions
router.get('/sessions', requireHostAuth as any, async (req: HostAuthRequest, res: Response) => {
  try {
    res.json({
      currentSession: {
        id: req.hostSession?.id,
        createdAt: req.hostSession?.createdAt,
        lastAccessedAt: req.hostSession?.lastAccessedAt,
        userAgent: req.hostSession?.userAgent
      }
    });
  } catch (error) {
    console.error('[HostAuth Route] Get sessions error:', error);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

export default router;
