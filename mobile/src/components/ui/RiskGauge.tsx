import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, typography, borderRadius, spacing } from '../../theme';

interface RiskGaugeProps {
  score: number; // 0 - 100
  title?: string;
  size?: 'sm' | 'md' | 'lg';
  mode?: 'risk' | 'safety'; // 'risk': higher is dangerous; 'safety': higher is safer
  style?: ViewStyle;
}

export const RiskGauge: React.FC<RiskGaugeProps> = ({
  score,
  title = 'Risk Assessment',
  size = 'md',
  mode = 'risk',
  style,
}) => {
  const clampedScore = Math.min(100, Math.max(0, Math.round(score)));

  // Determine color and verdict
  let statusColor: string = colors.status.safe;
  let statusText = 'SAFE';

  if (mode === 'risk') {
    if (clampedScore >= 70) {
      statusColor = colors.status.danger;
      statusText = 'HIGH RISK';
    } else if (clampedScore >= 35) {
      statusColor = colors.status.warning;
      statusText = 'SUSPICIOUS';
    } else {
      statusColor = colors.status.safe;
      statusText = 'SAFE';
    }
  } else {
    // Safety mode (100 = best)
    if (clampedScore >= 80) {
      statusColor = colors.status.safe;
      statusText = 'SECURE';
    } else if (clampedScore >= 50) {
      statusColor = colors.status.warning;
      statusText = 'MODERATE';
    } else {
      statusColor = colors.status.danger;
      statusText = 'AT RISK';
    }
  }

  const getContainerDimensions = () => {
    switch (size) {
      case 'sm':
        return { width: 90, height: 90, stroke: 6, fontSize: 22 };
      case 'lg':
        return { width: 170, height: 170, stroke: 12, fontSize: 44 };
      case 'md':
      default:
        return { width: 130, height: 130, stroke: 9, fontSize: 32 };
    }
  };

  const dim = getContainerDimensions();

  return (
    <View style={[styles.container, style]}>
      <View
        style={[
          styles.circleContainer,
          {
            width: dim.width,
            height: dim.height,
            borderRadius: dim.width / 2,
            borderColor: statusColor,
            borderWidth: dim.stroke,
            shadowColor: statusColor,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.5,
            shadowRadius: 10,
            elevation: 8,
          },
        ]}
      >
        <Text style={[styles.scoreNumber, { fontSize: dim.fontSize, color: colors.text.primary }]}>
          {clampedScore}
        </Text>
        <Text style={[styles.scoreMax, { color: colors.text.muted }]}>/100</Text>
      </View>

      <View style={[styles.verdictBadge, { backgroundColor: `${statusColor}22`, borderColor: statusColor }]}>
        <Text style={[styles.verdictText, { color: statusColor }]}>{statusText}</Text>
      </View>

      {title ? <Text style={styles.title}>{title}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.md,
  },
  circleContainer: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNumber: {
    ...typography.h1,
    fontWeight: '800',
    includeFontPadding: false,
  },
  scoreMax: {
    ...typography.caption,
    marginTop: -2,
    fontWeight: '600',
  },
  verdictBadge: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  verdictText: {
    ...typography.caption,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  title: {
    ...typography.subtitle2,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
});
