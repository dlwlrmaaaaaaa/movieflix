import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { LiveKitService } from '../services/livekit.service';
import { RoomService } from '../services/room.service';

export class CallController {
  static async getCallToken(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { roomCode } = req.params;
      const room = await RoomService.getRoomByCode(roomCode);
      if (!room || room.status === 'ENDED') {
        res.status(404).json({ success: false, message: 'Room not found.' });
        return;
      }

      // Ensure user is participant
      const isParticipant = room.hostId === req.user!.id || room.guestId === req.user!.id;
      if (!isParticipant) {
        res.status(403).json({ success: false, message: 'Unauthorized. You are not a participant in this room.' });
        return;
      }

      const livekitRoomName = `tf-${room.code.toLowerCase()}`;
      const tokenData = await LiveKitService.createToken(
        livekitRoomName,
        req.sessionId ? `${req.user!.id}:${req.sessionId}` : req.user!.id,
        req.user!.displayName,
        room.hostId === req.user!.id,
      );

      res.status(200).json({ success: true, ...tokenData });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
}
