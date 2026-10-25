import { AccessToken } from 'livekit-server-sdk';
import { ENV } from '../config/env';
import { LiveKitTokenResponse } from '@togetherflix/shared';

export class LiveKitService {
  static async createToken(roomName: string, participantIdentity: string, participantName: string): Promise<LiveKitTokenResponse> {
    const at = new AccessToken(ENV.LIVEKIT_API_KEY, ENV.LIVEKIT_API_SECRET, {
      identity: participantIdentity,
      name: participantName,
      ttl: '6h',
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    return {
      token,
      serverUrl: ENV.LIVEKIT_URL,
      roomName,
      participantIdentity,
      participantName,
    };
  }
}
