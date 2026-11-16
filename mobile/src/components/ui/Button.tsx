import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors, typography, borderRadius, spacing } from '../../theme';
import { useHaptics } from '../../hooks/useHaptics';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
  textStyle?: TextStyle;
  hapticFeedback?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  style,
  textStyle,
  hapticFeedback = true,
}) => {
  const haptics = useHaptics();

  const handlePress = () => {
    if (disabled || isLoading) return;
    if (hapticFeedback) {
      if (variant === 'danger') {
        haptics.warning();
      } else {
        haptics.light();
      }
    }
    onPress();
  };

  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: colors.primary.main,
          shadowColor: colors.primary.main,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 8,
          elevation: 4,
        };
      case 'secondary':
        return {
          backgroundColor: colors.background.elevated,
          borderColor: colors.border.glass,
          borderWidth: 1,
        };
      case 'danger':
        return {
          backgroundColor: colors.status.danger,
          shadowColor: colors.status.danger,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
          elevation: 4,
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderColor: colors.primary.main,
          borderWidth: 1.5,
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
        };
    }
  };

  const getSizeStyle = (): { container: ViewStyle; text: TextStyle } => {
    switch (size) {
      case 'sm':
        return {
          container: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: borderRadius.md },
          text: { fontSize: 13 },
        };
      case 'lg':
        return {
          container: { paddingVertical: 16, paddingHorizontal: 24, borderRadius: borderRadius.xl },
          text: { fontSize: 16, fontWeight: '700' },
        };
      case 'md':
      default:
        return {
          container: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: borderRadius.lg },
          text: { fontSize: 15 },
        };
    }
  };

  const sizeStyles = getSizeStyle();

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handlePress}
      disabled={disabled || isLoading}
      style={[
        styles.base,
        getVariantStyle(),
        sizeStyles.container,
        (disabled || isLoading) && styles.disabled,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || isLoading, busy: isLoading }}
    >
      {isLoading ? (
        <ActivityIndicator color={colors.text.primary} size="small" />
      ) : (
        <>
          {icon && iconPosition === 'left' ? <>{icon}</> : null}
          <Text
            style={[
              styles.text,
              sizeStyles.text,
              variant === 'outline' && { color: colors.primary.light },
              variant === 'ghost' && { color: colors.text.secondary },
              textStyle,
              icon ? (iconPosition === 'left' ? { marginLeft: spacing.sm } : { marginRight: spacing.sm }) : undefined,
            ]}
          >
            {title}
          </Text>
          {icon && iconPosition === 'right' ? <>{icon}</> : null}
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    ...typography.button,
    color: colors.text.primary,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
});
