import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors, spacing } from '../../theme';

export interface EmbeddedVideoPlayerProps {
  url: string;
  title: string;
  allowFullscreen?: boolean;
  onLoad?: () => void;
  onError?: (message: string) => void;
}

export function EmbeddedVideoPlayer({ url, title, onLoad, onError, allowFullscreen = true }: EmbeddedVideoPlayerProps) {
  const allowedHost = useMemo(() => { try { return new URL(url).hostname; } catch { return ''; } }, [url]);
  if (!allowedHost) return <View style={styles.center}><Text style={styles.error}>Invalid embedded-player URL.</Text></View>;
  return <WebView
    source={{ uri: url }}
    style={styles.player}
    originWhitelist={['https://*']}
    javaScriptEnabled
    domStorageEnabled
    allowsFullscreenVideo={allowFullscreen}
    allowsInlineMediaPlayback
    mediaPlaybackRequiresUserAction
    setSupportMultipleWindows={false}
    startInLoadingState
    renderLoading={() => <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /><Text style={styles.loading}>Loading {title}…</Text></View>}
    onLoad={onLoad}
    onError={(event) => onError?.(event.nativeEvent.description || 'The embedded player failed to load.')}
    onHttpError={(event) => onError?.(`The embedded player returned HTTP ${event.nativeEvent.statusCode}.`)}
    onShouldStartLoadWithRequest={(request) => {
      try { return new URL(request.url).hostname === allowedHost; } catch { return false; }
    }}
  />;
}

const styles = StyleSheet.create({ player: { flex: 1, backgroundColor: '#000' }, center: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', gap: spacing.md }, loading: { color: colors.textSecondary }, error: { color: colors.danger } });
