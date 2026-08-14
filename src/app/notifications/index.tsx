import { Header } from "@/components/ui/Header";
import {
  LuxeBorderRadius,
  LuxeColors,
  LuxeShadows,
  LuxeSpacing,
} from "@/constants/luxeTheme";
import { useNotifications } from "@/contexts/NotificationContext";
import { useOverloadSuggestions } from "@/contexts/OverloadSuggestionContext";
import type { UserNotification } from "@/services/api";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TYPE_STYLE: Record<
  string,
  { icon: React.ComponentProps<typeof Feather>["name"]; color: string; background: string }
> = {
  booking: { icon: "calendar", color: "#087EA4", background: "#E0F2FE" },
  overload_suggestion: { icon: "alert-triangle", color: "#B91C1C", background: "#FEE2E2" },
  vehicle: { icon: "truck", color: "#2E7D32", background: "#E8F5E9" },
  voucher: { icon: "gift", color: "#C2410C", background: "#FFF7ED" },
};

function formatNotificationTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  const time = date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (isToday) return `Hôm nay, ${time}`;
  return `${date.toLocaleDateString("vi-VN")} · ${time}`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { openSuggestionForBooking } = useOverloadSuggestions();
  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const openNotification = async (notification: UserNotification) => {
    await markAsRead(notification.id).catch(() => undefined);

    const type = notification.type.toLowerCase();
    if (type === "overload_suggestion" && notification.referenceId) {
      const bookingId = Number(notification.referenceId);
      if (Number.isInteger(bookingId) && bookingId > 0) {
        await openSuggestionForBooking(bookingId);
      }
    } else if (type === "booking" && notification.referenceId) {
      router.push(`/booking/${notification.referenceId}` as any);
    } else if (type === "vehicle") {
      router.push("/vehicles" as any);
    } else if (type === "voucher") {
      router.push("/vouchers" as any);
    }
  };

  const renderNotification = ({ item }: { item: UserNotification }) => {
    const visual = TYPE_STYLE[item.type.toLowerCase()] ?? {
      icon: "bell" as const,
      color: LuxeColors.primaryContainer,
      background: LuxeColors.primaryContainer + "18",
    };

    return (
      <TouchableOpacity
        style={[styles.card, !item.isRead && styles.unreadCard]}
        onPress={() => void openNotification(item)}
        activeOpacity={0.78}
        accessibilityRole="button"
        accessibilityLabel={`${item.isRead ? "" : "Chưa đọc. "}${item.title}. ${item.body}`}
      >
        <View style={[styles.iconWrap, { backgroundColor: visual.background }]}>
          <Feather name={visual.icon} size={20} color={visual.color} />
        </View>
        <View style={styles.cardContent}>
          <View style={styles.titleRow}>
            <Text style={[styles.cardTitle, !item.isRead && styles.unreadTitle]} numberOfLines={2}>
              {item.title}
            </Text>
            {!item.isRead && <View style={styles.unreadDot} />}
          </View>
          {!!item.body && <Text style={styles.cardBody}>{item.body}</Text>}
          <Text style={styles.cardTime}>{formatNotificationTime(item.createdAt)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <Header
          title="Thông báo"
          onBack={() => router.back()}
          rightElement={
            unreadCount > 0 ? (
              <TouchableOpacity
                onPress={() => void markAllAsRead().catch(() => undefined)}
                accessibilityRole="button"
                accessibilityLabel="Đánh dấu tất cả thông báo là đã đọc"
              >
                <Text style={styles.readAllText}>Đọc tất cả</Text>
              </TouchableOpacity>
            ) : undefined
          }
        />

        {isLoading && notifications.length === 0 ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={LuxeColors.primaryContainer} />
            <Text style={styles.stateText}>Đang tải thông báo...</Text>
          </View>
        ) : (
          <FlatList
            data={notifications}
            renderItem={renderNotification}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={[
              styles.listContent,
              notifications.length === 0 && styles.emptyListContent,
            ]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isLoading}
                onRefresh={() => void refreshNotifications()}
                tintColor={LuxeColors.primaryContainer}
                colors={[LuxeColors.primaryContainer]}
              />
            }
            ListEmptyComponent={
              <View style={styles.centerState}>
                <View style={styles.emptyIcon}>
                  <Feather name={error ? "wifi-off" : "bell"} size={36} color={LuxeColors.outline} />
                </View>
                <Text style={styles.emptyTitle}>
                  {error ? "Không thể tải thông báo" : "Chưa có thông báo"}
                </Text>
                <Text style={styles.stateText}>
                  {error ?? "Các cập nhật về lịch hẹn, xe và voucher sẽ xuất hiện tại đây."}
                </Text>
                {error && (
                  <TouchableOpacity style={styles.retryButton} onPress={() => void refreshNotifications()}>
                    <Feather name="refresh-cw" size={16} color="#ffffff" />
                    <Text style={styles.retryText}>Thử lại</Text>
                  </TouchableOpacity>
                )}
              </View>
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: LuxeColors.background },
  safeArea: { flex: 1 },
  readAllText: {
    color: LuxeColors.primaryContainer,
    fontSize: 12,
    fontWeight: "700",
  },
  listContent: {
    padding: LuxeSpacing.lg,
    paddingBottom: 40,
    gap: 12,
  },
  emptyListContent: { flexGrow: 1 },
  card: {
    flexDirection: "row",
    gap: 13,
    backgroundColor: "#ffffff",
    borderRadius: LuxeBorderRadius.lg,
    padding: 15,
    borderWidth: 1,
    borderColor: LuxeColors.outlineVariant + "35",
    ...LuxeShadows.sm,
  },
  unreadCard: {
    backgroundColor: "#F0F9FF",
    borderColor: LuxeColors.primaryContainer + "45",
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cardContent: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: "600", color: LuxeColors.onSurface },
  unreadTitle: { fontWeight: "800" },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginTop: 5,
    backgroundColor: LuxeColors.primaryContainer,
  },
  cardBody: {
    fontSize: 13,
    lineHeight: 19,
    color: LuxeColors.onSurfaceVariant,
    marginTop: 5,
  },
  cardTime: { fontSize: 11, color: LuxeColors.outline, marginTop: 9 },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: LuxeColors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: LuxeColors.onSurface, marginBottom: 7 },
  stateText: {
    fontSize: 13,
    lineHeight: 19,
    color: LuxeColors.onSurfaceVariant,
    textAlign: "center",
    marginTop: 8,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: LuxeColors.primaryContainer,
  },
  retryText: { color: "#ffffff", fontSize: 13, fontWeight: "700" },
});
