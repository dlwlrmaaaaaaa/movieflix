import React from 'react';
import { ScrollView, TouchableOpacity, View, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Header } from '../../src/components/ui/Header';
import { MovieLibraryCard } from '../../src/components/movie/MovieLibraryCard';
import { useAuth } from '../../src/context/AuthContext';
import { colors, spacing, typography } from '../../src/theme';

export default function AdminScreen() {
  const router = useRouter(); const { user } = useAuth();
  if (user?.role !== 'ADMIN') { router.replace('/(main)/home'); return null; }
  return <View style={styles.container}><Header title="Admin Dashboard" subtitle="Upload and manage the shared movie library" showBack onBack={() => router.back()} /><ScrollView contentContainerStyle={styles.content}><TouchableOpacity onPress={() => router.push('/(main)/home?view=tv' as any)}><Text style={{ color: colors.primary }}>Manage drama episodes: search a series, select a season, then Manage episode</Text></TouchableOpacity><Text style={styles.summary}>Movies uploaded here become available to every AnnahFlix user after validation.</Text><MovieLibraryCard isAdmin /></ScrollView></View>;
}
const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: colors.background }, content: { padding: spacing.xl, gap: spacing.lg }, summary: { color: colors.textSecondary, fontSize: typography.size.sm, lineHeight: typography.lineHeight.sm } });
