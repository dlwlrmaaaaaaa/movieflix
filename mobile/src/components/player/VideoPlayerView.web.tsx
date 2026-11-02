import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { usePlaybackSync } from '../../context/PlaybackSyncContext';
import { useCall } from '../../context/CallContext';
import type { VideoPlayerViewProps } from './VideoPlayerView';

/** Use real media events; Expo Video 1.1's web adapter does not emit statusChange. */
export function VideoPlayerView({ videoUri, onToggleControls, onPlayerState, onPlayerError, tapToFullscreen = false, showFullscreenButton = true, fullscreenOverlay }: VideoPlayerViewProps) {
  const { isPlaying, playbackRate, seekTarget, clearSeekTarget, updateLocalPosition, setBuffering } = usePlaybackSync();
  const { movieVolume } = useCall();
  const element = useRef<HTMLVideoElement | null>(null);
  const frame = useRef<View>(null);
  const [ready, setReady] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const state = useRef('');
  const callbacks = useRef({ onPlayerState, onPlayerError, updateLocalPosition, setBuffering });
  callbacks.current = { onPlayerState, onPlayerError, updateLocalPosition, setBuffering };
  const notify = (next: 'LOADING' | 'BUFFERING' | 'READY' | 'ERROR') => {
    if (state.current === next) return;
    state.current = next;
    callbacks.current.setBuffering(next === 'BUFFERING');
    callbacks.current.onPlayerState?.(next);
  };
  useEffect(() => { setReady(false); state.current = ''; notify('LOADING'); }, [videoUri]);
  useEffect(() => {
    const video = element.current;
    if (!video || !ready || seekTarget === null) return;
    video.currentTime = seekTarget;
    clearSeekTarget();
  }, [ready, seekTarget]);
  useEffect(() => {
    const video = element.current;
    if (!video || !ready || seekTarget !== null) return;
    if (isPlaying) void video.play().then(() => setAutoplayBlocked(false)).catch(() => setAutoplayBlocked(true));
    else video.pause();
  }, [isPlaying, ready, seekTarget]);
  useEffect(() => { if (element.current) element.current.playbackRate = playbackRate; }, [playbackRate]);
  useEffect(() => { if (element.current) element.current.volume = movieVolume; }, [movieVolume]);
  useEffect(() => {
    const timer = setInterval(() => {
      const video = element.current;
      if (video) callbacks.current.updateLocalPosition(video.currentTime, Number.isFinite(video.duration) ? video.duration : 0);
    }, 500);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const changed = () => setFullscreen(document.fullscreenElement === (frame.current as unknown as Element));
    document.addEventListener('fullscreenchange', changed);
    return () => document.removeEventListener('fullscreenchange', changed);
  }, []);
  const openFullscreen = () => {
    const target = frame.current as unknown as HTMLElement;
    void target?.requestFullscreen?.().catch(() => callbacks.current.onPlayerError?.('Fullscreen is unavailable in this browser.'));
  };
  const tap = () => {
    if (isPlaying) void element.current?.play().then(() => setAutoplayBlocked(false)).catch(() => setAutoplayBlocked(true));
    if (tapToFullscreen) openFullscreen(); else onToggleControls();
  };
  return <View ref={frame} style={styles.frame}>
    {React.createElement('video', {
      ref: element, src: videoUri, preload: 'auto', playsInline: true,
      controls: false, disablePictureInPicture: true, tabIndex: -1,
      onClick: tap, onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
      onCanPlay: () => { setReady(true); notify('READY'); },
      onWaiting: () => notify(isPlaying ? 'BUFFERING' : 'LOADING'),
      onPlaying: () => { setAutoplayBlocked(false); notify('READY'); },
      onError: () => { notify('ERROR'); callbacks.current.onPlayerError?.('The movie source could not be loaded.'); },
      style: { width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#000' },
    })}
    {autoplayBlocked ? <View pointerEvents="none" style={styles.autoplay}><Text style={styles.text}>Tap the video to allow playback.</Text></View> : null}
    {showFullscreenButton && !fullscreen ? <TouchableOpacity accessibilityLabel="Fullscreen video" style={styles.button} onPress={openFullscreen}><Text style={styles.text}>Fullscreen</Text></TouchableOpacity> : null}
    {fullscreen ? <View style={styles.microphone}>{fullscreenOverlay}</View> : null}
  </View>;
}

const styles = StyleSheet.create({ frame: { flex: 1, width: '100%', height: '100%', backgroundColor: '#000' }, text: { color: '#fff' }, autoplay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' }, button: { position: 'absolute', right: 12, top: 12, padding: 10, backgroundColor: '#222c', borderRadius: 8 }, microphone: { position: 'absolute', right: 20, bottom: 24 } });
