import React, { memo, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Star } from 'lucide-react-native';
import { TmdbMovieSummary } from '@togetherflix/shared';
import { MovieImage } from './MovieImage';
import { colors } from '../../theme';

export const CatalogMovieCard = memo(function CatalogMovieCard({ movie, onPress }: { movie: TmdbMovieSummary; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const hover = (value: number) => Animated.timing(scale, { toValue: value, duration: 140, useNativeDriver: Platform.OS !== 'web' }).start();
  return <Pressable accessibilityRole="button" accessibilityLabel={`View ${movie.title}`} onPress={onPress} onHoverIn={() => hover(1.035)} onHoverOut={() => hover(1)} onPressIn={() => hover(0.98)} onPressOut={() => hover(1)} style={styles.card}>
    <Animated.View style={{ transform: [{ scale }] }}><MovieImage uri={movie.posterUrl} label={movie.title} size="w342" style={styles.poster} /></Animated.View>
    <Text style={styles.title} numberOfLines={1}>{movie.title}</Text>
    <View style={styles.meta}><Text style={styles.year}>{movie.releaseYear || 'Coming soon'}</Text><Star size={11} color={colors.textSecondary} /><Text style={styles.year}>{movie.rating.toFixed(1)}</Text></View>
  </Pressable>;
});
const styles = StyleSheet.create({ card: { width: 152, marginRight: 16, paddingTop: 5, paddingBottom: 8 }, poster: { width: 152, height: 228, borderRadius: 5, backgroundColor: '#202020' }, title: { color: '#fff', fontWeight: '600', fontSize: 13, marginTop: 10 }, meta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 }, year: { color: '#a3a3a3', fontSize: 11 } });
