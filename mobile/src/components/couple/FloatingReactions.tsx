import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { colors, typography, spacing } from '../../theme';
import { useRoom } from '../../context/RoomContext';

interface FloatingReactionsProps {
  pickerVisible: boolean;
  onClosePicker: () => void;
}

const REACTION_EMOJIS = ['❤️', '😂', '😭', '😮', '🍿', '🔥', '🥰', '🥺'];

export function FloatingReactions({ pickerVisible, onClosePicker }: FloatingReactionsProps) {
  const { activeReactions, sendReaction } = useRoom();

  const handleSelect = (emoji: string) => {
    sendReaction(emoji);
    onClosePicker();
  };

  return (
    <>
      {/* Active Floating Emojis Overlay */}
      <View style={styles.floatingLayer} pointerEvents="none">
        {activeReactions.map((item, idx) => (
          <View
            key={item.id}
            style={[
              styles.floatingBubble,
              {
                right: 30 + ((idx * 35) % 180),
                bottom: 80 + ((idx * 45) % 240),
              },
            ]}
          >
            <Text style={styles.emojiText}>{item.emoji}</Text>
            <Text style={styles.senderLabel}>{item.senderName}</Text>
          </View>
        ))}
      </View>

      {/* Emoji Picker Tray Modal */}
      <Modal visible={pickerVisible} transparent animationType="fade" onRequestClose={onClosePicker}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClosePicker}>
          <View style={styles.pickerContainer}>
            <Text style={styles.pickerTitle}>Send a Quick Reaction 💕</Text>
            <View style={styles.emojiGrid}>
              {REACTION_EMOJIS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.emojiBtn}
                  onPress={() => handleSelect(emoji)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.pickerEmojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floatingLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 90,
  },
  floatingBubble: {
    position: 'absolute',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 20, 32, 0.85)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: spacing.radius.full,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  emojiText: {
    fontSize: 28,
  },
  senderLabel: {
    fontSize: 9,
    color: colors.textSecondary,
    fontWeight: typography.weight.medium,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  pickerContainer: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: spacing.radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  pickerTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
  },
  emojiBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickerEmojiText: {
    fontSize: 24,
  },
});
