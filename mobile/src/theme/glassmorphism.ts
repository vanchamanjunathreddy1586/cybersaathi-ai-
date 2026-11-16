import { ViewStyle } from 'react-native';
import { colors } from './colors';
import { borderRadius } from './spacing';

export const glassmorphism = {
  card: {
    backgroundColor: 'rgba(17, 24, 39, 0.75)',
    borderColor: colors.border.glass,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  } as ViewStyle,

  elevatedCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    borderColor: colors.border.active,
    borderWidth: 1,
    borderRadius: borderRadius.xl,
    shadowColor: colors.primary.main,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  } as ViewStyle,

  neonBorder: (color: string = colors.primary.main): ViewStyle => ({
    borderColor: color,
    borderWidth: 1.5,
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 5,
  }),

  input: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderColor: colors.border.glass,
    borderWidth: 1,
    borderRadius: borderRadius.md,
  } as ViewStyle,

  modal: {
    backgroundColor: 'rgba(11, 17, 32, 0.96)',
    borderColor: colors.border.glass,
    borderWidth: 1,
    borderRadius: borderRadius.xxl,
  } as ViewStyle,
};
