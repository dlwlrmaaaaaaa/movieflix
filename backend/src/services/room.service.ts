import { embedProviderRegistry } from './embedProviderRegistry';
import { prisma } from '../prisma';
import { generateRoomCode, validatedRoomCode } from '../utils/roomCode';
import { PlaybackMode, RoomDetails, RoomParticipant, MovieMetadata, RoomCatalogSelection } from '@togetherflix/shared';
import { canStartSynchronizedPlayback } from '../sockets/utils/roomPolicy';

export class RoomService {
  static async createRoom(hostId: string, catalogSelection?: RoomCatalogSelection, selectedMovieId?: string, initialPosition = 0): Promise<RoomDetails> {
    let code = generateRoomCode();
    // Ensure code uniqueness
    let exists = await prisma.room.findUnique({ where: { code } });
    while (exists) {
      code = generateRoomCode();
      exists = await prisma.room.findUnique({ where: { code } });
    }

    const host = await prisma.user.findUnique({ where: { id: hostId } });
    if (!host) throw new Error('Host user not found');

    const room = await prisma.room.create({
      data: {
        code,
        hostId,
        status: 'WAITING',
        isHostOnlyControl: true,
        selectedMovieId,
        playbackPosition: initialPosition,
        playbackUpdatedAt: new Date(),
        ...(catalogSelection ? { catalogSelection: { ...catalogSelection }, currentMovieTitle: catalogSelection.title, playbackMode: catalogSelection.playerType === 'iframe' ? 'IFRAME' as const : 'DIRECT' as const } : {}),
      },
      include: {
        host: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
        guest: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
        filesMetadata: true,
        viewerStates: true,
        selectedMovie: true,
      },
    });

    return this.formatRoomDetails(room);
  }

  static async startIframeParty(code: string, hostId: string): Promise<RoomDetails> {
    const room = await this.getRoomByCode(code);
    if (!room || room.status === 'ENDED' || room.hostId !== hostId) throw new Error('Only the active host can start this party.');
    const selection = room.catalogSelection;
    if (!selection || selection.playerType !== 'iframe') throw new Error('This party uses direct playback controls.');
    if (!room.guestId) throw new Error('Wait for your guest to join before starting.');
    const available = (await Promise.all(['web', 'mobile'].map((platform) => embedProviderRegistry.resolveAll({ mediaType: 'movie', tmdbId: selection.tmdbId }, platform as 'web' | 'mobile')))).flat();
    if (!available.some((player) => player.providerId === selection.providerId)) throw new Error('The selected provider is no longer available.');
    if (!selection.launchAt) await prisma.room.update({ where: { id: room.id }, data: { catalogSelection: { ...selection, launchAt: Date.now() + 1500 }, status: 'WATCHING' } });
    return (await this.getRoomByCode(code))!;
  }

  static async getRoomByCode(code: string): Promise<RoomDetails | null> {
    const room = await prisma.room.findUnique({
      where: { code: validatedRoomCode(code) },
      include: {
        host: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
        guest: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
        filesMetadata: true,
        viewerStates: true,
        selectedMovie: true,
      },
    });

    if (!room) return null;
    return this.formatRoomDetails(room);
  }

  static async joinRoom(code: string, userId: string): Promise<RoomDetails> {
    const normalizedCode = validatedRoomCode(code);
    const room = await prisma.room.findUnique({
      where: { code: normalizedCode },
      include: { host: true, guest: true, filesMetadata: true, viewerStates: true, selectedMovie: true },
    });

    if (!room) {
      throw new Error(`Room with code "${normalizedCode}" not found.`);
    }

    if (room.status === 'ENDED') {
      throw new Error('This movie room has already ended.');
    }

    // If user is already the host or existing guest, allow re-join
    if (room.hostId === userId || room.guestId === userId) {
      return this.formatRoomDetails(room);
    }

    // Limit to two participants
    if (room.guestId && room.guestId !== userId) {
      throw new Error('This private room is already full (limited to 2 participants).');
    }

    // Claim the single guest slot atomically; two simultaneous joins cannot overwrite it.
    const claim = await prisma.room.updateMany({ where: { id: room.id, guestId: null, status: { not: 'ENDED' } }, data: { guestId: userId } });
    if (claim.count !== 1) {
      const latest = await this.getRoomByCode(normalizedCode);
      if (latest?.guestId === userId && latest.status !== 'ENDED') return latest;
      throw new Error('This private room is already full or has ended.');
    }
    const updated = await prisma.room.update({
      where: { id: room.id },
      data: {},
      include: {
        host: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
        guest: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
        filesMetadata: true,
        viewerStates: true,
        selectedMovie: true,
      },
    });

    return this.formatRoomDetails(updated);
  }

