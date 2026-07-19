import { useState } from 'react';
import { Dimensions, StyleSheet, View, Image } from 'react-native';
import Animated, { Easing, Keyframe, runOnJS } from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';

const INITIAL_SCALE_FACTOR = Dimensions.get('screen').height / 90;
const DURATION = 600;
const SPLASH_BACKGROUND = '#0B1A37';

export function AnimatedSplashOverlay() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  const splashKeyframe = new Keyframe({
    0: {
      opacity: 0,
    },
    30: {
      opacity: 1,
    },
    60: {
      opacity: 1,
    },
    100: {
      opacity: 0,
      easing: Easing.out(Easing.quad),
    },
  });

  return (
    <>
      <StatusBar style="light" />
      <Animated.View
        entering={splashKeyframe.duration(1200).withCallback((finished) => {
          'worklet';
          if (finished) {
            runOnJS(setVisible)(false);
          }
        })}
        style={styles.splashContainer}
      >
        <Image
          source={require('../../assets/images/logo.png')}
          style={styles.splashLogo}
          resizeMode="contain"
        />
      </Animated.View>
    </>
  );
}

const keyframe = new Keyframe({
  0: {
    transform: [{ scale: INITIAL_SCALE_FACTOR }],
  },
  100: {
    transform: [{ scale: 1 }],
    easing: Easing.elastic(0.7),
  },
});

const logoKeyframe = new Keyframe({
  0: {
    transform: [{ scale: 1.3 }],
    opacity: 0,
  },
  40: {
    transform: [{ scale: 1.3 }],
    opacity: 0,
    easing: Easing.elastic(0.7),
  },
  100: {
    opacity: 1,
    transform: [{ scale: 1 }],
    easing: Easing.elastic(0.7),
  },
});

export function AnimatedIcon() {
  return (
    <View style={styles.iconContainer}>
      <Animated.View entering={keyframe.duration(DURATION)} style={styles.background} />
      <Animated.View style={styles.imageContainer} entering={logoKeyframe.duration(DURATION)}>
        <Image
          source={require('../../assets/images/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  imageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  glow: {
    width: 201,
    height: 201,
    position: 'absolute',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 128,
    height: 128,
    zIndex: 100,
  },
  image: {
    position: 'absolute',
    width: 76,
    height: 71,
  },
  logo: {
    width: 76,
    height: 71,
  },
  background: {
    borderRadius: 40,
    backgroundColor: SPLASH_BACKGROUND,
    width: 128,
    height: 128,
    position: 'absolute',
  },
  backgroundSolidColor: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SPLASH_BACKGROUND,
    zIndex: 1000,
  },
  splashContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SPLASH_BACKGROUND,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  splashLogo: {
    width: 200,
    height: 200,
  },
});
