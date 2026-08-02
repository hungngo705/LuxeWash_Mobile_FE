/**
 * Consistent Bottom Action Bar component
 * Sticky bottom bar with primary CTA button
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LuxeColors, LuxeSpacing, LuxeBorderRadius, LuxeShadows } from '@/constants/luxeTheme';

/** Props của BottomActionBar */
interface BottomActionBarProps {
  title: string;
  onPress: () => void;
  loading?: boolean; // Đang tải: hiện spinner
  disabled?: boolean;
  icon?: string; // Tên icon Feather hiển thị trước chữ
}

/** Thanh hành động cố định ở đáy màn hình với nút CTA chính (dùng ở các bước đặt lịch) */
export function BottomActionBar({ title, onPress, loading, disabled, icon }: BottomActionBarProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, (disabled || loading) && styles.buttonDisabled]}
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <>
            {icon && <Feather name={icon as any} size={18} color="#ffffff" />}
            <Text style={styles.buttonText}>{title}</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: LuxeSpacing.md,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: LuxeColors.outlineVariant + '20',
    ...LuxeShadows.sm,
  },
  button: {
    backgroundColor: LuxeColors.primaryContainer,
    borderRadius: LuxeBorderRadius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    ...LuxeShadows.primary,
  },
  buttonDisabled: {
    backgroundColor: LuxeColors.surfaceVariant,
    ...LuxeShadows.sm,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
