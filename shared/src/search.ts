export type ContentCategory = 'movie' | 'kdrama' | 'cdrama' | 'tv';
export type SearchCategory = 'all' | ContentCategory;
export interface ContentSearchFilters { category?: SearchCategory; year?: string; country?: string; genre?: string }
export interface ContentSearchResult {
  id: number;
  mediaType: 'movie' | 'tv';
  category: ContentCategory;
  title: string;
  originalTitle: string;
  posterUrl: string | null;
  releaseDate: string | null;
  originalLanguage: string;
  originCountries: string[];
  genreIds: number[];
  rating: number;
}
export interface ContentSearchPage {
  results: ContentSearchResult[];
  /** Upstream cursor, including pages scanned for country/language filters. */
  nextPage: number | null;
  page: number;
}
export function normalizeSearchQuery(query: string): string { return query.trim().replace(/\s+/g, ' '); }
export function contentIdentity(item: Pick<ContentSearchResult, 'mediaType' | 'id'>): string { return `${item.mediaType}:${item.id}`; }
export function classifyTvContent(language: string, countries: readonly string[]): ContentCategory {
  if (language === 'ko' && countries.includes('KR')) return 'kdrama';
  if (language === 'zh' && countries.includes('CN') && !countries.some((country) => country === 'TW' || country === 'HK')) return 'cdrama';
  return 'tv';
}
export function uniqueContentResults(items: readonly ContentSearchResult[]): ContentSearchResult[] {
  return Array.from(new Map(items.map((item) => [contentIdentity(item), item])).values());
}
export function contentDetailsPath(item: Pick<ContentSearchResult, 'mediaType' | 'id'>): string {
  return `/${item.mediaType === 'movie' ? 'movie' : 'drama'}/${item.id}`;
}
