import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyToken } from '../utils/token';
import { prisma } from '../prisma';
import { RoomService } from '../services/room.service';
import { SyncEngine } from './utils/syncEngine';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  PlaybackState,
  MovieMetadata,
  RoomDetails,
} from '@togetherflix/shared';

interface AuthenticatedSocket extends Socket<ClientToServerEvents, ServerToClientEvents> {
  userId?: string;
  userEmail?: string;
  displayName?: string;
  currentRoomCode?: string;
}

// In-memory active room playback runtime state
interface RoomRuntimeState {
  code: string;
  position: number;
  isPlaying: boolean;
  rate: number;
  lastUpdatedServerTime: number;
  updatedBy: string;
}

export class SocketManager {
  private io: Server<ClientToServerEvents, ServerToClientEvents>;
  private activeRoomStates = new Map<string, RoomRuntimeState>();

  constructor(server: HttpServer, corsOrigin: string) {
    this.io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
      cors: {
        origin: corsOrigin === '*' ? true : corsOrigin,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingTimeout: 20000,
      pingInterval: 10000,
    });

    this.setupMiddlewares();
    this.setupEventHandlers();
  }

  private setupMiddlewares(): void {
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = verifyToken(token);
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { id: true, email: true, displayName: true },
        });

        if (!user) {
          return next(new Error('User account not found'));
        }

        socket.userId = user.id;
        socket.userEmail = user.email;
        socket.displayName = user.displayName;
        next();
      } catch {
        next(new Error('Invalid or expired socket token'));
      }
    });
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      const userId = socket.userId!;
      const displayName = socket.displayName!;

      console.log(`[Socket Connected] User ${displayName} (${userId})`);

      // 1. Clock synchronization (NTP-like ping)
      socket.on('sync:ping', (payload, callback) => {
        if (typeof callback === 'function') {
          callback({
            clientTimestamp: payload.clientTimestamp,
            serverTimestamp: Date.now(),
          });
        }
      });

      // 2. Room Join
      socket.on('room:join', async (payload, callback) => {
        try {
          const roomCode = payload.roomCode.trim().toUpperCase();
          const room = await RoomService.getRoomByCode(roomCode);

          if (!room) {
            if (typeof callback === 'function') callback({ success: false, error: 'Room not found' });
            return;
          }

          const isParticipant = room.hostId === userId || room.guestId === userId;
          if (!isParticipant && room.guestId !== null) {
            if (typeof callback === 'function') callback({ success: false, error: 'Room is full (limit 2 participants)' });
            return;
          }

          // Join socket room
          socket.join(`room:${roomCode}`);
          socket.currentRoomCode = roomCode;

          // Notify partner
          socket.to(`room:${roomCode}`).emit('room:partner_joined', {
            id: userId,
            displayName,
            avatarUrl: null,
            isHost: room.hostId === userId,
            isReady: false,
            isConnected: true,
          });

          // Initialize runtime state if not present
          if (!this.activeRoomStates.has(roomCode)) {
            this.activeRoomStates.set(roomCode, {
              code: roomCode,
              position: 0,
              isPlaying: false,
              rate: 1.0,
              lastUpdatedServerTime: Date.now(),
              updatedBy: userId,
            });
          }

          // Return fresh room state
          const updatedRoom = await RoomService.getRoomByCode(roomCode);
          if (typeof callback === 'function') {
            callback({ success: true, room: updatedRoom || room });
          }
        } catch (err: any) {
          if (typeof callback === 'function') callback({ success: false, error: err.message });
        }
      });

      // 3. Movie Select & Metadata Broadcast
      socket.on('movie:select', async (payload, callback) => {
        try {
          const roomCode = payload.roomCode.trim().toUpperCase();
          const room = await RoomService.getRoomByCode(roomCode);
          if (!room) return;

          await RoomService.saveMovieMetadata(room.id, userId, payload.metadata);

          const meta: MovieMetadata = {
            ...payload.metadata,
            userId,
            displayName,
            isReady: false,
            pickedAt: new Date().toISOString(),
          };

          // Broadcast selected movie to partner
          socket.to(`room:${roomCode}`).emit('movie:partner_selected', meta);

          // Check if both participants have selected a movie
          const refreshedRoom = await RoomService.getRoomByCode(roomCode);
          if (refreshedRoom && refreshedRoom.participants.length === 2) {
            const p1 = refreshedRoom.participants[0].metadata;
            const p2 = refreshedRoom.participants[1].metadata;

            if (p1 && p2) {
              const report = SyncEngine.evaluateCompatibility(p1, p2);
              this.io.to(`room:${roomCode}`).emit('movie:compatibility', report);
              if (typeof callback === 'function') callback(report);
              return;
            }
          }

          if (typeof callback === 'function') callback(undefined);
        } catch (err: any) {
          socket.emit('room:error', { message: err.message });
        }
      });

      // 4. Movie Ready Toggle & Synchronized Countdown
      socket.on('movie:ready_toggle', async (payload) => {
        try {
          const roomCode = payload.roomCode.trim().toUpperCase();
          const room = await RoomService.getRoomByCode(roomCode);
          if (!room) return;

          await RoomService.setReadyStatus(room.id, userId, payload.isReady);

          this.io.to(`room:${roomCode}`).emit('movie:readiness_update', {
            userId,
            isReady: payload.isReady,
          });

          // Check if both users are ready
          const refreshed = await RoomService.getRoomByCode(roomCode);
          if (refreshed && refreshed.participants.length === 2) {
            const allReady = refreshed.participants.every((p) => p.isReady);
            if (allReady) {
              // Trigger synchronized 3-second countdown
              const scheduledStart = Date.now() + 3500; // 3.5s in the future
              const runtime = this.activeRoomStates.get(roomCode) || { position: 0 };

              this.io.to(`room:${roomCode}`).emit('playback:countdown_start', {
                countdownSeconds: 3,
                scheduledStartTime: scheduledStart,
                startPosition: runtime.position,
              });

              // Update runtime state
              this.activeRoomStates.set(roomCode, {
                code: roomCode,
                position: runtime.position,
                isPlaying: true,
                rate: 1.0,
                lastUpdatedServerTime: scheduledStart,
                updatedBy: 'SYSTEM',
              });
            }
          }
        } catch (err: any) {
          socket.emit('room:error', { message: err.message });
        }
      });

      // 5. Playback Command: Play
      socket.on('playback:play', async (payload) => {
        const roomCode = payload.roomCode.trim().toUpperCase();
        const room = await RoomService.getRoomByCode(roomCode);
        if (!room) return;

        if (room.isHostOnlyControl && room.hostId !== userId) {
          socket.emit('room:error', { message: 'Playback controls are reserved for the host.' });
          return;
        }

        const scheduledTime = Date.now() + 350; // 350ms network flight allowance
        const state: PlaybackState = {
          action: 'PLAY',
          position: payload.position,
          isPlaying: true,
          rate: 1.0,
          updatedBy: userId,
          serverTime: Date.now(),
          scheduledStartTime: scheduledTime,
        };

        this.activeRoomStates.set(roomCode, {
          code: roomCode,
          position: payload.position,
          isPlaying: true,
          rate: 1.0,
          lastUpdatedServerTime: scheduledTime,
          updatedBy: userId,
        });

        this.io.to(`room:${roomCode}`).emit('playback:sync', state);
      });

      // 6. Playback Command: Pause
      socket.on('playback:pause', async (payload) => {
        const roomCode = payload.roomCode.trim().toUpperCase();
        const room = await RoomService.getRoomByCode(roomCode);
        if (!room) return;

        if (room.isHostOnlyControl && room.hostId !== userId) {
          socket.emit('room:error', { message: 'Playback controls are reserved for the host.' });
          return;
        }

        const state: PlaybackState = {
          action: 'PAUSE',
          position: payload.position,
          isPlaying: false,
          rate: 1.0,
          updatedBy: userId,
          serverTime: Date.now(),
        };

        this.activeRoomStates.set(roomCode, {
          code: roomCode,
          position: payload.position,
          isPlaying: false,
          rate: 1.0,
          lastUpdatedServerTime: Date.now(),
          updatedBy: userId,
        });

        this.io.to(`room:${roomCode}`).emit('playback:sync', state);
      });

      // 7. Playback Command: Seek
      socket.on('playback:seek', async (payload) => {
        const roomCode = payload.roomCode.trim().toUpperCase();
        const room = await RoomService.getRoomByCode(roomCode);
        if (!room) return;

        if (room.isHostOnlyControl && room.hostId !== userId) {
          socket.emit('room:error', { message: 'Playback controls are reserved for the host.' });
          return;
        }

        const currentRuntime = this.activeRoomStates.get(roomCode);
        const isPlaying = currentRuntime ? currentRuntime.isPlaying : false;

        const state: PlaybackState = {
          action: 'SEEK',
          position: payload.position,
          isPlaying,
          rate: 1.0,
          updatedBy: userId,
          serverTime: Date.now(),
        };

        this.activeRoomStates.set(roomCode, {
          code: roomCode,
          position: payload.position,
          isPlaying,
          rate: 1.0,
          lastUpdatedServerTime: Date.now(),
          updatedBy: userId,
        });

        this.io.to(`room:${roomCode}`).emit('playback:sync', state);
      });

      // 8. Playback Heartbeat (authoritative drift correction from host)
      socket.on('playback:heartbeat', (payload) => {
        const roomCode = payload.roomCode.trim().toUpperCase();
        const runtime = this.activeRoomStates.get(roomCode);

        if (runtime) {
          runtime.position = payload.position;
          runtime.isPlaying = payload.isPlaying;
          runtime.lastUpdatedServerTime = Date.now();
        }

        // Forward authoritative tick to guest
        socket.to(`room:${roomCode}`).emit('playback:heartbeat_tick', {
          hostPosition: payload.position,
          isPlaying: payload.isPlaying,
          serverTime: Date.now(),
        });
      });

      // 9. Resync Request
      socket.on('playback:resync_request', (payload) => {
        const roomCode = payload.roomCode.trim().toUpperCase();
        const runtime = this.activeRoomStates.get(roomCode);
        if (runtime) {
          // Re-broadcast canonical state
          this.io.to(`room:${roomCode}`).emit('playback:sync', {
            action: runtime.isPlaying ? 'PLAY' : 'PAUSE',
            position: runtime.position,
            isPlaying: runtime.isPlaying,
            rate: 1.0,
            updatedBy: 'SYSTEM_RESYNC',
            serverTime: Date.now(),
          });
        }
      });

      // 10. Live Floating Reactions
      socket.on('room:reaction', (payload) => {
        const roomCode = payload.roomCode.trim().toUpperCase();
        this.io.to(`room:${roomCode}`).emit('room:reaction_received', {
          id: `react_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          emoji: payload.emoji,
          senderId: userId,
          senderName: displayName,
          timestamp: Date.now(),
        });
      });

      // 11. In-Room Chat Whisper
      socket.on('room:chat_message', async (payload) => {
        const roomCode = payload.roomCode.trim().toUpperCase();
        const room = await RoomService.getRoomByCode(roomCode);
        if (!room) return;

        // Persist message in database
        await prisma.chatMessage.create({
          data: {
            roomId: room.id,
            senderId: userId,
            message: payload.text.trim(),
          },
        });

        this.io.to(`room:${roomCode}`).emit('room:chat_message_received', {
          id: `msg_${Date.now()}`,
          senderId: userId,
          senderName: displayName,
          text: payload.text.trim(),
          timestamp: Date.now(),
        });
      });

      // 12. Disconnect
      socket.on('disconnect', () => {
        console.log(`[Socket Disconnected] User ${displayName} (${userId})`);
        if (socket.currentRoomCode) {
          socket.to(`room:${socket.currentRoomCode}`).emit('room:partner_disconnected', userId);
        }
      });
    });
  }
}
