import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EpisodeSubtitle } from '@togetherflix/shared';
import { useAuth } from '../../context/AuthContext';
import { activeSubtitleText, subtitleLabel, subtitleLanguageMatches } from '../../services/subtitleTracks';
import type { PlayerSubtitleState, SubtitlePlayerProps } from '../../services/subtitleTracks';

const EMPTY_TRACKS: EpisodeSubtitle[] = [];
export function useEpisodeSubtitles(externalTracks: EpisodeSubtitle[] = EMPTY_TRACKS, position: number, sourceKey = '', options: { loading?: boolean; error?: string; onRetry?: () => void; allowNative?: boolean } = {}) {
  const { user } = useAuth();
  const storageKey = `subtitle-language:${user?.id || 'anonymous'}`;
  const [preference, setPreference] = useState('en');
  const [hydrated, setHydrated] = useState(false);
  const [offset, setOffset] = useState(0);
  const [native, setNative] = useState<{ key: string; state: PlayerSubtitleState }>({ key: sourceKey, state: { supported: false, tracks: [] } });
  const [explicit, setExplicit] = useState<{ key: string; id: string } | null>(null);
  const interacted = useRef(false);
  useEffect(() => {
    let active = true; interacted.current = false; setHydrated(false); setExplicit(null);
    void AsyncStorage.getItem(storageKey).then((value) => { if (active && !interacted.current) setPreference(value || 'en'); }).catch(() => undefined).finally(() => { if (active) setHydrated(true); });
    return () => { active = false; };
  }, [storageKey]);
  useEffect(() => { setOffset(0); }, [sourceKey]);
  const nativeState = native.key === sourceKey ? native.state : { supported: false, tracks: [] };
  const tracks = useMemo(() => [
    ...externalTracks.map((track) => ({ id: `external:${track.id}`, language: track.language, label: subtitleLabel(track.language, track.label), format: 'WebVTT', kind: 'external' as const, external: track })),
    ...nativeState.tracks.map((track) => ({ ...track, id: `native:${track.id}`, label: subtitleLabel(track.language, track.label), kind: 'native' as const, external: undefined })),
  ], [externalTracks, nativeState.tracks]);
  const chosenId = explicit?.key === sourceKey ? explicit.id : null;
  const selected = preference === 'off' ? undefined : tracks.find((track) => track.id === chosenId) || tracks.find((track) => subtitleLanguageMatches(track.language, preference)) || tracks.find((track) => track.kind === 'native' && 'selected' in track && track.selected);
  const text = hydrated && selected?.external ? activeSubtitleText(selected.external.cues || [], position, offset) : '';
  const onSubtitleTracks = useCallback((state: PlayerSubtitleState) => { setNative((current) => current.key === sourceKey && JSON.stringify(current.state) === JSON.stringify(state) ? current : { key: sourceKey, state }); }, [sourceKey]);
  const nativeSubtitleId = !hydrated ? undefined : selected?.kind === 'native' ? selected.id.slice('native:'.length) : selected?.kind === 'external' || preference === 'off' ? null : undefined;
  const playerProps: SubtitlePlayerProps = { nativeSubtitleId, onSubtitleTracks };
  const choose = (id: string) => {
    const track = tracks.find((item) => item.id === id); const language = id === 'off' ? 'off' : track?.language || 'en';
    interacted.current = true; setHydrated(true); setExplicit({ key: sourceKey, id }); setPreference(language);
    void AsyncStorage.setItem(storageKey, language).catch(() => undefined);
  };
  const overlay = text ? <View pointerEvents="none" style={styles.overlay}><Text style={styles.caption}>{text}</Text></View> : null;
  const controls = <View style={styles.controls}>
    <Text style={styles.label}>Subtitles</Text>
    {tracks.length ? <>
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: preference === 'off' }} onPress={() => choose('off')} style={[styles.button, preference === 'off' && { backgroundColor: '#e50914' }]}><Text style={styles.label}>Off</Text></TouchableOpacity>
      {tracks.map((track) => <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${track.label}, ${track.format}`} accessibilityState={{ selected: selected?.id === track.id }} key={track.id} onPress={() => choose(track.id)} style={[styles.button, selected?.id === track.id && { backgroundColor: '#e50914' }]}><Text style={styles.label}>{track.label}{tracks.filter((item) => item.language === track.language).length > 1 ? ` (${track.kind === 'external' ? 'file' : 'stream'})` : ''}</Text></TouchableOpacity>)}
      {selected?.kind === 'external' ? <><TouchableOpacity accessibilityLabel="Show subtitles half a second earlier" onPress={() => setOffset((value) => Math.max(-30, value - 0.5))} style={styles.button}><Text style={styles.label}>−0.5s</Text></TouchableOpacity><Text style={styles.label}>{offset.toFixed(1)}s</Text><TouchableOpacity accessibilityLabel="Show subtitles half a second later" onPress={() => setOffset((value) => Math.min(30, value + 0.5))} style={styles.button}><Text style={styles.label}>+0.5s</Text></TouchableOpacity></> : null}
    </> : <Text style={styles.label}>{options.loading ? 'Loading subtitle files…' : nativeState.supported ? 'No subtitles available for this source.' : 'No external subtitle files are available.'}</Text>}
    {options.error ? <TouchableOpacity accessibilityRole="button" onPress={options.onRetry}><Text style={{ color: '#faa' }}>Subtitle files could not load. Tap to retry.</Text></TouchableOpacity> : null}
    {options.allowNative !== false && nativeState.supported === false ? <Text style={styles.label}>Additional stream subtitle controls require the updated Android app.</Text> : null}
  </View>;
  return { overlay, controls, playerProps, selectedTrackId: selected?.id || null };
}
const styles = StyleSheet.create({ overlay: { position: 'absolute', left: 18, right: 18, bottom: 65, alignItems: 'center' }, caption: { color: '#fff', fontSize: 18, lineHeight: 26, textAlign: 'center', backgroundColor: '#000b', padding: 5 }, controls: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: 8 }, button: { backgroundColor: '#26262d', borderRadius: 7, padding: 9 }, label: { color: '#ccc', fontSize: 12 } });
