import React, { useState } from 'react';
import { Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import type { EpisodeSummary } from '@togetherflix/shared';
import { dramas } from '../../services/dramas';
import { api } from '../../services/api';
import { MovieLibraryCard } from './MovieLibraryCard';
import { subtitleLabel } from '../../services/subtitleTracks';

export function EpisodeAdmin({ episode, onSaved }: { episode: EpisodeSummary; onSaved: () => void }) {
  const [open, setOpen] = useState(false); const [url, setUrl] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false); const [language, setLanguage] = useState('en');
  const [subtitleUrl, setSubtitleUrl] = useState('');
  const work = async (action: () => Promise<unknown>) => { setBusy(true); setMessage(''); try { await action(); setMessage('Saved.'); onSaved(); } catch (error: any) { setMessage(error.message); } finally { setBusy(false); } };
  const subtitle = async () => {
    const file = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (file.canceled || !file.assets[0]) return;
    const asset = file.assets[0];
    if (!/\.(srt|vtt)$/i.test(asset.name) || (asset.size || 0) > 1024 * 1024) throw new Error('Choose a UTF-8 .srt or .vtt file up to 1 MB.');
    const text = Platform.OS === 'web' ? await (await fetch(asset.uri)).text() : await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
    if (asset.mimeType && !['text/vtt', 'application/x-subrip', 'application/srt', 'text/srt', 'text/plain', 'application/octet-stream'].includes(asset.mimeType.split(';')[0].toLowerCase())) throw new Error('Select a plain VTT or SRT subtitle file.');
    await dramas.addSubtitle(episode.id, language, subtitleLabel(language), text);
  };
  return <View style={{ gap: 10 }}><TouchableOpacity onPress={() => setOpen(!open)}><Text style={{ color: '#e77' }}>{open ? 'Close episode management' : 'Manage episode source & subtitles'}</Text></TouchableOpacity>{open ? <>
    <Text style={{ color: '#aaa' }}>Add an authorized stream, or upload/import below and assign its validated library entry.</Text>
    <TextInput value={url} onChangeText={setUrl} autoCapitalize="none" placeholder="Authorized MP4 / HLS / DASH URL" placeholderTextColor="#888" style={{ color: '#fff', padding: 12, backgroundColor: '#25252b' }} />
    <TouchableOpacity disabled={busy} onPress={() => void work(async () => { const { movie } = await api.movies.createStream({ title: `S${episode.seasonNumber} E${episode.episodeNumber} · ${episode.title}`, streamingUrl: url, streamingFormat: 'AUTO' }); await dramas.attach(episode.id, movie.id); })}><Text style={{ color: '#fff' }}>Validate stream & assign</Text></TouchableOpacity>
    <MovieLibraryCard isAdmin onSelect={async (movie) => { await work(() => dramas.attach(episode.id, movie.id)); }} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{['en', 'fil', 'ko', 'zh-Hans', 'zh-Hant'].map((value) => <TouchableOpacity key={value} onPress={() => setLanguage(value)}><Text style={{ color: value === language ? '#fff' : '#777' }}>{subtitleLabel(value)}</Text></TouchableOpacity>)}</View>
    <TextInput accessibilityLabel="Subtitle language code" value={language} onChangeText={setLanguage} autoCapitalize="none" placeholder="Language code, e.g. en, fil, ja" placeholderTextColor="#888" style={{ color: '#fff', padding: 12, backgroundColor: '#25252b' }} />
    <TouchableOpacity disabled={busy} onPress={() => void work(subtitle)}><Text style={{ color: '#fff' }}>Choose authorized .srt / .vtt subtitles</Text></TouchableOpacity>
    <TextInput accessibilityLabel="Direct subtitle file URL" value={subtitleUrl} onChangeText={setSubtitleUrl} autoCapitalize="none" autoCorrect={false} placeholder="Direct authorized .vtt / .srt URL" placeholderTextColor="#888" style={{ color: '#fff', padding: 12, backgroundColor: '#25252b' }} />
    <TouchableOpacity disabled={busy || !subtitleUrl.trim()} onPress={() => void work(() => dramas.importSubtitleUrl(episode.id, language, subtitleLabel(language), subtitleUrl.trim()))}><Text style={{ color: '#fff' }}>Import subtitle URL</Text></TouchableOpacity>
    {message ? <Text accessibilityRole="alert" style={{ color: '#faa' }}>{message}</Text> : null}
  </> : null}</View>;
}
