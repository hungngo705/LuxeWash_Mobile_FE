/**
 * Gradient View for hero backgrounds (web-safe gradient using solid fallback)
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LuxeColors } from '@/constants/luxeTheme';

/** Props của GradientCard */
interface GradientCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  from?: string; // Màu bắt đầu gradient (được dùng làm nền đặc)
  to?: string; // Màu kết thúc gradient
}

/**
 * Web-safe gradient using a solid fallback color (the "to" color of the gradient).
 * For a real gradient on native, use expo-linear-gradient.
 * This approach renders cleanly on all platforms including web.
 */
export function GradientCard({ children, style, from = LuxeColors.primary, to = LuxeColors.primaryContainer }: GradientCardProps) {
  return (
    <View style={[styles.fallback, { backgroundColor: from }, style]}>
      {children}
    </View>
  );
}

/**
 * A bold gradient strip (horizontal accent bar) using primary color.
 * Uses a layered approach for visual depth.
 */
export function GradientStrip({ style }: { style?: ViewStyle }) {
  return (
    <View style={[styles.strip, style]} />
  );
}

const styles = {
  fallback: {
    borderRadius: 16,
    overflow: 'hidden' as const,
  },
  strip: {
    height: 4,
    backgroundColor: LuxeColors.primaryContainer,
    borderRadius: 2,
  },
};
