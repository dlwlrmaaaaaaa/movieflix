import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { usePathname } from 'expo-router';
import { AppState } from 'react-native';
import {
  RoomDetails,
  RoomParticipant,
  CompatibilityReport,
  MovieMetadata,
  CloudMovie,
} from '@togetherflix/shared';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import { api } from '../services/api';
import { StorageService } from '../services/storage';

export interface LocalMovieFile {
  uri: string;
  name: string;
  size?: number | null;
  durationSeconds: number;
  headers?: Record<string, string>;
}

export interface ChatItem {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export interface ReactionItem {
  id: string;
  emoji: string;
  senderName: string;
  timestamp: number;
}

interface RoomContextType {
  room: RoomDetails | null;
  isHost: boolean;
  partner: RoomParticipant | null;
  selectedMovie: LocalMovieFile | null;
  compatibility: CompatibilityReport | null;
  isReady: boolean;
  partnerIsReady: boolean;
  viewerReadyCount: number;
  allViewersReady: boolean;
  chatMessages: ChatItem[];
  activeReactions: ReactionItem[];
  createRoom: () => Promise<RoomDetails>;
  joinRoom: (code: string) => Promise<RoomDetails>;
  createCatalogWatchParty: (tmdbId: number, positionSeconds?: number, providerId?: string, platform?: 'web' | 'mobile') => Promise<RoomDetails>;
  selectCloudMovie: (movie: CloudMovie) => Promise<void>;
  toggleReady: (ready: boolean) => void;
  reportViewerState: (state: 'WAITING' | 'LOADING' | 'BUFFERING' | 'READY' | 'ERROR' | 'DISCONNECTED') => void;
  sendReaction: (emoji: string) => void;
  sendChatMessage: (text: string) => void;
  leaveRoom: () => Promise<void>;
  setRoom: React.Dispatch<React.SetStateAction<RoomDetails | null>>;
}

const RoomContext = createContext<RoomContextType | undefined>(undefined);

export function RoomProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const inParty = pathname.startsWith('/room/') || pathname.startsWith('/party/');
  const { socket } = useSocket();

  const roomEventVersion = useRef(0);
  const [room, setRoom] = useState<RoomDetails | null>(null);
  const [selectedMovie, setSelectedMovie] = useState<LocalMovieFile | null>(null);
  const [compatibility, setCompatibility] = useState<CompatibilityReport | null>(null);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<ChatItem[]>([]);
  const [activeReactions, setActiveReactions] = useState<ReactionItem[]>([]);

  useEffect(() => { if (!user) { setRoom(null); resetRoomState(); } }, [user?.id]);

  const isHost = Boolean(room && user && room.hostId === user.id);
  const partner = room?.participants.find((p) => p.id !== user?.id) || null;
  const partnerIsReady = Boolean(partner?.isReady);
  const viewerReadyCount = room?.participants.filter((participant) => participant.readinessState === 'READY').length || 0;
  const allViewersReady = Boolean(room?.participants.length && room.participants.every((participant) => participant.readinessState === 'READY'));

