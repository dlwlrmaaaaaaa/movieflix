import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { colors, typography, spacing } from '../../theme';

interface BadgeProps {
  label: string;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral';
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Badge({ label, variant = 'neutral', icon, style }: BadgeProps) {
  const getBadgeStyle = () => {
    switch (variant) {
      case 'success':
        return { bg: colors.successGlow, text: colors.success, border: colors.success };
      case 'warning':
        return { bg: colors.warningGlow, text: colors.warning, border: colors.warning };
      case 'danger':
        return { bg: colors.dangerGlow, text: colors.danger, border: colors.danger };
      case 'purple':
        return { bg: colors.secondaryGlow, text: colors.secondary, border: colors.secondary };
      default:
        return { bg: colors.surfaceElevated, text: colors.textSecondary, border: colors.border };
    }
  };

  const current = getBadgeStyle();

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: current.bg, borderColor: current.border },
        style,
      ]}
    >
      {icon ? <View style={styles.iconContainer}>{icon}</View> : null}
      <Text style={[styles.text, { color: current.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: spacing.radius.full,
    borderWidth: 1,
    gap: 4,
  },
  iconContainer: {
    marginRight: 2,
  },
  text: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
});
