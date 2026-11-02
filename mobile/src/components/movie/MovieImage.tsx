import React from 'react';
import { Image, Platform, StyleSheet, View, type StyleProp, type ImageStyle } from 'react-native';

export function tmdbImageSize(uri: string | null | undefined, size: 'w185' | 'w342' | 'w500' | 'w780' | 'w1280'): string | undefined {
  if (!uri) return undefined;
  return uri.replace(/^(https:\/\/image\.tmdb\.org\/t\/p\/)(original|w\d+)(\/)/, `$1${size}$3`);
}

export function MovieImage({ uri, label = '', style, size = 'w342', priority = false }: { uri?: string | null; label?: string; style: StyleProp<ImageStyle>; size?: 'w185' | 'w342' | 'w500' | 'w780' | 'w1280'; priority?: boolean }) {
  const source = tmdbImageSize(uri, size);
  if (!source) return <View accessibilityLabel={label} style={[style, { backgroundColor: '#202020' }]} />;
  if (Platform.OS === 'web') return React.createElement('img', {
    src: source, alt: label, loading: priority ? 'eager' : 'lazy', decoding: 'async',
    fetchPriority: priority ? 'high' : 'auto',
    style: { ...StyleSheet.flatten(style), objectFit: 'cover', display: 'block', backgroundColor: '#202020' },
  });
  return <Image accessibilityLabel={label} source={{ uri: source }} style={style} resizeMode="cover" fadeDuration={160} />;
}
