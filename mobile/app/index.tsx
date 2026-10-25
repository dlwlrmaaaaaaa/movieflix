import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Heart, Film, PhoneCall, Sparkles } from 'lucide-react-native';
import { colors, typography, spacing } from '../src/theme';
import { Button } from '../src/components/ui/Button';
import { useAuth } from '../src/context/AuthContext';

export default function WelcomeScreen() {
  const router = useRouter();
  const { user, token, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user && token) {
      router.replace('/(main)/home');
    }
  }, [user, token, isLoading]);

  return (
    <ScrollView contentContainerStyle={styles.container} bounces={false}>
      {/* Hero Branding */}
      <View style={styles.heroSection}>
        <View style={styles.heartGlow}>
          <Heart size={44} color={colors.primary} fill={colors.primary} />
        </View>
        <Text style={styles.brandTitle}>TogetherFlix</Text>
        <Text style={styles.brandTagline}>Private Movie Nights for LDR Couples</Text>
      </View>

      {/* Feature Highlights */}
      <View style={styles.featuresSection}>
        <View style={styles.featureItem}>
          <View style={styles.featureIcon}>
            <Film size={22} color={colors.primary} />
          </View>
          <View style={styles.featureTextContainer}>
            <Text style={styles.featureTitle}>Local Video Playback</Text>
            <Text style={styles.featureDescription}>
              Watch downloaded movies from your phone with zero buffering and no server upload.
            </Text>
          </View>
        </View>

        <View style={styles.featureItem}>
          <View style={[styles.featureIcon, { backgroundColor: colors.secondaryGlow }]}>
            <Sparkles size={22} color={colors.secondary} />
          </View>
          <View style={styles.featureTextContainer}>
            <Text style={styles.featureTitle}>Synchronized In-Step</Text>
            <Text style={styles.featureDescription}>
              Sub-second drift correction and synchronized play, pause, seek, and countdown.
            </Text>
          </View>
        </View>

        <View style={styles.featureItem}>
          <View style={[styles.featureIcon, { backgroundColor: colors.successGlow }]}>
            <PhoneCall size={22} color={colors.success} />
          </View>
          <View style={styles.featureTextContainer}>
            <Text style={styles.featureTitle}>Talk While Watching</Text>
            <Text style={styles.featureDescription}>
              Integrated voice/video calling with audio ducking to hear each other clearly.
            </Text>
          </View>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionsSection}>
        <Button
          title="Create Account"
          onPress={() => router.push('/(auth)/register')}
          size="lg"
        />
        <Button
          title="Sign In"
          variant="secondary"
          onPress={() => router.push('/(auth)/login')}
          size="lg"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxxl,
    justifyContent: 'space-between',
  },
  heroSection: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  heartGlow: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  brandTitle: {
    fontSize: typography.size.hero,
    fontWeight: typography.weight.heavy,
    color: colors.text,
    letterSpacing: -0.5,
  },
  brandTagline: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    fontWeight: typography.weight.medium,
  },
  featuresSection: {
    marginVertical: spacing.xl,
    gap: spacing.lg,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: spacing.radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  featureIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primaryGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.text,
  },
  featureDescription: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: typography.lineHeight.xs,
  },
  actionsSection: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
});
