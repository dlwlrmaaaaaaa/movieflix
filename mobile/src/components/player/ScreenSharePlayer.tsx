import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { VideoView } from '@livekit/react-native';
import { useCall } from '../../context/CallContext';
import { colors, spacing, typography } from '../../theme';

export function ScreenSharePlayer({ emptyMessage }: { emptyMessage?: string }) {
  const { screenShareTrack, connectionState, callError, isSharedAudioMuted, toggleSharedAudioMute } = useCall();
  if (!screenShareTrack) {
    const title = connectionState === 'reconnecting' ? 'Reconnecting to the shared stream…'
      : connectionState === 'failed' ? 'Unable to connect to the shared stream'
      : connectionState === 'connected' ? 'Waiting for the host to share…'
      : 'Connecting to the watch party…';
    return <View style={styles.empty}>{connectionState === 'failed' ? null : <ActivityIndicator color={colors.primary} />}<Text style={styles.title}>{emptyMessage || title}</Text><Text style={styles.note}>{callError || 'Shared audio availability depends on Android and the selected app.'}</Text></View>;
  }
  return <View style={styles.container}><VideoView videoTrack={screenShareTrack} style={styles.video} objectFit="contain" /><TouchableOpacity style={styles.audioButton} onPress={toggleSharedAudioMute}><Text style={styles.audioButtonText}>{isSharedAudioMuted ? 'Unmute shared audio' : 'Mute shared audio'}</Text></TouchableOpacity></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  video: { flex: 1, backgroundColor: '#000' },
  empty: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', gap: spacing.md, padding: spacing.xl },
  title: { color: colors.text, fontSize: typography.size.md, fontWeight: typography.weight.bold, textAlign: 'center' },
  note: { color: colors.textSecondary, fontSize: typography.size.xs, textAlign: 'center', maxWidth: 360 },
  audioButton: { position: 'absolute', right: spacing.lg, bottom: spacing.lg, backgroundColor: colors.overlayGlass, borderRadius: spacing.radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  audioButtonText: { color: colors.text, fontSize: typography.size.xs, fontWeight: typography.weight.bold },
});
