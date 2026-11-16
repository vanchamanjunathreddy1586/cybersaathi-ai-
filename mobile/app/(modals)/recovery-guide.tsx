import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import {
  PhoneCall,
  X,
  CheckSquare,
  Square,
  ShieldAlert,
  Building,
  ExternalLink,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react-native';
import { Card, Button } from '../../src/components/ui';
import { colors, typography, spacing, borderRadius } from '../../src/theme';
import {
  getFraudVectors,
  getEmergencyContacts,
  FraudVector,
  EmergencyDirectory,
} from '../../src/api/recovery.api';
import { useHaptics } from '../../src/hooks/useHaptics';

export default function RecoveryGuideModal() {
  const router = useRouter();
  const haptics = useHaptics();

  const [vectors, setVectors] = useState<FraudVector[]>([]);
  const [selectedVector, setSelectedVector] = useState<FraudVector | null>(null);
  const [emergency, setEmergency] = useState<EmergencyDirectory | null>(null);
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function loadData() {
      const [vList, dir] = await Promise.all([getFraudVectors(), getEmergencyContacts()]);
      setVectors(vList);
      if (vList.length > 0) {
        setSelectedVector(vList[0]);
      }
      setEmergency(dir);
    }
    loadData();
  }, []);

  const toggleCheck = (idx: number) => {
    haptics.light();
    setCheckedSteps((prev) => ({
      ...prev,
      [`${selectedVector?.id}-${idx}`]: !prev[`${selectedVector?.id}-${idx}`],
    }));
  };

  const dialNumber = (num: string) => {
    haptics.heavy();
    Linking.openURL(`tel:${num}`).catch((err) => {
      console.warn('Dialer error:', err);
    });
  };

  const defaultChecklist = [
    'CALL 1930 IMMEDIATELY: Contact the National Cybercrime Reporting Portal to freeze beneficiary bank accounts before cash-out.',
    'BLOCK BANK CARDS & UPI: Open your official banking app and immediately freeze the debit card and UPI profile linked to the compromised account.',
    'PRESERVE TRANSACTION UTR: Note down the 12-digit UTR (Unique Transaction Reference) number and save SMS alerts as unedited screenshots.',
    'DRAFT CYBERCRIME COMPLAINT: Use the CyberSaathi FIR drafter to generate a formal representation under IT Act 2000 Section 66D.',
    'REVOKE SUSPICIOUS APPS: If prompted to install APKs or screen-share tools (AnyDesk, TeamViewer), uninstall them and reboot device in Safe Mode.',
  ];

  return (
    <View style={styles.container}>
      {/* Modal Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Fraud Recovery Suite</Text>
          <Text style={styles.headerSubtitle}>
            India National Cybercrime Helpline 1930 & Containment Guide
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
        {/* Urgent 1930 Call Banner */}
        <Card variant="danger" style={styles.urgentBanner}>
          <View style={styles.urgentRow}>
            <View style={styles.urgentIconCircle}>
              <PhoneCall size={28} color="#FFF" />
            </View>
            <View style={styles.urgentTextContainer}>
              <Text style={styles.urgentHeadline}>Dial 1930 (Golden Hour)</Text>
              <Text style={styles.urgentBody}>
                Ministry of Home Affairs I4C Financial Fraud Helpline. Immediate calling enables automated inter-bank account freezing.
              </Text>
            </View>
          </View>
          <Button
            title="Dial 1930 Now"
            onPress={() => dialNumber('1930')}
            variant="danger"
            size="lg"
            style={{ marginTop: spacing.md }}
          />
        </Card>

        {/* Vector Category Selector */}
        <Text style={styles.sectionTitle}>Select Incident Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.vectorSelector}>
          {vectors.map((vec) => (
            <TouchableOpacity
              key={vec.id}
              style={[
                styles.vectorPill,
                selectedVector?.id === vec.id && styles.vectorPillActive,
              ]}
              onPress={() => {
                haptics.light();
                setSelectedVector(vec);
              }}
            >
              <Text
                style={[
                  styles.vectorPillText,
                  selectedVector?.id === vec.id && styles.vectorPillTextActive,
                ]}
              >
                {vec.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Containment Checklist */}
        <Text style={styles.sectionTitle}>
          Step-by-Step Containment Checklist ({selectedVector?.name})
        </Text>
        <Card style={styles.checklistCard}>
          {defaultChecklist.map((step, idx) => {
            const isChecked = checkedSteps[`${selectedVector?.id}-${idx}`];
            return (
              <TouchableOpacity
                key={idx}
                onPress={() => toggleCheck(idx)}
                style={styles.checkItem}
                activeOpacity={0.7}
              >
                {isChecked ? (
                  <CheckSquare size={22} color={colors.status.safe} />
                ) : (
                  <Square size={22} color={colors.text.muted} />
                )}
                <Text
                  style={[
                    styles.checkText,
                    isChecked && styles.checkTextDone,
                  ]}
                >
                  {step}
                </Text>
              </TouchableOpacity>
            );
          })}

          <Button
            title="Open FIR Complaint Drafter"
            onPress={() => {
              router.back();
              router.push('/(modals)/complaint-wizard');
            }}
            variant="primary"
            size="md"
            style={{ marginTop: spacing.md }}
          />
        </Card>

        {/* Bank 24x7 Helplines */}
        <Text style={styles.sectionTitle}>Major Bank Fraud Helplines</Text>
        <View style={styles.banksGrid}>
          {emergency?.banks.map((bank, i) => (
            <TouchableOpacity
              key={i}
              style={styles.bankCard}
              onPress={() => dialNumber(bank.number)}
              activeOpacity={0.8}
            >
              <Building size={20} color={colors.accent.cyan} />
              <View style={styles.bankMeta}>
                <Text style={styles.bankName}>{bank.name}</Text>
                <Text style={styles.bankNumber}>{bank.number}</Text>
              </View>
              <PhoneCall size={16} color={colors.status.safe} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Official Web Portals */}
        <Text style={styles.sectionTitle}>Official Government Reporting Portals</Text>
        <View style={styles.portalsList}>
          {emergency?.portals.map((portal, i) => (
            <TouchableOpacity
              key={i}
              style={styles.portalCard}
              onPress={() => Linking.openURL(portal.url)}
              activeOpacity={0.8}
            >
              <View style={styles.portalMeta}>
                <Text style={styles.portalName}>{portal.name}</Text>
                <Text style={styles.portalDesc}>{portal.description}</Text>
              </View>
              <ExternalLink size={18} color={colors.primary.light} />
            </TouchableOpacity>
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
  urgentBanner: {
    marginBottom: spacing.lg,
  },
  urgentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  urgentIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  urgentTextContainer: {
    flex: 1,
  },
  urgentHeadline: {
    ...typography.h3,
    color: '#FFF',
    fontWeight: '800',
  },
  urgentBody: {
    ...typography.body2,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 4,
    lineHeight: 18,
  },
  sectionTitle: {
    ...typography.subtitle1,
    color: colors.text.primary,
    fontWeight: '700',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  vectorSelector: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  vectorPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background.elevated,
    borderWidth: 1,
    borderColor: colors.border.glass,
    marginRight: spacing.sm,
  },
  vectorPillActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    borderColor: colors.primary.light,
  },
  vectorPillText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  vectorPillTextActive: {
    color: colors.primary.light,
    fontWeight: '700',
  },
  checklistCard: {
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  checkText: {
    ...typography.body2,
    color: colors.text.primary,
    flex: 1,
    lineHeight: 20,
  },
  checkTextDone: {
    color: colors.text.muted,
    textDecorationLine: 'line-through',
  },
  banksGrid: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  bankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.elevated,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.glass,
  },
  bankMeta: {
    flex: 1,
    marginLeft: spacing.md,
  },
  bankName: {
    ...typography.subtitle2,
    color: colors.text.primary,
    fontWeight: '600',
  },
  bankNumber: {
    ...typography.caption,
    color: colors.accent.cyan,
    marginTop: 2,
    fontWeight: '700',
  },
  portalsList: {
    gap: spacing.sm,
  },
  portalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.elevated,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.glass,
  },
  portalMeta: {
    flex: 1,
    marginRight: spacing.sm,
  },
  portalName: {
    ...typography.subtitle2,
    color: colors.text.primary,
    fontWeight: '600',
  },
  portalDesc: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: 2,
  },
});
