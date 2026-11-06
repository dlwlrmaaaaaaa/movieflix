import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { SoloVideoPlayer } from '../../../src/components/player/SoloVideoPlayer';
import { useEpisodeSubtitles } from '../../../src/components/player/EpisodeSubtitles';
import { api } from '../../../src/services/api';
import { colors, spacing, typography } from '../../../src/theme';
import { AuthorizedPlaybackSource, CloudMovie } from '@togetherflix/shared';

export default function SoloWatchScreen() {
  const { id, start } = useLocalSearchParams<{ id: string; start?: string }>();
  const router = useRouter();
  const tmdbId = Number(id);
  const initialPosition = Math.max(0, Number(start) || 0);
  const position = useRef(initialPosition);
  const [title, setTitle] = useState('Movie');
  const [uri, setUri] = useState('');
  const [error, setError] = useState('');
  const [options, setOptions] = useState<Array<{ movie: CloudMovie; source: AuthorizedPlaybackSource }>>([]);
  const [sourceIndex, setSourceIndex] = useState(0);
  const subtitles = useEpisodeSubtitles([], position.current, uri, { allowNative: Platform.OS === 'android' });

  useEffect(() => {
    if (!Number.isInteger(tmdbId) || tmdbId <= 0) { setError('Invalid movie.'); return; }
    let active = true;
    (async () => {
      try {
        const prepared = await api.movies.prepareSolo(tmdbId);
        const preparedOptions = Array.isArray(prepared.alternatives) && prepared.alternatives.length ? prepared.alternatives : [{ movie: prepared.movie, source: prepared.source }];
        const playback = await api.movies.playback(preparedOptions[0].movie.id);
        if (active) { setTitle(prepared.movie.title); setOptions(preparedOptions); setUri(playback.playbackUrl); }
      } catch (e: any) { if (active) setError(e.message || 'Unable to prepare playback.'); }
    })();
    return () => { active = false; };
  }, [tmdbId]);

  const saveProgress = useCallback((current: number, duration: number) => {
    position.current = current;
    void api.users.saveProgress(tmdbId, current, duration).catch(() => undefined);
  }, [tmdbId]);

  const handleSourceError = async (message: string) => {
    const nextIndex = sourceIndex + 1;
    if (nextIndex >= options.length) { setError(message); return; }
    try {
      setError(`Source ${sourceIndex + 1} failed. Switching to another authorized source…`);
      const playback = await api.movies.playback(options[nextIndex].movie.id);
      setSourceIndex(nextIndex);
      setUri(playback.playbackUrl);
      setError('');
    } catch (e: any) { setError(e.message || message); }
  };

  if (!uri) return <SafeAreaView style={styles.center}>{error ? <><Text style={styles.error}>{error}</Text><TouchableOpacity onPress={() => router.back()}><Text style={styles.action}>Go back</Text></TouchableOpacity></> : <><ActivityIndicator color={colors.primary} size="large" /><Text style={styles.loading}>Preparing authorized playback…</Text></>}</SafeAreaView>;

  return <SafeAreaView style={styles.container}>
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.icon}><ArrowLeft color={colors.text} size={22} /></TouchableOpacity>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
    </View>
    <SoloVideoPlayer {...subtitles.playerProps} subtitleOverlay={subtitles.overlay} key={uri} uri={uri} initialPosition={position.current || initialPosition} onPosition={(value) => { position.current = value; }} onProgress={saveProgress} onError={handleSourceError} />
    {subtitles.controls}
    {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' }, center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },
  header: { height: 62, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, backgroundColor: colors.background }, icon: { padding: spacing.sm }, title: { flex: 1, color: colors.text, fontSize: typography.size.md, fontWeight: typography.weight.bold }, party: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primary, borderRadius: spacing.radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, partyText: { color: colors.text, fontWeight: typography.weight.bold, fontSize: typography.size.xs }, loading: { color: colors.textSecondary }, error: { color: colors.danger, textAlign: 'center' }, action: { color: colors.primary, fontWeight: typography.weight.bold }, errorBanner: { position: 'absolute', bottom: 20, alignSelf: 'center', backgroundColor: colors.danger, color: colors.text, padding: spacing.md, borderRadius: spacing.radius.md },
});
