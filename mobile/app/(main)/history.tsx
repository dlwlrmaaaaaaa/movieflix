import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { colors, typography, spacing } from '../../src/theme';
import { Header } from '../../src/components/ui/Header';
import { Card } from '../../src/components/ui/Card';
import { api } from '../../src/services/api';
import { MovieNightHistoryItem } from '@togetherflix/shared';
import { Film, Calendar, Clock, Heart } from 'lucide-react-native';

export default function HistoryScreen() {
  const [historyItems, setHistoryItems] = useState<MovieNightHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    try {
      setLoading(true);
      const res = await api.history.getAll();
      if (res.success && res.history) {
        setHistoryItems(res.history);
      }
    } catch (e) {
      console.error('Failed to load history:', e);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  return (
    <View style={styles.container}>
      <Header title="Movie Night Diary 💕" showBack />
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={historyItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Card style={styles.historyCard}>
              <View style={styles.cardHeader}>
                <View style={styles.movieIconBox}>
                  <Film size={20} color={colors.primary} />
                </View>
                <View style={styles.movieTitleBox}>
                  <Text style={styles.movieTitle}>{item.movieTitle}</Text>
                  <Text style={styles.partnerText}>with {item.partnerName} 💕</Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Calendar size={14} color={colors.textSecondary} />
                  <Text style={styles.metaText}>{formatDate(item.watchedAt)}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Clock size={14} color={colors.textSecondary} />
                  <Text style={styles.metaText}>{item.durationMinutes} mins</Text>
                </View>
              </View>

              {item.notes ? (
                <Text style={styles.notesText}>"{item.notes}"</Text>
              ) : null}
            </Card>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Heart size={44} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No Movie Nights Yet</Text>
              <Text style={styles.emptySubtitle}>
                Create a room, invite your partner, and start your first cozy movie night together!
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  historyCard: {
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  movieIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  movieTitleBox: {
    flex: 1,
  },
  movieTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.text,
  },
  partnerText: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
  },
  notesText: {
    fontSize: typography.size.xs,
    color: colors.primary,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.huge,
    gap: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xxl,
    lineHeight: typography.lineHeight.sm,
  },
});
