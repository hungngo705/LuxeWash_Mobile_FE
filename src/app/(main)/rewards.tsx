/**
 * Rewards Screen
 * Shows loyalty points and available rewards
 */

import {
  LuxeBorderRadius,
  LuxeColors,
  LuxeSpacing,
  MembershipConfig,
} from "@/constants/luxeTheme";
import { useAuth } from "@/contexts/AuthContext";
import { loyaltyService, type Tier, type Voucher } from "@/services/api";
import { Feather } from "@expo/vector-icons";
import { useRouter, type RelativePathString } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function RewardsScreen() {
  const router = useRouter();
  const { user, refreshProfile } = useAuth();
  const membershipInfo = user
    ? MembershipConfig[user.membershipTier]
    : MembershipConfig.standard;

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("vi-VN").format(amount);
  };

  const [tiers, setTiers] = useState<Tier[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(
    async ({ showLoading = true }: { showLoading?: boolean } = {}) => {
      if (showLoading) {
        setLoading(true);
      }
      try {
        const [tiersRes, vouchersRes] = await Promise.all([
          loyaltyService.getTiers(),
          loyaltyService.getMyVouchers(),
        ]);
        if (tiersRes.statusCode === 200 && tiersRes.data)
          setTiers(tiersRes.data);
        if (vouchersRes.statusCode === 200 && vouchersRes.data) {
          const available = vouchersRes.data.filter(
            (v) => !v.isUsed && v.remainingUsage > 0,
          );
          setVouchers(available);
        }
      } catch (e) {
        console.error("Failed to load loyalty data:", e);
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshProfile(), loadData({ showLoading: false })]);
    } finally {
      setRefreshing(false);
    }
  }, [loadData, refreshProfile]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={LuxeColors.primaryContainer}
              colors={[LuxeColors.primaryContainer]}
            />
          }
        >
          {/* Points Card */}
          <View style={styles.pointsCard}>
            <View style={styles.pointsHeader}>
              <Text style={styles.pointsLabel}>Số dư hiện tại</Text>
            </View>
            <View style={styles.pointsDisplay}>
              <Text style={styles.pointsValue}>
                {user?.loyaltyPoints?.toLocaleString("vi-VN") || "0"}
              </Text>
              <Text style={styles.pointsUnit}>Điểm</Text>
            </View>
            <View style={styles.membershipInfo}>
              <Text style={styles.membershipLabel}>Cấp độ thành viên</Text>
              <View
                style={[
                  styles.membershipBadge,
                  { backgroundColor: membershipInfo.color + "20" },
                ]}
              >
                <Text
                  style={[
                    styles.membershipBadgeText,
                    { color: membershipInfo.color },
                  ]}
                >
                  {membershipInfo.nameVi}
                </Text>
              </View>
            </View>
          </View>

          {/* Membership Benefits */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tiện ích khả dụng</Text>
            <View style={styles.benefitsGrid}>
              {membershipInfo.benefits.map((benefit, index) => (
                <View key={index} style={styles.benefitCard}>
                  <View style={styles.benefitIcon}>
                    <Feather
                      name={
                        index === 0
                          ? "tag"
                          : index === 1
                            ? "check-circle"
                            : index === 2
                              ? "trending-up"
                              : "gift"
                      }
                      size={20}
                      color={LuxeColors.primaryContainer}
                    />
                  </View>
                  <Text style={styles.benefitText}>{benefit}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Redeemable Rewards */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Kho Voucher</Text>
              <TouchableOpacity
                onPress={() => router.push("/vouchers" as RelativePathString)}
              >
                <Text style={styles.seeAllText}>Xem tất cả →</Text>
              </TouchableOpacity>
            </View>
            {loading ? (
              <ActivityIndicator color={LuxeColors.primaryContainer} />
            ) : vouchers.length > 0 ? (
              vouchers.slice(0, 3).map((voucher, index) => (
                <TouchableOpacity
                  key={`${voucher.voucherId}-${voucher.receivedDate}-${index}`}
                  style={styles.rewardCard}
                  onPress={() => router.push("/vouchers" as RelativePathString)}
                >
                  <View style={styles.rewardContent}>
                    <Text style={styles.rewardTitle}>{voucher.code}</Text>
                    <Text style={styles.rewardDesc}>
                      Giảm {formatCurrency(voucher.discountAmount)}đ
                    </Text>
                  </View>
                  <View style={styles.rewardAction}>
                    {voucher.isUsed ? (
                      <View style={styles.usedTag}>
                        <Text style={styles.usedTagText}>Đã dùng</Text>
                      </View>
                    ) : (
                      <Text style={styles.redeemBtnText}>→</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <TouchableOpacity
                style={styles.emptyCard}
                onPress={() => router.push("/vouchers" as RelativePathString)}
              >
                <Text style={styles.emptyText}>
                  Chưa có voucher - Nhận ngay!
                </Text>
                <Text style={styles.emptyAction}>→ Đến kho voucher</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* How to Earn */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cách tích điểm</Text>
            <View style={styles.earnCard}>
              <View style={styles.earnItem}>
                <View
                  style={[
                    styles.earnIconContainer,
                    { backgroundColor: LuxeColors.primaryContainer + "20" },
                  ]}
                >
                  <Feather
                    name="settings"
                    size={20}
                    color={LuxeColors.primaryContainer}
                  />
                </View>
                <View style={styles.earnInfo}>
                  <Text style={styles.earnTitle}>Sử dụng dịch vụ</Text>
                  <Text style={styles.earnDesc}>1 điểm/1.000đ thanh toán</Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LuxeColors.background,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: LuxeSpacing.lg,
    paddingTop: LuxeSpacing.lg,
    paddingBottom: 100,
  },
  pointsCard: {
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    borderRadius: LuxeBorderRadius.xl,
    padding: LuxeSpacing.xl,
    alignItems: "center",
    marginBottom: LuxeSpacing.xl,
    shadowColor: LuxeColors.primaryContainer,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 40,
    elevation: 5,
  },
  pointsHeader: {
    marginBottom: LuxeSpacing.sm,
  },
  pointsLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: LuxeColors.onSurfaceVariant,
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  pointsDisplay: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: LuxeSpacing.md,
  },
  pointsValue: {
    fontSize: 48,
    fontWeight: "700",
    color: LuxeColors.onSurface,
  },
  pointsUnit: {
    fontSize: 18,
    fontWeight: "500",
    color: LuxeColors.primaryContainer,
    marginLeft: 8,
  },
  membershipInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  membershipLabel: {
    fontSize: 14,
    color: LuxeColors.onSurfaceVariant,
  },
  membershipBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  membershipBadgeText: {
    fontSize: 14,
    fontWeight: "700",
  },
  section: {
    marginBottom: LuxeSpacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: LuxeSpacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: LuxeColors.onSurface,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: "600",
    color: LuxeColors.primaryContainer,
  },
  benefitsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: LuxeSpacing.md,
  },
  benefitCard: {
    width: "48%",
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderRadius: LuxeBorderRadius.lg,
    padding: LuxeSpacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: LuxeColors.outlineVariant + "30",
  },
  benefitIcon: {
    marginBottom: 8,
  },
  benefitText: {
    fontSize: 13,
    fontWeight: "500",
    color: LuxeColors.onSurface,
    textAlign: "center",
  },
  rewardCard: {
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderRadius: LuxeBorderRadius.xl,
    padding: LuxeSpacing.md,
    marginBottom: LuxeSpacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: LuxeColors.outlineVariant + "30",
  },
  rewardContent: {
    flex: 1,
  },
  rewardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: LuxeColors.onSurface,
    marginBottom: 4,
  },
  rewardDesc: {
    fontSize: 13,
    color: LuxeColors.onSurfaceVariant,
    lineHeight: 18,
  },
  rewardAction: {
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  rewardPoints: {
    fontSize: 14,
    fontWeight: "600",
    color: LuxeColors.primaryContainer,
  },
  redeemBtn: {
    backgroundColor: LuxeColors.primaryContainer + "20",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: LuxeBorderRadius.md,
    marginTop: 8,
  },
  redeemBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: LuxeColors.primaryContainer,
  },
  usedTag: {
    backgroundColor: LuxeColors.surfaceVariant,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: LuxeBorderRadius.md,
  },
  usedTagText: {
    fontSize: 11,
    fontWeight: "600",
    color: LuxeColors.onSurfaceVariant,
  },
  emptyCard: {
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    borderRadius: LuxeBorderRadius.xl,
    padding: LuxeSpacing.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: LuxeColors.outlineVariant + "30",
    borderStyle: "dashed",
  },
  emptyText: {
    fontSize: 14,
    color: LuxeColors.onSurfaceVariant,
    marginBottom: 8,
  },
  emptyAction: {
    fontSize: 13,
    fontWeight: "600",
    color: LuxeColors.primaryContainer,
  },
  earnCard: {
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderRadius: LuxeBorderRadius.xl,
    padding: LuxeSpacing.md,
    gap: LuxeSpacing.md,
  },
  earnItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: LuxeSpacing.md,
  },
  earnIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  earnInfo: {
    flex: 1,
  },
  earnTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: LuxeColors.onSurface,
  },
  earnDesc: {
    fontSize: 13,
    color: LuxeColors.onSurfaceVariant,
    marginTop: 2,
  },
});
