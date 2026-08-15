/**
 * Home Screen - LuxeWash Trang chủ
 * Bold professional redesign with gradient cards and clean solid styling
 * Redirects to login if not authenticated
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LuxeColors, LuxeSpacing, LuxeBorderRadius, LuxeShadows, MembershipConfig } from '@/constants/luxeTheme';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { bookingService } from '@/services/api';
import { loyaltyService, Voucher } from '@/services/api/loyaltyService';

const MOCK_SERVICES = [
  { id: 'svc_001', name: 'Rửa xe tiêu chuẩn', category: 'basic', price: 150000 },
  { id: 'svc_002', name: 'Rửa xe cao cấp', category: 'premium', price: 300000 },
  { id: 'svc_003', name: 'Vệ sinh chuyên sâu', category: 'deep_clean', price: 500000 },
  { id: 'svc_004', name: 'Phủ Ceramic', category: 'special', price: 1000000 },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user, walletBalance, isAuthenticated, refreshProfile, refreshWallet } = useAuth();
  const { unreadCount, refreshNotifications } = useNotifications();
  const [services, setServices] = useState<Array<{ serviceId: number; serviceName: string; description: string; prices: Array<{ vehicleTypeId: number; vehicleTypeName: string; price: number }> }>>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loadingVouchers, setLoadingVouchers] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const vehicles = user?.vehicles || [];
  const membershipInfo = user ? MembershipConfig[user.membershipTier] : MembershipConfig.standard;

  const loadServices = useCallback(async () => {
    setLoadingServices(true);
    try {
      const res = await bookingService.getServices();
      if (res.statusCode === 200 && res.data) {
        setServices(res.data);
      }
    } catch (e) {
      console.error('Failed to load services:', e);
    } finally {
      setLoadingServices(false);
    }
  }, []);

  const loadVouchers = useCallback(async () => {
    setLoadingVouchers(true);
    try {
      const res = await loyaltyService.getMyVouchers();
      if (res.statusCode === 200 && res.data) {
        const unused = res.data.filter(v => v.remainingUsage > 0 && new Date(v.expiryDate) > new Date());
        setVouchers(unused);
      }
    } catch (e) {
      console.error('Failed to load vouchers:', e);
    } finally {
      setLoadingVouchers(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadServices();
    }
  }, [isAuthenticated, loadServices]);

  useEffect(() => {
    if (isAuthenticated) {
      loadVouchers();
    }
  }, [isAuthenticated, loadVouchers]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshProfile(),
        refreshWallet(),
        loadServices(),
        loadVouchers(),
        refreshNotifications(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [loadServices, loadVouchers, refreshNotifications, refreshProfile, refreshWallet]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return null;
  }

  const getLowestPrice = (service: typeof services[0]) => {
    if (!service.prices || service.prices.length === 0) return 0;
    return Math.min(...service.prices.map(p => p.price));
  };

  const handleBooking = () => {
    router.push('/booking/select-branch');
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
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
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.greeting}>Xin chào,</Text>
              <Text style={styles.userName}>{user?.name || 'Khách'}</Text>
            </View>
            <TouchableOpacity
              style={styles.notificationBtn}
              onPress={() => router.push('/notifications' as any)}
            >
              <Feather name="bell" size={22} color={LuxeColors.primaryContainer} />
              {unreadCount > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Membership Card - Bold Gradient */}
          <View style={styles.membershipCard}>
            <View style={styles.membershipTop}>
              <View style={styles.membershipLeft}>
                <View style={[styles.memberBadge, { backgroundColor: '#ffffff' }]}>
                  <Text style={[styles.memberBadgeText, { color: membershipInfo.color }]}>
                    {membershipInfo.name}
                  </Text>
                </View>
                <Text style={styles.memberName}>{membershipInfo.name}</Text>
              </View>
              <View style={[styles.pointsBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <Feather name="star" size={14} color="#fff" />
                <Text style={styles.pointsText}>
                  {user?.loyaltyPoints?.toLocaleString('vi-VN') || '0'}
                </Text>
              </View>
            </View>
            <View style={styles.membershipDivider} />
            <View style={styles.membershipBottom}>
              <View style={styles.membershipStat}>
                <Text style={styles.membershipStatValue}>{Math.floor(walletBalance / 1000).toLocaleString('vi-VN')}</Text>
                <Text style={styles.membershipStatLabel}>điểm</Text>
              </View>
              <View style={styles.membershipStatDivider} />
              <View style={styles.membershipStat}>
                <Text style={styles.membershipStatValue}>{vehicles.length}</Text>
                <Text style={styles.membershipStatLabel}>Phương tiện</Text>
              </View>
              {membershipInfo.discountRate > 0 && (
                <>
                  <View style={styles.membershipStatDivider} />
                  <View style={styles.membershipStat}>
                    <Text style={[styles.membershipStatValue, { color: '#FFD700' }]}>
                      -{Math.round(membershipInfo.discountRate * 100)}%
                    </Text>
                    <Text style={styles.membershipStatLabel}>Giảm giá</Text>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* Vehicle List */}
          {vehicles.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Phương tiện</Text>
                <TouchableOpacity onPress={() => router.push('/vehicles')}>
                  <Text style={styles.seeAll}>Xem tất cả</Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.vehicleScroll}>
                {vehicles.map((vehicle, idx) => (
                  <TouchableOpacity
                    key={vehicle.id}
                    style={[styles.vehicleCard, idx === 0 && styles.vehicleCardFirst]}
                    onPress={() => router.push('/vehicles')}
                    activeOpacity={0.85}
                  >
                    <View style={styles.vehicleImageWrap}>
                      {vehicle.imageUrl ? (
                        <Image source={{ uri: vehicle.imageUrl }} style={styles.vehicleImg} resizeMode="cover" />
                      ) : (
                        <View style={styles.vehicleImgPlaceholder}>
                          <Feather name="truck" size={28} color={LuxeColors.outline} />
                        </View>
                      )}
                      <View style={styles.plateTag}>
                        <Text style={styles.plateTagText}>{vehicle.licensePlate}</Text>
                      </View>
                    </View>
                    <View style={styles.vehicleInfo}>
                      <Text style={styles.vehicleModel} numberOfLines={1}>
                        {vehicle.model || vehicle.brand || 'Phương tiện'}
                      </Text>
                      {vehicle.brand && vehicle.model && (
                        <Text style={styles.vehicleBrand} numberOfLines={1}>{vehicle.brand}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Phương tiện</Text>
              </View>
              <TouchableOpacity style={styles.emptyVehicleCard} onPress={() => router.push('/vehicles/add-vehicle')}>
                <View style={styles.emptyVehicleIcon}>
                  <Feather name="plus-circle" size={32} color={LuxeColors.primaryContainer} />
                </View>
                <View style={styles.emptyVehicleText}>
                  <Text style={styles.emptyVehicleTitle}>Thêm phương tiện</Text>
                  <Text style={styles.emptyVehicleSubtitle}>Đăng ký xe để đặt lịch rửa xe nhanh hơn</Text>
                </View>
                <Feather name="chevron-right" size={20} color={LuxeColors.outline} />
              </TouchableOpacity>
            </View>
          )}

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tiện ích</Text>
            <View style={styles.quickActions}>
              <TouchableOpacity style={styles.quickActionItem} onPress={handleBooking}>
                <View style={[styles.quickActionIcon, { backgroundColor: LuxeColors.primaryContainer + '20' }]}>
                  <Feather name="calendar" size={20} color={LuxeColors.primaryContainer} />
                </View>
                <Text style={styles.quickActionLabel}>Đặt lịch</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickActionItem}>
                <View style={[styles.quickActionIcon, { backgroundColor: '#E8F5E920' }]}>
                  <Feather name="map-pin" size={20} color="#2E7D32" />
                </View>
                <Text style={styles.quickActionLabel}>Chi nhánh</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickActionItem}>
                <View style={[styles.quickActionIcon, { backgroundColor: '#FFF3E020' }]}>
                  <Feather name="phone" size={20} color="#E65100" />
                </View>
                <Text style={styles.quickActionLabel}>Hỗ trợ</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => router.push('/assistant' as any)}
                accessibilityRole="button"
                accessibilityLabel="Mở Trợ lý LuxeWash"
              >
                <View style={[styles.quickActionIcon, { backgroundColor: '#F3E5F520' }]}>
                  <Feather name="message-circle" size={20} color="#7B1FA2" />
                </View>
                <Text style={styles.quickActionLabel}>Trợ lý AI</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Booking CTA */}
          <View style={styles.section}>
            <TouchableOpacity style={styles.bookingBtn} onPress={handleBooking}>
              <View style={styles.bookingBtnIcon}>
                <Feather name="star" size={22} color="#ffffff" />
              </View>
              <Text style={styles.bookingBtnText}>Đặt lịch hẹn ngay</Text>
              <Feather name="arrow-right" size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>

          {/* Services */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Dịch vụ</Text>
              <TouchableOpacity>
                <Text style={styles.seeAll}>Xem tất cả</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.servicesScroll}>
              {(services.length > 0 ? services : MOCK_SERVICES).map((service: any) => {
                const price = services.length > 0 ? getLowestPrice(service) : service.price;
                const cat = services.length > 0 ? 'basic' : service.category;
                return (
                  <View key={services.length > 0 ? service.serviceId : service.id} style={styles.serviceCard}>
                    <View style={styles.serviceIcon}>
                      <Feather
                        name={cat === 'basic' ? 'droplet' : cat === 'premium' ? 'star' : cat === 'deep_clean' ? 'sun' : 'award'}
                        size={24}
                        color={LuxeColors.primaryContainer}
                      />
                    </View>
                    <Text style={styles.serviceName}>{services.length > 0 ? service.serviceName : service.nameVi}</Text>
                    <Text style={styles.servicePrice}>từ {price.toLocaleString('vi-VN')}đ</Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>

          {/* Promotions */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Khuyến mãi</Text>
              <TouchableOpacity onPress={() => router.push('/vouchers')}>
                <Text style={styles.seeAll}>Xem tất cả</Text>
              </TouchableOpacity>
            </View>
            {loadingVouchers ? (
              <View style={[styles.promoCards, { justifyContent: 'center', paddingVertical: 20 }]}>
                <Text style={{ color: LuxeColors.onSurfaceVariant, fontSize: 13 }}>Đang tải...</Text>
              </View>
            ) : vouchers.length > 0 ? (
              <View style={styles.promoCards}>
                {vouchers.slice(0, 2).map((voucher, index) => (
                  <View
                    key={`${voucher.voucherId}-${voucher.receivedDate}-${index}`}
                    style={styles.promoCard}
                  >
                    <View style={styles.promoBadge}>
                      <Text style={styles.promoBadgeText}>
                        -{voucher.discountAmount.toLocaleString('vi-VN')}đ
                      </Text>
                    </View>
                    <Text style={styles.promoTitle}>{voucher.code}</Text>
                    <Text style={styles.promoDesc}>
                      Giảm {voucher.discountAmount.toLocaleString('vi-VN')}đ cho đơn từ {voucher.minOrderAmount.toLocaleString('vi-VN')}đ
                    </Text>
                    <View style={styles.promoCodeWrap}>
                      <Text style={styles.promoCode}>{voucher.code}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={[styles.promoCards, { justifyContent: 'center', paddingVertical: 20 }]}>
                <Text style={{ color: LuxeColors.onSurfaceVariant, fontSize: 13 }}>Chưa có voucher nào</Text>
              </View>
            )}
          </View>

          {/* Stats */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Thống kê</Text>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: LuxeColors.primaryContainer + '20' }]}>
                  <Feather name="check-circle" size={18} color={LuxeColors.primaryContainer} />
                </View>
                <Text style={styles.statValue}>{vehicles.length}</Text>
                <Text style={styles.statLabel}>Tổng lần rửa</Text>
              </View>
              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: '#F59E0B20' }]}>
                  <Feather name="star" size={18} color="#F59E0B" />
                </View>
                <Text style={styles.statValue}>
                  {user?.loyaltyPoints ? `${(user.loyaltyPoints / 1000).toFixed(1)}K` : '0'}
                </Text>
                <Text style={styles.statLabel}>Điểm tích luỹ</Text>
              </View>
            </View>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: LuxeColors.background },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    ...LuxeShadows.sm,
    borderBottomWidth: 1,
    borderBottomColor: LuxeColors.outlineVariant + '30',
  },
  headerLeft: {},
  greeting: { fontSize: 13, color: LuxeColors.onSurfaceVariant, fontWeight: '500' },
  userName: { fontSize: 22, fontWeight: '800', color: LuxeColors.onSurface, marginTop: 2 },
  notificationBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LuxeColors.surfaceContainer,
    borderRadius: 14,
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 3,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF5252',
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  notificationBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '800',
  },
  membershipCard: {
    margin: 20,
    backgroundColor: LuxeColors.primary,
    borderRadius: 20,
    padding: 20,
    ...LuxeShadows.lg,
  },
  membershipTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  membershipLeft: {},
  memberBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 4,
  },
  memberBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  memberName: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  pointsText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  membershipDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginBottom: 16 },
  membershipBottom: { flexDirection: 'row', alignItems: 'center' },
  membershipStat: { flex: 1, alignItems: 'center' },
  membershipStatDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.2)' },
  membershipStatValue: { fontSize: 18, fontWeight: '800', color: '#ffffff' },
  membershipStatLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  section: { paddingHorizontal: 20, marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: LuxeColors.onSurface },
  seeAll: { fontSize: 13, color: LuxeColors.primaryContainer, fontWeight: '600' },
  vehicleScroll: { paddingRight: 20 },
  vehicleCard: {
    width: 140,
    marginRight: 12,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    ...LuxeShadows.sm,
  },
  vehicleCardFirst: { marginLeft: 0 },
  vehicleImageWrap: { position: 'relative', height: 90 },
  vehicleImg: { width: '100%', height: '100%' },
  vehicleImgPlaceholder: {
    width: '100%', height: '100%',
    backgroundColor: LuxeColors.surfaceContainer,
    alignItems: 'center', justifyContent: 'center',
  },
  plateTag: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: LuxeColors.primaryContainer,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  plateTagText: { fontSize: 10, fontWeight: '800', color: '#ffffff', letterSpacing: 0.5 },
  vehicleInfo: { padding: 10 },
  vehicleModel: { fontSize: 13, fontWeight: '700', color: LuxeColors.onSurface, marginBottom: 2 },
  vehicleBrand: { fontSize: 11, color: LuxeColors.onSurfaceVariant },
  emptyVehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: LuxeColors.primaryContainer + '40',
    ...LuxeShadows.sm,
  },
  emptyVehicleIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: LuxeColors.primaryContainer + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  emptyVehicleText: { flex: 1 },
  emptyVehicleTitle: { fontSize: 15, fontWeight: '700', color: LuxeColors.onSurface, marginBottom: 2 },
  emptyVehicleSubtitle: { fontSize: 12, color: LuxeColors.onSurfaceVariant, lineHeight: 16 },
  quickActions: { flexDirection: 'row', backgroundColor: '#ffffff', borderRadius: 16, padding: 12, ...LuxeShadows.sm },
  quickActionItem: { flex: 1, alignItems: 'center', gap: 8 },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  quickActionLabel: { fontSize: 11, color: LuxeColors.onSurfaceVariant, fontWeight: '500', textAlign: 'center' },
  bookingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: LuxeColors.primaryContainer,
    paddingVertical: 16,
    borderRadius: 16,
    ...LuxeShadows.primary,
  },
  bookingBtnIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingBtnText: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  servicesScroll: { paddingRight: 20 },
  serviceCard: {
    width: 120,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    alignItems: 'center',
    ...LuxeShadows.sm,
  },
  serviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: LuxeColors.primaryContainer + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  serviceName: { fontSize: 13, fontWeight: '600', color: LuxeColors.onSurface, textAlign: 'center', marginBottom: 4 },
  servicePrice: { fontSize: 12, fontWeight: '700', color: LuxeColors.primaryContainer },
  promoCards: { flexDirection: 'row', gap: 12 },
  promoCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    ...LuxeShadows.sm,
  },
  promoBadge: {
    backgroundColor: LuxeColors.primaryContainer,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  promoBadgeText: { fontSize: 11, fontWeight: '800', color: '#ffffff' },
  promoTitle: { fontSize: 13, fontWeight: '600', color: LuxeColors.onSurface, marginBottom: 4 },
  promoDesc: { fontSize: 11, color: LuxeColors.onSurfaceVariant, lineHeight: 16, marginBottom: 8 },
  promoCodeWrap: {
    backgroundColor: LuxeColors.primaryContainer + '15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  promoCode: { fontSize: 11, fontWeight: '700', color: LuxeColors.primaryContainer },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    ...LuxeShadows.sm,
  },
  statIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statValue: { fontSize: 20, fontWeight: '800', color: LuxeColors.onSurface },
  statLabel: { fontSize: 11, color: LuxeColors.onSurfaceVariant, marginTop: 4, fontWeight: '500' },
});