  static async setControlMode(code: string, hostId: string, isHostOnlyControl: boolean): Promise<RoomDetails> {
    const room = await prisma.room.findUnique({ where: { code: validatedRoomCode(code) } });
    if (!room) throw new Error('Room not found');
    if (room.hostId !== hostId) throw new Error('Only the room host can change playback control permissions.');

    const updated = await prisma.room.update({
      where: { id: room.id },
      data: { isHostOnlyControl },
      include: {
        host: { select: { id: true, displayName: true, avatarUrl: true } },
        guest: { select: { id: true, displayName: true, avatarUrl: true } },
        filesMetadata: true,
        viewerStates: true,
      },
    });

    return this.formatRoomDetails(updated);
  }

  static async saveMovieMetadata(
    roomId: string,
    userId: string,
    metadata: { fileName: string; durationSeconds: number; fileSizeBytes?: number | null }
  ) {
    return prisma.roomMovieMeta.upsert({
      where: {
        roomId_userId: {
          roomId,
          userId,
        },
      },
      update: {
        fileName: metadata.fileName,
        durationSeconds: metadata.durationSeconds,
        fileSizeBytes: metadata.fileSizeBytes ? BigInt(metadata.fileSizeBytes) : null,
      },
      create: {
        roomId,
        userId,
        fileName: metadata.fileName,
        durationSeconds: metadata.durationSeconds,
        fileSizeBytes: metadata.fileSizeBytes ? BigInt(metadata.fileSizeBytes) : null,
      },
    });
  }

  static async saveHostMovie(
    roomId: string,
    hostId: string,
    metadata: { fileName: string; durationSeconds: number; fileSizeBytes?: number | null; mediaPath: string; mimeType?: string | null }
  ) {
    await prisma.room.update({
      where: { id: roomId },
      data: { currentMovieTitle: metadata.fileName, status: 'WAITING', playbackPosition: 0, playbackIsPlaying: false, playbackUpdatedAt: new Date() } as any,
    });
    return prisma.roomMovieMeta.upsert({
      where: { roomId_userId: { roomId, userId: hostId } },
      update: { ...metadata, isReady: true },
      create: { roomId, userId: hostId, ...metadata, isReady: true },
    });
  }

  static async savePlaybackState(roomId: string, position: number, isPlaying: boolean, anchorTime = new Date()) {
    return prisma.room.update({ where: { id: roomId }, data: { status: 'WATCHING', playbackPosition: position, playbackIsPlaying: isPlaying, playbackUpdatedAt: anchorTime, playbackVersion: { increment: 1 } } as any });
  }

  static async setInitialPosition(roomId: string, position: number) {
    return prisma.room.update({
      where: { id: roomId },
      data: { playbackPosition: position, playbackIsPlaying: false, playbackUpdatedAt: new Date(), playbackVersion: { increment: 1 } } as any,
    });
  }

  static async selectCloudMovie(code: string, hostId: string, movieId: string): Promise<RoomDetails> {
    const room = await prisma.room.findUnique({ where: { code: validatedRoomCode(code) } });
    if (!room || room.status === 'ENDED') throw new Error('This room is unavailable or has ended.');
    if (room.hostId !== hostId) throw new Error('Only the room host can select a movie.');
    if (room.catalogSelection) throw new Error('The movie is fixed for this catalog party.');
    const movie = await prisma.movie.findFirst({ where: { id: movieId, status: 'READY' } });
    if (!movie) throw new Error('Movie is not ready for viewing.');
    await prisma.$transaction([
      prisma.room.update({ where: { id: room.id }, data: { selectedMovieId: movie.id, currentMovieTitle: movie.title, playbackMode: 'DIRECT', screenSharingUserId: null, playbackPosition: 0, playbackIsPlaying: false, playbackUpdatedAt: new Date(), playbackVersion: { increment: 1 } } as any }),
      prisma.roomViewerState.deleteMany({ where: { roomId: room.id } }),
    ]);
    const updated = await this.getRoomByCode(room.code);
    if (!updated) throw new Error('Room not found after movie selection.');
    return updated;
  }

