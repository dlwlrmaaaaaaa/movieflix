import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, displayName } = req.body;
      if (!email || !password || !displayName) {
        res.status(400).json({ success: false, message: 'Email, password, and display name are required.' });
        return;
      }

      if (password.length < 6) {
        res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
        return;
      }

      const result = await AuthService.register(email, password, displayName);
      res.status(201).json({ success: true, ...result });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ success: false, message: 'Email and password are required.' });
        return;
      }

      const result = await AuthService.login(email, password);
      res.status(200).json({ success: true, ...result });
    } catch (err: any) {
      res.status(401).json({ success: false, message: err.message });
    }
  }

  static async getMe(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }
      const profile = await AuthService.getProfile(req.user.id);
      res.status(200).json({ success: true, user: profile });
    } catch (err) {
      next(err);
    }
  }

  static async createPartnerInvite(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { inviteEmail } = req.body;
      if (!inviteEmail) {
        res.status(400).json({ success: false, message: 'Partner invite email is required.' });
        return;
      }

      const invite = await AuthService.createPartnerInvite(req.user!.id, inviteEmail);
      res.status(200).json({ success: true, ...invite });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  static async acceptPartnerInvite(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { inviteCode } = req.body;
      if (!inviteCode) {
        res.status(400).json({ success: false, message: 'Invite code is required.' });
        return;
      }

      const updatedProfile = await AuthService.acceptPartnerInvite(req.user!.id, inviteCode);
      res.status(200).json({ success: true, user: updatedProfile, message: 'Partner linked successfully! 💕' });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  static async unlinkPartner(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const updatedProfile = await AuthService.unlinkPartner(req.user!.id);
      res.status(200).json({ success: true, user: updatedProfile, message: 'Partner unlinked.' });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
}
