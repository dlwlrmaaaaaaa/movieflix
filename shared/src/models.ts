export type RoomStatus = 'WAITING' | 'COMPATIBILITY_CHECK' | 'WATCHING' | 'ENDED';
export type UserRole = 'ADMIN' | 'USER';
export type ViewerReadiness = 'WAITING' | 'LOADING' | 'BUFFERING' | 'READY' | 'ERROR' | 'DISCONNECTED';

export type PartnerInviteStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';

export type CompatibilityGrade = 'PERFECT_MATCH' | 'COMPATIBLE_WARNING' | 'MISMATCH_ALERT';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  partnerId?: string | null;
  partner?: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
  } | null;
  createdAt: string;
  role: UserRole;
}

export interface PartnerInvite {
  id: string;
  senderId: string;
  senderName: string;
  inviteEmail: string;
  code: string;
  status: PartnerInviteStatus;
  createdAt: string;
  expiresAt: string;
}

export interface MovieMetadata {
  userId: string;
  displayName: string;
  fileName: string;
  durationSeconds: number;
  fileSizeBytes?: number | null;
  isReady: boolean;
  pickedAt: string;
  /** Authenticated backend path for the host-uploaded file. Never a device-local URI. */
  streamUrl?: string | null;
  mimeType?: string | null;
}

export type CloudMovieStatus = 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED';
export type MovieSourceType = 'UPLOAD' | 'STREAM' | 'MANIFEST';
export type StreamingFormat = 'AUTO' | 'DASH' | 'HLS' | 'MP4' | 'WEBM';
export type PlaybackMode = 'IFRAME' | 'DIRECT' | 'SCREEN_SHARE' | 'MANUAL';

export interface TmdbMovieSummary {
  id: number;
  title: string;
  originalTitle: string;
  overview: string;
  releaseDate: string | null;
  releaseYear: number | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  rating: number;
  voteCount: number;
  genreIds: number[];
}

export interface TmdbTrailer {
  key: string;
  name: string;
  site: 'YouTube';
  url: string;
}

export interface TmdbMovieDetails extends TmdbMovieSummary {
  runtimeMinutes: number | null;
  genres: Array<{ id: number; name: string }>;
  trailer: TmdbTrailer | null;
}

export interface MovieCatalogPage {
  page: number;
  totalPages: number;
  totalResults: number;
  results: TmdbMovieSummary[];
}

export interface AuthorizedPlaybackSource {
  providerId: string;
  sourceId: string;
  title: string;
  releaseYear: number;
  playbackUrl: string;
  format: Exclude<StreamingFormat, 'AUTO'>;
  mimeType: string;
  licenseName: string;
  licenseUrl: string;
  detailsUrl: string;
}

export interface NormalizedStreamingSource {
  available: true;
  provider: string;
  providerSourceId: string;
  type: 'mp4' | 'webm' | 'hls' | 'dash';
  url: string;
  mimeType: string;
  supportsDirectPlayback: true;
  supportsSynchronization: true;
  licenseName: string;
  licenseUrl: string;
  detailsUrl: string;
}

export interface StreamResolution {
  tmdbId: number;
  available: boolean;
  sources: NormalizedStreamingSource[];
}

export interface EmbeddedPlayerDescriptor {
  providerId: string;
  providerName: string;
  mediaType: 'movie' | 'tv';
  tmdbId: number;
  season?: number;
  episode?: number;
  embedUrl: string;
  supportsWeb: boolean;
  supportsMobile: boolean;
  supportsPlaybackControl: boolean;
  supportsSynchronization: boolean;
}

export interface WatchlistItem {
  id: string;
  tmdbId: number;
  title: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  overview: string | null;
  releaseYear: number | null;
  rating: number;
  createdAt: string;
}

export interface ContinueWatchingItem {
  id: string;
  tmdbId: number;
  title: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  positionSeconds: number;
  durationSeconds: number;
  completionPercent: number;
  lastWatchedAt: string;
}

export interface CloudMovie {
  id: string;
  ownerId: string;
  title: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  status: CloudMovieStatus;
  sourceType: MovieSourceType;
  streamingFormat?: StreamingFormat | null;
  description?: string | null;
  durationSeconds?: number | null;
  posterUrl?: string | null;
  tmdbId?: number | null;
  providerId?: string | null;
  providerSourceId?: string | null;
  licenseUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompatibilityReport {
  grade: CompatibilityGrade;
  durationDiffSeconds: number;
  message: string;
  details?: {
    hostDuration: number;
    guestDuration: number;
    cleanHostTitle: string;
    cleanGuestTitle: string;
  };
}

export interface RoomParticipant {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  isHost: boolean;
  isReady: boolean;
  isConnected: boolean;
  readinessState?: ViewerReadiness;
  metadata?: MovieMetadata | null;
}

/** Canonical metadata resolved by the server, never an arbitrary client iframe URL. */
export interface RoomCatalogSelection {
  episodeId?: string;
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  posterUrl: string | null;
  providerId: string;
  providerName: string;
  playerType: 'direct' | 'iframe';
  /** Shared player opening time, not a play/seek command to the iframe. */
  launchAt?: number;
  season?: number;
  episode?: number;
}

export interface RoomDetails {
  catalogSelection?: RoomCatalogSelection | null;
  id: string;
  code: string;
  status: RoomStatus;
  hostId: string;
  guestId?: string | null;
  isHostOnlyControl: boolean;
  currentMovieTitle?: string | null;
  playbackPosition?: number;
  playbackIsPlaying?: boolean;
  playbackUpdatedAt?: string | null;
  playbackVersion?: number;
  playbackMode: PlaybackMode;
  screenSharingUserId?: string | null;
  selectedMovie?: CloudMovie | null;
  participants: RoomParticipant[];
  compatibility?: CompatibilityReport | null;
  createdAt: string;
}

export interface MovieNightHistoryItem {
  id: string;
  roomId: string;
  movieTitle: string;
  partnerName: string;
  durationMinutes: number;
  watchedAt: string;
  notes?: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  user: UserProfile;
}

export interface LiveKitTokenResponse {
  token: string;
  serverUrl: string;
  roomName: string;
  participantIdentity: string;
  participantName: string;
}
