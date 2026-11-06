import React, { useMemo } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors, spacing } from '../../theme';
import type { PlayerFailureDetails } from '@togetherflix/shared';

export interface EmbeddedVideoPlayerProps {
  url: string;
  title: string;
  allowFullscreen?: boolean;
  onLoad?: () => void;
  onLoadStart?: () => void;
  onLoadProgress?: (progress: number) => void;
  onError?: (message: string, details?: PlayerFailureDetails) => void;
  onDiagnostic?: (event: { event: 'navigation_blocked'; urlHost?: string }) => void;
}

export function EmbeddedVideoPlayer({ url, title, onLoad, onLoadStart, onLoadProgress, onError, onDiagnostic, allowFullscreen = true }: EmbeddedVideoPlayerProps) {
  const allowedHost = useMemo(() => { try { return new URL(url).hostname; } catch { return ''; } }, [url]);
  if (!allowedHost) return <View style={styles.center}><Text style={styles.error}>Invalid embedded-player URL.</Text></View>;
  return <WebView
    source={{ uri: url }}
    style={styles.player}
    originWhitelist={['https://*']}
    javaScriptEnabled
    domStorageEnabled
    thirdPartyCookiesEnabled
    sharedCookiesEnabled
    allowsFullscreenVideo={allowFullscreen}
    allowsInlineMediaPlayback
    mediaPlaybackRequiresUserAction
    setSupportMultipleWindows={false}
    startInLoadingState
    renderLoading={() => <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /><Text style={styles.loading}>Loading {title}…</Text></View>}
    onLoad={onLoad}
    onLoadStart={onLoadStart}
    onLoadProgress={(event) => onLoadProgress?.(event.nativeEvent.progress)}
    onError={(event) => onError?.(event.nativeEvent.description || 'The embedded player failed to load.', { errorCode: event.nativeEvent.code, url: event.nativeEvent.url })}
    onHttpError={(event) => onError?.(`The embedded player returned HTTP ${event.nativeEvent.statusCode}.`, { statusCode: event.nativeEvent.statusCode, url: event.nativeEvent.url })}
    onRenderProcessGone={Platform.OS === 'android' ? (event) => onError?.(
      event.nativeEvent.didCrash ? 'The Android WebView renderer crashed while loading this player.' : 'Android closed the WebView renderer while loading this player.',
      { url },
    ) : undefined}
    onShouldStartLoadWithRequest={(request) => {
      try {
        const host = new URL(request.url).hostname;
        const allowed = host === allowedHost;
        if (!allowed) onDiagnostic?.({ event: 'navigation_blocked', urlHost: host || undefined });
        return allowed;
      } catch { onDiagnostic?.({ event: 'navigation_blocked' }); return false; }
    }}
  />;
}

const styles = StyleSheet.create({ player: { flex: 1, backgroundColor: '#000' }, center: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', gap: spacing.md }, loading: { color: colors.textSecondary }, error: { color: colors.danger } });
