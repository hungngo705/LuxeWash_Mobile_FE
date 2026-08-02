/**
 * Loyalty API Service
 * Handles loyalty tiers, points, and vouchers
 *
 * Nhóm API chương trình khách hàng thân thiết: hạng thành viên, điểm thưởng,
 * và voucher (xem/nhận/đổi).
 */

import { apiClient, ApiResponse } from './client';

/** Hạng thành viên và quyền lợi kèm theo */
export interface Tier {
  tierId: number;
  tierName: string;
  pointMultiplier: number; // Hệ số nhân điểm khi tích luỹ
  minAccumulatedPoints: number; // Điểm tối thiểu để đạt hạng này
  bookingWindowDays?: number; // Số ngày được đặt lịch trước
}

/** Loại chiến dịch phát voucher (0: thủ công, 1: sinh nhật, ...) */
export type VoucherCampaignType = 0 | 1 | 2 | 3 | 4 | 5;

/** Loại voucher (0: giảm giá, 1: quà tặng vật lý) */
export type VoucherType = 0 | 1;

/** Thông tin một voucher của người dùng */
export interface Voucher {
  voucherId: number;
  code: string; // Mã voucher
  discountAmount: number; // Số tiền giảm
  pointsRequired: number; // Số điểm cần để đổi
  expiryDate: string; // Ngày hết hạn của voucher đã nhận
  campaignExpiryDate: string; // Ngày kết thúc chiến dịch
  receivedDate: string; // Ngày người dùng nhận voucher
  isUsed: boolean;
  usedDate: string | null;
  usageCount: number; // Số lần đã dùng
  maxUsagePerUser: number; // Số lần tối đa mỗi người được dùng
  remainingUsage: number; // Số lần còn lại có thể dùng
  minOrderAmount: number; // Giá trị đơn tối thiểu để áp dụng
  isActive: boolean;
  campaignType: VoucherCampaignType;
  voucherType: VoucherType;
  imageUrl: string | null;
  requiredTierId: number | null; // Hạng thành viên yêu cầu (nếu có)
  requiredTierName: string | null;
  validStartTime: string | null; // Khung giờ bắt đầu áp dụng (nếu có)
  validEndTime: string | null; // Khung giờ kết thúc áp dụng
}

/** Nhãn hiển thị cho từng loại voucher */
export const VOUCHER_TYPE_LABELS: Record<VoucherType, string> = {
  [0]: 'Discount',
  [1]: 'PhysicalGift',
};

/** Nhãn hiển thị cho từng loại chiến dịch voucher */
export const CAMPAIGN_TYPE_LABELS: Record<VoucherCampaignType, string> = {
  [0]: 'Manual',
  [1]: 'Birthday',
  [2]: 'Age',
  [3]: 'Winback',
  [4]: 'Vip',
  [5]: 'Milestone',
};

/** Cấu hình badge (nhãn, màu nền, màu chữ, icon) hiển thị theo loại chiến dịch */
export const CAMPAIGN_BADGE_CONFIG: Record<VoucherCampaignType, { label: string; bg: string; color: string; icon: string }> = {
  [0]: { label: 'Đổi điểm', bg: '#E0E7FF', color: '#4F46E5', icon: 'tag' },
  [1]: { label: 'Sinh nhật', bg: '#FEF3C7', color: '#D97706', icon: 'gift' },
  [2]: { label: 'Theo tuổi', bg: '#DBEAFE', color: '#2563EB', icon: 'calendar' },
  [3]: { label: 'Quay lại', bg: '#FCE7F3', color: '#DB2777', icon: 'repeat' },
  [4]: { label: 'VIP', bg: '#F3E8FF', color: '#7C3AED', icon: 'star' },
  [5]: { label: 'Kỷ niệm', bg: '#D1FAE5', color: '#059669', icon: 'award' },
};

export const loyaltyService = {
  /** Lấy danh sách các hạng thành viên */
  getTiers: async (): Promise<ApiResponse<Tier[]>> => {
    return apiClient.get<Tier[]>('/tiers');
  },

  /** Lấy danh sách voucher người dùng đang sở hữu */
  getMyVouchers: async (): Promise<ApiResponse<Voucher[]>> => {
    return apiClient.get<Voucher[]>('/vouchers/me');
  },

  /** Lấy danh sách voucher có thể đổi (bằng điểm) */
  getAvailableVouchers: async (): Promise<ApiResponse<Voucher[]>> => {
    return apiClient.get<Voucher[]>('/vouchers/available');
  },

  /** Đổi điểm lấy voucher theo voucherId */
  redeemVoucher: async (voucherId: number): Promise<ApiResponse<void>> => {
    return apiClient.post<void>('/vouchers/redeem', { voucherId });
  },
};
