import React from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, typography, spacing } from '../../theme';
import { Volume2, Mic, X } from 'lucide-react-native';
import { useCall } from '../../context/CallContext';

interface AudioBalanceModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AudioBalanceModal({ visible, onClose }: AudioBalanceModalProps) {
  const { movieVolume, callVolume, setMovieVolume, setCallVolume } = useCall();

  const volumePresets = [0.2, 0.5, 0.8, 1.0];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Audio & Voice Balance</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Movie Volume Setting */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.iconTitle}>
                <Volume2 size={18} color={colors.primary} />
                <Text style={styles.sectionLabel}>Movie Sound</Text>
              </View>
              <Text style={styles.percentText}>{Math.round(movieVolume * 100)}%</Text>
            </View>
            <View style={styles.presetsRow}>
              {volumePresets.map((val) => (
                <TouchableOpacity
                  key={`movie_${val}`}
                  style={[
                    styles.presetBtn,
                    Math.abs(movieVolume - val) < 0.05 && styles.presetBtnActive,
                  ]}
                  onPress={() => setMovieVolume(val)}
                >
                  <Text
                    style={[
                      styles.presetText,
                      Math.abs(movieVolume - val) < 0.05 && styles.presetTextActive,
                    ]}
                  >
                    {Math.round(val * 100)}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Partner Call Volume Setting */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.iconTitle}>
                <Mic size={18} color={colors.secondary} />
                <Text style={styles.sectionLabel}>Partner Voice</Text>
              </View>
              <Text style={styles.percentText}>{Math.round(callVolume * 100)}%</Text>
            </View>
            <View style={styles.presetsRow}>
              {volumePresets.map((val) => (
                <TouchableOpacity
                  key={`call_${val}`}
                  style={[
                    styles.presetBtn,
                    Math.abs(callVolume - val) < 0.05 && styles.presetBtnActive,
                  ]}
                  onPress={() => setCallVolume(val)}
                >
                  <Text
                    style={[
                      styles.presetText,
                      Math.abs(callVolume - val) < 0.05 && styles.presetTextActive,
                    ]}
                  >
                    {Math.round(val * 100)}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: spacing.radius.xl,
    borderTopRightRadius: spacing.radius.xl,
    padding: spacing.xl,
    borderTopWidth: 1,
    borderColor: colors.borderLight,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.text,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  iconTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionLabel: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    fontWeight: typography.weight.medium,
  },
  percentText: {
    fontSize: typography.size.sm,
    color: colors.text,
    fontWeight: typography.weight.bold,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: spacing.radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetBtnActive: {
    backgroundColor: colors.primaryGlow,
    borderColor: colors.primary,
  },
  presetText: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    fontWeight: typography.weight.semibold,
  },
  presetTextActive: {
    color: colors.primary,
  },
});
