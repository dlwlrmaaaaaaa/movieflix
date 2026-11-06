import { infiniteQueryOptions } from '@tanstack/react-query';
import { normalizeSearchQuery } from '@togetherflix/shared';
import type { ContentSearchFilters, ContentSearchPage } from '@togetherflix/shared';
import { request } from './api';

export function contentSearchOptions(input: string, filters: ContentSearchFilters) {
  const query = normalizeSearchQuery(input);
  return infiniteQueryOptions({
    queryKey: ['content-search', query, filters],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ query, page: String(pageParam), ...filters });
      return request<ContentSearchPage>(`/api/search?${params}`, { signal });
    },
    getNextPageParam: (last) => last.nextPage ?? undefined,
    enabled: (query.length >= 2 && query.length <= 100) || (!query && Boolean(filters.year || filters.country || filters.genre)),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    maxPages: 25,
  });
}
