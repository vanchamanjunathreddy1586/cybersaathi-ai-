import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  ScrollView,
  Switch,
  Alert,
  Platform,
  Linking,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import {
  User,
  Mail,
  Phone,
  Shield,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Fingerprint,
  Globe,
  Moon,
  Bell,
  FileDown,
  FileText,
  HelpCircle,
  PhoneCall,
  ExternalLink,
  LogOut,
  Trash2,
  Camera,
  Check,
  Copy,
  ChevronRight,
  X,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Smartphone,
  Calendar,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { Screen, Header, Card, Button, Badge } from '../../src/components/ui';
import { colors, typography, spacing, borderRadius } from '../../src/theme';
import { useAuth } from '../../src/context/AuthContext';
import { useHaptics } from '../../src/hooks/useHaptics';
import {
  UserProfile,
  UserPreferences,
  DEFAULT_PREFERENCES,
  getUserPreferences,
  saveUserPreferences,
  updateUserProfile,
  uploadProfilePhoto,
  removeProfilePhoto,
  changePassword,
  exportUserData,
  resendEmailVerification,
  requestAccountDeletion,
} from '../../src/api/profile.api';

export default function ProfileScreen() {
  const router = useRouter();
  const haptics = useHaptics();
  const {
    user,
    profile,
    refreshProfile,
    signOut,
    isBiometricEnabled,
    setBiometricEnabled,
  } = useAuth();

  // Screen refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Preferences state
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);

  // Modals state
  const [isPhotoModalVisible, setIsPhotoModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [isNotificationsModalVisible, setIsNotificationsModalVisible] = useState(false);
  const [isLanguageModalVisible, setIsLanguageModalVisible] = useState(false);
  const [isThemeModalVisible, setIsThemeModalVisible] = useState(false);
  const [isPrivacyModalVisible, setIsPrivacyModalVisible] = useState(false);
  const [isTermsModalVisible, setIsTermsModalVisible] = useState(false);
  const [isFaqModalVisible, setIsFaqModalVisible] = useState(false);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);

  // Edit Profile Form State
  const [editFullName, setEditFullName] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCountry, setEditCountry] = useState('India');
  const [editState, setEditState] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editDob, setEditDob] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editLang, setEditLang] = useState<'en' | 'te' | 'hi'>('en');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [editFormError, setEditFormError] = useState('');

  // Password Change Form State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Delete Account Confirmation State
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // FAQ Accordion State
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // Load preferences
  useEffect(() => {
    let mounted = true;
    getUserPreferences().then((prefs) => {
      if (mounted) setPreferences(prefs);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Sync edit form state with current profile
  useEffect(() => {
    if (profile) {
      setEditFullName(profile.fullName || '');
      setEditDisplayName(profile.displayName || '');
      setEditPhone(profile.phone || '');
      setEditCountry(profile.country || 'India');
      setEditState(profile.state || '');
      setEditCity(profile.city || '');
      setEditDob(profile.dateOfBirth || '');
      setEditBio(profile.bio || '');
      setEditLang(profile.preferredLanguage || 'en');
    }
  }, [profile]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    haptics.light();
    await refreshProfile();
    const prefs = await getUserPreferences();
    setPreferences(prefs);
    setIsRefreshing(false);
  }, [refreshProfile, haptics]);

  // Copy User ID
  const handleCopyUserId = async () => {
    if (!profile?.id) return;
    haptics.medium();
    await Clipboard.setStringAsync(profile.id);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  // Resend Email Verification
  const handleResendVerification = async () => {
    if (!profile?.email) return;
    haptics.light();
    const { error } = await resendEmailVerification(profile.email);
    if (error) {
      Alert.alert('Verification Error', error);
    } else {
      Alert.alert(
        'Verification Sent',
        `A verification email has been sent to ${profile.email}. Please check your inbox and spam folder.`
      );
    }
  };

  // Photo Management
  const handleTakePhoto = async () => {
    setIsPhotoModalVisible(false);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera permission is required to take a profile photo.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        setIsUploadingPhoto(true);
        haptics.medium();
        await uploadProfilePhoto(asset.uri, asset.base64 || undefined, asset.fileSize);
        await refreshProfile();
        haptics.success();
      }
    } catch (err: any) {
      console.warn('[ProfileScreen] Camera error:', err);
      Alert.alert('Upload Failed', err.message || 'Could not upload photo.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handlePickFromGallery = async () => {
    setIsPhotoModalVisible(false);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Gallery access is required to choose a profile photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        setIsUploadingPhoto(true);
        haptics.medium();
        await uploadProfilePhoto(asset.uri, asset.base64 || undefined, asset.fileSize);
        await refreshProfile();
        haptics.success();
      }
    } catch (err: any) {
      console.warn('[ProfileScreen] Gallery error:', err);
      Alert.alert('Upload Failed', err.message || 'Could not upload photo.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    setIsPhotoModalVisible(false);
    try {
      setIsUploadingPhoto(true);
      haptics.warning();
      await removeProfilePhoto();
      await refreshProfile();
      haptics.success();
    } catch (err: any) {
      Alert.alert('Error', 'Could not remove photo.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Edit Profile Save
  const handleSaveProfile = async () => {
    setEditFormError('');
    if (!editFullName.trim() || editFullName.trim().length < 2) {
      setEditFormError('Full name must be at least 2 characters.');
      return;
    }

    if (editPhone.trim() && !/^\+?[0-9\s-]{10,15}$/.test(editPhone.trim())) {
      setEditFormError('Please enter a valid phone number (10-15 digits).');
      return;
    }

    try {
      setIsSavingProfile(true);
      haptics.medium();
      await updateUserProfile({
        fullName: editFullName.trim(),
        displayName: editDisplayName.trim() || editFullName.trim().split(' ')[0],
        phone: editPhone.trim(),
        country: editCountry.trim(),
        state: editState.trim(),
        city: editCity.trim(),
        dateOfBirth: editDob.trim(),
        bio: editBio.trim(),
        preferredLanguage: editLang,
      });

      // Update preferences language as well
      const updatedPrefs: UserPreferences = {
        ...preferences,
        language: editLang,
      };
      setPreferences(updatedPrefs);
      await saveUserPreferences(updatedPrefs);

      await refreshProfile();
      haptics.success();
      setIsEditModalVisible(false);
    } catch (err: any) {
      console.warn('[ProfileScreen] Save error:', err);
      setEditFormError(err.message || 'Failed to update profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Change Password
  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');

    if (!newPassword || newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    try {
      setIsChangingPassword(true);
      haptics.medium();
      await changePassword(newPassword);
      setPasswordSuccess('Password changed successfully.');
      setNewPassword('');
      setConfirmPassword('');
      haptics.success();
      setTimeout(() => {
        setIsPasswordModalVisible(false);
        setPasswordSuccess('');
      }, 1500);
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to change password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Toggle Notification Preference
  const handleToggleNotification = async (key: keyof UserPreferences['notifications']) => {
    haptics.light();
    const updated: UserPreferences = {
      ...preferences,
      notifications: {
        ...preferences.notifications,
        [key]: !preferences.notifications[key],
      },
    };
    setPreferences(updated);
    await saveUserPreferences(updated);
  };

  // Toggle Theme
  const handleSelectTheme = async (mode: 'dark' | 'system' | 'oled') => {
    haptics.medium();
    const updated: UserPreferences = {
      ...preferences,
      theme: mode,
    };
    setPreferences(updated);
    await saveUserPreferences(updated);
    setIsThemeModalVisible(false);
  };

  // Select Language
  const handleSelectLanguage = async (lang: 'en' | 'te' | 'hi') => {
    haptics.medium();
    const updated: UserPreferences = {
      ...preferences,
      language: lang,
    };
    setPreferences(updated);
    await saveUserPreferences(updated);
    setEditLang(lang);
    await updateUserProfile({ preferredLanguage: lang });
    await refreshProfile();
    setIsLanguageModalVisible(false);
  };

  // Export Data
  const handleExportData = async () => {
    if (!profile) return;
    try {
      haptics.medium();
      await exportUserData(profile, preferences);
      Alert.alert(
        'Data Exported',
        'Your CyberSaathi AI account data and defense telemetry have been packaged securely for export.'
      );
    } catch (err: any) {
      Alert.alert('Export Failed', err.message || 'Could not export account data.');
    }
  };

  // Sign Out
  const handleSignOutPress = () => {
    haptics.warning();
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of CyberSaathi AI on this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/(auth)/welcome');
          },
        },
      ]
    );
  };

  // Delete Account
  const handleConfirmDeleteAccount = async () => {
    if (deleteConfirmationInput.trim().toUpperCase() !== 'DELETE') {
      Alert.alert('Verification Mismatch', 'Please type DELETE in capital letters to confirm.');
      return;
    }

    try {
      setIsDeletingAccount(true);
      haptics.heavy();
      await requestAccountDeletion();
      setIsDeleteModalVisible(false);
      Alert.alert(
        'Account Deletion Requested',
        'Your CyberSaathi AI account has been marked for deletion and your session has ended.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/welcome') }]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to process account deletion request.');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  // Helper date formatting
  const formattedCreationDate = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : 'Recent Defender';

  const userInitials = (profile?.fullName || user?.email || 'Defender')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const getLanguageLabel = (lang: 'en' | 'te' | 'hi') => {
    switch (lang) {
      case 'te':
        return 'తెలుగు (Telugu)';
      case 'hi':
        return 'हिन्दी (Hindi)';
      case 'en':
      default:
        return 'English';
    }
  };

  const getThemeLabel = (theme: 'dark' | 'system' | 'oled') => {
    switch (theme) {
      case 'oled':
        return 'OLED Pure Black';
      case 'system':
        return 'System Match';
      case 'dark':
      default:
        return 'Deep Navy (Dark)';
    }
  };

  return (
    <Screen
      scrollable
      contentContainerStyle={{ paddingBottom: spacing.xxxl }}
    >
      <Header
        title="Profile & Account"
        subtitle="Credentials, Defense Posture & Preferences"
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary.light}
            colors={[colors.primary.light]}
          />
        }
      >
        {/* ========================================================= */}
        {/* SECTION 1: PROFILE HERO CARD                              */}
        {/* ========================================================= */}
        <Card variant="elevated" style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            {/* Avatar with Camera badge */}
            <View style={styles.avatarWrapper}>
              {profile?.avatarUrl ? (
                <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitialsText}>{userInitials}</Text>
                </View>
              )}

              {isUploadingPhoto && (
                <View style={styles.avatarLoadingOverlay}>
                  <ActivityIndicator size="small" color="#FFF" />
                </View>
              )}

              <TouchableOpacity
                onPress={() => setIsPhotoModalVisible(true)}
                style={styles.avatarCameraBadge}
                accessibilityRole="button"
                accessibilityLabel="Change profile photo"
              >
                <Camera size={14} color="#FFF" />
              </TouchableOpacity>
            </View>

            {/* Profile Identity Info */}
            <View style={styles.heroIdentity}>
              <View style={styles.nameRow}>
                <Text style={styles.heroFullName} numberOfLines={1}>
                  {profile?.fullName || 'Cyber Defender'}
                </Text>
                {profile?.emailVerified && (
                  <ShieldCheck size={18} color={colors.status.safeLight} style={styles.verifiedIcon} />
                )}
              </View>

              {profile?.displayName ? (
                <Text style={styles.heroDisplayName}>@{profile.displayName}</Text>
              ) : null}

              <View style={styles.badgeRow}>
                <Badge
                  label={profile?.membershipStatus || 'Active Defender'}
                  variant={profile?.membershipStatus === 'Verified Citizen' ? 'safe' : 'info'}
                  style={styles.membershipBadge}
                />
              </View>
            </View>
          </View>

          {/* User Details Grid */}
          <View style={styles.detailsGrid}>
            {/* Email Row */}
            <View style={styles.detailItem}>
              <Mail size={16} color={colors.text.muted} style={styles.detailIcon} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Email Address</Text>
                <Text style={styles.detailValue} numberOfLines={1}>
                  {profile?.email || user?.email || 'Not available'}
                </Text>
              </View>
              {profile?.emailVerified ? (
                <Badge label="Verified" variant="safe" style={styles.statusBadgeSmall} />
              ) : (
                <TouchableOpacity
                  onPress={handleResendVerification}
                  style={styles.unverifiedBtn}
                >
                  <Text style={styles.unverifiedBtnText}>Verify</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Phone Row */}
            <View style={styles.detailItem}>
              <Phone size={16} color={colors.text.muted} style={styles.detailIcon} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Phone Number</Text>
                <Text style={styles.detailValue}>
                  {profile?.phone || 'Not linked'}
                </Text>
              </View>
              {profile?.phone ? (
                <Badge
                  label={profile.phoneVerified ? 'Verified' : 'Unverified'}
                  variant={profile.phoneVerified ? 'safe' : 'neutral'}
                  style={styles.statusBadgeSmall}
                />
              ) : null}
            </View>

            {/* Location Row (if set) */}
            {(profile?.city || profile?.state || profile?.country) ? (
              <View style={styles.detailItem}>
                <Globe size={16} color={colors.text.muted} style={styles.detailIcon} />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Location</Text>
                  <Text style={styles.detailValue}>
                    {[profile.city, profile.state, profile.country].filter(Boolean).join(', ')}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Member Since Row */}
            <View style={styles.detailItem}>
              <Calendar size={16} color={colors.text.muted} style={styles.detailIcon} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Member Since</Text>
                <Text style={styles.detailValue}>{formattedCreationDate}</Text>
              </View>
            </View>

            {/* User ID Row */}
            <View style={styles.detailItem}>
              <Shield size={16} color={colors.text.muted} style={styles.detailIcon} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>CyberSaathi UUID</Text>
                <Text style={styles.detailValueMono} numberOfLines={1}>
                  {profile?.id || user?.id || '—'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleCopyUserId}
                style={styles.copyButton}
                accessibilityRole="button"
                accessibilityLabel="Copy User ID"
              >
                {copyFeedback ? (
                  <Check size={14} color={colors.status.safeLight} />
                ) : (
                  <Copy size={14} color={colors.accent.cyan} />
                )}
                <Text style={[styles.copyButtonText, copyFeedback && { color: colors.status.safeLight }]}>
                  {copyFeedback ? 'Copied' : 'Copy'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Edit Profile CTA */}
          <Button
            title="Edit Profile"
            onPress={() => setIsEditModalVisible(true)}
            variant="outline"
            size="md"
            style={styles.editProfileBtn}
          />
        </Card>

        {/* ========================================================= */}
        {/* SECTION 2: ACCOUNT SECURITY                               */}
        {/* ========================================================= */}
        <Text style={styles.sectionTitle}>Account Security</Text>
        <Card variant="default" style={styles.menuCard}>
          {/* Change Password */}
          <TouchableOpacity
            onPress={() => setIsPasswordModalVisible(true)}
            style={styles.menuRow}
            accessibilityRole="button"
            accessibilityLabel="Change Password"
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconContainer, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                <KeyRound size={20} color="#60A5FA" />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>Change Password</Text>
                <Text style={styles.menuSubtitle}>Update your master authentication key</Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.text.muted} />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* Biometric Unlock */}
          <View style={styles.menuRow}>
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconContainer, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
                <Fingerprint size={20} color={colors.status.safeLight} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>Biometric App Shield</Text>
                <Text style={styles.menuSubtitle}>Require Fingerprint / Face ID to unlock app</Text>
              </View>
            </View>
            <Switch
              value={isBiometricEnabled}
              onValueChange={async (val) => {
                haptics.medium();
                await setBiometricEnabled(val);
              }}
              trackColor={{ false: '#334155', true: colors.primary.main }}
              thumbColor={isBiometricEnabled ? colors.accent.cyan : '#94A3B8'}
            />
          </View>

          <View style={styles.menuDivider} />

          {/* Device & Session Info */}
          <View style={styles.menuRow}>
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconContainer, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
                <Smartphone size={20} color="#C084FC" />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>Active Device</Text>
                <Text style={styles.menuSubtitle}>
                  {Device.modelName || Platform.OS.toUpperCase()} &bull; OS {Device.osVersion || Platform.Version}
                </Text>
              </View>
            </View>
            <Badge label="Current" variant="safe" style={styles.statusBadgeSmall} />
          </View>
        </Card>

        {/* ========================================================= */}
        {/* SECTION 3: PREFERENCES & LOCALIZATION                     */}
        {/* ========================================================= */}
        <Text style={styles.sectionTitle}>Preferences</Text>
        <Card variant="default" style={styles.menuCard}>
          {/* Language Selector */}
          <TouchableOpacity
            onPress={() => setIsLanguageModalVisible(true)}
            style={styles.menuRow}
            accessibilityRole="button"
            accessibilityLabel="Change Language"
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconContainer, { backgroundColor: 'rgba(234, 179, 8, 0.15)' }]}>
                <Globe size={20} color="#FACC15" />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>Language</Text>
                <Text style={styles.menuSubtitle}>{getLanguageLabel(preferences.language)}</Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.text.muted} />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* Theme Selector */}
          <TouchableOpacity
            onPress={() => setIsThemeModalVisible(true)}
            style={styles.menuRow}
            accessibilityRole="button"
            accessibilityLabel="Change Theme"
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconContainer, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
                <Moon size={20} color={colors.accent.cyan} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>Theme Appearance</Text>
                <Text style={styles.menuSubtitle}>{getThemeLabel(preferences.theme)}</Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.text.muted} />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* Notifications Config */}
          <TouchableOpacity
            onPress={() => setIsNotificationsModalVisible(true)}
            style={styles.menuRow}
            accessibilityRole="button"
            accessibilityLabel="Notification Preferences"
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconContainer, { backgroundColor: 'rgba(244, 63, 94, 0.15)' }]}>
                <Bell size={20} color="#FB7185" />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>Notification Settings</Text>
                <Text style={styles.menuSubtitle}>Configure scam, advisory and safety alerts</Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.text.muted} />
          </TouchableOpacity>
        </Card>

        {/* ========================================================= */}
        {/* SECTION 4: PRIVACY & DATA GOVERNANCE                      */}
        {/* ========================================================= */}
        <Text style={styles.sectionTitle}>Privacy & Data Governance</Text>
        <Card variant="default" style={styles.menuCard}>
          {/* Download Account Data */}
          <TouchableOpacity
            onPress={handleExportData}
            style={styles.menuRow}
            accessibilityRole="button"
            accessibilityLabel="Export Data"
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconContainer, { backgroundColor: 'rgba(14, 165, 233, 0.15)' }]}>
                <FileDown size={20} color="#38BDF8" />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>Download Account Data</Text>
                <Text style={styles.menuSubtitle}>Export profile, case metadata and telemetry (JSON)</Text>
              </View>
            </View>
            <ExternalLink size={18} color={colors.text.muted} />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* Privacy Policy */}
          <TouchableOpacity
            onPress={() => setIsPrivacyModalVisible(true)}
            style={styles.menuRow}
            accessibilityRole="button"
            accessibilityLabel="Privacy Policy"
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconContainer, { backgroundColor: 'rgba(148, 163, 184, 0.15)' }]}>
                <FileText size={20} color="#CBD5E1" />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>Privacy Policy</Text>
                <Text style={styles.menuSubtitle}>Data protection, encryption and zero-knowledge model</Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.text.muted} />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* Terms of Service */}
          <TouchableOpacity
            onPress={() => setIsTermsModalVisible(true)}
            style={styles.menuRow}
            accessibilityRole="button"
            accessibilityLabel="Terms of Service"
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconContainer, { backgroundColor: 'rgba(148, 163, 184, 0.15)' }]}>
                <FileText size={20} color="#CBD5E1" />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>Terms of Service</Text>
                <Text style={styles.menuSubtitle}>Platform guidelines and acceptable use</Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.text.muted} />
          </TouchableOpacity>
        </Card>

        {/* ========================================================= */}
        {/* SECTION 5: SUPPORT & ABOUT                                */}
        {/* ========================================================= */}
        <Text style={styles.sectionTitle}>Support & About</Text>
        <Card variant="default" style={styles.menuCard}>
          {/* 1930 Helpline */}
          <TouchableOpacity
            onPress={() => Linking.openURL('tel:1930')}
            style={styles.menuRow}
            accessibilityRole="button"
            accessibilityLabel="Call 1930 Cyber Fraud Helpline"
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconContainer, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                <PhoneCall size={20} color={colors.status.danger} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>National Cyber Crime Helpline (1930)</Text>
                <Text style={styles.menuSubtitle}>Immediate 24x7 financial fraud freeze hotline</Text>
              </View>
            </View>
            <Badge label="24x7" variant="danger" style={styles.statusBadgeSmall} />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* Support Email */}
          <TouchableOpacity
            onPress={() => Linking.openURL('mailto:support@cybersaathi.org?subject=CyberSaathi%20Mobile%20Support')}
            style={styles.menuRow}
            accessibilityRole="button"
            accessibilityLabel="Contact CyberSaathi Support"
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconContainer, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                <Mail size={20} color="#60A5FA" />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>Contact Support</Text>
                <Text style={styles.menuSubtitle}>support@cybersaathi.org</Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.text.muted} />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* FAQs */}
          <TouchableOpacity
            onPress={() => setIsFaqModalVisible(true)}
            style={styles.menuRow}
            accessibilityRole="button"
            accessibilityLabel="Frequently Asked Questions"
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconContainer, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
                <HelpCircle size={20} color="#C084FC" />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>Cyber Safety FAQ</Text>
                <Text style={styles.menuSubtitle}>Guides, fraud prevention and incident recovery</Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.text.muted} />
          </TouchableOpacity>
        </Card>

        {/* ========================================================= */}
        {/* SECTION 6: SESSION & DANGER ZONE                          */}
        {/* ========================================================= */}
        <View style={styles.dangerSection}>
          <Button
            title="Sign Out"
            onPress={handleSignOutPress}
            variant="outline"
            size="lg"
            icon={<LogOut size={18} color={colors.status.dangerLight} />}
            style={styles.signOutBtn}
            textStyle={{ color: colors.status.dangerLight }}
          />

          <TouchableOpacity
            onPress={() => setIsDeleteModalVisible(true)}
            style={styles.deleteAccountBtn}
            accessibilityRole="button"
            accessibilityLabel="Request account deletion"
          >
            <Trash2 size={16} color={colors.text.muted} />
            <Text style={styles.deleteAccountText}>Request Account Deletion</Text>
          </TouchableOpacity>
        </View>

        {/* About App Footer */}
        <View style={styles.appFooter}>
          <Text style={styles.appFooterTitle}>CyberSaathi AI &bull; Mobile Defense</Text>
          <Text style={styles.appFooterTagline}>Your Digital World. Our Protection.</Text>
          <Text style={styles.appFooterVersion}>
            Version {Constants.expoConfig?.version || '1.0.0'} (Build 1) &bull; Engine v4.8
          </Text>
        </View>
      </ScrollView>

      {/* ========================================================= */}
      {/* MODAL 1: PHOTO PICKER OPTIONS                             */}
      {/* ========================================================= */}
      <Modal
        visible={isPhotoModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsPhotoModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsPhotoModalVisible(false)}
        >
          <View style={styles.photoSheetContainer}>
            <Text style={styles.sheetTitle}>Profile Photo</Text>
            <Text style={styles.sheetSubtitle}>Choose a photo to represent your citizen defender profile</Text>

            <TouchableOpacity onPress={handleTakePhoto} style={styles.sheetOption}>
              <Camera size={20} color={colors.accent.cyan} />
              <Text style={styles.sheetOptionText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handlePickFromGallery} style={styles.sheetOption}>
              <ImagePickerIcon size={20} color={colors.primary.light} />
              <Text style={styles.sheetOptionText}>Choose from Gallery</Text>
            </TouchableOpacity>

            {profile?.avatarUrl ? (
              <TouchableOpacity onPress={handleRemovePhoto} style={styles.sheetOption}>
                <Trash2 size={20} color={colors.status.dangerLight} />
                <Text style={[styles.sheetOptionText, { color: colors.status.dangerLight }]}>
                  Remove Current Photo
                </Text>
              </TouchableOpacity>
            ) : null}

            <Button
              title="Cancel"
              onPress={() => setIsPhotoModalVisible(false)}
              variant="ghost"
              size="md"
              style={{ marginTop: spacing.sm }}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 2: EDIT PROFILE                                     */}
      {/* ========================================================= */}
      <Modal
        visible={isEditModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <View style={styles.fullModalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>Edit Profile</Text>
            <TouchableOpacity
              onPress={() => setIsEditModalVisible(false)}
              style={styles.modalCloseBtn}
            >
              <X size={20} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {editFormError ? (
              <View style={styles.formErrorBox}>
                <AlertTriangle size={16} color={colors.status.dangerLight} />
                <Text style={styles.formErrorText}>{editFormError}</Text>
              </View>
            ) : null}

            <Text style={styles.inputLabel}>Full Name *</Text>
            <TextInput
              value={editFullName}
              onChangeText={setEditFullName}
              placeholder="e.g. Ramesh Kumar"
              placeholderTextColor={colors.text.muted}
              style={styles.formInput}
            />

            <Text style={styles.inputLabel}>Display Name / Alias</Text>
            <TextInput
              value={editDisplayName}
              onChangeText={setEditDisplayName}
              placeholder="e.g. RameshK"
              placeholderTextColor={colors.text.muted}
              style={styles.formInput}
            />

            <Text style={styles.inputLabel}>Phone Number</Text>
            <TextInput
              value={editPhone}
              onChangeText={setEditPhone}
              placeholder="e.g. +91 9876543210"
              keyboardType="phone-pad"
              placeholderTextColor={colors.text.muted}
              style={styles.formInput}
            />

            <Text style={styles.inputLabel}>Country</Text>
            <TextInput
              value={editCountry}
              onChangeText={setEditCountry}
              placeholder="e.g. India"
              placeholderTextColor={colors.text.muted}
              style={styles.formInput}
            />

            <View style={styles.formRow}>
              <View style={{ flex: 1, marginRight: spacing.sm }}>
                <Text style={styles.inputLabel}>State</Text>
                <TextInput
                  value={editState}
                  onChangeText={setEditState}
                  placeholder="e.g. Telangana"
                  placeholderTextColor={colors.text.muted}
                  style={styles.formInput}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>City</Text>
                <TextInput
                  value={editCity}
                  onChangeText={setEditCity}
                  placeholder="e.g. Hyderabad"
                  placeholderTextColor={colors.text.muted}
                  style={styles.formInput}
                />
              </View>
            </View>

            <Text style={styles.inputLabel}>Date of Birth (YYYY-MM-DD)</Text>
            <TextInput
              value={editDob}
              onChangeText={setEditDob}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.text.muted}
              style={styles.formInput}
            />

            <Text style={styles.inputLabel}>Short Bio</Text>
            <TextInput
              value={editBio}
              onChangeText={setEditBio}
              placeholder="Citizen cyber defender..."
              placeholderTextColor={colors.text.muted}
              multiline
              numberOfLines={3}
              maxLength={200}
              style={[styles.formInput, { height: 80, textAlignVertical: 'top' }]}
            />

            <Button
              title="Save Profile Changes"
              onPress={handleSaveProfile}
              isLoading={isSavingProfile}
              variant="primary"
              size="lg"
              style={{ marginTop: spacing.lg, marginBottom: spacing.xxl }}
            />
          </ScrollView>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 3: CHANGE PASSWORD                                  */}
      {/* ========================================================= */}
      <Modal
        visible={isPasswordModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsPasswordModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsPasswordModalVisible(false)}
        >
          <View style={styles.dialogContainer}>
            <View style={styles.dialogHeader}>
              <Text style={styles.dialogTitle}>Change Password</Text>
              <TouchableOpacity onPress={() => setIsPasswordModalVisible(false)}>
                <X size={20} color={colors.text.muted} />
              </TouchableOpacity>
            </View>

            {passwordError ? (
              <View style={styles.formErrorBox}>
                <AlertTriangle size={16} color={colors.status.dangerLight} />
                <Text style={styles.formErrorText}>{passwordError}</Text>
              </View>
            ) : null}

            {passwordSuccess ? (
              <View style={styles.formSuccessBox}>
                <CheckCircle2 size={16} color={colors.status.safeLight} />
                <Text style={styles.formSuccessText}>{passwordSuccess}</Text>
              </View>
            ) : null}

            <Text style={styles.inputLabel}>New Password (min 8 chars)</Text>
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={colors.text.muted}
              style={styles.formInput}
            />

            <Text style={styles.inputLabel}>Confirm New Password</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={colors.text.muted}
              style={styles.formInput}
            />

            <View style={styles.dialogActions}>
              <Button
                title="Cancel"
                onPress={() => setIsPasswordModalVisible(false)}
                variant="ghost"
                size="md"
                style={{ flex: 1, marginRight: spacing.sm }}
              />
              <Button
                title="Update"
                onPress={handleChangePassword}
                isLoading={isChangingPassword}
                variant="primary"
                size="md"
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 4: NOTIFICATION PREFERENCES                         */}
      {/* ========================================================= */}
      <Modal
        visible={isNotificationsModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsNotificationsModalVisible(false)}
      >
        <View style={styles.fullModalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>Notification Preferences</Text>
            <TouchableOpacity
              onPress={() => setIsNotificationsModalVisible(false)}
              style={styles.modalCloseBtn}
            >
              <X size={20} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.modalSectionIntro}>
              Fine-tune the security alerts and advisory push notifications delivered to your device.
            </Text>

            <View style={styles.prefRow}>
              <View style={styles.prefTextContainer}>
                <Text style={styles.prefTitle}>Scam & Phishing Alerts</Text>
                <Text style={styles.prefDesc}>Instant warnings for viral phishing campaigns & fraud patterns</Text>
              </View>
              <Switch
                value={preferences.notifications.scamAlerts}
                onValueChange={() => handleToggleNotification('scamAlerts')}
                trackColor={{ false: '#334155', true: colors.primary.main }}
                thumbColor={preferences.notifications.scamAlerts ? colors.accent.cyan : '#94A3B8'}
              />
            </View>

            <View style={styles.prefDivider} />

            <View style={styles.prefRow}>
              <View style={styles.prefTextContainer}>
                <Text style={styles.prefTitle}>Security Advisories</Text>
                <Text style={styles.prefDesc}>Government and CERT-In national cyber warnings</Text>
              </View>
              <Switch
                value={preferences.notifications.securityAlerts}
                onValueChange={() => handleToggleNotification('securityAlerts')}
                trackColor={{ false: '#334155', true: colors.primary.main }}
                thumbColor={preferences.notifications.securityAlerts ? colors.accent.cyan : '#94A3B8'}
              />
            </View>

            <View style={styles.prefDivider} />

            <View style={styles.prefRow}>
              <View style={styles.prefTextContainer}>
                <Text style={styles.prefTitle}>Investigation Updates</Text>
                <Text style={styles.prefDesc}>Status progression on your reported cyber incident cases</Text>
              </View>
              <Switch
                value={preferences.notifications.investigationUpdates}
                onValueChange={() => handleToggleNotification('investigationUpdates')}
                trackColor={{ false: '#334155', true: colors.primary.main }}
                thumbColor={preferences.notifications.investigationUpdates ? colors.accent.cyan : '#94A3B8'}
              />
            </View>

            <View style={styles.prefDivider} />

            <View style={styles.prefRow}>
              <View style={styles.prefTextContainer}>
                <Text style={styles.prefTitle}>Family Safety Alerts</Text>
                <Text style={styles.prefDesc}>Urgent notifications if a family circle member triggers an SOS</Text>
              </View>
              <Switch
                value={preferences.notifications.familySafetyAlerts}
                onValueChange={() => handleToggleNotification('familySafetyAlerts')}
                trackColor={{ false: '#334155', true: colors.primary.main }}
                thumbColor={preferences.notifications.familySafetyAlerts ? colors.accent.cyan : '#94A3B8'}
              />
            </View>

            <View style={styles.prefDivider} />

            <View style={styles.prefRow}>
              <View style={styles.prefTextContainer}>
                <Text style={styles.prefTitle}>Academy Reminders</Text>
                <Text style={styles.prefDesc}>Micro-lessons and defensive cyber quiz refreshers</Text>
              </View>
              <Switch
                value={preferences.notifications.academyReminders}
                onValueChange={() => handleToggleNotification('academyReminders')}
                trackColor={{ false: '#334155', true: colors.primary.main }}
                thumbColor={preferences.notifications.academyReminders ? colors.accent.cyan : '#94A3B8'}
              />
            </View>

            <View style={styles.prefDivider} />

            <View style={styles.prefRow}>
              <View style={styles.prefTextContainer}>
                <Text style={styles.prefTitle}>Product Announcements</Text>
                <Text style={styles.prefDesc}>New defensive features and engine updates</Text>
              </View>
              <Switch
                value={preferences.notifications.productAnnouncements}
                onValueChange={() => handleToggleNotification('productAnnouncements')}
                trackColor={{ false: '#334155', true: colors.primary.main }}
                thumbColor={preferences.notifications.productAnnouncements ? colors.accent.cyan : '#94A3B8'}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 5: LANGUAGE SELECTOR                                */}
      {/* ========================================================= */}
      <Modal
        visible={isLanguageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsLanguageModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsLanguageModalVisible(false)}
        >
          <View style={styles.dialogContainer}>
            <Text style={styles.dialogTitle}>Select Language</Text>
            <Text style={styles.dialogSubtitle}>Choose your preferred interface language</Text>

            <TouchableOpacity
              onPress={() => handleSelectLanguage('en')}
              style={[styles.langOption, preferences.language === 'en' && styles.langOptionActive]}
            >
              <Text style={styles.langOptionText}>English</Text>
              {preferences.language === 'en' && <Check size={18} color={colors.accent.cyan} />}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleSelectLanguage('te')}
              style={[styles.langOption, preferences.language === 'te' && styles.langOptionActive]}
            >
              <Text style={styles.langOptionText}>తెలుగు (Telugu)</Text>
              {preferences.language === 'te' && <Check size={18} color={colors.accent.cyan} />}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleSelectLanguage('hi')}
              style={[styles.langOption, preferences.language === 'hi' && styles.langOptionActive]}
            >
              <Text style={styles.langOptionText}>हिन्दी (Hindi)</Text>
              {preferences.language === 'hi' && <Check size={18} color={colors.accent.cyan} />}
            </TouchableOpacity>

            <Button
              title="Close"
              onPress={() => setIsLanguageModalVisible(false)}
              variant="ghost"
              size="md"
              style={{ marginTop: spacing.md }}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 6: THEME SELECTOR                                   */}
      {/* ========================================================= */}
      <Modal
        visible={isThemeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsThemeModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsThemeModalVisible(false)}
        >
          <View style={styles.dialogContainer}>
            <Text style={styles.dialogTitle}>Appearance Theme</Text>
            <Text style={styles.dialogSubtitle}>Select your color scheme preference</Text>

            <TouchableOpacity
              onPress={() => handleSelectTheme('dark')}
              style={[styles.langOption, preferences.theme === 'dark' && styles.langOptionActive]}
            >
              <Text style={styles.langOptionText}>Deep Navy (Dark Default)</Text>
              {preferences.theme === 'dark' && <Check size={18} color={colors.accent.cyan} />}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleSelectTheme('oled')}
              style={[styles.langOption, preferences.theme === 'oled' && styles.langOptionActive]}
            >
              <Text style={styles.langOptionText}>OLED Pure Black (High Contrast)</Text>
              {preferences.theme === 'oled' && <Check size={18} color={colors.accent.cyan} />}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleSelectTheme('system')}
              style={[styles.langOption, preferences.theme === 'system' && styles.langOptionActive]}
            >
              <Text style={styles.langOptionText}>System Match</Text>
              {preferences.theme === 'system' && <Check size={18} color={colors.accent.cyan} />}
            </TouchableOpacity>

            <Button
              title="Close"
              onPress={() => setIsThemeModalVisible(false)}
              variant="ghost"
              size="md"
              style={{ marginTop: spacing.md }}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 7: PRIVACY POLICY                                   */}
      {/* ========================================================= */}
      <Modal
        visible={isPrivacyModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsPrivacyModalVisible(false)}
      >
        <View style={styles.fullModalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>Privacy Policy</Text>
            <TouchableOpacity onPress={() => setIsPrivacyModalVisible(false)} style={styles.modalCloseBtn}>
              <X size={20} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <Text style={styles.legalSectionTitle}>1. Data Protection Commitment</Text>
            <Text style={styles.legalParagraph}>
              CyberSaathi AI is built on privacy-first security principles. We do not sell or monetize personal citizen data. Evidence files uploaded during fraud investigations are encrypted in transit via TLS 1.3 and at rest with AES-256 GCM.
            </Text>

            <Text style={styles.legalSectionTitle}>2. Threat Telemetry</Text>
            <Text style={styles.legalParagraph}>
              Scanned URLs, QR codes, and phone numbers are evaluated against verified threat intelligence feeds and on-device machine learning models. Content flagged as malicious is anonymized before contributing to community fraud advisories.
            </Text>

            <Text style={styles.legalSectionTitle}>3. Family Safety Geolocation</Text>
            <Text style={styles.legalParagraph}>
              Location data collected during Family Safety SOS events is shared strictly with authorized circle members and never retained beyond the active emergency response window.
            </Text>

            <Text style={styles.legalSectionTitle}>4. Data Subject Rights</Text>
            <Text style={styles.legalParagraph}>
              Citizens have full sovereignty over their account data. You may export your complete data record at any time or request permanent account deletion via this screen.
            </Text>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 8: TERMS OF SERVICE                                 */}
      {/* ========================================================= */}
      <Modal
        visible={isTermsModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsTermsModalVisible(false)}
      >
        <View style={styles.fullModalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>Terms of Service</Text>
            <TouchableOpacity onPress={() => setIsTermsModalVisible(false)} style={styles.modalCloseBtn}>
              <X size={20} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <Text style={styles.legalSectionTitle}>1. Citizen Defense Service</Text>
            <Text style={styles.legalParagraph}>
              CyberSaathi AI provides algorithmic cyber threat assessment, digital forensics assistance, and guided incident recovery. It does not replace official law enforcement agencies or statutory reporting obligations.
            </Text>

            <Text style={styles.legalSectionTitle}>2. Golden Hour Assistance</Text>
            <Text style={styles.legalParagraph}>
              The 1930 Helpline routing and Golden Hour recovery guidance are provided in alignment with National Cyber Crime Reporting Portal directives to facilitate immediate bank freeze workflows.
            </Text>

            <Text style={styles.legalSectionTitle}>3. Acceptable Use</Text>
            <Text style={styles.legalParagraph}>
              Users must not submit fraudulent case reports, reverse-engineer proprietary threat scanning algorithms, or use the platform for offensive cyber operations.
            </Text>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 9: FAQ ACCORDION                                    */}
      {/* ========================================================= */}
      <Modal
        visible={isFaqModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsFaqModalVisible(false)}
      >
        <View style={styles.fullModalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>Cyber Safety FAQ</Text>
            <TouchableOpacity onPress={() => setIsFaqModalVisible(false)} style={styles.modalCloseBtn}>
              <X size={20} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {[
              {
                q: 'What should I do first if I lost money to an online scam?',
                a: 'Immediately call 1930 (National Cyber Crime Helpline) within the "Golden Hour" (first 2 hours). Provide your transaction reference (UTR) and bank details so nodal officers can trigger an emergency freeze on the recipient account.',
              },
              {
                q: 'How does the CyberSaathi QR & Link Scanner work?',
                a: 'Our engine inspects URL structure, SSL certificate authority, domain age, typosquatting vectors, and known malicious IP databases to give you an instant risk verdict before you open the link.',
              },
              {
                q: 'Is my biometric data stored on CyberSaathi servers?',
                a: 'No. Biometric authentication (Fingerprint / Face ID) is processed entirely by your device hardware via Android BiometricPrompt and never transmitted across the network.',
              },
              {
                q: 'How do I download evidence for filing a formal FIR?',
                a: 'Go to the Cases tab, tap your reported incident, and select "Export Forensic Dossier (PDF)". This generates a court-ready summary including timestamped evidence hashes.',
              },
            ].map((item, idx) => (
              <View key={idx} style={styles.faqCard}>
                <TouchableOpacity
                  onPress={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                  style={styles.faqHeader}
                >
                  <Text style={styles.faqQuestion}>{item.q}</Text>
                  {expandedFaq === idx ? (
                    <ChevronUp size={18} color={colors.accent.cyan} />
                  ) : (
                    <ChevronDown size={18} color={colors.text.muted} />
                  )}
                </TouchableOpacity>
                {expandedFaq === idx ? (
                  <Text style={styles.faqAnswer}>{item.a}</Text>
                ) : null}
              </View>
            ))}

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 10: DELETE ACCOUNT                                  */}
      {/* ========================================================= */}
      <Modal
        visible={isDeleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsDeleteModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsDeleteModalVisible(false)}
        >
          <View style={styles.dialogContainer}>
            <View style={styles.dialogHeader}>
              <Text style={[styles.dialogTitle, { color: colors.status.dangerLight }]}>
                Delete Account
              </Text>
              <TouchableOpacity onPress={() => setIsDeleteModalVisible(false)}>
                <X size={20} color={colors.text.muted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.deleteWarningText}>
              Warning: This action will permanently revoke your credentials, archive your case dossiers, and remove you from all family safety circles. This cannot be undone.
            </Text>

            <Text style={styles.inputLabel}>Type "DELETE" to confirm:</Text>
            <TextInput
              value={deleteConfirmationInput}
              onChangeText={setDeleteConfirmationInput}
              placeholder="DELETE"
              autoCapitalize="characters"
              placeholderTextColor={colors.text.muted}
              style={[styles.formInput, { borderColor: colors.status.danger }]}
            />

            <View style={styles.dialogActions}>
              <Button
                title="Cancel"
                onPress={() => setIsDeleteModalVisible(false)}
                variant="ghost"
                size="md"
                style={{ flex: 1, marginRight: spacing.sm }}
              />
              <Button
                title="Confirm Deletion"
                onPress={handleConfirmDeleteAccount}
                isLoading={isDeletingAccount}
                disabled={deleteConfirmationInput.trim().toUpperCase() !== 'DELETE'}
                variant="danger"
                size="md"
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </Screen>
  );
}

