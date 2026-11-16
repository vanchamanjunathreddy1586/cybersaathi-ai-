import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  X,
  FileText,
  Copy,
  Check,
  Share2,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { Card, Input, Button } from '../../src/components/ui';
import { colors, typography, spacing, borderRadius } from '../../src/theme';
import { draftComplaint, ComplaintDraftResult } from '../../src/api/recovery.api';
import { useHaptics } from '../../src/hooks/useHaptics';

export default function ComplaintWizardModal() {
  const router = useRouter();
  const haptics = useHaptics();

  const [victimName, setVictimName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [fraudType, setFraudType] = useState('UPI Fraud');
  const [incidentDate, setIncidentDate] = useState(new Date().toISOString().split('T')[0]);
  const [lossAmount, setLossAmount] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [bankName, setBankName] = useState('');
  const [incidentSummary, setIncidentSummary] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [complaintResult, setComplaintResult] = useState<ComplaintDraftResult | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const handleGenerate = async () => {
    if (!victimName.trim() || !phone.trim() || !incidentSummary.trim()) {
      Alert.alert('Required Information', 'Please provide victim name, contact phone, and incident narrative.');
      return;
    }

    setIsGenerating(true);
    haptics.medium();

    try {
      const result = await draftComplaint({
        victimName: victimName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        fraudType,
        incidentDate,
        financialLoss: lossAmount ? parseFloat(lossAmount) : 0,
        transactionId: transactionId.trim(),
        bankName: bankName.trim(),
        incidentSummary: incidentSummary.trim(),
      });
      setComplaintResult(result);
      haptics.success();
    } catch (err: any) {
      console.warn('Complaint draft error:', err);
      Alert.alert('Drafting Error', 'Unable to generate complaint letter.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyText = async () => {
    if (!complaintResult) return;
    haptics.light();
    try {
      await Clipboard.setStringAsync(complaintResult.formattedText);
    } catch (err) {
      console.warn('Clipboard write error:', err);
    }
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Cybercrime FIR Drafter</Text>
          <Text style={styles.headerSubtitle}>
            Official National Portal & Police Cell Format (cybercrime.gov.in)
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
        {complaintResult ? (
          <View style={styles.resultContainer}>
            <Card variant="elevated" style={styles.resultCard}>
              <View style={styles.resultTop}>
                <ShieldCheck size={24} color={colors.status.safe} />
                <Text style={styles.resultTitle}>Formal Complaint Generated</Text>
              </View>
              <Text style={styles.firSummaryText}>{complaintResult.firSummary}</Text>

              <View style={styles.legalSection}>
                <Text style={styles.legalHeader}>Statutory Sections Invoked:</Text>
                {complaintResult.statutoryProvisions.map((sec, i) => (
                  <Text key={i} style={styles.legalItem}>
                    &bull; {sec}
                  </Text>
                ))}
              </View>

              <View style={styles.letterBox}>
                <Text style={styles.letterText}>{complaintResult.formattedText}</Text>
              </View>

              <View style={styles.actionRow}>
                <Button
                  title={isCopied ? 'Copied to Clipboard!' : 'Copy Complaint Text'}
                  onPress={handleCopyText}
                  icon={isCopied ? <Check size={16} color="#FFF" /> : <Copy size={16} color="#FFF" />}
                  variant="primary"
                  size="md"
                  style={{ flex: 1 }}
                />
              </View>

              <Button
                title="Open cybercrime.gov.in to File Online"
                onPress={() => Linking.openURL('https://cybercrime.gov.in')}
                icon={<ExternalLink size={16} color="#FFF" />}
                variant="secondary"
                size="md"
                style={{ marginTop: spacing.md }}
              />

              <Button
                title="Edit Details / Re-draft"
                onPress={() => setComplaintResult(null)}
                variant="ghost"
                size="sm"
                style={{ marginTop: spacing.sm }}
              />
            </Card>
          </View>
        ) : (
          <View style={styles.formContainer}>
            <Card style={styles.infoCard}>
              <Text style={styles.infoText}>
                This tool drafts an official representation compliant with the Ministry of Home Affairs guidelines for submission at National Cyber Crime Reporting Portal or local Cyber Police Stations.
              </Text>
            </Card>

            <Input
              label="Complainant / Victim Full Name *"
              placeholder="e.g., Rajesh Kumar"
              value={victimName}
              onChangeText={setVictimName}
            />

            <Input
              label="Mobile Number (linked to Aadhaar / Bank) *"
              placeholder="+91 98765 43210"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />

            <Input
              label="Email Address"
              placeholder="victim@example.com"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />

            <Input
              label="Fraud Category *"
              placeholder="e.g., UPI Fraud, SIM Swap, Fake Investment, Sextortion"
              value={fraudType}
              onChangeText={setFraudType}
            />

            <Input
              label="Financial Loss Amount (INR)"
              placeholder="e.g., 25000"
              keyboardType="numeric"
              value={lossAmount}
              onChangeText={setLossAmount}
            />

            <Input
              label="Transaction UTR / Reference ID"
              placeholder="12-digit UTR from bank SMS"
              value={transactionId}
              onChangeText={setTransactionId}
            />

            <Input
              label="Victim Bank Name"
              placeholder="e.g., State Bank of India, HDFC Bank"
              value={bankName}
              onChangeText={setBankName}
            />

            <Input
              label="Incident Chronology & Suspect Details *"
              placeholder="State what occurred step by step: received SMS at ..., clicked link, suspect claimed ..., debited amount..."
              value={incidentSummary}
              onChangeText={setIncidentSummary}
              multiline
              numberOfLines={5}
              inputStyle={{ height: 110, textAlignVertical: 'top' }}
            />

            <Button
              title="Generate Formal Complaint Representation"
              onPress={handleGenerate}
              isLoading={isGenerating}
              icon={<FileText size={18} color="#FFF" />}
              size="lg"
              style={{ marginTop: spacing.md }}
            />
          </View>
        )}
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
  infoCard: {
    marginBottom: spacing.base,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    borderColor: 'rgba(99, 102, 241, 0.25)',
  },
  infoText: {
    ...typography.caption,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  formContainer: {
    gap: spacing.xs,
  },
  resultContainer: {
    marginBottom: spacing.xxl,
  },
  resultCard: {
    padding: spacing.md,
  },
  resultTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  resultTitle: {
    ...typography.subtitle1,
    color: colors.text.primary,
    fontWeight: '700',
  },
  firSummaryText: {
    ...typography.body2,
    color: colors.accent.cyan,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  legalSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  legalHeader: {
    ...typography.caption,
    color: colors.text.muted,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  legalItem: {
    ...typography.caption,
    color: colors.status.safeLight,
    marginTop: 2,
    fontWeight: '600',
  },
  letterBox: {
    backgroundColor: '#070D18',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.glass,
    marginBottom: spacing.md,
  },
  letterText: {
    ...typography.code,
    color: colors.text.primary,
    fontSize: 12,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
