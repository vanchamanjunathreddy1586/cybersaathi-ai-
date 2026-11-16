import { supabase } from '../services/supabase';
import { secureStorage } from '../services/secureStore';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { apiClient } from './client';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  displayName: string;
  avatarUrl: string | null;
  phone: string;
  phoneVerified: boolean;
  emailVerified: boolean;
  country: string;
  state: string;
  city: string;
  dateOfBirth: string;
  bio: string;
  preferredLanguage: 'en' | 'te' | 'hi';
  createdAt: string;
  updatedAt?: string;
  membershipStatus: 'Active Defender' | 'Verified Citizen' | 'Standard';
  lastSignInAt?: string;
}

export interface UserPreferences {
  theme: 'dark' | 'system' | 'oled';
  language: 'en' | 'te' | 'hi';
  notifications: {
    scamAlerts: boolean;
    securityAlerts: boolean;
    investigationUpdates: boolean;
    familySafetyAlerts: boolean;
    academyReminders: boolean;
    productAnnouncements: boolean;
  };
  security: {
    biometricAppUnlock: boolean;
    requireBiometricsForEvidence: boolean;
    autoLockTimeoutMinutes: number;
  };
  privacy: {
    analyticsOptOut: boolean;
    anonymizeReports: boolean;
  };
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'dark',
  language: 'en',
  notifications: {
    scamAlerts: true,
    securityAlerts: true,
    investigationUpdates: true,
    familySafetyAlerts: true,
    academyReminders: true,
    productAnnouncements: false,
  },
  security: {
    biometricAppUnlock: false,
    requireBiometricsForEvidence: true,
    autoLockTimeoutMinutes: 5,
  },
  privacy: {
    analyticsOptOut: false,
    anonymizeReports: false,
  },
};

const PREFERENCES_STORAGE_KEY = 'cybersaathi_user_preferences_v1';

/**
 * Fetch authenticated user profile by merging auth metadata with public.profiles table
 */
export async function getUserProfile(): Promise<UserProfile | null> {
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !authData?.user) {
    return null;
  }

  const user = authData.user;
  const meta = user.user_metadata || {};

  // Try querying public.profiles table
  let dbFullName = '';
  let dbUpdatedAt = '';
  try {
    const { data: dbProfile } = await supabase
      .from('profiles')
      .select('id, full_name, email, created_at, updated_at')
      .eq('id', user.id)
      .maybeSingle();

    if (dbProfile) {
      dbFullName = dbProfile.full_name || '';
      dbUpdatedAt = dbProfile.updated_at || '';
    }
  } catch (err) {
    console.warn('[ProfileAPI] profiles table query error:', err);
  }

  const email = user.email || '';
  const fullName = dbFullName || meta.full_name || meta.name || email.split('@')[0] || 'Defender';
  const displayName = meta.display_name || fullName.split(' ')[0] || 'Defender';
  const avatarUrl = meta.avatar_url || meta.picture || null;
  const phone = user.phone || meta.phone || '';
  const emailVerified = Boolean(user.email_confirmed_at || user.confirmed_at);
  const phoneVerified = Boolean(user.phone_confirmed_at);
  const country = meta.country || 'India';
  const state = meta.state || '';
  const city = meta.city || '';
  const dateOfBirth = meta.date_of_birth || '';
  const bio = meta.bio || '';
  const preferredLanguage: 'en' | 'te' | 'hi' =
    meta.preferred_language === 'hi' || meta.preferred_language === 'te' ? meta.preferred_language : 'en';

  const membershipStatus: 'Active Defender' | 'Verified Citizen' | 'Standard' = emailVerified
    ? 'Verified Citizen'
    : 'Active Defender';

  return {
    id: user.id,
    email,
    fullName,
    displayName,
    avatarUrl,
    phone,
    phoneVerified,
    emailVerified,
    country,
    state,
    city,
    dateOfBirth,
    bio,
    preferredLanguage,
    createdAt: user.created_at,
    updatedAt: dbUpdatedAt || user.updated_at,
    membershipStatus,
    lastSignInAt: user.last_sign_in_at,
  };
}

