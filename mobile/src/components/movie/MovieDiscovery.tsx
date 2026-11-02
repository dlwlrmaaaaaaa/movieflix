import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Info, Play, Search } from 'lucide-react-native';
import { TmdbMovieSummary } from '@togetherflix/shared';
import { api } from '../../services/api';
import { catalogQuery, searchQuery } from '../../services/catalogQueries';
import { useAuth } from '../../context/AuthContext';
import { CatalogMovieCard } from './CatalogMovieCard';
import { MovieImage } from './MovieImage';
import { colors } from '../../theme';

const genres = [{ id: 0, name: 'All movies' }, { id: 28, name: 'Action' }, { id: 35, name: 'Comedy' }, { id: 18, name: 'Drama' }, { id: 27, name: 'Horror' }, { id: 10749, name: 'Romance' }, { id: 878, name: 'Sci-Fi' }, { id: 16, name: 'Animation' }];
const MovieRow = memo(function MovieRow({ title, movies, onMovie }: { title: string; movies: TmdbMovieSummary[]; onMovie: (movie: TmdbMovieSummary) => void }) {
  const { width } = useWindowDimensions();
  const render = useCallback(({ item }: { item: TmdbMovieSummary }) => <CatalogMovieCard movie={item} onPress={() => onMovie(item)} />, [onMovie]);
  if (!movies.length) return null;
  return <View style={styles.row}><Text style={styles.sectionTitle}>{title}</Text><FlatList horizontal data={movies} renderItem={render} keyExtractor={(item) => String(item.id)} showsHorizontalScrollIndicator={false} initialNumToRender={Math.min(8, Math.ceil(width / 168))} maxToRenderPerBatch={4} windowSize={3} getItemLayout={(_, index) => ({ length: 168, offset: 168 * index, index })} removeClippedSubviews={Platform.OS === 'android'} /></View>;
});

