/**
 * Vouchers Screen - LuxeWash
 * Browse and manage vouchers (auto-assigned + manual redeem)
 */

import {
  LuxeBorderRadius,
  LuxeColors,
  LuxeSpacing,
  LuxeShadows,
  translateTierName,
} from '@/constants/luxeTheme';
import { useAuth } from '@/contexts/AuthContext';
import { loyaltyService, CAMPAIGN_BADGE_CONFIG, type RedeemableVoucher, type Voucher, type VoucherCampaignType } from '@/services/api';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('vi-VN').format(amount);
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const getDaysRemaining = (expiryDate: string): number => {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diff = expiry.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

type TabKey = 'all' | 'available';

// Tab "Tất cả" và "Còn hiệu lực" đều chỉ hiển thị voucher khả dụng (chưa dùng + còn hạn).
// Voucher đã dùng hoặc hết hạn được ẩn hoàn toàn khỏi danh sách.
const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'available', label: 'Còn hiệu lực' },
];

// CAMPAIGN_BADGE_CONFIG is now imported from loyaltyService.ts

function CampaignBadge({ campaignType }: { campaignType: VoucherCampaignType }) {
  const cfg = CAMPAIGN_BADGE_CONFIG[campaignType] ?? CAMPAIGN_BADGE_CONFIG[0];
  return (
    <View style={[styles.campaignBadge, { backgroundColor: cfg.bg }]}>
      <Feather name={cfg.icon as any} size={10} color={cfg.color} />
      <Text style={[styles.campaignBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

function TierBadge({ tierName }: { tierName: string | null }) {
  if (!tierName) return null;
  return (
    <View style={styles.tierBadge}>
      <Feather name="shield" size={10} color={LuxeColors.onSurfaceVariant} />
      <Text style={styles.tierBadgeText}>{translateTierName(tierName)}+</Text>
    </View>
  );
}

/** VoucherCard - 2-column split layout: left = discount hero, right = info */
function VoucherCard({
  voucher,
  onPress,
}: {
  voucher: Voucher;
  onPress?: () => void;
}) {
  const daysLeft = getDaysRemaining(voucher.expiryDate);
  const isExpired = daysLeft === 0;
  const isUsed = voucher.isUsed || voucher.usageCount >= voucher.maxUsagePerUser;
  const cfg = CAMPAIGN_BADGE_CONFIG[voucher.campaignType] ?? CAMPAIGN_BADGE_CONFIG[0];

  const cardOpacity = isUsed ? 0.55 : isExpired ? 0.65 : 1;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.voucherCard,
        isUsed && styles.voucherCardUsed,
        isExpired && !isUsed && styles.voucherCardExpired,
        pressed && styles.voucherCardPressed,
        { opacity: cardOpacity },
      ]}
      onPress={onPress}
      disabled={isUsed || isExpired}
    >
      {/* Top accent bar */}
      <View style={[styles.cardAccent, { backgroundColor: cfg.color }]} />

      <View style={styles.cardBody}>
        {/* LEFT: Discount hero panel */}
        <View style={[styles.discountPanel, { backgroundColor: cfg.color + '18' }]}>
          <Text style={[styles.discountAmount, { color: cfg.color }]}>
            -{formatCurrency(voucher.discountAmount)}đ
          </Text>
          <Text style={[styles.discountLabel, { color: cfg.color + 'BB' }]}>GIẢM</Text>
          {voucher.pointsRequired > 0 && (
            <View style={[styles.pointsChip, { backgroundColor: cfg.color + '22' }]}>
              <Text style={[styles.pointsChipText, { color: cfg.color }]}>
                {voucher.pointsRequired.toLocaleString('vi-VN')} pts
              </Text>
            </View>
          )}
        </View>

        {/* Divider */}
        <View style={[styles.cardDivider, { backgroundColor: cfg.color + '30' }]} />

        {/* RIGHT: Info panel */}
        <View style={styles.infoPanel}>
          {/* Badges row */}
          <View style={styles.badgeRow}>
            <CampaignBadge campaignType={voucher.campaignType} />
            <TierBadge tierName={voucher.requiredTierName} />
          </View>

          {/* Code */}
          <View style={styles.codeRow}>
            <Text style={styles.codeLabel}>CODE</Text>
            <Text style={styles.voucherCode}>{voucher.code}</Text>
          </View>

          {/* Min order */}
          {voucher.minOrderAmount > 0 && (
            <Text style={styles.minOrder}>
              Tối thiểu {formatCurrency(voucher.minOrderAmount)}đ
            </Text>
          )}

          {/* Usage progress */}
          <View style={styles.usageRow}>
            <View style={styles.usageBar}>
              <View
                style={[
                  styles.usageFill,
                  {
                    width: `${Math.min((voucher.usageCount / voucher.maxUsagePerUser) * 100, 100)}%`,
                    backgroundColor: cfg.color,
                  },
                ]}
              />
            </View>
            <Text style={styles.usageText}>
              {voucher.usageCount}/{voucher.maxUsagePerUser}
            </Text>
          </View>

          {/* Time window */}
          {voucher.validStartTime && voucher.validEndTime && (
            <Text style={styles.timeWindow}>
              {voucher.validStartTime} - {voucher.validEndTime}
            </Text>
          )}

          {/* Bottom status row */}
          <View style={styles.statusRow}>
            {isUsed ? (
              <View style={[styles.statusBadge, styles.statusUsed]}>
                <Feather name="check-circle" size={11} color={LuxeColors.onSurfaceVariant} />
                <Text style={[styles.statusBadgeText, { color: LuxeColors.onSurfaceVariant }]}>Đã dùng</Text>
              </View>
            ) : isExpired ? (
              <View style={[styles.statusBadge, styles.statusExpired]}>
                <Feather name="clock" size={11} color={LuxeColors.error} />
                <Text style={[styles.statusBadgeText, { color: LuxeColors.error }]}>Hết hạn</Text>
              </View>
            ) : daysLeft <= 3 ? (
              <View style={[styles.statusBadge, styles.statusSoon]}>
                <Feather name="alert-circle" size={11} color="#D97706" />
                <Text style={[styles.statusBadgeText, { color: '#D97706' }]}>Còn {daysLeft} ngày</Text>
              </View>
            ) : (
              <Text style={styles.expiryText}>HSD: {formatDate(voucher.expiryDate)}</Text>
            )}
            {!isUsed && !isExpired && (
              <Text style={styles.remainingText}>{voucher.remainingUsage} lượt</Text>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function RedeemModal({
  visible,
  onClose,
  vouchers,
  loading,
  loadError,
  onRetry,
  onRedeem,
}: {
  visible: boolean;
  onClose: () => void;
  vouchers: RedeemableVoucher[];
  loading: boolean;
  loadError: string | null;
  onRetry: () => void;
  onRedeem: (voucherId: number) => Promise<boolean>;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [redeeming, setRedeeming] = useState(false);

  const redeemable = useMemo(
    () => vouchers.filter((v) => getDaysRemaining(v.expiryDate) > 0),
    [vouchers],
  );

  const handleRedeem = async () => {
    if (!selectedId) return;
    setRedeeming(true);
    try {
      const succeeded = await onRedeem(selectedId);
      if (succeeded) {
        setSelectedId(null);
        onClose();
      }
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <SafeAreaProvider style={styles.modalProvider}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
          {/* Drag handle */}
          <View style={styles.modalDragHandle} />

          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Đổi voucher</Text>
              <Text style={styles.modalSubtitle}>
                Dùng điểm tích luỹ để đổi voucher
              </Text>
            </View>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
              <Feather name="x" size={20} color={LuxeColors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={styles.emptyModalState}>
                <ActivityIndicator color={LuxeColors.primary} size="large" />
                <Text style={styles.emptyModalDesc}>Đang tải voucher...</Text>
              </View>
            ) : loadError ? (
              <View style={styles.emptyModalState}>
                <Feather name="alert-circle" size={40} color={LuxeColors.error} />
                <Text style={styles.emptyModalTitle}>Không thể tải voucher</Text>
                <Text style={styles.emptyModalDesc}>{loadError}</Text>
                <TouchableOpacity style={styles.retryModalButton} onPress={onRetry}>
                  <Feather name="refresh-cw" size={15} color={LuxeColors.primary} />
                  <Text style={styles.retryModalButtonText}>Thử lại</Text>
                </TouchableOpacity>
              </View>
            ) : redeemable.length === 0 ? (
              <View style={styles.emptyModalState}>
                <Feather name="gift" size={40} color={LuxeColors.outlineVariant} />
                <Text style={styles.emptyModalTitle}>Không có voucher nào khả dụng</Text>
                <Text style={styles.emptyModalDesc}>
                  Tích luỹ thêm điểm để đổi voucher
                </Text>
              </View>
            ) : (
              redeemable.map((v) => {
                const cfg = CAMPAIGN_BADGE_CONFIG[v.campaignType] ?? CAMPAIGN_BADGE_CONFIG[0];
                const isSelected = selectedId === v.voucherId;
                return (
                  <Pressable
                    key={v.voucherId}
                    style={({ pressed }) => [
                      styles.redeemItem,
                      isSelected && styles.redeemItemSelected,
                      isSelected && { borderColor: cfg.color, backgroundColor: cfg.color + '10' },
                      pressed && { opacity: 0.85 },
                    ]}
                    onPress={() => setSelectedId(v.voucherId)}
                  >
                    {/* Left: accent stripe */}
                    <View style={[styles.redeemItemAccent, { backgroundColor: cfg.color }]} />

                    {/* Content */}
                    <View style={styles.redeemItemBody}>
                      <View style={styles.redeemItemTop}>
                        <Text style={styles.redeemItemCode}>{v.code}</Text>
                        <CampaignBadge campaignType={v.campaignType} />
                      </View>
                      <View style={styles.redeemItemBottom}>
                        <Text style={[styles.redeemItemDiscount, { color: cfg.color }]}>
                          -{formatCurrency(v.discountAmount)}đ
                        </Text>
                        {v.minOrderAmount > 0 && (
                          <Text style={styles.redeemItemMinOrder}>
                            Tối thiểu {formatCurrency(v.minOrderAmount)}đ
                          </Text>
                        )}
                      </View>
                    </View>

                    {/* Right: points + checkbox */}
                    <View style={styles.redeemItemRight}>
                      <View style={[styles.pointsBadge, { backgroundColor: cfg.color + '18' }]}>
                        <Feather name="star" size={11} color={cfg.color} />
                        <Text style={[styles.pointsBadgeText, { color: cfg.color }]}>
                          {v.pointsRequired.toLocaleString('vi-VN')}
                        </Text>
                      </View>
                      <View style={[
                        styles.checkbox,
                        isSelected && { backgroundColor: cfg.color, borderColor: cfg.color },
                      ]}>
                        {isSelected && <Feather name="check" size={11} color="#ffffff" />}
                      </View>
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[
                styles.redeemBtn,
                (!selectedId || redeeming) && styles.redeemBtnDisabled,
              ]}
              onPress={handleRedeem}
              disabled={!selectedId || redeeming}
            >
              {redeeming ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : selectedId ? (
                <Text style={styles.redeemBtnText}>
                  Xác nhận đổi ({redeemable.find((v) => v.voucherId === selectedId)?.pointsRequired.toLocaleString('vi-VN')} điểm)
                </Text>
              ) : (
                <Text style={styles.redeemBtnText}>Chọn voucher để đổi</Text>
              )}
            </TouchableOpacity>
          </View>
          </View>
        </View>
      </SafeAreaProvider>
    </Modal>
  );
}

export default function VouchersScreen() {
  const router = useRouter();
  const { user, refreshProfile } = useAuth();

  const [allVouchers, setAllVouchers] = useState<Voucher[]>([]);
  const [redeemableVouchers, setRedeemableVouchers] = useState<RedeemableVoucher[]>([]);
  const [redeemableLoading, setRedeemableLoading] = useState(true);
  const [redeemableLoadError, setRedeemableLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [showRedeemModal, setShowRedeemModal] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setRedeemableLoading(true);
    setRedeemableLoadError(null);
    try {
      const [ownedResult, redeemableResult] = await Promise.allSettled([
        loyaltyService.getMyVouchers(),
        loyaltyService.getAvailableVouchers(),
      ]);

      if (ownedResult.status === 'fulfilled' && ownedResult.value.statusCode === 200) {
        setAllVouchers(ownedResult.value.data ?? []);
      } else if (ownedResult.status === 'rejected') {
        console.warn('Could not load owned vouchers:', ownedResult.reason);
      }

      if (redeemableResult.status === 'fulfilled' && redeemableResult.value.statusCode === 200) {
        setRedeemableVouchers(redeemableResult.value.data ?? []);
        setRedeemableLoadError(null);
      } else if (redeemableResult.status === 'rejected') {
        console.warn('Could not load redeemable vouchers:', redeemableResult.reason);
        setRedeemableVouchers([]);
        setRedeemableLoadError('Máy chủ chưa cung cấp danh sách voucher để đổi. Vui lòng thử lại sau.');
      }
    } catch (e) {
      console.warn('Could not load vouchers:', e);
    } finally {
      setLoading(false);
      setRedeemableLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const reloadRedeemableVouchers = useCallback(async () => {
    setRedeemableLoading(true);
    setRedeemableLoadError(null);
    try {
      const response = await loyaltyService.getAvailableVouchers();
      setRedeemableVouchers(response.data ?? []);
    } catch (error) {
      console.warn('Could not reload redeemable vouchers:', error);
      setRedeemableVouchers([]);
      setRedeemableLoadError('Máy chủ chưa cung cấp danh sách voucher để đổi. Vui lòng thử lại sau.');
    } finally {
      setRedeemableLoading(false);
    }
  }, []);

  const openRedeemModal = useCallback(() => {
    setShowRedeemModal(true);
    void reloadRedeemableVouchers();
  }, [reloadRedeemableVouchers]);

  const filteredVouchers = useMemo(() => {
    const now = new Date();
    return allVouchers.filter((v) => {
      const expiry = new Date(v.expiryDate);
      const isExpired = expiry < now;
      const isUsed = v.isUsed || v.usageCount >= v.maxUsagePerUser;
      // Ẩn hoàn toàn voucher đã dùng hoặc hết hạn — chỉ hiển thị voucher khả dụng
      // (áp dụng cho cả tab "Tất cả" và "Còn hiệu lực").
      return !isUsed && !isExpired;
    });
  }, [allVouchers]);

  const handleRedeemVoucher = async (voucherId: number) => {
    try {
      const res = await loyaltyService.redeemVoucher(voucherId);
      if (res.statusCode === 200) {
        await refreshProfile?.();
        await loadData();
        return true;
      }
      return false;
    } catch (e: any) {
      alert(e?.message || 'Đổi voucher thất bại');
      return false;
    }
  };

  const tabCounts = useMemo(() => {
    const now = new Date();
    const counts: Record<TabKey, number> = { all: 0, available: 0 };
    for (const v of allVouchers) {
      const expiry = new Date(v.expiryDate);
      const isExpired = expiry < now;
      const isUsed = v.isUsed || v.usageCount >= v.maxUsagePerUser;
      // Đếm cả hai tab dựa trên voucher khả dụng (đã dùng/hết hạn bị ẩn).
      if (!isUsed && !isExpired) {
        counts.all++;
        counts.available++;
      }
    }
    return counts;
  }, [allVouchers]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={LuxeColors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kho voucher</Text>
        <TouchableOpacity
          style={styles.redeemPointsBtn}
          onPress={openRedeemModal}
        >
          <Feather name="gift" size={18} color={LuxeColors.primaryContainer} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} />
        }
      >
        {/* Points Balance */}
        <View style={styles.pointsBanner}>
          <View style={styles.pointsBannerLeft}>
            <Text style={styles.pointsLabel}>Điểm hiện có</Text>
            <Text style={styles.pointsValue}>
              {(user?.loyaltyPoints ?? 0).toLocaleString('vi-VN')}
            </Text>
            <Text style={styles.pointsUnit}>điểm</Text>
          </View>
          <View style={styles.pointsBannerRight}>
            <Feather name="award" size={36} color={LuxeColors.primaryContainer + '60'} />
          </View>
        </View>

        {/* Tab Bar */}
        <View style={styles.tabBar}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {tab.label}
                </Text>
                {tabCounts[tab.key] > 0 && (
                  <View style={[styles.tabCount, isActive && styles.tabCountActive]}>
                    <Text style={[styles.tabCountText, isActive && styles.tabCountTextActive]}>
                      {tabCounts[tab.key]}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Voucher List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={LuxeColors.primaryContainer} size="large" />
            <Text style={styles.loadingText}>Đang tải voucher...</Text>
          </View>
        ) : filteredVouchers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather
              name="package"
              size={48}
              color={LuxeColors.outlineVariant}
            />
            <Text style={styles.emptyTitle}>
              {activeTab === 'all'
                ? 'Chưa có voucher nào'
                : 'Không có voucher khả dụng'}
            </Text>
            <Text style={styles.emptyDesc}>
              {activeTab === 'all'
                ? 'Bạn sẽ nhận được voucher khi đủ điều kiện từ các chương trình của LuxeWash'
                : 'Tiếp tục sử dụng dịch vụ để nhận thêm voucher'}
            </Text>
          </View>
        ) : (
          <View style={styles.voucherList}>
            {filteredVouchers.map((voucher, index) => (
              <VoucherCard
                key={`${voucher.voucherId}-${voucher.receivedDate}-${index}`}
                voucher={voucher}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Redeem Modal */}
      <RedeemModal
        visible={showRedeemModal}
        onClose={() => setShowRedeemModal(false)}
        vouchers={redeemableVouchers}
        loading={redeemableLoading}
        loadError={redeemableLoadError}
        onRetry={() => void reloadRedeemableVouchers()}
        onRedeem={handleRedeemVoucher}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LuxeColors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: LuxeSpacing.lg,
    paddingVertical: LuxeSpacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: LuxeColors.outlineVariant + '30',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: LuxeColors.onSurface,
    letterSpacing: -0.3,
  },
  redeemPointsBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LuxeColors.primaryContainer + '20',
    borderRadius: LuxeBorderRadius.full,
  },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 100 },

  /* ─── Points Banner ─── */
  pointsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LuxeColors.primary,
    marginHorizontal: LuxeSpacing.lg,
    marginTop: LuxeSpacing.lg,
    borderRadius: LuxeBorderRadius.xl,
    paddingVertical: LuxeSpacing.xl,
    paddingHorizontal: LuxeSpacing.xl,
    ...LuxeShadows.lg,
  },
  pointsBannerLeft: { flex: 1 },
  pointsLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  pointsValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -1,
  },
  pointsUnit: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
    marginTop: 2,
  },
  pointsBannerRight: {
    paddingLeft: LuxeSpacing.lg,
  },

  /* ─── Tab Bar ─── */
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    marginHorizontal: LuxeSpacing.lg,
    marginTop: LuxeSpacing.lg,
    borderRadius: LuxeBorderRadius.lg,
    padding: 3,
    ...LuxeShadows.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: LuxeBorderRadius.md,
    gap: 4,
  },
  tabActive: {
    backgroundColor: LuxeColors.primary,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: LuxeColors.onSurfaceVariant,
  },
  tabTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  tabCount: {
    backgroundColor: LuxeColors.surfaceVariant,
    borderRadius: LuxeBorderRadius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabCountActive: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  tabCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: LuxeColors.onSurfaceVariant,
  },
  tabCountTextActive: {
    color: '#ffffff',
  },

  /* ─── Loading / Empty ─── */
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 80,
    gap: 14,
  },
  loadingText: {
    fontSize: 14,
    color: LuxeColors.onSurfaceVariant,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 48,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: LuxeColors.onSurface,
    marginTop: LuxeSpacing.md,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 13,
    color: LuxeColors.onSurfaceVariant,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },

  /* ─── Voucher List ─── */
  voucherList: {
    paddingHorizontal: LuxeSpacing.lg,
    paddingTop: LuxeSpacing.lg,
    gap: LuxeSpacing.md,
  },

  /* ─── Voucher Card ─── */
  voucherCard: {
    backgroundColor: '#ffffff',
    borderRadius: LuxeBorderRadius.xl,
    overflow: 'hidden',
    ...LuxeShadows.md,
  },
  voucherCardUsed: { opacity: 0.55 },
  voucherCardExpired: { opacity: 0.65 },
  voucherCardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  cardAccent: {
    height: 4,
  },
  cardBody: {
    flexDirection: 'row',
    minHeight: 130,
  },
  discountPanel: {
    width: 100,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: LuxeSpacing.md,
  },
  discountAmount: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  discountLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 2,
  },
  pointsChip: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: LuxeBorderRadius.full,
  },
  pointsChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cardDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginVertical: LuxeSpacing.md,
  },
  infoPanel: {
    flex: 1,
    padding: LuxeSpacing.md,
    paddingLeft: LuxeSpacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  campaignBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: LuxeBorderRadius.full,
  },
  campaignBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: LuxeColors.surfaceVariant,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: LuxeBorderRadius.full,
  },
  tierBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: LuxeColors.onSurfaceVariant,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  codeLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: LuxeColors.onSurfaceVariant,
    letterSpacing: 0.5,
    backgroundColor: LuxeColors.surfaceVariant,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  voucherCode: {
    fontSize: 13,
    fontWeight: '700',
    color: LuxeColors.onSurface,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    letterSpacing: 1,
  },
  minOrder: {
    fontSize: 11,
    color: LuxeColors.onSurfaceVariant,
    marginBottom: 5,
  },
  usageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  usageBar: {
    flex: 1,
    height: 3,
    backgroundColor: LuxeColors.surfaceVariant,
    borderRadius: 2,
    overflow: 'hidden',
  },
  usageFill: {
    height: '100%',
    borderRadius: 2,
  },
  usageText: {
    fontSize: 10,
    color: LuxeColors.onSurfaceVariant,
    fontWeight: '600',
    minWidth: 32,
    textAlign: 'right',
  },
  timeWindow: {
    fontSize: 10,
    color: LuxeColors.tertiary,
    fontWeight: '500',
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: LuxeBorderRadius.full,
  },
  statusUsed: {
    backgroundColor: LuxeColors.surfaceVariant,
  },
  statusExpired: {
    backgroundColor: LuxeColors.errorContainer,
  },
  statusSoon: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  expiryText: {
    fontSize: 11,
    color: LuxeColors.onSurfaceVariant,
    fontWeight: '500',
  },
  remainingText: {
    fontSize: 10,
    fontWeight: '600',
    color: LuxeColors.primaryContainer,
  },

  /* ─── Redeem Modal ─── */
  modalProvider: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '82%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  modalDragHandle: {
    width: 40,
    height: 4,
    backgroundColor: LuxeColors.outlineVariant,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: LuxeColors.outlineVariant + '20',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: LuxeColors.onSurface,
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 13,
    color: LuxeColors.onSurfaceVariant,
    marginTop: 4,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: LuxeBorderRadius.full,
    backgroundColor: LuxeColors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalList: {
    paddingHorizontal: 16,
    paddingTop: 12,
    maxHeight: 420,
  },
  emptyModalState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 10,
  },
  emptyModalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: LuxeColors.onSurface,
  },
  emptyModalDesc: {
    fontSize: 13,
    color: LuxeColors.onSurfaceVariant,
    textAlign: 'center',
  },
  retryModalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: LuxeBorderRadius.full,
    backgroundColor: LuxeColors.primaryContainer,
  },
  retryModalButtonText: {
    color: LuxeColors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  redeemItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderRadius: LuxeBorderRadius.lg,
    backgroundColor: LuxeColors.surfaceContainerLow,
    borderWidth: 1.5,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  redeemItemSelected: {
    borderWidth: 1.5,
  },
  redeemItemAccent: {
    width: 4,
    alignSelf: 'stretch',
  },
  redeemItemBody: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  redeemItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  redeemItemCode: {
    fontSize: 13,
    fontWeight: '700',
    color: LuxeColors.onSurface,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    letterSpacing: 0.5,
  },
  redeemItemBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  redeemItemDiscount: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  redeemItemMinOrder: {
    fontSize: 11,
    color: LuxeColors.onSurfaceVariant,
  },
  redeemItemRight: {
    alignItems: 'center',
    gap: 10,
    paddingRight: 14,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: LuxeBorderRadius.full,
  },
  pointsBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: LuxeColors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalFooter: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  redeemBtn: {
    backgroundColor: LuxeColors.primary,
    borderRadius: LuxeBorderRadius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    ...LuxeShadows.primary,
  },
  redeemBtnDisabled: {
    opacity: 0.5,
  },
  redeemBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
});
