import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, FlatList, Keyboard, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react-native';
import { contentDetailsPath, contentIdentity, normalizeSearchQuery, uniqueContentResults } from '@togetherflix/shared';
import type { ContentSearchResult, SearchCategory } from '@togetherflix/shared';
import { contentSearchOptions } from '../../services/contentSearch';
import { MovieImage } from './MovieImage';

const categories: Array<{ id: SearchCategory; label: string }> = [{ id: 'all', label: 'All' }, { id: 'movie', label: 'Movies' }, { id: 'kdrama', label: 'K-Drama' }, { id: 'cdrama', label: 'C-Drama' }, { id: 'tv', label: 'TV Shows' }];
const SearchCard = memo(function SearchCard({ item }: { item: ContentSearchResult }) {
  const router = useRouter();
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Open ${item.title}`} onPress={() => { Keyboard.dismiss(); router.push(contentDetailsPath(item) as any); }} style={styles.card}>
    <MovieImage uri={item.posterUrl} label={`${item.title} poster`} size="w342" style={styles.poster} />
    <View style={styles.cardInfo}><Text style={styles.title}>{item.title}</Text><Text style={styles.meta}>{item.releaseDate?.slice(0, 4) || 'Year unavailable'} · {categories.find((category) => category.id === item.category)?.label} · ★ {item.rating.toFixed(1)}</Text>{item.originalTitle && item.originalTitle !== item.title ? <Text style={styles.meta}>{item.originalTitle}</Text> : null}</View>
  </TouchableOpacity>;
});
export function UnifiedSearch({ category, onCategoryChange, focusRequested = false, children }: { category: SearchCategory; onCategoryChange: (category: SearchCategory) => void; focusRequested?: boolean; children: React.ReactNode }) {
  const inputRef = useRef<TextInput>(null);
  const [input, setInput] = useState(''); const [debounced, setDebounced] = useState('');
  const [advanced, setAdvanced] = useState(false); const [year, setYear] = useState(''); const [country, setCountry] = useState(''); const [genre, setGenre] = useState('');
  const normalized = normalizeSearchQuery(input);
  useEffect(() => { const timer = setTimeout(() => setDebounced(normalized), 350); return () => clearTimeout(timer); }, [normalized]);
  useEffect(() => { if (focusRequested) inputRef.current?.focus(); }, [focusRequested]);
  useEffect(() => {
    if (!input || Platform.OS !== 'android') return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { setInput(''); setDebounced(''); Keyboard.dismiss(); return true; });
    return () => listener.remove();
  }, [input]);
  const filterError = year && !/^\d{4}$/.test(year) ? 'Enter a four-digit year.' : country && !/^[A-Z]{2}$/.test(country) ? 'Enter a two-letter country code.' : '';
  const filters = useMemo(() => ({ category, ...(year.length === 4 ? { year } : {}), ...(country.length === 2 ? { country } : {}), ...(genre ? { genre } : {}) }), [category, year, country, genre]);
  const current = normalized === debounced;
  const browsing = !normalized && Boolean(filters.year || filters.country || filters.genre);
  const search = useInfiniteQuery({ ...contentSearchOptions(debounced, filters), enabled: !filterError && current && ((normalized.length >= 2 && normalized.length <= 100) || browsing) });
  const results = useMemo(() => uniqueContentResults(search.data?.pages.flatMap((page) => page.results) || []), [search.data]);
  const active = normalized.length > 0 || Boolean(year || country || genre);
  const waiting = !current || (search.isPending && search.fetchStatus !== 'idle');
  const error = normalized.length > 100 ? 'Search must contain at most 100 characters.' : filterError || search.error?.message;
  return <View style={styles.container}>
    <View style={styles.header}><View style={styles.searchBox}><Search color="#aaa" size={19} /><TextInput ref={inputRef} accessibilityLabel="Search movies, K-Dramas, C-Dramas, TV Shows" placeholder="Search movies, K-Dramas, C-Dramas, TV Shows..." placeholderTextColor="#888" value={input} onChangeText={setInput} onSubmitEditing={() => { setDebounced(normalized); Keyboard.dismiss(); }} autoCorrect={false} returnKeyType="search" style={styles.input} />{input ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => { setInput(''); setDebounced(''); }}><X color="#ccc" size={20} /></TouchableOpacity> : null}</View>
      <View style={styles.filterRow}><ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.categories}>{categories.map((item) => <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: category === item.id }} key={item.id} onPress={() => onCategoryChange(item.id)} style={[styles.chip, category === item.id && styles.active]}><Text style={styles.text}>{item.label}</Text></TouchableOpacity>)}</ScrollView><TouchableOpacity accessibilityRole="button" accessibilityLabel="Search filters" onPress={() => setAdvanced(!advanced)} style={styles.chip}><Text style={styles.text}>Filters</Text></TouchableOpacity></View>
      {advanced ? <View style={{ gap: 9 }}><View style={styles.filterRow}><TextInput accessibilityLabel="Release year" value={year} onChangeText={setYear} placeholder="Year" placeholderTextColor="#888" keyboardType="numeric" maxLength={4} style={styles.filterInput} /><TextInput accessibilityLabel="Country code" value={country} onChangeText={(value) => setCountry(value.trim().toUpperCase())} placeholder="Country KR / CN" placeholderTextColor="#888" maxLength={2} style={styles.filterInput} /></View><ScrollView horizontal keyboardShouldPersistTaps="handled" contentContainerStyle={styles.categories}>{[['', 'All genres'], ['28', 'Action'], ['35', 'Comedy'], ['18', 'Drama'], ['27', 'Horror'], ['10749', 'Romance'], ['878', 'Sci-Fi'], ['16', 'Animation'], ['9648', 'Mystery'], ['10765', 'Sci-Fi & Fantasy']].map(([id, label]) => <TouchableOpacity key={id} onPress={() => setGenre(id)} style={[styles.chip, genre === id && styles.active]}><Text style={styles.text}>{label}</Text></TouchableOpacity>)}</ScrollView><Text style={styles.meta}>TV Shows includes all television series. Country uses known production origins.</Text></View> : null}
    </View>
    {!active ? children : <FlatList data={current && !filterError ? results : []} keyExtractor={contentIdentity} renderItem={({ item }) => <SearchCard item={item} />} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" initialNumToRender={8} maxToRenderPerBatch={6} windowSize={5} contentContainerStyle={styles.results}
      ListHeaderComponent={error ? <View style={{ gap: 10 }}><Text accessibilityRole="alert" style={styles.error}>{error}</Text>{search.error ? <TouchableOpacity onPress={() => void search.refetch()}><Text style={styles.text}>Retry search</Text></TouchableOpacity> : null}</View> : null}
      ListEmptyComponent={!browsing && normalized.length < 2 && !error ? <Text style={styles.meta}>Enter at least two characters to search.</Text> : waiting && !error ? <View style={{ gap: 12 }}>{[1, 2, 3].map((id) => <View key={id} style={styles.skeleton} />)}</View> : !error ? <Text style={styles.meta}>{search.hasNextPage ? 'No matches on these pages. Load more to continue searching.' : 'No titles found. Try another title or change the filters.'}</Text> : null}
      ListFooterComponent={current && !error && search.hasNextPage ? <TouchableOpacity disabled={search.isFetchingNextPage} style={styles.more} onPress={() => void search.fetchNextPage()}>{search.isFetchingNextPage ? <ActivityIndicator color="#e50914" /> : <Text style={styles.text}>Load more</Text>}</TouchableOpacity> : null}
      onEndReachedThreshold={0.4} onEndReached={() => { if (current && !error && results.length > 0 && search.hasNextPage && !search.isFetching) void search.fetchNextPage(); }} />}
  </View>;
}
const styles = StyleSheet.create({ container: { flex: 1 }, header: { paddingHorizontal: 18, paddingBottom: 12, gap: 12, backgroundColor: '#080808' }, searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#202026', borderRadius: 10, paddingHorizontal: 12, minHeight: 46 }, input: { flex: 1, paddingVertical: 12, color: '#fff', fontSize: 14 }, filterRow: { flexDirection: 'row', gap: 10 }, categories: { gap: 8 }, chip: { padding: 10, borderRadius: 8, backgroundColor: '#232329' }, active: { backgroundColor: '#e50914' }, text: { color: '#fff', fontSize: 12 }, filterInput: { flex: 1, minWidth: 90, backgroundColor: '#202026', color: '#fff', padding: 10, borderRadius: 8 }, results: { padding: 18, gap: 14, paddingBottom: 36 }, card: { flexDirection: 'row', gap: 15, backgroundColor: '#15151b', padding: 10, borderRadius: 10 }, poster: { width: 80, height: 118, borderRadius: 7 }, cardInfo: { flex: 1, gap: 8, justifyContent: 'center' }, title: { color: '#fff', fontSize: 16, fontWeight: '600' }, meta: { color: '#aaa', fontSize: 12, lineHeight: 19 }, error: { color: '#faa' }, skeleton: { height: 130, borderRadius: 10, backgroundColor: '#202026' }, more: { padding: 20, alignItems: 'center' } });
