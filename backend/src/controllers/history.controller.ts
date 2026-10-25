import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { HistoryService } from '../services/history.service';

export class HistoryController {
  static async getHistories(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const items = await HistoryService.getHistory(req.user!.id);
      res.status(200).json({ success: true, history: items });
    } catch (err) {
      next(err);
    }
  }

  static async recordMovieNight(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { roomId, partnerName, movieTitle, durationMinutes, notes } = req.body;
      if (!roomId || !movieTitle) {
        res.status(400).json({ success: false, message: 'Room ID and movie title are required.' });
        return;
      }

      const item = await HistoryService.recordMovieNight({
        roomId,
        userId: req.user!.id,
        partnerName: partnerName || 'Partner',
        movieTitle,
        durationMinutes: durationMinutes || 0,
        notes,
      });

      res.status(201).json({ success: true, item });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
}
