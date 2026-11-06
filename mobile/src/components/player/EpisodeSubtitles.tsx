import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EpisodeSubtitle } from '@togetherflix/shared';

export function useEpisodeSubtitles(tracks: EpisodeSubtitle[], position: number) {
  const [language, setLanguage] = useState('en');
  const [offset, setOffset] = useState(0);
  useEffect(() => { void AsyncStorage.getItem('episode-subtitle-language').then((value) => { if (value) setLanguage(value); }); }, []);
  const choose = (value: string) => { setLanguage(value); void AsyncStorage.setItem('episode-subtitle-language', value); };
  const selected = tracks.find((track) => track.language === language);
  const time = position - offset;
  const text = selected?.cues.filter((cue) => cue.start <= time && cue.end > time).map((cue) => cue.text).join('\n') || '';
  const overlay = text ? <View pointerEvents="none" style={styles.overlay}><Text style={styles.caption}>{text}</Text></View> : null;
  const controls = tracks.length ? <View style={styles.controls}>
    <Text style={styles.label}>Subtitles</Text>
    {[{ language: 'off', label: 'Off' }, ...tracks].map((track) => <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: language === track.language }} key={track.language} onPress={() => choose(track.language)} style={[styles.button, language === track.language && { backgroundColor: '#e50914' }]}><Text style={styles.label}>{track.label}</Text></TouchableOpacity>)}
    {selected ? <><TouchableOpacity onPress={() => setOffset((value) => Math.max(-30, value - 0.5))} style={styles.button}><Text style={styles.label}>−0.5s</Text></TouchableOpacity><Text style={styles.label}>{offset.toFixed(1)}s</Text><TouchableOpacity onPress={() => setOffset((value) => Math.min(30, value + 0.5))} style={styles.button}><Text style={styles.label}>+0.5s</Text></TouchableOpacity></> : null}
  </View> : <Text style={styles.label}>No external subtitles available</Text>;
  return { overlay, controls };
}
const styles = StyleSheet.create({ overlay: { position: 'absolute', left: 18, right: 18, bottom: 65, alignItems: 'center' }, caption: { color: '#fff', fontSize: 18, lineHeight: 26, textAlign: 'center', backgroundColor: '#000b', padding: 5 }, controls: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: 8 }, button: { backgroundColor: '#26262d', borderRadius: 7, padding: 9 }, label: { color: '#ccc', fontSize: 12 } });
