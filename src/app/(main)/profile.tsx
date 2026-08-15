/**
 * Profile Screen
 * Bold professional redesign with gradient header and clean menu
 */

import {
  LuxeColors,
  LuxeShadows,
  MembershipConfig,
} from "@/constants/luxeTheme";
import { useAuth } from "@/contexts/AuthContext";
import { vndToPoints } from "@/utils/format";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useConfirmDialog } from "@/components/ConfirmDialog";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, walletBalance, logout, refreshProfile, refreshWallet } = useAuth();
  const { confirm } = useConfirmDialog();
  const [refreshing, setRefreshing] = useState(false);

  const currentUser = user;
  const membershipInfo = currentUser
    ? MembershipConfig[currentUser.membershipTier]
    : MembershipConfig.standard;

  const walletPoints = vndToPoints(walletBalance);
  const displayPoints = walletPoints;

  const menuItems = [
    {
      icon: "credit-card",
      iconColor: "#006689",
      bgColor: LuxeColors.primaryContainer + '18',
      title: "Ví & Thanh toán",
      subtitle: `${displayPoints.toLocaleString('vi-VN')} điểm`,
      onPress: () => router.push("/wallet" as any),
    },
    {
      icon: "gift",
      iconColor: "#C62828",
      bgColor: '#C6282820',
      title: "Voucher",
      subtitle: "Kho voucher & điểm thưởng",
      onPress: () => router.push("/vouchers" as any),
    },
    {
      icon: "activity",
      iconColor: "#7C3AED",
      bgColor: '#7C3AED18',
      title: "Lịch sử điểm",
      subtitle: "Theo dõi điểm đã cộng và sử dụng",
      onPress: () => router.push("/points/history" as any),
    },
    {
      icon: "message-circle",
      iconColor: LuxeColors.primary,
      bgColor: LuxeColors.primary + '18',
      title: "Trợ lý LuxeWash",
      subtitle: "Hỏi điểm, hạng và nhận gợi ý riêng",
      onPress: () => router.push("/assistant" as any),
    },
    {
      icon: "lock",
      iconColor: "#2E7D32",
      bgColor: '#2E7D3220',
      title: "Bảo mật",
      subtitle: "Đổi mật khẩu",
      onPress: () => router.push("/change-password"),
    },
    {
      icon: "bell",
      iconColor: "#F57C00",
      bgColor: '#F57C0020',
      title: "Thông báo",
      subtitle: "Lịch sử thông báo của bạn",
      onPress: () => router.push("/notifications" as any),
    },
    {
      icon: "help-circle",
      iconColor: "#7B1FA2",
      bgColor: '#7B1FA220',
      title: "Hỗ trợ",
      subtitle: "Liên hệ, FAQ",
      onPress: () => {},
    },
  ];

  const handleLogout = () => {
    confirm({
      title: "Đăng xuất",
      message: "Bạn có chắc chắn muốn đăng xuất?",
      confirmText: "Đăng xuất",
      destructive: true,
      onConfirm: async () => {
        await logout();
        router.replace("/login");
      },
    });
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshProfile(), refreshWallet()]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshProfile, refreshWallet]);

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
          {/* Profile Header Card */}
          <View style={styles.profileCard}>
            <View style={[styles.profileGradient, { backgroundColor: membershipInfo.color }]}>
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => router.push('/profile-edit' as any)}
              >
                <Feather name="edit-2" size={14} color="#ffffff" />
                <Text style={styles.editBtnText}> Sửa</Text>
              </TouchableOpacity>
              <View style={styles.avatarWrap}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {currentUser?.name?.charAt(0) || "U"}
                  </Text>
                </View>
              </View>
              <Text style={styles.userName}>{currentUser?.name || "Khách"}</Text>
              <Text style={styles.userPhone}>
                {currentUser?.phoneNumber || ""}
              </Text>
              <View style={[styles.memberBadge, { backgroundColor: '#ffffff' }]}>
                <Text style={[styles.memberBadgeText, { color: membershipInfo.color }]}>
                  {membershipInfo.name}
                </Text>
              </View>
            </View>
            <View style={styles.profileStats}>
              <View style={styles.profileStat}>
                <Text style={styles.profileStatValue}>
                  {currentUser?.loyaltyPoints?.toLocaleString("vi-VN") || "0"}
                </Text>
                <Text style={styles.profileStatLabel}>Điểm</Text>
              </View>
              <View style={styles.profileStatDivider} />
              <View style={styles.profileStat}>
                <Text style={styles.profileStatValue}>
                  {user?.vehicles?.length ?? 0}
                </Text>
                <Text style={styles.profileStatLabel}>Xe</Text>
              </View>
              <View style={styles.profileStatDivider} />
              <View style={styles.profileStat}>
                <Text style={styles.profileStatValue}>12</Text>
                <Text style={styles.profileStatLabel}>Lần rửa</Text>
              </View>
            </View>
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/appointments')}>
              <View style={[styles.quickActionIcon, { backgroundColor: LuxeColors.primaryContainer + '18' }]}>
                <Feather name="calendar" size={20} color={LuxeColors.primaryContainer} />
              </View>
              <Text style={styles.quickActionText}>Lịch hẹn</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/vouchers')}>
              <View style={[styles.quickActionIcon, { backgroundColor: LuxeColors.tertiaryContainer + '25' }]}>
                <Feather name="tag" size={20} color={LuxeColors.tertiaryContainer} />
              </View>
              <Text style={styles.quickActionText}>Voucher</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction}>
              <View style={[styles.quickActionIcon, { backgroundColor: '#F59E0B18' }]}>
                <Feather name="star" size={20} color="#F59E0B" />
              </View>
              <Text style={styles.quickActionText}>Đánh giá</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction}>
              <View style={[styles.quickActionIcon, { backgroundColor: LuxeColors.secondaryContainer + '30' }]}>
                <Feather name="share-2" size={20} color={LuxeColors.secondaryContainer} />
              </View>
              <Text style={styles.quickActionText}>Chia sẻ</Text>
            </TouchableOpacity>
          </View>

          {/* Menu List */}
          <View style={styles.menuCard}>
            {user && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => router.push("/vehicles" as any)}
              >
                <View style={styles.menuItemLeft}>
                  <View style={[styles.menuIconWrap, { backgroundColor: LuxeColors.primaryContainer + '18' }]}>
                    <Feather name="truck" size={18} color={LuxeColors.primaryContainer} />
                  </View>
                  <View style={styles.menuItemContent}>
                    <Text style={styles.menuTitle}>Xe của tôi</Text>
                    <Text style={styles.menuSubtitle}>
                      {user.vehicles.length}/5 xe đã đăng ký
                    </Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={20} color={LuxeColors.outline} />
              </TouchableOpacity>
            )}
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.menuItem, index === menuItems.length - 1 && styles.menuItemLast]}
                onPress={item.onPress}
              >
                <View style={styles.menuItemLeft}>
                  <View style={[styles.menuIconWrap, { backgroundColor: item.bgColor }]}>
                    <Feather name={item.icon as any} size={18} color={item.iconColor} />
                  </View>
                  <View style={styles.menuItemContent}>
                    <Text style={styles.menuTitle}>{item.title}</Text>
                    <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={20} color={LuxeColors.outline} />
              </TouchableOpacity>
            ))}
          </View>

          {/* Logout */}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Feather name="log-out" size={18} color="#DC2626" />
            <Text style={styles.logoutText}>Đăng xuất</Text>
          </TouchableOpacity>

          {/* Version */}
          <Text style={styles.version}>LuxeWash v1.0.1</Text>

          <View style={{ height: 80 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: LuxeColors.background },
  safeArea: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16 },
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    ...LuxeShadows.md,
  },
  profileGradient: {
    backgroundColor: LuxeColors.primary,
    padding: 20,
    paddingTop: 12,
    alignItems: 'center',
  },
  editBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  avatarWrap: { marginBottom: 12, marginTop: 4 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "700",
    color: "#ffffff",
  },
  userName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 2,
  },
  userPhone: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 10,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  memberDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  memberBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  profileStats: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
  },
  profileStat: {
    flex: 1,
    alignItems: "center",
  },
  profileStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: LuxeColors.outlineVariant + '40',
  },
  profileStatValue: {
    fontSize: 20,
    fontWeight: "800",
    color: LuxeColors.onSurface,
  },
  profileStatLabel: {
    fontSize: 12,
    color: LuxeColors.onSurfaceVariant,
    marginTop: 2,
    fontWeight: '500',
  },
  quickActions: {
    flexDirection: "row",
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    ...LuxeShadows.sm,
  },
  quickAction: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  quickActionText: {
    fontSize: 11,
    color: LuxeColors.onSurfaceVariant,
    fontWeight: '500',
    textAlign: 'center',
  },
  menuCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 16,
    ...LuxeShadows.sm,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: LuxeColors.outlineVariant + '20',
  },
  menuItemLast: { borderBottomWidth: 0 },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  menuIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  menuItemContent: { flex: 1 },
  menuTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: LuxeColors.onSurface,
  },
  menuSubtitle: {
    fontSize: 12,
    color: LuxeColors.onSurfaceVariant,
    marginTop: 2,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEF2F2",
    borderRadius: 16,
    padding: 16,
    gap: 8,
    marginBottom: 16,
    ...LuxeShadows.sm,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#DC2626",
  },
  version: {
    textAlign: "center",
    fontSize: 12,
    color: LuxeColors.outline,
    marginBottom: 16,
  },
});
