import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { RoomService } from '../services/room.service';

export class RoomController {
  static async createRoom(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const room = await RoomService.createRoom(req.user!.id);
      res.status(201).json({ success: true, room });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  static async getRoom(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code } = req.params;
      const room = await RoomService.getRoomByCode(code);
      if (!room) {
        res.status(404).json({ success: false, message: 'Room not found.' });
        return;
      }

      // Security check: only host or guest can access room details
      if (room.hostId !== req.user!.id && room.guestId !== req.user!.id && room.guestId !== null) {
        res.status(403).json({ success: false, message: 'You are not authorized to view this private room.' });
        return;
      }

      res.status(200).json({ success: true, room });
    } catch (err) {
      next(err);
    }
  }

  static async joinRoom(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code } = req.body;
      if (!code) {
        res.status(400).json({ success: false, message: 'Room code is required.' });
        return;
      }

      const room = await RoomService.joinRoom(code, req.user!.id);
      res.status(200).json({ success: true, room });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  static async setControlMode(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code } = req.params;
      const { isHostOnlyControl } = req.body;

      const room = await RoomService.setControlMode(code, req.user!.id, !!isHostOnlyControl);
      res.status(200).json({ success: true, room });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  static async closeRoom(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code } = req.params;
      await RoomService.closeRoom(code, req.user!.id);
      res.status(200).json({ success: true, message: 'Room closed.' });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
}
