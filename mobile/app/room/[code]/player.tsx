import { useRoomSession } from '../../../src/hooks/useRoomSession';
import { WatchPartyRoom } from '../../../src/components/movie/WatchPartyRoom';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator, Share } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, spacing, typography } from '../../../src/theme';
import { VideoPlayerView } from '../../../src/components/player/VideoPlayerView';
import { ScreenSharePlayer } from '../../../src/components/player/ScreenSharePlayer';
import { PlayerControls } from '../../../src/components/player/PlayerControls';
import { CallOverlay } from '../../../src/components/call/CallOverlay';
import { FloatingReactions } from '../../../src/components/couple/FloatingReactions';
import { WhisperChatSheet } from '../../../src/components/couple/WhisperChatSheet';
import { AudioBalanceModal } from '../../../src/components/call/AudioBalanceModal';
import { ConfirmationModal } from '../../../src/components/ui/ConfirmationModal';
import { useRoom } from '../../../src/context/RoomContext';
import { useCall } from '../../../src/context/CallContext';
import { usePlaybackSync } from '../../../src/context/PlaybackSyncContext';
import { useSocket } from '../../../src/context/SocketContext';
import { ArrowLeft, LogOut, MessageCircle, MonitorOff, RefreshCw, Share2 } from 'lucide-react-native';

