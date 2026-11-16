import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ScanLine,
  Link2,
  MessageSquare,
  Mail,
  QrCode,
  AlertOctagon,
  CheckCircle2,
  AlertTriangle,
  History,
  Trash2,
  ArrowRight,
} from 'lucide-react-native';
import { Screen, Header, Card, Input, Button, RiskGauge, Badge } from '../../src/components/ui';
import { colors, typography, spacing, borderRadius } from '../../src/theme';
import { analyzeScam, getScanHistory, deleteScanHistory, ScanType, ScanResult } from '../../src/api/scanner.api';
import { useHaptics } from '../../src/hooks/useHaptics';

export default function ScannerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ qrContent?: string }>();
  const haptics = useHaptics();

  const [scanType, setScanType] = useState<ScanType>('url');
  const [content, setContent] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Handle incoming QR code from camera modal
  useEffect(() => {
    if (params.qrContent) {
      setContent(params.qrContent);
      setScanType('qr');
      triggerScan('qr', params.qrContent);
    }
  }, [params.qrContent]);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const list = await getScanHistory();
    setScanHistory(list);
  };

  const triggerScan = async (type: ScanType = scanType, targetContent: string = content) => {
    setErrorMessage('');
    if (!targetContent.trim()) {
      setErrorMessage('Please enter or paste the content you want to analyze.');
      return;
    }

    haptics.medium();
    setIsScanning(true);
    setScanResult(null);

    try {
      const result = await analyzeScam(type, targetContent);
      setScanResult(result);

      if (result.verdict === 'DANGEROUS') {
        haptics.error();
      } else if (result.verdict === 'SUSPICIOUS') {
        haptics.warning();
      } else {
        haptics.success();
      }

      await loadHistory();
    } catch (err: any) {
      setErrorMessage(err.message || 'Scam analysis failed. Please verify connection.');
      haptics.error();
    } finally {
      setIsScanning(false);
    }
  };

  const handleDeleteHistory = async (id?: string) => {
    if (!id) return;
    haptics.light();
    await deleteScanHistory(id);
    await loadHistory();
  };

  const handlePreloadSample = (type: ScanType, sample: string) => {
    setScanType(type);
    setContent(sample);
  };

  return (
    <Screen scrollable>
      <Header
        title="AI Scam Radar"
        subtitle="URL, SMS, Email & QR Phishing Detection"
      />

      {/* Scan Mode Segmented Selector */}
      <View style={styles.tabSelector}>
        <TouchableOpacity
          style={[styles.tabButton, scanType === 'url' && styles.tabButtonActive]}
          onPress={() => {
            setScanType('url');
            haptics.light();
          }}
        >
          <Link2 size={16} color={scanType === 'url' ? colors.accent.cyan : colors.text.muted} />
          <Text style={[styles.tabText, scanType === 'url' && styles.tabTextActive]}>URL</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, scanType === 'text' && styles.tabButtonActive]}
          onPress={() => {
            setScanType('text');
            haptics.light();
          }}
        >
          <MessageSquare size={16} color={scanType === 'text' ? colors.accent.cyan : colors.text.muted} />
          <Text style={[styles.tabText, scanType === 'text' && styles.tabTextActive]}>SMS / Text</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, scanType === 'email' && styles.tabButtonActive]}
          onPress={() => {
            setScanType('email');
            haptics.light();
          }}
        >
          <Mail size={16} color={scanType === 'email' ? colors.accent.cyan : colors.text.muted} />
          <Text style={[styles.tabText, scanType === 'email' && styles.tabTextActive]}>Email</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, scanType === 'qr' && styles.tabButtonActive]}
          onPress={() => {
            setScanType('qr');
            haptics.light();
          }}
        >
          <QrCode size={16} color={scanType === 'qr' ? colors.accent.cyan : colors.text.muted} />
          <Text style={[styles.tabText, scanType === 'qr' && styles.tabTextActive]}>QR Code</Text>
        </TouchableOpacity>
      </View>

      {/* Input Card */}
      <Card style={styles.inputCard}>
        {scanType === 'qr' ? (
          <View style={styles.qrActionSection}>
            <Button
              title="Launch Camera QR Scanner"
              onPress={() => router.push('/(modals)/qr-scanner')}
              icon={<QrCode size={20} color="#FFF" />}
              size="lg"
              style={{ width: '100%', marginBottom: spacing.md }}
            />
            <Text style={styles.orDivider}>— or paste raw QR payload below —</Text>
          </View>
        ) : null}

        <Input
          placeholder={
            scanType === 'url'
              ? 'Enter link (e.g., http://sbi-kyc-update-portal.xyz)'
              : scanType === 'text'
              ? 'Paste SMS message body or WhatsApp forward'
              : scanType === 'email'
              ? 'Paste email subject line & sender content'
              : 'Paste decoded QR URL or text'
          }
          value={content}
          onChangeText={setContent}
          multiline={scanType !== 'url'}
          numberOfLines={scanType === 'url' ? 1 : 4}
          inputStyle={scanType !== 'url' ? { height: 80, textAlignVertical: 'top' } : undefined}
        />

        <View style={styles.actionRow}>
          <Button
            title="Analyze Threat"
            onPress={() => triggerScan()}
            isLoading={isScanning}
            icon={<ScanLine size={18} color="#FFF" />}
            size="md"
            style={{ flex: 1 }}
          />
        </View>

        {/* Quick test sample pills */}
        <View style={styles.samplesContainer}>
          <Text style={styles.samplesLabel}>Test Sample Scams:</Text>
          <View style={styles.samplesRow}>
            <TouchableOpacity
              onPress={() => handlePreloadSample('url', 'http://free-recharge-offer.online/claim-500')}
              style={styles.samplePill}
            >
              <Text style={styles.samplePillText}>Fake Recharge URL</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                handlePreloadSample(
                  'text',
                  'Dear customer, your SBI account power will be blocked today due to pending KYC. Call 9876543210 immediately.'
                )
              }
              style={styles.samplePill}
            >
              <Text style={styles.samplePillText}>KYC Panic SMS</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Card>

      {errorMessage ? (
        <Card variant="danger" style={styles.errorCard}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </Card>
      ) : null}

      {/* Analysis Result Section */}
      {isScanning ? (
        <Card style={styles.scanningCard}>
          <ActivityIndicator size="large" color={colors.accent.cyan} />
          <Text style={styles.scanningTitle}>Analyzing Target with CyberSaathi AI</Text>
          <Text style={styles.scanningSub}>
            Inspecting URL reputation, domain age, typosquatting heuristics, and social engineering patterns...
          </Text>
        </Card>
      ) : scanResult ? (
        <Card
          variant={
            scanResult.verdict === 'DANGEROUS'
              ? 'danger'
              : scanResult.verdict === 'SUSPICIOUS'
              ? 'neon'
              : 'default'
          }
          style={styles.resultCard}
        >
          <View style={styles.resultHeader}>
            <Badge
              label={scanResult.verdict}
              variant={
                scanResult.verdict === 'DANGEROUS'
                  ? 'danger'
                  : scanResult.verdict === 'SUSPICIOUS'
                  ? 'warning'
                  : 'safe'
              }
            />
            <Text style={styles.resultDate}>
              {new Date(scanResult.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>

          <RiskGauge
            score={scanResult.riskScore}
            mode="risk"
            title="Calculated Threat Probability"
          />

          <View style={styles.summaryBox}>
            <Text style={styles.summaryTitle}>AI Analysis Summary</Text>
            <Text style={styles.summaryText}>{scanResult.summary}</Text>
          </View>

          {scanResult.explanation && scanResult.explanation.length > 0 ? (
            <View style={styles.factorsBox}>
              <Text style={styles.sectionSub}>Detected Threat Indicators:</Text>
              {scanResult.explanation.map((item, idx) => (
                <View key={idx} style={styles.factorItem}>
                  <AlertOctagon size={16} color={colors.status.danger} />
                  <Text style={styles.factorText}>{item}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {scanResult.recommendations && scanResult.recommendations.length > 0 ? (
            <View style={styles.adviceBox}>
              <Text style={styles.adviceTitle}>Protective Actions:</Text>
              {scanResult.recommendations.map((rec, idx) => (
                <View key={idx} style={styles.adviceItem}>
                  <CheckCircle2 size={16} color={colors.status.safe} />
                  <Text style={styles.adviceText}>{rec}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.bridgeActions}>
            <Button
              title="Open Incident Case in Investigation Room"
              onPress={() => router.push('/(tabs)/investigations')}
              variant="secondary"
              size="sm"
            />
          </View>
        </Card>
      ) : null}

      {/* History Toggle & List */}
      <View style={styles.historyToggleRow}>
        <TouchableOpacity
          onPress={() => setShowHistory(!showHistory)}
          style={styles.historyHeader}
        >
          <History size={18} color={colors.text.secondary} />
          <Text style={styles.historyTitle}>
            Scan History ({scanHistory.length})
          </Text>
        </TouchableOpacity>
      </View>

      {showHistory && scanHistory.length > 0 ? (
        <View style={styles.historyList}>
          {scanHistory.map((item) => (
            <Card key={item.id} style={styles.historyCard}>
              <View style={styles.historyTop}>
                <Badge
                  label={item.verdict}
                  variant={
                    item.verdict === 'DANGEROUS'
                      ? 'danger'
                      : item.verdict === 'SUSPICIOUS'
                      ? 'warning'
                      : 'safe'
                  }
                />
                <TouchableOpacity onPress={() => handleDeleteHistory(item.id)}>
                  <Trash2 size={16} color={colors.text.muted} />
                </TouchableOpacity>
              </View>
              <Text style={styles.historyTarget} numberOfLines={1}>
                {item.target}
              </Text>
              <Text style={styles.historySummary} numberOfLines={2}>
                {item.summary}
              </Text>
            </Card>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.lg,
    padding: 4,
    marginVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.glass,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    gap: 4,
  },
  tabButtonActive: {
    backgroundColor: '#0E1626',
    borderWidth: 1,
    borderColor: colors.accent.cyan,
  },
  tabText: {
    ...typography.caption,
    color: colors.text.muted,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.text.primary,
    fontWeight: '700',
  },
  inputCard: {
    marginBottom: spacing.base,
  },
  qrActionSection: {
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  orDivider: {
    ...typography.caption,
    color: colors.text.muted,
    marginBottom: spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  samplesContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  samplesLabel: {
    ...typography.caption,
    color: colors.text.muted,
    marginBottom: spacing.xs,
  },
  samplesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  samplePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border.glass,
  },
  samplePillText: {
    ...typography.caption,
    color: colors.accent.cyanLight,
  },
  errorCard: {
    marginBottom: spacing.base,
  },
  errorText: {
    ...typography.body2,
    color: colors.status.dangerLight,
  },
  scanningCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginVertical: spacing.md,
  },
  scanningTitle: {
    ...typography.subtitle1,
    color: colors.text.primary,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  scanningSub: {
    ...typography.body2,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    maxWidth: 280,
  },
  resultCard: {
    marginVertical: spacing.md,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  resultDate: {
    ...typography.caption,
    color: colors.text.muted,
  },
  summaryBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginVertical: spacing.sm,
  },
  summaryTitle: {
    ...typography.subtitle2,
    color: colors.text.primary,
    fontWeight: '700',
    marginBottom: 4,
  },
  summaryText: {
    ...typography.body2,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  factorsBox: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  sectionSub: {
    ...typography.caption,
    color: colors.status.dangerLight,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  factorItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: 2,
  },
  factorText: {
    ...typography.body2,
    color: colors.text.primary,
    flex: 1,
  },
  adviceBox: {
    marginTop: spacing.md,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  adviceTitle: {
    ...typography.caption,
    color: colors.status.safeLight,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  adviceItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: 4,
  },
  adviceText: {
    ...typography.body2,
    color: colors.text.primary,
    flex: 1,
  },
  bridgeActions: {
    marginTop: spacing.lg,
  },
  historyToggleRow: {
    marginVertical: spacing.md,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  historyTitle: {
    ...typography.subtitle2,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  historyList: {
    gap: spacing.sm,
    marginBottom: spacing.xxl,
  },
  historyCard: {
    padding: spacing.md,
  },
  historyTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  historyTarget: {
    ...typography.subtitle2,
    color: colors.text.primary,
    fontWeight: '600',
  },
  historySummary: {
    ...typography.body2,
    color: colors.text.muted,
    marginTop: 2,
  },
});
