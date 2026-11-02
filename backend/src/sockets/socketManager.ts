import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { authSessionEvents, isCurrentSession } from '../services/authSession.service';
import { LiveKitService } from '../services/livekit.service';
import { verifyToken } from '../utils/token';
import { validatedRoomCode } from '../utils/roomCode';
import { prisma } from '../prisma';
import { RoomService } from '../services/room.service';
import { SyncEngine } from './utils/syncEngine';
import { canHostControl, lateJoinPlayback, expectedPlaybackPosition, screenShareFallbackMode } from './utils/roomPolicy';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  PlaybackState,
  MovieMetadata,
  RoomDetails,
} from '@togetherflix/shared';

interface AuthenticatedSocket extends Socket<ClientToServerEvents, ServerToClientEvents> {
  userId?: string;
  sessionId?: string;
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
  version: number;
  /** A future server timestamp while both devices are waiting to start. */
  scheduledStartTime?: number;
}

export class SocketManager {
  private io: Server<ClientToServerEvents, ServerToClientEvents>;
  private activeRoomStates = new Map<string, RoomRuntimeState>();
  private screenShareDisconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(server: HttpServer, corsOrigin: string) {
    this.io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
      cors: {
        origin: corsOrigin === '*' ? true : corsOrigin || false,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingTimeout: 20000,
      pingInterval: 10000,
    });

