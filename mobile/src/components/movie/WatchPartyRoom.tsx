import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Image, Platform, StatusBar, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LogOut, Maximize, Mic, MicOff } from 'lucide-react-native';
import { useRoom } from '../../context/RoomContext';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { useSocket } from '../../context/SocketContext';
import { usePlaybackSync } from '../../context/PlaybackSyncContext';
import { EmbeddedPlayerDescriptor } from '@togetherflix/shared';
import { EmbeddedVideoPlayer } from '../player/EmbeddedVideoPlayer';
import { socketService } from '../../services/socket';
import { api } from '../../services/api';
import { copyPartyText, partyInviteUrl } from '../../services/partyInvite';
import { WatchPartyTools } from './WatchPartyTools';
import { ScreenSharePlayer } from '../player/ScreenSharePlayer';
import { SoloVideoPlayer } from '../player/SoloVideoPlayer';
import { VideoPlayerView } from '../player/VideoPlayerView';
import { Button } from '../ui/Button';
import { dramas } from '../../services/dramas';
import { useEpisodeProgress } from '../../hooks/useEpisodeProgress';
import { useEpisodeSubtitles } from '../player/EpisodeSubtitles';
import { useQuery } from '@tanstack/react-query';
import { colors } from '../../theme';

export function WatchPartyRoom() {
  const { room, isHost, selectedMovie, reportViewerState, allViewersReady, viewerReadyCount, leaveRoom, setRoom } = useRoom();
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const { isPlaying, isBuffering, isCountingDown, play, pause, seek, position, duration } = usePlaybackSync();
  const { isMuted, toggleMute, isCallActive, isConnecting, callError, joinCall, leaveCall } = useCall();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [playerState, setPlayerState] = useState('LOADING');
  const [embed, setEmbed] = useState<EmbeddedPlayerDescriptor | null>(null);
  const [launchReady, setLaunchReady] = useState(false);
  const [embedLoaded, setEmbedLoaded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const frame = useRef<View>(null);
  const selection = room!.catalogSelection!;
  const code = room!.code;
  const episodeId = selection.episodeId;
  const episodeProgress = useEpisodeProgress(episodeId);
  const tracks = useQuery({ queryKey: ['episode-subtitles', episodeId], queryFn: () => dramas.subtitles(episodeId!), enabled: !!episodeId });
  const subtitles = useEpisodeSubtitles(tracks.data?.subtitles || [], position, room!.selectedMovie?.id || '', { loading: tracks.isPending && !!episodeId, error: tracks.error?.message, onRetry: () => { void tracks.refetch(); }, allowNative: Platform.OS === 'android' && selection.playerType === 'direct' });
  const nextEpisode = useQuery({ queryKey: ['party-next', code, episodeId], queryFn: () => dramas.roomNext(code), enabled: !!episodeId });
  const [autoNext, setAutoNext] = useState(false);
  const [episodeEnded, setEpisodeEnded] = useState(false);
  const transition = useRef(false);
  const pendingStart = useRef<string | null>(null);
  useEffect(() => { setEpisodeEnded(false); transition.current = false; setError(''); }, [episodeId]);
  useEffect(() => { if (!isPlaying && episodeId) episodeProgress.flush(); }, [isPlaying, episodeId]);
  const advanceEpisode = async (ended = false) => {
    if (!room || !isHost || !nextEpisode.data?.episode || transition.current) return;
    transition.current = true;
    try {
      episodeProgress.flush();
      const result = await dramas.select(room, nextEpisode.data.episode.id, ended);
      pendingStart.current = ended ? result.room.selectedMovie?.id || null : null;
      setRoom(result.room);
    } catch (failure: any) { setError(failure.message); transition.current = false; }
  };
  useEffect(() => { if (episodeEnded && autoNext && isHost) void advanceEpisode(true); }, [episodeEnded, autoNext]);
  useEffect(() => {
    if (pendingStart.current && room?.selectedMovie?.id === pendingStart.current && allViewersReady && room.guestId && isConnected) {
      pendingStart.current = null;
      play();
    }
  }, [room?.selectedMovie?.id, allViewersReady, isConnected]);
  const supported = selection.playerType === 'direct' && room!.playbackMode === 'DIRECT';
  const iframe = selection.playerType === 'iframe';
  const sharing = room!.playbackMode === 'SCREEN_SHARE';
  const canLoadEmbed = iframe && (isHost || (launchReady && !sharing));
  useEffect(() => {
    setLaunchReady(false);
    if (!selection.launchAt) return;
    const timer = setTimeout(() => setLaunchReady(true), Math.max(0, selection.launchAt - socketService.getEstimatedServerTime()));
    return () => clearTimeout(timer);
  }, [code, selection.launchAt]);
  useEffect(() => {
    if (!canLoadEmbed) return;
    let active = true; setError(''); setEmbedLoaded(false);
    api.rooms.embed(code, Platform.OS === 'web' ? 'web' : 'mobile').then((result) => { if (active) setEmbed(result.player); }).catch((failure) => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [canLoadEmbed, code, selection.providerId]);
  useEffect(() => {
    if (!fullscreen) return;
    if (Platform.OS === 'web') {
      const changed = () => { if (!document.fullscreenElement) setFullscreen(false); };
      document.addEventListener('fullscreenchange', changed); return () => document.removeEventListener('fullscreenchange', changed);
    }
    const back = BackHandler.addEventListener('hardwareBackPress', () => { setFullscreen(false); return true; });
    return () => back.remove();
  }, [fullscreen]);

  useEffect(() => {
    if (!socket || !supported) return;
    const restore = () => reportViewerState(playerState as 'LOADING' | 'BUFFERING' | 'READY' | 'ERROR');
    socket.on('connect', restore);
    return () => { socket.off('connect', restore); };
  }, [socket, supported, playerState, reportViewerState]);

  async function action(work: () => Promise<void>) {
    setBusy(true); setError('');
    try { await work(); } catch (failure: any) { setError(failure.message || 'Unable to complete this action.'); }
    finally { setBusy(false); }
  }
  const microphone = () => action(async () => {
    if (!isCallActive) await joinCall(code);
    await toggleMute();
  });
  const copy = (text: string) => action(async () => { const copied = await copyPartyText(text); setNotice(copied ? 'Copied.' : 'Use the share sheet to copy or send.'); });
  const leave = () => action(async () => { await leaveCall(); await leaveRoom(); router.replace('/(main)/home'); });
  const mic = <TouchableOpacity accessibilityRole="button" accessibilityLabel={!isCallActive || isMuted ? 'Unmute microphone' : 'Mute microphone'} accessibilityState={{ disabled: busy || isConnecting }} disabled={busy || isConnecting} style={styles.mic} onPress={microphone}>{isConnecting ? <ActivityIndicator color="#fff" /> : !isCallActive || isMuted ? <MicOff color="#fff" size={23} /> : <Mic color="#fff" size={23} />}</TouchableOpacity>;
  const startMovie = () => action(async () => {
    const result = await api.rooms.startMovie(code);
    setRoom((current) => current?.code === code ? result.room : current);
  });
  const openFullscreen = () => {
    if (Platform.OS === 'web') {
      const element = frame.current as unknown as HTMLElement;
      void element?.requestFullscreen?.().then(() => setFullscreen(true)).catch(() => setError('Fullscreen is unavailable in this browser.'));
    } else setFullscreen(true);
  };
  const waiting = !isPlaying && !isCountingDown;
  const status = sharing ? 'Host screen share / WebRTC' : iframe ? selection.launchAt ? 'Players opened together - playback controls are independent' : isHost ? room!.guestId ? 'Ready to open the movie for everyone' : 'Waiting for your guest to join' : 'Waiting for the host to start the movie' : !isConnected ? 'Reconnecting to the room...' : isBuffering || playerState === 'BUFFERING' ? 'Buffering...' : isCountingDown ? 'Starting together...' : isPlaying ? 'Playing with the host' : isHost ? `${viewerReadyCount}/2 viewers ready` : 'Waiting for the host to start the movie';

  return <ScrollView scrollEnabled={!fullscreen} style={styles.page} contentContainerStyle={[styles.content, fullscreen && { padding: 0, paddingTop: 0, gap: 0, height, maxWidth: undefined }]}><StatusBar hidden={fullscreen} />
    <View style={[styles.header, fullscreen && styles.hidden]}><Text style={styles.brand}>ANNAHFLIX <Text style={styles.small}>/ MOVIE NIGHT</Text></Text><TouchableOpacity accessibilityRole="button" accessibilityLabel="Leave Room" onPress={leave} disabled={busy} style={styles.exit}><LogOut color="#bbb" size={22} /></TouchableOpacity></View>
    <View style={[styles.layout, width < 1000 && styles.stacked, fullscreen && { flex: 1, gap: 0 }]}>
      <View style={[styles.main, fullscreen && { gap: 0 }]}>
        <View style={[styles.heading, fullscreen && styles.hidden]}>
          {selection.posterUrl ? <Image source={{ uri: selection.posterUrl }} style={styles.poster} /> : null}
          <View style={{ flex: 1, gap: 6 }}><Text style={styles.title}>{selection.title}</Text><Text style={styles.muted}>{selection.providerName}</Text><Text accessibilityLiveRegion="polite" style={styles.status}>{status}</Text></View>
        </View>
        <View ref={frame} style={[styles.stage, width < 600 && styles.smallStage, fullscreen && { width, height, borderRadius: 0, borderWidth: 0 }]}>
          {sharing && !isHost ? <ScreenSharePlayer /> : sharing && isHost && selectedMovie ? <SoloVideoPlayer uri={selectedMovie.uri} initialPosition={position} onProgress={() => undefined} onError={setError} /> : iframe ? embed && (isHost || launchReady) ? <EmbeddedVideoPlayer key={embed.providerId} url={embed.embedUrl} title={selection.title} allowFullscreen={false} onLoad={() => setEmbedLoaded(true)} onError={setError} /> : <View style={styles.empty}>{selection.launchAt ? <ActivityIndicator color={colors.primary} /> : null}<Text style={styles.waitTitle}>{!isHost && !selection.launchAt ? 'Waiting for the host to start the movie' : 'Loading the movie player...'}</Text></View> : supported && selectedMovie ? <VideoPlayerView {...subtitles.playerProps} key={room!.selectedMovie?.id} subtitleOverlay={episodeId ? subtitles.overlay : null} onTimeline={episodeId ? episodeProgress.timeline : undefined} onEnded={() => { if (episodeId) { episodeProgress.flush(); setEpisodeEnded(true); } }} videoUri={selectedMovie.uri} onToggleControls={() => undefined} tapToFullscreen showFullscreenButton={false} fullscreenOverlay={mic} onPlayerState={(state) => { setPlayerState(state); reportViewerState(state); }} onPlayerError={setError} /> : <View style={styles.empty}><ActivityIndicator color={colors.primary} /><Text style={styles.muted}>Preparing the movie...</Text></View>}
          {iframe && embed && !embedLoaded ? <View pointerEvents="none" style={styles.waiting}><ActivityIndicator color={colors.primary} /><Text style={styles.waitTitle}>Loading the movie player...</Text></View> : null}
          {fullscreen ? <View style={styles.fullscreenMic}>{mic}</View> : null}
          {supported && (waiting || isCountingDown || playerState === 'ERROR') ? <View pointerEvents="none" style={styles.waiting}><Text style={styles.waitTitle}>{playerState === 'ERROR' ? 'Movie could not load' : isCountingDown ? 'Starting together...' : isHost ? allViewersReady ? 'Ready for movie night' : 'Preparing both players...' : 'Waiting for the host to start the movie'}</Text><Text style={styles.muted}>{isHost ? 'Start when both viewers are ready.' : 'Playback follows the host automatically.'}</Text></View> : null}
        </View>
        <View style={[styles.controls, fullscreen && styles.hidden]}>
          {supported && isHost ? <><Button title={isPlaying ? 'Pause movie' : 'Start movie'} onPress={isPlaying ? pause : play} disabled={!isConnected || (!isPlaying && !allViewersReady)} /><Button title="-10s" variant="secondary" onPress={() => seek(Math.max(0, position - 10))} disabled={!isConnected} /><Button title="+10s" variant="secondary" onPress={() => seek(Math.min(duration || position + 10, position + 10))} disabled={!isConnected} /><Text style={styles.muted}>{Math.floor(position / 60)}:{String(Math.floor(position % 60)).padStart(2, '0')}</Text></> : null}
          {iframe && isHost && !sharing ? <Button title={selection.launchAt ? 'Movie opened' : 'Start movie'} onPress={startMovie} disabled={busy || Boolean(selection.launchAt)} /> : null}
          {iframe && !isHost && launchReady ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Fullscreen movie" style={styles.mic} onPress={openFullscreen}><Maximize color="#fff" size={23} /></TouchableOpacity> : null}
          {mic}
        </View>
        {!iframe && !fullscreen ? subtitles.controls : null}
        {episodeId && !fullscreen ? <View style={{ gap: 12 }}>{isHost ? <View style={styles.controls}><Button title={`Auto next: ${autoNext ? 'On' : 'Off'}`} variant="secondary" onPress={() => setAutoNext(!autoNext)} />{nextEpisode.data?.episode ? <Button title="Next Episode" onPress={() => void advanceEpisode(false)} /> : <Text style={styles.muted}>No next available episode.</Text>}<Button title="Choose episode" variant="secondary" onPress={() => router.push(`/drama/${selection.tmdbId}` as any)} /></View> : null}{episodeProgress.error ? <Text style={styles.error}>{episodeProgress.error}</Text> : null}</View> : null}
        {iframe && !fullscreen ? <Text style={styles.help}>The host opens both players together. Press Play inside the player if requested. Iframe pause and seeking remain independent.</Text> : null}
        {supported && !fullscreen ? <Text style={styles.help}>Tap the video for fullscreen. {isHost ? 'You control playback.' : 'Only the host can pause or seek.'}</Text> : null}
        {error || callError ? <Text accessibilityRole="alert" style={styles.error}>{error || callError}</Text> : null}
      </View>
      {isHost && !fullscreen ? <View style={[styles.sidebar, width < 1000 && styles.sidebarWide]}>
        <View style={styles.card}><Text style={styles.small}>INVITE A FRIEND</Text><Text selectable style={styles.code}>{code}</Text><Text selectable style={styles.link}>{partyInviteUrl(code)}</Text><Button title="Copy Invite Link" onPress={() => copy(partyInviteUrl(code))} disabled={busy} /><Button title="Copy Room Code" variant="secondary" onPress={() => copy(code)} disabled={busy} />{notice ? <Text style={styles.status}>{notice}</Text> : null}</View>
        <View style={styles.card}><Text style={styles.section}>Participants - {room!.participants.length}/2</Text>{room!.participants.map((participant) => <View key={participant.id} style={styles.participant}><Text style={styles.name}>{participant.displayName}{participant.id === user?.id ? ' (You)' : ''}</Text><Text style={styles.muted}>{participant.isHost ? 'Host' : 'Guest'} - {participant.isConnected ? participant.readinessState || 'In room' : 'Reconnecting'}</Text></View>)}{!room!.guestId ? <Text style={styles.muted}>Waiting for your friend to join.</Text> : <Button title="Remove Guest" variant="secondary" disabled={busy} onPress={() => action(async () => { await api.rooms.removeGuest(code); })} />}<Text style={styles.help}>Leaving ends this party for everyone.</Text></View>
      </View> : null}
    </View>
    {!fullscreen ? <WatchPartyTools /> : null}
  </ScrollView>;
}

const styles = StyleSheet.create({
  hidden: { display: 'none' }, fullscreenMic: { position: 'absolute', right: 18, bottom: 22 },
  page: { flex: 1, backgroundColor: '#080808' }, content: { padding: 20, paddingTop: 42, gap: 26, maxWidth: 1600, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, brand: { color: '#e50914', fontWeight: '900', fontSize: 20, letterSpacing: 1 }, small: { color: '#aaaab8', fontSize: 10, letterSpacing: 1.5 }, exit: { padding: 12 },
  layout: { flexDirection: 'row', gap: 24 }, stacked: { flexDirection: 'column' }, main: { flex: 1, minWidth: 0, gap: 16 }, sidebar: { width: 310, gap: 16 }, sidebarWide: { width: '100%' },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 16 }, poster: { width: 55, height: 82, borderRadius: 7 }, title: { color: '#fff', fontSize: 27, fontWeight: '800' }, muted: { color: '#aaaab8', fontSize: 12, lineHeight: 19 }, status: { color: '#c3d8c8', fontSize: 12 },
  stage: { height: 470, backgroundColor: '#000', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#292932' }, smallStage: { height: 260 }, empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 25, gap: 12 }, waiting: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0008', justifyContent: 'center', alignItems: 'center', padding: 20, gap: 8 }, waitTitle: { color: '#fff', fontSize: 17, fontWeight: '700', textAlign: 'center' },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' }, mic: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#272732', justifyContent: 'center', alignItems: 'center' }, help: { color: '#888897', fontSize: 11, lineHeight: 17 }, error: { color: '#ff777e', fontSize: 12 },
  card: { backgroundColor: '#17171e', padding: 18, borderRadius: 14, borderWidth: 1, borderColor: '#292932', gap: 12 }, code: { color: '#fff', fontSize: 30, letterSpacing: 4, fontWeight: '800' }, link: { color: '#9999a8', fontSize: 11 }, section: { color: '#fff', fontWeight: '700', fontSize: 16 }, participant: { gap: 4 }, name: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
