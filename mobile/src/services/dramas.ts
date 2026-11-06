import type { DramaCategory, DramaDetails, DramaPage, EpisodeSummary, EpisodePlayback, EpisodeContinue, EpisodeSubtitle, RoomDetails } from '@togetherflix/shared';
import { request } from './api';
const base = '/api/dramas';
const json = (method: string, body: unknown) => ({ method, body: JSON.stringify(body) });
export const dramas = {
  discover: (category: DramaCategory, page = 1, query = '', trending = false, signal?: AbortSignal, filters: { year?: string; country?: string; genre?: string } = {}) => {
    const params = new URLSearchParams({ category, page: String(page), trending: String(trending), ...(query ? { query } : {}), ...filters });
    return request<DramaPage>(`${base}?${params}`, { signal });
  },
  details: (id: number, signal?: AbortSignal) => request<{ drama: DramaDetails }>(`${base}/${id}`, { signal }),
  season: (id: number, season: number, signal?: AbortSignal) => request<{ episodes: EpisodeSummary[] }>(`${base}/${id}/seasons/${season}`, { signal }),
  importSeason: (id: number, season: number) => request(`${base}/${id}/seasons/${season}/import`, json('POST', {})),
  playback: (id: string) => request<EpisodePlayback>(`${base}/episodes/${id}/playback`),
  progressSession: (id: string) => request<{ sessionId: string; positionSeconds: number }>(`${base}/episodes/${id}/progress-session`, json('POST', {})),
  progress: (id: string, sessionId: string, sequence: number, positionSeconds: number, durationSeconds: number) => request(`${base}/episodes/${id}/progress`, json('PUT', { sessionId, sequence, positionSeconds, durationSeconds })),
  continue: () => request<{ items: EpisodeContinue[] }>(`${base}/continue`),
  recent: () => request<{ items: Array<{ episode: EpisodeSummary; drama: DramaDetails }> }>(`${base}/recent`),
  next: (id: string) => request<{ episode: EpisodeSummary | null }>(`${base}/episodes/${id}/next`),
  subtitleInfo: (id: string) => request<{ subtitles: Array<Pick<EpisodeSubtitle, 'id' | 'language' | 'label'>> }>(`${base}/episodes/${id}/subtitles`),
  subtitles: (id: string) => request<{ subtitles: EpisodeSubtitle[] }>(`${base}/episodes/${id}/subtitles?cues=true`),
  addSubtitle: (id: string, language: string, label: string, text: string) => request(`${base}/episodes/${id}/subtitles`, json('POST', { language, label, text })),
  attach: (id: string, movieId: string) => request(`${base}/episodes/${id}/source`, json('PUT', { movieId })),
  party: (id: string) => request<{ room: RoomDetails }>(`${base}/episodes/${id}/party`, json('POST', {})),
  roomNext: (code: string) => request<{ episode: EpisodeSummary | null }>(`${base}/rooms/${code}/next`),
  select: (room: RoomDetails, episodeId: string, ended = false) => request<{ room: RoomDetails }>(`${base}/rooms/${room.code}/episode`, json('POST', { episodeId, ended, expected: { movieId: room.selectedMovie?.id, version: room.playbackVersion } })),
};
