/**
 * Voucher Selection Modal for Booking Confirmation
 * Bottom-sheet modal to select an available voucher before placing a booking
 */

import {
  LuxeColors,
  LuxeShadows,
  translateTierName,
} from '@/constants/luxeTheme';
import { calculateVoucherDiscount, formatVoucherDiscount, type Voucher } from '@/services/api';
import { Feather } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Cấu hình huy hiệu theo loại chiến dịch (campaignType): nhãn, màu nền, màu chữ, icon
const CAMPAIGN_BADGE_CONFIG: Record<number, { label: string; bg: string; color: string; icon: string }> = {
  0: { label: 'Đổi điểm', bg: '#E0E7FF', color: '#4F46E5', icon: 'tag' },
  1: { label: 'Sinh nhật', bg: '#FEF3C7', color: '#D97706', icon: 'gift' },
  2: { label: 'Theo tuổi', bg: '#DBEAFE', color: '#2563EB', icon: 'calendar' },
  3: { label: 'Quay lại', bg: '#FCE7F3', color: '#DB2777', icon: 'repeat' },
  4: { label: 'VIP', bg: '#F3E8FF', color: '#7C3AED', icon: 'star' },
  5: { label: 'Kỷ niệm', bg: '#D1FAE5', color: '#059669', icon: 'award' },
};