  static async setReadyStatus(roomId: string, userId: string, isReady: boolean) {
    return prisma.roomMovieMeta.updateMany({
      where: { roomId, userId },
      data: { isReady },
    });
  }

  static async setPlaybackMode(code: string, hostId: string, mode: PlaybackMode, screenSharingUserId: string | null = null): Promise<RoomDetails> {
    const room = await prisma.room.findUnique({ where: { code: validatedRoomCode(code) } });
    if (!room || room.status === 'ENDED') throw new Error('This room is unavailable or has ended.');
    if (room.hostId !== hostId) throw new Error('Only the room host can change playback mode.');
    if (room.catalogSelection && mode === 'MANUAL') throw new Error('Catalog parties retain their selected movie.');
    if (mode === 'IFRAME' && (room.catalogSelection as any)?.playerType !== 'iframe') throw new Error('This room has no selected iframe provider.');
    if (mode === 'DIRECT' && !room.selectedMovieId) throw new Error('Select a playable movie before switching to direct playback.');
    await prisma.room.update({
      where: { id: room.id },
      data: {
        playbackMode: mode as any,
        screenSharingUserId: mode === 'SCREEN_SHARE' ? screenSharingUserId || hostId : null,
        playbackIsPlaying: false,
        playbackUpdatedAt: new Date(),
        playbackVersion: { increment: 1 },
      } as any,
    });
    const updated = await this.getRoomByCode(room.code);
    if (!updated) throw new Error('Room not found after playback mode update.');
    return updated;
  }

  static async setViewerState(roomCode: string, userId: string, movieId: string, state: 'WAITING' | 'LOADING' | 'BUFFERING' | 'READY' | 'ERROR' | 'DISCONNECTED') {
    const room = await prisma.room.findUnique({ where: { code: validatedRoomCode(roomCode) } });
    if (!room || room.status === 'ENDED' || room.selectedMovieId !== movieId || (room.hostId !== userId && room.guestId !== userId)) {
      throw new Error('Viewer state does not match the active room movie.');
    }
    await prisma.roomViewerState.upsert({
      where: { roomId_userId: { roomId: room.id, userId } },
      create: { roomId: room.id, userId, selectedMovieId: movieId, state: state as any },
      update: { selectedMovieId: movieId, state: state as any },
    });
    return room;
  }

  static async allViewersReady(roomCode: string): Promise<boolean> {
    const room = await prisma.room.findUnique({ where: { code: validatedRoomCode(roomCode) }, include: { viewerStates: true } });
    if (!room?.selectedMovieId) return false;
    const participants = room.guestId ? [room.hostId, room.guestId] : [room.hostId];
    return canStartSynchronizedPlayback(participants, room.viewerStates, room.selectedMovieId);
  }

  static async leaveRoom(code: string, userId: string): Promise<void> {
    const room = await this.getRoomByCode(code);
    if (!room) return;
    if (room.hostId === userId) return this.closeRoom(code, userId);
    if (room.guestId !== userId) throw new Error('You are not a participant in this room.');
    await prisma.$transaction([
      prisma.room.updateMany({ where: { id: room.id, guestId: userId }, data: { guestId: null } }),
      prisma.roomViewerState.deleteMany({ where: { roomId: room.id, userId } }),
      prisma.roomMovieMeta.deleteMany({ where: { roomId: room.id, userId } }),
    ]);
  }

  static async closeRoom(code: string, userId: string): Promise<void> {
    const room = await prisma.room.findUnique({ where: { code: validatedRoomCode(code) } });
    if (!room) return;
    if (room.hostId !== userId) {
      throw new Error('Only the host can close this room.');
    }

    await prisma.room.update({
      where: { id: room.id },
      data: { status: 'ENDED', closedAt: new Date() },
    });
  }

