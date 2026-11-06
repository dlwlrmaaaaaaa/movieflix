import { notifySessionRevoked } from './authEvents';
import { StorageService } from './storage';
import {
  AuthTokens,
  UserProfile,
  RoomDetails,
  LiveKitTokenResponse,
  MovieNightHistoryItem,
  AuthorizedPlaybackSource,
  MovieCatalogPage,
  TmdbMovieDetails,
  WatchlistItem,
  ContinueWatchingItem,
  StreamResolution,
  EmbeddedPlayerDescriptor,
} from '@togetherflix/shared';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:4000';

export async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await StorageService.getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && data.code === 'SESSION_REPLACED' && token) notifySessionRevoked(token, data.message);
    const error = new Error(data.message || `Request failed with status ${response.status}`) as Error & { status: number };
    error.status = response.status;
    throw error;
  }

  return data as T;
}

export const api = {
  auth: {
    logout: () => request<{ success: boolean }>('/api/auth/logout', { method: 'POST' }),
    register: (email: string, password: string, displayName: string) =>
      request<AuthTokens & { success: boolean }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, displayName }),
      }),

    login: (email: string, password: string) =>
      request<AuthTokens & { success: boolean }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),

    getMe: () =>
      request<{ success: boolean; user: UserProfile }>('/api/auth/me'),

    createPartnerInvite: (inviteEmail: string) =>
      request<{ success: boolean; inviteCode: string; expiresAt: string }>('/api/auth/partner/invite', {
        method: 'POST',
        body: JSON.stringify({ inviteEmail }),
      }),

    acceptPartnerInvite: (inviteCode: string) =>
      request<{ success: boolean; user: UserProfile; message: string }>('/api/auth/partner/accept', {
        method: 'POST',
        body: JSON.stringify({ inviteCode }),
      }),

    unlinkPartner: () =>
      request<{ success: boolean; user: UserProfile; message: string }>('/api/auth/partner/unlink', {
        method: 'POST',
      }),
  },

  rooms: {
    startMovie: (code: string) => request<{ success: boolean; room: RoomDetails }>(`/api/rooms/${encodeURIComponent(code)}/start`, { method: 'POST' }),
    prepareDirect: (code: string) => request<{ success: boolean; room: RoomDetails }>(`/api/rooms/${encodeURIComponent(code)}/direct`, { method: 'POST' }),
    removeGuest: (code: string) => request<{ success: boolean; room: RoomDetails }>(`/api/rooms/${encodeURIComponent(code)}/guest/remove`, { method: 'POST' }),
    messages: (code: string) => request<{ success: boolean; messages: Array<{ id: string; senderId: string; senderName: string; text: string; timestamp: number }> }>(`/api/rooms/${encodeURIComponent(code)}/messages`),
    leave: (code: string) => request<{ success: boolean }>(`/api/rooms/${encodeURIComponent(code)}/leave`, { method: 'POST' }),
    embed: (code: string, platform: 'web' | 'mobile') => request<{ success: boolean; player: EmbeddedPlayerDescriptor }>(`/api/rooms/${encodeURIComponent(code)}/embed?platform=${platform}`),
    create: () =>
      request<{ success: boolean; room: RoomDetails }>('/api/rooms', {
        method: 'POST',
      }),

    get: (code: string) =>
      request<{ success: boolean; room: RoomDetails }>(`/api/rooms/${code}`),

    join: (code: string) =>
      request<{ success: boolean; room: RoomDetails }>('/api/rooms/join', {
        method: 'POST',
        body: JSON.stringify({ code }),
      }),

    setControlMode: (code: string, isHostOnlyControl: boolean) =>
      request<{ success: boolean; room: RoomDetails }>(`/api/rooms/${code}/control`, {
        method: 'PATCH',
        body: JSON.stringify({ isHostOnlyControl }),
      }),

    close: (code: string) =>
      request<{ success: boolean; message: string }>(`/api/rooms/${code}/close`, {
        method: 'POST',
      }),

    selectMovie: (code: string, movieId: string) =>
      request<{ success: boolean; room: RoomDetails }>(`/api/rooms/${code}/movie/select`, {
        method: 'POST',
        body: JSON.stringify({ movieId }),
      }),

    uploadMovie: async (code: string, file: { uri: string; name: string; size?: number | null; durationSeconds: number }) => {
      const token = await StorageService.getToken();
      const form = new FormData();
      form.append('durationSeconds', String(file.durationSeconds));
      form.append('movie', { uri: file.uri, name: file.name, type: 'video/*' } as any);
      const response = await fetch(`${BASE_URL}/api/rooms/${code}/movie`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Movie upload failed.');
      return data as { success: boolean; room: RoomDetails };
    },
    streamUrl: (path: string, token: string) => `${BASE_URL}${path}?access_token=${encodeURIComponent(token)}`,
  },

  movies: {
    nowPlaying: (page = 1, signal?: AbortSignal) => request<{ success: boolean } & MovieCatalogPage>(`/api/movies/now-playing?page=${page}`, { signal }),
    trending: (page = 1, signal?: AbortSignal) => request<{ success: boolean } & MovieCatalogPage>(`/api/movies/trending?page=${page}`, { signal }),
    popular: (page = 1, signal?: AbortSignal) => request<{ success: boolean } & MovieCatalogPage>(`/api/movies/popular?page=${page}`, { signal }),
    topRated: (page = 1, signal?: AbortSignal) => request<{ success: boolean } & MovieCatalogPage>(`/api/movies/top-rated?page=${page}`, { signal }),
    upcoming: (page = 1, signal?: AbortSignal) => request<{ success: boolean } & MovieCatalogPage>(`/api/movies/upcoming?page=${page}`, { signal }),
    searchCatalog: (query: string, page = 1, signal?: AbortSignal) => request<{ success: boolean } & MovieCatalogPage>(`/api/movies/search?q=${encodeURIComponent(query)}&page=${page}`, { signal }),
    details: (tmdbId: number, signal?: AbortSignal) => request<{ success: boolean; movie: TmdbMovieDetails }>(`/api/movies/${tmdbId}`, { signal }),
    sources: (tmdbId: number) => request<{ success: boolean; sources: AuthorizedPlaybackSource[]; message?: string }>(`/api/movies/${tmdbId}/sources`),
    stream: (tmdbId: number) => request<{ success: boolean } & StreamResolution>(`/api/movies/${tmdbId}/stream`),
    embed: (tmdbId: number, platform: 'web' | 'mobile') => request<{ success: boolean; player: EmbeddedPlayerDescriptor; players?: EmbeddedPlayerDescriptor[] }>(`/api/movies/${tmdbId}/embed?platform=${platform}`),
    tvEmbed: (tmdbId: number, season: number, episode: number, platform: 'web' | 'mobile', format?: 'path' | 'query') => request<{ success: boolean; player: EmbeddedPlayerDescriptor; players?: EmbeddedPlayerDescriptor[] }>(`/api/movies/tv/${tmdbId}/${season}/${episode}/embed?platform=${platform}${format ? `&format=${format}` : ''}`),
    prepareSolo: (tmdbId: number) => request<{ success: boolean; movie: import('@togetherflix/shared').CloudMovie; source: AuthorizedPlaybackSource; alternatives: Array<{ movie: import('@togetherflix/shared').CloudMovie; source: AuthorizedPlaybackSource }> }>(`/api/movies/${tmdbId}/watch`, { method: 'POST' }),
    createWatchParty: (tmdbId: number, positionSeconds = 0, providerId?: string, platform: 'web' | 'mobile' = 'web') => request<{ success: boolean; room: RoomDetails; movie: import('@togetherflix/shared').CloudMovie; source: AuthorizedPlaybackSource }>(`/api/movies/${tmdbId}/watch-party`, { method: 'POST', body: JSON.stringify({ positionSeconds, providerId, platform }) }),
    list: () => request<{ success: boolean; movies: import('@togetherflix/shared').CloudMovie[] }>('/api/movies'),
    createStream: (input: { title: string; description?: string | null; posterUrl?: string | null; streamingUrl: string; streamingFormat: 'AUTO' | 'DASH' | 'HLS' | 'MP4' | 'WEBM' }) =>
      request<{ success: boolean; movie: import('@togetherflix/shared').CloudMovie }>('/api/movies/streams', { method: 'POST', body: JSON.stringify(input) }),
    importMpd: (input: { title: string; description?: string | null; posterUrl?: string | null; originalFilename: string; manifestXml: string; manifestBaseUrl?: string | null }) =>
      request<{ success: boolean; movie: import('@togetherflix/shared').CloudMovie }>('/api/movies/manifests', { method: 'POST', body: JSON.stringify(input) }),
    initiateUpload: (input: { title: string; originalFilename: string; mimeType: string; fileSize: number }) =>
      request<{ success: boolean; movie: import('@togetherflix/shared').CloudMovie; uploadId: string; partSizeBytes: number }>('/api/movies/uploads', { method: 'POST', body: JSON.stringify(input) }),
    signPart: (id: string, partNumber: number) =>
      request<{ success: boolean; uploadUrl: string; expiresInSeconds: number }>(`/api/movies/uploads/${id}/part`, { method: 'POST', body: JSON.stringify({ partNumber }) }),
    completeUpload: (id: string, parts: Array<{ partNumber: number; eTag: string }>) =>
      request<{ success: boolean; movie: import('@togetherflix/shared').CloudMovie }>(`/api/movies/uploads/${id}/complete`, { method: 'POST', body: JSON.stringify({ parts }) }),
    cancelUpload: (id: string) => request<{ success: boolean }>(`/api/movies/uploads/${id}`, { method: 'DELETE' }),
    delete: (id: string) => request<{ success: boolean }>(`/api/movies/${id}`, { method: 'DELETE' }),
    update: (id: string, input: { title?: string; description?: string | null; durationSeconds?: number | null; posterUrl?: string | null; streamingUrl?: string; streamingFormat?: 'AUTO' | 'DASH' | 'HLS' | 'MP4' | 'WEBM' }) => request<{ success: boolean; movie: import('@togetherflix/shared').CloudMovie }>(`/api/movies/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    playback: (id: string) => request<{ success: boolean; playbackUrl: string; expiresInSeconds: number | null; sourceType: 'UPLOAD' | 'STREAM' | 'MANIFEST'; streamingFormat: 'DASH' | 'HLS' | 'MP4' | 'WEBM' | null }>(`/api/movies/${id}/playback`),
  },

  users: {
    watchlist: () => request<{ success: boolean; items: WatchlistItem[] }>('/api/users/watchlist'),
    addToWatchlist: (tmdbId: number) => request<{ success: boolean; item: WatchlistItem }>('/api/users/watchlist', { method: 'POST', body: JSON.stringify({ tmdbId }) }),
    removeFromWatchlist: (tmdbId: number) => request<{ success: boolean }>(`/api/users/watchlist/${tmdbId}`, { method: 'DELETE' }),
    continueWatching: () => request<{ success: boolean; items: ContinueWatchingItem[] }>('/api/users/continue-watching'),
    saveProgress: (tmdbId: number, positionSeconds: number, durationSeconds: number) => request<{ success: boolean; item: ContinueWatchingItem }>(`/api/users/continue-watching/${tmdbId}`, { method: 'PUT', body: JSON.stringify({ positionSeconds, durationSeconds }) }),
  },

  call: {
    getToken: (roomCode: string) =>
      request<{ success: boolean } & LiveKitTokenResponse>(`/api/call/${roomCode}/token`),
  },

  history: {
    getAll: () =>
      request<{ success: boolean; history: MovieNightHistoryItem[] }>('/api/history'),

    record: (data: {
      roomId: string;
      partnerName: string;
      movieTitle: string;
      durationMinutes: number;
      notes?: string;
    }) =>
      request<{ success: boolean; item: MovieNightHistoryItem }>('/api/history', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
};
