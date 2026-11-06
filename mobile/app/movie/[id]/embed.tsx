import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, RotateCcw } from 'lucide-react-native';
import { EmbeddedVideoPlayer } from '../../../src/components/player/EmbeddedVideoPlayer';
import { api } from '../../../src/services/api';
import { movieQuery } from '../../../src/services/catalogQueries';
import { usePlayerDiagnostics } from '../../../src/hooks/usePlayerDiagnostics';
import type { PlayerDiagnosticEvent, PlayerFailureDetails } from '@togetherflix/shared';

export default function EmbeddedWatchScreen() {
 const { id, mediaType, season, episode, format, provider } = useLocalSearchParams<{ id: string; mediaType?: string; season?: string; episode?: string; format?: string; provider?: string }>();
 const router = useRouter(); const tmdbId = Number(id); const isTv = mediaType === 'tv';
 const seasonNumber = Number(season); const episodeNumber = Number(episode); const tvFormat = format === 'query' ? 'query' : format === 'path' ? 'path' : undefined;
 const platform = Platform.OS === 'web' ? 'web' : 'mobile';
 const report = usePlayerDiagnostics({ mediaType: isTv ? 'tv' : 'movie', tmdbId, ...(isTv ? { season: seasonNumber, episode: episodeNumber } : {}) });
 const valid = Number.isInteger(tmdbId) && tmdbId > 0 && (!isTv || (Number.isInteger(seasonNumber) && seasonNumber > 0 && Number.isInteger(episodeNumber) && episodeNumber > 0));
 const movie = useQuery({ ...movieQuery(tmdbId), enabled: valid && !isTv });
 const options = useQuery({ queryKey: ['embed-options', tmdbId, isTv, seasonNumber || 0, episodeNumber || 0, tvFormat || '', platform], queryFn: async () => {
  if (isTv) { const result = await api.movies.tvEmbed(tmdbId, seasonNumber, episodeNumber, platform, tvFormat); return result.players ?? [result.player]; }
  const result = await api.movies.embed(tmdbId, platform); return result.players ?? [result.player];
 }, enabled: valid, staleTime: 30_000, retry: false });
 const [attempted, setAttempted] = useState<string[]>([]); const [attempt, setAttempt] = useState(0);
 const activeAttempt = useRef(0); const failedAttempt = useRef<number | null>(null);
 const loading = useRef({ attempt: -1, started: 0, progressed: 0, progress: 0 });
 const [serverNotice, setServerNotice] = useState('');
 const [selected, setSelected] = useState(provider || ''); const [loadedUrl, setLoadedUrl] = useState(''); const [playerError, setPlayerError] = useState('');
 const player = options.data?.find((item) => item.providerId === selected) || options.data?.[0];
 const chooseServer = (providerId: string, reason: 'manual_select' | 'retry' = 'manual_select') => { const nextAttempt = ++activeAttempt.current; if (providerId) report('server_selected', { providerId, attempt: nextAttempt, reason }); setSelected(providerId); setAttempted([]); setPlayerError(''); setServerNotice(''); setLoadedUrl(''); setAttempt(nextAttempt); };
 const failServer = (message: string, expectedAttempt = attempt, reason: PlayerDiagnosticEvent['reason'] = 'network_error', details?: PlayerFailureDetails) => {
  if (!player || playerError || activeAttempt.current !== expectedAttempt || failedAttempt.current === expectedAttempt) return;
  failedAttempt.current = expectedAttempt;
  let urlHost: string | undefined;
  try { urlHost = new URL(details?.url || player.embedUrl).hostname; } catch { /* Report the error without a malformed URL. */ }
  const fields = { providerId: player.providerId, attempt: expectedAttempt, reason, message, urlHost, elapsedMs: loading.current.started ? Date.now() - loading.current.started : 0, statusCode: details?.statusCode, errorCode: details?.errorCode };
  report(reason === 'manual_next' ? 'server_selected' : reason === 'stalled_load' || reason === 'load_deadline' ? 'timeout' : 'load_error', fields);
  const failed = [...attempted, player.providerId];
  const currentIndex = options.data!.findIndex((item) => item.providerId === player.providerId);
  const ordered = [...options.data!.slice(currentIndex + 1), ...options.data!.slice(0, currentIndex)];
  const next = ordered.find((item) => !failed.includes(item.providerId));
  setAttempted(failed);
  setLoadedUrl('');
  if (next) { report('fallback', { ...fields, nextProviderId: next.providerId }); const nextAttempt = ++activeAttempt.current; setServerNotice(`${player.providerName}: ${message} Trying ${next.providerName}.`); setSelected(next.providerId); setAttempt(nextAttempt); }
  else { report('exhausted', fields); setPlayerError(`All available servers failed. ${message}`); }
 };
 useEffect(() => {
  if (player) report('attempt_started', { providerId: player.providerId, attempt, urlHost: new URL(player.embedUrl).hostname });
 }, [player?.providerId, player?.embedUrl, attempt, report]);
 useEffect(() => {
  if (!player || playerError || loadedUrl === player.embedUrl) return;
  if (loading.current.attempt !== attempt) { const now = Date.now(); loading.current = { attempt, started: now, progressed: now, progress: 0 }; }
  // Keep a progressing document open. Still bound both stalled loads and the
  // total wait, without treating document readiness as confirmed video playback.
  const timeout = setInterval(() => {
   const current = Date.now();
   if (current - loading.current.started >= 75000) failServer('The player did not finish loading.', attempt, 'load_deadline');
   else if (current - loading.current.progressed >= 25000) failServer('The player did not finish loading.', attempt, 'stalled_load');
  }, 1000);
  return () => clearInterval(timeout);
 }, [player?.embedUrl, loadedUrl, playerError, attempt]);
 const title = movie.data?.movie.title || (isTv ? `TV episode / S${seasonNumber} E${episodeNumber}` : 'AnnahFlix');
 const error = !valid ? 'Invalid movie or episode selection.' : playerError || options.error?.message;
 return <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.page}>
  <View style={styles.header}><TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to Movies" onPress={() => router.back()} style={styles.back}><ArrowLeft size={23} color="#fff" /></TouchableOpacity><View style={{ flex: 1 }}><Text style={styles.title} numberOfLines={1}>{title}</Text><Text style={styles.provider}>{player?.providerName || 'Loading player...'}</Text></View><Text style={styles.brand}>AnnahFlix</Text></View>
  {(options.data?.length || 0) > 1 ? <View style={styles.servers} accessibilityLabel="Server selector">{options.data!.map((option) => <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: option.providerId === player?.providerId }} key={option.providerId} onPress={() => { chooseServer(option.providerId); }} style={[styles.server, option.providerId === player?.providerId && styles.selected]}><Text style={styles.serverText}>{option.providerName}</Text></TouchableOpacity>)}</View> : null}
  {(options.data?.length || 0) > 1 ? <TouchableOpacity accessibilityRole="button" onPress={() => failServer('Viewer requested another server.', attempt, 'manual_next')} style={styles.server}><Text style={styles.serverText}>Video not playing? Next server</Text></TouchableOpacity> : null}
  {serverNotice ? <Text accessibilityLiveRegion="polite" style={{ color: '#e8c78d', fontSize: 12, paddingHorizontal: 14, paddingVertical: 8 }}>{serverNotice}</Text> : null}
  <Text style={{ color: "#aaa", fontSize: 12, paddingHorizontal: 14, paddingVertical: 8 }}>Use CC or Subtitles inside this server's player. Available languages depend on the selected server.</Text>
  <View style={styles.player}>
   {player ? <EmbeddedVideoPlayer key={`${player.providerId}:${attempt}`} url={player.embedUrl} title={`${title} player`} onLoadStart={() => {
    if (activeAttempt.current !== attempt || failedAttempt.current === attempt) return;
    const now = Date.now();
    if (loading.current.attempt !== attempt) loading.current = { attempt, started: now, progressed: now, progress: 0 };
    else { loading.current.progressed = now; loading.current.progress = 0; }
    setLoadedUrl('');
   }} onLoad={() => { if (activeAttempt.current === attempt && failedAttempt.current !== attempt) { setLoadedUrl(player.embedUrl); report('document_loaded', { providerId: player.providerId, attempt, elapsedMs: loading.current.started ? Date.now() - loading.current.started : 0 }); } }} onLoadProgress={(progress) => {
    if (activeAttempt.current !== attempt || failedAttempt.current === attempt || !Number.isFinite(progress)) return;
    if (progress > loading.current.progress + 0.01) { loading.current.progress = progress; loading.current.progressed = Date.now(); }
   }} onDiagnostic={(event) => { if (activeAttempt.current === attempt && failedAttempt.current !== attempt) report(event.event, { providerId: player.providerId, attempt, urlHost: event.urlHost }); }} onError={(message, details) => failServer(message, attempt, details?.kind === 'ssl_error' ? 'ssl_error' : details?.statusCode ? 'http_error' : 'network_error', details)} /> : null}
   {!error && (!player || loadedUrl !== player.embedUrl) ? <View pointerEvents="none" style={styles.loading}><ActivityIndicator color="#e50914" size="large" /><Text style={styles.loadingText}>Loading your movie...</Text></View> : null}
   {error ? <View style={styles.failure}><Text accessibilityRole="alert" style={styles.error}>{error}</Text><TouchableOpacity accessibilityRole="button" onPress={() => { chooseServer(player?.providerId || '', 'retry'); void options.refetch(); }} style={styles.retry}><RotateCcw color="#fff" size={17} /><Text style={styles.serverText}>Try again</Text></TouchableOpacity></View> : null}
  </View>
 </SafeAreaView>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: '#000' }, header: { minHeight: 65, paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 15, backgroundColor: '#080808' }, back: { padding: 8 }, title: { color: '#fff', fontSize: 16, fontWeight: '600' }, provider: { color: '#777', fontSize: 10, marginTop: 4 }, brand: { color: '#e50914', fontWeight: '900', fontSize: 15 }, servers: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 12, backgroundColor: '#080808' }, server: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 4, backgroundColor: '#202020' }, selected: { backgroundColor: '#e50914' }, serverText: { color: '#fff', fontSize: 12 }, player: { flex: 1, backgroundColor: '#000' }, loading: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', gap: 15, backgroundColor: '#000' }, loadingText: { color: '#888', fontSize: 12 }, failure: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', padding: 28, gap: 20, backgroundColor: '#080808ee' }, error: { color: '#f08a8a', textAlign: 'center', maxWidth: 500 }, retry: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#292929', padding: 13, borderRadius: 4 } });
