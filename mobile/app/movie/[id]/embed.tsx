import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, RotateCcw } from 'lucide-react-native';
import { EmbeddedVideoPlayer } from '../../../src/components/player/EmbeddedVideoPlayer';
import { api } from '../../../src/services/api';
import { movieQuery } from '../../../src/services/catalogQueries';

export default function EmbeddedWatchScreen() {
 const { id, mediaType, season, episode, format, provider } = useLocalSearchParams<{ id: string; mediaType?: string; season?: string; episode?: string; format?: string; provider?: string }>();
 const router = useRouter(); const tmdbId = Number(id); const isTv = mediaType === 'tv';
 const seasonNumber = Number(season); const episodeNumber = Number(episode); const tvFormat = format === 'query' ? 'query' : format === 'path' ? 'path' : undefined;
 const platform = Platform.OS === 'web' ? 'web' : 'mobile';
 const valid = Number.isInteger(tmdbId) && tmdbId > 0 && (!isTv || (Number.isInteger(seasonNumber) && seasonNumber > 0 && Number.isInteger(episodeNumber) && episodeNumber > 0));
 const movie = useQuery({ ...movieQuery(tmdbId), enabled: valid && !isTv });
 const options = useQuery({ queryKey: ['embed-options', tmdbId, isTv, seasonNumber || 0, episodeNumber || 0, tvFormat || '', platform], queryFn: async () => {
  if (isTv) { const result = await api.movies.tvEmbed(tmdbId, seasonNumber, episodeNumber, platform, tvFormat); return result.players ?? [result.player]; }
  const result = await api.movies.embed(tmdbId, platform); return result.players ?? [result.player];
 }, enabled: valid, staleTime: 30_000, retry: false });
 const [attempted, setAttempted] = useState<string[]>([]); const [attempt, setAttempt] = useState(0);
 const [selected, setSelected] = useState(provider || ''); const [loadedUrl, setLoadedUrl] = useState(''); const [playerError, setPlayerError] = useState('');
 const player = options.data?.find((item) => item.providerId === selected) || options.data?.[0];
 const chooseServer = (providerId: string) => { setSelected(providerId); setAttempted([]); setPlayerError(''); setLoadedUrl(''); setAttempt((value) => value + 1); };
 const failServer = (message: string) => {
  if (!player || playerError) return;
  const failed = [...attempted, player.providerId];
  const currentIndex = options.data!.findIndex((item) => item.providerId === player.providerId);
  const ordered = [...options.data!.slice(currentIndex + 1), ...options.data!.slice(0, currentIndex)];
  const next = ordered.find((item) => !failed.includes(item.providerId));
  setAttempted(failed);
  setLoadedUrl('');
  if (next) { setSelected(next.providerId); setAttempt((value) => value + 1); }
  else setPlayerError(`All available servers failed. ${message}`);
 };
 useEffect(() => {
  if (!player || playerError || loadedUrl === player.embedUrl) return;
  const timeout = setTimeout(() => failServer('The player took too long to load.'), 25000);
  return () => clearTimeout(timeout);
 }, [player?.embedUrl, loadedUrl, playerError, attempt]);
 const title = movie.data?.movie.title || (isTv ? `TV episode / S${seasonNumber} E${episodeNumber}` : 'AnnahFlix');
 const error = !valid ? 'Invalid movie or episode selection.' : playerError || options.error?.message;
 return <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.page}>
  <View style={styles.header}><TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to Movies" onPress={() => router.back()} style={styles.back}><ArrowLeft size={23} color="#fff" /></TouchableOpacity><View style={{ flex: 1 }}><Text style={styles.title} numberOfLines={1}>{title}</Text><Text style={styles.provider}>{player?.providerName || 'Loading player...'}</Text></View><Text style={styles.brand}>AnnahFlix</Text></View>
  {(options.data?.length || 0) > 1 ? <View style={styles.servers} accessibilityLabel="Server selector">{options.data!.map((option) => <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: option.providerId === player?.providerId }} key={option.providerId} onPress={() => { chooseServer(option.providerId); }} style={[styles.server, option.providerId === player?.providerId && styles.selected]}><Text style={styles.serverText}>{option.providerName}</Text></TouchableOpacity>)}</View> : null}
  {(options.data?.length || 0) > 1 ? <TouchableOpacity accessibilityRole="button" onPress={() => failServer('Playback failed.')} style={styles.server}><Text style={styles.serverText}>Video not playing? Next server</Text></TouchableOpacity> : null}
  <Text style={{ color: "#aaa", fontSize: 12, paddingHorizontal: 14, paddingVertical: 8 }}>Use CC or Subtitles inside this server?s player. Available languages depend on the selected server.</Text>
  <View style={styles.player}>
   {player ? <EmbeddedVideoPlayer key={`${player.providerId}:${attempt}`} url={player.embedUrl} title={`${title} player`} onLoad={() => setLoadedUrl(player.embedUrl)} onError={failServer} /> : null}
   {!error && (!player || loadedUrl !== player.embedUrl) ? <View pointerEvents="none" style={styles.loading}><ActivityIndicator color="#e50914" size="large" /><Text style={styles.loadingText}>Loading your movie...</Text></View> : null}
   {error ? <View style={styles.failure}><Text accessibilityRole="alert" style={styles.error}>{error}</Text><TouchableOpacity accessibilityRole="button" onPress={() => { chooseServer(player?.providerId || ''); void options.refetch(); }} style={styles.retry}><RotateCcw color="#fff" size={17} /><Text style={styles.serverText}>Try again</Text></TouchableOpacity></View> : null}
  </View>
 </SafeAreaView>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: '#000' }, header: { minHeight: 65, paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 15, backgroundColor: '#080808' }, back: { padding: 8 }, title: { color: '#fff', fontSize: 16, fontWeight: '600' }, provider: { color: '#777', fontSize: 10, marginTop: 4 }, brand: { color: '#e50914', fontWeight: '900', fontSize: 15 }, servers: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 12, backgroundColor: '#080808' }, server: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 4, backgroundColor: '#202020' }, selected: { backgroundColor: '#e50914' }, serverText: { color: '#fff', fontSize: 12 }, player: { flex: 1, backgroundColor: '#000' }, loading: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', gap: 15, backgroundColor: '#000' }, loadingText: { color: '#888', fontSize: 12 }, failure: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', padding: 28, gap: 20, backgroundColor: '#080808ee' }, error: { color: '#f08a8a', textAlign: 'center', maxWidth: 500 }, retry: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#292929', padding: 13, borderRadius: 4 } });
