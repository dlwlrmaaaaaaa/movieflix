import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  RefreshCw,
  Volume2,
  MessageCircle,
  Heart,
} from 'lucide-react-native';
import { colors, typography, spacing } from '../../theme';
import { usePlaybackSync } from '../../context/PlaybackSyncContext';
import { useRoom } from '../../context/RoomContext';

interface PlayerControlsProps {
  onOpenChat: () => void;
  onOpenVolume: () => void;
  onOpenReactions: () => void;
}

export function PlayerControls({
  onOpenChat,
  onOpenVolume,
  onOpenReactions,
}: PlayerControlsProps) {
  const { isPlaying, position, duration, driftSeconds, play, pause, seek, requestResync } = usePlaybackSync();
  const { isHost } = useRoom();

  function formatTime(seconds: number): string {
    const s = Math.max(0, Math.floor(seconds));
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;

    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  }

  const progressPercent = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <View style={styles.controlsContainer}>
      {/* Top Bar Status */}
      <View style={styles.topBar}>
        <View style={styles.syncBadge}>
          <View
            style={[
              styles.syncDot,
              { backgroundColor: driftSeconds < 0.5 ? colors.success : colors.warning },
            ]}
          />
          <Text style={styles.syncText}>
            {driftSeconds < 0.5
              ? `In Sync (${(driftSeconds * 1000).toFixed(0)}ms)`
              : `Drift: ${driftSeconds.toFixed(1)}s`}
          </Text>
        </View>

        <View style={styles.topRightActions}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={requestResync}
            activeOpacity={0.7}
          >
            <RefreshCw size={18} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onOpenVolume}
            activeOpacity={0.7}
          >
            <Volume2 size={18} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Center Playback Controls */}
      <View style={styles.centerControls}>
        <TouchableOpacity
          style={styles.seekButton}
          onPress={() => seek(Math.max(0, position - 10))}
          activeOpacity={0.7}
        >
          <RotateCcw size={24} color={colors.text} />
          <Text style={styles.seekLabel}>10s</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.playPauseButton}
          onPress={isPlaying ? pause : play}
          activeOpacity={0.8}
        >
          {isPlaying ? (
            <Pause size={32} color={colors.text} />
          ) : (
            <Play size={32} color={colors.text} style={{ marginLeft: 3 }} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.seekButton}
          onPress={() => seek(position + 10)}
          activeOpacity={0.7}
        >
          <RotateCw size={24} color={colors.text} />
          <Text style={styles.seekLabel}>10s</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom Timeline & Floating Action Triggers */}
      <View style={styles.bottomBar}>
        {/* Progress Bar */}
        <View style={styles.timelineContainer}>
          <View style={styles.timelineTrack}>
            <View style={[styles.timelineFill, { width: `${progressPercent}%` }]} />
          </View>
        </View>

        <View style={styles.bottomRow}>
          <Text style={styles.timeText}>
            {formatTime(position)} / {formatTime(duration)}
          </Text>

          <View style={styles.bottomActions}>
            <TouchableOpacity
              style={styles.actionPill}
              onPress={onOpenReactions}
              activeOpacity={0.7}
            >
              <Heart size={16} color={colors.primary} />
              <Text style={styles.actionPillText}>React</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionPill}
              onPress={onOpenChat}
              activeOpacity={0.7}
            >
              <MessageCircle size={16} color={colors.secondary} />
              <Text style={styles.actionPillText}>Whisper</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  controlsContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.overlayGlass,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: spacing.radius.full,
    gap: 6,
  },
  syncDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  syncText: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    fontWeight: typography.weight.medium,
  },
  topRightActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: spacing.radius.full,
    backgroundColor: colors.overlayGlass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xxl,
  },
  seekButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  seekLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  playPauseButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  bottomBar: {
    gap: spacing.sm,
  },
  timelineContainer: {
    height: 16,
    justifyContent: 'center',
  },
  timelineTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  timelineFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeText: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  bottomActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.overlayGlass,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: spacing.radius.full,
    gap: 6,
  },
  actionPillText: {
    fontSize: typography.size.xs,
    color: colors.text,
    fontWeight: typography.weight.medium,
  },
});
