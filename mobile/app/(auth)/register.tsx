import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Mail, Lock, Eye, EyeOff, UserPlus, CheckCircle2 } from 'lucide-react-native';
import { Screen, Input, Button, Card } from '../../src/components/ui';
import { colors, typography, spacing } from '../../src/theme';
import { useAuth } from '../../src/context/AuthContext';

export default function RegisterScreen() {
  const router = useRouter();
  const { signUpWithEmail, signInWithGoogle } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    if (!email.trim() || !password) {
      setErrorMessage('Please enter an email address and password.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    const { error } = await signUpWithEmail(email, password);
    setIsLoading(false);

    if (error) {
      setErrorMessage(error);
    } else {
      setSuccessMessage('Account created! Please check your email to verify your address or sign in.');
    }
  };

  return (
    <Screen scrollable showOfflineBanner={false}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <UserPlus size={36} color={colors.primary.light} />
        </View>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join CyberSaathi AI and shield yourself against online scams.</Text>
      </View>

      {errorMessage ? (
        <Card variant="danger" style={styles.errorCard}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </Card>
      ) : null}

      {successMessage ? (
        <Card style={styles.successCard}>
          <View style={styles.successRow}>
            <CheckCircle2 size={20} color={colors.status.safe} />
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
          <Button
            title="Proceed to Sign In"
            onPress={() => router.push('/(auth)/login')}
            size="sm"
            style={{ marginTop: spacing.md }}
          />
        </Card>
      ) : null}

      <View style={styles.form}>
        <Input
          label="Email Address"
          placeholder="name@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          leftIcon={<Mail size={18} color={colors.text.muted} />}
        />

        <Input
          label="Password (min. 8 characters)"
          placeholder="Choose a strong password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          leftIcon={<Lock size={18} color={colors.text.muted} />}
          rightIcon={
            showPassword ? (
              <EyeOff size={18} color={colors.text.muted} />
            ) : (
              <Eye size={18} color={colors.text.muted} />
            )
          }
          onRightIconPress={() => setShowPassword(!showPassword)}
        />

        <Input
          label="Confirm Password"
          placeholder="Repeat your password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!showPassword}
          leftIcon={<Lock size={18} color={colors.text.muted} />}
        />

        <Button
          title="Sign Up"
          onPress={handleRegister}
          isLoading={isLoading}
          size="lg"
          style={styles.submitButton}
        />

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or sign up with</Text>
          <View style={styles.dividerLine} />
        </View>

        <Button
          title="Google Account"
          onPress={signInWithGoogle}
          variant="secondary"
          size="md"
        />

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.signInLink}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderWidth: 1,
    borderColor: colors.primary.main,
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
  },
  errorCard: {
    marginBottom: spacing.base,
  },
  errorText: {
    ...typography.body2,
    color: colors.status.dangerLight,
  },
  successCard: {
    marginBottom: spacing.base,
    borderColor: colors.border.safe,
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  successText: {
    ...typography.body2,
    color: colors.status.safeLight,
    marginLeft: spacing.sm,
    flex: 1,
  },
  form: {
    marginTop: spacing.sm,
  },
  submitButton: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border.subtle,
  },
  dividerText: {
    ...typography.caption,
    color: colors.text.muted,
    marginHorizontal: spacing.md,
    textTransform: 'uppercase',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.xxl,
  },
  footerText: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  signInLink: {
    ...typography.body2,
    color: colors.primary.light,
    fontWeight: '700',
  },
});
