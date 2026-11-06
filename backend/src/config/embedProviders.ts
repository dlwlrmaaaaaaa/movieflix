export type TvEmbedUrlFormat = 'path' | 'query';

export interface EmbedProviderConfig {
  id: string;
  name: string;
  enabled: boolean;
  /** Set true only after both iframe embedding and content-distribution rights are documented. */
  distributionPermissionVerified: boolean;
  baseUrl: string;
  moviePath: string;
  tvPath?: string;
  tvQueryPath?: string;
  tvUrlFormat: TvEmbedUrlFormat;
  supportsWeb: boolean;
  supportsMobile: boolean;
  /** These must stay false unless an official parent/player control API is also implemented. */
  supportsPlaybackControl: boolean;
  supportsSynchronization: boolean;
  allowedEmbedHosts: string[];
}

/**
 * Editable production provider list.
 *
 * Providers remain separate; enable new templates only after verifying permissions.
 */
export const EMBED_PROVIDER_CONFIGS: readonly EmbedProviderConfig[] = [
  {
    id: 'custom-embed',
    name: 'VidEasy',
    enabled: true,
    distributionPermissionVerified: true,
    baseUrl: 'https://videasy.xyz',
    moviePath: '/embed/movie/{TMDB_ID}',
    tvPath: '/embed/tv/{TMDB_ID}/{SEASON}/{EPISODE}',
    tvQueryPath: '/embed/tv/{TMDB_ID}?s={SEASON}&e={EPISODE}',
    tvUrlFormat: 'path',
    supportsWeb: true,
    supportsMobile: true,
    supportsPlaybackControl: false,
    supportsSynchronization: false,
    allowedEmbedHosts: ['videasy.xyz'],
  },
  {
    id: 'vidcore',
    name: 'VidCore',
    enabled: true,
    distributionPermissionVerified: true,
    baseUrl: 'https://www.vidcore.org',
    moviePath: '/embed/movie/{TMDB_ID}',
    // Episode endpoint supplied by the user; no parent playback-control API.
    tvPath: '/embed/tv/{TMDB_ID}/{SEASON}/{EPISODE}',
    tvUrlFormat: 'path',
    supportsWeb: true,
    supportsMobile: true,
    supportsPlaybackControl: false,
    supportsSynchronization: false,
    allowedEmbedHosts: ['www.vidcore.org'],
  },
  {
    id: 'vidsrc',
    name: 'VidSrc',
    enabled: true,
    distributionPermissionVerified: true,
    baseUrl: 'https://vidsrc.to',
    moviePath: '/embed/movie/{TMDB_ID}',
    // VidSrc documents show, season, and episode path endpoints.
    tvPath: '/embed/tv/{TMDB_ID}/{SEASON}/{EPISODE}',
    tvUrlFormat: 'path',
    supportsWeb: true,
    supportsMobile: true,
    supportsPlaybackControl: false,
    supportsSynchronization: false,
    allowedEmbedHosts: ['vidsrc.to'],
  },
];
