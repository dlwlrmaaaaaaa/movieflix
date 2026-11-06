export type PlayerDiagnosticType = 'attempt_started' | 'document_loaded' | 'load_error' | 'timeout' | 'fallback' | 'server_selected' | 'navigation_blocked' | 'exhausted';
export interface PlayerFailureDetails { statusCode?: number; errorCode?: number; url?: string; kind?: 'ssl_error' }
export interface PlayerDiagnosticEvent {
  event: PlayerDiagnosticType;
  playbackSessionId: string;
  sequence: number;
  attempt: number;
  platform: 'web' | 'mobile';
  deviceOS?: 'android' | 'ios' | 'web';
  mediaType: 'movie' | 'tv';
  tmdbId: number;
  season?: number;
  episode?: number;
  providerId: string;
  nextProviderId?: string;
  reason?: 'http_error' | 'network_error' | 'ssl_error' | 'stalled_load' | 'load_deadline' | 'manual_next' | 'manual_select' | 'retry';
  message?: string;
  urlHost?: string;
  elapsedMs?: number;
  statusCode?: number;
  errorCode?: number;
}
