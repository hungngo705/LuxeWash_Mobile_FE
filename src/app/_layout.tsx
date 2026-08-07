/**
 * LuxeWash App Root Layout
 * Handles auth state and redirects
 */

import { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { useRouter, usePathname, Stack, useNavigationContainerRef } from 'expo-router';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useFonts } from 'expo-font';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { OverloadSuggestionProvider } from '@/contexts/OverloadSuggestionContext';
import { LuxeColors } from '@/constants/luxeTheme';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ConfirmDialogProvider } from '@/components/ConfirmDialog';

// Theme sáng tùy biến cho React Navigation, dùng bảng màu LuxeColors
const LuxeLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: LuxeColors.primary,
    background: LuxeColors.background,
    card: LuxeColors.surfaceContainerLowest,
    text: LuxeColors.onSurface,
    border: LuxeColors.outlineVariant,
    notification: LuxeColors.primaryContainer,
  },
};

/** Màn hình chờ hiển thị vòng xoay khi đang tải trạng thái đăng nhập. */
function LoadingScreen() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={LuxeColors.primaryContainer} />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LuxeColors.background,
  },
});

/**
 * Layout gốc của ứng dụng.
 * Nạp font, thiết lập theme và lồng các Provider (Auth, ConfirmDialog, OverloadSuggestion),
 * rồi render splash và bộ điều hướng.
 */
export default function RootLayout() {
  // Nạp font Feather cho bộ icon
  const [fontsLoaded] = useFonts({
    Feather: require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Feather.ttf'),
  });

  // Chưa nạp xong font thì hiện vòng xoay chờ
  if (!fontsLoaded) {
    return (
      <SafeAreaProvider>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={LuxeColors.primaryContainer} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider value={LuxeLightTheme}>
        <StatusBar style="dark" />
        <AuthProvider>
          <ConfirmDialogProvider>
            <OverloadSuggestionProvider>
              <AnimatedSplashOverlay />
              <AppNavigator />
            </OverloadSuggestionProvider>
          </ConfirmDialogProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/**
 * Inner navigator — must be rendered inside expo-router's context
 * so that useRootNavigation() and useRootNavigator() work.
 */
function InnerNavigator() {
  const { isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const containerRef = useNavigationContainerRef();

  // Điều hướng theo trạng thái đăng nhập: chưa đăng nhập -> về /login; đã đăng nhập mà ở màn login/register -> vào (main)
  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated && pathname !== '/login' && pathname !== '/register' && pathname !== '/verify-otp') {
      router.replace('/login');
    } else if (isAuthenticated && (pathname === '/login' || pathname === '/register')) {
      router.replace('/(main)' as any);
    }
  }, [isLoading, isAuthenticated, pathname]);

  // Nút back cứng của Android: nếu đang ở màn gốc thì quay về (main) thay vì thoát app
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      const state = containerRef.current?.getRootState();
      if (state && state.routes.length <= 1) {
        router.replace('/(main)' as any);
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, []);

  // Chặn log lỗi nhiễu "GO_BACK was not handled" của navigator (không ảnh hưởng chức năng)
  useEffect(() => {
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      if (
        typeof args[0] === 'string' &&
        args[0].includes("The action 'GO_BACK' was not handled by any navigator")
      ) {
        return;
      }
      originalError.apply(console, args as Parameters<typeof console.error>);
    };
    return () => {
      console.error = originalError as typeof console.error;
    };
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: LuxeColors.background },
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="verify-otp" />
      <Stack.Screen name="change-password" />
      <Stack.Screen name="profile-edit" />
      <Stack.Screen name="(main)" />
      <Stack.Screen
        name="booking"
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="wallet"
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="vouchers"
        options={{
          animation: 'slide_from_right',
        }}
      />
    </Stack>
  );
}

/** Bọc InnerNavigator (điểm để mở rộng logic điều hướng cấp app nếu cần). */
function AppNavigator() {
  return <InnerNavigator />;
}
