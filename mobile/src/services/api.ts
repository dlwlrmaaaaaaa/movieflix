import { StorageService } from './storage';
import {
  AuthTokens,
  UserProfile,
  RoomDetails,
  LiveKitTokenResponse,
  MovieNightHistoryItem,
} from '@togetherflix/shared';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:4000';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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
    throw new Error(data.message || `Request failed with status ${response.status}`);
  }

  return data as T;
}

export const api = {
  auth: {
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
