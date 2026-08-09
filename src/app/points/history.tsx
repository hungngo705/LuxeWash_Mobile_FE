import { EmptyState } from "@/components/ui/EmptyState";
import { Header } from "@/components/ui/Header";
import {
  LuxeBorderRadius,
  LuxeColors,
  LuxeShadows,
  LuxeSpacing,
} from "@/constants/luxeTheme";
import { useAuth } from "@/contexts/AuthContext";
import {
  ApiError,
  loyaltyService,
  type PointHistoryItem,
} from "@/services/api";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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

const formatReason = (reason: string) => {
  const normalized = reason.trim();
  if (normalized.toLowerCase().startsWith("service completion")) {
    return normalized.replace(/service completion/i, "Hoàn thành dịch vụ");
  }
  return normalized || "Điều chỉnh điểm";
};

const formatTransactionDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function PointHistoryScreen() {
  const router = useRouter();
  const { user, refreshProfile } = useAuth();
  const [items, setItems] = useState<PointHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const response = await loyaltyService.getPointsHistory();
      const history = response.data ?? [];
      setItems(
        [...history].sort(
          (a, b) =>
            new Date(b.transactionDate).getTime() -
            new Date(a.transactionDate).getTime(),
        ),
      );
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Không thể tải lịch sử điểm. Vui lòng thử lại.",
      );
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const totals = useMemo(
    () =>
      items.reduce(
        (sum, item) => ({
          added: sum.added + item.pointsAdded,
          deducted: sum.deducted + item.pointsDeducted,
        }),
        { added: 0, deducted: 0 },
      ),
    [items],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadHistory(false), refreshProfile()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadHistory, refreshProfile]);

  const renderItem = ({ item }: { item: PointHistoryItem }) => {
    const isAdded = item.pointsAdded > 0;
    const amount = isAdded ? item.pointsAdded : item.pointsDeducted;

    return (
      <View style={styles.historyItem}>
        <View
          style={[
            styles.iconContainer,
            isAdded ? styles.addedIcon : styles.deductedIcon,
          ]}
        >
          <Feather
            name={isAdded ? "arrow-down-left" : "arrow-up-right"}
            size={19}
            color={isAdded ? "#15803D" : LuxeColors.error}
          />
        </View>
        <View style={styles.itemContent}>
          <Text selectable style={styles.reason} numberOfLines={2}>
            {formatReason(item.reason)}
          </Text>
          <Text selectable style={styles.date}>
            {formatTransactionDate(item.transactionDate)}
          </Text>
        </View>
        <Text
          selectable
          style={[
            styles.amount,
            { color: isAdded ? "#15803D" : LuxeColors.error },
          ]}
        >
          {isAdded ? "+" : "−"}
          {amount.toLocaleString("vi-VN")}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <Header title="Lịch sử điểm" onBack={() => router.back()} />
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={LuxeColors.primaryContainer} />
          <Text style={styles.loadingText}>Đang tải lịch sử điểm...</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.ledgerId)}
          renderItem={renderItem}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={LuxeColors.primaryContainer}
              colors={[LuxeColors.primaryContainer]}
            />
          }
          ListHeaderComponent={
            <View style={styles.summaryCard}>
              <View style={styles.balanceRow}>
                <View>
                  <Text style={styles.balanceLabel}>Điểm hiện có</Text>
                  <Text selectable style={styles.balanceValue}>
                    {(user?.loyaltyPoints ?? 0).toLocaleString("vi-VN")}
                  </Text>
                </View>
                <View style={styles.balanceIcon}>
                  <Feather name="award" size={26} color={LuxeColors.primary} />
                </View>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.totalsRow}>
                <View style={styles.totalItem}>
                  <Text style={styles.totalLabel}>Đã cộng</Text>
                  <Text selectable style={[styles.totalValue, { color: "#15803D" }]}>
                    +{totals.added.toLocaleString("vi-VN")}
                  </Text>
                </View>
                <View style={styles.totalItem}>
                  <Text style={styles.totalLabel}>Đã sử dụng</Text>
                  <Text selectable style={[styles.totalValue, { color: LuxeColors.error }]}>
                    −{totals.deducted.toLocaleString("vi-VN")}
                  </Text>
                </View>
              </View>
              {error ? (
                <TouchableOpacity style={styles.errorBanner} onPress={() => loadHistory()}>
                  <Feather name="alert-circle" size={17} color={LuxeColors.error} />
                  <Text selectable style={styles.errorText}>{error}</Text>
                  <Text style={styles.retryText}>Thử lại</Text>
                </TouchableOpacity>
              ) : null}
              {items.length > 0 ? (
                <Text style={styles.sectionTitle}>Giao dịch gần đây</Text>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            error ? null : (
              <EmptyState
                icon="activity"
                title="Chưa có giao dịch điểm"
                subtitle="Điểm được cộng hoặc sử dụng sẽ xuất hiện tại đây."
              />
            )
          }
          ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: LuxeColors.background },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14, color: LuxeColors.onSurfaceVariant },
  listContent: { padding: LuxeSpacing.lg, paddingBottom: LuxeSpacing.xxl },
  summaryCard: { gap: LuxeSpacing.md, marginBottom: LuxeSpacing.lg },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: LuxeSpacing.xl,
    borderRadius: LuxeBorderRadius.xl,
    backgroundColor: "#FFFFFF",
    ...LuxeShadows.md,
  },
  balanceLabel: { fontSize: 13, color: LuxeColors.onSurfaceVariant, fontWeight: "600" },
  balanceValue: {
    marginTop: 3,
    fontSize: 34,
    fontWeight: "800",
    color: LuxeColors.primary,
    fontVariant: ["tabular-nums"],
  },
  balanceIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: LuxeColors.primaryContainer + "1F",
  },
  summaryDivider: { display: "none" },
  totalsRow: { flexDirection: "row", gap: LuxeSpacing.md },
  totalItem: {
    flex: 1,
    padding: LuxeSpacing.md,
    borderRadius: LuxeBorderRadius.lg,
    backgroundColor: "#FFFFFF",
    ...LuxeShadows.sm,
  },
  totalLabel: { fontSize: 12, color: LuxeColors.onSurfaceVariant },
  totalValue: { marginTop: 4, fontSize: 18, fontWeight: "800", fontVariant: ["tabular-nums"] },
  sectionTitle: { marginTop: LuxeSpacing.sm, fontSize: 17, fontWeight: "700", color: LuxeColors.onSurface },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: LuxeSpacing.md,
    borderRadius: LuxeBorderRadius.lg,
    backgroundColor: "#FFFFFF",
  },
  iconContainer: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  addedIcon: { backgroundColor: "#DCFCE7" },
  deductedIcon: { backgroundColor: LuxeColors.errorContainer },
  itemContent: { flex: 1, paddingHorizontal: LuxeSpacing.md, gap: 3 },
  reason: { fontSize: 14, fontWeight: "600", color: LuxeColors.onSurface, lineHeight: 19 },
  date: { fontSize: 12, color: LuxeColors.onSurfaceVariant, fontVariant: ["tabular-nums"] },
  amount: { fontSize: 15, fontWeight: "800", fontVariant: ["tabular-nums"] },
  itemSeparator: { height: LuxeSpacing.sm },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: LuxeSpacing.md,
    borderRadius: LuxeBorderRadius.lg,
    backgroundColor: LuxeColors.errorContainer,
  },
  errorText: { flex: 1, fontSize: 12, lineHeight: 17, color: LuxeColors.onErrorContainer },
  retryText: { fontSize: 12, fontWeight: "800", color: LuxeColors.error },
});
