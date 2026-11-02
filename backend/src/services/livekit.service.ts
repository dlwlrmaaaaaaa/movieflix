import { AccessToken, TrackSource, RoomServiceClient } from 'livekit-server-sdk';
import { prisma } from '../prisma';
import { ENV } from '../config/env';
import { LiveKitTokenResponse } from '@togetherflix/shared';

export class LiveKitService {
  static async removeParticipant(code: string, userId: string, sessionId?: string | null): Promise<void> {
    const serverUrl = ENV.LIVEKIT_URL.trim().replace(/^ws/, 'http');
    if (!serverUrl || !ENV.LIVEKIT_API_KEY || !ENV.LIVEKIT_API_SECRET) return;
    const service = new RoomServiceClient(serverUrl, ENV.LIVEKIT_API_KEY, ENV.LIVEKIT_API_SECRET);
    const currentSession = sessionId === undefined ? (await prisma.user.findUnique({ where: { id: userId }, select: { activeSessionId: true } }))?.activeSessionId : sessionId;
    await service.removeParticipant(`tf-${code.trim().toLowerCase()}`, currentSession ? `${userId}:${currentSession}` : userId);
  }

  static async createToken(roomName: string, participantIdentity: string, participantName: string, canShareScreen = false): Promise<LiveKitTokenResponse> {
    const serverUrl = ENV.LIVEKIT_URL.trim().replace(/\/$/, '');
    if (!/^wss?:\/\//i.test(serverUrl)) {
      throw new Error('LIVEKIT_URL must be a ws:// or wss:// signaling URL.');
    }
    const at = new AccessToken(ENV.LIVEKIT_API_KEY, ENV.LIVEKIT_API_SECRET, {
      identity: participantIdentity,
      name: participantName,
      ttl: '6h',
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canPublishSources: canShareScreen
        ? [TrackSource.CAMERA, TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO]
        : [TrackSource.CAMERA, TrackSource.MICROPHONE],
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    return {
      token,
      serverUrl,
      roomName,
      participantIdentity,
      participantName,
    };
  }
}
