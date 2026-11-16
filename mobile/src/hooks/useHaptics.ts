import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export function useHaptics() {
  const isAvailable = Platform.OS === 'ios' || Platform.OS === 'android';

  const light = () => {
    if (isAvailable) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const medium = () => {
    if (isAvailable) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
  };

  const heavy = () => {
    if (isAvailable) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }
  };

  const success = () => {
    if (isAvailable) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  };

  const warning = () => {
    if (isAvailable) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
  };

  const error = () => {
    if (isAvailable) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  };

  return {
    light,
    medium,
    heavy,
    success,
    warning,
    error,
  };
}
