/**
 * Main Tabs Layout
 * Contains the 4 main tabs: Home, Appointments, Rewards, Profile
 */

import { LuxeColors } from "@/constants/luxeTheme";
import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { StyleSheet, View } from "react-native";

// Tên icon hợp lệ cho từng tab
type IconName = "home" | "calendar" | "award" | "user";

/** Icon của một tab: đổi màu khi được chọn và hiện chấm tròn bên dưới. */
function TabIcon({ icon, focused }: { icon: IconName; focused: boolean }) {
  return (
    <View style={styles.iconContainer}>
      <Feather
        name={icon}
        size={22}
        color={
          focused ? LuxeColors.primaryContainer : LuxeColors.onSurfaceVariant
        }
      />
      {focused && <View style={styles.focusedDot} />}
    </View>
  );
}

/** Layout thanh tab dưới cùng gồm 4 tab: Trang chủ, Lịch hẹn, Phần thưởng, Cá nhân. */
export default function MainTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: LuxeColors.primaryContainer,
        tabBarInactiveTintColor: LuxeColors.onSurfaceVariant,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Trang chủ",
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="home" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="appointments"
        options={{
          title: "Lịch hẹn",
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="calendar" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="rewards"
        options={{
          title: "Phần thưởng",
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="award" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Cá nhân",
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="user" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderTopWidth: 1,
    borderTopColor: LuxeColors.outlineVariant + "30",
    height: 74,
    paddingBottom: 34,
    paddingTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 10,
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
    height: 28,
  },
  focusedDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: LuxeColors.primaryContainer,
    marginTop: 2,
  },
});
