import { ContinueWatchingItem, WatchlistItem } from '@togetherflix/shared';
import { prisma } from '../prisma';
import { TmdbService } from './tmdb.service';

export function sanitizeProgress(position: unknown, duration: unknown) {
  const parsedDuration = Number(duration);
  const parsedPosition = Number(position);
  if (!Number.isFinite(parsedDuration) || parsedDuration <= 0 || parsedDuration > 24 * 60 * 60) throw new Error('A valid movie duration is required.');
  if (!Number.isFinite(parsedPosition) || parsedPosition < 0) throw new Error('A valid playback position is required.');
  const positionSeconds = Math.min(parsedPosition, parsedDuration);
  return {
    positionSeconds,
    durationSeconds: parsedDuration,
    completionPercent: Math.min(100, Math.max(0, positionSeconds / parsedDuration * 100)),
  };
}

export class UserLibraryService {
  static async watchlist(userId: string): Promise<WatchlistItem[]> {
    return (await prisma.userWatchlist.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } })).map((item) => ({
      ...item, createdAt: item.createdAt.toISOString(), overview: item.overview || null, posterUrl: item.posterUrl || null, backdropUrl: item.backdropUrl || null,
    }));
  }

  static async addToWatchlist(userId: string, tmdbId: unknown): Promise<WatchlistItem> {
    const movie = await TmdbService.details(tmdbId);
    const item = await prisma.userWatchlist.upsert({
      where: { userId_tmdbId: { userId, tmdbId: movie.id } },
      create: { userId, tmdbId: movie.id, title: movie.title, posterUrl: movie.posterUrl, backdropUrl: movie.backdropUrl, overview: movie.overview || null, releaseYear: movie.releaseYear, rating: movie.rating },
      update: { title: movie.title, posterUrl: movie.posterUrl, backdropUrl: movie.backdropUrl, overview: movie.overview || null, releaseYear: movie.releaseYear, rating: movie.rating },
    });
    return { ...item, createdAt: item.createdAt.toISOString(), overview: item.overview || null, posterUrl: item.posterUrl || null, backdropUrl: item.backdropUrl || null };
  }

  static async removeFromWatchlist(userId: string, tmdbId: unknown): Promise<void> {
    const id = Number(tmdbId);
    if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid TMDB movie ID.');
    await prisma.userWatchlist.deleteMany({ where: { userId, tmdbId: id } });
  }

  static async continueWatching(userId: string): Promise<ContinueWatchingItem[]> {
    return (await prisma.watchProgress.findMany({
      where: { userId, positionSeconds: { gt: 10 }, completionPercent: { lt: 95 } }, orderBy: { lastWatchedAt: 'desc' }, take: 30,
    })).map((item) => ({ ...item, posterUrl: item.posterUrl || null, backdropUrl: item.backdropUrl || null, lastWatchedAt: item.lastWatchedAt.toISOString() }));
  }

  static async saveProgress(userId: string, tmdbId: unknown, position: unknown, duration: unknown): Promise<ContinueWatchingItem> {
    const movie = await TmdbService.details(tmdbId);
    const progress = sanitizeProgress(position, duration);
    const item = await prisma.watchProgress.upsert({
      where: { userId_tmdbId: { userId, tmdbId: movie.id } },
      create: { userId, tmdbId: movie.id, title: movie.title, posterUrl: movie.posterUrl, backdropUrl: movie.backdropUrl, ...progress },
      update: { title: movie.title, posterUrl: movie.posterUrl, backdropUrl: movie.backdropUrl, ...progress },
    });
    return { ...item, posterUrl: item.posterUrl || null, backdropUrl: item.backdropUrl || null, lastWatchedAt: item.lastWatchedAt.toISOString() };
  }
}
