/**
 * Phiên bản web của icon động (animated-icon).
 * Trên web dùng placeholder màu đặc thay cho ảnh logo để render mượt trên mọi trình duyệt.
 */

import { StyleSheet, View } from 'react-native';
import Animated, { Keyframe, Easing } from 'react-native-reanimated';

const DURATION = 300; // Thời lượng animation (ms)

// Trên web không hiện splash overlay
export function AnimatedSplashOverlay() {
  return null;
}

// Keyframe phóng to icon nền theo hiệu ứng đàn hồi
const keyframe = new Keyframe({
  0: {
    transform: [{ scale: 0 }],
  },
  60: {
    transform: [{ scale: 1.2 }],
    easing: Easing.elastic(1.2),
  },
  100: {
    transform: [{ scale: 1 }],
    easing: Easing.elastic(1.2),
  },
});

// Keyframe hiện dần logo (mờ -> rõ) đồng thời scale nhẹ
const logoKeyframe = new Keyframe({
  0: {
    opacity: 0,
  },
  60: {
    transform: [{ scale: 1.2 }],
    opacity: 0,
    easing: Easing.elastic(1.2),
  },
  100: {
    transform: [{ scale: 1 }],
    opacity: 1,
    easing: Easing.elastic(1.2),
  },
});

// Icon động hiển thị trên web: nền màu xanh + placeholder logo
export function AnimatedIcon() {
  return (
    <View style={styles.iconContainer}>
      <Animated.View style={styles.background} entering={keyframe.duration(DURATION)}>
        <View style={styles.webBackground} />
      </Animated.View>

      <Animated.View style={styles.imageContainer} entering={logoKeyframe.duration(DURATION)}>
        <View style={styles.webPlaceholder} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 128,
    height: 128,
  },
  background: {
    width: 128,
    height: 128,
    position: 'absolute',
    borderRadius: 40,
    overflow: 'hidden',
  },
  imageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  webBackground: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
    backgroundColor: '#3C9FFE',
  },
  webPlaceholder: {
    width: 76,
    height: 71,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
});
