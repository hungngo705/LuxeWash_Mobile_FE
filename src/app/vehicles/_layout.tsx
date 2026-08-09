/**
 * Vehicles Layout
 * Stack navigation for vehicle management screens
 */

import { Stack } from 'expo-router';
import { LuxeColors } from '@/constants/luxeTheme';

export default function VehiclesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: LuxeColors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="add-vehicle" />
      <Stack.Screen name="edit-vehicle" />
    </Stack>
  );
}
