import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { MovieService } from '../services/movie.service';
import { StreamingSourceService } from '../services/streamingSource.service';
import { TmdbService } from '../services/tmdb.service';
import { RoomService } from '../services/room.service';
import { prisma } from '../prisma';
import { LiveKitService } from '../services/livekit.service';
import { embedProviderRegistry } from '../services/embedProviderRegistry';
import { logger } from '../services/logger';

export class RoomController {
  static async startMovie(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const room = await RoomService.startIframeParty(req.params.code, req.user!.id);
      await req.app.get('roomGateway')?.publishMembership(room.code);
      res.json({ success: true, room });
    } catch (error) {
      res.status(400).json({ success: false, message: error instanceof Error ? error.message : 'Unable to start this party.' });
    }
  }

  static async prepareDirect(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const room = await RoomService.getRoomByCode(req.params.code);
      if (!room || room.status === 'ENDED' || room.hostId !== req.user!.id || !room.catalogSelection) { res.status(403).json({ success: false, message: 'Only the active host can prepare this movie.' }); return; }
      const movie = await TmdbService.details(room.catalogSelection.tmdbId);
      const sources = await StreamingSourceService.find(movie);
      if (!sources.length) { res.status(409).json({ success: false, message: 'No supported synchronized source is available for this movie. Independent iframe playback is available through Watch Now.' }); return; }
      const source = sources[0];
      const playable = await MovieService.createAuthorizedProviderMovie(req.user!.id, movie, source);
      await prisma.$transaction([
        prisma.room.update({ where: { id: room.id }, data: {
          selectedMovieId: playable.id, playbackMode: 'DIRECT', screenSharingUserId: null,
          playbackPosition: 0, playbackIsPlaying: false, playbackUpdatedAt: new Date(), playbackVersion: { increment: 1 },
          catalogSelection: { ...room.catalogSelection, playerType: 'direct', providerId: source.providerId, providerName: source.providerId.replace(/_/g, ' ') },
        } }),
        prisma.roomViewerState.deleteMany({ where: { roomId: room.id } }),
      ]);
      await req.app.get('roomGateway')?.publishPlaybackSelection(room.code);
      res.json({ success: true, room: await RoomService.getRoomByCode(room.code) });
    } catch (error) { next(error); }
  }

  static async removeGuest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const room = await RoomService.getRoomByCode(req.params.code);
      if (!room || room.status === 'ENDED' || room.hostId !== req.user!.id) { res.status(403).json({ success: false, message: 'Only the active host can remove the guest.' }); return; }
      if (room.guestId) {
        await RoomService.leaveRoom(room.code, room.guestId);
        await req.app.get('roomGateway')?.publishMembership(room.code, room.guestId);
        void LiveKitService.removeParticipant(room.code, room.guestId).catch(() => undefined);
      }
      res.json({ success: true, room: await RoomService.getRoomByCode(room.code) });
    } catch (error) { next(error); }
  }

  static async messages(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const room = await RoomService.getRoomByCode(req.params.code);
      if (!room || room.status === 'ENDED' || (room.hostId !== req.user!.id && room.guestId !== req.user!.id)) { res.status(403).json({ success: false, message: 'Join this room to read its chat.' }); return; }
      const messages = await prisma.chatMessage.findMany({ where: { roomId: room.id }, orderBy: { createdAt: 'desc' }, take: 100 });
      res.json({ success: true, messages: messages.reverse().map((item) => ({ id: item.id, senderId: item.senderId, senderName: room.participants.find((member) => member.id === item.senderId)?.displayName || 'Former participant', text: item.message, timestamp: item.createdAt.getTime() })) });
    } catch (error) { next(error); }
  }

  static async embed(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const room = await RoomService.getRoomByCode(req.params.code);
      if (!room || room.status === 'ENDED' || (room.hostId !== req.user!.id && room.guestId !== req.user!.id)) {
        res.status(403).json({ success: false, message: 'Join this room before loading its player.' }); return;
      }
      const selection = room.catalogSelection;
      if (!selection || selection.playerType !== 'iframe') { res.status(404).json({ success: false, message: 'No iframe selected.' }); return; }
      if (room.hostId !== req.user!.id && !selection.launchAt) { res.status(409).json({ success: false, message: 'Waiting for the host to start the movie.' }); return; }
      const players = await embedProviderRegistry.resolveAll({ mediaType: 'movie', tmdbId: selection.tmdbId }, req.query.platform === 'web' ? 'web' : 'mobile');
      const player = players.find((item) => item.providerId === selection.providerId);
      if (!player) { res.status(404).json({ success: false, message: 'The selected provider is no longer authorized or available.' }); return; }
      logger.info('embed.room_selected', { requestId: res.locals.requestId, roomId: room.id, userId: req.user!.id,
        mediaType: player.mediaType, tmdbId: player.tmdbId, providerId: player.providerId,
        embedHost: new URL(player.embedUrl).hostname, verification: 'configured_embed_url' });
      res.json({ success: true, player });
    } catch (error) { next(error); }
  }

  static async leave(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await RoomService.leaveRoom(req.params.code, req.user!.id);
      await req.app.get('roomGateway')?.publishMembership(req.params.code.toUpperCase(), req.user!.id);
      void LiveKitService.removeParticipant(req.params.code, req.user!.id).catch(() => undefined);
      res.json({ success: true });
    }
    catch (error) { next(error); }
  }

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
      if (room.hostId !== req.user!.id && room.guestId !== req.user!.id) {
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
      // Joining over HTTP is authoritative even before the guest socket is ready.
      await req.app.get('roomGateway')?.publishMembership(room.code);
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
      await req.app.get('roomGateway')?.publishMembership(code.toUpperCase());
      res.status(200).json({ success: true, message: 'Room closed.' });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  static async selectMovie(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const room = await RoomService.selectCloudMovie(req.params.code, req.user!.id, req.body.movieId);
      res.status(200).json({ success: true, room });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
}
