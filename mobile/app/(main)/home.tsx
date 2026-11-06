import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { History, Search, Shield, User, Users } from 'lucide-react-native';
import { useAuth } from '../../src/context/AuthContext';
import { DramaDiscovery } from '../../src/components/movie/DramaDiscovery';
import { UnifiedSearch } from '../../src/components/movie/UnifiedSearch';
import type { SearchCategory } from '@togetherflix/shared';
import { MovieDiscovery } from '../../src/components/movie/MovieDiscovery';

export default function HomeScreen() {
 const router = useRouter(); const { user } = useAuth(); const { view } = useLocalSearchParams<{ view?: string }>(); const { width } = useWindowDimensions();
 return <SafeAreaView edges={['top', 'left', 'right']} style={styles.page}>
  <View style={[styles.nav, width < 700 && { flexWrap: 'wrap' }]}>
   <View style={{ flexDirection: 'row', alignItems: 'center', width: width < 700 ? '100%' : undefined }}><TouchableOpacity accessibilityRole="button" accessibilityLabel="AnnahFlix Home" onPress={() => router.replace('/(main)/home')}><Text style={styles.brand}>AnnahFlix</Text></TouchableOpacity>{width < 700 ? <View style={styles.actions}>{user?.role === 'ADMIN' ? <TouchableOpacity accessibilityLabel="Admin dashboard" onPress={() => router.push('/(main)/admin')}><Shield color="#aaa" size={18} /></TouchableOpacity> : null}<TouchableOpacity accessibilityLabel="Watch history" onPress={() => router.push('/(main)/history')}><History color="#aaa" size={18} /></TouchableOpacity><TouchableOpacity accessibilityLabel="Profile" onPress={() => router.push('/(main)/profile')}><User color="#fff" size={20} /></TouchableOpacity></View> : null}</View>
   <View style={[styles.links, width < 700 && { width: '100%', flex: undefined, paddingTop: 4 }]}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Search movies and dramas" onPress={() => router.setParams({ view: 'search' })}><Search size={18} color={view === 'search' ? '#fff' : '#aaa'} /></TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" style={styles.partyLink} onPress={() => router.push('/watch-party' as any)}><Users color="#aaa" size={17} /><Text style={styles.link}>Watch Party</Text></TouchableOpacity>
   </View>

   {width >= 700 ? <View style={styles.actions}>{user?.role === 'ADMIN' ? <TouchableOpacity accessibilityLabel="Admin dashboard" onPress={() => router.push('/(main)/admin')}><Shield color="#aaa" size={18} /></TouchableOpacity> : null}<TouchableOpacity accessibilityLabel="Watch history" onPress={() => router.push('/(main)/history')}><History color="#aaa" size={18} /></TouchableOpacity><TouchableOpacity accessibilityLabel="Profile" onPress={() => router.push('/(main)/profile')}><User color="#fff" size={20} /></TouchableOpacity></View> : null}
  </View>
  <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
   <UnifiedSearch category={view === 'movies' ? 'movie' : view === 'k-drama' ? 'kdrama' : view === 'c-drama' ? 'cdrama' : view === 'tv' ? 'tv' : 'all'} focusRequested={view === 'search'} onCategoryChange={(category: SearchCategory) => router.setParams({ view: category === 'movie' ? 'movies' : category === 'kdrama' ? 'k-drama' : category === 'cdrama' ? 'c-drama' : category === 'tv' ? 'tv' : '' })}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 35 }}>{!['k-drama', 'c-drama', 'tv'].includes(view || '') ? <MovieDiscovery moviesOnly={view === 'movies'} /> : null}{view !== 'movies' ? <DramaDiscovery category={view === 'k-drama' || view === 'c-drama' || view === 'tv' ? view : undefined} /> : null}</ScrollView>
   </UnifiedSearch>
  </KeyboardAvoidingView>
 </SafeAreaView>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: '#080808' }, nav: { minHeight: 74, paddingVertical: 18, paddingHorizontal: 25, flexDirection: 'row', alignItems: 'center', gap: 26, backgroundColor: '#080808' }, brand: { color: '#E50914', fontSize: 29, fontWeight: '900', letterSpacing: -1.2 }, links: { flex: 1, flexDirection: 'row', gap: 16, flexWrap: 'wrap', alignItems: 'center' }, link: { color: '#a3a3a3', fontSize: 12 }, active: { color: '#fff', fontWeight: '700' }, partyLink: { flexDirection: 'row', alignItems: 'center', gap: 7 }, actions: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 17 } });
