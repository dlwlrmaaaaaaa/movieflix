import { AuthorizedPlaybackSource, TmdbMovieDetails } from '@togetherflix/shared';

export interface VideoProviderCandidate {
  id: string;
  title: string;
  releaseYear: number | null;
  licenseUrl: string | null;
}

export interface VideoProvider {
  readonly id: string;
  search(movie: TmdbMovieDetails): Promise<VideoProviderCandidate[]>;
  getDetails(id: string): Promise<unknown>;
  getPlayableSources(candidate: VideoProviderCandidate, movie: TmdbMovieDetails): Promise<AuthorizedPlaybackSource[]>;
  validateSource(source: AuthorizedPlaybackSource): Promise<boolean>;
}
