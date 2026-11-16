import { Platform, TextStyle } from 'react-native';

const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

export const typography = {
  h1: {
    fontFamily,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.5,
  } as TextStyle,
  h2: {
    fontFamily,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.3,
  } as TextStyle,
  h3: {
    fontFamily,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
  } as TextStyle,
  subtitle1: {
    fontFamily,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
  } as TextStyle,
  subtitle2: {
    fontFamily,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  } as TextStyle,
  body1: {
    fontFamily,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  } as TextStyle,
  body2: {
    fontFamily,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  } as TextStyle,
  caption: {
    fontFamily,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
    letterSpacing: 0.2,
  } as TextStyle,
  button: {
    fontFamily,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: 0.2,
  } as TextStyle,
  code: {
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }),
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  } as TextStyle,
} as const;
