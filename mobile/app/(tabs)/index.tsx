import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, Image } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ShieldAlert,
  ScanLine,
  Bot,
  PhoneCall,
  AlertTriangle,
  ChevronRight,
  Smartphone,
  Lock,
} from 'lucide-react-native';
import { Screen, Header, Card, RiskGauge, Button } from '../../src/components/ui';
import { colors, typography, spacing, borderRadius } from '../../src/theme';
import { useAuth } from '../../src/context/AuthContext';
import { getUserSafetyScore, getThreatAdvisories, ThreatAdvisory, SecurityScoreData } from '../../src/api/security.api';
import { evaluateDeviceSecurityPosture, DeviceSecurityPosture } from '../../src/services/deviceSecurity';
import { useHaptics } from '../../src/hooks/useHaptics';

export default function DashboardScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const haptics = useHaptics();

  const [safetyScore, setSafetyScore] = useState<SecurityScoreData | null>(null);
  const [devicePosture, setDevicePosture] = useState<DeviceSecurityPosture | null>(null);
  const [advisories, setAdvisories] = useState<ThreatAdvisory[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [scoreRes, postureRes, advRes] = await Promise.all([
        getUserSafetyScore(),
        evaluateDeviceSecurityPosture(),
        getThreatAdvisories(),
      ]);
      setSafetyScore(scoreRes);
      setDevicePosture(postureRes);
      setAdvisories(advRes.slice(0, 3));
    } catch (err) {
      console.warn('[Dashboard] Error fetching telemetry:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = async () => {
    haptics.light();
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const displayName = profile?.displayName || profile?.fullName || user?.email?.split('@')[0] || 'Defender';

  return (
    <Screen
      scrollable
      contentContainerStyle={{ paddingBottom: spacing.xxxl }}
    >
      <Header
        subtitle={`Active Protection: ${devicePosture?.rating || 'SECURE'}`}
        rightAction={
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/profile')}
            style={styles.profileAvatarBtn}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
          >
            {profile?.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={styles.profileAvatarImg} />
            ) : (
              <View style={styles.profileAvatarFallback}>
                <Text style={styles.profileAvatarInitials}>
                  {(profile?.fullName || user?.email || 'D').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        }
      />

      <View style={styles.greetingSection}>
        <Text style={styles.greetingTitle}>Welcome, {displayName}</Text>
        <Text style={styles.greetingSub}>
          CyberSaathi AI is actively monitoring digital threat vectors.
        </Text>
      </View>

      {/* Safety Score Card */}
      <Card variant="elevated" style={styles.scoreCard}>
        <View style={styles.scoreHeader}>
          <View>
            <Text style={styles.scoreCardTitle}>Cyber Defense Score</Text>
            <Text style={styles.scoreCardSub}>
              {safetyScore?.tier || 'ENHANCED'} POSTURE &bull; {safetyScore?.checksPassed || 5}/{safetyScore?.totalChecks || 6} CHECKS
            </Text>
          </View>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        <RiskGauge
          score={safetyScore?.score || 85}
          mode="safety"
          size="md"
          title="Account & Device Resiliency"
        />

        <Button
          title="Run Comprehensive Device Audit"
          onPress={() => router.push('/(modals)/device-audit')}
          variant="secondary"
          size="sm"
          style={{ marginTop: spacing.sm }}
        />
      </Card>

      {/* Quick Action Matrix */}
      <Text style={styles.sectionHeader}>Quick Defense Actions</Text>
      <View style={styles.actionGrid}>
        <TouchableOpacity
          style={[styles.actionCard, { borderColor: colors.accent.cyan }]}
          onPress={() => router.push('/(tabs)/scanner')}
          activeOpacity={0.8}
        >
          <View style={[styles.actionIconBox, { backgroundColor: 'rgba(6, 182, 212, 0.15)' }]}>
            <ScanLine size={24} color={colors.accent.cyan} />
          </View>
          <Text style={styles.actionTitle}>AI Scam Scanner</Text>
          <Text style={styles.actionDesc}>Verify URL, SMS, or QR</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, { borderColor: colors.primary.main }]}
          onPress={() => router.push('/(tabs)/assistant')}
          activeOpacity={0.8}
        >
          <View style={[styles.actionIconBox, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
            <Bot size={24} color={colors.primary.light} />
          </View>
          <Text style={styles.actionTitle}>Voice Saathi</Text>
          <Text style={styles.actionDesc}>Multilingual AI advice</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, { borderColor: colors.status.danger }]}
          onPress={() => router.push('/(modals)/recovery-guide')}
          activeOpacity={0.8}
        >
          <View style={[styles.actionIconBox, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
            <PhoneCall size={24} color={colors.status.danger} />
          </View>
          <Text style={styles.actionTitle}>Fraud Recovery</Text>
          <Text style={styles.actionDesc}>1930 & Bank freeze</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, { borderColor: colors.status.safe }]}
          onPress={() => router.push('/(modals)/complaint-wizard')}
          activeOpacity={0.8}
        >
          <View style={[styles.actionIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
            <ShieldAlert size={24} color={colors.status.safe} />
          </View>
          <Text style={styles.actionTitle}>FIR Drafter</Text>
          <Text style={styles.actionDesc}>Cybercrime.gov.in draft</Text>
        </TouchableOpacity>
      </View>

      {/* Device Posture Card */}
      <Text style={styles.sectionHeader}>Device Security Status</Text>
      <Card style={styles.deviceCard}>
        <View style={styles.deviceRow}>
          <Smartphone size={22} color={colors.primary.light} />
          <View style={styles.deviceInfo}>
            <Text style={styles.deviceTitle}>
              {devicePosture?.deviceModel} ({devicePosture?.osName} {devicePosture?.osVersion})
            </Text>
            <Text style={styles.deviceSub}>
              Biometrics: {devicePosture?.biometricsEnrolled ? 'Active & Enrolled' : 'Not configured'}
            </Text>
          </View>
          <Lock size={18} color={devicePosture?.screenLockActive ? colors.status.safe : colors.status.warning} />
        </View>
      </Card>

      {/* Threat Radar Feed */}
      <View style={styles.radarHeaderRow}>
        <Text style={styles.sectionHeader}>India Threat Radar</Text>
        <TouchableOpacity onPress={() => router.push('/(modals)/device-audit')}>
          <Text style={styles.viewAllText}>View Details</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.advisoriesList}>
        {advisories.map((adv) => (
          <Card key={adv.id} style={styles.advisoryCard}>
            <View style={styles.advisoryHeader}>
              <View style={styles.advisoryTitleRow}>
                <AlertTriangle
                  size={18}
                  color={adv.severity === 'critical' ? colors.status.danger : colors.status.warning}
                />
                <Text style={styles.advisoryTitle} numberOfLines={1}>
                  {adv.title}
                </Text>
              </View>
              <Text style={styles.advisoryCategory}>{adv.category}</Text>
            </View>
            <Text style={styles.advisorySummary} numberOfLines={2}>
              {adv.summary}
            </Text>
            <View style={styles.advisoryFooter}>
              <Text style={styles.advisorySource}>{adv.source}</Text>
              <ChevronRight size={16} color={colors.text.muted} />
            </View>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  greetingSection: {
    marginVertical: spacing.md,
  },
  greetingTitle: {
    ...typography.h2,
    color: colors.text.primary,
  },
  greetingSub: {
    ...typography.body2,
    color: colors.text.secondary,
    marginTop: 2,
  },
  scoreCard: {
    marginVertical: spacing.md,
  },
  scoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  scoreCardTitle: {
    ...typography.subtitle1,
    color: colors.text.primary,
    fontWeight: '700',
  },
  scoreCardSub: {
    ...typography.caption,
    color: colors.accent.cyan,
    fontWeight: '600',
    marginTop: 2,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.status.safe,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.status.safe,
    marginRight: 4,
  },
  liveText: {
    ...typography.caption,
    color: colors.status.safeLight,
    fontWeight: '800',
  },
  sectionHeader: {
    ...typography.subtitle1,
    color: colors.text.primary,
    fontWeight: '700',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  actionCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
  },
  actionIconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  actionTitle: {
    ...typography.subtitle2,
    color: colors.text.primary,
    fontWeight: '700',
  },
  actionDesc: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  deviceCard: {
    padding: spacing.md,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  deviceTitle: {
    ...typography.subtitle2,
    color: colors.text.primary,
    fontWeight: '600',
  },
  deviceSub: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  radarHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewAllText: {
    ...typography.caption,
    color: colors.primary.light,
    fontWeight: '700',
  },
  advisoriesList: {
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  advisoryCard: {
    padding: spacing.md,
  },
  advisoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  advisoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  advisoryTitle: {
    ...typography.subtitle2,
    color: colors.text.primary,
    fontWeight: '700',
    marginLeft: spacing.xs + 2,
    flex: 1,
  },
  advisoryCategory: {
    ...typography.caption,
    color: colors.accent.cyan,
    fontWeight: '600',
  },
  advisorySummary: {
    ...typography.body2,
    color: colors.text.secondary,
    lineHeight: 18,
    marginVertical: spacing.xs,
  },
  advisoryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  advisorySource: {
    ...typography.caption,
    color: colors.text.muted,
  },
  profileAvatarBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: colors.accent.cyan,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
  },
  profileAvatarImg: {
    width: '100%',
    height: '100%',
  },
  profileAvatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary.main,
  },
  profileAvatarInitials: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
