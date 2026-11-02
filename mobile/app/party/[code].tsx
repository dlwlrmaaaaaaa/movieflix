import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useRoom } from '../../src/context/RoomContext';
import { colors, spacing } from '../../src/theme';

export default function PartyInviteScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const normalized = String(code || '').trim().toUpperCase();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { joinRoom } = useRoom();
  const [error, setError] = useState('');
  useEffect(() => {
    if (isLoading) return;
    if (!/^TF-[2-9A-HJ-NP-Z]{4}$/.test(normalized)) { setError('This invitation link is invalid.'); return; }
    if (!user) { router.replace(`/(auth)/login?partyCode=${encodeURIComponent(normalized)}` as any); return; }
    let active = true;
    joinRoom(normalized).then(() => { if (active) router.replace(`/room/${normalized}` as any); }).catch((e) => { if (active) setError(e.message || 'Unable to join this watch party.'); });
    return () => { active = false; };
  }, [isLoading, user?.id, normalized]);
  return <SafeAreaView style={styles.container}>{error ? <><Text style={styles.error}>{error}</Text><TouchableOpacity onPress={() => router.replace('/(main)/home')}><Text style={styles.action}>Go home</Text></TouchableOpacity></> : <><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.text}>Joining party {normalized}…</Text></>}</SafeAreaView>;
}
const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl }, text: { color: colors.textSecondary }, error: { color: colors.danger, textAlign: 'center' }, action: { color: colors.primary, fontWeight: '700' } });
