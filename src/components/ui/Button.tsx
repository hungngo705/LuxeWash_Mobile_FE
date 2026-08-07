/**
 * Consistent button components - Primary and Secondary variants
 */

import React from 'react';
import { Text, TouchableOpacity, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { LuxeColors, LuxeSpacing, LuxeBorderRadius, LuxeShadows } from '@/constants/luxeTheme';

/** Props nút chính (Primary) */
interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean; // Đang tải: hiện spinner thay chữ
  disabled?: boolean;
  style?: ViewStyle;
  icon?: React.ReactNode; // Icon hiển thị trước chữ
  size?: 'sm' | 'md' | 'lg';
}

/** Props nút phụ (Secondary) */
interface SecondaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

// Bảng kích thước theo size: padding và cỡ chữ
const sizeStyles = {
  sm: { paddingVertical: 10, paddingHorizontal: 16, fontSize: 13 },
  md: { paddingVertical: 14, paddingHorizontal: 24, fontSize: 15 },
  lg: { paddingVertical: 16, paddingHorizontal: 32, fontSize: 16 },
};

/** Nút hành động chính (nền đặc, nổi bật) */
export function PrimaryButton({ title, onPress, loading, disabled, style, icon, size = 'md' }: PrimaryButtonProps) {
  const s = sizeStyles[size];
  return (
    <TouchableOpacity
      style={[
        styles.primary,
        { paddingVertical: s.paddingVertical, paddingHorizontal: s.paddingHorizontal },
        disabled || loading ? styles.disabled : styles.primaryShadow,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color="#ffffff" size="small" />
      ) : (
        <>
          {icon}
          <Text style={[styles.primaryText, { fontSize: s.fontSize }]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

/** Nút phụ (viền, nền trong suốt) cho hành động ít ưu tiên hơn */
export function SecondaryButton({ title, onPress, disabled, style, icon, size = 'md' }: SecondaryButtonProps) {
  const s = sizeStyles[size];
  return (
    <TouchableOpacity
      style={[
        styles.secondary,
        { paddingVertical: s.paddingVertical, paddingHorizontal: s.paddingHorizontal },
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      {icon}
      <Text style={[styles.secondaryText, { fontSize: s.fontSize }]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  primary: {
    backgroundColor: LuxeColors.primaryContainer,
    borderRadius: LuxeBorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryShadow: {
    ...LuxeShadows.primary,
  },
  primaryText: {
    color: '#ffffff',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderRadius: LuxeBorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1.5,
    borderColor: LuxeColors.outlineVariant,
  },
  secondaryText: {
    color: LuxeColors.onSurfaceVariant,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
});
