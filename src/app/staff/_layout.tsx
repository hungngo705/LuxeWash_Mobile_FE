/**
 * Staff Stack Layout
 * Hides the tab bar when navigating to staff screens
 */

import { Stack } from 'expo-router';
import { LuxeColors } from '@/constants/luxeTheme';

export default function StaffLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: LuxeColors.background },
      }}
    >
      <Stack.Screen name="lpr-checkin" />
    </Stack>
  );
}
