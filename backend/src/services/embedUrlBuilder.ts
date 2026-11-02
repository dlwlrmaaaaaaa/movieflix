import type { EmbedProviderConfig, TvEmbedUrlFormat } from '../config/embedProviders';

const MAX_TMDB_ID = 2_147_483_647;
const MAX_SEASON = 10_000;
const MAX_EPISODE = 100_000;

export type EmbedMediaRequest =
  | { mediaType: 'movie'; tmdbId: number }
  | { mediaType: 'tv'; tmdbId: number; season: number; episode: number; tvUrlFormat?: TvEmbedUrlFormat };

function validatedInteger(value: unknown, name: string, maximum: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > maximum) {
    throw new Error(`Invalid ${name}. Expected a positive integer.`);
  }
  return parsed;
}

export function validatedTmdbId(value: unknown): number {
  return validatedInteger(value, 'TMDB ID', MAX_TMDB_ID);
}

export function validatedSeason(value: unknown): number {
  return validatedInteger(value, 'season', MAX_SEASON);
}

export function validatedEpisode(value: unknown): number {
  return validatedInteger(value, 'episode', MAX_EPISODE);
}

export function validatedTvUrlFormat(value: unknown, fallback: TvEmbedUrlFormat = 'path'): TvEmbedUrlFormat {
  if (value === undefined || value === null || value === '') return fallback;
  if (value !== 'path' && value !== 'query') throw new Error('Invalid TV embed URL format. Expected "path" or "query".');
  return value;
}

export function validatedEmbedRequest(value: unknown): EmbedMediaRequest {
  if (!value || typeof value !== 'object') {
    return { mediaType: 'movie', tmdbId: validatedTmdbId(value) };
  }
  const request = value as Record<string, unknown>;
  if (request.mediaType === 'movie') {
    return { mediaType: 'movie', tmdbId: validatedTmdbId(request.tmdbId) };
  }
  if (request.mediaType === 'tv') {
    return {
      mediaType: 'tv',
      tmdbId: validatedTmdbId(request.tmdbId),
      season: validatedSeason(request.season),
      episode: validatedEpisode(request.episode),
      ...(request.tvUrlFormat === undefined ? {} : { tvUrlFormat: validatedTvUrlFormat(request.tvUrlFormat) }),
    };
  }
  throw new Error('Invalid embed media type. Expected "movie" or "tv".');
}

function providerBaseUrl(config: EmbedProviderConfig): URL {
  if (!config.baseUrl.trim()) throw new Error(`Embed provider ${config.id} has no baseUrl configured.`);
  let url: URL;
  try { url = new URL(config.baseUrl); } catch { throw new Error(`Embed provider ${config.id} has an invalid baseUrl.`); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error(`Embed provider ${config.id} baseUrl must be a credential-free HTTPS URL.`);
  }
  return url;
}

function renderPath(config: EmbedProviderConfig, template: string, values: Record<string, number>): string {
  if (!template.startsWith('/') || template.startsWith('//')) {
    throw new Error(`Embed provider ${config.id} paths must begin with one slash.`);
  }
  let rendered = template;
  for (const [placeholder, value] of Object.entries(values)) {
    if (!rendered.includes(`{${placeholder}}`)) {
      throw new Error(`Embed provider ${config.id} path is missing {${placeholder}}.`);
    }
    rendered = rendered.replaceAll(`{${placeholder}}`, encodeURIComponent(String(value)));
  }
  if (/\{[A-Z_]+\}/.test(rendered)) throw new Error(`Embed provider ${config.id} path contains an unsupported placeholder.`);
  return new URL(rendered, providerBaseUrl(config).origin).toString();
}

export function buildMovieEmbedUrl(config: EmbedProviderConfig, value: unknown): string {
  return renderPath(config, config.moviePath, { TMDB_ID: validatedTmdbId(value) });
}

export function buildTvEpisodeEmbedUrl(
  config: EmbedProviderConfig,
  tmdbValue: unknown,
  seasonValue: unknown,
  episodeValue: unknown,
  requestedFormat?: unknown,
): string {
  const format = validatedTvUrlFormat(requestedFormat, config.tvUrlFormat);
  const template = format === 'query' ? config.tvQueryPath : config.tvPath;
  if (!template) throw new Error(`Embed provider ${config.id} does not support the requested TV URL format.`);
  return renderPath(config, template, {
    TMDB_ID: validatedTmdbId(tmdbValue),
    SEASON: validatedSeason(seasonValue),
    EPISODE: validatedEpisode(episodeValue),
  });
}
