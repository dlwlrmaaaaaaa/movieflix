import fs from 'fs';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { RoomService } from '../services/room.service';
import { prisma } from '../prisma';

export class MediaController {
  static async upload(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const room = await RoomService.getRoomByCode(req.params.code);
      if (!room || room.hostId !== req.user!.id) {
        res.status(403).json({ success: false, message: 'Only the room host can upload a movie.' }); return;
      }
      if (!req.file) { res.status(400).json({ success: false, message: 'A supported movie file is required.' }); return; }
      const durationSeconds = Number(req.body.durationSeconds);
      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        fs.unlink(req.file.path, () => undefined);
        res.status(400).json({ success: false, message: 'A valid movie duration is required.' }); return;
      }
      await RoomService.saveHostMovie(room.id, req.user!.id, {
        fileName: req.file.originalname,
        durationSeconds,
        fileSizeBytes: req.file.size,
        mediaPath: req.file.path,
        mimeType: req.file.mimetype,
      });
      const updatedRoom = await RoomService.getRoomByCode(room.code);
      res.status(201).json({ success: true, room: updatedRoom, metadata: updatedRoom?.participants.find((p) => p.isHost)?.metadata });
    } catch (err) { next(err); }
  }

  static async stream(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const room = await RoomService.getRoomByCode(req.params.code);
      if (!room || (room.hostId !== req.user!.id && room.guestId !== req.user!.id)) { res.sendStatus(403); return; }
      const movie = room.participants.find((p) => p.isHost)?.metadata;
      if (!movie?.streamUrl) { res.status(404).json({ message: 'Movie is not available.' }); return; }
      const dbRoom: any = await prisma.room.findUnique({ where: { id: room.id }, include: { filesMetadata: true } });
      const file = dbRoom.filesMetadata.find((m: any) => m.userId === room.hostId);
      if (!file?.mediaPath || !fs.existsSync(file.mediaPath)) { res.status(410).json({ message: 'Movie file is no longer available.' }); return; }
      const stat = fs.statSync(file.mediaPath); const range = req.headers.range;
      res.setHeader('Content-Type', file.mimeType || 'video/mp4'); res.setHeader('Accept-Ranges', 'bytes');
      if (range) {
        const start = Number(range.replace(/bytes=(\d+)-.*/, '$1')); const end = Math.min(Number(range.split('-')[1]) || stat.size - 1, stat.size - 1);
        if (start >= stat.size || end < start) { res.status(416).setHeader('Content-Range', `bytes */${stat.size}`).end(); return; }
        res.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1 }); fs.createReadStream(file.mediaPath, { start, end }).pipe(res);
      } else { res.setHeader('Content-Length', stat.size); fs.createReadStream(file.mediaPath).pipe(res); }
    } catch (err) { next(err); }
  }
}
