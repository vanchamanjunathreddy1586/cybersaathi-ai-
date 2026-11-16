export const colors = {
  background: {
    primary: '#0B1120',
    secondary: '#111827',
    elevated: '#1E293B',
    surface: 'rgba(17, 24, 39, 0.85)',
    overlay: 'rgba(11, 17, 32, 0.92)',
  },
  primary: {
    main: '#6366F1',
    light: '#818CF8',
    dark: '#4F46E5',
    glow: 'rgba(99, 102, 241, 0.3)',
  },
  accent: {
    cyan: '#06B6D4',
    cyanLight: '#22D3EE',
    cyanGlow: 'rgba(6, 182, 212, 0.25)',
    purple: '#A855F7',
  },
  status: {
    safe: '#10B981',
    safeLight: '#34D399',
    safeBg: 'rgba(16, 185, 129, 0.15)',
    warning: '#F59E0B',
    warningLight: '#FBBF24',
    warningBg: 'rgba(245, 158, 11, 0.15)',
    danger: '#EF4444',
    dangerLight: '#F87171',
    dangerBg: 'rgba(239, 68, 68, 0.15)',
    info: '#3B82F6',
    infoBg: 'rgba(59, 130, 246, 0.15)',
  },
  text: {
    primary: '#F9FAFB',
    secondary: '#94A3B8',
    muted: '#64748B',
    inverted: '#0B1120',
  },
  border: {
    glass: 'rgba(255, 255, 255, 0.10)',
    subtle: 'rgba(255, 255, 255, 0.06)',
    active: 'rgba(99, 102, 241, 0.50)',
    danger: 'rgba(239, 68, 68, 0.50)',
    safe: 'rgba(16, 185, 129, 0.50)',
  },
} as const;

export type ColorTokens = typeof colors;
