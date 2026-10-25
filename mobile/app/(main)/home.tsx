import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, typography, spacing } from '../../src/theme';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { useAuth } from '../../src/context/AuthContext';
import { useRoom } from '../../src/context/RoomContext';
import {
  Heart,
  PlusCircle,
  LogIn,
  User,
  History,
  Sparkles,
} from 'lucide-react-native';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { createRoom, joinRoom } = useRoom();

  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [loadingAction, setLoadingAction] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCreateRoom = async () => {
    try {
      setLoadingAction(true);
      setErrorMessage(null);
      const room = await createRoom();
      router.push(`/room/${room.code}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create room.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!roomCodeInput.trim()) {
      setErrorMessage('Please enter a 6-character room code.');
      return;
    }

    try {
      setLoadingAction(true);
      setErrorMessage(null);
      const room = await joinRoom(roomCodeInput.trim().toUpperCase());
      setJoinModalVisible(false);
      setRoomCodeInput('');
      router.push(`/room/${room.code}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to join room.');
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <View style={styles.logoRow}>
          <Heart size={24} color={colors.primary} fill={colors.primary} />
          <Text style={styles.logoText}>TogetherFlix</Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => router.push('/(main)/history')}
            activeOpacity={0.7}
          >
            <History size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => router.push('/(main)/profile')}
            activeOpacity={0.7}
          >
            <User size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        {/* Partner Connection Banner */}
        <Card style={styles.partnerCard}>
          <View style={styles.partnerCardContent}>
            <View style={styles.partnerAvatarBox}>
              <Heart size={22} color={colors.primary} />
            </View>
            <View style={styles.partnerTextBox}>
              <Text style={styles.partnerCardTitle}>
                {user?.partner ? `Paired with ${user.partner.displayName} 💕` : 'No Partner Linked Yet'}
              </Text>
              <Text style={styles.partnerCardSubtitle}>
                {user?.partner
                  ? 'Ready for your private movie night!'
                  : 'Link with your partner to share rooms instantly.'}
              </Text>
            </View>
          </View>
          {!user?.partner ? (
            <Button
              title="Pair Partner"
              variant="outline"
              size="sm"
              onPress={() => router.push('/(main)/profile')}
              style={styles.pairBtn}
            />
          ) : null}
        </Card>

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* Action Cards */}
        <View style={styles.actionGrid}>
          {/* Create Room */}
          <TouchableOpacity
            style={styles.heroActionCard}
            onPress={handleCreateRoom}
            activeOpacity={0.85}
            disabled={loadingAction}
          >
            <View style={styles.heroCardIcon}>
              <PlusCircle size={32} color={colors.primary} />
            </View>
            <Text style={styles.heroCardTitle}>Create Movie Room</Text>
            <Text style={styles.heroCardSubtitle}>
              Start a new private session and invite your partner with a code.
            </Text>
            <View style={styles.heroCardBadge}>
              <Sparkles size={14} color={colors.primary} />
              <Text style={styles.heroBadgeText}>Instant & Private</Text>
            </View>
          </TouchableOpacity>

          {/* Join Room */}
          <TouchableOpacity
            style={styles.secondaryActionCard}
            onPress={() => {
              setErrorMessage(null);
              setJoinModalVisible(true);
            }}
            activeOpacity={0.85}
          >
            <View style={styles.secondaryCardIcon}>
              <LogIn size={28} color={colors.secondary} />
            </View>
            <Text style={styles.secondaryCardTitle}>Join With Code</Text>
            <Text style={styles.secondaryCardSubtitle}>
              Enter the room code shared by your partner to join their movie night.
            </Text>
          </TouchableOpacity>
        </View>

        {/* Quick Tips */}
        <Card style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>💡 How Local Playback Works</Text>
          <Text style={styles.tipsText}>
            1. Both of you download the same movie file onto your respective Android phones.{'\n'}
            2. One person creates a room and shares the code.{'\n'}
            3. Both select the local file from storage — TogetherFlix checks file compatibility and synchronizes playback in step!
          </Text>
        </Card>
      </ScrollView>

      {/* Join Room Modal */}
      <Modal
        visible={joinModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setJoinModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Join Movie Room</Text>
            <Text style={styles.modalSubtitle}>
              Enter the room code shared by your partner (e.g. TF-7821)
            </Text>

            <Input
              placeholder="e.g. TF-7821"
              value={roomCodeInput}
              onChangeText={setRoomCodeInput}
              autoCapitalize="characters"
              style={styles.modalInput}
            />

            <View style={styles.modalBtnRow}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setJoinModalVisible(false)}
                style={styles.modalBtn}
              />
              <Button
                title="Join Room"
                onPress={handleJoinRoom}
                loading={loadingAction}
                style={styles.modalBtn}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logoText: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.heavy,
    color: colors.text,
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  partnerCard: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderLight,
  },
  partnerCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  partnerAvatarBox: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primaryGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerTextBox: {
    flex: 1,
  },
  partnerCardTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.text,
  },
  partnerCardSubtitle: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  pairBtn: {
    marginTop: spacing.md,
  },
  errorBox: {
    backgroundColor: colors.dangerGlow,
    padding: spacing.md,
    borderRadius: spacing.radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.size.xs,
  },
  actionGrid: {
    gap: spacing.lg,
  },
  heroActionCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: spacing.radius.xl,
    padding: spacing.xl,
    borderWidth: 1.5,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  heroCardIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroCardTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.text,
  },
  heroCardSubtitle: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: typography.lineHeight.sm,
  },
  heroCardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryGlow,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: spacing.radius.full,
    gap: 4,
    marginTop: spacing.md,
  },
  heroBadgeText: {
    fontSize: typography.size.xs,
    color: colors.primary,
    fontWeight: typography.weight.semibold,
  },
  secondaryActionCard: {
    backgroundColor: colors.surface,
    borderRadius: spacing.radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryCardIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.secondaryGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  secondaryCardTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.text,
  },
  secondaryCardSubtitle: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: typography.lineHeight.sm,
  },
  tipsCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  tipsTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  tipsText: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    lineHeight: typography.lineHeight.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: spacing.radius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  modalTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.text,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  modalInput: {
    textAlign: 'center',
    letterSpacing: 2,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  modalBtn: {
    flex: 1,
  },
});
