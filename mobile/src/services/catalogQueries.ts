import { queryOptions } from '@tanstack/react-query';
import { api } from './api';

export type CatalogCategory = 'trending' | 'popular' | 'topRated' | 'nowPlaying' | 'upcoming';
export const catalogQuery = (category: CatalogCategory) => queryOptions({
  queryKey: ['catalog', category],
  queryFn: ({ signal }) => api.movies[category](1, signal),
  staleTime: category === 'trending' || category === 'nowPlaying' ? 2 * 60_000 : 10 * 60_000,
});
export const movieQuery = (id: number) => queryOptions({
  queryKey: ['movie', id], queryFn: ({ signal }) => api.movies.details(id, signal),
  staleTime: 30 * 60_000, enabled: Number.isInteger(id) && id > 0,
});
export const searchQuery = (query: string) => queryOptions({
  queryKey: ['catalog', 'search', query.trim().replace(/\s+/g, ' ')],
  queryFn: ({ signal }) => api.movies.searchCatalog(query.trim().replace(/\s+/g, ' '), 1, signal),
  staleTime: 60_000, gcTime: 5 * 60_000, enabled: query.trim().length >= 2,
});
