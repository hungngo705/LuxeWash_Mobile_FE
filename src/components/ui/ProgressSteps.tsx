/**
 * Booking flow progress step indicator
 * Shows steps with labels and connecting lines
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LuxeColors, LuxeSpacing } from '@/constants/luxeTheme';

/** Một bước trong tiến trình */
interface Step {
  label: string;
}

/** Props của ProgressSteps */
interface ProgressStepsProps {
  steps: Step[];
  currentStep: number; // 0-indexed
  style?: object;
}

/** Thanh chỉ báo tiến trình nhiều bước (chấm tròn + nhãn + đường nối) cho luồng đặt lịch */
export function ProgressSteps({ steps, currentStep, style }: ProgressStepsProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.stepsRow}>
        {steps.map((step, index) => {
          // Xác định trạng thái từng bước so với bước hiện tại
          const isCompleted = index < currentStep; // Đã hoàn thành
          const isActive = index === currentStep; // Đang ở bước này
          const isPending = index > currentStep; // Chưa tới

          return (
            <React.Fragment key={index}>
              <View style={styles.stepItem}>
                <View
                  style={[
                    styles.dot,
                    isCompleted && styles.dotCompleted,
                    isActive && styles.dotActive,
                    isPending && styles.dotPending,
                  ]}
                >
                  {isCompleted && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </View>
                <Text
                  style={[
                    styles.label,
                    isCompleted && styles.labelCompleted,
                    isActive && styles.labelActive,
                    isPending && styles.labelPending,
                  ]}
                  numberOfLines={1}
                >
                  {step.label}
                </Text>
              </View>
              {index < steps.length - 1 && (
                <View
                  style={[
                    styles.connector,
                    isCompleted && styles.connectorCompleted,
                  ]}
                />
              )}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: LuxeSpacing.md,
    paddingVertical: LuxeSpacing.sm,
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  stepItem: {
    alignItems: 'center',
    minWidth: 48,
    maxWidth: 72,
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  dotCompleted: {
    backgroundColor: LuxeColors.primaryContainer,
  },
  dotActive: {
    backgroundColor: LuxeColors.primaryContainer,
    borderWidth: 3,
    borderColor: LuxeColors.primary,
  },
  dotPending: {
    backgroundColor: LuxeColors.surfaceVariant,
    borderWidth: 2,
    borderColor: LuxeColors.outlineVariant,
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  labelCompleted: {
    color: LuxeColors.primaryContainer,
  },
  labelActive: {
    color: LuxeColors.primaryContainer,
    fontWeight: '700',
  },
  labelPending: {
    color: LuxeColors.onSurfaceVariant,
  },
  connector: {
    flex: 1,
    height: 2,
    backgroundColor: LuxeColors.surfaceVariant,
    marginTop: 11,
    marginHorizontal: 4,
  },
  connectorCompleted: {
    backgroundColor: LuxeColors.primaryContainer,
  },
});