// Small icon helper
function ImagePickerIcon({ size, color }: { size: number; color: string }) {
  return <FileText size={size} color={color} />;
}

const styles = StyleSheet.create({
  heroCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: '#0E1626',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: spacing.md,
  },
  avatarImage: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: colors.accent.cyan,
  },
  avatarFallback: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.accent.cyan,
  },
  avatarInitialsText: {
    ...typography.h3,
    color: '#FFF',
    fontWeight: '800',
  },
  avatarLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 34,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary.main,
    borderWidth: 1.5,
    borderColor: '#0E1626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIdentity: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroFullName: {
    ...typography.h3,
    color: colors.text.primary,
    fontWeight: '800',
    flexShrink: 1,
  },
  verifiedIcon: {
    marginLeft: 6,
  },
  heroDisplayName: {
    ...typography.caption,
    color: colors.accent.cyan,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  membershipBadge: {
    alignSelf: 'flex-start',
  },
  detailsGrid: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  detailIcon: {
    marginRight: spacing.sm,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    ...typography.caption,
    color: colors.text.muted,
    fontSize: 11,
  },
  detailValue: {
    ...typography.body2,
    color: colors.text.primary,
    fontWeight: '600',
  },
  detailValueMono: {
    ...typography.caption,
    color: colors.text.secondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
  },
  statusBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  unverifiedBtn: {
    backgroundColor: colors.status.warningBg,
    borderColor: colors.status.warning,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  unverifiedBtnText: {
    ...typography.caption,
    color: colors.status.warningLight,
    fontWeight: '700',
    fontSize: 11,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderColor: colors.accent.cyan,
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  copyButtonText: {
    ...typography.caption,
    color: colors.accent.cyan,
    fontWeight: '700',
    fontSize: 11,
    marginLeft: 4,
  },
  editProfileBtn: {
    marginTop: spacing.md,
  },
  sectionTitle: {
    ...typography.subtitle1,
    color: colors.text.primary,
    fontWeight: '700',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  menuCard: {
    padding: 0,
    backgroundColor: '#0E1626',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  menuIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    ...typography.subtitle2,
    color: colors.text.primary,
    fontWeight: '700',
  },
  menuSubtitle: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: 2,
  },
  menuDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginLeft: 54,
  },
  dangerSection: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  signOutBtn: {
    borderColor: colors.status.danger,
  },
  deleteAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  deleteAccountText: {
    ...typography.caption,
    color: colors.text.muted,
    marginLeft: spacing.xs,
    textDecorationLine: 'underline',
  },
  appFooter: {
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.xxl,
  },
  appFooterTitle: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '700',
  },
  appFooterTagline: {
    ...typography.caption,
    color: colors.accent.cyan,
    marginTop: 2,
  },
  appFooterVersion: {
    ...typography.caption,
    color: colors.text.muted,
    fontSize: 11,
    marginTop: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  photoSheetContainer: {
    backgroundColor: '#0E1626',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  sheetTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontWeight: '700',
  },
  sheetSubtitle: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  sheetOptionText: {
    ...typography.subtitle2,
    color: colors.text.primary,
    marginLeft: spacing.md,
    fontWeight: '600',
  },
  fullModalContainer: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  modalHeaderTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontWeight: '700',
  },
  modalCloseBtn: {
    padding: spacing.xs,
  },
  modalBody: {
    flex: 1,
    padding: spacing.lg,
  },
  modalSectionIntro: {
    ...typography.body2,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  inputLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '600',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  formInput: {
    backgroundColor: '#0E1626',
    borderWidth: 1,
    borderColor: colors.border.glass,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    color: colors.text.primary,
    ...typography.body2,
  },
  formRow: {
    flexDirection: 'row',
  },
  formErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.status.dangerBg,
    borderColor: colors.status.danger,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  formErrorText: {
    ...typography.caption,
    color: colors.status.dangerLight,
    marginLeft: spacing.xs,
    flex: 1,
  },
  formSuccessBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.status.safeBg,
    borderColor: colors.border.safe,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  formSuccessText: {
    ...typography.caption,
    color: colors.status.safeLight,
    marginLeft: spacing.xs,
    flex: 1,
  },
  dialogContainer: {
    backgroundColor: '#0E1626',
    margin: spacing.lg,
    marginBottom: 'auto',
    marginTop: 'auto',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.glass,
  },
  dialogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  dialogTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontWeight: '700',
  },
  dialogSubtitle: {
    ...typography.caption,
    color: colors.text.muted,
    marginBottom: spacing.md,
  },
  dialogActions: {
    flexDirection: 'row',
    marginTop: spacing.lg,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  prefTextContainer: {
    flex: 1,
    marginRight: spacing.md,
  },
  prefTitle: {
    ...typography.subtitle2,
    color: colors.text.primary,
    fontWeight: '700',
  },
  prefDesc: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: 2,
  },
  prefDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: spacing.xs,
  },
  langOptionActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderColor: colors.accent.cyan,
  },
  langOptionText: {
    ...typography.subtitle2,
    color: colors.text.primary,
    fontWeight: '600',
  },
  legalSectionTitle: {
    ...typography.subtitle1,
    color: colors.accent.cyan,
    fontWeight: '700',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  legalParagraph: {
    ...typography.body2,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  faqCard: {
    backgroundColor: '#0E1626',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  faqQuestion: {
    ...typography.subtitle2,
    color: colors.text.primary,
    fontWeight: '700',
    flex: 1,
    marginRight: spacing.sm,
  },
  faqAnswer: {
    ...typography.body2,
    color: colors.text.secondary,
    marginTop: spacing.sm,
    lineHeight: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: spacing.xs,
  },
  deleteWarningText: {
    ...typography.body2,
    color: colors.status.dangerLight,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
});
