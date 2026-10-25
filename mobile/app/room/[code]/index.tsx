import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, typography, spacing } from '../../../src/theme';
import { Header } from '../../../src/components/ui/Header';
import { Card } from '../../../src/components/ui/Card';
import { Button } from '../../../src/components/ui/Button';
import { Badge } from '../../../src/components/ui/Badge';
import { CompatibilityCard } from '../../../src/components/couple/CompatibilityCard';
import { CountdownOverlay } from '../../../src/components/couple/CountdownOverlay';
import { useRoom } from '../../../src/context/RoomContext';
import { useAuth } from '../../../src/context/AuthContext';
import { usePlaybackSync } from '../../../src/context/PlaybackSyncContext';
import { useCall } from '../../../src/context/CallContext';
import { useVideoPicker } from '../../../src/hooks/useVideoPicker';
import {
  Share2,
  Film,
  CheckCircle2,
  Clock,
  User,
  Heart,
  PhoneCall,
} from 'lucide-react-native';

export default function RoomWaitingScreen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { user } = useAuth();
  const {
    room,
    isHost,
    partner,
    selectedMovie,
    compatibility,
    isReady,
    selectLocalMovie,
    toggleReady,
    leaveRoom,
  } = useRoom();

  const { isCountingDown } = usePlaybackSync();
  const { joinCall, isCallActive } = useCall();
  const { pickVideo, isPicking, error: pickerError } = useVideoPicker();

  // Navigate to player when countdown starts
  useEffect(() => {
    if (isCountingDown) {
      router.replace(`/room/${code}/player`);
    }
  }, [isCountingDown, code]);

  const handleShareCode = async () => {
    try {
      await Share.share({
        message: `Join my movie night on TogetherFlix! Use room code: ${code} 💕`,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handlePickMovie = async () => {
    const file = await pickVideo();
    if (file) {
      selectLocalMovie(file);
    }
  };

  const handleStartCall = async () => {
    if (!isCallActive && code) {
      await joinCall(code);
    }
  };

  function formatDuration(sec: number): string {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins} mins`;
  }

  return (
    <View style={styles.container}>
      <Header
        title="Movie Room"
        subtitle={`Room: ${code}`}
        showBack
        onBack={async () => {
          await leaveRoom();
          router.replace('/(main)/home');
        }}
        rightAction={
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={handleShareCode}
            activeOpacity={0.7}
          >
            <Share2 size={18} color={colors.text} />
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Room Code Showcase */}
        <Card style={styles.codeCard} variant="glowing">
          <Text style={styles.codeLabel}>INVITE YOUR PARTNER WITH THIS CODE</Text>
          <Text style={styles.codeText}>{code}</Text>
          <Text style={styles.codeSubtext}>
            {partner ? `Paired with ${partner.displayName} 💕` : 'Waiting for partner to join...'}
          </Text>
        </Card>

        {/* Participants Connection Status */}
        <View style={styles.participantsRow}>
          {/* Me */}
          <Card style={[styles.participantCard, isReady && styles.participantReady]}>
            <View style={styles.avatarCircle}>
              <User size={20} color={colors.primary} />
            </View>
            <Text style={styles.participantName} numberOfLines={1}>
              {user?.displayName} (You)
            </Text>
            <Badge
              label={isReady ? 'Ready! 💕' : 'Selecting'}
              variant={isReady ? 'success' : 'neutral'}
            />
          </Card>

          {/* Partner */}
          <Card style={[styles.participantCard, partner?.isReady && styles.participantReady]}>
            <View style={styles.avatarCircle}>
              <Heart size={20} color={colors.secondary} />
            </View>
            <Text style={styles.participantName} numberOfLines={1}>
              {partner?.displayName || 'Waiting...'}
            </Text>
            <Badge
              label={partner?.isReady ? 'Ready! 💕' : partner ? 'Selecting' : 'Offline'}
              variant={partner?.isReady ? 'success' : partner ? 'warning' : 'neutral'}
            />
          </Card>
        </View>

        {/* Call Connect Button */}
        {!isCallActive ? (
          <Button
            title="Start Voice / Video Call"
            variant="secondary"
            icon={<PhoneCall size={18} color={colors.text} />}
            onPress={handleStartCall}
          />
        ) : (
          <View style={styles.callActiveNotice}>
            <View style={styles.liveDot} />
            <Text style={styles.callActiveText}>Voice/Video Call Connected 🎙️</Text>
          </View>
        )}

        {/* Local Video Selection Box */}
        <Card style={styles.selectionCard}>
          <View style={styles.selectionHeader}>
            <Film size={22} color={colors.primary} />
            <Text style={styles.selectionTitle}>Your Local Movie File</Text>
          </View>

          {selectedMovie ? (
            <View style={styles.selectedBox}>
              <Text style={styles.fileName}>{selectedMovie.name}</Text>
              <View style={styles.metaRow}>
                <Clock size={14} color={colors.textSecondary} />
                <Text style={styles.fileDuration}>
                  {formatDuration(selectedMovie.durationSeconds)}
                </Text>
                {selectedMovie.size ? (
                  <Text style={styles.fileSize}>
                    {(selectedMovie.size / (1024 * 1024)).toFixed(1)} MB
                  </Text>
                ) : null}
              </View>

              <Button
                title="Change File"
                variant="ghost"
                size="sm"
                onPress={handlePickMovie}
                style={{ alignSelf: 'flex-start', marginTop: spacing.xs }}
              />
            </View>
          ) : (
            <View style={styles.pickPrompt}>
              <Text style={styles.pickDesc}>
                Select the downloaded movie from your Android storage. It stays on your device and will sync with your partner's copy!
              </Text>
              <Button
                title="Select Movie from Storage"
                onPress={handlePickMovie}
                loading={isPicking}
              />
            </View>
          )}

          {pickerError ? (
            <Text style={styles.errorText}>{pickerError}</Text>
          ) : null}
        </Card>

        {/* Compatibility Report */}
        {compatibility ? (
          <CompatibilityCard report={compatibility} />
        ) : null}

        {/* Readiness Action */}
        {selectedMovie ? (
          <View style={styles.readySection}>
            <Button
              title={isReady ? 'Cancel Ready' : "I'm Ready! Let's Watch 💕"}
              variant={isReady ? 'secondary' : 'primary'}
              size="lg"
              onPress={() => toggleReady(!isReady)}
            />
            {isReady && !partner?.isReady ? (
              <Text style={styles.waitingNotice}>
                Waiting for {partner?.displayName || 'your partner'} to hit Ready...
              </Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {/* Synchronized 3-2-1 Countdown Overlay */}
      <CountdownOverlay />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  shareBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  codeCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  codeLabel: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  codeText: {
    fontSize: 36,
    fontWeight: typography.weight.heavy,
    color: colors.primary,
    letterSpacing: 4,
  },
  codeSubtext: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  participantsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  participantCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.xs,
  },
  participantReady: {
    borderColor: colors.success,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  participantName: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.text,
  },
  callActiveNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    padding: spacing.md,
    borderRadius: spacing.radius.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.success,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  callActiveText: {
    fontSize: typography.size.xs,
    color: colors.success,
    fontWeight: typography.weight.semibold,
  },
  selectionCard: {
    gap: spacing.md,
  },
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  selectionTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.text,
  },
  selectedBox: {
    backgroundColor: colors.surfaceElevated,
    padding: spacing.md,
    borderRadius: spacing.radius.md,
  },
  fileName: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  fileDuration: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
  },
  fileSize: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    marginLeft: spacing.sm,
  },
  pickPrompt: {
    gap: spacing.md,
  },
  pickDesc: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    lineHeight: typography.lineHeight.xs,
  },
  errorText: {
    fontSize: typography.size.xs,
    color: colors.danger,
  },
  readySection: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  waitingNotice: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
