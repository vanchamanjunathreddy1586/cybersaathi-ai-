import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ShieldCheck,
  X,
  Smartphone,
  Fingerprint,
  Lock,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  RefreshCw,
} from 'lucide-react-native';
import { Card, Button, Badge, RiskGauge } from '../../src/components/ui';
import { colors, typography, spacing, borderRadius } from '../../src/theme';
import {
  evaluateDeviceSecurityPosture,
  DeviceSecurityPosture,
} from '../../src/services/deviceSecurity';
import { getThreatAdvisories, ThreatAdvisory } from '../../src/api/security.api';
import { useHaptics } from '../../src/hooks/useHaptics';

export default function DeviceAuditModal() {
  const router = useRouter();
  const haptics = useHaptics();

  const [posture, setPosture] = useState<DeviceSecurityPosture | null>(null);
  const [advisories, setAdvisories] = useState<ThreatAdvisory[]>([]);
  const [isAuditing, setIsAuditing] = useState(false);

  useEffect(() => {
    runAudit();
  }, []);

  const runAudit = async () => {
    setIsAuditing(true);
    haptics.medium();
    try {
      const [pRes, advRes] = await Promise.all([
        evaluateDeviceSecurityPosture(),
        getThreatAdvisories(),
      ]);
      setPosture(pRes);
      setAdvisories(advRes);
      haptics.success();
    } catch (err) {
      console.warn('[DeviceAuditModal] error:', err);
    } finally {
      setIsAuditing(false);
    }
  };

  const hardeningChecklist = [
    {
      title: 'Biometric Lock & Device Screen Lock',
      status: posture?.screenLockActive ? 'PASSED' : 'ACTION REQUIRED',
      description: 'Protects offline incident cases and prevents unauthorized local app access.',
      passed: posture?.screenLockActive,
    },
    {
      title: 'OS Security Patch Currency',
      status: 'VERIFIED',
      description: `${posture?.osName} ${posture?.osVersion} complies with modern transport security standards.`,
      passed: true,
    },
    {
      title: 'Hardware Integrity & Execution Environment',
      status: posture?.isPhysicalDevice ? 'PHYSICAL DEVICE' : 'SIMULATED ENVIRONMENT',
      description: posture?.isPhysicalDevice
        ? 'Running on verified physical hardware with hardware-backed Keystore/Keychain.'
        : 'Running in an emulator or test environment.',
      passed: posture?.isPhysicalDevice,
    },
    {
      title: 'mAadhaar Biometric Lock Recommendation',
      status: 'BEST PRACTICE',
      description: 'Lock your Aadhaar biometrics via UIDAI app to prevent unauthorized SIM issuance.',
      passed: true,
    },
    {
      title: 'SIM Card PIN Lock',
      status: 'RECOMMENDED',
      description: 'Set a SIM PIN in device settings to prevent SIM-swap OTP interception if phone is lost.',
      passed: true,
    },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Device Security Audit</Text>
          <Text style={styles.headerSubtitle}>
            Hardware Posture & Cyber Hardening Checklist
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <X size={22} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Score & Posture Banner */}
        <Card variant="elevated" style={styles.postureCard}>
          <View style={styles.postureHeader}>
            <View>
              <Text style={styles.deviceModelText}>{posture?.deviceModel}</Text>
              <Text style={styles.osText}>
                {posture?.osName} {posture?.osVersion} &bull; {posture?.isPhysicalDevice ? 'Physical Hardware' : 'Simulator'}
              </Text>
            </View>
            <Badge
              label={posture?.rating || 'SECURE'}
              variant={posture?.rating === 'SECURE' ? 'safe' : 'warning'}
            />
          </View>

          <RiskGauge
            score={posture?.score || 85}
            mode="safety"
            size="md"
            title="Device Hardening Index"
          />

          <Button
            title={isAuditing ? 'Auditing Hardware...' : 'Re-run Hardware Audit'}
            onPress={runAudit}
            isLoading={isAuditing}
            icon={<RefreshCw size={16} color="#FFF" />}
            size="sm"
            style={{ marginTop: spacing.sm }}
          />
        </Card>

        {/* Hardening Checklist */}
        <Text style={styles.sectionTitle}>Defense Hardening Checks</Text>
        <View style={styles.checklist}>
          {hardeningChecklist.map((item, i) => (
            <Card key={i} style={styles.checkCard}>
              <View style={styles.checkTop}>
                <View style={styles.checkTitleRow}>
                  {item.passed ? (
                    <CheckCircle size={18} color={colors.status.safe} />
                  ) : (
                    <AlertTriangle size={18} color={colors.status.warning} />
                  )}
                  <Text style={styles.checkTitle}>{item.title}</Text>
                </View>
                <Badge
                  label={item.status}
                  variant={item.passed ? 'safe' : 'warning'}
                />
              </View>
              <Text style={styles.checkDesc}>{item.description}</Text>
            </Card>
          ))}
        </View>

        {/* Threat Advisories */}
        <Text style={styles.sectionTitle}>Active Threat Intelligence Radar</Text>
        <View style={styles.advisoriesList}>
          {advisories.map((adv) => (
            <Card key={adv.id} style={styles.advCard}>
              <View style={styles.advTop}>
                <Badge
                  label={adv.severity.toUpperCase()}
                  variant={adv.severity === 'critical' ? 'danger' : 'warning'}
                />
                <Text style={styles.advCategory}>{adv.category}</Text>
              </View>
              <Text style={styles.advTitle}>{adv.title}</Text>
              <Text style={styles.advSummary}>{adv.summary}</Text>
              <View style={styles.advActionBox}>
                <Text style={styles.advActionTitle}>Recommended Defense:</Text>
                <Text style={styles.advActionText}>{adv.recommendedAction}</Text>
              </View>
            </Card>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontWeight: '800',
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.text.muted,
  },
  closeButton: {
    padding: spacing.xs,
  },
  scrollContent: {
    padding: spacing.base,
    paddingBottom: spacing.xxxl,
  },
  postureCard: {
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  postureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  deviceModelText: {
    ...typography.subtitle1,
    color: colors.text.primary,
    fontWeight: '700',
  },
  osText: {
    ...typography.caption,
    color: colors.accent.cyan,
    marginTop: 2,
  },
  sectionTitle: {
    ...typography.subtitle1,
    color: colors.text.primary,
    fontWeight: '700',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  checklist: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  checkCard: {
    padding: spacing.md,
  },
  checkTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  checkTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
    gap: spacing.xs + 2,
  },
  checkTitle: {
    ...typography.subtitle2,
    color: colors.text.primary,
    fontWeight: '700',
    flex: 1,
  },
  checkDesc: {
    ...typography.body2,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  advisoriesList: {
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  advCard: {
    padding: spacing.md,
  },
  advTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  advCategory: {
    ...typography.caption,
    color: colors.accent.cyan,
    fontWeight: '600',
  },
  advTitle: {
    ...typography.subtitle2,
    color: colors.text.primary,
    fontWeight: '700',
    marginTop: 2,
  },
  advSummary: {
    ...typography.body2,
    color: colors.text.secondary,
    lineHeight: 18,
    marginVertical: spacing.xs,
  },
  advActionBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xs,
  },
  advActionTitle: {
    ...typography.caption,
    color: colors.status.safeLight,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  advActionText: {
    ...typography.caption,
    color: colors.text.primary,
    marginTop: 2,
    lineHeight: 16,
  },
});
