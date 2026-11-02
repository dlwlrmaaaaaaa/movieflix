import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Maximize, Volume2, VolumeX } from 'lucide-react-native';
import { useCall } from '../../context/CallContext';
import { useRoom } from '../../context/RoomContext';
import { colors, spacing, typography } from '../../theme';

export function ScreenSharePlayer({ emptyMessage }: { emptyMessage?: string }) {
  const {
    screenShareTrack,
    connectionState,
    callError,
    audioPlaybackBlocked,
    resumeAudioPlayback,
    isSharedAudioMuted,
    toggleSharedAudioMute,
  } = useCall();
  const { isHost } = useRoom();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const element = videoRef.current;
    if (!screenShareTrack || !element) return;
    screenShareTrack.attach(element);
    void element.play().catch(() => undefined);
    return () => { screenShareTrack.detach(element); };
  }, [screenShareTrack]);

  if (!screenShareTrack) {
    const title = connectionState === 'reconnecting' ? 'Reconnecting to the shared stream…'
      : connectionState === 'failed' ? 'Unable to connect to the shared stream'
      : connectionState === 'connected' ? 'Waiting for the host to share…'
      : 'Connecting to the watch party…';
    return <View style={styles.empty}>
      {connectionState === 'failed' ? null : <ActivityIndicator color={colors.primary} />}
      <Text style={styles.title}>{emptyMessage || title}</Text>
      <Text style={styles.note}>{callError || 'The stream will appear here when the host starts sharing.'}</Text>
    </View>;
  }

  const requestFullscreen = () => {
    const element = videoRef.current;
    if (element?.requestFullscreen) void element.requestFullscreen();
  };

  return <View style={styles.container}>
    {React.createElement('video', {
      ref: videoRef,
      autoPlay: true,
      playsInline: true,
      muted: isHost,
      style: { width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#000' },
    })}
    <View style={styles.controls}>
      {!isHost ? <TouchableOpacity style={styles.control} onPress={toggleSharedAudioMute}>
        {isSharedAudioMuted ? <VolumeX size={18} color={colors.text} /> : <Volume2 size={18} color={colors.text} />}
        <Text style={styles.controlText}>{isSharedAudioMuted ? 'Unmute' : 'Mute'}</Text>
      </TouchableOpacity> : <Text style={styles.previewLabel}>Local preview</Text>}
      <TouchableOpacity style={styles.control} onPress={requestFullscreen}>
        <Maximize size={18} color={colors.text} />
        <Text style={styles.controlText}>Fullscreen</Text>
      </TouchableOpacity>
    </View>
    {audioPlaybackBlocked && !isHost ? <View style={styles.audioGate}>
      <Text style={styles.title}>Click to play shared audio</Text>
      <TouchableOpacity style={styles.playButton} onPress={() => void resumeAudioPlayback()}><Text style={styles.playText}>Play audio</Text></TouchableOpacity>
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  empty: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', gap: spacing.md, padding: spacing.xl },
  title: { color: colors.text, fontSize: typography.size.md, fontWeight: typography.weight.bold, textAlign: 'center' },
  note: { color: colors.textSecondary, fontSize: typography.size.xs, textAlign: 'center', maxWidth: 420 },
  controls: { position: 'absolute', right: spacing.lg, bottom: spacing.lg, flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  control: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.overlayGlass, borderRadius: spacing.radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  controlText: { color: colors.text, fontSize: typography.size.xs, fontWeight: typography.weight.bold },
  previewLabel: { color: colors.textSecondary, backgroundColor: colors.overlayGlass, borderRadius: spacing.radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: typography.size.xs },
  audioGate: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.65)', gap: spacing.md },
  playButton: { backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: spacing.radius.full },
  playText: { color: colors.text, fontWeight: typography.weight.bold },
});
