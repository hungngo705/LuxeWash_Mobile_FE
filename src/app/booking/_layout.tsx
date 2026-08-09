/**
 * Booking Stack Layout
 * Hides the tab bar when navigating to booking screens
 * Flow: select-branch -> select-vehicles -> select-service -> select-date -> confirmation -> success
 */

import { Stack } from 'expo-router';
import { LuxeColors } from '@/constants/luxeTheme';

export default function BookingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: LuxeColors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="select-branch" />
      <Stack.Screen name="select-vehicles" />
      <Stack.Screen name="select-service" />
      <Stack.Screen name="select-date" />
      <Stack.Screen name="confirmation" />
      <Stack.Screen name="success" />
      <Stack.Screen name="payment" />
      <Stack.Screen name="reschedule" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
