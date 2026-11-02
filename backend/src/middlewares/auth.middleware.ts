import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../utils/token';
import { isCurrentSession } from '../services/authSession.service';
import { prisma } from '../prisma';

export interface AuthenticatedRequest extends Request {
  sessionId?: string;
  user?: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl?: string | null;
    partnerId?: string | null;
    role: 'ADMIN' | 'USER';
  };
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const queryToken = typeof req.query.access_token === 'string' ? req.query.access_token : undefined;
    if ((!authHeader || !authHeader.startsWith('Bearer ')) && !queryToken) {
      res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
      return;
    }

    // expo-video 1.x cannot send custom headers. The token query is restricted
    // to this authenticated endpoint and still goes through participant checks.
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : queryToken!;
    let decoded: TokenPayload;

    try {
      decoded = verifyToken(token);
    } catch {
      res.status(401).json({ success: false, message: 'Invalid or expired session token.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        partnerId: true,
        role: true,
        activeSessionId: true,
      },
    });

    if (!user) {
      res.status(401).json({ success: false, message: 'User account not found.' });
      return;
    }

    if (!isCurrentSession(decoded.sessionId, user.activeSessionId)) {
      res.status(401).json({ success: false, code: 'SESSION_REPLACED', message: 'Your account was signed in on another device. Please sign in again.' }); return;
    }
    req.sessionId = decoded.sessionId;
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'ADMIN') {
    res.status(403).json({ success: false, message: 'Administrator access is required.' });
    return;
  }
  next();
}
