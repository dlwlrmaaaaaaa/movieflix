import { MovieCatalogPage, TmdbMovieDetails, TmdbMovieSummary, TmdbTrailer } from '@togetherflix/shared';
import { ENV } from '../config/env';
import { RequestLimiter } from './requestLimiter';
import { MemoryCache } from './memoryCache';
import { validatedEpisode, validatedSeason, validatedTmdbId } from './embedUrlBuilder';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';
const cache = new MemoryCache();
const requests = new RequestLimiter(4);
let rateLimitedUntil = 0;

export class UpstreamServiceError extends Error {
  constructor(message: string, public readonly statusCode = 502, public readonly retryAfterSeconds?: number) {
    super(message);
  }
}

function pageNumber(value: unknown): number {
  const parsed = Number(value || 1);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 500 ? parsed : 1;
}

function imageUrl(path: unknown, size: 'w500' | 'w780' | 'w1280' | 'original'): string | null {
  return typeof path === 'string' && /^\/[a-zA-Z0-9._-]+$/.test(path)
    ? `${IMAGE_BASE_URL}/${size}${path}`
    : null;
}

function summary(movie: any): TmdbMovieSummary {
  const releaseDate = typeof movie.release_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(movie.release_date)
    ? movie.release_date
    : null;
  return {
    id: Number(movie.id),
    title: String(movie.title || movie.original_title || 'Untitled'),
    originalTitle: String(movie.original_title || movie.title || 'Untitled'),
    overview: String(movie.overview || ''),
    releaseDate,
    releaseYear: releaseDate ? Number(releaseDate.slice(0, 4)) : null,
    posterUrl: imageUrl(movie.poster_path, 'w500'),
    backdropUrl: imageUrl(movie.backdrop_path, 'w780'),
    rating: Number.isFinite(Number(movie.vote_average)) ? Number(movie.vote_average) : 0,
    voteCount: Number.isInteger(Number(movie.vote_count)) ? Number(movie.vote_count) : 0,
    genreIds: Array.isArray(movie.genre_ids) ? movie.genre_ids.filter(Number.isInteger) : [],
  };
}

function catalogPage(data: any): MovieCatalogPage {
  return {
    page: Number(data.page) || 1,
    totalPages: Math.min(Number(data.total_pages) || 1, 500),
    totalResults: Number(data.total_results) || 0,
    results: Array.isArray(data.results) ? data.results.map(summary).filter((movie: TmdbMovieSummary) => Number.isInteger(movie.id)) : [],
  };
}

export class TmdbService {
  private static async request<T>(path: string, params: Record<string, string | number | boolean | undefined> = {}): Promise<T> {
    if (!ENV.TMDB_ACCESS_TOKEN && !ENV.TMDB_API_KEY) {
      throw new UpstreamServiceError('Movie discovery is not configured. Add TMDB_ACCESS_TOKEN or TMDB_API_KEY.', 503);
    }
    const url = new URL(`${TMDB_BASE_URL}${path}`);
    Object.entries({ language: 'en-US', ...params }).forEach(([key, value]) => {
      if (value !== undefined) url.searchParams.set(key, String(value));
    });
    const cacheKey = url.toString();
    const metadata = /^\/movie\/\d+$/.test(path) || path.startsWith('/tv/');
    const ttl = metadata ? ENV.TMDB_CACHE_TTL_SECONDS * 4 : path.startsWith('/search') ? Math.min(ENV.TMDB_CACHE_TTL_SECONDS, 120) : Math.min(ENV.TMDB_CACHE_TTL_SECONDS, 300);
    return cache.getOrLoad<T>(cacheKey, ttl, () => requests.run(async () => {
      if (Date.now() < rateLimitedUntil) throw new UpstreamServiceError('TMDB is temporarily rate limited. Please try again shortly.', 429, Math.ceil((rateLimitedUntil - Date.now()) / 1000));
      if (!ENV.TMDB_ACCESS_TOKEN) url.searchParams.set('api_key', ENV.TMDB_API_KEY);
      for (let attempt = 0; attempt < 2; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        try {
          const response = await fetch(url, {
            headers: { Accept: 'application/json', ...(ENV.TMDB_ACCESS_TOKEN ? { Authorization: `Bearer ${ENV.TMDB_ACCESS_TOKEN}` } : {}) },
            signal: controller.signal,
          });
          if (response.status === 429) {
            const raw = response.headers.get('retry-after');
            const seconds = raw && Number.isFinite(Number(raw)) ? Number(raw) : raw ? Math.ceil((Date.parse(raw) - Date.now()) / 1000) : 30;
            const retryAfter = Math.max(1, Math.min(Number.isFinite(seconds) ? seconds : 30, 3600));
            rateLimitedUntil = Date.now() + retryAfter * 1000;
            throw new UpstreamServiceError('TMDB is temporarily rate limited. Please try again shortly.', 429, retryAfter);
          }
          if (response.status >= 500 && attempt === 0) { await new Promise((resolve) => setTimeout(resolve, 300)); continue; }
          if (!response.ok) throw new UpstreamServiceError(response.status === 404 ? 'Movie not found.' : 'TMDB is temporarily unavailable.', response.status === 404 ? 404 : 502);
          return await response.json() as T;
        } catch (error) {
          if (error instanceof UpstreamServiceError) throw error;
          if (attempt === 0 && !(error instanceof Error && error.name === 'AbortError')) { await new Promise((resolve) => setTimeout(resolve, 300)); continue; }
          throw new UpstreamServiceError(error instanceof Error && error.name === 'AbortError' ? 'TMDB did not respond in time.' : 'TMDB is temporarily unavailable.');
        } finally { clearTimeout(timer); }
      }
      throw new UpstreamServiceError('TMDB is temporarily unavailable.');
    }));
  }

