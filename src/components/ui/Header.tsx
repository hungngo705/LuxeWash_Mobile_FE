/**
 * Consistent Header component for all screens
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LuxeColors, LuxeSpacing, LuxeShadows } from '@/constants/luxeTheme';

/** Props của Header */
interface HeaderProps {
  title: string;
  onBack?: () => void; // Xử lý khi bấm nút quay lại
  showBack?: boolean; // Có hiện nút quay lại không
  rightElement?: React.ReactNode; // Phần tử tuỳ chỉnh bên phải
  backgroundColor?: string;
}

/** Thanh tiêu đề dùng chung cho mọi màn hình (nút back trái, tiêu đề giữa, phần tử phải) */
export function Header({ title, onBack, showBack = true, rightElement, backgroundColor = '#ffffff' }: HeaderProps) {
  return (
    <View style={[styles.header, { backgroundColor }]}>
      <View style={styles.left}>
        {showBack && onBack ? (
          <TouchableOpacity style={styles.backBtn} onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="chevron-left" size={24} color={LuxeColors.onSurface} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtnPlaceholder} />
        )}
      </View>

      <Text style={styles.title} numberOfLines={1}>{title}</Text>

      <View style={styles.right}>
        {rightElement || <View style={styles.backBtnPlaceholder} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: LuxeSpacing.md,
    paddingVertical: LuxeSpacing.md,
    borderBottomWidth: 1,
    borderBottomColor: LuxeColors.outlineVariant + '20',
  },
  left: {
    width: 40,
    alignItems: 'flex-start',
  },
  right: {
    minWidth: 60,
    alignItems: 'flex-end',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: LuxeColors.surfaceContainer,
  },
  backBtnPlaceholder: {
    width: 40,
    height: 40,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: LuxeColors.onSurface,
    textAlign: 'center',
  },
});
