export type RoomStatus = 'WAITING' | 'COMPATIBILITY_CHECK' | 'WATCHING' | 'ENDED';

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
  metadata?: MovieMetadata | null;
}

export interface RoomDetails {
  id: string;
  code: string;
  status: RoomStatus;
  hostId: string;
  guestId?: string | null;
  isHostOnlyControl: boolean;
  currentMovieTitle?: string | null;
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
