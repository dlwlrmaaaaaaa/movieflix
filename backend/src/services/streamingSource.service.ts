import { AuthorizedPlaybackSource, TmdbMovieDetails } from '@togetherflix/shared';
import { InternetArchiveProvider } from '../providers/InternetArchiveProvider';
import { VideoProvider } from '../providers/VideoProvider';

const providers: VideoProvider[] = [new InternetArchiveProvider()];

export interface ProviderResolution {
  sources: AuthorizedPlaybackSource[];
  providerErrors: Array<{ provider: string; message: string }>;
  providerCount: number;
}

export class StreamingSourceService {
  static async resolve(movie: TmdbMovieDetails, configuredProviders: VideoProvider[] = providers): Promise<ProviderResolution> {
    const sources: AuthorizedPlaybackSource[] = [];
    const providerErrors: ProviderResolution['providerErrors'] = [];
    for (const provider of configuredProviders) {
      try {
        const candidates = await provider.search(movie);
        for (const candidate of candidates.slice(0, 3)) {
          const matches = await provider.getPlayableSources(candidate, movie);
          if (matches.length) {
            sources.push(...matches);
            break;
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Provider request failed.';
        providerErrors.push({ provider: provider.id, message });
        console.warn(`[Streaming provider ${provider.id}]`, message);
      }
    }
    return { sources, providerErrors, providerCount: configuredProviders.length };
  }

  static async find(movie: TmdbMovieDetails, configuredProviders: VideoProvider[] = providers): Promise<AuthorizedPlaybackSource[]> {
    return (await this.resolve(movie, configuredProviders)).sources;
  }
}
