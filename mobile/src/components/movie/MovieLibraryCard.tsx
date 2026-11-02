import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import { CloudMovie } from '@togetherflix/shared';
import { Film, Link, Pencil, Trash2, Upload } from 'lucide-react-native';
import { api } from '../../services/api';
import { useVideoPicker } from '../../hooks/useVideoPicker';
import { useMovieUpload } from '../../hooks/useMovieUpload';
import { PickedMpdFile, useMpdPicker } from '../../hooks/useMpdPicker';
import { colors, spacing, typography } from '../../theme';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

type StreamFormat = 'AUTO' | 'DASH' | 'HLS' | 'MP4' | 'WEBM';
type StreamDraft = { title: string; description: string; posterUrl: string; streamingUrl: string; streamingFormat: StreamFormat };
const emptyDraft = (): StreamDraft => ({ title: '', description: '', posterUrl: '', streamingUrl: '', streamingFormat: 'AUTO' });
type MpdDraft = { title: string; description: string; posterUrl: string; manifestBaseUrl: string };
const emptyMpdDraft = (): MpdDraft => ({ title: '', description: '', posterUrl: '', manifestBaseUrl: '' });

function StreamForm({ draft, setDraft, submitLabel, submitting, onSubmit, onCancel }: { draft: StreamDraft; setDraft: React.Dispatch<React.SetStateAction<StreamDraft>>; submitLabel: string; submitting: boolean; onSubmit: () => void; onCancel: () => void }) {
  return <View style={styles.streamForm}>
    <TextInput value={draft.title} onChangeText={(title) => setDraft((prev) => ({ ...prev, title }))} placeholder="Movie title *" placeholderTextColor={colors.textMuted} style={styles.input} />
    <TextInput value={draft.streamingUrl} onChangeText={(streamingUrl) => setDraft((prev) => ({ ...prev, streamingUrl }))} placeholder="HTTPS stream URL (.mpd, .m3u8, or .mp4) *" placeholderTextColor={colors.textMuted} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={styles.input} />
    <TextInput value={draft.description} onChangeText={(description) => setDraft((prev) => ({ ...prev, description }))} placeholder="Description (optional)" placeholderTextColor={colors.textMuted} style={styles.input} />
    <TextInput value={draft.posterUrl} onChangeText={(posterUrl) => setDraft((prev) => ({ ...prev, posterUrl }))} placeholder="Poster image URL (optional)" placeholderTextColor={colors.textMuted} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={styles.input} />
    <View style={styles.formatRow}>{(['AUTO', 'DASH', 'HLS', 'MP4', 'WEBM'] as StreamFormat[]).map((format) => <TouchableOpacity key={format} style={[styles.formatPill, draft.streamingFormat === format && styles.formatPillSelected]} onPress={() => setDraft((prev) => ({ ...prev, streamingFormat: format }))}><Text style={[styles.formatText, draft.streamingFormat === format && styles.formatTextSelected]}>{format === 'AUTO' ? 'Auto' : format}</Text></TouchableOpacity>)}</View>
    <View style={styles.formActions}><Button title={submitLabel} size="sm" onPress={onSubmit} loading={submitting} /><Button title="Cancel" variant="ghost" size="sm" onPress={onCancel} disabled={submitting} /></View>
  </View>;
}

function MpdForm({ file, draft, setDraft, submitting, onSubmit, onCancel }: { file: PickedMpdFile; draft: MpdDraft; setDraft: React.Dispatch<React.SetStateAction<MpdDraft>>; submitting: boolean; onSubmit: () => void; onCancel: () => void }) {
  return <View style={styles.streamForm}>
    <Text style={styles.meta}>Selected manifest: {file.name}</Text>
    <TextInput value={draft.title} onChangeText={(title) => setDraft((prev) => ({ ...prev, title }))} placeholder="Movie title *" placeholderTextColor={colors.textMuted} style={styles.input} />
    <TextInput value={draft.manifestBaseUrl} onChangeText={(manifestBaseUrl) => setDraft((prev) => ({ ...prev, manifestBaseUrl }))} placeholder="Original authorized manifest base URL (if needed)" placeholderTextColor={colors.textMuted} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={styles.input} />
    <TextInput value={draft.description} onChangeText={(description) => setDraft((prev) => ({ ...prev, description }))} placeholder="Description (optional)" placeholderTextColor={colors.textMuted} style={styles.input} />
    <TextInput value={draft.posterUrl} onChangeText={(posterUrl) => setDraft((prev) => ({ ...prev, posterUrl }))} placeholder="Poster image URL (optional)" placeholderTextColor={colors.textMuted} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={styles.input} />
    <Text style={styles.meta}>Relative segment URLs require the original authorized base URL. Signed media URLs are not rewritten.</Text>
    <View style={styles.formActions}><Button title="Validate & import MPD" size="sm" onPress={onSubmit} loading={submitting} /><Button title="Cancel" variant="ghost" size="sm" onPress={onCancel} disabled={submitting} /></View>
  </View>;
}

