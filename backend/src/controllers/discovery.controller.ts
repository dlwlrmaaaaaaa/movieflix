import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { MovieService } from '../services/movie.service';
import { RoomService } from '../services/room.service';
import { StreamingSourceService } from '../services/streamingSource.service';
import { TmdbService, UpstreamServiceError } from '../services/tmdb.service';
import { embedProviderRegistry } from '../services/embedProviderRegistry';
import { validatedTmdbId, validatedTvUrlFormat } from '../services/embedUrlBuilder';
import { logger, safeLogMessage } from '../services/logger';
import type { EmbeddedPlayerDescriptor } from '@togetherflix/shared';

function logEmbedSelection(req: AuthenticatedRequest, res: Response, player: EmbeddedPlayerDescriptor, players: EmbeddedPlayerDescriptor[]) {
  logger.info('embed.selected', { requestId: res.locals.requestId, userId: req.user!.id,
    mediaType: player.mediaType, tmdbId: player.tmdbId, season: player.season, episode: player.episode,
    platform: req.query.platform === 'web' ? 'web' : 'mobile', providerId: player.providerId, providerName: player.providerName,
    providerOrder: players.map((item) => item.providerId), embedHost: new URL(player.embedUrl).hostname,
    // Resolving an embed URL does not verify that its video can actually play.
    verification: 'configured_embed_url',
  });
}

function sendError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof UpstreamServiceError) {
    if (error.retryAfterSeconds) res.setHeader('Retry-After', error.retryAfterSeconds);
    res.status(error.statusCode).json({ success: false, message: error.message });
    return;
  }
  next(error);
}

export class DiscoveryController {
  static normalizedSource(source: import('@togetherflix/shared').AuthorizedPlaybackSource): import('@togetherflix/shared').NormalizedStreamingSource {
    return {
      available: true,
      provider: source.providerId,
      providerSourceId: source.sourceId,
      type: source.format.toLowerCase() as 'mp4' | 'webm' | 'hls' | 'dash',
      url: source.playbackUrl,
      mimeType: source.mimeType,
      supportsDirectPlayback: true,
      supportsSynchronization: true,
      licenseName: source.licenseName,
      licenseUrl: source.licenseUrl,
      detailsUrl: source.detailsUrl,
    };
  }