function MoviePlayerScreen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { selectedMovie, room, isHost, partner, viewerReadyCount, allViewersReady, reportViewerState, leaveRoom } = useRoom();
  const { leaveCall, isCallActive, isScreenSharing, connectionState, joinCall, stopScreenShare } = useCall();
  const { socket } = useSocket();
  const { isPlaying, isCountingDown, isBuffering, requestResync } = usePlaybackSync();

  const [showControls, setShowControls] = useState<boolean>(true);
  const [chatVisible, setChatVisible] = useState<boolean>(false);
  const [volumeModalVisible, setVolumeModalVisible] = useState<boolean>(false);
  const [reactionsPickerVisible, setReactionsPickerVisible] = useState<boolean>(false);
  const [leaveModalVisible, setLeaveModalVisible] = useState<boolean>(false);
  const [playerState, setPlayerState] = useState<'LOADING' | 'BUFFERING' | 'READY' | 'ERROR'>('LOADING');
  const [playerError, setPlayerError] = useState('');
  const [screenShareEnded, setScreenShareEnded] = useState(false);
  const isScreenMode = room?.playbackMode === 'SCREEN_SHARE';
  const showScreenStream = isScreenMode || screenShareEnded;
  const observedHostShareRef = useRef(false);

  useEffect(() => {
    if (isScreenMode && code && !isCallActive) void joinCall(code).catch(() => undefined);
  }, [isScreenMode, code, isCallActive]);

  useEffect(() => {
    if (!isHost || !isScreenMode) { observedHostShareRef.current = false; return; }
    if (isScreenSharing) observedHostShareRef.current = true;
    else if (observedHostShareRef.current && code) {
      observedHostShareRef.current = false;
      socket?.emit('screen:stop', { roomCode: code });
    }
  }, [isHost, isScreenMode, isScreenSharing, code, socket]);

  const onPlayerState = useCallback((state: 'LOADING' | 'BUFFERING' | 'READY' | 'ERROR') => {
    setPlayerState(state);
    if (state !== 'ERROR') setPlayerError('');
    reportViewerState(state);
  }, [reportViewerState]);

  // A socket reconnect does not recreate Expo Video, so emit the player's last
  // real state again after reconnecting. This changes a persisted
  // DISCONNECTED state back to READY without asking either viewer to reload.
  useEffect(() => {
    if (!socket) return;
    const restoreViewerState = () => reportViewerState(playerState);
    socket.on('connect', restoreViewerState);
    return () => { socket.off('connect', restoreViewerState); };
  }, [socket, playerState, reportViewerState]);

  useEffect(() => {
    if (!socket) return;
    const onScreenStarted = () => setScreenShareEnded(false);
    const onScreenStopped = () => {
      // Embedded rooms have no direct movie URI to fall back to. Keep the
      // viewer on a useful ended state instead of a file-selection error.
      if (!selectedMovie) setScreenShareEnded(true);
    };
    socket.on('screen:started', onScreenStarted);
    socket.on('screen:stopped', onScreenStopped);
    return () => {
      socket.off('screen:started', onScreenStarted);
      socket.off('screen:stopped', onScreenStopped);
    };
  }, [socket, selectedMovie]);

  const handleConfirmLeave = async () => {
    if (isHost && isScreenMode && isScreenSharing && code) {
      observedHostShareRef.current = false;
      await stopScreenShare();
      socket?.emit('screen:stop', { roomCode: code });
    }
    await leaveCall();
    await leaveRoom();
    setLeaveModalVisible(false);
    router.replace('/(main)/home');
  };

  const shareInvite = async () => {
    if (!code) return;
    const publicBaseUrl = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');
    const invitationUrl = publicBaseUrl ? `${publicBaseUrl}/party/${encodeURIComponent(code)}` : `togetherflix://party/${encodeURIComponent(code)}`;
    await Share.share({ message: `Join my AnnahFlix watch party: ${invitationUrl}\nRoom code: ${code}` });
  };

  if (!selectedMovie && room?.selectedMovie && !showScreenStream) {
    return <View style={styles.errorContainer}><ActivityIndicator color={colors.primary} size="large" /><Text style={styles.errorText}>Preparing {room.selectedMovie.title}…</Text></View>;
  }

  if (!selectedMovie && !showScreenStream) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>No movie file selected.</Text>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.replace(`/room/${code}`)}
        >
          <Text style={styles.backBtnText}>Return to Room</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {showScreenStream ? <ScreenSharePlayer emptyMessage={screenShareEnded ? 'Screen sharing ended. Waiting for the host to start again.' : undefined} /> : <VideoPlayerView
        videoUri={selectedMovie!.uri}
        onToggleControls={() => setShowControls((prev) => !prev)}
        onPlayerState={onPlayerState}
        onPlayerError={setPlayerError}
      />}

      {!showScreenStream && (!isPlaying || isBuffering) ? (
        <View style={styles.preparingOverlay} pointerEvents="box-none">
          <View style={styles.preparingCard}>
            {playerState === 'ERROR' ? null : <ActivityIndicator size="small" color={colors.primary} />}
            <Text style={styles.preparingTitle}>
              {playerState === 'ERROR'
                ? 'Movie could not be prepared'
                : isBuffering
                  ? 'Buffering video...'
                  : isCountingDown
                  ? 'Starting together...'
                  : playerState === 'BUFFERING'
                    ? 'Buffering video...'
                    : playerState === 'READY'
                      ? "You're ready!"
                      : 'Preparing your movie...'}
            </Text>
            <Text style={styles.preparingText}>
              {playerState === 'ERROR'
                ? room?.selectedMovie?.sourceType === 'MANIFEST'
                  ? 'Movie source unavailable. Check the original manifest base URL and authorized segment links.'
                  : room?.selectedMovie?.sourceType === 'STREAM' && /401|403|forbidden|unauthori[sz]ed|expired/i.test(playerError)
                  ? 'This streaming link has expired or denied access. Ask an admin to update the source URL.'
                  : 'Check your connection and this movie source, then try again.'
                : playerState === 'READY'
                  ? isHost
                    ? (allViewersReady ? 'Every viewer is ready. Press Play to start.' : `${viewerReadyCount} of ${room?.participants.length || 1} viewers ready`)
                    : 'Waiting for the host to start the movie.'
                  : room?.selectedMovie?.title || 'Loading movie'}
            </Text>
            {playerState === 'ERROR' ? (
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => { reportViewerState('LOADING'); requestResync(); setPlayerState('LOADING'); }}
                accessibilityRole="button"
                accessibilityLabel="Retry preparing movie"
              >
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            ) : null}
            {!isHost && partner?.readinessState === 'DISCONNECTED' ? (
              <Text style={styles.reconnectText}>Connection interrupted. Reconnecting...</Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* Floating Call Picture-in-Picture / Tile */}
      <CallOverlay />

      {/* Floating Animated Emojis */}
      <FloatingReactions
        pickerVisible={reactionsPickerVisible}
        onClosePicker={() => setReactionsPickerVisible(false)}
      />

      {/* On-Screen Controls */}
      {showControls ? (
        <>
          {/* Top-Left Exit Button */}
          <TouchableOpacity
            style={styles.exitButton}
            onPress={() => router.replace(`/room/${code}`)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Return to movie room"
          >
            <ArrowLeft size={22} color={colors.text} />
          </TouchableOpacity>

          {!showScreenStream ? <PlayerControls
            onOpenChat={() => setChatVisible(true)}
            onOpenVolume={() => setVolumeModalVisible(true)}
            onOpenReactions={() => setReactionsPickerVisible(true)}
          /> : <View style={styles.screenActions}>
            <TouchableOpacity style={styles.screenAction} onPress={() => setChatVisible(true)}><MessageCircle size={18} color={colors.text} /><Text style={styles.screenActionText}>Chat</Text></TouchableOpacity>
            <TouchableOpacity style={styles.screenAction} onPress={() => void shareInvite()}><Share2 size={18} color={colors.text} /><Text style={styles.screenActionText}>Invite</Text></TouchableOpacity>
            {connectionState === 'failed' || connectionState === 'disconnected' ? <TouchableOpacity style={styles.screenAction} onPress={() => code && void joinCall(code).catch(() => undefined)}><RefreshCw size={18} color={colors.text} /><Text style={styles.screenActionText}>Reconnect</Text></TouchableOpacity> : null}
            {isHost ? <TouchableOpacity style={[styles.screenAction, styles.stopAction]} onPress={async () => { await stopScreenShare(); socket?.emit('screen:stop', { roomCode: code! }); }}><MonitorOff size={18} color={colors.danger} /><Text style={[styles.screenActionText, { color: colors.danger }]}>Stop sharing</Text></TouchableOpacity> : null}
            <TouchableOpacity style={[styles.screenAction, styles.stopAction]} onPress={() => setLeaveModalVisible(true)}><LogOut size={18} color={colors.danger} /><Text style={[styles.screenActionText, { color: colors.danger }]}>Leave</Text></TouchableOpacity>
          </View>}
        </>
      ) : null}

      {/* Whisper Chat Bottom Sheet */}
      <WhisperChatSheet
        visible={chatVisible}
        onClose={() => setChatVisible(false)}
      />

      {/* Audio Balance Modal (Movie vs Partner Voice) */}
      <AudioBalanceModal
        visible={volumeModalVisible}
        onClose={() => setVolumeModalVisible(false)}
      />

      {/* Leave Movie Night Confirmation Modal */}
      <ConfirmationModal
        visible={leaveModalVisible}
        title="Leave Movie Night? 💕"
        message={showScreenStream ? 'Leave this screen-share watch party?' : "Are you sure you want to exit? Your partner's playback will be paused."}
        confirmLabel="Leave Room"
        cancelLabel="Stay Watching"
        isDestructive
        onConfirm={handleConfirmLeave}
        onCancel={() => setLeaveModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  exitButton: {
    position: 'absolute',
    top: spacing.xl,
    left: spacing.lg,
    zIndex: 100,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.overlayGlass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenActions: { position: 'absolute', top: spacing.xl, right: spacing.lg, zIndex: 100, flexDirection: 'row', gap: spacing.sm },
  screenAction: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.overlayGlass, borderRadius: spacing.radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  stopAction: { borderWidth: 1, borderColor: colors.danger },
  screenActionText: { color: colors.text, fontSize: typography.size.xs, fontWeight: typography.weight.bold },
  errorContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  errorText: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
  },
  backBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: spacing.radius.lg,
  },
  backBtnText: {
    color: colors.text,
    fontWeight: typography.weight.bold,
  },
  preparingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  preparingCard: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: spacing.radius.lg,
    backgroundColor: 'rgba(20, 17, 30, 0.92)',
    borderWidth: 1,
    borderColor: colors.surfaceElevated,
  },
  preparingTitle: {
    color: colors.text,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.lg,
    textAlign: 'center',
  },
  preparingText: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    textAlign: 'center',
  },
  reconnectText: {
    color: colors.warning,
    fontSize: typography.size.xs,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: spacing.radius.md,
    marginTop: spacing.xs,
  },
  retryText: {
    color: colors.text,
    fontWeight: typography.weight.bold,
  },
});

export default function RoomRoute() {
  const { code: value } = useLocalSearchParams<{ code: string }>();
  const code = String(value || '').trim().toUpperCase();
  const { loading, error } = useRoomSession(code);
  const { room } = useRoom();
  const router = useRouter();
  if (error) return <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}><Text style={{ color: colors.danger }}>{error}</Text><TouchableOpacity onPress={() => router.replace('/join' as any)}><Text style={{ color: colors.primary }}>Back to Join Party</Text></TouchableOpacity></View>;
  if (loading) return <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 16 }}><ActivityIndicator color={colors.primary} /><Text style={{ color: colors.textSecondary }}>Connecting to your movie night?</Text></View>;
  return room?.catalogSelection ? <WatchPartyRoom /> : <MoviePlayerScreen />;
}
