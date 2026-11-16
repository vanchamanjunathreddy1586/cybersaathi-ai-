import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Mail, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react-native';
import { Screen, Input, Button, Card } from '../../src/components/ui';
import { colors, typography, spacing } from '../../src/theme';
import { useAuth } from '../../src/context/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const { signInWithEmail, signInWithGoogle } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleLogin = async () => {
    setErrorMessage('');
    if (!email.trim() || !password) {
      setErrorMessage('Please enter both email address and password.');
      return;
    }

    setIsLoading(true);
    const { error } = await signInWithEmail(email, password);
    setIsLoading(false);

    if (error) {
      setErrorMessage(error);
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMessage('');
    setIsGoogleLoading(true);
    const { error } = await signInWithGoogle();
    setIsGoogleLoading(false);

    if (error) {
      setErrorMessage(error);
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <Screen scrollable showOfflineBanner={false}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <ShieldCheck size={36} color={colors.accent.cyan} />
        </View>
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to access your CyberSaathi AI dashboard.</Text>
      </View>

      {errorMessage ? (
        <Card variant="danger" style={styles.errorCard}>
          <Text style={styles.errorText}>{errorMessage}</Text>
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
          label="Password"
          placeholder="Enter your password"
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

        <TouchableOpacity
          onPress={() => router.push('/(auth)/forgot-password')}
          style={styles.forgotButton}
        >
          <Text style={styles.forgotText}>Forgot password?</Text>
        </TouchableOpacity>

        <Button
          title="Sign In"
          onPress={handleLogin}
          isLoading={isLoading}
          size="lg"
          style={styles.submitButton}
        />

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or continue with</Text>
          <View style={styles.dividerLine} />
        </View>

        <Button
          title="Google Account"
          onPress={handleGoogleLogin}
          isLoading={isGoogleLoading}
          variant="secondary"
          size="md"
        />

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text style={styles.signUpLink}>Sign Up</Text>
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
  },
  errorCard: {
    marginBottom: spacing.base,
  },
  errorText: {
    ...typography.body2,
    color: colors.status.dangerLight,
    fontWeight: '500',
  },
  form: {
    marginTop: spacing.sm,
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: spacing.lg,
  },
  forgotText: {
    ...typography.caption,
    color: colors.primary.light,
    fontWeight: '600',
  },
  submitButton: {
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
  signUpLink: {
    ...typography.body2,
    color: colors.primary.light,
    fontWeight: '700',
  },
});