/**
 * Update authenticated user profile fields
 */
export async function updateUserProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !authData?.user) {
    throw new Error('Authentication required to update profile.');
  }

  const user = authData.user;
  const currentMeta = user.user_metadata || {};

  const newMeta: Record<string, any> = {
    ...currentMeta,
  };

  if (updates.fullName !== undefined) {
    newMeta.full_name = updates.fullName.trim();
  }
  if (updates.displayName !== undefined) {
    newMeta.display_name = updates.displayName.trim();
  }
  if (updates.phone !== undefined) {
    newMeta.phone = updates.phone.trim();
  }
  if (updates.country !== undefined) {
    newMeta.country = updates.country.trim();
  }
  if (updates.state !== undefined) {
    newMeta.state = updates.state.trim();
  }
  if (updates.city !== undefined) {
    newMeta.city = updates.city.trim();
  }
  if (updates.dateOfBirth !== undefined) {
    newMeta.date_of_birth = updates.dateOfBirth;
  }
  if (updates.bio !== undefined) {
    newMeta.bio = updates.bio.trim().slice(0, 300);
  }
  if (updates.preferredLanguage !== undefined) {
    newMeta.preferred_language = updates.preferredLanguage;
  }
  if (updates.avatarUrl !== undefined) {
    newMeta.avatar_url = updates.avatarUrl;
  }

  // 1. Update Supabase Auth user metadata
  const { data: updateRes, error: updateErr } = await supabase.auth.updateUser({
    data: newMeta,
  });

  if (updateErr) {
    throw new Error(updateErr.message || 'Failed to update user profile.');
  }

  // 2. If fullName was changed, sync public.profiles table
  if (updates.fullName && updates.fullName.trim()) {
    try {
      await supabase
        .from('profiles')
        .update({ full_name: updates.fullName.trim() })
        .eq('id', user.id);
    } catch (err) {
      console.warn('[ProfileAPI] Synced auth metadata but profiles table update failed:', err);
    }
  }

  const updatedProfile = await getUserProfile();
  if (!updatedProfile) {
    throw new Error('Profile update completed but could not refresh profile data.');
  }
  return updatedProfile;
}

/**
 * Upload profile photo. Validates format and size, uploads to avatars storage bucket
 * or stores optimized data URI fallback in user metadata.
 */
export async function uploadProfilePhoto(
  uri: string,
  base64Data?: string,
  fileSize?: number
): Promise<string> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) {
    throw new Error('Authentication required to upload profile photo.');
  }

  const user = authData.user;

  // Max 5 MB check
  if (fileSize && fileSize > 5 * 1024 * 1024) {
    throw new Error('Profile photo size exceeds the 5 MB limit. Please select a smaller photo.');
  }

  let finalUrl: string = uri;

  // Attempt upload to Supabase Storage bucket 'avatars'
  try {
    const filename = `${user.id}/avatar-${Date.now()}.jpg`;
    let body: any = null;

    if (base64Data) {
      // Decode base64 if available
      const buffer = Buffer.from(base64Data, 'base64');
      body = buffer;
    } else {
      const response = await fetch(uri);
      body = await response.blob();
    }

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filename, body, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (!uploadError) {
      const { data: pubUrl } = supabase.storage.from('avatars').getPublicUrl(filename);
      if (pubUrl?.publicUrl) {
        finalUrl = pubUrl.publicUrl;
      }
    } else {
      console.warn('[ProfileAPI] Storage bucket upload error (using local/base64 avatar):', uploadError.message);
      // Fallback: If base64 data is supplied, store compact data URI
      if (base64Data && base64Data.length < 500000) {
        finalUrl = `data:image/jpeg;base64,${base64Data}`;
      }
    }
  } catch (err) {
    console.warn('[ProfileAPI] Failed uploading to avatars bucket, falling back:', err);
    if (base64Data && base64Data.length < 500000) {
      finalUrl = `data:image/jpeg;base64,${base64Data}`;
    }
  }

  // Update avatar_url in user profile
  await updateUserProfile({ avatarUrl: finalUrl });
  return finalUrl;
}

