import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  RoomDetails,
  RoomParticipant,
  CompatibilityReport,
  MovieMetadata,
} from '@togetherflix/shared';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import { api } from '../services/api';

export interface LocalMovieFile {
  uri: string;
  name: string;
  size?: number | null;
  durationSeconds: number;
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
  chatMessages: ChatItem[];
  activeReactions: ReactionItem[];
  createRoom: () => Promise<RoomDetails>;
  joinRoom: (code: string) => Promise<RoomDetails>;
  selectLocalMovie: (file: LocalMovieFile) => void;
  toggleReady: (ready: boolean) => void;
  sendReaction: (emoji: string) => void;
  sendChatMessage: (text: string) => void;
  leaveRoom: () => Promise<void>;
  setRoom: React.Dispatch<React.SetStateAction<RoomDetails | null>>;
}

const RoomContext = createContext<RoomContextType | undefined>(undefined);

export function RoomProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { socket } = useSocket();

  const [room, setRoom] = useState<RoomDetails | null>(null);
  const [selectedMovie, setSelectedMovie] = useState<LocalMovieFile | null>(null);
  const [compatibility, setCompatibility] = useState<CompatibilityReport | null>(null);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<ChatItem[]>([]);
  const [activeReactions, setActiveReactions] = useState<ReactionItem[]>([]);

  const isHost = Boolean(room && user && room.hostId === user.id);
  const partner = room?.participants.find((p) => p.id !== user?.id) || null;
  const partnerIsReady = Boolean(partner?.isReady);

  useEffect(() => {
    if (!socket || !room) return;

    socket.on('room:partner_joined', (newPartner) => {
      setRoom((prev) => {
        if (!prev) return prev;
        const exists = prev.participants.some((p) => p.id === newPartner.id);
        const updated = exists
          ? prev.participants.map((p) => (p.id === newPartner.id ? newPartner : p))
          : [...prev.participants, newPartner];
        return { ...prev, guestId: newPartner.id, participants: updated };
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

    socket.on('room:reaction_received', (react) => {
      setActiveReactions((prev) => [...prev, react]);
      // Remove reaction after 3.5s
      setTimeout(() => {
        setActiveReactions((prev) => prev.filter((r) => r.id !== react.id));
      }, 3500);
    });

    socket.on('room:chat_message_received', (msg) => {
      setChatMessages((prev) => [...prev, msg]);
    });

    return () => {
      socket.off('room:partner_joined');
      socket.off('room:partner_disconnected');
      socket.off('movie:partner_selected');
      socket.off('movie:compatibility');
      socket.off('movie:readiness_update');
      socket.off('room:reaction_received');
      socket.off('room:chat_message_received');
    };
  }, [socket, room?.code, user?.id]);

  async function createRoom(): Promise<RoomDetails> {
    const res = await api.rooms.create();
    if (res.success && res.room) {
      setRoom(res.room);
      resetRoomState();
      socket?.emit('room:join', { roomCode: res.room.code }, () => {});
      return res.room;
    }
    throw new Error('Failed to create room.');
  }

  async function joinRoom(code: string): Promise<RoomDetails> {
    const res = await api.rooms.join(code);
    if (res.success && res.room) {
      setRoom(res.room);
      resetRoomState();
      socket?.emit('room:join', { roomCode: res.room.code }, () => {});
      return res.room;
    }
    throw new Error('Failed to join room.');
  }

  function resetRoomState() {
    setSelectedMovie(null);
    setCompatibility(null);
    setIsReady(false);
    setChatMessages([]);
    setActiveReactions([]);
  }

  function selectLocalMovie(file: LocalMovieFile) {
    setSelectedMovie(file);
    if (!room || !socket) return;

    socket.emit(
      'movie:select',
      {
        roomCode: room.code,
        metadata: {
          fileName: file.name,
          durationSeconds: file.durationSeconds,
          fileSizeBytes: file.size || null,
          isReady: false,
        },
      },
      (report) => {
        if (report) setCompatibility(report);
      }
    );
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
        await api.rooms.close(room.code);
      } catch {
        // Ignored if room already ended
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
        chatMessages,
        activeReactions,
        createRoom,
        joinRoom,
        selectLocalMovie,
        toggleReady,
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
