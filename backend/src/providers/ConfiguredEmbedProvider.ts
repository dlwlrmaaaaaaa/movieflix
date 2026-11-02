import type { EmbedProviderConfig } from '../config/embedProviders';
import { buildMovieEmbedUrl, buildTvEpisodeEmbedUrl } from '../services/embedUrlBuilder';
import type { EmbedMediaRequest } from '../services/embedUrlBuilder';
import type { EmbedProvider } from './EmbedProvider';

export class ConfiguredEmbedProvider implements EmbedProvider {
  readonly id: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly distributionPermissionVerified: boolean;
  readonly supportsWeb: boolean;
  readonly supportsMobile: boolean;
  readonly supportsPlaybackControl: boolean;
  readonly supportsSynchronization: boolean;
  readonly allowedEmbedHosts: readonly string[];

  constructor(private readonly config: EmbedProviderConfig) {
    this.id = config.id;
    this.name = config.name;
    this.enabled = config.enabled;
    this.distributionPermissionVerified = config.distributionPermissionVerified;
    this.supportsWeb = config.supportsWeb;
    this.supportsMobile = config.supportsMobile;
    this.supportsPlaybackControl = config.supportsPlaybackControl;
    this.supportsSynchronization = config.supportsSynchronization;
    this.allowedEmbedHosts = config.allowedEmbedHosts;

    if (config.supportsPlaybackControl || config.supportsSynchronization) {
      throw new Error(`Embed provider ${config.id} uses the generic iframe adapter, which has no playback-control API. Keep playback control and synchronization disabled.`);
    }
  }

  async isAvailable(request: EmbedMediaRequest): Promise<boolean> {
    // A template provider is eligible for any validated ID. The remote player
    // remains responsible for its own unavailable-title UI unless it documents
    // a separate availability API that can be implemented here.
    return request.mediaType === 'movie' || Boolean(
      (request.tvUrlFormat ?? this.config.tvUrlFormat) === 'query' ? this.config.tvQueryPath : this.config.tvPath
    );
  }

  getEmbedUrl(request: EmbedMediaRequest): string {
    return request.mediaType === 'movie'
      ? buildMovieEmbedUrl(this.config, request.tmdbId)
      : buildTvEpisodeEmbedUrl(this.config, request.tmdbId, request.season, request.episode, request.tvUrlFormat);
  }
}
