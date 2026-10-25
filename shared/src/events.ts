import { CompatibilityReport, MovieMetadata, RoomDetails, RoomParticipant } from './models';

export type PlaybackAction = 'PLAY' | 'PAUSE' | 'SEEK' | 'BUFFERING' | 'READY';

export interface PlaybackState {
  action: PlaybackAction;
  position: number;           // Current position in seconds
  isPlaying: boolean;
  rate: number;               // 1.0 = normal, 0.95/1.05 for micro-drift adjustment
  updatedBy: string;          // User ID
  serverTime: number;         // Server timestamp in ms
  scheduledStartTime?: number;// Future server timestamp (e.g. now + 300ms) for scheduled start
}

export interface ClientToServerEvents {
  // Connection / Room lifecycle
  'room:join': (payload: { roomCode: string }, callback: (res: { success: boolean; room?: RoomDetails; error?: string }) => void) => void;
  'room:leave': (payload: { roomCode: string }) => void;
  'room:kick_guest': (payload: { roomCode: string }) => void;
  'room:toggle_control_mode': (payload: { roomCode: string; isHostOnlyControl: boolean }) => void;

  // Local Movie & Readiness
  'movie:select': (payload: { roomCode: string; metadata: Omit<MovieMetadata, 'userId' | 'displayName' | 'pickedAt'> }, callback?: (report?: CompatibilityReport) => void) => void;
  'movie:ready_toggle': (payload: { roomCode: string; isReady: boolean }) => void;

  // Playback commands
  'playback:play': (payload: { roomCode: string; position: number; clientTimestamp: number }) => void;
  'playback:pause': (payload: { roomCode: string; position: number }) => void;
  'playback:seek': (payload: { roomCode: string; position: number }) => void;
  'playback:heartbeat': (payload: { roomCode: string; position: number; isPlaying: boolean; clientTimestamp: number }) => void;
  'playback:resync_request': (payload: { roomCode: string }) => void;

  // Couple interactions
  'room:reaction': (payload: { roomCode: string; emoji: string; x?: number; y?: number }) => void;
  'room:chat_message': (payload: { roomCode: string; text: string }) => void;

  // NTP Clock sync
  'sync:ping': (payload: { clientTimestamp: number }, callback: (res: { clientTimestamp: number; serverTimestamp: number }) => void) => void;
}

export interface ServerToClientEvents {
  // Room lifecycle
  'room:updated': (room: RoomDetails) => void;
  'room:partner_joined': (partner: RoomParticipant) => void;
  'room:partner_left': (participantId: string) => void;
  'room:partner_disconnected': (participantId: string) => void;
  'room:error': (payload: { message: string; code?: string }) => void;

  // Movie selection & compatibility
  'movie:partner_selected': (metadata: MovieMetadata) => void;
  'movie:compatibility': (report: CompatibilityReport) => void;
  'movie:readiness_update': (payload: { userId: string; isReady: boolean }) => void;

  // Playback execution
  'playback:countdown_start': (payload: { countdownSeconds: number; scheduledStartTime: number; startPosition: number }) => void;
  'playback:sync': (state: PlaybackState) => void;
  'playback:heartbeat_tick': (payload: { hostPosition: number; isPlaying: boolean; serverTime: number }) => void;

  // Couple interactions
  'room:reaction_received': (payload: { id: string; emoji: string; senderId: string; senderName: string; timestamp: number }) => void;
  'room:chat_message_received': (payload: { id: string; senderId: string; senderName: string; text: string; timestamp: number }) => void;
}
