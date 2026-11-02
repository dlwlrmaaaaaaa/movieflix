import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useKeepAwake } from 'expo-keep-awake';

interface Props {
  uri: string;
  initialPosition?: number;
  onProgress: (positionSeconds: number, durationSeconds: number) => void;
  onPosition?: (positionSeconds: number) => void;
  onError?: (message: string) => void;
}

export function SoloVideoPlayer({ uri, initialPosition = 0, onProgress, onPosition, onError }: Props) {
  useKeepAwake();
  const callbacks = useRef({ onProgress, onPosition, onError });
  callbacks.current = { onProgress, onPosition, onError };
  const latest = useRef({ position: initialPosition, duration: 0 });
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
    if (initialPosition > 0) instance.currentTime = initialPosition;
    instance.play();
  });

  useEffect(() => {
    const listener = ((status: string, error?: { message?: string }) => {
      if (status === 'error') callbacks.current.onError?.(error?.message || 'Unable to play this movie.');
    }) as any;
    const subscription = player.addListener('statusChange', listener);
    return () => subscription.remove();
  }, [player]);

  useEffect(() => {
    const timer = setInterval(() => {
      const position = Math.max(0, player.currentTime || 0);
      const duration = Math.max(0, player.duration || 0);
      latest.current = { position, duration };
      callbacks.current.onPosition?.(position);
      if (duration > 0) callbacks.current.onProgress(position, duration);
    }, 15_000);
    return () => {
      clearInterval(timer);
      const { position, duration } = latest.current;
      if (duration > 0) callbacks.current.onProgress(position, duration);
    };
  }, [player]);

  return <View style={styles.container}><VideoView player={player} style={styles.video} contentFit="contain" nativeControls allowsFullscreen allowsPictureInPicture /></View>;
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#000' }, video: { flex: 1, width: '100%' } });
