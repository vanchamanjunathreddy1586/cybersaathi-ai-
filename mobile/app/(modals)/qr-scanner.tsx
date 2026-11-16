import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { X, Flashlight, FlashlightOff, QrCode } from 'lucide-react-native';
import { Button } from '../../src/components/ui';
import { colors, typography, spacing, borderRadius } from '../../src/theme';
import { useHaptics } from '../../src/hooks/useHaptics';

export default function QRScannerModal() {
  const router = useRouter();
  const haptics = useHaptics();
  const [permission, requestPermission] = useCameraPermissions();
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (hasScanned) return;
    setHasScanned(true);
    haptics.success();

    router.replace({
      pathname: '/(tabs)/scanner',
      params: { qrContent: data },
    });
  };

  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>Checking camera permissions...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <View style={styles.iconCircle}>
          <QrCode size={48} color={colors.accent.cyan} />
        </View>
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionSubtitle}>
          CyberSaathi needs access to your camera to scan merchant and payment QR codes for phishing detection.
        </Text>
        <Button
          title="Grant Camera Access"
          onPress={requestPermission}
          size="lg"
          style={styles.permissionButton}
        />
        <Button
          title="Cancel"
          onPress={() => router.back()}
          variant="ghost"
          size="md"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {Platform.OS !== 'web' ? (
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          enableTorch={isTorchOn}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
          onBarcodeScanned={handleBarcodeScanned}
        />
      ) : (
        <View style={styles.webFallback}>
          <Text style={styles.webFallbackText}>
            Camera scanning requires physical Android or iOS device hardware.
          </Text>
          <Button
            title="Use Sample QR URL"
            onPress={() =>
              handleBarcodeScanned({ data: 'upi://pay?pa=fakefraudster@okaxis&pn=ElectricityOffice&am=4999' })
            }
            size="md"
            style={{ marginTop: spacing.md }}
          />
        </View>
      )}

      {/* Viewfinder Overlay */}
      <View style={styles.overlay}>
        {/* Header Controls */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.controlCircle}
            accessibilityRole="button"
            accessibilityLabel="Close QR Scanner"
          >
            <X size={22} color="#FFF" />
          </TouchableOpacity>

          <Text style={styles.topTitle}>Scan QR Code</Text>

          <TouchableOpacity
            onPress={() => setIsTorchOn(!isTorchOn)}
            style={styles.controlCircle}
            accessibilityRole="button"
            accessibilityLabel="Toggle Flashlight"
          >
            {isTorchOn ? (
              <FlashlightOff size={22} color={colors.accent.cyan} />
            ) : (
              <Flashlight size={22} color="#FFF" />
            )}
          </TouchableOpacity>
        </View>

        {/* Viewfinder Target Box */}
        <View style={styles.viewfinderContainer}>
          <View style={styles.viewfinderBox}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <Text style={styles.hintText}>
            Align the QR code within the frame to automatically scan for scam payloads
          </Text>
        </View>

        {/* Bottom Status */}
        <View style={styles.bottomBar}>
          <Text style={styles.safetyNotice}>
            Scanning detects malicious UPI payment redirects, phishing URLs, and fraudulent contacts.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    borderWidth: 1.5,
    borderColor: colors.accent.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  permissionTitle: {
    ...typography.h2,
    color: colors.text.primary,
    textAlign: 'center',
  },
  permissionSubtitle: {
    ...typography.body1,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
    maxWidth: 300,
  },
  permissionButton: {
    width: '100%',
    marginBottom: spacing.sm,
  },
  permissionText: {
    ...typography.body1,
    color: colors.text.secondary,
  },
  webFallback: {
    flex: 1,
    backgroundColor: colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  webFallbackText: {
    ...typography.body1,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 60 : 30,
  },
  controlCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  topTitle: {
    ...typography.subtitle1,
    color: '#FFF',
    fontWeight: '700',
  },
  viewfinderContainer: {
    alignItems: 'center',
  },
  viewfinderBox: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderColor: colors.accent.cyan,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  hintText: {
    ...typography.body2,
    color: '#FFF',
    textAlign: 'center',
    marginTop: spacing.xl,
    maxWidth: 280,
    textShadowColor: '#000',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
  },
  bottomBar: {
    paddingHorizontal: spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 50 : 30,
    alignItems: 'center',
  },
  safetyNotice: {
    ...typography.caption,
    color: colors.text.muted,
    textAlign: 'center',
  },
});
