import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../../theme';
import { Heart } from 'lucide-react-native';
import { usePlaybackSync } from '../../context/PlaybackSyncContext';

export function CountdownOverlay() {
  const { isCountingDown, countdownNumber } = usePlaybackSync();

  if (!isCountingDown) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Heart size={48} color={colors.primary} fill={colors.primary} style={styles.icon} />
        <Text style={styles.countText}>{countdownNumber}</Text>
        <Text style={styles.subText}>Both ready! Starting movie night in sync... 💕</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 11, 15, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  card: {
    alignItems: 'center',
    padding: spacing.xxl,
  },
  icon: {
    marginBottom: spacing.md,
  },
  countText: {
    fontSize: 84,
    fontWeight: typography.weight.heavy,
    color: colors.primary,
    fontVariant: ['tabular-nums'],
    textShadowColor: colors.primaryGlow,
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 20,
  },
  subText: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
    marginTop: spacing.md,
    textAlign: 'center',
    fontWeight: typography.weight.medium,
  },
});
