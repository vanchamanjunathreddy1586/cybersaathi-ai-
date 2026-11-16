import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Users,
  X,
  Plus,
  UserCheck,
  ShieldAlert,
  Copy,
  Check,
  AlertTriangle,
  RefreshCw,
  Database,
  LogOut,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { Card, Input, Button, Badge } from '../../src/components/ui';
import { colors, typography, spacing, borderRadius } from '../../src/theme';
import {
  listFamilyCircles,
  createFamilyCircle,
  joinFamilyCircle,
  getCircleDetails,
  broadcastThreatAlert,
  leaveCircle,
  isMissingTableOrPendingError,
  FamilyCircle,
  FamilyAlert,
} from '../../src/api/family.api';
import { useHaptics } from '../../src/hooks/useHaptics';

export default function FamilyCircleModal() {
  const router = useRouter();
  const haptics = useHaptics();

  const [circles, setCircles] = useState<FamilyCircle[]>([]);
  const [selectedCircle, setSelectedCircle] = useState<FamilyCircle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPendingMigration, setIsPendingMigration] = useState(false);

  // Create Circle State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newCircleName, setNewCircleName] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Join Circle State
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [joinDisplayName, setJoinDisplayName] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  // Broadcast Alert State
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [threatType, setThreatType] = useState('Suspicious Digital Arrest Scam Call');
  const [severity, setSeverity] = useState<'high' | 'critical'>('critical');
  const [alertSummary, setAlertSummary] = useState('');
  const [alertAdvice, setAlertAdvice] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [recentAlerts, setRecentAlerts] = useState<FamilyAlert[]>([]);

  const [isCopiedCode, setIsCopiedCode] = useState(false);

  const loadCircleDetailsData = useCallback(async (circleId: string) => {
    setIsDetailsLoading(true);
    try {
      const details = await getCircleDetails(circleId);
      if (details) {
        setSelectedCircle(details);
        setRecentAlerts(details.alerts || []);
      }
    } catch (err) {
      console.warn('[FamilyCircleModal] getCircleDetails error:', err);
    } finally {
      setIsDetailsLoading(false);
    }
  }, []);

  const loadCircles = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    setIsPendingMigration(false);

    try {
      const res = await listFamilyCircles();
      if (res.isPendingMigration) {
        setIsPendingMigration(true);
        setCircles([]);
        setSelectedCircle(null);
        setRecentAlerts([]);
        setLoadError(
          res.errorMessage ||
            'Family Safety database tables are not initialized in Supabase. The migration script must be applied.'
        );
      } else if (res.errorMessage) {
        setLoadError(res.errorMessage);
        setCircles([]);
        setSelectedCircle(null);
        setRecentAlerts([]);
      } else {
        setCircles(res.circles);
        if (res.circles.length > 0) {
          const first = res.circles[0];
          setSelectedCircle(first);
          await loadCircleDetailsData(first.id);
        } else {
          setSelectedCircle(null);
          setRecentAlerts([]);
        }
      }
    } catch (err: any) {
      const pending = isMissingTableOrPendingError(err);
      setIsPendingMigration(pending);
      setCircles([]);
      setSelectedCircle(null);
      setRecentAlerts([]);
      setLoadError(
        pending
          ? 'Family Safety database tables are pending creation. Please apply the migration script in Supabase.'
          : err.message || 'Failed to connect to Family Safety circles.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [loadCircleDetailsData]);

  useEffect(() => {
    loadCircles();
  }, [loadCircles]);

  const handleSelectCircle = async (circle: FamilyCircle) => {
    if (circle.id === selectedCircle?.id) return;
    haptics.light();
    setSelectedCircle(circle);
    await loadCircleDetailsData(circle.id);
  };

  const handleCreate = async () => {
    if (!newCircleName.trim() || isCreating) return;
    setIsCreating(true);
    haptics.medium();

    try {
      const circle = await createFamilyCircle(newCircleName.trim(), newDisplayName.trim() || undefined);
      setIsCreateOpen(false);
      setNewCircleName('');
      setNewDisplayName('');
      haptics.success();
      await loadCircles();
      Alert.alert('Circle Created', `Family Circle "${circle.name}" is now active.`);
    } catch (err: any) {
      haptics.error();
      const isPending = isMissingTableOrPendingError(err);
      Alert.alert(
        'Create Circle Error',
        isPending
          ? 'Family Safety database tables are not initialized in Supabase. Please ask an administrator to run the migration script.'
          : err.message || 'Failed to create family circle.'
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoin = async () => {
    if (!inviteCodeInput.trim() || isJoining) return;
    setIsJoining(true);
    haptics.medium();

    try {
      const result = await joinFamilyCircle(inviteCodeInput.trim(), joinDisplayName.trim() || undefined);
      setIsJoinOpen(false);
      setInviteCodeInput('');
      setJoinDisplayName('');
      haptics.success();
      await loadCircles();
      Alert.alert('Joined Circle', `You are now protected under "${result.circle.name}".`);
    } catch (err: any) {
      haptics.error();
      const isPending = isMissingTableOrPendingError(err);
      Alert.alert(
        'Join Circle Error',
        isPending
          ? 'Family Safety database tables are not initialized in Supabase. The migration script must be applied.'
          : err.message || 'Invalid or expired invite code.'
      );
    } finally {
      setIsJoining(false);
    }
  };

  const handleBroadcast = async () => {
    if (!alertSummary.trim() || !selectedCircle || isBroadcasting) return;
    setIsBroadcasting(true);
    haptics.heavy();

    try {
      const newAlert = await broadcastThreatAlert(selectedCircle.id, {
        threatType,
        severity,
        summary: alertSummary.trim(),
        advice: alertAdvice.trim() || 'Disconnect suspicious callers immediately and verify with family.',
      });
      setRecentAlerts((prev) => [newAlert, ...prev]);
      setIsBroadcastOpen(false);
      setAlertSummary('');
      setAlertAdvice('');
      haptics.success();
      Alert.alert('Threat Broadcast Sent', 'All circle members have been alerted of this scam.');
    } catch (err: any) {
      haptics.error();
      const isPending = isMissingTableOrPendingError(err);
      Alert.alert(
        'Broadcast Failed',
        isPending
          ? 'Family Safety database tables are not initialized in Supabase.'
          : err.message || 'Failed to broadcast threat alert.'
      );
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleLeaveCircle = () => {
    if (!selectedCircle) return;
    Alert.alert(
      'Leave Circle',
      `Are you sure you want to leave "${selectedCircle.name}"? You will stop receiving emergency scam broadcasts from this circle.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            haptics.warning();
            const success = await leaveCircle(selectedCircle.id);
            if (success) {
              await loadCircles();
            } else {
              Alert.alert('Error', 'Failed to leave circle. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleCopyInviteCode = async () => {
    const code = selectedCircle?.inviteCode || selectedCircle?.invite_code;
    if (!code) return;
    haptics.light();
    try {
      await Clipboard.setStringAsync(code);
      setIsCopiedCode(true);
      setTimeout(() => setIsCopiedCode(false), 2000);
    } catch (err) {
      console.warn('Clipboard write error:', err);
    }
  };

  return (
    <View style={styles.container}>
      {/* Modal Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Family Safety Circles</Text>
          <Text style={styles.headerSubtitle}>
            Protect Elders & Relatives with Real-Time Threat Broadcasts
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
        {/* Loading Spinner */}
        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.accent.cyan} />
            <Text style={styles.loadingText}>Connecting to Family Safety Circles...</Text>
          </View>
        ) : null}

        {/* Database Migration Pending Card */}
        {!isLoading && isPendingMigration ? (
          <Card style={styles.migrationNoticeCard}>
            <View style={styles.stateIconRow}>
              <Database size={24} color={colors.status.warning} />
              <View style={styles.stateTextContainer}>
                <Text style={styles.migrationTitle}>Database Setup Required</Text>
                <Text style={styles.migrationDesc}>
                  The remote Supabase PostgreSQL database requires the Family Safety migration script to be applied.
                  Tables such as family_circles and family_circle_members are pending creation.
                </Text>
                <View style={styles.migrationScriptBox}>
                  <Text style={styles.migrationScriptLabel}>SQL Script:</Text>
                  <Text style={styles.migrationScriptName}>CYBERSAATHI_FAMILY_SAFETY_FINAL_MIGRATION.sql</Text>
                </View>
                <Button
                  title="Retry Connection"
                  onPress={loadCircles}
                  icon={<RefreshCw size={14} color="#FFF" />}
                  size="sm"
                  style={{ marginTop: spacing.sm }}
                />
              </View>
            </View>
          </Card>
        ) : null}

        {/* General Error State */}
        {!isLoading && !isPendingMigration && loadError ? (
          <Card style={styles.errorNoticeCard}>
            <View style={styles.stateIconRow}>
              <AlertTriangle size={24} color={colors.status.danger} />
              <View style={styles.stateTextContainer}>
                <Text style={styles.errorTitle}>Unable to Load Circles</Text>
                <Text style={styles.errorDesc}>{loadError}</Text>
                <Button
                  title="Retry"
                  onPress={loadCircles}
                  icon={<RefreshCw size={14} color="#FFF" />}
                  variant="secondary"
                  size="sm"
                  style={{ marginTop: spacing.sm }}
                />
              </View>
            </View>
          </Card>
        ) : null}

        {/* Action Buttons: Available when database is connected */}
        {!isLoading && !isPendingMigration && (
          <View style={styles.circleButtonsRow}>
            <Button
              title="Create Circle"
              onPress={() => setIsCreateOpen(true)}
              icon={<Plus size={16} color="#FFF" />}
              size="sm"
              style={{ flex: 1 }}
            />
            <Button
              title="Join with Code"
              onPress={() => setIsJoinOpen(true)}
              icon={<UserCheck size={16} color={colors.text.primary} />}
              variant="secondary"
              size="sm"
              style={{ flex: 1 }}
            />
          </View>
        )}

        {/* Empty State: Only when connected and circle list is genuinely 0 */}
        {!isLoading && !loadError && !isPendingMigration && circles.length === 0 ? (
          <Card variant="elevated" style={styles.emptyCard}>
            <View style={styles.emptyContent}>
              <View style={styles.emptyIconCircle}>
                <Users size={32} color={colors.accent.cyan} />
              </View>
              <Text style={styles.emptyTitle}>No Family Safety Circles Yet</Text>
              <Text style={styles.emptySubtitle}>
                Create a private circle for your household to coordinate protection against Digital Arrest scams,
                phishing, and extortion, or join an existing circle with an invite code.
              </Text>
            </View>
          </Card>
        ) : null}

        {/* Populated Circle View */}
        {!isLoading && !loadError && selectedCircle ? (
          <View style={styles.circleDetails}>
            {/* Circle Switcher Tabs if multiple circles */}
            {circles.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.switcherScroll}>
                <View style={styles.switcherContainer}>
                  {circles.map((c) => {
                    const isSelected = c.id === selectedCircle.id;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        onPress={() => handleSelectCircle(c)}
                        style={[styles.switcherTab, isSelected && styles.switcherTabActive]}
                      >
                        <Text
                          style={[styles.switcherTabText, isSelected && styles.switcherTabTextActive]}
                          numberOfLines={1}
                        >
                          {c.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            )}

            {/* Circle Info Card */}
            <Card variant="elevated" style={styles.circleInfoCard}>
              <View style={styles.circleTopRow}>
                <View style={{ flex: 1, marginRight: spacing.sm }}>
                  <Text style={styles.circleName}>{selectedCircle.name}</Text>
                  <Text style={styles.memberCount}>
                    {selectedCircle.memberCount ?? selectedCircle.members?.length ?? 1} Members Enrolled
                  </Text>
                </View>
                <View style={styles.topRightActions}>
                  <Badge label={selectedCircle.role?.toUpperCase() || 'MEMBER'} variant="safe" />
                  <TouchableOpacity
                    onPress={handleLeaveCircle}
                    style={styles.leaveButton}
                    accessibilityLabel="Leave circle"
                  >
                    <LogOut size={16} color={colors.text.muted} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Invite Code Pill */}
              <View style={styles.inviteCodeBox}>
                <View>
                  <Text style={styles.inviteLabel}>Family Invite Code:</Text>
                  <Text style={styles.inviteCode}>
                    {selectedCircle.inviteCode || selectedCircle.invite_code || 'N/A'}
                  </Text>
                </View>
                <TouchableOpacity onPress={handleCopyInviteCode} style={styles.copyButton}>
                  {isCopiedCode ? (
                    <Check size={16} color={colors.status.safe} />
                  ) : (
                    <Copy size={16} color={colors.accent.cyan} />
                  )}
                  <Text style={styles.copyText}>{isCopiedCode ? 'Copied' : 'Share'}</Text>
                </TouchableOpacity>
              </View>

              {/* Members List */}
              <Text style={styles.membersSubHeader}>Circle Members:</Text>
              {isDetailsLoading ? (
                <ActivityIndicator size="small" color={colors.accent.cyan} style={{ marginVertical: spacing.xs }} />
              ) : selectedCircle.members && selectedCircle.members.length > 0 ? (
                <View style={styles.membersList}>
                  {selectedCircle.members.map((m) => (
                    <View key={m.id} style={styles.memberPill}>
                      <Text style={styles.memberName}>{m.displayName || m.display_name || 'Member'}</Text>
                      <Text style={styles.memberRole}>({m.role})</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.noMembersText}>1 Member (You)</Text>
              )}

              {/* Emergency Threat Broadcast SOS Button */}
              <Button
                title="Broadcast Emergency Threat Alert to Family"
                onPress={() => setIsBroadcastOpen(true)}
                icon={<ShieldAlert size={18} color="#FFF" />}
                variant="danger"
                size="lg"
                style={{ marginTop: spacing.lg }}
              />
            </Card>

            {/* Live Alerts Feed */}
            <Text style={styles.sectionTitle}>Circle Threat Feed ({recentAlerts.length})</Text>
            {recentAlerts.length === 0 ? (
              <Card style={styles.emptyFeedCard}>
                <Text style={styles.emptyFeedText}>No threat alerts reported. Circle is currently secure.</Text>
              </Card>
            ) : (
              <View style={styles.alertsList}>
                {recentAlerts.map((alt) => (
                  <Card key={alt.id} variant="danger" style={styles.alertCard}>
                    <View style={styles.alertHeader}>
                      <Badge label={alt.severity.toUpperCase()} variant="danger" />
                      <Text style={styles.alertDate}>
                        {new Date(alt.createdAt || alt.created_at || Date.now()).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                    <Text style={styles.alertThreatType}>{alt.threatType || alt.threat_type}</Text>
                    <Text style={styles.alertSummary}>{alt.summary}</Text>
                    {alt.advice ? (
                      <View style={styles.adviceRow}>
                        <Text style={styles.adviceLabel}>Action Advice: </Text>
                        <Text style={styles.adviceText}>{alt.advice}</Text>
                      </View>
                    ) : null}
                    <Text style={styles.alertSender}>Broadcast by {alt.senderName || 'Circle Member'}</Text>
                  </Card>
                ))}
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>

      {/* Broadcast Alert Modal */}
      <Modal visible={isBroadcastOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Broadcast Threat Alert</Text>
            <Text style={styles.modalSubtitle}>
              Sends an urgent push alert to all members enrolled in this safety circle.
            </Text>

            <Input
              label="Threat Type *"
              value={threatType}
              onChangeText={setThreatType}
              editable={!isBroadcasting}
            />

            {/* Severity Selector */}
            <View style={styles.severityRow}>
              <TouchableOpacity
                onPress={() => setSeverity('high')}
                style={[styles.severityButton, severity === 'high' && styles.severityButtonActiveHigh]}
              >
                <Text style={[styles.severityButtonText, severity === 'high' && styles.severityTextActive]}>
                  High Severity
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSeverity('critical')}
                style={[styles.severityButton, severity === 'critical' && styles.severityButtonActiveCritical]}
              >
                <Text style={[styles.severityButtonText, severity === 'critical' && styles.severityTextActive]}>
                  Critical Emergency
                </Text>
              </TouchableOpacity>
            </View>

            <Input
              label="Alert Details & Scammer Tactics *"
              placeholder="e.g., Mom got a video call from fraudsters claiming to be Mumbai Customs regarding an illegal package."
              value={alertSummary}
              onChangeText={setAlertSummary}
              multiline
              numberOfLines={3}
              inputStyle={{ height: 75, textAlignVertical: 'top' }}
              editable={!isBroadcasting}
            />

            <Input
              label="Protective Advice for Family *"
              placeholder="e.g., Police never interrogate via video call. Do NOT transfer money. Hang up immediately."
              value={alertAdvice}
              onChangeText={setAlertAdvice}
              editable={!isBroadcasting}
            />

            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                onPress={() => setIsBroadcastOpen(false)}
                variant="ghost"
                size="md"
                disabled={isBroadcasting}
              />
              <Button
                title="Broadcast SOS"
                onPress={handleBroadcast}
                isLoading={isBroadcasting}
                disabled={isBroadcasting || !alertSummary.trim()}
                variant="danger"
                size="md"
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Create Circle Modal */}
      <Modal visible={isCreateOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Family Circle</Text>
            <Text style={styles.modalSubtitle}>
              Start a new circle to coordinate cyber protection for your family.
            </Text>
            <Input
              label="Circle Name *"
              placeholder="e.g., Kumar Family Defense"
              value={newCircleName}
              onChangeText={setNewCircleName}
              editable={!isCreating}
            />
            <Input
              label="Your Display Name in Circle"
              placeholder="e.g., Papa, Mom, Ankit"
              value={newDisplayName}
              onChangeText={setNewDisplayName}
              editable={!isCreating}
            />
            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                onPress={() => setIsCreateOpen(false)}
                variant="ghost"
                size="md"
                disabled={isCreating}
              />
              <Button
                title="Create"
                onPress={handleCreate}
                isLoading={isCreating}
                disabled={isCreating || !newCircleName.trim()}
                size="md"
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Join Circle Modal */}
      <Modal visible={isJoinOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Join Family Circle</Text>
            <Text style={styles.modalSubtitle}>
              Enter the invite code shared by your family circle guardian.
            </Text>
            <Input
              label="Invite Code *"
              placeholder="e.g., CS-8F4A2B"
              value={inviteCodeInput}
              onChangeText={setInviteCodeInput}
              autoCapitalize="characters"
              editable={!isJoining}
            />
            <Input
              label="Your Display Name"
              placeholder="e.g., Rahul"
              value={joinDisplayName}
              onChangeText={setJoinDisplayName}
              editable={!isJoining}
            />
            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                onPress={() => setIsJoinOpen(false)}
                variant="ghost"
                size="md"
                disabled={isJoining}
              />
              <Button
                title="Join Circle"
                onPress={handleJoin}
                isLoading={isJoining}
                disabled={isJoining || !inviteCodeInput.trim()}
                size="md"
                style={{ flex: 1 }}
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
  centerContainer: {
    paddingVertical: spacing.xxxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    ...typography.body2,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  stateIconRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stateTextContainer: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  migrationNoticeCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  migrationTitle: {
    ...typography.subtitle2,
    color: colors.status.warningLight,
    fontWeight: '700',
  },
  migrationDesc: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 4,
    lineHeight: 18,
  },
  migrationScriptBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: borderRadius.sm,
    padding: spacing.xs,
    marginTop: spacing.xs,
  },
  migrationScriptLabel: {
    ...typography.caption,
    fontSize: 10,
    color: colors.text.muted,
    textTransform: 'uppercase',
  },
  migrationScriptName: {
    ...typography.caption,
    fontFamily: 'monospace',
    color: colors.accent.cyanLight,
    fontWeight: '600',
    marginTop: 2,
  },
  errorNoticeCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  errorTitle: {
    ...typography.subtitle2,
    color: colors.status.dangerLight,
    fontWeight: '700',
  },
  errorDesc: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 4,
    lineHeight: 18,
  },
  emptyCard: {
    padding: spacing.xl,
    marginVertical: spacing.lg,
    alignItems: 'center',
  },
  emptyContent: {
    alignItems: 'center',
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    ...typography.body2,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 20,
    maxWidth: 320,
  },
  circleButtonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  switcherScroll: {
    marginBottom: spacing.sm,
  },
  switcherContainer: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  switcherTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background.elevated,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  switcherTabActive: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderColor: colors.accent.cyan,
  },
  switcherTabText: {
    ...typography.caption,
    color: colors.text.muted,
    fontWeight: '600',
  },
  switcherTabTextActive: {
    color: colors.accent.cyanLight,
    fontWeight: '700',
  },
  circleDetails: {
    gap: spacing.md,
  },
  circleInfoCard: {
    padding: spacing.md,
  },
  circleTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  leaveButton: {
    padding: spacing.xs,
  },
  circleName: {
    ...typography.h3,
    color: colors.text.primary,
    fontWeight: '800',
  },
  memberCount: {
    ...typography.caption,
    color: colors.accent.cyan,
    marginTop: 2,
    fontWeight: '600',
  },
  inviteCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: borderRadius.md,
    padding: spacing.sm + 2,
    marginVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.glass,
  },
  inviteLabel: {
    ...typography.caption,
    color: colors.text.muted,
  },
  inviteCode: {
    ...typography.subtitle1,
    color: colors.accent.cyanLight,
    fontWeight: '800',
    letterSpacing: 1,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  copyText: {
    ...typography.caption,
    color: colors.accent.cyanLight,
    fontWeight: '700',
  },
  membersSubHeader: {
    ...typography.caption,
    color: colors.text.muted,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  membersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  memberPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.elevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    gap: 4,
  },
  memberName: {
    ...typography.caption,
    color: colors.text.primary,
    fontWeight: '600',
  },
  memberRole: {
    ...typography.caption,
    color: colors.text.muted,
    fontSize: 10,
  },
  noMembersText: {
    ...typography.caption,
    color: colors.text.muted,
    fontStyle: 'italic',
  },
  sectionTitle: {
    ...typography.subtitle1,
    color: colors.text.primary,
    fontWeight: '700',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptyFeedCard: {
    padding: spacing.md,
    alignItems: 'center',
  },
  emptyFeedText: {
    ...typography.caption,
    color: colors.text.muted,
  },
  alertsList: {
    gap: spacing.sm,
    marginBottom: spacing.xxl,
  },
  alertCard: {
    padding: spacing.md,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  alertDate: {
    ...typography.caption,
    color: colors.text.muted,
  },
  alertThreatType: {
    ...typography.subtitle2,
    color: colors.status.dangerLight,
    fontWeight: '700',
  },
  alertSummary: {
    ...typography.body2,
    color: colors.text.primary,
    marginTop: 2,
    lineHeight: 18,
  },
  adviceRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  adviceLabel: {
    ...typography.caption,
    color: colors.accent.cyan,
    fontWeight: '700',
  },
  adviceText: {
    ...typography.caption,
    color: colors.text.secondary,
    flex: 1,
  },
  alertSender: {
    ...typography.caption,
    color: colors.text.muted,
    fontSize: 10,
    marginTop: spacing.xs,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background.secondary,
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border.glass,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.text.primary,
  },
  modalSubtitle: {
    ...typography.body2,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  severityRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  severityButton: {
    flex: 1,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.background.elevated,
    alignItems: 'center',
  },
  severityButtonActiveHigh: {
    borderColor: colors.status.warning,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  severityButtonActiveCritical: {
    borderColor: colors.status.danger,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  severityButtonText: {
    ...typography.caption,
    color: colors.text.muted,
    fontWeight: '600',
  },
  severityTextActive: {
    color: colors.text.primary,
    fontWeight: '700',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
