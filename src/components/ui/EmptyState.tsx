/**
 * Consistent empty state component
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LuxeColors, LuxeSpacing, LuxeBorderRadius } from '@/constants/luxeTheme';
import { PrimaryButton } from './Button';

/** Props của EmptyState */
interface EmptyStateProps {
  icon?: string; // Tên icon Feather (mặc định "inbox")
  iconColor?: string;
  title: string;
  subtitle?: string;
  actionTitle?: string; // Nhãn nút hành động (nếu có)
  onAction?: () => void; // Xử lý khi bấm nút hành động
}

/** Trạng thái rỗng dùng chung: icon + tiêu đề + mô tả + nút hành động tuỳ chọn */
export function EmptyState({ icon, iconColor = LuxeColors.outlineVariant, title, subtitle, actionTitle, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Feather
          name={(icon as any) || 'inbox'}
          size={40}
          color={iconColor}
        />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {actionTitle && onAction && (
        <View style={styles.actionWrap}>
          <PrimaryButton title={actionTitle} onPress={onAction} size="md" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: LuxeSpacing.xxl,
    paddingHorizontal: LuxeSpacing.lg,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: LuxeColors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: LuxeSpacing.lg,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: LuxeColors.onSurface,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: LuxeColors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: LuxeSpacing.lg,
  },
  actionWrap: {
    marginTop: 8,
  },
});
