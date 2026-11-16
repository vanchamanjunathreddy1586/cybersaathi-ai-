import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ShieldCheck, ScanLine, Bot, FileText, PhoneCall } from 'lucide-react-native';
import { Screen, Button, Card } from '../../src/components/ui';
import { colors, typography, spacing } from '../../src/theme';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <Screen scrollable showOfflineBanner={false}>
      <View style={styles.headerSection}>
        <View style={styles.logoBadge}>
          <ShieldCheck size={48} color={colors.accent.cyan} />
        </View>
        <Text style={styles.brandTitle}>
          Cyber<Text style={styles.brandAccent}>Saathi</Text> <Text style={styles.aiTag}>AI</Text>
        </Text>
        <Text style={styles.tagline}>Your Digital World. Our Protection.</Text>
      </View>

      <View style={styles.featuresList}>
        <Card style={styles.featureCard}>
          <View style={styles.featureRow}>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(6, 182, 212, 0.15)' }]}>
              <ScanLine size={24} color={colors.accent.cyan} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>AI Scam Radar</Text>
              <Text style={styles.featureDesc}>
                Real-time scanning of suspicious URLs, SMS texts, and camera QR codes before you tap.
              </Text>
            </View>
          </View>
        </Card>

        <Card style={styles.featureCard}>
          <View style={styles.featureRow}>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
              <Bot size={24} color={colors.primary.light} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Multilingual AI Saathi</Text>
              <Text style={styles.featureDesc}>
                Voice & text emergency response guidance in English, हिन्दी (Hindi), and తెలుగు (Telugu).
              </Text>
            </View>
          </View>
        </Card>

        <Card style={styles.featureCard}>
          <View style={styles.featureRow}>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <FileText size={24} color={colors.status.safe} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Investigation Room</Text>
              <Text style={styles.featureDesc}>
                Biometrically locked evidence locker, timeline builder, and court-ready PDF complaint generator.
              </Text>
            </View>
          </View>
        </Card>

        <Card style={styles.featureCard}>
          <View style={styles.featureRow}>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
              <PhoneCall size={24} color={colors.status.danger} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>1930 Emergency Helpline</Text>
              <Text style={styles.featureDesc}>
                One-tap instant connection to India's National Cyber Crime Helpline for golden hour financial recovery.
              </Text>
            </View>
          </View>
        </Card>
      </View>

      <View style={styles.buttonGroup}>
        <Button
          title="Create Account"
          onPress={() => router.push('/(auth)/register')}
          size="lg"
          style={styles.primaryButton}
        />
        <Button
          title="Sign In to Existing Account"
          onPress={() => router.push('/(auth)/login')}
          variant="secondary"
          size="md"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  logoBadge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    borderWidth: 1.5,
    borderColor: colors.accent.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    shadowColor: colors.accent.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  brandTitle: {
    ...typography.h1,
    color: colors.text.primary,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  brandAccent: {
    color: colors.primary.light,
  },
  aiTag: {
    fontSize: 18,
    color: colors.accent.cyan,
    fontWeight: '700',
  },
  tagline: {
    ...typography.subtitle1,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  featuresList: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  featureCard: {
    padding: spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    ...typography.subtitle1,
    color: colors.text.primary,
    fontWeight: '700',
  },
  featureDesc: {
    ...typography.body2,
    color: colors.text.secondary,
    marginTop: 2,
    lineHeight: 18,
  },
  buttonGroup: {
    gap: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xxl,
  },
  primaryButton: {
    shadowColor: colors.primary.main,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
});
