import React, { memo, useCallback, useMemo } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import type { DramaCategory, DramaSummary } from '@togetherflix/shared';
import { MovieImage } from './MovieImage';
import { useAuth } from '../../context/AuthContext';
import { dramas } from '../../services/dramas';

const Poster = memo(function Poster({ item }: { item: DramaSummary }) {
  const router = useRouter();
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={item.title} onPress={() => router.push(`/drama/${item.tmdbId}` as any)} style={styles.card}>
    <MovieImage uri={item.posterUrl} label={`${item.title} poster`} style={styles.poster} size="w342" />
    <Text numberOfLines={2} style={styles.title}>{item.title}</Text><Text style={styles.meta}>{item.year || 'Year unknown'} · ★ {item.rating.toFixed(1)}</Text>
    <Text numberOfLines={1} style={styles.meta}>{item.genres.join(', ') || (item.category === 'tv' ? 'TV Series' : 'Drama')}{item.numberOfSeasons ? ` · ${item.numberOfSeasons} seasons` : ''}</Text>
  </TouchableOpacity>;
});
function DramaRow({ title, category, trending = false }: { title: string; category: DramaCategory; trending?: boolean }) {
  const result = useInfiniteQuery({ queryKey: ['dramas', category, trending], initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => dramas.discover(category, pageParam, '', trending, signal),
    getNextPageParam: (last) => last.page < last.totalPages ? last.page + 1 : undefined, staleTime: 300000, maxPages: 25, retry: false });
  const items = result.data?.pages.flatMap((page) => page.results) || [];
  const unique = useMemo(() => Array.from(new Map(items.map((item) => [item.tmdbId, item])).values()), [result.data]);
  const render = useCallback(({ item }: { item: DramaSummary }) => <Poster item={item} />, []);
  return <View style={styles.section}><Text style={styles.heading}>{title}</Text>
    {result.isPending ? <View style={styles.skeletons}>{[1, 2, 3].map((key) => <View key={key} style={styles.poster} />)}</View> : null}
    {result.error ? <TouchableOpacity onPress={() => void result.refetch()}><Text style={styles.error}>{result.error.message} · Retry</Text></TouchableOpacity> : null}
    {!result.isPending && !result.error && !unique.length ? <Text style={styles.meta}>No matching series on this page.</Text> : null}
    <FlatList horizontal data={unique} keyExtractor={(item) => String(item.tmdbId)} renderItem={render} showsHorizontalScrollIndicator={false} initialNumToRender={5} maxToRenderPerBatch={5} windowSize={3}
      ListFooterComponent={result.hasNextPage ? <TouchableOpacity style={styles.more} disabled={result.isFetchingNextPage} onPress={() => void result.fetchNextPage()}>{result.isFetchingNextPage ? <ActivityIndicator color="#e50914" /> : <Text style={styles.title}>Load more</Text>}</TouchableOpacity> : null} />
  </View>;
}
export function DramaDiscovery({ category }: { category?: DramaCategory }) {
  const router = useRouter(); const { user } = useAuth();
  const progress = useQuery({ queryKey: ['episode-continue', user?.id], queryFn: dramas.continue, staleTime: 15000, enabled: !!user });
  const recent = useQuery({ queryKey: ['episode-recent'], queryFn: dramas.recent, staleTime: 60000 });
  return <View style={{ gap: 22, paddingVertical: 20 }}>
    {progress.data?.items.length ? <View style={styles.section}><Text style={styles.heading}>Continue Watching · Episodes</Text><FlatList horizontal data={progress.data.items.filter((item) => !item.completed)} keyExtractor={(item) => item.episode.id} renderItem={({ item }) => <TouchableOpacity style={styles.card} onPress={() => router.push(`/drama/${item.drama.tmdbId}` as any)}><MovieImage uri={item.drama.posterUrl} label={`${item.drama.title} poster`} style={styles.poster} size="w342" /><Text style={styles.title}>{item.drama.title}</Text><Text style={styles.meta}>{item.completed ? 'Watched' : 'Continue Watching'} S{item.episode.seasonNumber}:E{item.episode.episodeNumber}</Text></TouchableOpacity>} /></View> : null}
    {category ? <DramaRow title={category === 'k-drama' ? 'Popular K-Dramas' : category === 'c-drama' ? 'Popular C-Dramas' : 'TV Shows'} category={category} /> : <>
      <DramaRow title="Popular K-Dramas" category="k-drama" /><DramaRow title="Popular C-Dramas" category="c-drama" />
      <DramaRow title="Trending K-Dramas" category="k-drama" trending /><DramaRow title="Trending C-Dramas" category="c-drama" trending />
    </>}
    {recent.data?.items.length ? <View style={styles.section}><Text style={styles.heading}>Recently Added Episodes</Text><FlatList horizontal data={Array.from(new Map(recent.data.items.map((item) => [item.episode.id, item])).values())} keyExtractor={(item) => item.episode.id} renderItem={({ item }) => <TouchableOpacity style={styles.card} onPress={() => router.push(`/drama/${item.drama.tmdbId}` as any)}><Text style={styles.title}>{item.drama.title}</Text><Text style={styles.meta}>S{item.episode.seasonNumber}:E{item.episode.episodeNumber} · {item.episode.title}</Text></TouchableOpacity>} /></View> : null}
  </View>;
}
const styles = StyleSheet.create({ section: { paddingHorizontal: 22, gap: 12 }, heading: { color: '#fff', fontSize: 20, fontWeight: '700' }, card: { width: 145, gap: 5, marginRight: 13 }, poster: { width: 145, height: 215, borderRadius: 9, backgroundColor: '#202026' }, title: { color: '#fff', fontSize: 13, fontWeight: '600' }, meta: { color: '#999', fontSize: 11 }, skeletons: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, error: { color: '#ff8b8b' }, input: { padding: 12, color: '#fff', backgroundColor: '#202026', borderRadius: 8, minWidth: 100 }, more: { padding: 16, justifyContent: 'center' } });
