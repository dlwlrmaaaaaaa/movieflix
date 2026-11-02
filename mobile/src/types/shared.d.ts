import '@togetherflix/shared';

declare module '@togetherflix/shared' {
  type UserRole = 'ADMIN' | 'USER';
  interface UserProfile {
    role: UserRole;
  }
  type CloudMovieStatus = 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED';
  interface CloudMovie {
    id: string;
    ownerId: string;
    title: string;
    originalFilename: string;
    mimeType: string;
    fileSize: number;
    status: CloudMovieStatus;
    description?: string | null;
    durationSeconds?: number | null;
    posterUrl?: string | null;
    createdAt: string;
    updatedAt: string;
    sourceType: 'UPLOAD' | 'STREAM' | 'MANIFEST';
    streamingFormat?: 'AUTO' | 'DASH' | 'HLS' | 'MP4' | null;
  }
  interface MovieMetadata {
    streamUrl?: string | null;
    mimeType?: string | null;
  }
  interface RoomDetails {
    playbackPosition?: number;
    playbackIsPlaying?: boolean;
    playbackUpdatedAt?: string | null;
    playbackVersion?: number;
    selectedMovie?: CloudMovie | null;
  }
  interface RoomParticipant {
    readinessState?: 'WAITING' | 'LOADING' | 'BUFFERING' | 'READY' | 'ERROR' | 'DISCONNECTED';
  }
  interface PlaybackState { version?: number; }
  interface ClientToServerEvents {
    'movie:viewer_state': (payload: { roomCode: string; movieId: string; state: 'WAITING' | 'LOADING' | 'BUFFERING' | 'READY' | 'ERROR' | 'DISCONNECTED' }) => void;
  }
  interface ServerToClientEvents {
    'movie:viewer_state_update': (payload: { userId: string; movieId: string; state: 'WAITING' | 'LOADING' | 'BUFFERING' | 'READY' | 'ERROR' | 'DISCONNECTED' }) => void;
  }
}
