import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '../../src/services/supabase';
import { colors, typography, spacing } from '../../src/theme';

export default function AuthCallbackScreen() {
  const router = useRouter();

  useEffect(() => {
    async function handleUrlCallback() {
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          const urlObj = new URL(initialUrl);
          const hash = urlObj.hash.replace('#', '?');
          const params = new URLSearchParams(hash);
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
      } catch (err) {
        console.warn('[AuthCallback] Error processing callback:', err);
      } finally {
        router.replace('/(tabs)');
      }
    }

    handleUrlCallback();
  }, [router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary.main} />
      <Text style={styles.text}>Securing session...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  text: {
    ...typography.body1,
    color: colors.text.secondary,
  },
});
