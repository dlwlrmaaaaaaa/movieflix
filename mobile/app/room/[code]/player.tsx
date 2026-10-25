import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, spacing, typography } from '../../../src/theme';
import { VideoPlayerView } from '../../../src/components/player/VideoPlayerView';
import { PlayerControls } from '../../../src/components/player/PlayerControls';
import { CallOverlay } from '../../../src/components/call/CallOverlay';
import { FloatingReactions } from '../../../src/components/couple/FloatingReactions';
import { WhisperChatSheet } from '../../../src/components/couple/WhisperChatSheet';
import { AudioBalanceModal } from '../../../src/components/call/AudioBalanceModal';
import { ConfirmationModal } from '../../../src/components/ui/ConfirmationModal';
import { useRoom } from '../../../src/context/RoomContext';
import { useCall } from '../../../src/context/CallContext';
import { ArrowLeft } from 'lucide-react-native';

export default function MoviePlayerScreen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { selectedMovie, leaveRoom } = useRoom();
  const { leaveCall } = useCall();

  const [showControls, setShowControls] = useState<boolean>(true);
  const [chatVisible, setChatVisible] = useState<boolean>(false);
  const [volumeModalVisible, setVolumeModalVisible] = useState<boolean>(false);
  const [reactionsPickerVisible, setReactionsPickerVisible] = useState<boolean>(false);
  const [leaveModalVisible, setLeaveModalVisible] = useState<boolean>(false);

  const handleConfirmLeave = async () => {
    leaveCall();
    await leaveRoom();
    setLeaveModalVisible(false);
    router.replace('/(main)/home');
  };

  if (!selectedMovie) {
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
      {/* Native Local Video Player View */}
      <VideoPlayerView
        videoUri={selectedMovie.uri}
        onToggleControls={() => setShowControls((prev) => !prev)}
      />

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
            onPress={() => setLeaveModalVisible(true)}
            activeOpacity={0.7}
          >
            <ArrowLeft size={22} color={colors.text} />
          </TouchableOpacity>

          <PlayerControls
            onOpenChat={() => setChatVisible(true)}
            onOpenVolume={() => setVolumeModalVisible(true)}
            onOpenReactions={() => setReactionsPickerVisible(true)}
          />
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
        message="Are you sure you want to exit? Your partner's playback will be paused."
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
});
