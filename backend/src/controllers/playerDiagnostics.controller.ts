import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { EMBED_PROVIDER_CONFIGS } from '../config/embedProviders';
import { validatedEmbedRequest } from '../services/embedUrlBuilder';
import { logger, safeLogMessage } from '../services/logger';
import type { PlayerDiagnosticEvent } from '@togetherflix/shared';

const events = new Set(['attempt_started', 'document_loaded', 'load_error', 'timeout', 'fallback', 'server_selected', 'navigation_blocked', 'exhausted']);
const reasons = new Set(['http_error', 'network_error', 'stalled_load', 'load_deadline', 'manual_next', 'manual_select', 'retry']);
const providerIds = new Set(EMBED_PROVIDER_CONFIGS.map((provider) => provider.id));
const providerNames = new Map(EMBED_PROVIDER_CONFIGS.map((provider) => [provider.id, provider.name]));
const integer = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
export function reportPlayerEvent(req: AuthenticatedRequest, res: Response) {
  const body = req.body as Partial<PlayerDiagnosticEvent> | undefined;
  try {
    if (!body || !events.has(String(body.event)) || !providerIds.has(String(body.providerId)) || typeof body.playbackSessionId !== 'string' || !/^[a-zA-Z0-9_-]{8,96}$/.test(body.playbackSessionId) || !integer(body.sequence, 1, 1_000_000) || !integer(body.attempt, 0, 10000) || !['web', 'mobile'].includes(String(body.platform))) throw new Error();
    if (body.nextProviderId !== undefined && !providerIds.has(body.nextProviderId)) throw new Error();
    if (body.deviceOS !== undefined && !['android', 'ios', 'web'].includes(body.deviceOS)) throw new Error();
    if (body.reason !== undefined && !reasons.has(body.reason)) throw new Error();
    if (body.message !== undefined && (typeof body.message !== 'string' || body.message.length > 1000)) throw new Error();
    if (body.urlHost !== undefined && (typeof body.urlHost !== 'string' || !/^[a-zA-Z0-9.-]{1,253}$/.test(body.urlHost))) throw new Error();
    if (body.elapsedMs !== undefined && !integer(body.elapsedMs, 0, 86400000)) throw new Error();
    if (body.statusCode !== undefined && !integer(body.statusCode, 100, 599)) throw new Error();
    if (body.errorCode !== undefined && !integer(body.errorCode, -100000, 100000)) throw new Error();
    const media = validatedEmbedRequest(body);
    const level = ['load_error', 'timeout', 'fallback', 'navigation_blocked', 'exhausted'].includes(body.event!) ? 'warn' : 'info';
    logger[level](`player.${body.event}`, {
      source: 'client_report', requestId: res.locals.requestId, userId: req.user!.id,
      playbackSessionId: body.playbackSessionId, sequence: body.sequence, attempt: body.attempt,
      platform: body.platform, deviceOS: body.deviceOS, mediaType: media.mediaType, tmdbId: media.tmdbId,
      season: media.mediaType === 'tv' ? media.season : undefined, episode: media.mediaType === 'tv' ? media.episode : undefined,
      providerId: body.providerId, providerName: providerNames.get(body.providerId!), nextProviderId: body.nextProviderId, nextProviderName: body.nextProviderId ? providerNames.get(body.nextProviderId) : undefined, reason: body.reason,
      message: body.message === undefined ? undefined : safeLogMessage(body.message), urlHost: body.urlHost,
      elapsedMs: body.elapsedMs, statusCode: body.statusCode, errorCode: body.errorCode,
    });
    res.status(202).json({ success: true });
  } catch { res.status(400).json({ success: false, message: 'Invalid player diagnostic event.' }); }
}
