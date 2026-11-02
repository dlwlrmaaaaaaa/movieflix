import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useSocket } from './SocketContext';
import { useRoom } from './RoomContext';
import { socketService } from '../services/socket';
import { PlaybackState } from '@togetherflix/shared';

interface PlaybackSyncContextType {
  isPlaying: boolean;
  position: number;
  duration: number;
  playbackRate: number;
  driftSeconds: number;
  isCountingDown: boolean;
  countdownNumber: number;
  isBuffering: boolean;
  play: () => void;
  pause: () => void;
  seek: (pos: number) => void;
  updateLocalPosition: (pos: number, duration?: number) => void;
  requestResync: () => void;
  setBuffering: (buffering: boolean) => void;
  seekTarget: number | null;
  clearSeekTarget: () => void;
}

const PlaybackSyncContext = createContext<PlaybackSyncContextType | undefined>(undefined);

export function PlaybackSyncProvider({ children }: { children: ReactNode }) {
  const { socket } = useSocket();
  const { room, isHost } = useRoom();

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [position, setPosition] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [driftSeconds, setDriftSeconds] = useState<number>(0);
  const [isCountingDown, setIsCountingDown] = useState<boolean>(false);
  const [countdownNumber, setCountdownNumber] = useState<number>(3);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [seekTarget, setSeekTarget] = useState<number | null>(null);

  const lastHeartbeatTimeRef = useRef<number>(0);
  const rateResetTimerRef = useRef<any>(null);
  const latestPositionRef = useRef<number>(0);
  const latestVersionRef = useRef<number>(-1);
  const scheduledStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hardCorrectionAtRef = useRef<number>(0);

  // This provider stays mounted while navigating between rooms. Playback
  // versions are scoped to a room/movie generation, so discard the previous
  // room's version before accepting its successor's initial sync packet.
  useEffect(() => {
    latestVersionRef.current = -1;
    latestPositionRef.current = 0;
    if (scheduledStartTimerRef.current) clearTimeout(scheduledStartTimerRef.current);
    scheduledStartTimerRef.current = null;
    setIsPlaying(false);
    setPosition(0);
    setSeekTarget(null);
    setPlaybackRate(1);
  }, [room?.code, room?.selectedMovie?.id, room?.playbackMode]);

  useEffect(() => {
    if (!socket || !room) return;

    // 1. Synchronized 3-2-1 countdown launch
    socket.on('playback:countdown_start', ({ countdownSeconds, scheduledStartTime, startPosition }) => {
      setIsCountingDown(true);
      setCountdownNumber(countdownSeconds);
      setSeekTarget(startPosition);

      let currentCount = countdownSeconds;
      const interval = setInterval(() => {
        currentCount -= 1;
        if (currentCount > 0) {
          setCountdownNumber(currentCount);
        } else {
          clearInterval(interval);
          setIsCountingDown(false);

          // Wait until exact scheduledStartTime
          const delay = Math.max(0, scheduledStartTime - socketService.getEstimatedServerTime());
          setTimeout(() => {
            setIsPlaying(true);
            setPlaybackRate(1.0);
          }, delay);
        }
      }, 1000);
    });

    // 2. Playback state updates (PLAY, PAUSE, SEEK)
    socket.on('playback:sync', (state: PlaybackState) => {
      // Socket reconnects can replay a state packet. Versions are assigned by
      // the server, so equal/older packets must not restart a settled player.
      if (typeof state.version === 'number' && (state.version < latestVersionRef.current || (state.version === latestVersionRef.current && state.updatedBy !== 'SYSTEM_RESYNC'))) return;
      if (typeof state.version === 'number') latestVersionRef.current = state.version;
      if (state.action === 'PLAY') {
        // Seek while paused as soon as the schedule arrives. Waiting until the
        // start timestamp to seek made the guest decode after the host had
        // already begun playing.
        if (scheduledStartTimerRef.current) clearTimeout(scheduledStartTimerRef.current);
        const nowServer = socketService.getEstimatedServerTime();
        const lateBySeconds = state.scheduledStartTime
          ? Math.max(0, nowServer - state.scheduledStartTime) / 1000
          : Math.max(0, nowServer - state.serverTime) / 1000;
        const startPosition = state.position + lateBySeconds;
        setSeekTarget(startPosition);
        setPosition(startPosition);
        setPlaybackRate(1.0);

        const delay = state.scheduledStartTime ? Math.max(0, state.scheduledStartTime - nowServer) : 0;
        scheduledStartTimerRef.current = setTimeout(() => {
          // A late packet starts at the currently expected authoritative
          // position. Normal packets were already positioned while paused.
          const delayedSeconds = state.scheduledStartTime
            ? Math.max(0, socketService.getEstimatedServerTime() - state.scheduledStartTime) / 1000
            : 0;
          if (delayedSeconds > 0.15) setSeekTarget(state.position + delayedSeconds);
          setIsPlaying(true);
          setPlaybackRate(1.0);
          scheduledStartTimerRef.current = null;
        }, delay);
      } else if (state.action === 'PAUSE') {
        if (scheduledStartTimerRef.current) clearTimeout(scheduledStartTimerRef.current);
        scheduledStartTimerRef.current = null;
        setIsPlaying(false);
        setSeekTarget(state.position);
        setPlaybackRate(1.0);
      } else if (state.action === 'SEEK') {
        setSeekTarget(state.position);
        setPosition(state.position);
      }
    });

    // 3. Periodic Host Heartbeat (authoritative drift correction on Guest)
    socket.on('playback:heartbeat_tick', ({ hostPosition, isPlaying: hostPlaying, serverTime }) => {
      if (isHost) return; // Only guest adjusts to host tick

      const nowServer = socketService.getEstimatedServerTime();
      const elapsedSinceTickSec = Math.max(0, (nowServer - serverTime) / 1000);
      const expectedHostPos = hostPlaying ? hostPosition + elapsedSinceTickSec : hostPosition;

      const drift = latestPositionRef.current - expectedHostPos;
      const absDrift = Math.abs(drift);
      setDriftSeconds(absDrift);
      if (process.env.NODE_ENV !== 'production') {
        const { rttMs, offsetMs } = socketService.getNetworkMetrics();
        console.log(`[Sync] local=${latestPositionRef.current.toFixed(3)} expected=${expectedHostPos.toFixed(3)} drift=${Math.round(drift * 1000)}ms rtt=${rttMs}ms offset=${Math.round(offsetMs)}ms`);
      }

      // Drift threshold handling:
      const now = Date.now();
      if (absDrift > 0.5 && now - hardCorrectionAtRef.current >= 2000) {
        // Large discrepancy -> Snap seek
        console.log(`[Sync Drift Hard Correct] Drift: ${drift.toFixed(2)}s -> Seeking to ${expectedHostPos.toFixed(2)}s`);
        setSeekTarget(expectedHostPos);
        setPlaybackRate(1.0);
        hardCorrectionAtRef.current = now;
      } else if (absDrift >= 0.15 && hostPlaying) {
        // Minor discrepancy -> Adaptive playback rate adjustment without audio distortion
        const newRate = drift > 0 ? 0.97 : 1.03; // slow down if ahead, speed up if behind
        setPlaybackRate(newRate);

        if (rateResetTimerRef.current) clearTimeout(rateResetTimerRef.current);
        rateResetTimerRef.current = setTimeout(() => {
          setPlaybackRate(1.0);
        }, 1500);
      } else {
        // Imperceptible drift (< 350ms) -> Normal rate
        setPlaybackRate(1.0);
      }
    });

    return () => {
      socket.off('playback:countdown_start');
      socket.off('playback:sync');
      socket.off('playback:heartbeat_tick');
      if (rateResetTimerRef.current) clearTimeout(rateResetTimerRef.current);
      if (scheduledStartTimerRef.current) clearTimeout(scheduledStartTimerRef.current);
    };
  }, [socket, room?.code, isHost]);

  function play() {
    if (!room || !socket || !isHost) return;
    socket.emit('playback:play', {
      roomCode: room.code,
      position,
      clientTimestamp: Date.now(),
    });
  }

  function pause() {
    if (!room || !socket || !isHost) return;
    socket.emit('playback:pause', {
      roomCode: room.code,
      position,
    });
  }

  function seek(pos: number) {
    if (!room || !socket || !isHost) return;
    setSeekTarget(pos);
    socket.emit('playback:seek', {
      roomCode: room.code,
      position: pos,
    });
  }

  function updateLocalPosition(pos: number, dur?: number) {
    latestPositionRef.current = pos;
    setPosition(pos);
    if (dur && dur > 0) setDuration(dur);

    // If host, send heartbeat every 2 seconds
    if (isHost && room?.playbackMode === 'DIRECT' && socket && isPlaying && !scheduledStartTimerRef.current) {
      const now = Date.now();
      if (now - lastHeartbeatTimeRef.current >= 2000) {
        lastHeartbeatTimeRef.current = now;
        socket.emit('playback:heartbeat', {
          roomCode: room.code,
          position: pos,
          isPlaying,
          clientTimestamp: now,
        });
      }
    }
  }

  function requestResync() {
    if (!room || !socket) return;
    socket.emit('playback:resync_request', { roomCode: room.code });
  }

  function clearSeekTarget() {
    setSeekTarget(null);
  }

  return (
    <PlaybackSyncContext.Provider
      value={{
        isPlaying,
        position,
        duration,
        playbackRate,
        driftSeconds,
        isCountingDown,
        countdownNumber,
        isBuffering,
        play,
        pause,
        seek,
        updateLocalPosition,
        requestResync,
        setBuffering: setIsBuffering,
        seekTarget,
        clearSeekTarget,
      }}
    >
      {children}
    </PlaybackSyncContext.Provider>
  );
}

export function usePlaybackSync() {
  const context = useContext(PlaybackSyncContext);
  if (!context) throw new Error('usePlaybackSync must be used within a PlaybackSyncProvider');
  return context;
}
