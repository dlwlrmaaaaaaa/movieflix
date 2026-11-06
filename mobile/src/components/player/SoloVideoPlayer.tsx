import React, { useEffect, useRef, useState } from 'react';
import { AppState, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useNativeSubtitleTracks } from '../../hooks/useNativeSubtitleTracks';
import type { SubtitlePlayerProps } from '../../services/subtitleTracks';
import { useKeepAwake } from 'expo-keep-awake';

export interface SoloVideoPlayerProps extends SubtitlePlayerProps {
  uri: string;
  subtitleOverlay?: React.ReactNode;
  onTimeline?: (position: number, duration: number) => void;
  onEnded?: () => void;
  initialPosition?: number;
  onProgress: (positionSeconds: number, durationSeconds: number) => void;
  onPosition?: (positionSeconds: number) => void;
  onError?: (message: string) => void;
}

export function SoloVideoPlayer({ uri, initialPosition = 0, onProgress, onPosition, onError, onTimeline, onEnded, subtitleOverlay, nativeSubtitleId, onSubtitleTracks }: SoloVideoPlayerProps) {
  useKeepAwake();
  const [fullscreen, setFullscreen] = useState(false);
  const callbacks = useRef({ onProgress, onPosition, onError, onTimeline, onEnded });
  callbacks.current = { onProgress, onPosition, onError, onTimeline, onEnded };
  const latest = useRef({ position: initialPosition, duration: 0 });
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
    if (initialPosition > 0) instance.currentTime = initialPosition;
    instance.play();
  });

  useNativeSubtitleTracks(player, uri, { nativeSubtitleId, onSubtitleTracks });

  useEffect(() => {
    const listener = ((status: string, _previous?: string, error?: { message?: string }) => {
      if (status === 'error') callbacks.current.onError?.(error?.message || 'Unable to play this movie.');
    }) as any;
    const subscription = player.addListener('statusChange', listener);
    return () => subscription.remove();
  }, [player]);

  useEffect(() => {
    let tick = 0;
    const sample = () => {
      const position = Math.max(0, player.currentTime || 0);
      const duration = Math.max(0, player.duration || 0);
      latest.current = { position, duration };
      callbacks.current.onPosition?.(position);
      callbacks.current.onTimeline?.(position, duration);
    };
    const flush = () => { sample(); if (latest.current.duration > 0) callbacks.current.onProgress(latest.current.position, latest.current.duration); };
    const timer = setInterval(() => { sample(); if (++tick % 60 === 0) flush(); }, 250);
    const paused = player.addListener('playingChange', ((playing: boolean) => { if (!playing) flush(); }) as any);
    const ended = player.addListener('playToEnd', () => { flush(); callbacks.current.onEnded?.(); });
    const background = AppState.addEventListener('change', (state) => { if (state !== 'active') flush(); });
    return () => { clearInterval(timer); flush(); paused.remove(); ended.remove(); background.remove(); };
  }, [player]);
  const video = <View style={styles.container}><VideoView player={player} style={styles.video} contentFit="contain" nativeControls allowsFullscreen={false} allowsPictureInPicture={!subtitleOverlay} />{subtitleOverlay}<TouchableOpacity onPress={() => setFullscreen(!fullscreen)} style={{ position: 'absolute', right: 12, top: 12, padding: 10, backgroundColor: '#222c' }}><Text style={{ color: '#fff' }}>{fullscreen ? 'Exit fullscreen' : 'Fullscreen'}</Text></TouchableOpacity></View>;
  return <View style={styles.container}>{!fullscreen ? video : null}<Modal visible={fullscreen} onRequestClose={() => setFullscreen(false)} supportedOrientations={['portrait', 'landscape']}>{fullscreen ? video : null}</Modal></View>;
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#000' }, video: { flex: 1, width: '100%' } });
