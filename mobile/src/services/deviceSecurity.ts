import * as Device from 'expo-device';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export interface DeviceSecurityPosture {
  score: number; // 0 - 100
  rating: 'SECURE' | 'MODERATE' | 'VULNERABLE';
  isPhysicalDevice: boolean;
  osName: string;
  osVersion: string;
  deviceModel: string;
  biometricHardwareAvailable: boolean;
  biometricsEnrolled: boolean;
  screenLockActive: boolean;
  recommendations: string[];
}

export async function evaluateDeviceSecurityPosture(): Promise<DeviceSecurityPosture> {
  const recommendations: string[] = [];
  let score = 0;

  // 1. Device identity
  const isPhysicalDevice = Device.isDevice ?? true;
  const osName = Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : Platform.OS;
  const osVersion = Device.osVersion || 'Unknown';
  const deviceModel = Device.modelName || 'Standard Device';

  if (isPhysicalDevice) {
    score += 20;
  } else {
    recommendations.push('Running on an emulator or non-physical test environment.');
  }

  // 2. Biometric and Screen Lock posture
  let biometricHardwareAvailable = false;
  let biometricsEnrolled = false;

  try {
    biometricHardwareAvailable = await LocalAuthentication.hasHardwareAsync();
    biometricsEnrolled = await LocalAuthentication.isEnrolledAsync();
  } catch (err) {
    console.warn('[DeviceSecurity] Error inspecting local auth hardware:', err);
  }

  const screenLockActive = biometricsEnrolled;

  if (screenLockActive) {
    score += 40;
  } else {
    recommendations.push('Enable device screen lock (PIN, Password, or Biometrics) to safeguard sensitive evidence.');
  }

  if (biometricHardwareAvailable && !biometricsEnrolled) {
    recommendations.push('Enroll Fingerprint or Face ID for rapid biometric authentication.');
  }

  // 3. OS updates & modernity
  const osNum = parseFloat(osVersion);
  if (!isNaN(osNum)) {
    if (Platform.OS === 'android' && osNum >= 12) {
      score += 30;
    } else if (Platform.OS === 'ios' && osNum >= 16) {
      score += 30;
    } else {
      score += 15;
      recommendations.push(`Update ${osName} to the latest available security patch level.`);
    }
  } else {
    score += 20;
  }

  // 4. Baseline app integrity
  score += 10;

  const finalScore = Math.min(100, Math.max(0, score));
  const rating = finalScore >= 80 ? 'SECURE' : finalScore >= 50 ? 'MODERATE' : 'VULNERABLE';

  return {
    score: finalScore,
    rating,
    isPhysicalDevice,
    osName,
    osVersion,
    deviceModel,
    biometricHardwareAvailable,
    biometricsEnrolled,
    screenLockActive,
    recommendations,
  };
}
