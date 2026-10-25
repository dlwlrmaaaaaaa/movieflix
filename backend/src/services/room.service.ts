import { prisma } from '../prisma';
import { generateRoomCode } from '../utils/roomCode';
import { RoomDetails, RoomParticipant, MovieMetadata } from '@togetherflix/shared';

export class RoomService {
  static async createRoom(hostId: string): Promise<RoomDetails> {
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
      },
      include: {
        host: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
        guest: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
        filesMetadata: true,
      },
    });

    return this.formatRoomDetails(room);
  }

  static async getRoomByCode(code: string): Promise<RoomDetails | null> {
    const room = await prisma.room.findUnique({
      where: { code: code.trim().toUpperCase() },
      include: {
        host: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
        guest: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
        filesMetadata: true,
      },
    });

    if (!room) return null;
    return this.formatRoomDetails(room);
  }

  static async joinRoom(code: string, userId: string): Promise<RoomDetails> {
    const normalizedCode = code.trim().toUpperCase();
    const room = await prisma.room.findUnique({
      where: { code: normalizedCode },
      include: { host: true, guest: true, filesMetadata: true },
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

    // Set as guest
    const updated = await prisma.room.update({
      where: { id: room.id },
      data: { guestId: userId },
      include: {
        host: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
        guest: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
        filesMetadata: true,
      },
    });

    return this.formatRoomDetails(updated);
  }

  static async setControlMode(code: string, hostId: string, isHostOnlyControl: boolean): Promise<RoomDetails> {
    const room = await prisma.room.findUnique({ where: { code: code.trim().toUpperCase() } });
    if (!room) throw new Error('Room not found');
    if (room.hostId !== hostId) throw new Error('Only the room host can change playback control permissions.');

    const updated = await prisma.room.update({
      where: { id: room.id },
      data: { isHostOnlyControl },
      include: {
        host: { select: { id: true, displayName: true, avatarUrl: true } },
        guest: { select: { id: true, displayName: true, avatarUrl: true } },
        filesMetadata: true,
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

  static async setReadyStatus(roomId: string, userId: string, isReady: boolean) {
    return prisma.roomMovieMeta.updateMany({
      where: { roomId, userId },
      data: { isReady },
    });
  }

  static async closeRoom(code: string, userId: string): Promise<void> {
    const room = await prisma.room.findUnique({ where: { code: code.trim().toUpperCase() } });
    if (!room) return;
    if (room.hostId !== userId && room.guestId !== userId) {
      throw new Error('Unauthorized to close this room.');
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
      participants.push({
        id: room.host.id,
        displayName: room.host.displayName,
        avatarUrl: room.host.avatarUrl,
        isHost: true,
        isReady: hostMeta ? hostMeta.isReady : false,
        isConnected: true,
        metadata: hostMeta
          ? {
              userId: hostMeta.userId,
              displayName: room.host.displayName,
              fileName: hostMeta.fileName,
              durationSeconds: hostMeta.durationSeconds,
              fileSizeBytes: hostMeta.fileSizeBytes ? Number(hostMeta.fileSizeBytes) : null,
              isReady: hostMeta.isReady,
              pickedAt: hostMeta.updatedAt.toISOString(),
            }
          : null,
      });
    }

    if (room.guest) {
      const guestMeta = room.filesMetadata?.find((m: any) => m.userId === room.guest.id);
      participants.push({
        id: room.guest.id,
        displayName: room.guest.displayName,
        avatarUrl: room.guest.avatarUrl,
        isHost: false,
        isReady: guestMeta ? guestMeta.isReady : false,
        isConnected: true,
        metadata: guestMeta
          ? {
              userId: guestMeta.userId,
              displayName: room.guest.displayName,
              fileName: guestMeta.fileName,
              durationSeconds: guestMeta.durationSeconds,
              fileSizeBytes: guestMeta.fileSizeBytes ? Number(guestMeta.fileSizeBytes) : null,
              isReady: guestMeta.isReady,
              pickedAt: guestMeta.updatedAt.toISOString(),
            }
          : null,
      });
    }

    return {
      id: room.id,
      code: room.code,
      status: room.status,
      hostId: room.hostId,
      guestId: room.guestId,
      isHostOnlyControl: room.isHostOnlyControl,
      currentMovieTitle: room.currentMovieTitle,
      participants,
      createdAt: room.createdAt.toISOString(),
    };
  }
}
