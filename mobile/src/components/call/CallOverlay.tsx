import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  User as UserIcon,
} from 'lucide-react-native';
import { colors, typography, spacing } from '../../theme';
import { useCall } from '../../context/CallContext';
import { useRoom } from '../../context/RoomContext';

export function CallOverlay() {
  const { isCallActive, isMuted, isVideoEnabled, toggleMute, toggleVideo } = useCall();
  const { partner } = useRoom();

  if (!isCallActive) return null;

  return (
    <View style={styles.floatingContainer}>
      {/* Partner Video / Avatar Preview */}
      <View style={styles.partnerBubble}>
        <View style={styles.avatarPlaceholder}>
          <UserIcon size={24} color={colors.primary} />
        </View>
        <Text style={styles.partnerName} numberOfLines={1}>
          {partner?.displayName || 'Partner'}
        </Text>
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>CALL</Text>
        </View>
      </View>

      {/* Floating Call Action Controls */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.callBtn, isMuted && styles.callBtnActive]}
          onPress={toggleMute}
          activeOpacity={0.7}
        >
          {isMuted ? (
            <MicOff size={16} color={colors.danger} />
          ) : (
            <Mic size={16} color={colors.text} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.callBtn, !isVideoEnabled && styles.callBtnActive]}
          onPress={toggleVideo}
          activeOpacity={0.7}
        >
          {isVideoEnabled ? (
            <VideoIcon size={16} color={colors.text} />
          ) : (
            <VideoOff size={16} color={colors.textSecondary} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    zIndex: 99,
    alignItems: 'center',
    gap: spacing.xs,
  },
  partnerBubble: {
    width: 90,
    height: 110,
    borderRadius: spacing.radius.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  partnerName: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.text,
    textAlign: 'center',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.success,
  },
  liveText: {
    fontSize: 9,
    color: colors.success,
    fontWeight: typography.weight.bold,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  callBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.overlayGlass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callBtnActive: {
    backgroundColor: colors.surfaceElevated,
  },
});
