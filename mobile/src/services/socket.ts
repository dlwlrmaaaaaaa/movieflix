import { io, Socket } from 'socket.io-client';
import { StorageService } from './storage';
import { ClientToServerEvents, ServerToClientEvents } from '@togetherflix/shared';

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://10.0.2.2:4000';

class SocketService {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private clockOffsetMs = 0;
  private rttMs = 0;

  async connect(sessionToken?: string): Promise<Socket<ServerToClientEvents, ClientToServerEvents>> {
    const token = sessionToken ?? await StorageService.getToken();
    // Each provider mount owns its socket. Reusing a disconnected instance
    // leaves Fast Refresh/Strict Mode mounts permanently offline.
    this.disconnect();

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on('connect', () => {
      console.log('⚡ Connected to AnnahFlix Socket Gateway');
      this.calibrateClock();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected from Socket Gateway:', reason);
    });

    return this.socket;
  }

  getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> | null {
    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Performs NTP-like clock synchronization with the backend server.
   */
  async calibrateClock(): Promise<{ offsetMs: number; rttMs: number }> {
    if (!this.socket || !this.socket.connected) return { offsetMs: 0, rttMs: 0 };
    // Use the least-jittery of three NTP-like samples rather than trusting a
    // single packet that may have queued behind a media/network burst.
    const samples = await Promise.all([this.sampleClock(), this.sampleClock(), this.sampleClock()]);
    const best = samples.sort((a, b) => a.rttMs - b.rttMs)[0];
    this.rttMs = best.rttMs;
    this.clockOffsetMs = best.offsetMs;
    console.log(`[Clock Sync] RTT: ${best.rttMs}ms, Server Offset: ${best.offsetMs}ms (best of ${samples.length})`);
    return best;
  }

  private sampleClock(): Promise<{ offsetMs: number; rttMs: number }> {
    return new Promise((resolve) => {
      if (!this.socket || !this.socket.connected) { resolve({ offsetMs: 0, rttMs: 0 }); return; }
      const tClientSend = Date.now();
      this.socket.emit('sync:ping', { clientTimestamp: tClientSend }, (res) => {
        const tClientRecv = Date.now();
        const rttMs = tClientRecv - tClientSend;
        resolve({ rttMs, offsetMs: res.serverTimestamp + rttMs / 2 - tClientRecv });
      });
    });
  }

  getEstimatedServerTime(): number {
    return Date.now() + this.clockOffsetMs;
  }

  getNetworkMetrics(): { rttMs: number; offsetMs: number } {
    return { rttMs: this.rttMs, offsetMs: this.clockOffsetMs };
  }
}

export const socketService = new SocketService();
