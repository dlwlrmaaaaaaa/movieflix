import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, typography, spacing } from '../../src/theme';
import { Header } from '../../src/components/ui/Header';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { useAuth } from '../../src/context/AuthContext';
import { User, Heart, Key, LogOut } from 'lucide-react-native';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, createPartnerInvite, acceptPartnerInvite, unlinkPartner } = useAuth();

  const [partnerEmail, setPartnerEmail] = useState('');
  const [redeemCode, setRedeemCode] = useState('');
  const [createdInviteCode, setCreatedInviteCode] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleCreateInvite = async () => {
    if (!partnerEmail.trim()) {
      setFeedback('Please enter your partner\'s email address.');
      return;
    }
    try {
      setLoadingAction(true);
      setFeedback(null);
      const res = await createPartnerInvite(partnerEmail.trim());
      setCreatedInviteCode(res.inviteCode);
      setFeedback(`Invite created! Give this code to your partner: ${res.inviteCode}`);
    } catch (err: any) {
      setFeedback(err.message || 'Failed to create partner invite.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleAcceptInvite = async () => {
    if (!redeemCode.trim()) {
      setFeedback('Please enter the partner invite code.');
      return;
    }
    try {
      setLoadingAction(true);
      setFeedback(null);
      await acceptPartnerInvite(redeemCode.trim());
      setRedeemCode('');
      setFeedback('Successfully paired with your partner! 💕');
    } catch (err: any) {
      setFeedback(err.message || 'Failed to redeem partner code.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleUnlink = async () => {
    try {
      setLoadingAction(true);
      await unlinkPartner();
      setFeedback('Partner unlinked.');
    } catch (err: any) {
      setFeedback(err.message);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <View style={styles.container}>
      <Header title="Profile & Partner" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        {/* User Info Card */}
        <Card style={styles.userCard}>
          <View style={styles.avatarBox}>
            <User size={32} color={colors.primary} />
          </View>
          <Text style={styles.userName}>{user?.displayName}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </Card>

        {feedback ? (
          <View style={styles.feedbackBox}>
            <Text style={styles.feedbackText}>{feedback}</Text>
          </View>
        ) : null}

        {/* Partner Connection Section */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Heart size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Partner Pairing</Text>
          </View>

          {user?.partner ? (
            <View style={styles.pairedBox}>
              <Text style={styles.pairedTitle}>
                Currently paired with {user.partner.displayName} 💕
              </Text>
              <Button
                title="Unlink Partner"
                variant="outline"
                onPress={handleUnlink}
                loading={loadingAction}
                style={styles.actionBtn}
              />
            </View>
          ) : (
            <View style={styles.unpairedBox}>
              <Text style={styles.subtext}>
                Generate a partner invite code or redeem an invite code sent by your partner.
              </Text>

              {/* Generate Invite */}
              <View style={styles.inputGroup}>
                <Input
                  label="Invite Partner by Email"
                  placeholder="partner@email.com"
                  value={partnerEmail}
                  onChangeText={setPartnerEmail}
                />
                <Button
                  title="Generate Invite Code"
                  variant="secondary"
                  onPress={handleCreateInvite}
                  loading={loadingAction}
                />
              </View>

              {createdInviteCode ? (
                <View style={styles.codeDisplayBox}>
                  <Text style={styles.codeLabel}>Your Partner Code:</Text>
                  <Text style={styles.codeValue}>{createdInviteCode}</Text>
                </View>
              ) : null}

              {/* Redeem Invite */}
              <View style={[styles.inputGroup, { marginTop: spacing.lg }]}>
                <Input
                  label="Have a Code From Your Partner?"
                  placeholder="e.g. TF-ABCD12"
                  value={redeemCode}
                  onChangeText={setRedeemCode}
                  autoCapitalize="characters"
                />
                <Button
                  title="Connect With Partner"
                  onPress={handleAcceptInvite}
                  loading={loadingAction}
                />
              </View>
            </View>
          )}
        </Card>

        {/* Sign Out */}
        <Button
          title="Sign Out"
          variant="danger"
          icon={<LogOut size={18} color={colors.text} />}
          onPress={handleLogout}
          style={styles.logoutBtn}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  userCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  avatarBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  userName: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.text,
  },
  userEmail: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  feedbackBox: {
    backgroundColor: colors.surfaceElevated,
    padding: spacing.md,
    borderRadius: spacing.radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  feedbackText: {
    color: colors.primary,
    fontSize: typography.size.xs,
    textAlign: 'center',
  },
  sectionCard: {
    padding: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.text,
  },
  pairedBox: {
    gap: spacing.md,
  },
  pairedTitle: {
    fontSize: typography.size.sm,
    color: colors.text,
  },
  unpairedBox: {
    gap: spacing.md,
  },
  subtext: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    lineHeight: typography.lineHeight.xs,
  },
  inputGroup: {
    gap: spacing.xs,
  },
  codeDisplayBox: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: spacing.radius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  codeLabel: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
  },
  codeValue: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.heavy,
    color: colors.primary,
    letterSpacing: 2,
    marginTop: 4,
  },
  actionBtn: {
    marginTop: spacing.sm,
  },
  logoutBtn: {
    marginTop: spacing.md,
  },
});
