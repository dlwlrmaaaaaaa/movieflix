import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import type { DramaCategory, DramaSummary } from '@togetherflix/shared';
import { dramas } from '../../services/dramas';

function Poster({ item }: { item: DramaSummary }) {
  const router = useRouter();
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={item.title} onPress={() => router.push(`/drama/${item.tmdbId}` as any)} style={styles.card}>
    {item.posterUrl ? <Image source={{ uri: item.posterUrl }} resizeMode="cover" style={styles.poster} /> : <View style={styles.poster} />}
    <Text numberOfLines={2} style={styles.title}>{item.title}</Text><Text style={styles.meta}>{item.year || 'Year unknown'} · ★ {item.rating.toFixed(1)}</Text>
    <Text numberOfLines={1} style={styles.meta}>{item.genres.join(', ') || (item.category === 'tv' ? 'TV Series' : 'Drama')}{item.numberOfSeasons ? ` · ${item.numberOfSeasons} seasons` : ''}</Text>
  </TouchableOpacity>;
}
function DramaRow({ title, category, trending = false, query = '', filters = {} }: { title: string; category: DramaCategory; trending?: boolean; query?: string; filters?: { year?: string; country?: string; genre?: string } }) {
  const result = useInfiniteQuery({ queryKey: ['dramas', category, trending, query, filters], initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => dramas.discover(category, pageParam, query, trending, signal, filters),
    getNextPageParam: (last) => last.page < last.totalPages ? last.page + 1 : undefined, staleTime: 300000, retry: false });
  const items = result.data?.pages.flatMap((page) => page.results) || [];
  const unique = Array.from(new Map(items.map((item) => [item.tmdbId, item])).values());
  return <View style={styles.section}><Text style={styles.heading}>{title}</Text>
    {result.isPending ? <View style={styles.skeletons}>{[1, 2, 3].map((key) => <View key={key} style={styles.poster} />)}</View> : null}
    {result.error ? <TouchableOpacity onPress={() => void result.refetch()}><Text style={styles.error}>{result.error.message} · Retry</Text></TouchableOpacity> : null}
    {!result.isPending && !result.error && !unique.length ? <Text style={styles.meta}>No matching series on this page.</Text> : null}
    <FlatList horizontal data={unique} keyExtractor={(item) => String(item.tmdbId)} renderItem={({ item }) => <Poster item={item} />} showsHorizontalScrollIndicator={false} initialNumToRender={5} maxToRenderPerBatch={5} windowSize={3}
      ListFooterComponent={result.hasNextPage ? <TouchableOpacity style={styles.more} disabled={result.isFetchingNextPage} onPress={() => void result.fetchNextPage()}>{result.isFetchingNextPage ? <ActivityIndicator color="#e50914" /> : <Text style={styles.title}>Load more</Text>}</TouchableOpacity> : null} />
  </View>;
}
export function DramaDiscovery({ category, search = false }: { category?: DramaCategory; search?: boolean }) {
  const router = useRouter(); const [input, setInput] = useState(''); const [query, setQuery] = useState('');
  const [year, setYear] = useState(''); const [country, setCountry] = useState(''); const [genre, setGenre] = useState('');
  useEffect(() => { const timer = setTimeout(() => setQuery(input.trim()), 350); return () => clearTimeout(timer); }, [input]);
  const progress = useQuery({ queryKey: ['episode-continue'], queryFn: dramas.continue, staleTime: 15000 });
  const recent = useQuery({ queryKey: ['episode-recent'], queryFn: dramas.recent, staleTime: 60000 });
  const filters = { ...(year.length === 4 ? { year } : {}), ...(country.length === 2 ? { country } : {}), ...(genre ? { genre } : {}) };
  return <View style={{ gap: 22, paddingVertical: 20 }}>
    {search ? <View style={styles.section}><Text style={styles.heading}>Search dramas and TV</Text><TextInput accessibilityLabel="Search drama titles" value={input} onChangeText={setInput} placeholder="Title, original title, or English title" placeholderTextColor="#888" style={styles.input} /><View style={styles.skeletons}><TextInput value={year} onChangeText={setYear} placeholder="Year" placeholderTextColor="#888" keyboardType="numeric" maxLength={4} style={styles.input} /><TextInput value={country} onChangeText={(value) => setCountry(value.toUpperCase())} placeholder="Country: KR / CN" placeholderTextColor="#888" maxLength={2} style={styles.input} /></View><View style={styles.skeletons}>{[['', 'All genres'], ['18', 'Drama'], ['35', 'Comedy'], ['9648', 'Mystery'], ['10765', 'Sci-Fi & Fantasy']].map(([id, name]) => <TouchableOpacity key={id} onPress={() => setGenre(id)} style={styles.more}><Text style={[styles.meta, id === genre && { color: '#fff' }]}>{name}</Text></TouchableOpacity>)}</View></View> : null}
    {!search && progress.data?.items.length ? <View style={styles.section}><Text style={styles.heading}>Continue Watching · Episodes</Text><FlatList horizontal data={progress.data.items.filter((item) => !item.completed)} keyExtractor={(item) => item.episode.id} renderItem={({ item }) => <TouchableOpacity style={styles.card} onPress={() => router.push(`/drama/${item.drama.tmdbId}` as any)}>{item.drama.posterUrl ? <Image source={{ uri: item.drama.posterUrl }} style={styles.poster} /> : null}<Text style={styles.title}>{item.drama.title}</Text><Text style={styles.meta}>{item.completed ? 'Watched' : 'Continue Watching'} S{item.episode.seasonNumber}:E{item.episode.episodeNumber}</Text></TouchableOpacity>} /></View> : null}
    {(!search || query.length >= 2 || year.length === 4 || country.length === 2 || genre) ? category ? <DramaRow title={search ? 'Search results' : category === 'k-drama' ? 'Korean Dramas' : category === 'c-drama' ? 'Chinese Dramas' : 'TV Series'} category={category} query={query} filters={filters} /> : <>
      <DramaRow title="Korean Dramas" category="k-drama" query={query} filters={filters} /><DramaRow title="Chinese Dramas" category="c-drama" query={query} filters={filters} />
      {!search ? <><DramaRow title="Trending K-Dramas" category="k-drama" trending /><DramaRow title="Trending C-Dramas" category="c-drama" trending /></> : <DramaRow title="TV Series" category="tv" query={query} filters={filters} />}
    </> : null}
    {!search && recent.data?.items.length ? <View style={styles.section}><Text style={styles.heading}>Recently Added Episodes</Text><FlatList horizontal data={Array.from(new Map(recent.data.items.map((item) => [item.episode.id, item])).values())} keyExtractor={(item) => item.episode.id} renderItem={({ item }) => <TouchableOpacity style={styles.card} onPress={() => router.push(`/drama/${item.drama.tmdbId}` as any)}><Text style={styles.title}>{item.drama.title}</Text><Text style={styles.meta}>S{item.episode.seasonNumber}:E{item.episode.episodeNumber} · {item.episode.title}</Text></TouchableOpacity>} /></View> : null}
  </View>;
}
const styles = StyleSheet.create({ section: { paddingHorizontal: 22, gap: 12 }, heading: { color: '#fff', fontSize: 20, fontWeight: '700' }, card: { width: 145, gap: 5, marginRight: 13 }, poster: { width: 145, height: 215, borderRadius: 9, backgroundColor: '#202026' }, title: { color: '#fff', fontSize: 13, fontWeight: '600' }, meta: { color: '#999', fontSize: 11 }, skeletons: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, error: { color: '#ff8b8b' }, input: { padding: 12, color: '#fff', backgroundColor: '#202026', borderRadius: 8, minWidth: 100 }, more: { padding: 16, justifyContent: 'center' } });
