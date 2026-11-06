export type DramaCategory = 'k-drama' | 'c-drama' | 'tv';
export interface DramaSummary {
  tmdbId: number; title: string; originalTitle: string; category: DramaCategory;
  originalLanguage: string; originCountry: string[]; posterUrl: string | null;
  backdropUrl: string | null; description: string; year: number | null; rating: number;
  genres: string[]; numberOfSeasons?: number;
}
export interface DramaDetails extends DramaSummary {
  cast: string[]; seasons: Array<{ seasonNumber: number; title: string; episodeCount: number }>;
}
export interface DramaPage { page: number; totalPages: number; totalResults: number; results: DramaSummary[] }
export interface EpisodeSummary {
  id: string; dramaId: string; seasonId: string; seasonNumber: number; episodeNumber: number;
  title: string; description: string; thumbnailUrl: string | null; runtime: number | null;
  airDate: string | null; available: boolean; watched: boolean;
}
export interface SubtitleCue { start: number; end: number; text: string }
export interface EpisodeSubtitle { id: string; language: string; label: string; cues: SubtitleCue[] }
export interface EpisodePlayback {
  episode: EpisodeSummary; drama: DramaSummary; movieId: string; playbackUrl: string;
  expiresInSeconds: number | null; positionSeconds: number; subtitles: EpisodeSubtitle[];
}
export interface EpisodeContinue { episode: EpisodeSummary; drama: DramaSummary; positionSeconds: number; durationSeconds: number; completed: boolean }
