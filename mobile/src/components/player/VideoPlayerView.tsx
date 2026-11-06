import React, { useEffect, useRef, useState } from 'react';
import { View, Modal, Platform, StyleSheet, TouchableWithoutFeedback, TouchableOpacity, Text } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { usePlaybackSync } from '../../context/PlaybackSyncContext';
import { useCall } from '../../context/CallContext';
import { useNativeSubtitleTracks } from '../../hooks/useNativeSubtitleTracks';
import type { SubtitlePlayerProps } from '../../services/subtitleTracks';
import { useKeepAwake } from 'expo-keep-awake';

export interface VideoPlayerViewProps extends SubtitlePlayerProps {
  videoUri: string;
  subtitleOverlay?: React.ReactNode;
  onTimeline?: (position: number, duration: number) => void;
  onEnded?: () => void;
  onToggleControls: () => void;
  onPlayerState?: (state: 'LOADING' | 'BUFFERING' | 'READY' | 'ERROR') => void;
  onPlayerError?: (message: string) => void;
  tapToFullscreen?: boolean;
  showFullscreenButton?: boolean;
  fullscreenOverlay?: React.ReactNode;
}

export function VideoPlayerView({ videoUri, onToggleControls, onPlayerState, onPlayerError, tapToFullscreen = false, showFullscreenButton = true, fullscreenOverlay, subtitleOverlay, onTimeline, onEnded, nativeSubtitleId, onSubtitleTracks }: VideoPlayerViewProps) {
  // Keep phone screen awake during movie watching
  useKeepAwake();

  const {
    isPlaying,
    playbackRate,
    seekTarget,
    clearSeekTarget,
    updateLocalPosition,
    setBuffering,
  } = usePlaybackSync();

  const { movieVolume } = useCall();
  const updatePositionRef = useRef(updateLocalPosition);
  updatePositionRef.current = updateLocalPosition;
  const playerRef = useRef<any>(null);
  const viewRef = useRef<VideoView>(null);
  const containerRef = useRef<View>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [ready, setReady] = useState(false);
  // Parent callbacks intentionally change as room state updates. Keeping them
  // in refs prevents a status listener from being recreated and immediately
  // reporting the same status on every render.
  const onPlayerStateRef = useRef(onPlayerState);
  const onPlayerErrorRef = useRef(onPlayerError);
  onPlayerStateRef.current = onPlayerState;
  onPlayerErrorRef.current = onPlayerError;

  const episodeCallbacks = useRef({ onTimeline, onEnded });
  episodeCallbacks.current = { onTimeline, onEnded };
  const player = useVideoPlayer(videoUri, (p) => {
    p.loop = false;
    p.playbackRate = playbackRate;
    p.volume = movieVolume;
  });

  useNativeSubtitleTracks(player, videoUri, { nativeSubtitleId, onSubtitleTracks });
  playerRef.current = player;

  // Expo Video's readyToPlay state means the native player has enough buffered
  // data to begin. This is the signal sent to the room, rather than a guessed
  // delay after a URL was fetched.
  useEffect(() => {
    if (!player) return;
    const notify = (status: string, _previous?: string, error?: { message?: string } | null) => {
      if (status === 'readyToPlay') {
        setReady(true);
        setBuffering(false);
        onPlayerStateRef.current?.('READY');
      } else if (status === 'loading') {
        setReady(false);
        setBuffering(player.playing);
        onPlayerStateRef.current?.(player.playing ? 'BUFFERING' : 'LOADING');
      }
      else if (status === 'error') {
        setReady(false);
        console.warn('Video player error:', error?.message || 'Unknown video error');
        onPlayerErrorRef.current?.(error?.message || 'Unable to load this video source.');
        onPlayerStateRef.current?.('ERROR');
      }
    };
    notify(player.status);
    const subscription = player.addListener('statusChange', notify as any);
    return () => subscription.remove();
  }, [player, setBuffering]);

  useEffect(() => {
    const subscription = player.addListener('playToEnd', () => episodeCallbacks.current.onEnded?.());
    return () => subscription.remove();
  }, [player]);

  // 1. Sync Play / Pause state
  useEffect(() => {
    if (!player || !ready) return;
    // A scheduled start always sets the position first. Do not let the native
    // player begin decoding at its old position while that seek is pending.
    if (seekTarget !== null) return;
    if (isPlaying && !player.playing) {
      player.play();
    } else if (!isPlaying && player.playing) {
      player.pause();
    }
  }, [player, isPlaying, seekTarget, ready]);

  // 2. Sync Seek Target
  useEffect(() => {
    if (!player || !ready || seekTarget === null) return;
    player.currentTime = seekTarget;
    clearSeekTarget();
  }, [player, seekTarget, ready]);

  // 3. Sync Playback Rate (for subtle drift compensation)
  useEffect(() => {
    if (!player) return;
    player.playbackRate = playbackRate;
  }, [player, playbackRate]);

  // 4. Sync Movie Volume from Ducking Control
  useEffect(() => {
    if (!player) return;
    player.volume = movieVolume;
  }, [player, movieVolume]);

  // 5. Periodic position update to context (every 500ms)
  useEffect(() => {
    if (!player) return;

    const timer = setInterval(() => {
      updatePositionRef.current(player.currentTime, player.duration);
      episodeCallbacks.current.onTimeline?.(player.currentTime, player.duration);
    }, 500);

    return () => clearInterval(timer);
  }, [player]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const changed = () => setFullscreen(document.fullscreenElement === (containerRef.current as unknown as Element));
    document.addEventListener('fullscreenchange', changed);
    return () => document.removeEventListener('fullscreenchange', changed);
  }, []);

  const openFullscreen = () => {
    // A guest gesture can satisfy browser autoplay restrictions, but only plays
    // when the authoritative host state already says to play.
    if (isPlaying) player.play();
    if (Platform.OS === 'web') {
      const element = containerRef.current as unknown as HTMLElement;
      void element?.requestFullscreen?.().catch(() => onPlayerErrorRef.current?.('Fullscreen is unavailable in this browser.'));
    } else setFullscreen(true);
  };
  const video = () => <VideoView ref={viewRef} player={player} style={styles.video} contentFit="contain" nativeControls={false} allowsFullscreen={false} pointerEvents="none" />;
  return <View ref={containerRef} style={styles.container}>
    {Platform.OS === 'web' || !fullscreen ? <TouchableWithoutFeedback accessibilityRole={tapToFullscreen ? 'button' : undefined} accessibilityLabel={tapToFullscreen ? 'Video ? tap for fullscreen' : undefined} onPress={tapToFullscreen ? openFullscreen : onToggleControls}><View style={styles.container}>{video()}{subtitleOverlay}</View></TouchableWithoutFeedback> : null}
    {showFullscreenButton ? <TouchableOpacity accessibilityLabel="Fullscreen video" onPress={openFullscreen} style={styles.fullscreenButton}><Text style={{ color: '#fff' }}>Fullscreen</Text></TouchableOpacity> : null}
    {fullscreen && Platform.OS === 'web' ? <View style={styles.micOverlay}>{fullscreenOverlay}</View> : null}
    {Platform.OS !== 'web' ? <Modal visible={fullscreen} onRequestClose={() => setFullscreen(false)} statusBarTranslucent supportedOrientations={['portrait', 'landscape']}><View style={styles.container}>
      {fullscreen ? <TouchableWithoutFeedback accessibilityLabel="Video ? tap to exit fullscreen" onPress={() => setFullscreen(false)}><View style={styles.container}>{video()}{subtitleOverlay}</View></TouchableWithoutFeedback> : null}
      <View style={styles.micOverlay}>{fullscreenOverlay}</View>
    </View></Modal> : null}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' },
  video: { width: '100%', height: '100%' },
  micOverlay: { position: 'absolute', right: 20, bottom: 24 },
  fullscreenButton: { position: 'absolute', right: 12, top: 12, backgroundColor: '#222c', padding: 10, borderRadius: 8 },
});
