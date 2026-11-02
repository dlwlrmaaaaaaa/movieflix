import { EmbeddedPlayerDescriptor } from '@togetherflix/shared';
import { EmbedProvider } from '../providers/EmbedProvider';
import { EMBED_PROVIDER_CONFIGS } from '../config/embedProviders';
import { ConfiguredEmbedProvider } from '../providers/ConfiguredEmbedProvider';
import {
  EmbedMediaRequest,
  validatedEmbedRequest,
  validatedEpisode,
  validatedSeason,
  validatedTmdbId,
  validatedTvUrlFormat,
} from './embedUrlBuilder';

export type EmbedPlatform = 'web' | 'mobile';

export { validatedEpisode, validatedSeason, validatedTmdbId, validatedTvUrlFormat } from './embedUrlBuilder';

export class EmbedProviderRegistry {
  constructor(private readonly providers: readonly EmbedProvider[] = []) {}

  async resolve(value: unknown, platform: EmbedPlatform): Promise<EmbeddedPlayerDescriptor | null> {
    return this.resolveRequest(validatedEmbedRequest(value), platform);
  }

  async resolveMovie(value: unknown, platform: EmbedPlatform): Promise<EmbeddedPlayerDescriptor | null> {
    return this.resolveRequest({ mediaType: 'movie', tmdbId: validatedTmdbId(value) }, platform);
  }

  async resolveTvEpisode(
    tmdbValue: unknown,
    seasonValue: unknown,
    episodeValue: unknown,
    platform: EmbedPlatform,
    requestedFormat?: unknown,
  ): Promise<EmbeddedPlayerDescriptor | null> {
    return this.resolveRequest({
      mediaType: 'tv',
      tmdbId: validatedTmdbId(tmdbValue),
      season: validatedSeason(seasonValue),
      episode: validatedEpisode(episodeValue),
      ...(requestedFormat === undefined ? {} : { tvUrlFormat: validatedTvUrlFormat(requestedFormat) }),
    }, platform);
  }

  private async resolveRequest(request: EmbedMediaRequest, platform: EmbedPlatform): Promise<EmbeddedPlayerDescriptor | null> {
    return (await this.resolveAll(request, platform))[0] ?? null;
  }

  async resolveAll(value: unknown, platform: EmbedPlatform): Promise<EmbeddedPlayerDescriptor[]> {
    const request = validatedEmbedRequest(value);
    const players: EmbeddedPlayerDescriptor[] = [];
    for (const provider of this.providers) {
      if (!provider.enabled || !provider.distributionPermissionVerified) continue;
      if (platform === 'web' ? !provider.supportsWeb : !provider.supportsMobile) continue;
      if (!await provider.isAvailable(request)) continue;
      const embedUrl = this.validateEmbedUrl(provider, provider.getEmbedUrl(request));
      players.push({
        providerId: provider.id,
        providerName: provider.name,
        mediaType: request.mediaType,
        tmdbId: request.tmdbId,
        ...(request.mediaType === 'tv' ? { season: request.season, episode: request.episode } : {}),
        embedUrl,
        supportsWeb: provider.supportsWeb,
        supportsMobile: provider.supportsMobile,
        supportsPlaybackControl: provider.supportsPlaybackControl,
        supportsSynchronization: provider.supportsPlaybackControl && provider.supportsSynchronization,
      });
    }
    return players;
  }

  private validateEmbedUrl(provider: EmbedProvider, rawUrl: string): string {
    let url: URL;
    try { url = new URL(rawUrl); } catch { throw new Error(`Embed provider ${provider.id} returned an invalid URL.`); }
    const allowedHosts = provider.allowedEmbedHosts.map((host) => host.toLowerCase());
    if (url.protocol !== 'https:' || url.username || url.password || !allowedHosts.includes(url.hostname.toLowerCase())) {
      throw new Error(`Embed provider ${provider.id} returned a URL outside its authorized HTTPS hosts.`);
    }
    return url.toString();
  }
}

// Each provider must pass its own enablement, permission, and host checks.
export const embedProviderRegistry = new EmbedProviderRegistry(
  EMBED_PROVIDER_CONFIGS.map((config) => new ConfiguredEmbedProvider(config)),
);