/** Huy hiệu nhỏ hiển thị loại chiến dịch của voucher (đổi điểm, sinh nhật, VIP...). */
function CampaignBadge({ campaignType }: { campaignType: number }) {
  // Lấy cấu hình theo loại, mặc định về loại 0 nếu không khớp
  const cfg = CAMPAIGN_BADGE_CONFIG[campaignType] ?? CAMPAIGN_BADGE_CONFIG[0];
  return (
    <View style={[styles.campaignBadge, { backgroundColor: cfg.bg }]}>
      <Feather name={cfg.icon as any} size={10} color={cfg.color} />
      <Text style={[styles.campaignBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

/** Định dạng số tiền theo chuẩn Việt Nam (phân cách hàng nghìn). */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount);
}

/** Định dạng ngày sang dd/mm/yyyy theo locale vi-VN. */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Tính số ngày còn lại tới hạn dùng voucher (không âm). */
function getDaysRemaining(expiryDate: string): number {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diff = expiry.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Kiểm tra voucher có dùng được cho đơn hàng hiện tại không.
 * Trả về { usable, reason } — reason là lý do không dùng được (nếu có).
 */
function isVoucherUsable(voucher: Voucher, orderAmount: number): { usable: boolean; reason?: string } {
  // voucherType: 0 = Discount, 1 = PhysicalGift
  if (voucher.voucherType === 1) {
    return { usable: false, reason: 'Quà tặng hiện vật' };
  }
  if (voucher.isUsed || voucher.usageCount >= voucher.maxUsagePerUser) {
    return { usable: false, reason: 'Đã sử dụng' };
  }
  if (new Date(voucher.expiryDate) < new Date()) {
    return { usable: false, reason: 'Đã hết hạn' };
  }
  if (voucher.minOrderAmount > 0 && orderAmount < voucher.minOrderAmount) {
    return { usable: false, reason: `Đơn tối thiểu ${formatCurrency(voucher.minOrderAmount)}đ` };
  }
  return { usable: true };
}

/** Props cho thẻ voucher đơn lẻ trong danh sách. */
interface VoucherCardProps {
  voucher: Voucher; // Dữ liệu voucher
  isSelected: boolean; // Voucher này có đang được chọn không
  usable: boolean; // Có dùng được không
  unusableReason?: string; // Lý do không dùng được
  orderAmount: number; // Giá trị đơn hàng để tính mức giảm
  onSelect: () => void; // Callback khi chọn voucher
}

/** Thẻ hiển thị một voucher: mức giảm, chiến dịch, hạn dùng và trạng thái chọn. */
function VoucherCard({ voucher, isSelected, usable, unusableReason, orderAmount, onSelect }: VoucherCardProps) {
  const daysLeft = getDaysRemaining(voucher.expiryDate); // Số ngày còn lại
  // Mức giảm thực tế không vượt quá giá trị đơn hàng
  const discount = calculateVoucherDiscount(voucher, orderAmount);
  const isPercentageVoucher = Number(voucher.discountPercent ?? 0) > 0;

  return (
    <TouchableOpacity
      style={[
        styles.voucherCard,
        isSelected && styles.voucherCardSelected,
        !usable && styles.voucherCardDisabled,
      ]}
      onPress={usable ? onSelect : undefined}
      activeOpacity={usable ? 0.7 : 1}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected, disabled: !usable }}
      accessibilityLabel={`${voucher.code}, giảm ${formatVoucherDiscount(voucher)}`}
    >
      <View style={styles.voucherLeftPanel}>
        <Text style={[styles.voucherDiscountAmount, !usable && styles.voucherDiscountAmountDisabled]}>
          -{isPercentageVoucher ? formatVoucherDiscount(voucher) : `${formatCurrency(discount)}đ`}
        </Text>
        {voucher.pointsRequired > 0 && (
          <View style={styles.pointsChip}>
            <Text style={styles.pointsChipText}>{voucher.pointsRequired} điểm</Text>
          </View>
        )}
      </View>

      <View style={styles.voucherRightPanel}>
        <Text style={styles.voucherCode} numberOfLines={1}>{voucher.code}</Text>
        <View style={styles.voucherTopRow}>
          <CampaignBadge campaignType={voucher.campaignType} />
          {voucher.requiredTierName && (
            <View style={styles.tierBadge}>
              <Feather name="star" size={9} color="#7C3AED" />
              <Text style={styles.tierBadgeText}>{translateTierName(voucher.requiredTierName)}</Text>
            </View>
          )}
        </View>

        <Text style={[styles.voucherExpiry, !usable && styles.voucherExpiryDisabled]}>
          <Feather name="clock" size={11} color={usable ? LuxeColors.onSurfaceVariant : '#999'} />
          {'  '}
          {daysLeft > 0 ? `Còn ${daysLeft} ngày` : 'Hết hạn'} · HSD: {formatDate(voucher.expiryDate)}
        </Text>

        {voucher.minOrderAmount > 0 && (
          <Text style={[styles.voucherMinOrder, !usable && styles.voucherMinOrderDisabled]}>
            Đơn tối thiểu {formatCurrency(voucher.minOrderAmount)}đ
          </Text>
        )}

        {!usable && unusableReason && (
          <Text style={styles.unusableReason}>{unusableReason}</Text>
        )}
      </View>

      {isSelected && (
        <View style={styles.selectedCheck}>
          <Feather name="check" size={14} color="#ffffff" />
        </View>
      )}
    </TouchableOpacity>
  );
}

/** Props cho modal chọn voucher. */
interface VoucherSelectionModalProps {
  visible: boolean; // Hiển thị modal hay không
  vouchers: Voucher[]; // Danh sách voucher của người dùng
  selectedVoucher: Voucher | null; // Voucher đang chọn
  orderAmount: number; // Giá trị đơn hàng
  loading?: boolean; // Đang tải danh sách voucher
  onSelect: (voucher: Voucher | null) => void; // Chọn voucher (null = bỏ chọn)
  onClose: () => void; // Đóng modal
}

/**
 * Modal dạng bottom-sheet để chọn voucher giảm giá trước khi đặt lịch.
 * Hiển thị trạng thái tải, danh sách voucher (dùng được/không), và nút bỏ chọn.
 */
export function VoucherSelectionModal({
  visible,
  vouchers,
  selectedVoucher,
  orderAmount,
  loading,
  onSelect,
  onClose,
}: VoucherSelectionModalProps) {
  const insets = useSafeAreaInsets();
  // Lọc bỏ các voucher không dùng được (đã dùng / hết hạn / vượt đơn tối thiểu)
  // trước khi render — yêu cầu nghiệp vụ: không hiển thị voucher đã sử dụng
  // hoặc không thể sử dụng.
  const usableVouchers = useMemo(
    () => vouchers.filter((v) => isVoucherUsable(v, orderAmount).usable),
    [vouchers, orderAmount],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={styles.sheet}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={styles.sheetContent}>
          {/* Handle bar */}
            <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerCopy}>
              <View style={styles.modalTitleRow}>
                <View style={styles.titleIcon}>
                  <Feather name="tag" size={18} color={LuxeColors.primary} />
                </View>
                <Text style={styles.modalTitle}>Chọn voucher giảm giá</Text>
              </View>
              {!loading && usableVouchers.length > 0 && (
                <Text style={styles.modalSubtitle}>
                  {usableVouchers.length} voucher có thể áp dụng cho đơn hàng này
                </Text>
              )}
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose} hitSlop={8} accessibilityLabel="Đóng">
              <Feather name="x" size={22} color={LuxeColors.onSurface} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={LuxeColors.primaryContainer} />
              <Text style={styles.loadingText}>Đang tải voucher...</Text>
            </View>
          ) : usableVouchers.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Feather name="gift" size={40} color={LuxeColors.outlineVariant} />
              <Text style={styles.emptyTitle}>Chưa có voucher khả dụng</Text>
              <Text style={styles.emptySubtitle}>
                Bạn chưa có voucher nào áp dụng được cho đơn này.{'\n'}
                Đổi điểm thưởng để nhận voucher tại mục Voucher.
              </Text>
            </View>
          ) : (
            <FlatList
              data={usableVouchers}
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyExtractor={(voucher, index) => `${voucher.voucherId}-${voucher.receivedDate}-${index}`}
              renderItem={({ item: voucher }) => {
                const { usable, reason } = isVoucherUsable(voucher, orderAmount);
                return (
                  <VoucherCard
                    voucher={voucher}
                    isSelected={selectedVoucher?.voucherId === voucher.voucherId}
                    usable={usable}
                    unusableReason={reason}
                    orderAmount={orderAmount}
                    onSelect={() => onSelect(voucher)}
                  />
                );
              }}
            />
          )}

          {/* Footer actions */}
          <View style={[styles.modalFooter, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            <TouchableOpacity
              style={[styles.clearButton, selectedVoucher && styles.clearButtonDanger]}
              onPress={() => onSelect(null)}
              activeOpacity={0.75}
            >
              <Feather
                name={selectedVoucher ? 'x-circle' : 'minus-circle'}
                size={19}
                color={selectedVoucher ? LuxeColors.error : LuxeColors.onSurface}
              />
              <Text
                style={[
                  styles.clearButtonText,
                  selectedVoucher && styles.clearButtonTextDanger,
                ]}
              >
                {selectedVoucher ? 'Bỏ chọn voucher' : 'Tiếp tục không dùng voucher'}
              </Text>
            </TouchableOpacity>
          </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    height: '92%',
    maxHeight: 820,
    backgroundColor: LuxeColors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    ...LuxeShadows.xl,
  },
  sheetContent: {
    flex: 1,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: LuxeColors.outlineVariant,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#DCE4E9',
    backgroundColor: '#FFFFFF',
  },
  headerCopy: {
    flex: 1,
    paddingRight: 12,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5F4FA',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: LuxeColors.onSurface,
  },
  modalSubtitle: {
    marginTop: 5,
    marginLeft: 42,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
    color: LuxeColors.onSurfaceVariant,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LuxeColors.surfaceContainerLow,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 10,
    paddingBottom: 20,
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: LuxeColors.onSurfaceVariant,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: LuxeColors.onSurface,
  },
  emptySubtitle: {
    fontSize: 13,
    color: LuxeColors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20,
  },
  voucherCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
    minHeight: 108,
    borderWidth: 1,
    borderColor: '#D7E1E7',
    boxShadow: '0 2px 8px rgba(0, 60, 85, 0.08)',
  },
  voucherCardSelected: {
    borderWidth: 2,
    borderColor: LuxeColors.primary,
    backgroundColor: '#F2FAFD',
  },
  voucherCardDisabled: {
    opacity: 0.55,
  },
  voucherLeftPanel: {
    width: 92,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRightWidth: 1,
    borderRightColor: '#D7E1E7',
    marginRight: 14,
  },
  voucherDiscountAmount: {
    fontSize: 20,
    fontWeight: '900',
    color: LuxeColors.primary,
    fontVariant: ['tabular-nums'],
  },
  voucherDiscountAmountDisabled: {
    color: LuxeColors.outline,
  },
  pointsChip: {
    backgroundColor: '#E8EEFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  pointsChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#364FC7',
  },
  voucherRightPanel: {
    flex: 1,
    justifyContent: 'center',
    gap: 5,
  },
  voucherCode: {
    paddingRight: 26,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
    letterSpacing: 0.2,
    color: LuxeColors.onSurface,
  },
  voucherTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  campaignBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  campaignBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 3,
  },
  tierBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
  },
  voucherExpiry: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: '#36434A',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  voucherExpiryDisabled: {
    color: '#999',
  },
  voucherMinOrder: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    color: '#4A575E',
  },
  voucherMinOrderDisabled: {
    color: '#999',
  },
  unusableReason: {
    fontSize: 11,
    color: LuxeColors.error,
    fontWeight: '600',
    marginTop: 2,
  },
  selectedCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: LuxeColors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalFooter: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#DCE4E9',
    backgroundColor: '#FFFFFF',
    boxShadow: '0 -3px 12px rgba(0, 42, 60, 0.08)',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 50,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C9D3D9',
    backgroundColor: '#F7F9FA',
  },
  clearButtonDanger: {
    borderColor: '#F1B8B5',
    backgroundColor: '#FFF4F3',
  },
  clearButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: LuxeColors.onSurface,
  },
  clearButtonTextDanger: {
    color: LuxeColors.error,
  },
});