  private static formatRoomDetails(room: any): RoomDetails {
    const participants: RoomParticipant[] = [];

    if (room.host) {
      const hostMeta = room.filesMetadata?.find((m: any) => m.userId === room.host.id);
      const hostViewer = room.viewerStates?.find((viewer: any) => viewer.userId === room.host.id && viewer.selectedMovieId === room.selectedMovieId);
      participants.push({
        id: room.host.id,
        displayName: room.host.displayName,
        avatarUrl: room.host.avatarUrl,
        isHost: true,
        isReady: hostMeta ? hostMeta.isReady : false,
        isConnected: hostViewer?.state !== 'DISCONNECTED',
        readinessState: hostViewer?.state || (room.selectedMovieId ? 'WAITING' : undefined),
        metadata: hostMeta
          ? {
              userId: hostMeta.userId,
              displayName: room.host.displayName,
              fileName: hostMeta.fileName,
              durationSeconds: hostMeta.durationSeconds,
              fileSizeBytes: hostMeta.fileSizeBytes ? Number(hostMeta.fileSizeBytes) : null,
              isReady: hostMeta.isReady,
              pickedAt: hostMeta.updatedAt.toISOString(),
              streamUrl: hostMeta.mediaPath ? `/api/rooms/${room.code}/movie` : null,
              mimeType: hostMeta.mimeType,
            }
          : null,
      });
    }

    if (room.guest) {
      const guestMeta = room.filesMetadata?.find((m: any) => m.userId === room.guest.id);
      const guestViewer = room.viewerStates?.find((viewer: any) => viewer.userId === room.guest.id && viewer.selectedMovieId === room.selectedMovieId);
      participants.push({
        id: room.guest.id,
        displayName: room.guest.displayName,
        avatarUrl: room.guest.avatarUrl,
        isHost: false,
        isReady: guestMeta ? guestMeta.isReady : false,
        isConnected: guestViewer?.state !== 'DISCONNECTED',
        readinessState: guestViewer?.state || (room.selectedMovieId ? 'WAITING' : undefined),
        metadata: guestMeta
          ? {
              userId: guestMeta.userId,
              displayName: room.guest.displayName,
              fileName: guestMeta.fileName,
              durationSeconds: guestMeta.durationSeconds,
              fileSizeBytes: guestMeta.fileSizeBytes ? Number(guestMeta.fileSizeBytes) : null,
              isReady: guestMeta.isReady,
              pickedAt: guestMeta.updatedAt.toISOString(),
              streamUrl: guestMeta.mediaPath ? `/api/rooms/${room.code}/movie` : null,
              mimeType: guestMeta.mimeType,
            }
          : null,
      });
    }

    return {
      catalogSelection: room.catalogSelection || null,
      id: room.id,
      code: room.code,
      status: room.status,
      hostId: room.hostId,
      guestId: room.guestId,
      isHostOnlyControl: room.isHostOnlyControl,
      currentMovieTitle: room.currentMovieTitle,
      playbackPosition: room.playbackPosition,
      playbackIsPlaying: room.playbackIsPlaying,
      playbackUpdatedAt: room.playbackUpdatedAt?.toISOString() || null,
      playbackVersion: room.playbackVersion || 0,
      playbackMode: room.playbackMode || (room.selectedMovieId ? 'DIRECT' : 'MANUAL'),
      screenSharingUserId: room.screenSharingUserId || null,
      selectedMovie: room.selectedMovie ? {
        id: room.selectedMovie.id,
        ownerId: room.selectedMovie.ownerId,
        title: room.selectedMovie.title,
        originalFilename: room.selectedMovie.originalFilename,
        mimeType: room.selectedMovie.mimeType,
        fileSize: Number(room.selectedMovie.fileSize),
        status: room.selectedMovie.status,
        sourceType: room.selectedMovie.sourceType,
        streamingFormat: room.selectedMovie.streamingFormat,
        description: room.selectedMovie.description,
        durationSeconds: room.selectedMovie.durationSeconds,
        posterUrl: room.selectedMovie.posterUrl || (room.selectedMovie.posterKey ? `/api/movies/${room.selectedMovie.id}/poster` : null),
        tmdbId: room.selectedMovie.tmdbId,
        providerId: room.selectedMovie.providerId,
        providerSourceId: room.selectedMovie.providerSourceId,
        licenseUrl: room.selectedMovie.licenseUrl,
        createdAt: room.selectedMovie.createdAt.toISOString(),
        updatedAt: room.selectedMovie.updatedAt.toISOString(),
      } : null,
      participants,
      createdAt: room.createdAt.toISOString(),
    };
  }
}