export function MovieLibraryCard({ onSelect, isAdmin }: { onSelect?: (movie: CloudMovie) => Promise<void>; isAdmin: boolean }) {
  const [movies, setMovies] = useState<CloudMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [showStreamForm, setShowStreamForm] = useState(false);
  const [streamDraft, setStreamDraft] = useState<StreamDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingStream, setSavingStream] = useState(false);
  const [mpdFile, setMpdFile] = useState<PickedMpdFile | null>(null);
  const [mpdDraft, setMpdDraft] = useState<MpdDraft>(emptyMpdDraft);
  const [savingMpd, setSavingMpd] = useState(false);
  const { pickVideo, isPicking, error: pickerError } = useVideoPicker();
  const { upload, cancel, progress, uploadingName, error: uploadError } = useMovieUpload();
  const { pickMpd, isPickingMpd, mpdPickerError } = useMpdPicker();
  const refresh = useCallback(async () => { try { const result = await api.movies.list(); setMovies(result.movies); } finally { setLoading(false); } }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const uploadMovie = async () => { const file = await pickVideo(); if (!file) return; try { await upload(file); await refresh(); } catch (error: any) { if (error.message !== 'Upload cancelled.') Alert.alert('Upload failed', error.message || 'Unable to upload this movie.'); } };
  const deleteMovie = (movie: CloudMovie) => Alert.alert('Delete movie?', `${movie.title} will be removed from your private library.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void api.movies.delete(movie.id).then(refresh) }]);
  const select = async (movie: CloudMovie) => { if (!onSelect) return; setSelectingId(movie.id); try { await onSelect(movie); } finally { setSelectingId(null); } };
  const saveStream = async () => {
    if (!streamDraft.title.trim() || !streamDraft.streamingUrl.trim()) { Alert.alert('Missing information', 'Enter a movie title and HTTPS streaming URL.'); return; }
    setSavingStream(true);
    try {
      if (editingId) await api.movies.update(editingId, streamDraft);
      else await api.movies.createStream(streamDraft);
      setShowStreamForm(false); setEditingId(null); setStreamDraft(emptyDraft()); await refresh();
    } catch (error: any) { Alert.alert('Streaming source not saved', error.message || 'Check the source URL and try again.'); } finally { setSavingStream(false); }
  };
  const editStream = (movie: CloudMovie) => { setEditingId(movie.id); setShowStreamForm(true); setStreamDraft({ title: movie.title, description: movie.description || '', posterUrl: movie.posterUrl || '', streamingUrl: '', streamingFormat: movie.streamingFormat || 'AUTO' }); };
  const cancelStream = () => { setShowStreamForm(false); setEditingId(null); setStreamDraft(emptyDraft()); };
  const beginMpdImport = async () => { const file = await pickMpd(); if (!file) return; setShowStreamForm(false); setMpdFile(file); setMpdDraft({ ...emptyMpdDraft(), title: file.name.replace(/\.mpd$/i, '') }); };
  const cancelMpdImport = () => { setMpdFile(null); setMpdDraft(emptyMpdDraft()); };
  const saveMpd = async () => {
    if (!mpdFile || !mpdDraft.title.trim()) { Alert.alert('Missing information', 'Select an MPD file and enter a movie title.'); return; }
    setSavingMpd(true);
    try { await api.movies.importMpd({ ...mpdDraft, originalFilename: mpdFile.name, manifestXml: mpdFile.xml, manifestBaseUrl: mpdDraft.manifestBaseUrl || null }); cancelMpdImport(); await refresh(); }
    catch (error: any) { Alert.alert('MPD import failed', error.message || 'Movie source unavailable.'); } finally { setSavingMpd(false); }
  };
  return <Card style={styles.card}>
    <View style={styles.header}><View style={styles.titleRow}><Film size={21} color={colors.primary} /><Text style={styles.title}>{isAdmin ? 'Manage Movies' : 'Movie Library'}</Text></View>{isAdmin ? <View style={styles.headerActions}><Button title="Add Stream URL" size="sm" variant="secondary" icon={<Link size={15} color={colors.text} />} onPress={() => { cancelMpdImport(); setEditingId(null); setStreamDraft(emptyDraft()); setShowStreamForm((open) => !open); }} /><Button title="Import MPD File" size="sm" variant="secondary" onPress={() => void beginMpdImport()} loading={isPickingMpd} /><Button title="Upload Movie" size="sm" icon={<Upload size={15} color={colors.text} />} onPress={uploadMovie} loading={isPicking} /></View> : null}</View>
    {showStreamForm ? <StreamForm draft={streamDraft} setDraft={setStreamDraft} submitLabel={editingId ? 'Save source' : 'Add streaming movie'} submitting={savingStream} onSubmit={() => void saveStream()} onCancel={cancelStream} /> : null}
    {mpdFile ? <MpdForm file={mpdFile} draft={mpdDraft} setDraft={setMpdDraft} submitting={savingMpd} onSubmit={() => void saveMpd()} onCancel={cancelMpdImport} /> : null}
    {progress !== null ? <View style={styles.upload}><Text style={styles.file}>{uploadingName}</Text><View style={styles.track}><View style={[styles.fill, { width: `${progress}%` }]} /></View><Text style={styles.meta}>Uploading {progress}%</Text><TouchableOpacity onPress={() => void cancel()}><Text style={styles.cancel}>Cancel upload</Text></TouchableOpacity></View> : null}
    {pickerError || uploadError || mpdPickerError ? <Text style={styles.error}>{pickerError || uploadError || mpdPickerError}</Text> : null}
    {!loading && movies.length === 0 ? <Text style={styles.empty}>{isAdmin ? 'No movies yet. Upload a file or add an authorized streaming source.' : 'No movies are available yet.'}</Text> : null}
    {movies.map((movie) => <View key={movie.id} style={styles.movie}>{movie.posterUrl?.startsWith('http') ? <Image source={{ uri: movie.posterUrl }} style={styles.poster} accessibilityLabel={`${movie.title} poster`} /> : null}<View style={styles.movieInfo}><Text style={styles.file} numberOfLines={1}>{movie.title}</Text>{movie.description ? <Text style={styles.meta} numberOfLines={2}>{movie.description}</Text> : null}<Text style={styles.meta}>{movie.sourceType === 'STREAM' ? `Streaming · ${movie.streamingFormat || 'Auto'} · ${movie.status}` : movie.sourceType === 'MANIFEST' ? `Imported MPD · DASH · ${movie.status}` : `${(movie.fileSize / 1048576).toFixed(1)} MB · Uploaded · ${movie.status}`}</Text></View>{movie.status === 'READY' && onSelect ? <Button title="Select" size="sm" onPress={() => select(movie)} loading={selectingId === movie.id} /> : null}{isAdmin && movie.sourceType === 'STREAM' ? <TouchableOpacity accessibilityLabel={`Edit ${movie.title} stream`} onPress={() => editStream(movie)}><Pencil size={18} color={colors.textSecondary} /></TouchableOpacity> : null}{isAdmin ? <TouchableOpacity accessibilityLabel={`Delete ${movie.title}`} onPress={() => deleteMovie(movie)}><Trash2 size={18} color={colors.danger} /></TouchableOpacity> : null}</View>)}
  </Card>;
}
const styles = StyleSheet.create({ card: { gap: spacing.md }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }, headerActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: spacing.xs, flex: 1 }, titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, title: { fontSize: typography.size.md, fontWeight: typography.weight.bold, color: colors.text }, upload: { backgroundColor: colors.surfaceElevated, borderRadius: spacing.radius.md, padding: spacing.sm, gap: spacing.xs }, track: { height: 5, backgroundColor: colors.surfaceHighlight, borderRadius: 3, overflow: 'hidden' }, fill: { height: '100%', backgroundColor: colors.primary }, movie: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight }, poster: { width: 36, height: 52, borderRadius: spacing.radius.sm, backgroundColor: colors.surfaceElevated }, movieInfo: { flex: 1 }, file: { color: colors.text, fontSize: typography.size.sm, fontWeight: typography.weight.semibold }, meta: { color: colors.textSecondary, fontSize: typography.size.xs, marginTop: 2 }, empty: { color: colors.textSecondary, fontSize: typography.size.sm, lineHeight: 20 }, error: { color: colors.danger, fontSize: typography.size.xs }, cancel: { color: colors.danger, fontSize: typography.size.xs, fontWeight: typography.weight.semibold }, streamForm: { gap: spacing.sm, backgroundColor: colors.surfaceElevated, padding: spacing.md, borderRadius: spacing.radius.md }, input: { color: colors.text, borderWidth: 1, borderColor: colors.borderLight, backgroundColor: colors.background, borderRadius: spacing.radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, fontSize: typography.size.sm }, formatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, formatPill: { borderWidth: 1, borderColor: colors.borderLight, borderRadius: spacing.radius.full, paddingHorizontal: spacing.sm, paddingVertical: 5 }, formatPillSelected: { backgroundColor: colors.primary, borderColor: colors.primary }, formatText: { color: colors.textSecondary, fontSize: typography.size.xs }, formatTextSelected: { color: colors.text, fontWeight: typography.weight.bold }, formActions: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' } });