export function MovieDiscovery({ searchRequested = false, moviesOnly = false }: { searchRequested?: boolean; moviesOnly?: boolean }) {
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [genre, setGenre] = useState(0);
  const [opening, setOpening] = useState(false);
  const [playError, setPlayError] = useState('');
  const searchInput = useRef<TextInput>(null);
  const catalogs = useQueries({ queries: ['trending', 'popular', 'topRated', 'nowPlaying', 'upcoming'].map((category) => catalogQuery(category as 'trending' | 'popular' | 'topRated' | 'nowPlaying' | 'upcoming')) });
  const saved = useQuery({ queryKey: ['library', user?.id, 'watchlist'], queryFn: () => api.users.watchlist(), staleTime: 30_000, enabled: Boolean(user) });
  const progress = useQuery({ queryKey: ['library', user?.id, 'progress'], queryFn: () => api.users.continueWatching(), staleTime: 30_000, enabled: Boolean(user) });
  const search = useQuery(searchQuery(debounced));
  useEffect(() => { if (searchRequested) searchInput.current?.focus(); }, [searchRequested]);
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(query.trim()), 400);
    return () => clearTimeout(timeout);
  }, [query]);
  const filtering = query.trim().length >= 2;
  const searching = filtering && (query.trim() !== debounced || search.isFetching);
  const openMovie = useCallback((movie: TmdbMovieSummary) => router.push(`/movie/${movie.id}` as any), [router]);
  const hero = catalogs[0].data?.results[0];
  const filter = (movies: TmdbMovieSummary[] = []) => genre ? movies.filter((movie) => movie.genreIds.includes(genre)) : movies;
  const combined = useMemo(() => Array.from(new Map(catalogs.flatMap((page) => page.data?.results || []).map((movie) => [movie.id, movie])).values()), catalogs.map((page) => page.data));
  const watchNow = async () => {
    if (!hero || opening) return;
    setOpening(true); setPlayError('');
    try {
      const result = await api.movies.embed(hero.id, Platform.OS === 'web' ? 'web' : 'mobile');
      router.push(`/movie/${hero.id}/embed?provider=${encodeURIComponent(result.player.providerId)}` as any);
    } catch { router.push(`/movie/${hero.id}/watch` as any); }
    finally { setOpening(false); }
  };
  const savedMovies: TmdbMovieSummary[] = (saved.data?.items || []).map((item) => ({ id: item.tmdbId, title: item.title, originalTitle: item.title, overview: item.overview || '', releaseDate: null, releaseYear: item.releaseYear, posterUrl: item.posterUrl, backdropUrl: item.backdropUrl, rating: item.rating, voteCount: 0, genreIds: [] }));
  const progressMovies: TmdbMovieSummary[] = (progress.data?.items || []).map((item) => ({ id: item.tmdbId, title: item.title, originalTitle: item.title, overview: '', releaseDate: null, releaseYear: null, posterUrl: item.posterUrl, backdropUrl: item.backdropUrl, rating: 0, voteCount: 0, genreIds: [] }));
  const error = playError || (filtering ? search.error?.message : catalogs.find((page) => page.error)?.error?.message);
  return <View style={styles.container}>
    {!filtering && !moviesOnly && hero ? <View style={[styles.hero, { height: width < 650 ? 440 : 540 }]}>
      <View style={StyleSheet.absoluteFillObject}><MovieImage uri={hero.backdropUrl} label="" priority size={width < 650 ? 'w780' : 'w1280'} style={styles.backdrop} /></View>
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.35)' }]} />
      {Platform.OS === 'web' ? <View style={[StyleSheet.absoluteFillObject, { backgroundImage: 'linear-gradient(90deg,rgba(8,8,8,.94),rgba(8,8,8,.1)),linear-gradient(0deg,#080808,transparent 55%)' } as any]} /> : <View style={styles.nativeShade} />}
      <View style={styles.heroContent}><Text style={styles.kicker}>ANNAHFLIX / FEATURED FILM</Text><TouchableOpacity accessibilityRole="button" onPress={() => openMovie(hero)}><Text style={[styles.heroTitle, { fontSize: width < 650 ? 35 : 54 }]}>{hero.title}</Text></TouchableOpacity><Text style={styles.heroMeta}>{hero.releaseYear || 'Coming soon'}  /  {hero.rating.toFixed(1)} rating</Text><Text style={styles.overview} numberOfLines={3}>{hero.overview || 'Your next movie night starts here.'}</Text><View style={styles.actions}><TouchableOpacity accessibilityRole="button" style={styles.play} onPress={watchNow} disabled={opening}>{opening ? <ActivityIndicator color="#080808" /> : <Play size={18} color="#080808" fill="#080808" />}<Text style={styles.playText}>Watch Now</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" style={styles.more} onPress={() => openMovie(hero)}><Info size={18} color="#fff" /><Text style={styles.moreText}>More Info</Text></TouchableOpacity></View></View>
    </View> : null}
    <View style={styles.browse}>
      <View style={styles.browseHeading}><Text style={styles.heading}>{filtering ? 'Find your next favorite' : moviesOnly ? 'Movies' : 'Made for your evening'}</Text><Text style={styles.small}>WATCH YOUR WAY</Text></View>
      <View style={styles.searchBox}><Search color={colors.textSecondary} size={19} /><TextInput ref={searchInput} accessibilityLabel="Search movies" placeholder="Search movies" placeholderTextColor={colors.textMuted} value={query} onChangeText={(value) => { setQuery(value); if (!value.trim()) setDebounced(''); }} onSubmitEditing={() => setDebounced(query.trim())} autoCorrect={false} returnKeyType="search" style={styles.searchInput} /><TouchableOpacity accessibilityRole="button" accessibilityLabel="Search" onPress={() => setDebounced(query.trim())}><Text style={styles.searchAction}>{searching ? 'Searching...' : 'Search'}</Text></TouchableOpacity></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.genres}>{genres.map((item) => <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: genre === item.id }} key={item.id} onPress={() => setGenre(item.id)} style={[styles.genre, genre === item.id && styles.genreActive]}><Text style={[styles.genreText, genre === item.id && { color: '#fff' }]}>{item.name}</Text></TouchableOpacity>)}</ScrollView>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {catalogs.every((page) => page.isPending) ? <View style={styles.skeletons}>{[0, 1, 2, 3, 4].map((key) => <View key={key} style={styles.skeleton} />)}</View> : null}
      {filtering ? searching ? <ActivityIndicator color={colors.primary} style={{ padding: 30 }} /> : search.data?.results.length ? <MovieRow title={`Results for "${debounced}"`} movies={filter(search.data.results)} onMovie={openMovie} /> : <Text style={styles.empty}>No movies found. Try a different title.</Text> : <>
        <MovieRow title="Continue Watching" movies={progressMovies} onMovie={openMovie} /><MovieRow title="My List" movies={savedMovies} onMovie={openMovie} />
        {['Trending Now', 'Popular Movies', 'Top Rated', 'Now Playing', 'Upcoming Movies'].map((title, index) => <MovieRow key={title} title={title} movies={filter(catalogs[index].data?.results)} onMovie={openMovie} />)}
        {genres.filter((item) => item.id > 0 && (!genre || item.id === genre)).map((item) => <MovieRow key={item.id} title={item.name} movies={combined.filter((movie) => movie.genreIds.includes(item.id))} onMovie={openMovie} />)}
      </>}
      <Text style={styles.attribution}>This product uses the TMDB API but is not endorsed or certified by TMDB.</Text>
    </View>
  </View>;
}
const styles = StyleSheet.create({
 container: { backgroundColor: '#080808', gap: 12 }, hero: { width: '100%', backgroundColor: '#141414', justifyContent: 'flex-end' }, backdrop: { width: '100%', height: '100%' }, nativeShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '65%', backgroundColor: 'rgba(8,8,8,0.55)' }, heroContent: { padding: 28, paddingBottom: 42, maxWidth: 720, gap: 15 }, kicker: { color: '#e7e7e7', fontSize: 10, fontWeight: '800', letterSpacing: 3 }, heroTitle: { color: '#fff', fontWeight: '900', letterSpacing: -1.5 }, heroMeta: { color: '#e0e0e0', fontSize: 12 }, overview: { color: '#dedede', fontSize: 15, lineHeight: 23, maxWidth: 550 }, actions: { flexDirection: 'row', gap: 12, marginTop: 8 }, play: { backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 22, paddingVertical: 13, borderRadius: 4 }, playText: { color: '#080808', fontWeight: '800', fontSize: 14 }, more: { backgroundColor: '#414141bb', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 22, paddingVertical: 13, borderRadius: 4 }, moreText: { color: '#fff', fontWeight: '700', fontSize: 14 },
 browse: { paddingHorizontal: 24, gap: 25, paddingBottom: 32 }, browseHeading: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }, heading: { color: '#fff', fontSize: 24, fontWeight: '700', letterSpacing: -.5 }, small: { color: '#737373', fontSize: 9, letterSpacing: 2 }, searchBox: { maxWidth: 650, width: '100%', borderBottomWidth: 1, borderColor: '#3a3a3a', flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }, searchInput: { flex: 1, color: '#fff', fontSize: 15 }, searchAction: { color: '#d6d6d6', fontSize: 12 }, genres: { gap: 18 }, genre: { paddingVertical: 8, borderBottomWidth: 2, borderColor: 'transparent' }, genreActive: { borderColor: '#e50914' }, genreText: { color: '#929292', fontSize: 12 }, row: { gap: 15 }, sectionTitle: { color: '#f4f4f4', fontSize: 20, fontWeight: '700', letterSpacing: -.3 }, empty: { color: '#a3a3a3', paddingVertical: 30 }, error: { color: '#f78787', fontSize: 13 }, attribution: { color: '#666', fontSize: 10, paddingTop: 24 }, skeletons: { flexDirection: 'row', gap: 16, overflow: 'hidden' }, skeleton: { width: 152, height: 228, backgroundColor: '#202020', borderRadius: 5 },
});
