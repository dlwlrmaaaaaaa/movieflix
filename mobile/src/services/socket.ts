import { io, Socket } from 'socket.io-client';
import { StorageService } from './storage';
import { ClientToServerEvents, ServerToClientEvents } from '@togetherflix/shared';

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://10.0.2.2:4000';

class SocketService {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private clockOffsetMs = 0;
  private rttMs = 0;

  async connect(): Promise<Socket<ServerToClientEvents, ClientToServerEvents>> {
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    const token = await StorageService.getToken();

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
      console.log('⚡ Connected to TogetherFlix Socket Gateway');
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
    return new Promise((resolve) => {
      if (!this.socket || !this.socket.connected) {
        resolve({ offsetMs: 0, rttMs: 0 });
        return;
      }

      const tClientSend = Date.now();
      this.socket.emit('sync:ping', { clientTimestamp: tClientSend }, (res) => {
        const tClientRecv = Date.now();
        const rtt = tClientRecv - tClientSend;
        const estimatedServerTimeAtRecv = res.serverTimestamp + rtt / 2;
        const offset = estimatedServerTimeAtRecv - tClientRecv;

        this.rttMs = rtt;
        this.clockOffsetMs = offset;

        console.log(`[Clock Sync] RTT: ${rtt}ms, Server Offset: ${offset}ms`);
        resolve({ offsetMs: offset, rttMs: rtt });
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
