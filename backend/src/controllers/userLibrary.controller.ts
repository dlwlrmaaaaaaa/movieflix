import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { UserLibraryService } from '../services/userLibrary.service';

export class UserLibraryController {
  static async watchlist(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json({ success: true, items: await UserLibraryService.watchlist(req.user!.id) }); } catch (error) { next(error); }
  }
  static async addWatchlist(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.status(201).json({ success: true, item: await UserLibraryService.addToWatchlist(req.user!.id, req.body.tmdbId) }); } catch (error) { next(error); }
  }
  static async removeWatchlist(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { await UserLibraryService.removeFromWatchlist(req.user!.id, req.params.movieId); res.json({ success: true }); } catch (error) { next(error); }
  }
  static async continueWatching(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json({ success: true, items: await UserLibraryService.continueWatching(req.user!.id) }); } catch (error) { next(error); }
  }
  static async saveProgress(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json({ success: true, item: await UserLibraryService.saveProgress(req.user!.id, req.params.movieId, req.body.positionSeconds, req.body.durationSeconds) }); } catch (error) { next(error); }
  }
}
