import { useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import type { PlayerDiagnosticEvent, PlayerDiagnosticType } from '@togetherflix/shared';
import { request } from '../services/api';

interface Media { mediaType: 'movie' | 'tv'; tmdbId: number; season?: number; episode?: number }
type Details = Pick<PlayerDiagnosticEvent, 'providerId'> & Partial<Pick<PlayerDiagnosticEvent, 'nextProviderId' | 'reason' | 'message' | 'urlHost' | 'elapsedMs' | 'statusCode' | 'errorCode' | 'attempt'>>;
export function usePlayerDiagnostics(media: Media) {
  const key = `${media.mediaType}:${media.tmdbId}:${media.season || 0}:${media.episode || 0}`;
  const trace = useRef({ key: '', id: '', sequence: 0, seen: new Set<string>() });
  if (trace.current.key !== key) trace.current = { key, id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`, sequence: 0, seen: new Set() };
  return useCallback((event: PlayerDiagnosticType, details: Details) => {
    const session = trace.current;
    if (session.key !== key) return;
    if (!Number.isInteger(media.tmdbId) || media.tmdbId <= 0 || session.sequence >= 90) return;
    if (media.mediaType === 'tv' && (!Number.isInteger(media.season) || !Number.isInteger(media.episode) || media.season! < 1 || media.episode! < 1)) return;
    const signature = `${details.attempt || 0}:${event}:${details.providerId}:${details.nextProviderId || ''}:${details.urlHost || ''}`;
    if (session.seen.has(signature)) return;
    session.seen.add(signature);
    // Keep credentials/URL query strings out of diagnostics even before transport.
    const message = details.message?.replace(/https?:\/\/[^\s"'<>]+/gi, (raw) => { try { return new URL(raw).hostname; } catch { return '[url]'; } }).replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 400);
    const body: PlayerDiagnosticEvent = { ...media, ...details, event, attempt: details.attempt || 0,
      elapsedMs: details.elapsedMs === undefined ? undefined : Math.max(0, Math.min(86400000, Math.round(details.elapsedMs))),
      message, playbackSessionId: session.id, sequence: ++session.sequence, platform: Platform.OS === 'web' ? 'web' : 'mobile',
      deviceOS: Platform.OS === 'android' ? 'android' : Platform.OS === 'ios' ? 'ios' : Platform.OS === 'web' ? 'web' : undefined };
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 5000);
    // Best effort only. Never delay playback, queue offline events, or retry.
    void request('/api/movies/player-events', { method: 'POST', body: JSON.stringify(body), signal: controller.signal }).catch(() => undefined).finally(() => clearTimeout(timeout));
  }, [key]);
}
