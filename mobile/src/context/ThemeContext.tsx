import React, { createContext, useContext, useMemo } from 'react';
import { colors, typography, spacing, borderRadius, glassmorphism } from '../theme';

interface ThemeContextValue {
  colors: typeof colors;
  typography: typeof typography;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  glassmorphism: typeof glassmorphism;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors,
  typography,
  spacing,
  borderRadius,
  glassmorphism,
  isDark: true,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value = useMemo(
    () => ({
      colors,
      typography,
      spacing,
      borderRadius,
      glassmorphism,
      isDark: true,
    }),
    []
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme() {
  return useContext(ThemeContext);
}
