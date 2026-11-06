import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { dramas } from '../../src/services/dramas';
import { SoloVideoPlayer } from '../../src/components/player/SoloVideoPlayer';
import { useEpisodeProgress } from '../../src/hooks/useEpisodeProgress';
import { useEpisodeSubtitles } from '../../src/components/player/EpisodeSubtitles';

export default function EpisodeWatch() {
  const { id } = useLocalSearchParams<{ id: string }>(); const router = useRouter();
  const [position, setPosition] = useState(0); const [ended, setEnded] = useState(false); const [autoNext, setAutoNext] = useState(false); const [error, setError] = useState('');
  const transitioned = useRef(false);
  const playback = useQuery({ queryKey: ['episode-playback', id], queryFn: () => dramas.playback(id), staleTime: 0, retry: false, refetchOnWindowFocus: false });
  const tracks = useQuery({ queryKey: ['episode-subtitles', id], queryFn: () => dramas.subtitles(id) });
  const next = useQuery({ queryKey: ['episode-next', id], queryFn: () => dramas.next(id) });
  const progress = useEpisodeProgress(id, false);
  const subtitles = useEpisodeSubtitles(tracks.data?.subtitles || [], position, `${id}:${playback.data?.movieId || ''}`, { loading: tracks.isPending, error: tracks.error?.message, onRetry: () => { void tracks.refetch(); }, allowNative: Platform.OS === 'android' });
  useEffect(() => { setEnded(false); setError(''); transitioned.current = false; }, [id]);
  useEffect(() => {
    const seconds = playback.data?.expiresInSeconds;
    if (!seconds) return;
    const timer = setTimeout(() => void playback.refetch(), Math.max(1000, (seconds - 30) * 1000));
    return () => clearTimeout(timer);
  }, [playback.dataUpdatedAt]);
  const advance = () => { if (!next.data?.episode || transitioned.current) return; transitioned.current = true; progress.flush(); router.replace(`/episode/${next.data.episode.id}` as any); };
  useEffect(() => { if (ended && autoNext && next.data?.episode) advance(); }, [ended, autoNext, next.data?.episode?.id]);
  const failure = error || playback.error?.message;
  return <SafeAreaView style={{ flex: 1, backgroundColor: '#080808', gap: 12 }}>
    <View style={{ flexDirection: 'row', gap: 15, padding: 15 }}><TouchableOpacity onPress={() => { progress.flush(); router.back(); }}><Text style={{ color: '#fff' }}>← Back</Text></TouchableOpacity><Text style={{ color: '#fff', flex: 1 }}>{playback.data?.drama.title} · {playback.data?.episode.title}</Text></View>
    {failure ? <View style={{ padding: 20, gap: 15 }}><Text accessibilityRole="alert" style={{ color: '#faa' }}>{failure}</Text><TouchableOpacity onPress={() => { setError(''); void playback.refetch(); }}><Text style={{ color: '#fff' }}>Retry</Text></TouchableOpacity></View> : null}
    {!failure && (!playback.data || progress.resume === null) ? <ActivityIndicator color="#e50914" /> : null}
    {playback.data && progress.resume !== null ? <SoloVideoPlayer key={`${id}:${playback.data.playbackUrl}`} uri={playback.data.playbackUrl} initialPosition={position || progress.resume} subtitleOverlay={subtitles.overlay} {...subtitles.playerProps}
      onPosition={(value) => setPosition(value)} onTimeline={progress.timeline} onProgress={progress.flush} onError={setError} onEnded={() => { setEnded(true); progress.flush(); }} /> : null}
    {subtitles.controls}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 15, padding: 15 }}><TouchableOpacity onPress={() => setAutoNext(!autoNext)}><Text style={{ color: '#ccc' }}>Auto next episode: {autoNext ? 'On' : 'Off'}</Text></TouchableOpacity>{next.data?.episode ? <TouchableOpacity onPress={advance}><Text style={{ color: '#fff' }}>Next Episode · S{next.data.episode.seasonNumber}:E{next.data.episode.episodeNumber}</Text></TouchableOpacity> : ended ? <Text style={{ color: '#aaa' }}>No next available episode.</Text> : null}</View>
    {progress.error ? <Text style={{ color: '#faa', padding: 12 }}>{progress.error}</Text> : null}
  </SafeAreaView>;
}
