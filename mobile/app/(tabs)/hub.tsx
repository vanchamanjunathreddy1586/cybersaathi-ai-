import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import {
  GraduationCap,
  Users,
  LifeBuoy,
  FileText,
  ShieldCheck,
  Settings,
  PhoneCall,
  Fingerprint,
  LogOut,
  ChevronRight,
  ExternalLink,
  User,
} from 'lucide-react-native';
import { Screen, Header, Card, Button } from '../../src/components/ui';
import { colors, typography, spacing, borderRadius } from '../../src/theme';
import { useAuth } from '../../src/context/AuthContext';
import { useHaptics } from '../../src/hooks/useHaptics';

export default function HubScreen() {
  const router = useRouter();
  const { user, isBiometricEnabled, setBiometricEnabled, signOut, lockApp } = useAuth();
  const haptics = useHaptics();

  const handleToggleBiometrics = async () => {
    haptics.medium();
    await setBiometricEnabled(!isBiometricEnabled);
  };

  const handleSignOut = async () => {
    haptics.warning();
    await signOut();
    router.replace('/(auth)/welcome');
  };

  return (
    <Screen scrollable>
      <Header
        title="Defense Hub"
        subtitle="Academy, Family Protection, Legal Tools & Security"
      />

      {/* Emergency Banner */}
      <Card variant="danger" style={styles.emergencyCard}>
        <View style={styles.emergencyRow}>
          <View style={styles.emergencyIcon}>
            <PhoneCall size={24} color="#FFF" />
          </View>
          <View style={styles.emergencyTextContainer}>
            <Text style={styles.emergencyTitle}>Golden Hour Recovery (1930)</Text>
            <Text style={styles.emergencyDesc}>
              Report online financial loss within 2 hours to rapidly freeze destination accounts.
            </Text>
          </View>
          <Button
            title="Call"
            onPress={() => router.push('/(modals)/recovery-guide')}
            variant="danger"
            size="sm"
          />
        </View>
      </Card>

      {/* Primary Defense Suites */}
      <Text style={styles.sectionHeader}>Cyber Defense Suites</Text>
      <View style={styles.suitesGrid}>
        <Card
          style={styles.suiteCard}
          onPress={() => {
            haptics.light();
            router.push('/(modals)/academy-course');
          }}
        >
          <View style={[styles.suiteIconBox, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
            <GraduationCap size={24} color={colors.primary.light} />
          </View>
          <View style={styles.suiteContent}>
            <Text style={styles.suiteTitle}>Cyber Academy</Text>
            <Text style={styles.suiteDesc}>
              Interactive micro-modules on Phishing, UPI, & Identity defense with score certificates.
            </Text>
          </View>
          <ChevronRight size={18} color={colors.text.muted} />
        </Card>

        <Card
          style={styles.suiteCard}
          onPress={() => {
            haptics.light();
            router.push('/(modals)/family-circle');
          }}
        >
          <View style={[styles.suiteIconBox, { backgroundColor: 'rgba(6, 182, 212, 0.15)' }]}>
            <Users size={24} color={colors.accent.cyan} />
          </View>
          <View style={styles.suiteContent}>
            <Text style={styles.suiteTitle}>Family Safety Circles</Text>
            <Text style={styles.suiteDesc}>
              Protect elders & family members with one-tap emergency threat alerts.
            </Text>
          </View>
          <ChevronRight size={18} color={colors.text.muted} />
        </Card>

        <Card
          style={styles.suiteCard}
          onPress={() => {
            haptics.light();
            router.push('/(modals)/recovery-guide');
          }}
        >
          <View style={[styles.suiteIconBox, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
            <LifeBuoy size={24} color={colors.status.danger} />
          </View>
          <View style={styles.suiteContent}>
            <Text style={styles.suiteTitle}>Fraud Recovery & Helplines</Text>
            <Text style={styles.suiteDesc}>
              Containment checklists for 9 Indian fraud categories & bank contact directories.
            </Text>
          </View>
          <ChevronRight size={18} color={colors.text.muted} />
        </Card>

        <Card
          style={styles.suiteCard}
          onPress={() => {
            haptics.light();
            router.push('/(modals)/complaint-wizard');
          }}
        >
          <View style={[styles.suiteIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
            <FileText size={24} color={colors.status.safe} />
          </View>
          <View style={styles.suiteContent}>
            <Text style={styles.suiteTitle}>Cybercrime FIR Drafter</Text>
            <Text style={styles.suiteDesc}>
              Generate formal complaints under IT Act 2000 & BNS 318 for cybercrime.gov.in.
            </Text>
          </View>
          <ChevronRight size={18} color={colors.text.muted} />
        </Card>

        <Card
          style={styles.suiteCard}
          onPress={() => {
            haptics.light();
            router.push('/(modals)/device-audit');
          }}
        >
          <View style={[styles.suiteIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
            <ShieldCheck size={24} color="#60A5FA" />
          </View>
          <View style={styles.suiteContent}>
            <Text style={styles.suiteTitle}>Security Center & Device Posture</Text>
            <Text style={styles.suiteDesc}>
              Hardware security checks, threat radar, and biometric posture audit.
            </Text>
          </View>
          <ChevronRight size={18} color={colors.text.muted} />
        </Card>
      </View>

      {/* Security & Settings Controls */}
      <Text style={styles.sectionHeader}>Security & Account</Text>
      <Card style={styles.settingsCard}>
        <View style={styles.settingRow}>
          <Fingerprint size={20} color={colors.primary.light} />
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Biometric App Shield</Text>
            <Text style={styles.settingDesc}>
              Require Face ID / Fingerprint on app launch
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleToggleBiometrics}
            style={[
              styles.toggleSwitch,
              isBiometricEnabled && styles.toggleSwitchActive,
            ]}
          >
            <View
              style={[
                styles.toggleKnob,
                isBiometricEnabled && styles.toggleKnobActive,
              ]}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.settingDivider} />

        <TouchableOpacity
          onPress={() => router.push('/(tabs)/profile')}
          style={styles.settingActionRow}
          accessibilityRole="button"
          accessibilityLabel="Open Profile and Account Settings"
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <User size={18} color={colors.accent.cyan} style={{ marginRight: spacing.sm }} />
            <Text style={styles.settingActionText}>Profile & Account Management</Text>
          </View>
          <ChevronRight size={16} color={colors.text.muted} />
        </TouchableOpacity>

        <View style={styles.settingDivider} />

        <TouchableOpacity onPress={lockApp} style={styles.settingActionRow}>
          <Text style={styles.settingActionText}>Lock App Now</Text>
          <ChevronRight size={16} color={colors.text.muted} />
        </TouchableOpacity>

        <View style={styles.settingDivider} />

        <TouchableOpacity onPress={handleSignOut} style={styles.settingActionRow}>
          <Text style={[styles.settingActionText, { color: colors.status.dangerLight }]}>
            Sign Out ({user?.email || 'Defender'})
          </Text>
          <LogOut size={16} color={colors.status.dangerLight} />
        </TouchableOpacity>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  emergencyCard: {
    marginVertical: spacing.md,
    padding: spacing.md,
  },
  emergencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emergencyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.status.danger,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  emergencyTextContainer: {
    flex: 1,
    marginRight: spacing.sm,
  },
  emergencyTitle: {
    ...typography.subtitle1,
    color: '#FFF',
    fontWeight: '800',
  },
  emergencyDesc: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
    lineHeight: 16,
  },
  sectionHeader: {
    ...typography.subtitle1,
    color: colors.text.primary,
    fontWeight: '700',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  suitesGrid: {
    gap: spacing.md,
  },
  suiteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  suiteIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  suiteContent: {
    flex: 1,
    marginRight: spacing.sm,
  },
  suiteTitle: {
    ...typography.subtitle1,
    color: colors.text.primary,
    fontWeight: '700',
  },
  suiteDesc: {
    ...typography.body2,
    color: colors.text.secondary,
    marginTop: 2,
    lineHeight: 18,
  },
  settingsCard: {
    padding: spacing.md,
    marginBottom: spacing.xxl,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  settingInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  settingTitle: {
    ...typography.subtitle2,
    color: colors.text.primary,
    fontWeight: '600',
  },
  settingDesc: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  toggleSwitch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    padding: 2,
    justifyContent: 'center',
  },
  toggleSwitchActive: {
    backgroundColor: colors.primary.main,
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFF',
  },
  toggleKnobActive: {
    alignSelf: 'flex-end',
  },
  settingDivider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: spacing.md,
  },
  settingActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  settingActionText: {
    ...typography.body2,
    color: colors.text.primary,
    fontWeight: '600',
  },
});
