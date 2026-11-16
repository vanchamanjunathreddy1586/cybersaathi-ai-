import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { WifiOff, PhoneCall } from 'lucide-react-native';
import { colors, typography, spacing } from '../../theme';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

export const OfflineBanner: React.FC = () => {
  const { isOffline } = useNetworkStatus();

  if (!isOffline) return null;

  return (
    <View style={styles.banner}>
      <View style={styles.left}>
        <WifiOff size={16} color={colors.status.warningLight} />
        <Text style={styles.text}>Offline Mode &bull; Cached guides active</Text>
      </View>
      <TouchableOpacity
        onPress={() => Linking.openURL('tel:1930')}
        style={styles.sosButton}
        accessibilityRole="button"
        accessibilityLabel="Call 1930 Cyber Helpline"
      >
        <PhoneCall size={12} color="#FFF" />
        <Text style={styles.sosText}>1930</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245, 158, 11, 0.4)',
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  text: {
    ...typography.caption,
    color: colors.status.warningLight,
    fontWeight: '600',
    marginLeft: spacing.xs + 2,
  },
  sosButton: {
    backgroundColor: colors.status.danger,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sosText: {
    ...typography.caption,
    color: '#FFF',
    fontWeight: '800',
    marginLeft: 4,
  },
});
