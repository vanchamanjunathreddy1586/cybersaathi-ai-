import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, PhoneCall, ShieldAlert } from 'lucide-react-native';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { useHaptics } from '../../hooks/useHaptics';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  showEmergency?: boolean;
  rightAction?: React.ReactNode;
  style?: ViewStyle;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  showBack = false,
  showEmergency = true,
  rightAction,
  style,
}) => {
  const router = useRouter();
  const haptics = useHaptics();

  const handleCall1930 = () => {
    haptics.heavy();
    Linking.openURL('tel:1930').catch((err) => {
      console.warn('Failed to open dialer for 1930:', err);
    });
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.left}>
        {showBack ? (
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ChevronLeft size={24} color={colors.text.primary} />
          </TouchableOpacity>
        ) : null}

        <View style={styles.titleContainer}>
          {title ? (
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          ) : (
            <View style={styles.brandRow}>
              <ShieldAlert size={20} color={colors.accent.cyan} />
              <Text style={styles.brandText}>
                Cyber<Text style={styles.brandAccent}>Saathi</Text>
              </Text>
            </View>
          )}
          {subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.right}>
        {rightAction}
        {showEmergency && (
          <TouchableOpacity
            onPress={handleCall1930}
            style={styles.emergencyButton}
            accessibilityRole="button"
            accessibilityLabel="Call 1930 Cyber Fraud Helpline"
          >
            <PhoneCall size={14} color="#FFF" />
            <Text style={styles.emergencyText}>1930</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    padding: spacing.xs,
    marginRight: spacing.sm,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.text.muted,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandText: {
    ...typography.h3,
    color: colors.text.primary,
    fontWeight: '800',
    marginLeft: 6,
  },
  brandAccent: {
    color: colors.primary.light,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  emergencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.status.danger,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
    shadowColor: colors.status.danger,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  emergencyText: {
    ...typography.caption,
    color: '#FFF',
    fontWeight: '800',
    marginLeft: 4,
  },
});
