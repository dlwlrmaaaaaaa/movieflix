import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dramas } from '../../src/services/dramas';
import { useRoom } from '../../src/context/RoomContext';
import { useAuth } from '../../src/context/AuthContext';
import { EpisodeAdmin } from '../../src/components/movie/EpisodeAdmin';

export default function DramaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const tmdbId = Number(id); const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth(); const { room, isHost, setRoom } = useRoom();
  const [season, setSeason] = useState(1); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const details = useQuery({ queryKey: ['drama', tmdbId], queryFn: ({ signal }) => dramas.details(tmdbId, signal), enabled: Number.isInteger(tmdbId) && tmdbId > 0, staleTime: 300000 });
  const episodes = useQuery({ queryKey: ['drama-season', tmdbId, season], queryFn: ({ signal }) => dramas.season(tmdbId, season, signal), enabled: !!details.data, staleTime: 30000 });
  const progress = useQuery({ queryKey: ['episode-continue'], queryFn: dramas.continue, staleTime: 0 });
  const last = progress.data?.items.find((item) => item.drama.tmdbId === tmdbId && !item.completed);
  const show = details.data?.drama;
  const party = async (episodeId: string) => {
    setBusy(true); setError('');
    try {
      const result = room && room.status !== 'ENDED' && isHost ? await dramas.select(room, episodeId) : await dramas.party(episodeId);
      setRoom(result.room); router.push(`/party/${result.room.code}` as any);
    } catch (failure: any) { setError(failure.message); } finally { setBusy(false); }
  };
  return <SafeAreaView style={styles.page}><FlatList data={episodes.data?.episodes || []} keyExtractor={(item) => item.id} initialNumToRender={6} windowSize={5}
    ListHeaderComponent={<View style={{ gap: 15 }}><TouchableOpacity onPress={() => router.back()} style={styles.button}><Text style={styles.text}>← Back</Text></TouchableOpacity>
      {details.isPending ? <ActivityIndicator color="#e50914" /> : null}
      {details.error ? <TouchableOpacity onPress={() => void details.refetch()}><Text style={styles.error}>{details.error.message} · Retry</Text></TouchableOpacity> : null}
      {show ? <>{show.backdropUrl ? <Image source={{ uri: show.backdropUrl }} style={styles.backdrop} /> : null}<View style={styles.info}>{show.posterUrl ? <Image source={{ uri: show.posterUrl }} style={styles.poster} /> : null}<View style={{ flex: 1, gap: 8 }}><Text style={styles.title}>{show.title}</Text><Text style={styles.meta}>{show.year || 'Year unknown'} · ★ {show.rating.toFixed(1)} · {show.genres.join(', ')}</Text><Text style={styles.meta}>{show.originCountry.join(', ')} · {show.originalLanguage} · {show.numberOfSeasons || show.seasons.length} seasons</Text></View></View><Text style={styles.text}>{show.description || 'No synopsis available.'}</Text><Text style={styles.meta}>Cast: {show.cast.join(', ') || 'Not available'}</Text>
        {last ? <TouchableOpacity style={styles.primary} onPress={() => router.push(`/episode/${last.episode.id}` as any)}><Text style={styles.text}>Continue Watching S{last.episode.seasonNumber}:E{last.episode.episodeNumber}</Text></TouchableOpacity> : null}
        <View style={styles.row}>{show.seasons.map((item) => <TouchableOpacity key={item.seasonNumber} onPress={() => setSeason(item.seasonNumber)} style={[styles.button, season === item.seasonNumber && styles.primary]}><Text style={styles.text}>{item.title}</Text></TouchableOpacity>)}</View>
        {user?.role === 'ADMIN' ? <TouchableOpacity style={styles.button} onPress={async () => { try { await dramas.importSeason(tmdbId, season); await episodes.refetch(); } catch (failure: any) { setError(failure.message); } }}><Text style={styles.text}>Refresh season metadata from TMDB</Text></TouchableOpacity> : null}
      </> : null}
      {episodes.isPending && show ? <ActivityIndicator color="#e50914" /> : null}
      {episodes.error ? <TouchableOpacity onPress={() => void episodes.refetch()}><Text style={styles.error}>{episodes.error.message} · Retry</Text></TouchableOpacity> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>}
    renderItem={({ item }) => <View style={styles.episode}>{item.thumbnailUrl ? <Image source={{ uri: item.thumbnailUrl }} style={styles.thumbnail} /> : null}<Text style={styles.heading}>{item.episodeNumber}. {item.title}{item.watched ? ' ✓ Watched' : ''}</Text><Text style={styles.meta}>{item.runtime ? `${item.runtime} min` : 'Runtime unavailable'} · {item.airDate || 'Air date unavailable'}</Text><Text style={styles.text}>{item.description || 'No description available.'}</Text><View style={styles.row}><TouchableOpacity disabled={!item.available} style={[styles.primary, !item.available && { opacity: 0.45 }]} onPress={() => router.push(`/episode/${item.id}` as any)}><Text style={styles.text}>{item.available ? 'Watch Now' : 'Episode unavailable'}</Text></TouchableOpacity><TouchableOpacity disabled={!item.available || busy || (!!room && !isHost)} style={styles.button} onPress={() => void party(item.id)}><Text style={styles.text}>Watch With Party</Text></TouchableOpacity></View><TouchableOpacity style={styles.button} onPress={() => router.push({ pathname: "/movie/[id]/embed", params: { id: String(tmdbId), mediaType: "tv", season: String(item.seasonNumber), episode: String(item.episodeNumber) } } as any)}><Text style={styles.text}>Open embedded player ? Choose server</Text></TouchableOpacity><EpisodeSubtitleAvailability id={item.id} />{user?.role === 'ADMIN' ? <EpisodeAdmin episode={item} onSaved={() => { void episodes.refetch(); void queryClient.invalidateQueries({ queryKey: ['episode-subtitle-info', item.id] }); }} /> : null}</View>}
    ListEmptyComponent={!episodes.isPending && show ? <Text style={styles.meta}>No episodes found for this season.</Text> : null} contentContainerStyle={styles.content} /></SafeAreaView>;
}
function EpisodeSubtitleAvailability({ id }: { id: string }) {
  const result = useQuery({ queryKey: ['episode-subtitle-info', id], queryFn: () => dramas.subtitleInfo(id), staleTime: 60000 });
  return <Text style={styles.meta}>Subtitles: {result.data?.subtitles.map((track) => track.label).join(', ') || 'None added'}</Text>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: '#080808' }, content: { padding: 20, gap: 18, maxWidth: 1100, width: '100%', alignSelf: 'center' }, backdrop: { width: '100%', height: 240, borderRadius: 12 }, info: { flexDirection: 'row', gap: 18 }, poster: { width: 85, height: 125, borderRadius: 8 }, title: { color: '#fff', fontSize: 28, fontWeight: '800' }, heading: { color: '#fff', fontSize: 18, fontWeight: '700' }, text: { color: '#ddd', lineHeight: 22 }, meta: { color: '#999', fontSize: 12, lineHeight: 19 }, button: { padding: 12, backgroundColor: '#24242b', borderRadius: 8 }, primary: { padding: 12, backgroundColor: '#e50914', borderRadius: 8 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, episode: { backgroundColor: '#16161b', padding: 16, borderRadius: 12, gap: 10 }, thumbnail: { width: 180, height: 100, borderRadius: 7 }, error: { color: '#ff8888' } });
