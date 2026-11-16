import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { supabase } from '../services/supabase';
import { secureStorage } from '../services/secureStore';
import { useBiometrics } from '../hooks/useBiometrics';

import { getUserProfile, UserProfile } from '../api/profile.api';

WebBrowser.maybeCompleteAuthSession();

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  refreshProfile: () => Promise<void>;
  isLoading: boolean;
  isBiometricLocked: boolean;
  isBiometricEnabled: boolean;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  unlockWithBiometrics: () => Promise<boolean>;
  lockApp: () => void;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const BIOMETRIC_ENABLED_KEY = 'cybersaathi_biometrics_enabled';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBiometricLocked, setIsBiometricLocked] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabledState] = useState(false);

  const { authenticate, isCompatible, isEnrolled } = useBiometrics();

  const refreshProfile = useCallback(async () => {
    try {
      const p = await getUserProfile();
      setProfile(p);
    } catch (err) {
      console.warn('[AuthProvider] Failed to refresh profile:', err);
    }
  }, []);

  // Load initial session and biometric preferences
  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      try {
        const { data } = await supabase.auth.getSession();
        if (mounted) {
          setSession(data.session);
          setUser(data.session?.user ?? null);
        }

        if (data.session?.user) {
          try {
            const p = await getUserProfile();
            if (mounted) setProfile(p);
          } catch (e) {
            console.warn('[AuthProvider] Initial profile load error:', e);
          }
        }

        // Check if biometric lock was enabled
        const bioPref = await secureStorage.getItem(BIOMETRIC_ENABLED_KEY);
        const shouldLock = bioPref === 'true' && isCompatible && isEnrolled;
        if (mounted) {
          setIsBiometricEnabledState(bioPref === 'true');
          if (shouldLock && data.session) {
            setIsBiometricLocked(true);
          }
        }
      } catch (err) {
        console.warn('[AuthProvider] Auth initialization error:', err);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    initializeAuth();

    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      if (mounted) {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setIsLoading(false);
      }
      if (currentSession?.user) {
        try {
          const p = await getUserProfile();
          if (mounted) setProfile(p);
        } catch (e) {
          console.warn('[AuthProvider] Auth-state profile load error:', e);
        }
      } else {
        if (mounted) setProfile(null);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [isCompatible, isEnrolled]);

  const unlockWithBiometrics = useCallback(async (): Promise<boolean> => {
    const success = await authenticate('Unlock CyberSaathi AI');
    if (success) {
      setIsBiometricLocked(false);
      return true;
    }
    return false;
  }, [authenticate]);

  const lockApp = useCallback(() => {
    if (isBiometricEnabled) {
      setIsBiometricLocked(true);
    }
  }, [isBiometricEnabled]);

  const setBiometricEnabled = useCallback(async (enabled: boolean) => {
    setIsBiometricEnabledState(enabled);
    await secureStorage.setItem(BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false');
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string): Promise<{ error?: string }> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        return { error: error.message };
      }
      return {};
    } catch (err: any) {
      return { error: err.message || 'Login failed. Please check network connection.' };
    }
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string): Promise<{ error?: string }> => {
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (error) {
        return { error: error.message };
      }
      return {};
    } catch (err: any) {
      return { error: err.message || 'Registration failed.' };
    }
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<{ error?: string }> => {
    try {
      const redirectUri = Linking.createURL('auth/callback');

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: Platform.OS !== 'web',
        },
      });

      if (error) return { error: error.message };
      if (!data?.url) return { error: 'Failed to generate Google Sign-In URL.' };

      if (Platform.OS !== 'web') {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
        if (result.type === 'success' && 'url' in result && result.url) {
          // Parse hash fragments and query params for PKCE or implicit auth
          const urlObj = new URL(result.url);
          const params = new URLSearchParams(urlObj.hash.replace('#', '?'));
          const accessToken = params.get('access_token') || urlObj.searchParams.get('access_token');
          const refreshToken = params.get('refresh_token') || urlObj.searchParams.get('refresh_token');
          const code = urlObj.searchParams.get('code') || params.get('code');

          if (code) {
            await supabase.auth.exchangeCodeForSession(code);
          } else if (accessToken && refreshToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
          }
        }
      }
      return {};
    } catch (err: any) {
      return { error: err.message || 'Google OAuth failed.' };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setProfile(null);
      setIsBiometricLocked(false);
    } catch (err) {
      console.warn('[AuthProvider] Sign out error:', err);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        refreshProfile,
        isLoading,
        isBiometricLocked,
        isBiometricEnabled,
        setBiometricEnabled,
        unlockWithBiometrics,
        lockApp,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