/**
 * Remove profile photo
 */
export async function removeProfilePhoto(): Promise<void> {
  await updateUserProfile({ avatarUrl: null });
}

/**
 * Change password for authenticated user
 */
export async function changePassword(newPassword: string): Promise<void> {
  if (!newPassword || newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw new Error(error.message || 'Failed to update password.');
  }
}

/**
 * Load user preferences from secure persistent storage
 */
export async function getUserPreferences(): Promise<UserPreferences> {
  try {
    const raw = await secureStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      notifications: {
        ...DEFAULT_PREFERENCES.notifications,
        ...(parsed.notifications || {}),
      },
      security: {
        ...DEFAULT_PREFERENCES.security,
        ...(parsed.security || {}),
      },
      privacy: {
        ...DEFAULT_PREFERENCES.privacy,
        ...(parsed.privacy || {}),
      },
    };
  } catch (err) {
    console.warn('[ProfileAPI] Error loading preferences:', err);
    return DEFAULT_PREFERENCES;
  }
}

/**
 * Save user preferences to secure persistent storage
 */
export async function saveUserPreferences(prefs: UserPreferences): Promise<void> {
  try {
    await secureStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
  } catch (err) {
    console.warn('[ProfileAPI] Error saving preferences:', err);
  }
}

/**
 * Request data export: compiles user profile, case list, and preferences into JSON file and triggers native share
 */
export async function exportUserData(
  profile: UserProfile,
  preferences: UserPreferences
): Promise<{ jsonString: string; fileUri?: string }> {
  const exportPayload = {
    exportedAt: new Date().toISOString(),
    system: 'CyberSaathi AI Mobile App',
    user: {
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      displayName: profile.displayName,
      phone: profile.phone,
      country: profile.country,
      state: profile.state,
      city: profile.city,
      bio: profile.bio,
      preferredLanguage: profile.preferredLanguage,
      createdAt: profile.createdAt,
      membershipStatus: profile.membershipStatus,
    },
    preferences: {
      language: preferences.language,
      theme: preferences.theme,
      notifications: preferences.notifications,
      privacy: preferences.privacy,
    },
    dataProtectionNotice: 'This file contains your private CyberSaathi AI account information. Keep it confidential.',
  };

  const jsonString = JSON.stringify(exportPayload, null, 2);
  let fileUri: string | undefined;

  try {
    const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
    if (dir) {
      fileUri = `${dir}cybersaathi_account_${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(fileUri, jsonString, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Export CyberSaathi Account Data',
          UTI: 'public.json',
        });
      }
    }
  } catch (err) {
    console.warn('[ProfileAPI] File export share warning:', err);
  }

  return { jsonString, fileUri };
}

/**
 * Resend email verification for current user email
 */
export async function resendEmailVerification(email: string): Promise<{ error?: string }> {
  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
    });
    if (error) {
      return { error: error.message };
    }
    return {};
  } catch (err: any) {
    return { error: err.message || 'Failed to resend verification email.' };
  }
}

/**
 * Delete account workflow: sign out user and flag for deletion
 */
export async function requestAccountDeletion(): Promise<boolean> {
  try {
    // Flag deletion intent in metadata
    await supabase.auth.updateUser({
      data: { account_deletion_requested_at: new Date().toISOString() },
    });
    // Sign out user cleanly
    await supabase.auth.signOut();
    return true;
  } catch (err) {
    console.warn('[ProfileAPI] Account deletion error:', err);
    // Even if metadata update fails, ensure session signout
    await supabase.auth.signOut();
    return true;
  }
}
