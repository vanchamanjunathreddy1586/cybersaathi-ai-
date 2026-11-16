import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Mail, KeyRound, CheckCircle2 } from 'lucide-react-native';
import { Screen, Input, Button, Card, Header } from '../../src/components/ui';
import { colors, typography, spacing } from '../../src/theme';
import { supabase } from '../../src/services/supabase';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleReset = async () => {
    setErrorMessage('');
    if (!email.trim()) {
      setErrorMessage('Please enter your account email address.');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: 'cybersaathi://auth/callback',
      });
      if (error) {
        setErrorMessage(error.message);
      } else {
        setIsSubmitted(true);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to send password reset request.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Screen scrollable showOfflineBanner={false}>
      <Header showBack showEmergency={false} />

      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <KeyRound size={36} color={colors.accent.cyan} />
        </View>
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>
          Enter your registered email address and we'll send you instructions to reset your password.
        </Text>
      </View>

      {errorMessage ? (
        <Card variant="danger" style={styles.cardSpacing}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </Card>
      ) : null}

      {isSubmitted ? (
        <Card style={styles.cardSpacing}>
          <View style={styles.successRow}>
            <CheckCircle2 size={24} color={colors.status.safe} />
            <View style={styles.successTextContainer}>
              <Text style={styles.successTitle}>Check your inbox</Text>
              <Text style={styles.successDesc}>
                If an account exists for {email}, a recovery link has been dispatched.
              </Text>
            </View>
          </View>
          <Button
            title="Return to Sign In"
            onPress={() => router.push('/(auth)/login')}
            size="md"
            style={{ marginTop: spacing.lg }}
          />
        </Card>
      ) : (
        <View style={styles.form}>
          <Input
            label="Account Email"
            placeholder="name@example.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            leftIcon={<Mail size={18} color={colors.text.muted} />}
          />

          <Button
            title="Send Recovery Link"
            onPress={handleReset}
            isLoading={isLoading}
            size="lg"
            style={styles.submitButton}
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderWidth: 1,
    borderColor: colors.accent.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.body1,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    maxWidth: 320,
  },
  cardSpacing: {
    marginBottom: spacing.lg,
  },
  errorText: {
    ...typography.body2,
    color: colors.status.dangerLight,
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  successTextContainer: {
    flex: 1,
    marginLeft: spacing.md,
  },
  successTitle: {
    ...typography.subtitle1,
    color: colors.text.primary,
    fontWeight: '700',
  },
  successDesc: {
    ...typography.body2,
    color: colors.text.secondary,
    marginTop: 4,
    lineHeight: 20,
  },
  form: {
    marginTop: spacing.sm,
  },
  submitButton: {
    marginTop: spacing.sm,
  },
});
