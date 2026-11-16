import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, typography, borderRadius, spacing } from '../../theme';

export type BadgeVariant = 'safe' | 'warning' | 'danger' | 'info' | 'neutral';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'neutral', style, icon }) => {
  const getColors = () => {
    switch (variant) {
      case 'safe':
        return { bg: colors.status.safeBg, text: colors.status.safeLight, border: colors.border.safe };
      case 'warning':
        return { bg: colors.status.warningBg, text: colors.status.warningLight, border: colors.status.warning };
      case 'danger':
        return { bg: colors.status.dangerBg, text: colors.status.dangerLight, border: colors.border.danger };
      case 'info':
        return { bg: colors.status.infoBg, text: '#60A5FA', border: 'rgba(59, 130, 246, 0.4)' };
      case 'neutral':
      default:
        return { bg: 'rgba(255, 255, 255, 0.08)', text: colors.text.secondary, border: colors.border.glass };
    }
  };

  const { bg, text, border } = getColors();

  return (
    <View style={[styles.badge, { backgroundColor: bg, borderColor: border }, style]}>
      {icon && <View style={styles.icon}>{icon}</View>}
      <Text style={[styles.text, { color: text }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  icon: {
    marginRight: 4,
  },
  text: {
    ...typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
