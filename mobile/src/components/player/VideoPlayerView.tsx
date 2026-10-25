import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { usePlaybackSync } from '../../context/PlaybackSyncContext';
import { useCall } from '../../context/CallContext';
import { useKeepAwake } from 'expo-keep-awake';

interface VideoPlayerViewProps {
  videoUri: string;
  onToggleControls: () => void;
}

export function VideoPlayerView({ videoUri, onToggleControls }: VideoPlayerViewProps) {
  // Keep phone screen awake during movie watching
  useKeepAwake();

  const {
    isPlaying,
    playbackRate,
    seekTarget,
    clearSeekTarget,
    updateLocalPosition,
  } = usePlaybackSync();

  const { movieVolume } = useCall();
  const playerRef = useRef<any>(null);

  const player = useVideoPlayer(videoUri, (p) => {
    p.loop = false;
    p.playbackRate = playbackRate;
    p.volume = movieVolume;
  });

  playerRef.current = player;

  // 1. Sync Play / Pause state
  useEffect(() => {
    if (!player) return;
    if (isPlaying && !player.playing) {
      player.play();
    } else if (!isPlaying && player.playing) {
      player.pause();
    }
  }, [player, isPlaying]);

  // 2. Sync Seek Target
  useEffect(() => {
    if (!player || seekTarget === null) return;
    player.currentTime = seekTarget;
    clearSeekTarget();
  }, [player, seekTarget]);

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
      if (player.playing) {
        updateLocalPosition(player.currentTime, player.duration);
      }
    }, 500);

    return () => clearInterval(timer);
  }, [player]);

  return (
    <TouchableWithoutFeedback onPress={onToggleControls}>
      <View style={styles.container}>
        <VideoView
          player={player}
          style={styles.video}
          contentFit="contain"
          nativeControls={false}
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
  },
});
