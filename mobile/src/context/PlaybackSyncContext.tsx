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
      if (state.action === 'PLAY') {
        const delay = state.scheduledStartTime
          ? Math.max(0, state.scheduledStartTime - socketService.getEstimatedServerTime())
          : 0;

        setTimeout(() => {
          setSeekTarget(state.position);
          setIsPlaying(true);
          setPlaybackRate(1.0);
        }, delay);
      } else if (state.action === 'PAUSE') {
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

      const drift = position - expectedHostPos;
      const absDrift = Math.abs(drift);
      setDriftSeconds(absDrift);

      // Drift threshold handling:
      if (absDrift > 1.5) {
        // Large discrepancy -> Snap seek
        console.log(`[Sync Drift Hard Correct] Drift: ${drift.toFixed(2)}s -> Seeking to ${expectedHostPos.toFixed(2)}s`);
        setSeekTarget(expectedHostPos);
        setPlaybackRate(1.0);
      } else if (absDrift >= 0.35 && hostPlaying) {
        // Minor discrepancy -> Adaptive playback rate adjustment without audio distortion
        const newRate = drift > 0 ? 0.95 : 1.05; // slow down if ahead, speed up if behind
        setPlaybackRate(newRate);

        if (rateResetTimerRef.current) clearTimeout(rateResetTimerRef.current);
        rateResetTimerRef.current = setTimeout(() => {
          setPlaybackRate(1.0);
        }, 2000);
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
    };
  }, [socket, room?.code, isHost, position]);

  function play() {
    if (!room || !socket) return;
    socket.emit('playback:play', {
      roomCode: room.code,
      position,
      clientTimestamp: Date.now(),
    });
  }

  function pause() {
    if (!room || !socket) return;
    socket.emit('playback:pause', {
      roomCode: room.code,
      position,
    });
  }

  function seek(pos: number) {
    if (!room || !socket) return;
    setSeekTarget(pos);
    socket.emit('playback:seek', {
      roomCode: room.code,
      position: pos,
    });
  }

  function updateLocalPosition(pos: number, dur?: number) {
    setPosition(pos);
    if (dur && dur > 0) setDuration(dur);

    // If host, send heartbeat every 2 seconds
    if (isHost && room && socket) {
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
