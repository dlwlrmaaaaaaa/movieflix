import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../../theme';
import { CompatibilityReport } from '@togetherflix/shared';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react-native';

interface CompatibilityCardProps {
  report: CompatibilityReport;
}

export function CompatibilityCard({ report }: CompatibilityCardProps) {
  const isPerfect = report.grade === 'PERFECT_MATCH';
  const isWarning = report.grade === 'COMPATIBLE_WARNING';

  const getTheme = () => {
    if (isPerfect) {
      return {
        bg: colors.successGlow,
        border: colors.success,
        text: colors.success,
        title: 'Perfect Match 💕',
        icon: <CheckCircle2 size={20} color={colors.success} />,
      };
    }
    if (isWarning) {
      return {
        bg: colors.warningGlow,
        border: colors.warning,
        text: colors.warning,
        title: 'Minor Duration Difference ⚠️',
        icon: <AlertTriangle size={20} color={colors.warning} />,
      };
    }
    return {
      bg: colors.dangerGlow,
      border: colors.danger,
      text: colors.danger,
      title: 'Potential Mismatch Alert 🚨',
      icon: <XCircle size={20} color={colors.danger} />,
    };
  };

  const theme = getTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, borderColor: theme.border }]}>
      <View style={styles.header}>
        {theme.icon}
        <Text style={[styles.title, { color: theme.text }]}>{theme.title}</Text>
      </View>
      <Text style={styles.message}>{report.message}</Text>
      {report.details ? (
        <View style={styles.detailsBox}>
          <Text style={styles.detailItem}>
            Duration difference: {report.durationDiffSeconds.toFixed(1)}s
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: spacing.radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    marginVertical: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  message: {
    fontSize: typography.size.xs,
    color: colors.text,
    lineHeight: typography.lineHeight.xs,
  },
  detailsBox: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  detailItem: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
  },
});
