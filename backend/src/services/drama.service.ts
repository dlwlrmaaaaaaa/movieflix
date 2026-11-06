import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { DramaSummary, EpisodeSummary, RoomCatalogSelection } from '@togetherflix/shared';
import { prisma } from '../prisma';
import { TmdbService, UpstreamServiceError } from './tmdb.service';
import { MovieService } from './movie.service';
import { RoomService } from './room.service';
import { normalizeSubtitles, validSubtitleLanguage } from './subtitle.service';
import { importRemoteSubtitle } from './remoteSubtitle.service';
import { validatedTmdbId, validatedSeason } from './embedUrlBuilder';

const includeEpisode = { season: { include: { drama: true } }, sources: { where: { enabled: true }, include: { movie: true }, orderBy: { createdAt: 'desc' as const } } };
export function episodeSummary(episode: any, watched = false): EpisodeSummary {
  return { id: episode.id, dramaId: episode.season.dramaId, seasonId: episode.seasonId, seasonNumber: episode.season.seasonNumber,
    episodeNumber: episode.episodeNumber, title: episode.title, runtime: episode.runtime, description: episode.description,
    thumbnailUrl: episode.thumbnailUrl, airDate: episode.airDate, available: episode.sources.some((source: any) => source.enabled && source.movie.status === 'READY'), watched };
}
function dramaSummary(drama: any): DramaSummary { const { id, seasons, ...summary } = drama; return summary; }
function readySource(episode: any) { return episode.sources.find((source: any) => source.enabled && source.movie.status === 'READY'); }
function selectionFor(episode: any): RoomCatalogSelection {
  const drama = episode.season.drama;
  return { episodeId: episode.id, tmdbId: drama.tmdbId, mediaType: 'tv', season: episode.season.seasonNumber, episode: episode.episodeNumber,
    title: `${drama.title} · S${episode.season.seasonNumber}:E${episode.episodeNumber} · ${episode.title}`, posterUrl: drama.posterUrl,
    providerId: 'episode-library', providerName: 'Episode library', playerType: 'direct' };
}
export function validProgress(input: any) {
  if (!Number.isFinite(input.positionSeconds) || input.positionSeconds < 0 || !Number.isFinite(input.durationSeconds) || input.durationSeconds <= 0 || input.durationSeconds > 86400 || input.positionSeconds > input.durationSeconds + 2 || !Number.isSafeInteger(input.sequence) || input.sequence < 1 || input.sequence > 2147483647 || typeof input.sessionId !== 'string') throw new UpstreamServiceError('Invalid episode progress.', 400);
  return { positionSeconds: Math.min(input.positionSeconds, input.durationSeconds), durationSeconds: input.durationSeconds };
}
export class DramaService {
  static async importSeason(tmdb: unknown, seasonValue: unknown) {
    const tmdbId = validatedTmdbId(tmdb); const seasonNumber = validatedSeason(seasonValue);
    const [details, metadata] = await Promise.all([TmdbService.dramaDetails(tmdbId), TmdbService.dramaSeason(tmdbId, seasonNumber)]);
    const { cast, seasons, numberOfSeasons, ...data } = details;
    await prisma.$transaction(async (tx) => {
      const drama = await tx.drama.upsert({ where: { tmdbId }, create: data, update: data });
      const season = await tx.season.upsert({ where: { dramaId_seasonNumber: { dramaId: drama.id, seasonNumber } }, create: { dramaId: drama.id, seasonNumber, title: metadata.title }, update: { title: metadata.title } });
      for (const item of metadata.episodes) await tx.episode.upsert({ where: { seasonId_episodeNumber: { seasonId: season.id, episodeNumber: item.episodeNumber } }, create: { ...item, seasonId: season.id }, update: item });
    }, { timeout: 15000 });
  }
  static async season(tmdb: unknown, seasonValue: unknown, userId: string) {
    const tmdbId = validatedTmdbId(tmdb); const seasonNumber = validatedSeason(seasonValue);
    const imported = await prisma.season.findFirst({ where: { drama: { tmdbId }, seasonNumber } });
    // Metadata is lazy: import only the season the viewer opens, never entire series.
    if (!imported) await this.importSeason(tmdbId, seasonNumber);
    const rows = await prisma.episode.findMany({ where: { season: { drama: { tmdbId }, seasonNumber } }, include: { ...includeEpisode, progress: { where: { userId }, select: { completed: true } } }, orderBy: { episodeNumber: 'asc' } });
    return rows.map((row) => episodeSummary(row, row.progress[0]?.completed));
  }
  static async episode(id: string) {
    const episode = await prisma.episode.findUnique({ where: { id }, include: includeEpisode });
    if (!episode) throw new UpstreamServiceError('Episode not found.', 404);
    return episode;
  }
  static async attachSource(userId: string, id: string, movieId: string) {
    await this.episode(id);
    const movie = await prisma.movie.findFirst({ where: { id: movieId, status: 'READY' } });
    if (!movie) throw new UpstreamServiceError('Complete and validate the upload or stream before assigning it.', 400);
    return prisma.episodeSource.upsert({ where: { movieId }, create: { episodeId: id, movieId }, update: { episodeId: id, enabled: true } });
  }
  static async subtitles(id: string, includeCues = true) {
    return (await prisma.episodeSubtitle.findMany({ where: { episodeId: id }, select: { id: true, language: true, label: true, ...(includeCues ? { cues: true } : {}) } }));
  }
  static async addSubtitle(id: string, input: any) {
    await this.episode(id);
    if (!validSubtitleLanguage(input.language) || typeof input.label !== 'string' || !input.label.trim() || input.label.length > 80) throw new UpstreamServiceError('Invalid subtitle language or label.', 400);
    const parsed = input.url === undefined ? normalizeSubtitles(input.text) : await importRemoteSubtitle(input.url);
    const normalized = { vtt: parsed.vtt, cues: parsed.cues as unknown as Prisma.InputJsonValue };
    return prisma.episodeSubtitle.upsert({ where: { episodeId_language: { episodeId: id, language: input.language } }, create: { episodeId: id, language: input.language, label: input.label, ...normalized }, update: { label: input.label, ...normalized } });
  }
  static async playback(userId: string, id: string, includeSubtitles = true) {
    const episode = await this.episode(id); const source = readySource(episode);
    if (!source) throw new UpstreamServiceError('Episode unavailable. No playable source has been assigned.', 404);
    const playback = await MovieService.playback(userId, source.movieId);
    return { episode: episodeSummary(episode), drama: dramaSummary(episode.season.drama), movieId: source.movieId, ...playback, subtitles: includeSubtitles ? await this.subtitles(id).catch(() => []) : [] };
  }
  static async beginProgress(userId: string, id: string) {
    const episode = await this.episode(id);
    if (!readySource(episode)) throw new UpstreamServiceError('Episode unavailable.', 404);
    const sessionId = randomUUID();
    return prisma.episodeProgress.upsert({ where: { userId_episodeId: { userId, episodeId: id } }, create: { userId, episodeId: id, sessionId, positionSeconds: 0, durationSeconds: 0 }, update: { sessionId, sequence: 0 } });
  }
  static async saveProgress(userId: string, id: string, input: any) {
    const values = validProgress(input);
    const rawThreshold = Number(process.env.EPISODE_COMPLETION_THRESHOLD || 0.9);
    const threshold = Number.isFinite(rawThreshold) && rawThreshold >= 0.5 && rawThreshold <= 1 ? rawThreshold : 0.9;
    return prisma.episodeProgress.updateMany({ where: { userId, episodeId: id, sessionId: input.sessionId, sequence: { lt: input.sequence } }, data: { ...values, sequence: input.sequence, completed: values.positionSeconds / values.durationSeconds >= threshold, lastWatchedAt: new Date() } });
  }
  static async continueWatching(userId: string) {
    const rows = await prisma.episodeProgress.findMany({ where: { userId }, orderBy: { lastWatchedAt: 'desc' }, take: 30, include: { episode: { include: includeEpisode } } });
    return rows.map((row) => ({ episode: episodeSummary(row.episode, row.completed), drama: dramaSummary(row.episode.season.drama), positionSeconds: row.positionSeconds, durationSeconds: row.durationSeconds, completed: row.completed }));
  }
  static async recent() {
    const sources = await prisma.episodeSource.findMany({ where: { enabled: true, movie: { status: 'READY' } }, orderBy: { createdAt: 'desc' }, take: 20, include: { episode: { include: includeEpisode } } });
    return sources.map((source) => ({ episode: episodeSummary(source.episode), drama: dramaSummary(source.episode.season.drama) }));
  }
  static async next(id: string) {
    const current = await this.episode(id);
    return prisma.episode.findFirst({ where: { season: { dramaId: current.season.dramaId }, OR: [{ seasonId: current.seasonId, episodeNumber: { gt: current.episodeNumber } }, { season: { seasonNumber: { gt: current.season.seasonNumber } } }], sources: { some: { enabled: true, movie: { status: 'READY' } } } }, orderBy: [{ season: { seasonNumber: 'asc' } }, { episodeNumber: 'asc' }], include: includeEpisode });
  }
  static async createParty(userId: string, id: string) {
    const episode = await this.episode(id); const source = readySource(episode);
    if (!source) throw new UpstreamServiceError('Episode unavailable.', 404);
    return RoomService.createRoom(userId, selectionFor(episode), source.movieId);
  }
  static async selectParty(code: string, userId: string, id: string, expected: { movieId: string; version: number }, ended = false) {
    const episode = await this.episode(id); const source = readySource(episode);
    if (!source) throw new UpstreamServiceError('Episode unavailable.', 404);
    if (!expected || typeof expected.movieId !== 'string' || !Number.isInteger(expected.version)) throw new UpstreamServiceError('Playback generation is required.', 400);
    await prisma.$transaction(async (tx) => {
      const room = await tx.room.findUnique({ where: { code } });
      if (!room || room.hostId !== userId || room.status === 'ENDED') throw new UpstreamServiceError('Only the active host can select episodes.', 403);
      if (room.selectedMovieId !== expected.movieId || room.playbackVersion !== expected.version) throw new UpstreamServiceError('Playback changed. Refresh the room before continuing.', 409);
      if (ended) {
        const selection = room.catalogSelection as unknown as RoomCatalogSelection;
        if (!selection?.episodeId) throw new UpstreamServiceError('This room is not playing an episode.', 400);
        const next = await this.next(selection.episodeId);
        if (!next || next.id !== id) throw new UpstreamServiceError('No next available episode.', 404);
        const elapsed = room.playbackIsPlaying && room.playbackUpdatedAt ? Math.max(0, (Date.now() - room.playbackUpdatedAt.getTime()) / 1000) : 0;
        const previous = await tx.episode.findUnique({ where: { id: selection.episodeId } });
        const progress = await tx.episodeProgress.findUnique({ where: { userId_episodeId: { userId, episodeId: selection.episodeId } } });
        const duration = progress?.durationSeconds || (previous?.runtime ? previous.runtime * 60 : null);
        if (!duration || room.playbackPosition + elapsed < duration * 0.9) throw new UpstreamServiceError('Episode completion could not be confirmed. Select Next Episode manually.', 409);
      }
      const claimed = await tx.room.updateMany({ where: { id: room.id, hostId: userId, selectedMovieId: expected.movieId, playbackVersion: expected.version, status: { not: 'ENDED' } }, data: { selectedMovieId: source.movieId, catalogSelection: selectionFor(episode) as unknown as Prisma.InputJsonValue, currentMovieTitle: selectionFor(episode).title, playbackMode: 'DIRECT', screenSharingUserId: null, playbackPosition: 0, playbackIsPlaying: false, playbackUpdatedAt: new Date(), playbackVersion: { increment: 1 }, status: 'WAITING', isHostOnlyControl: true } });
      if (claimed.count !== 1) throw new UpstreamServiceError('Episode transition already processed.', 409);
      await tx.roomViewerState.deleteMany({ where: { roomId: room.id } });
    });
    return RoomService.getRoomByCode(code);
  }
}