  useEffect(() => {
    if (!socket || !room) return;

    const roomCode = room.code;
    let active = true;

    // Socket.IO room membership is lost whenever a client reconnects. Rejoin the
    // real-time room and use the server's response as the source of truth.
    const joinRealtimeRoom = () => {
      socket.emit('room:join', { roomCode }, (result) => {
        if (active && result.success && result.room) {
          roomEventVersion.current++;
          setRoom((current) => current?.code === roomCode ? result.room! : current);
        }
      });
    };

    socket.on('room:updated', (updatedRoom) => {
      if (active && updatedRoom.code === roomCode) {
        roomEventVersion.current++;
        setRoom((current) => current?.code === roomCode ? updatedRoom : current);
      }
    });

    socket.on('room:partner_joined', (newPartner) => {
      roomEventVersion.current++;
      setRoom((prev) => {
        if (!prev) return prev;
        const exists = prev.participants.some((p) => p.id === newPartner.id);
        const updated = exists
          ? prev.participants.map((p) => (p.id === newPartner.id ? newPartner : p))
          : [...prev.participants, newPartner];
        return { ...prev, ...(newPartner.isHost ? {} : { guestId: newPartner.id }), participants: updated };
      });
    });

    socket.on('room:partner_disconnected', (participantId) => {
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: prev.participants.map((p) =>
            p.id === participantId ? { ...p, isConnected: false } : p
          ),
        };
      });
    });

    socket.on('room:partner_left', (participantId) => {
      roomEventVersion.current++;
      setRoom((prev) => prev ? { ...prev, participants: prev.participants.filter((participant) => participant.id !== participantId), ...(prev.guestId === participantId ? { guestId: null } : {}) } : prev);
    });

    socket.on('movie:partner_selected', (metadata: MovieMetadata) => {
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: prev.participants.map((p) =>
            p.id === metadata.userId ? { ...p, metadata } : p
          ),
        };
      });
    });

    socket.on('movie:compatibility', (report: CompatibilityReport) => {
      setCompatibility(report);
    });

    socket.on('movie:readiness_update', ({ userId, isReady: readyVal }) => {
      if (userId === user?.id) {
        setIsReady(readyVal);
      }
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: prev.participants.map((p) =>
            p.id === userId ? { ...p, isReady: readyVal } : p
          ),
        };
      });
    });

    socket.on('movie:viewer_state_update', ({ userId, movieId, state }) => {
      setRoom((prev) => {
        if (!prev || prev.selectedMovie?.id !== movieId) return prev;
        return {
          ...prev,
          participants: prev.participants.map((participant) =>
            participant.id === userId ? { ...participant, readinessState: state } : participant
          ),
        };
      });
    });

    socket.on('room:reaction_received', (react) => {
      setActiveReactions((prev) => [...prev, react]);
      // Remove reaction after 3.5s
      setTimeout(() => {
        setActiveReactions((prev) => prev.filter((r) => r.id !== react.id));
      }, 3500);
    });

    socket.on('room:chat_message_received', (msg) => {
      setChatMessages((prev) => prev.some((item) => item.id === msg.id) ? prev : [...prev, msg]);
    });
    socket.on('room:error', (failure) => {
      if (failure.code === 'ROOM_REMOVED') setRoom((prev) => prev ? { ...prev, status: 'ENDED' } : prev);
    });

    socket.on('connect', joinRealtimeRoom);
    if (socket.connected) {
      joinRealtimeRoom();
    }

    return () => {
      active = false;
      socket.off('room:updated');
      socket.off('room:partner_joined');
      socket.off('room:partner_disconnected');
      socket.off('room:partner_left');
      socket.off('movie:partner_selected');
      socket.off('movie:compatibility');
      socket.off('movie:readiness_update');
      socket.off('movie:viewer_state_update');
      socket.off('room:reaction_received');
      socket.off('room:chat_message_received');
      socket.off('room:error');
      socket.off('connect', joinRealtimeRoom);
    };
  }, [socket, room?.code, user?.id]);

  // Repair missed membership updates after mobile backgrounding or a socket gap.
  useEffect(() => {
    if (!room || room.status === 'ENDED' || !user || !inParty) return;
    const code = room.code;
    let active = true;
    let inFlight = false;
    const refresh = async () => {
      if (!active || inFlight || AppState.currentState === 'background') return;
      inFlight = true;
      const eventVersion = roomEventVersion.current;
      try {
        const result = await api.rooms.get(code);
        // An older HTTP response must not undo a newer real-time room update.
        if (active && roomEventVersion.current === eventVersion) {
          setRoom((current) => current?.code === code ? result.room : current);
        }
      } catch { /* Socket reconnects and the next foreground refresh can retry. */ }
      finally { inFlight = false; }
    };
    void refresh();
    const interval = setInterval(() => void refresh(), 5000);
    const foreground = AppState.addEventListener('change', (state) => { if (state === 'active') void refresh(); });
    return () => { active = false; clearInterval(interval); foreground.remove(); };
  }, [room?.code, room?.status === 'ENDED', user?.id, inParty]);

  useEffect(() => {
    if (!room || room.status === 'ENDED') return;
    let active = true;
    api.rooms.messages(room.code).then((result) => {
      if (active) setChatMessages((prev) => Array.from(new Map([...result.messages, ...prev].map((item) => [item.id, item])).values()).sort((a, b) => a.timestamp - b.timestamp));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [room?.code]);

  // Every participant receives a short-lived R2 playback URL for the selected
  // cloud movie. No host device URI or storage credential leaves the backend.
  useEffect(() => {
    const movie = room?.selectedMovie;
    if (!movie || movie.status !== 'READY' || !inParty) return;
    let active = true;
    let renewTimer: ReturnType<typeof setTimeout> | undefined;
    const loadPlaybackUrl = async () => {
      try {
        reportViewerStateForMovie(movie.id, 'LOADING');
        const { playbackUrl, expiresInSeconds } = await api.movies.playback(movie.id);
        if (!active) return;
        setSelectedMovie({ uri: playbackUrl, name: movie.title, size: movie.fileSize, durationSeconds: 0 });
        // R2 URLs expire and are renewed. A remote DASH/HLS/MP4 source is
        // intentionally not polled; its owner must update it if it expires.
        if (expiresInSeconds && expiresInSeconds > 30) {
          renewTimer = setTimeout(() => void loadPlaybackUrl(), (expiresInSeconds - 30) * 1000);
        }
      } catch {
        if (active) {
          setSelectedMovie(null);
          reportViewerStateForMovie(movie.id, 'ERROR');
        }
      }
    };
    void loadPlaybackUrl();
    return () => { active = false; if (renewTimer) clearTimeout(renewTimer); };
  }, [room?.selectedMovie?.id, room?.selectedMovie?.updatedAt, inParty]);

  function reportViewerStateForMovie(movieId: string, state: 'WAITING' | 'LOADING' | 'BUFFERING' | 'READY' | 'ERROR' | 'DISCONNECTED') {
    if (!room || !socket) return;
    socket.emit('movie:viewer_state', { roomCode: room.code, movieId, state });
  }

  function reportViewerState(state: 'WAITING' | 'LOADING' | 'BUFFERING' | 'READY' | 'ERROR' | 'DISCONNECTED') {
    if (!room?.selectedMovie) return;
    reportViewerStateForMovie(room.selectedMovie.id, state);
  }

  async function createRoom(): Promise<RoomDetails> {
    const res = await api.rooms.create();
    if (res.success && res.room) {
      setRoom(res.room);
      resetRoomState();
      return res.room;
    }
    throw new Error('Failed to create room.');
  }

  async function joinRoom(code: string): Promise<RoomDetails> {
    const res = await api.rooms.join(code);
    if (res.success && res.room) {
      setRoom(res.room);
      resetRoomState();
      return res.room;
    }
    throw new Error('Failed to join room.');
  }

  async function createCatalogWatchParty(tmdbId: number, positionSeconds = 0, providerId?: string, platform: 'web' | 'mobile' = 'web'): Promise<RoomDetails> {
    const res = await api.movies.createWatchParty(tmdbId, positionSeconds, providerId, platform);
    setRoom(res.room);
    resetRoomState();
    return res.room;
  }

  function resetRoomState() {
    setSelectedMovie(null);
    setCompatibility(null);
    setIsReady(false);
    setChatMessages([]);
    setActiveReactions([]);
  }

  async function selectCloudMovie(movie: CloudMovie) {
    if (!room) throw new Error('Join a room before selecting a movie.');
    if (!isHost) throw new Error('Only the room host can select a movie.');
    const result = await api.rooms.selectMovie(room.code, movie.id);
    setRoom(result.room);
    (socket as any)?.emit('movie:select', {
      roomCode: room.code,
      movieId: movie.id,
    });
  }

  function toggleReady(ready: boolean) {
    setIsReady(ready);
    if (!room || !socket) return;
    socket.emit('movie:ready_toggle', {
      roomCode: room.code,
      isReady: ready,
    });
  }

  function sendReaction(emoji: string) {
    if (!room || !socket) return;
    socket.emit('room:reaction', {
      roomCode: room.code,
      emoji,
    });
  }

  function sendChatMessage(text: string) {
    if (!room || !socket || !text.trim()) return;
    socket.emit('room:chat_message', {
      roomCode: room.code,
      text: text.trim(),
    });
  }

  async function leaveRoom() {
    if (room) {
      socket?.emit('room:leave', { roomCode: room.code });
      try {
        await api.rooms.leave(room.code);
      } catch {
        // A room may already have ended while the device was disconnected.
      }
    }
    setRoom(null);
    resetRoomState();
  }

  return (
    <RoomContext.Provider
      value={{
        room,
        isHost,
        partner,
        selectedMovie,
        compatibility,
        isReady,
        partnerIsReady,
        viewerReadyCount,
        allViewersReady,
        chatMessages,
        activeReactions,
        createRoom,
        joinRoom,
        createCatalogWatchParty,
        selectCloudMovie,
        toggleReady,
        reportViewerState,
        sendReaction,
        sendChatMessage,
        leaveRoom,
        setRoom,
      }}
    >
      {children}
    </RoomContext.Provider>
  );
}

export function useRoom() {
  const context = useContext(RoomContext);
  if (!context) throw new Error('useRoom must be used within a RoomProvider');
  return context;
}