    const revoke = ({ userId, sessionId }: { userId: string; sessionId: string }) => {
      for (const socket of this.io.sockets.sockets.values()) {
        const device = socket as AuthenticatedSocket;
        if (device.userId !== userId || device.sessionId === sessionId) continue;
        device.emit('auth:session_revoked', { message: 'Your account was signed in on another device.' });
        if (device.currentRoomCode) void LiveKitService.removeParticipant(device.currentRoomCode, userId, device.sessionId ?? null).catch(() => undefined);
        device.disconnect(true);
      }
    };
    authSessionEvents.on('replaced', revoke);
    server.once('close', () => authSessionEvents.off('replaced', revoke));
    this.setupMiddlewares();
    this.setupEventHandlers();
  }

  async publishPlaybackSelection(code: string): Promise<void> {
    const room = await RoomService.getRoomByCode(code);
    if (!room) return;
    this.activeRoomStates.set(code, { code, position: room.playbackPosition || 0, isPlaying: false, rate: 1, lastUpdatedServerTime: Date.now(), updatedBy: room.hostId, version: room.playbackVersion || 0 });
    this.io.to(`room:${code}`).emit('room:updated', room);
  }

  async publishMembership(code: string, removedUserId?: string): Promise<void> {
    const room = await RoomService.getRoomByCode(code);
    if (!room) return;
    this.io.to(`room:${code}`).emit('room:updated', room);
    if (room.status === 'ENDED') this.activeRoomStates.delete(code);
    for (const connected of this.io.sockets.sockets.values()) {
      const member = connected as AuthenticatedSocket;
      if (member.currentRoomCode !== code) continue;
      if (room.status === 'ENDED' || member.userId === removedUserId) {
        member.emit('room:error', { message: room.status === 'ENDED' ? 'The host ended this party.' : 'You have left or been removed from this party.', code: 'ROOM_REMOVED' });
        await member.leave(`room:${code}`);
        member.currentRoomCode = undefined;
      }
    }
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
          select: { id: true, email: true, displayName: true, activeSessionId: true },
        });

        if (!user) {
          return next(new Error('User account not found'));
        }

        if (!isCurrentSession(decoded.sessionId, user.activeSessionId)) {
          const error = new Error('Your account was signed in on another device.') as Error & { data: unknown };
          error.data = { code: 'SESSION_REPLACED' }; next(error); return;
        }
        socket.sessionId = decoded.sessionId;
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
      socket.use(async (packet, next) => {
        try {
          const user = await prisma.user.findUnique({ where: { id: userId }, select: { activeSessionId: true } });
          if (!user || !isCurrentSession(socket.sessionId, user.activeSessionId)) {
            socket.emit('auth:session_revoked', { message: 'Your account was signed in on another device.' }); socket.disconnect(true); return;
          }
          if (packet[0] === 'sync:ping') { next(); return; }
          packet[1].roomCode = validatedRoomCode(packet[1]?.roomCode);
          if (packet[0] === 'room:chat_message' && typeof packet[1].text !== 'string') throw new Error('Invalid chat message.');
          next();
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid room request.';
          socket.emit('room:error', { message, code: 'INVALID_ROOM_REQUEST' });
          const callback = packet[packet.length - 1];
          if (packet[0] === 'room:join' && typeof callback === 'function') callback({ success: false, error: message });
        }
      });

      console.log(`[Socket Connected] User ${displayName} (${userId})`);

      socket.on('party:start', async (payload, callback) => {
        try {
          const updated = await RoomService.startIframeParty(payload.roomCode, userId);
          this.io.to(`room:${updated.code}`).emit('room:updated', updated);
          if (typeof callback === 'function') callback({ success: true });
        } catch (error) { if (typeof callback === 'function') callback({ success: false, error: error instanceof Error ? error.message : 'Unable to start this party.' }); }
      });

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

          if (!room || room.status === 'ENDED') {
            if (typeof callback === 'function') callback({ success: false, error: 'Room not found' });
            return;
          }

          const isParticipant = room.hostId === userId || room.guestId === userId;
          if (!isParticipant) {
            if (typeof callback === 'function') callback({ success: false, error: 'Join the room before connecting to its real-time session.' });
            return;
          }

          // Join socket room
          socket.join(`room:${roomCode}`);
          socket.currentRoomCode = roomCode;

          // A host may briefly lose Socket.IO while the LiveKit transport is
          // recovering. Rejoining within the grace period keeps the active
          // screen-share mode and prevents a false "sharing ended" event.
          const reconnectKey = `${roomCode}:${userId}`;
          const pendingDisconnect = this.screenShareDisconnectTimers.get(reconnectKey);
          if (pendingDisconnect) {
            clearTimeout(pendingDisconnect);
            this.screenShareDisconnectTimers.delete(reconnectKey);
          }

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
              position: room.playbackPosition || 0,
              isPlaying: room.playbackIsPlaying || false,
              rate: 1.0,
              lastUpdatedServerTime: room.playbackUpdatedAt ? new Date(room.playbackUpdatedAt).getTime() : Date.now(),
              updatedBy: userId,
              version: room.playbackVersion || 0,
            });
          }

          // Return fresh room state
          const updatedRoom = await RoomService.getRoomByCode(roomCode);
          if (updatedRoom) {
            // Send the authoritative participant list to every connected device
            // in this room. This also repairs a client that missed a transient
            // partner_joined event while reconnecting.
            this.io.to(`room:${roomCode}`).emit('room:updated', updatedRoom);
          }
          if (typeof callback === 'function') {
            callback({ success: true, room: updatedRoom || room });
          }
          const runtime = this.activeRoomStates.get(roomCode)!;
          const now = Date.now();
          const isStillScheduled = Boolean(runtime.scheduledStartTime && runtime.scheduledStartTime > now);
          const position = isStillScheduled
            ? runtime.position
            : expectedPlaybackPosition(runtime.position, runtime.isPlaying, runtime.lastUpdatedServerTime, now);
          socket.emit('playback:sync', {
            ...lateJoinPlayback(position, runtime.isPlaying),
            isPlaying: runtime.isPlaying, rate: runtime.rate, updatedBy: 'SYSTEM_RESYNC', serverTime: now,
            scheduledStartTime: isStillScheduled ? runtime.scheduledStartTime : undefined,
            version: runtime.version,
          });
        } catch (err: any) {
          if (typeof callback === 'function') callback({ success: false, error: err.message });
        }
      });

      socket.on('room:leave', async (payload) => {
        const roomCode = payload.roomCode.trim().toUpperCase();
        const room = await RoomService.getRoomByCode(roomCode);
        if (!room || room.status === 'ENDED' || (room.hostId !== userId && room.guestId !== userId)) return;
        socket.leave(`room:${roomCode}`);
        if (socket.currentRoomCode === roomCode) socket.currentRoomCode = undefined;
        socket.to(`room:${roomCode}`).emit('room:partner_left', userId);
      });

      // 3. Movie Select & Metadata Broadcast
      socket.on('movie:select', async (payload, callback) => {
        try {
          const roomCode = payload.roomCode.trim().toUpperCase();
          const room = await RoomService.getRoomByCode(roomCode);
          if (!room || room.status === 'ENDED') return;
          if (!canHostControl(room.hostId, userId)) {
            socket.emit('room:error', { message: 'Only the room host can select the movie.' });
            return;
          }

          const movieId = (payload as any).movieId as string | undefined;
          if (movieId) {
            const selected = await RoomService.selectCloudMovie(roomCode, userId, movieId);
            // A new movie is a new playback generation. Never carry a position
            // or a future start timer from the previously selected movie.
            this.activeRoomStates.set(roomCode, {
              code: roomCode, position: 0, isPlaying: false, rate: 1,
              lastUpdatedServerTime: Date.now(), updatedBy: userId,
              version: selected.playbackVersion || 0,
            });
            this.io.to(`room:${roomCode}`).emit('room:updated', selected);
            return;
          }
          if (!payload.metadata) {
            socket.emit('room:error', { message: 'Movie metadata is required.' });
            return;
          }

          // Legacy metadata event remains host-only. The app uploads through the HTTP
          // endpoint so guests receive a streamable file, not a host local URI.
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
          if (refreshedRoom) {
            this.io.to(`room:${roomCode}`).emit('room:updated', refreshedRoom);
          }
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

      // 4. Legacy UI-ready toggle. It only updates the lobby UI; actual
      // readiness comes from the native player's viewer_state and the host
      // explicitly starts playback once both devices are prepared.
      socket.on('movie:ready_toggle', async (payload) => {
        try {
          const roomCode = payload.roomCode.trim().toUpperCase();
          const room = await RoomService.getRoomByCode(roomCode);
          if (!room || room.status === 'ENDED' || (room.hostId !== userId && room.guestId !== userId)) return;

          await RoomService.setReadyStatus(room.id, userId, payload.isReady);

          this.io.to(`room:${roomCode}`).emit('movie:readiness_update', {
            userId,
            isReady: payload.isReady,
          });

          // Check if both users are ready
          const refreshed = await RoomService.getRoomByCode(roomCode);
          if (refreshed) {
            this.io.to(`room:${roomCode}`).emit('room:updated', refreshed);
          }
        } catch (err: any) {
          socket.emit('room:error', { message: err.message });
        }
      });

      // The native player reports its actual load/buffer state.  It is scoped to
      // the currently selected cloud movie, so stale events from a replaced URL
      // cannot make a room start prematurely.
      socket.on('movie:viewer_state', async (payload) => {
        try {
          const roomCode = payload.roomCode.trim().toUpperCase();
          await RoomService.setViewerState(roomCode, userId, payload.movieId, payload.state);
          this.io.to(`room:${roomCode}`).emit('movie:viewer_state_update', {
            userId,
            movieId: payload.movieId,
            state: payload.state,
          });
          const refreshed = await RoomService.getRoomByCode(roomCode);
          if (refreshed) this.io.to(`room:${roomCode}`).emit('room:updated', refreshed);
        } catch (err: any) {
          socket.emit('room:error', { message: err.message, code: 'VIEWER_STATE_REJECTED' });
        }
      });

      // 5. Playback Command: Play
      socket.on('playback:play', async (payload) => {
        const roomCode = payload.roomCode.trim().toUpperCase();
        const room = await RoomService.getRoomByCode(roomCode);
        if (!room || room.status === 'ENDED') return;

        if (!canHostControl(room.hostId, userId)) {
          socket.emit('room:error', { message: 'Playback controls are reserved for the host.' });
          return;
        }

        if (room.playbackMode !== 'DIRECT') {
          socket.emit('room:error', { message: 'Direct playback controls are unavailable while screen sharing or manual mode is active.' });
          return;
        }

        if (!room.selectedMovie || !(await RoomService.allViewersReady(roomCode))) {
          socket.emit('room:error', { message: 'Every connected viewer must finish preparing the movie before starting.', code: 'VIEWERS_NOT_READY' });
          return;
        }

        // The players have already reported native readyToPlay. Leave a small
        // additional window for the scheduled seek to settle on slower phones.
        const requestedPosition = Number(payload.position);
        if (!Number.isFinite(requestedPosition) || requestedPosition < 0) {
          socket.emit('room:error', { message: 'Invalid playback position.' });
          return;
        }
        const scheduledTime = Date.now() + 2500;
        // Persist the future anchor too. After a backend restart, a joining
        // device therefore does not advance the movie before its start time.
        const saved = await RoomService.savePlaybackState(room.id, requestedPosition, true, new Date(scheduledTime));
        const state: PlaybackState = {
          action: 'PLAY',
          position: requestedPosition,
          isPlaying: true,
          rate: 1.0,
          updatedBy: userId,
          serverTime: Date.now(),
          scheduledStartTime: scheduledTime,
          version: saved.playbackVersion,
        };

        this.activeRoomStates.set(roomCode, {
          code: roomCode,
          position: requestedPosition,
          isPlaying: true,
          rate: 1.0,
          lastUpdatedServerTime: scheduledTime,
          updatedBy: userId,
          version: saved.playbackVersion,
          scheduledStartTime: scheduledTime,
        });

        this.io.to(`room:${roomCode}`).emit('playback:sync', state);
      });

      // 6. Playback Command: Pause
      socket.on('playback:pause', async (payload) => {
        const roomCode = payload.roomCode.trim().toUpperCase();
        const room = await RoomService.getRoomByCode(roomCode);
        if (!room || room.status === 'ENDED') return;

        if (!canHostControl(room.hostId, userId)) {
          socket.emit('room:error', { message: 'Playback controls are reserved for the host.' });
          return;
        }


        if (room.playbackMode !== 'DIRECT') return;

        const requestedPosition = Number(payload.position);
        if (!Number.isFinite(requestedPosition) || requestedPosition < 0) return;
        const saved = await RoomService.savePlaybackState(room.id, requestedPosition, false);
        const state: PlaybackState = {
          action: 'PAUSE',
          position: requestedPosition,
          isPlaying: false,
          rate: 1.0,
          updatedBy: userId,
          serverTime: Date.now(),
          version: saved.playbackVersion,
        };

        this.activeRoomStates.set(roomCode, {
          code: roomCode,
          position: requestedPosition,
          isPlaying: false,
          rate: 1.0,
          lastUpdatedServerTime: Date.now(),
          updatedBy: userId,
          version: saved.playbackVersion,
        });

        this.io.to(`room:${roomCode}`).emit('playback:sync', state);
      });

      // 7. Playback Command: Seek
      socket.on('playback:seek', async (payload) => {
        const roomCode = payload.roomCode.trim().toUpperCase();
        const room = await RoomService.getRoomByCode(roomCode);
        if (!room || room.status === 'ENDED') return;

        if (!canHostControl(room.hostId, userId)) {
          socket.emit('room:error', { message: 'Playback controls are reserved for the host.' });
          return;
        }


        if (room.playbackMode !== 'DIRECT') return;

        const requestedPosition = Number(payload.position);
        if (!Number.isFinite(requestedPosition) || requestedPosition < 0) return;
        const currentRuntime = this.activeRoomStates.get(roomCode);
        const isPlaying = currentRuntime ? currentRuntime.isPlaying : false;
        const scheduledTime = isPlaying ? Date.now() + 1500 : undefined;
        const saved = await RoomService.savePlaybackState(room.id, requestedPosition, isPlaying, scheduledTime ? new Date(scheduledTime) : undefined);
        const state: PlaybackState = {
          // Seeking while playing is rescheduled, not applied independently on
          // each device, so both players resume from the target together.
          action: isPlaying ? 'PLAY' : 'SEEK',
          position: requestedPosition,
          isPlaying,
          rate: 1.0,
          updatedBy: userId,
          serverTime: Date.now(),
          scheduledStartTime: scheduledTime,
          version: saved.playbackVersion,
        };

        this.activeRoomStates.set(roomCode, {
          code: roomCode,
          position: requestedPosition,
          isPlaying,
          rate: 1.0,
          lastUpdatedServerTime: Date.now(),
          updatedBy: userId,
          version: saved.playbackVersion,
          scheduledStartTime: scheduledTime,
        });

        this.io.to(`room:${roomCode}`).emit('playback:sync', state);
      });

      // 8. Playback Heartbeat (authoritative drift correction from host)
      socket.on('playback:heartbeat', async (payload) => {
        const roomCode = payload.roomCode.trim().toUpperCase();
        const runtime = this.activeRoomStates.get(roomCode);
        const room = await RoomService.getRoomByCode(roomCode);
        const position = Number(payload.position);

        // The host is the only playback authority; never forward guest packets
        // back to the host or let an old scheduled state block host heartbeats.
        if (runtime && room?.playbackMode === 'DIRECT' && canHostControl(room.hostId, userId) && Number.isFinite(position) && position >= 0) {
          runtime.position = position;
          runtime.isPlaying = payload.isPlaying;
          runtime.lastUpdatedServerTime = Date.now();
          runtime.scheduledStartTime = undefined;
          void RoomService.savePlaybackState(room.id, position, payload.isPlaying);

          socket.to(`room:${roomCode}`).emit('playback:heartbeat_tick', {
            hostPosition: position,
            isPlaying: payload.isPlaying,
            serverTime: runtime.lastUpdatedServerTime,
          });
        }
      });

      // 9. Resync Request
      socket.on('playback:resync_request', (payload) => {
        const roomCode = payload.roomCode.trim().toUpperCase();
        const runtime = this.activeRoomStates.get(roomCode);
        if (runtime) {
          const now = Date.now();
          const isStillScheduled = Boolean(runtime.scheduledStartTime && runtime.scheduledStartTime > now);
          const position = isStillScheduled ? runtime.position : expectedPlaybackPosition(runtime.position, runtime.isPlaying, runtime.lastUpdatedServerTime, now);
          // Only the requesting client needs a repair; broadcasting this state
          // could restart the other participant's scheduled player.
          socket.emit('playback:sync', {
            action: runtime.isPlaying ? 'PLAY' : 'PAUSE',
            position,
            isPlaying: runtime.isPlaying,
            rate: 1.0,
            updatedBy: 'SYSTEM_RESYNC',
            serverTime: now,
            scheduledStartTime: isStillScheduled ? runtime.scheduledStartTime : undefined,
            version: runtime.version,
          });
        }
      });

      socket.on('playback:mode_change', async (payload) => {
        try {
          const roomCode = payload.roomCode.trim().toUpperCase();
          if (!['DIRECT', 'IFRAME', 'SCREEN_SHARE', 'MANUAL'].includes(payload.mode)) return;
          const updated = await RoomService.setPlaybackMode(roomCode, userId, payload.mode);
          this.activeRoomStates.set(roomCode, {
            code: roomCode, position: updated.playbackPosition || 0, isPlaying: false, rate: 1,
            lastUpdatedServerTime: Date.now(), updatedBy: userId, version: updated.playbackVersion || 0,
          });
          this.io.to(`room:${roomCode}`).emit('playback:mode_changed', { mode: payload.mode, changedBy: userId });
          this.io.to(`room:${roomCode}`).emit('room:updated', updated);
        } catch (error) {
          socket.emit('room:error', { message: error instanceof Error ? error.message : 'Unable to change playback mode.' });
        }
      });

      socket.on('screen:start', async (payload) => {
        try {
          const roomCode = payload.roomCode.trim().toUpperCase();
          const updated = await RoomService.setPlaybackMode(roomCode, userId, 'SCREEN_SHARE', userId);
          this.activeRoomStates.set(roomCode, {
            code: roomCode, position: updated.playbackPosition || 0, isPlaying: false, rate: 1,
            lastUpdatedServerTime: Date.now(), updatedBy: userId, version: updated.playbackVersion || 0,
          });
          this.io.to(`room:${roomCode}`).emit('screen:started', { userId, userName: displayName });
          this.io.to(`room:${roomCode}`).emit('playback:mode_changed', { mode: 'SCREEN_SHARE', changedBy: userId });
          this.io.to(`room:${roomCode}`).emit('room:updated', updated);
        } catch (error) {
          socket.emit('room:error', { message: error instanceof Error ? error.message : 'Unable to start screen sharing.' });
        }
      });

      socket.on('screen:stop', async (payload) => {
        try {
          const roomCode = payload.roomCode.trim().toUpperCase();
          const room = await RoomService.getRoomByCode(roomCode);
          if (!room || room.hostId !== userId) throw new Error('Only the room host can stop screen sharing.');
          const nextMode = screenShareFallbackMode(Boolean(room.selectedMovie), room.catalogSelection?.playerType === 'iframe');
          const updated = await RoomService.setPlaybackMode(roomCode, userId, nextMode);
          this.io.to(`room:${roomCode}`).emit('screen:stopped', { userId });
          this.io.to(`room:${roomCode}`).emit('playback:mode_changed', { mode: nextMode, changedBy: userId });
          this.io.to(`room:${roomCode}`).emit('room:updated', updated);
        } catch (error) {
          socket.emit('room:error', { message: error instanceof Error ? error.message : 'Unable to stop screen sharing.' });
        }
      });

      // 10. Live Floating Reactions
      socket.on('room:reaction', (payload) => {
        const roomCode = payload.roomCode.trim().toUpperCase();
        if (!['❤️', '😂', '😭', '😮', '🍿', '🔥'].includes(payload.emoji)) return;
        void RoomService.getRoomByCode(roomCode).then((room) => {
          if (!room || room.status === 'ENDED' || (room.hostId !== userId && room.guestId !== userId)) return;
          this.io.to(`room:${roomCode}`).emit('room:reaction_received', {
            id: `react_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            emoji: payload.emoji,
            senderId: userId,
            senderName: displayName,
            timestamp: Date.now(),
          });
        });
      });

      // 11. In-Room Chat Whisper
      socket.on('room:chat_message', async (payload) => {
        const roomCode = payload.roomCode.trim().toUpperCase();
        const room = await RoomService.getRoomByCode(roomCode);
        if (!room || room.status === 'ENDED' || (room.hostId !== userId && room.guestId !== userId)) return;
        const text = payload.text.trim().slice(0, 1000);
        if (!text) return;

        // Persist message in database
        const savedMessage = await prisma.chatMessage.create({
          data: {
            roomId: room.id,
            senderId: userId,
            message: text,
          },
        });

        this.io.to(`room:${roomCode}`).emit('room:chat_message_received', {
          id: savedMessage.id,
          senderId: userId,
          senderName: displayName,
          text,
          timestamp: Date.now(),
        });
      });

      // 12. Disconnect
      socket.on('disconnect', () => {
        console.log(`[Socket Disconnected] User ${displayName} (${userId})`);
        const roomCode = socket.currentRoomCode;
        if (roomCode) {
          void RoomService.getRoomByCode(roomCode).then(async (room) => {
            if (room?.hostId === userId && room.playbackMode === 'SCREEN_SHARE') {
              const reconnectKey = `${roomCode}:${userId}`;
              const existingTimer = this.screenShareDisconnectTimers.get(reconnectKey);
              if (existingTimer) clearTimeout(existingTimer);
              const timer = setTimeout(() => {
                this.screenShareDisconnectTimers.delete(reconnectKey);
                const hostReconnected = Array.from(this.io.sockets.sockets.values()).some((candidate) => {
                  const authenticated = candidate as AuthenticatedSocket;
                  return authenticated.connected && authenticated.userId === userId && authenticated.currentRoomCode === roomCode;
                });
                if (hostReconnected) return;
                void RoomService.getRoomByCode(roomCode).then(async (latestRoom) => {
                  if (!latestRoom || latestRoom.hostId !== userId || latestRoom.playbackMode !== 'SCREEN_SHARE') return;
                  const nextMode = screenShareFallbackMode(Boolean(latestRoom.selectedMovie), latestRoom.catalogSelection?.playerType === 'iframe');
                  const updated = await RoomService.setPlaybackMode(roomCode, userId, nextMode);
                  this.io.to(`room:${roomCode}`).emit('screen:stopped', { userId });
                  this.io.to(`room:${roomCode}`).emit('playback:mode_changed', { mode: nextMode, changedBy: userId });
                  this.io.to(`room:${roomCode}`).emit('room:updated', updated);
                }).catch((error) => console.warn('[Screen Share Cleanup]', error));
              }, 5000);
              this.screenShareDisconnectTimers.set(reconnectKey, timer);
            }
            if (room?.selectedMovie) {
              await RoomService.setViewerState(roomCode, userId, room.selectedMovie.id, 'DISCONNECTED');
              const refreshed = await RoomService.getRoomByCode(roomCode);
              if (refreshed) this.io.to(`room:${roomCode}`).emit('room:updated', refreshed);
            }
          });
          socket.to(`room:${roomCode}`).emit('room:partner_disconnected', userId);
        }
      });
    });
  }
}
