import React from 'react';
import { Stack } from 'expo-router';
import { colors } from '../../src/theme';

export default function ModalsLayout() {
  return (
    <Stack
      screenOptions={{
        presentation: 'modal',
        headerShown: false,
        contentStyle: { backgroundColor: colors.background.primary },
        animation: 'slide_from_bottom',
      }}
    />
  );
}
