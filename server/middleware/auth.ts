import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'staging-network-secret-change-in-production';

export interface AuthRequest extends Request {
    user?: {
        id: number;
        email: string;
        userType: string;
    };
}

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, error: 'Access token required' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        req.user = {
            id: decoded.userId,
            email: decoded.email,
            userType: decoded.userType
        };
        next();
    } catch (error) {
        return res.status(403).json({ success: false, error: 'Invalid or expired token' });
    }
}

export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET) as any;
            req.user = {
                id: decoded.userId,
                email: decoded.email,
                userType: decoded.userType
            };
        } catch (error) {
        }
    }
    next();
}

export function requireHost(req: AuthRequest, res: Response, next: NextFunction) {
    if (!req.user) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    if (req.user.userType !== 'host' && req.user.userType !== 'admin') {
        return res.status(403).json({ success: false, error: 'Host access required' });
    }
    next();
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
    if (!req.user) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    if (req.user.userType !== 'admin') {
        return res.status(403).json({ success: false, error: 'Admin access required' });
    }
    next();
}

export function generateTokens(userId: number, email: string, userType: string) {
    const accessToken = jwt.sign(
        { userId, email, userType },
        JWT_SECRET,
        { expiresIn: '15m' }
    );
    
    const refreshToken = jwt.sign(
        { userId, email, userType, type: 'refresh' },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
    
    return { accessToken, refreshToken };
}

export { JWT_SECRET };
