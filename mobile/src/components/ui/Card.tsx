import React from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity } from 'react-native';
import { colors, glassmorphism, spacing, borderRadius } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'neon' | 'danger';
  style?: ViewStyle;
  onPress?: () => void;
  padding?: number;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  style,
  onPress,
  padding = spacing.base,
}) => {
  const getCardStyle = (): ViewStyle => {
    switch (variant) {
      case 'elevated':
        return glassmorphism.elevatedCard;
      case 'neon':
        return {
          ...glassmorphism.card,
          ...glassmorphism.neonBorder(colors.primary.main),
        };
      case 'danger':
        return {
          ...glassmorphism.card,
          ...glassmorphism.neonBorder(colors.status.danger),
          backgroundColor: 'rgba(239, 68, 68, 0.08)',
        };
      case 'default':
      default:
        return glassmorphism.card;
    }
  };

  const cardContent = (
    <View style={[styles.card, getCardStyle(), { padding }, style]}>
      {children}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
        {cardContent}
      </TouchableOpacity>
    );
  }

  return cardContent;
};

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
});
