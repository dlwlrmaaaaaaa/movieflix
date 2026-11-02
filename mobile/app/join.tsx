import React, { useState } from 'react';
import { SafeAreaView, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Users } from 'lucide-react-native';
import { Input } from '../src/components/ui/Input';
import { Button } from '../src/components/ui/Button';
import { colors, spacing } from '../src/theme';

export default function JoinPartyScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const join = () => {
    const normalized = code.trim().toUpperCase();
    if (!/^TF-[2-9A-HJ-NP-Z]{4}$/.test(normalized)) { setError('Enter a room code such as TF-AB23.'); return; }
    router.push(`/party/${normalized}` as any);
  };
  return <SafeAreaView style={styles.page}><View style={styles.card}>
    <Users size={36} color={colors.primary} /><Text style={styles.title}>A movie night is waiting.</Text>
    <Text style={styles.text}>Enter your invite code. We will load the host?s movie and connect you to their existing party.</Text>
    <Input label="Room code" placeholder="TF-AB23" value={code} onChangeText={(value) => { setCode(value); setError(''); }} autoCapitalize="characters" autoCorrect={false} maxLength={7} onSubmitEditing={join} />
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <Button title="Join Room" onPress={join} /><Button title="Back to Movies" variant="secondary" onPress={() => router.replace('/(main)/home')} />
  </View></SafeAreaView>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: spacing.lg }, card: { width: '100%', maxWidth: 480, backgroundColor: colors.surface, padding: spacing.xl, borderRadius: 20, borderWidth: 1, borderColor: colors.border, gap: 20 }, title: { color: colors.text, fontSize: 30, fontWeight: '800' }, text: { color: colors.textSecondary, lineHeight: 22 }, error: { color: colors.danger } });
