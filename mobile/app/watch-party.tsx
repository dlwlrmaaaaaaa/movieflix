import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Users } from 'lucide-react-native';
import { useRoom } from '../src/context/RoomContext';
import { Button } from '../src/components/ui/Button';

export default function WatchPartyHome() {
 const router = useRouter(); const { room, createRoom } = useRoom(); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
 const create = async () => { try { setBusy(true); const next = await createRoom(); router.push(`/room/${next.code}` as any); } catch (failure: any) { setError(failure.message); } finally { setBusy(false); } };
 return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.content}>
  <Text style={styles.brand}>AnnahFlix / WATCH PARTY</Text><Users color="#e50914" size={37} /><Text style={styles.title}>Your movie.
Your people.</Text><Text style={styles.description}>A separate space for watching together. Choose a movie, invite someone, or join a night already in progress.</Text>
  {room && room.status !== 'ENDED' ? <Button title={`Return to room ${room.code}`} onPress={() => router.push(`/room/${room.code}` as any)} /> : null}
  <Button title="Choose a movie for your party" onPress={() => router.push('/(main)/home?view=movies' as any)} /><Button title="Join Party" variant="secondary" onPress={() => router.push('/join' as any)} /><Button title="Create Room" variant="secondary" onPress={create} loading={busy} disabled={busy} />
  <Text style={styles.note}>Direct players support host playback controls. Iframe parties open the same movie together; their internal timelines remain independent. Screen sharing and chat are available inside your room.</Text>
  <Text style={styles.note}>Prefer Discord? Open Discord separately and use its own sharing controls for content you are permitted to share.</Text>
  {error ? <Text style={{ color: '#ff777e' }}>{error}</Text> : null}<Button title="Back to browsing" variant="ghost" onPress={() => router.replace('/(main)/home')} />
 </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: '#080808' }, content: { maxWidth: 650, width: '100%', alignSelf: 'center', padding: 30, paddingTop: 44, gap: 22 }, brand: { color: '#e50914', fontWeight: '900', fontSize: 17, letterSpacing: 1 }, title: { color: '#fff', fontSize: 46, fontWeight: '800', letterSpacing: -1.5 }, description: { color: '#aaa', fontSize: 16, lineHeight: 25 }, note: { color: '#888', fontSize: 12, lineHeight: 20 } });