  static async trending(page: unknown): Promise<MovieCatalogPage> {
    return catalogPage(await this.request('/trending/movie/week', { page: pageNumber(page) }));
  }

  static async popular(page: unknown): Promise<MovieCatalogPage> {
    return catalogPage(await this.request('/movie/popular', { page: pageNumber(page) }));
  }

  static async topRated(page: unknown): Promise<MovieCatalogPage> {
    return catalogPage(await this.request('/movie/top_rated', { page: pageNumber(page) }));
  }

  static async nowPlaying(page: unknown): Promise<MovieCatalogPage> {
    return catalogPage(await this.request('/movie/now_playing', { page: pageNumber(page) }));
  }

  static async upcoming(page: unknown): Promise<MovieCatalogPage> {
    return catalogPage(await this.request('/movie/upcoming', { page: pageNumber(page) }));
  }

  static async search(query: unknown, page: unknown): Promise<MovieCatalogPage> {
    const normalized = typeof query === 'string' ? query.trim().replace(/\s+/g, ' ') : '';
    if (normalized.length < 2 || normalized.length > 100) {
      throw new UpstreamServiceError('Search must contain between 2 and 100 characters.', 400);
    }
    return catalogPage(await this.request('/search/movie', { query: normalized, page: pageNumber(page), include_adult: false }));
  }

  static async details(id: unknown): Promise<TmdbMovieDetails> {
    const movieId = Number(id);
    if (!Number.isInteger(movieId) || movieId <= 0) throw new UpstreamServiceError('Invalid TMDB movie ID.', 400);
    const data: any = await this.request(`/movie/${movieId}`, { append_to_response: 'videos' });
    const base = summary({ ...data, genre_ids: Array.isArray(data.genres) ? data.genres.map((genre: any) => genre.id) : [] });
    const video = Array.isArray(data.videos?.results)
      ? data.videos.results.find((item: any) => item.site === 'YouTube' && item.type === 'Trailer' && item.official)
        || data.videos.results.find((item: any) => item.site === 'YouTube' && item.type === 'Trailer')
      : null;
    const trailer: TmdbTrailer | null = video && /^[a-zA-Z0-9_-]{6,20}$/.test(video.key)
      ? { key: video.key, name: String(video.name || 'Trailer'), site: 'YouTube', url: `https://www.youtube.com/watch?v=${video.key}` }
      : null;
    return {
      ...base,
      backdropUrl: imageUrl(data.backdrop_path, 'w1280'),
      runtimeMinutes: Number.isFinite(Number(data.runtime)) && Number(data.runtime) > 0 ? Number(data.runtime) : null,
      genres: Array.isArray(data.genres)
        ? data.genres.filter((genre: any) => Number.isInteger(genre.id) && typeof genre.name === 'string').map((genre: any) => ({ id: genre.id, name: genre.name }))
        : [],
      trailer,
    };
  }

  static async tvEpisode(id: unknown, seasonValue: unknown, episodeValue: unknown): Promise<{ tmdbId: number; season: number; episode: number }> {
    let tmdbId: number;
    let season: number;
    let episode: number;
    try {
      tmdbId = validatedTmdbId(id);
      season = validatedSeason(seasonValue);
      episode = validatedEpisode(episodeValue);
    } catch (error) {
      throw new UpstreamServiceError(error instanceof Error ? error.message : 'Invalid TV episode.', 400);
    }
    await this.request(`/tv/${tmdbId}/season/${season}/episode/${episode}`);
    return { tmdbId, season, episode };
  }
}
