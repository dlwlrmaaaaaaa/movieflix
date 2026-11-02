import type { EmbedMediaRequest } from '../services/embedUrlBuilder';

export interface EmbedProvider {
  readonly id: string;
  readonly name: string;
  readonly enabled: boolean;
  /** Must only be true after content-distribution and embedding rights are verified. */
  readonly distributionPermissionVerified: boolean;
  readonly supportsWeb: boolean;
  readonly supportsMobile: boolean;
  readonly supportsPlaybackControl: boolean;
  readonly supportsSynchronization: boolean;
  readonly allowedEmbedHosts: readonly string[];
  isAvailable(request: EmbedMediaRequest): Promise<boolean>;
  getEmbedUrl(request: EmbedMediaRequest): string;
}
