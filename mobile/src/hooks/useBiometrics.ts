import { useState, useEffect, useCallback } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export function useBiometrics() {
  const [isCompatible, setIsCompatible] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('Biometrics');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkSupport() {
      try {
        if (Platform.OS === 'web') {
          if (mounted) {
            setIsCompatible(false);
            setIsEnrolled(false);
            setIsLoading(false);
          }
          return;
        }

        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

        let typeLabel = 'Biometrics';
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          typeLabel = Platform.OS === 'ios' ? 'Face ID' : 'Facial Recognition';
        } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          typeLabel = Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
        }

        if (mounted) {
          setIsCompatible(compatible);
          setIsEnrolled(enrolled);
          setBiometricType(typeLabel);
          setIsLoading(false);
        }
      } catch (err) {
        console.warn('[useBiometrics] Hardware check failed:', err);
        if (mounted) {
          setIsCompatible(false);
          setIsEnrolled(false);
          setIsLoading(false);
        }
      }
    }

    checkSupport();
    return () => {
      mounted = false;
    };
  }, []);

  const authenticate = useCallback(async (promptMessage: string = 'Verify identity to access CyberSaathi'): Promise<boolean> => {
    if (Platform.OS === 'web') return true;

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
        fallbackLabel: 'Use Device Passcode',
      });
      return result.success;
    } catch (err) {
      console.warn('[useBiometrics] Authentication prompt failed:', err);
      return false;
    }
  }, []);

  return {
    isCompatible,
    isEnrolled,
    biometricType,
    isLoading,
    authenticate,
  };
}
