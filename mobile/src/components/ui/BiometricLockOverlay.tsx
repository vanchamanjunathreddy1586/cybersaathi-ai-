import React from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import { ShieldCheck, Fingerprint } from 'lucide-react-native';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { Button } from './Button';

export const BiometricLockOverlay: React.FC = () => {
  const { isBiometricLocked, unlockWithBiometrics, signOut } = useAuth();

  if (!isBiometricLocked) return null;

  return (
    <Modal visible={isBiometricLocked} animationType="fade" transparent={false}>
      <View style={styles.container}>
        <View style={styles.iconCircle}>
          <ShieldCheck size={56} color={colors.primary.light} />
        </View>

        <Text style={styles.title}>CyberSaathi Shield</Text>
        <Text style={styles.subtitle}>
          Your investigation records and security assets are protected by biometric encryption.
        </Text>

        <View style={styles.actions}>
          <Button
            title="Unlock with Biometrics"
            onPress={unlockWithBiometrics}
            icon={<Fingerprint size={20} color="#FFF" />}
            size="lg"
            style={styles.unlockButton}
          />

          <Button
            title="Sign Out"
            onPress={signOut}
            variant="ghost"
            size="sm"
            style={styles.signOutButton}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  iconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 2,
    borderColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    shadowColor: colors.primary.main,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 8,
  },
  title: {
    ...typography.h1,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body1,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xxl,
    maxWidth: 300,
  },
  actions: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.md,
  },
  unlockButton: {
    width: '100%',
  },
  signOutButton: {
    marginTop: spacing.sm,
  },
});
