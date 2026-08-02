import { SymbolView } from 'expo-symbols';
import { PropsWithChildren, useState } from 'react';
import { Pressable, StyleSheet, View, Text } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { LuxeColors, LuxeSpacing, LuxeBorderRadius } from '@/constants/luxeTheme';

/**
 * Collapsible — khối nội dung có thể thu gọn/mở rộng.
 * Nhấn vào tiêu đề để bật/tắt phần nội dung con; mũi tên chevron xoay theo trạng thái
 * và nội dung xuất hiện với hiệu ứng FadeIn.
 * @param title Tiêu đề hiển thị trên thanh bấm
 * @param children Nội dung ẩn/hiện bên dưới
 */
export function Collapsible({ children, title }: PropsWithChildren & { title: string }) {
  // Trạng thái đang mở hay đóng
  const [isOpen, setIsOpen] = useState(false);

  return (
    <View>
      {/* Thanh tiêu đề bấm để bật/tắt */}
      <Pressable
        style={({ pressed }) => [styles.heading, pressed && styles.pressedHeading]}
        onPress={() => setIsOpen((value) => !value)}>
        <View style={styles.button}>
          {/* Mũi tên xoay: 90deg khi đóng, -90deg khi mở */}
          <SymbolView
            name="chevron.right"
            size={14}
            weight="bold"
            tintColor={LuxeColors.onSurface}
            style={{ transform: [{ rotate: isOpen ? '-90deg' : '90deg' }] }}
          />
        </View>

        <Text style={styles.title}>{title}</Text>
      </Pressable>
      {/* Chỉ render nội dung khi đang mở */}
      {isOpen && (
        <Animated.View entering={FadeIn.duration(200)}>
          <View style={styles.content}>
            {children}
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxeSpacing.sm,
  },
  pressedHeading: {
    opacity: 0.7,
  },
  button: {
    width: 28,
    height: 28,
    borderRadius: LuxeBorderRadius.md,
    backgroundColor: LuxeColors.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    color: LuxeColors.onSurface,
  },
  content: {
    marginTop: LuxeSpacing.md,
    marginLeft: 28,
    padding: LuxeSpacing.md,
    backgroundColor: LuxeColors.surfaceVariant,
    borderRadius: LuxeBorderRadius.md,
  },
});
