import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ImageBackground, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Calendar, Check, Clock, ExternalLink, Play, Plus, Star, Users } from 'lucide-react-native';
import { ContinueWatchingItem, EmbeddedPlayerDescriptor, NormalizedStreamingSource, TmdbMovieDetails } from '@togetherflix/shared';
import { queryClient } from '../../src/services/queryClient';
import { movieQuery } from '../../src/services/catalogQueries';
import { MovieImage } from '../../src/components/movie/MovieImage';
import { api } from '../../src/services/api';
import { useRoom } from '../../src/context/RoomContext';
import { Button } from '../../src/components/ui/Button';
import { colors, spacing, typography } from '../../src/theme';

export default function MovieDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { createCatalogWatchParty } = useRoom();
  const movieId = Number(id);
  const [movie, setMovie] = useState<TmdbMovieDetails | null>(null);
  const [sources, setSources] = useState<NormalizedStreamingSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingSources, setCheckingSources] = useState(true);
  const [checkingEmbed, setCheckingEmbed] = useState(true);
  const [embedPlayers, setEmbedPlayers] = useState<EmbeddedPlayerDescriptor[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [embedPlayer, setEmbedPlayer] = useState<EmbeddedPlayerDescriptor | null>(null);
  const [creating, setCreating] = useState<'watch' | 'party' | null>(null);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [libraryBusy, setLibraryBusy] = useState(false);
  const [progress, setProgress] = useState<ContinueWatchingItem | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!Number.isInteger(movieId) || movieId <= 0) { setError('Invalid movie.'); setLoading(false); return; }
    let active = true;
    queryClient.fetchQuery(movieQuery(movieId)).then((result) => active && setMovie(result.movie)).catch((e) => active && setError(e.message || 'Unable to load movie details.')).finally(() => active && setLoading(false));
    api.movies.stream(movieId).then((result) => active && setSources(Array.isArray(result.sources) ? result.sources : [])).catch(() => active && setSources([])).finally(() => active && setCheckingSources(false));
    api.movies.embed(movieId, Platform.OS === 'web' ? 'web' : 'mobile').then((result) => active && (setEmbedPlayer(result.player), setEmbedPlayers(result.players ?? [result.player]), setSelectedProvider(result.player.providerId))).catch(() => active && setEmbedPlayer(null)).finally(() => active && setCheckingEmbed(false));
    api.users.watchlist().then((result) => active && setInWatchlist(result.items.some((item) => item.tmdbId === movieId))).catch(() => undefined);
    api.users.continueWatching().then((result) => active && setProgress(result.items.find((item) => item.tmdbId === movieId) || null)).catch(() => undefined);
    return () => { active = false; };
  }, [movieId]);

  const start = async (destination: 'watch' | 'party') => {
    try {
      setCreating(destination); setError('');
      if (destination === 'watch') {
        router.push((embedPlayer ? `/movie/${movieId}/embed?provider=${encodeURIComponent(selectedProvider)}` : `/movie/${movieId}/watch?start=${progress?.positionSeconds || 0}`) as any);
      } else {
        const room = await createCatalogWatchParty(movieId, progress?.positionSeconds || 0, selectedProvider || undefined, Platform.OS === 'web' ? 'web' : 'mobile');
        router.replace(`/room/${room.code}` as any);
      }
    } catch (e: any) { setError(e.message || 'Unable to prepare this movie.'); }
    finally { setCreating(null); }
  };

  const toggleWatchlist = async () => {
    try {
      setLibraryBusy(true);
      if (inWatchlist) await api.users.removeFromWatchlist(movieId);
      else await api.users.addToWatchlist(movieId);
      setInWatchlist((value) => !value);
      void queryClient.invalidateQueries({ queryKey: ['library'] });
    } catch (e: any) { setError(e.message || 'Unable to update My List.'); }
    finally { setLibraryBusy(false); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>;
  if (!movie) return <View style={styles.center}><Text style={styles.error}>{error || 'Movie not found.'}</Text><Button title="Go back" onPress={() => router.back()} /></View>;

  const playable = sources.length > 0;
  const watchAvailable = playable || Boolean(embedPlayer);
  const checkingPlayback = checkingSources || checkingEmbed;
  return <ScrollView style={styles.container} contentContainerStyle={styles.content}>
    <ImageBackground source={movie.backdropUrl ? { uri: movie.backdropUrl } : undefined} style={[styles.backdrop, { height: width > 800 ? 420 : 280 }]} imageStyle={styles.backdropImage}>
      <View style={styles.backdropShade}><TouchableOpacity style={styles.back} onPress={() => router.back()}><ArrowLeft color={colors.text} size={22} /></TouchableOpacity></View>
    </ImageBackground>
    <View style={styles.details}>
      <View style={styles.headerRow}>
        {movie.posterUrl ? <MovieImage uri={movie.posterUrl} label={movie.title} style={styles.poster} size="w342" priority /> : null}
        <View style={styles.titleBlock}>
          <Text style={[styles.title, { fontSize: width > 800 ? 42 : 29, lineHeight: width > 800 ? 50 : 36 }]}>{movie.title}</Text>
          <View style={styles.meta}><Calendar size={14} color={colors.textSecondary} /><Text style={styles.metaText}>{movie.releaseDate || 'Release date unavailable'}</Text></View>
          <View style={styles.meta}><Clock size={14} color={colors.textSecondary} /><Text style={styles.metaText}>{movie.runtimeMinutes ? `${movie.runtimeMinutes} min` : 'Runtime unavailable'}</Text></View>
          <View style={styles.meta}><Star size={14} color={colors.warning} fill={colors.warning} /><Text style={styles.metaText}>{movie.rating.toFixed(1)} / 10</Text></View>
        </View>
      </View>
      <View style={styles.genreRow}>{(Array.isArray(movie.genres) ? movie.genres : []).map((genre) => <View style={styles.genre} key={genre.id}><Text style={styles.genreText}>{genre.name}</Text></View>)}</View>
      <Text style={styles.overview}>{movie.overview || 'No overview is available.'}</Text>
      {movie.trailer ? <TouchableOpacity style={styles.linkRow} onPress={() => Linking.openURL(movie.trailer!.url)}><Play size={17} color={colors.primary} /><Text style={styles.linkText}>Watch trailer</Text><ExternalLink size={14} color={colors.primary} /></TouchableOpacity> : null}
      <View style={styles.sourceCard}>
        <Text style={styles.sourceTitle}>Authorized playback</Text>
        {checkingSources ? <View style={styles.statusRow}><ActivityIndicator color={colors.primary} /><Text style={styles.statusText}>Checking licensed providers…</Text></View>
          : playable ? <><Text style={styles.available}>Available from {sources[0].provider.replace(/_/g, ' ')}</Text><Text style={styles.statusText}>{sources[0].licenseName} · {sources[0].type.toUpperCase()}{sources.length > 1 ? ` · ${sources.length} sources` : ''}</Text><TouchableOpacity onPress={() => Linking.openURL(sources[0].licenseUrl)}><Text style={styles.licenseLink}>View license</Text></TouchableOpacity></>
          : <Text style={styles.unavailable}>No playable source is currently available for this movie.</Text>}
      </View>
      {embedPlayer ? <View style={styles.sourceCard}><Text style={styles.available}>Authorized embed from {embedPlayer.providerName}</Text><Text style={styles.statusText}>{embedPlayer.supportsSynchronization ? 'Synchronized playback supported' : 'Start movie opens the same player for everyone. Iframe playback controls remain independent.'}</Text></View> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Watch Now" style={{ backgroundColor: '#fff' }} textStyle={{ color: '#080808' }} icon={<Play size={18} color="#080808" />} onPress={() => start('watch')} loading={creating === 'watch'} disabled={!watchAvailable || checkingPlayback || Boolean(creating)} />
      {progress && playable ? <Button title="Start From Beginning" variant="secondary" onPress={() => router.push(`/movie/${movieId}/watch?start=0` as any)} disabled={checkingSources} /> : null}
      {playable && embedPlayer ? <Button title="Watch Direct Source" variant="secondary" onPress={() => router.push(`/movie/${movieId}/watch?start=${progress?.positionSeconds || 0}` as any)} /> : null}
      {embedPlayers.length > 0 ? <View style={styles.genreRow}>{embedPlayers.map((option) => <Button key={option.providerId} title={option.providerName} variant={selectedProvider === option.providerId ? 'primary' : 'secondary'} onPress={() => { setSelectedProvider(option.providerId); setEmbedPlayer(option); }} />)}{playable ? <Button title="Direct synchronized source" variant={selectedProvider === '' ? 'primary' : 'secondary'} onPress={() => setSelectedProvider('')} /> : null}</View> : null}
      <Button title="Watch with Party" variant="secondary" icon={<Users size={18} color={colors.text} />} onPress={() => start('party')} loading={creating === 'party'} disabled={!watchAvailable || checkingPlayback || Boolean(creating)} />
      <Button title={inWatchlist ? 'Remove from My List' : 'Add to My List'} variant="secondary" icon={inWatchlist ? <Check size={18} color={colors.text} /> : <Plus size={18} color={colors.text} />} onPress={toggleWatchlist} loading={libraryBusy} disabled={libraryBusy} />
      <Text style={styles.notice}>TMDB supplies movie metadata only. Playback requires an authorized provider. Direct playback follows the host. Iframe parties open the same player together.</Text>
      <Text style={styles.attribution}>This product uses the TMDB API but is not endorsed or certified by TMDB.</Text>
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background }, content: { paddingBottom: spacing.huge }, center: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', gap: spacing.lg, padding: spacing.xl },
  backdrop: { height: 280, backgroundColor: colors.surfaceElevated }, backdropImage: { opacity: 0.8 }, backdropShade: { flex: 1, backgroundColor: 'rgba(11,11,15,0.25)', paddingTop: spacing.huge, paddingHorizontal: spacing.xl }, back: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.overlayGlass, alignItems: 'center', justifyContent: 'center' },
  details: { padding: spacing.xl, gap: spacing.lg, marginTop: -40 }, headerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.lg }, poster: { width: 115, height: 172, borderRadius: spacing.radius.lg, borderWidth: 2, borderColor: colors.borderLight }, titleBlock: { flex: 1, gap: spacing.sm, paddingBottom: spacing.xs }, title: { color: colors.text, fontSize: typography.size.xxl, lineHeight: typography.lineHeight.xxl, fontWeight: typography.weight.heavy },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, metaText: { color: colors.textSecondary, fontSize: typography.size.xs }, genreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, genre: { borderRadius: spacing.radius.full, borderWidth: 1, borderColor: colors.borderLight, paddingHorizontal: spacing.md, paddingVertical: 6 }, genreText: { color: colors.textSecondary, fontSize: typography.size.xs }, overview: { color: colors.textSecondary, fontSize: typography.size.md, lineHeight: typography.lineHeight.md },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, linkText: { color: colors.primary, fontWeight: typography.weight.bold, fontSize: typography.size.sm }, sourceCard: { borderBottomWidth: 1, borderColor: colors.border, paddingVertical: spacing.lg, gap: spacing.sm }, sourceTitle: { color: colors.text, fontWeight: typography.weight.bold, fontSize: typography.size.md }, statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, statusText: { color: colors.textSecondary, fontSize: typography.size.sm }, available: { color: colors.success, fontWeight: typography.weight.bold, fontSize: typography.size.sm }, unavailable: { color: colors.warning, fontSize: typography.size.sm, lineHeight: typography.lineHeight.sm }, licenseLink: { color: colors.info, fontSize: typography.size.xs, textDecorationLine: 'underline' }, notice: { color: colors.textMuted, fontSize: typography.size.xs, lineHeight: typography.lineHeight.xs }, attribution: { color: colors.textMuted, fontSize: 9 }, error: { color: colors.danger, fontSize: typography.size.sm, textAlign: 'center' },
});
