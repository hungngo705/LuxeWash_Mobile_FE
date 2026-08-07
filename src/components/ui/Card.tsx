/**
 * Unified white card component with consistent shadow and border styling
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LuxeColors, LuxeSpacing, LuxeBorderRadius, LuxeShadows } from '@/constants/luxeTheme';

/** Props của Card */
interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle; // Style ghi đè thêm
  padding?: number; // Khoảng đệm bên trong (mặc định md)
  noPadding?: boolean; // Bỏ hoàn toàn khoảng đệm
}

/** Thẻ nền trắng thống nhất với bo góc và đổ bóng chuẩn của app */
export function Card({ children, style, padding = LuxeSpacing.md, noPadding = false }: CardProps) {
  return (
    <View style={[styles.card, noPadding ? {} : { padding }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: LuxeBorderRadius.xl,
    ...LuxeShadows.sm,
  },
});