  static async trending(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json({ success: true, ...(await TmdbService.trending(req.query.page)) }); } catch (error) { sendError(error, res, next); }
  }

  static async popular(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json({ success: true, ...(await TmdbService.popular(req.query.page)) }); } catch (error) { sendError(error, res, next); }
  }

  static async topRated(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json({ success: true, ...(await TmdbService.topRated(req.query.page)) }); } catch (error) { sendError(error, res, next); }
  }

  static async nowPlaying(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json({ success: true, ...(await TmdbService.nowPlaying(req.query.page)) }); } catch (error) { sendError(error, res, next); }
  }

  static async upcoming(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json({ success: true, ...(await TmdbService.upcoming(req.query.page)) }); } catch (error) { sendError(error, res, next); }
  }

  static async search(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json({ success: true, ...(await TmdbService.search(req.query.q, req.query.page)) }); } catch (error) { sendError(error, res, next); }
  }

  static async details(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json({ success: true, movie: await TmdbService.details(req.params.id) }); } catch (error) { sendError(error, res, next); }
  }

  static async sources(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const movie = await TmdbService.details(req.params.id);
      const sources = await StreamingSourceService.find(movie);
      res.json({
        success: true,
        sources,
        message: sources.length ? undefined : 'No playable source is currently available for this movie.',
      });
    } catch (error) { sendError(error, res, next); }
  }

  static async stream(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const movie = await TmdbService.details(req.params.id);
      const resolution = await StreamingSourceService.resolve(movie);
      if (resolution.sources.length) {
        res.json({ success: true, tmdbId: movie.id, available: true, sources: resolution.sources.map(DiscoveryController.normalizedSource) });
        return;
      }
      if (resolution.providerCount > 0 && resolution.providerErrors.length === resolution.providerCount) {
        res.status(502).json({ success: false, tmdbId: movie.id, available: false, sources: [], message: 'Authorized streaming providers are temporarily unavailable.' });
        return;
      }
      res.status(404).json({ success: false, tmdbId: movie.id, available: false, sources: [], message: 'No authorized playable source is available for this movie.' });
    } catch (error) { sendError(error, res, next); }
  }

  static async embed(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const platform = req.query.platform === 'web' ? 'web' : 'mobile';
      // Confirm that the existing TMDB selection is a real movie before asking providers.
      const movie = await TmdbService.details(req.params.id);
      const players = await embedProviderRegistry.resolveAll({ mediaType: 'movie', tmdbId: movie.id }, platform);
      const player = players[0];
      if (!player) {
        logger.warn('embed.unavailable', { requestId: res.locals.requestId, mediaType: 'movie', tmdbId: movie.id });
        res.status(404).json({ success: false, message: 'No authorized embedded player is configured for this movie.' });
        return;
      }
      logEmbedSelection(req, res, player, players);
      res.json({ success: true, player, players });
    } catch (error) { logger.warn('embed.resolve_error', { requestId: res.locals.requestId, mediaType: 'movie', message: safeLogMessage(error) }); sendError(error, res, next); }
  }

  static async tvEmbed(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const platform = req.query.platform === 'web' ? 'web' : 'mobile';
      let requestedFormat: 'path' | 'query' | undefined;
      try {
        requestedFormat = req.query.format === undefined ? undefined : validatedTvUrlFormat(req.query.format);
      } catch (error) {
        res.status(400).json({ success: false, message: error instanceof Error ? error.message : 'Invalid TV embed URL format.' });
        return;
      }
      const show = await TmdbService.tvEpisode(req.params.id, req.params.season, req.params.episode);
      const players = await embedProviderRegistry.resolveAll({
        mediaType: 'tv', tmdbId: show.tmdbId, season: show.season, episode: show.episode,
        ...(requestedFormat ? { tvUrlFormat: requestedFormat } : {}),
      }, platform);
      const player = players[0];
      if (!player) {
        logger.warn('embed.unavailable', { requestId: res.locals.requestId, mediaType: 'tv', tmdbId: show.tmdbId });
        res.status(404).json({ success: false, message: 'No authorized embedded player is configured for this TV episode.' });
        return;
      }
      logEmbedSelection(req, res, player, players);
      res.json({ success: true, player, players });
    } catch (error) { logger.warn('embed.resolve_error', { requestId: res.locals.requestId, mediaType: 'tv', message: safeLogMessage(error) }); sendError(error, res, next); }
  }

  static async createWatchParty(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      let tmdbId: number;
      try { tmdbId = validatedTmdbId(req.params.id); }
      catch (error) { res.status(400).json({ success: false, message: error instanceof Error ? error.message : 'Invalid movie ID.' }); return; }
      const movie = await TmdbService.details(tmdbId);
      const platform = req.body?.platform === 'web' ? 'web' : 'mobile';
      const providerId = req.body?.providerId;
      if (providerId !== undefined && (typeof providerId !== 'string' || providerId.length > 100)) { res.status(400).json({ success: false, message: 'Invalid provider selection.' }); return; }
      const players = await embedProviderRegistry.resolveAll({ mediaType: 'movie', tmdbId: movie.id }, platform);
      const explicitPlayer = providerId ? players.find((item) => item.providerId === providerId) : undefined;
      if (providerId && !explicitPlayer) { res.status(404).json({ success: false, message: 'Selected provider is unavailable.' }); return; }
      const sources = explicitPlayer ? [] : await StreamingSourceService.find(movie);
      const player = explicitPlayer || (!sources.length ? players[0] : undefined);
      if (player) {
        const room = await RoomService.createRoom(req.user!.id, {
          tmdbId: movie.id, mediaType: 'movie', title: movie.title, posterUrl: movie.posterUrl,
          providerId: player.providerId, providerName: player.providerName, playerType: 'iframe',
        });
        res.status(201).json({ success: true, room }); return;
      }
      if (!sources.length) { res.status(404).json({ success: false, message: 'No authorized player is available for this movie.' }); return; }
      const source = sources[0];
      const libraryMovie = await MovieService.createAuthorizedProviderMovie(req.user!.id, movie, source);
      const requestedPosition = Number(req.body?.positionSeconds || 0);
      const initialPosition = Number.isFinite(requestedPosition) && requestedPosition > 0 && requestedPosition <= 86_400 ? requestedPosition : 0;
      const selectedRoom = await RoomService.createRoom(req.user!.id, {
        tmdbId: movie.id, mediaType: 'movie', title: movie.title, posterUrl: movie.posterUrl,
        providerId: source.providerId, providerName: source.providerId.replace(/_/g, ' '), playerType: 'direct',
      }, libraryMovie.id, initialPosition);
      res.status(201).json({ success: true, room: selectedRoom, movie: libraryMovie, source });
    } catch (error) { sendError(error, res, next); }
  }

  static async prepareSoloPlayback(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const movie = await TmdbService.details(req.params.id);
      const sources = await StreamingSourceService.find(movie);
      if (!sources.length) {
        res.status(404).json({ success: false, message: 'This movie is currently unavailable for streaming.' });
        return;
      }
      const options = await Promise.all(sources.map(async (source) => ({ source, movie: await MovieService.createAuthorizedProviderMovie(req.user!.id, movie, source) })));
      res.status(201).json({ success: true, movie: options[0].movie, source: options[0].source, alternatives: options });
    } catch (error) { sendError(error, res, next); }
  }
}
