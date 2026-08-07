/**
 * Booking API Service
 * Handles booking and scheduling endpoints
 *
 * Nhóm API đặt lịch: dịch vụ, khung giờ trống, tạo/huỷ/dời lịch, thanh toán,
 * và xử lý đề xuất dời chi nhánh khi quá tải (overload suggestion).
 */

import { apiClient, ApiResponse } from './client';

/** Một khung giờ đặt lịch cùng trạng thái còn trống hay không */
export interface TimeSlot {
  slotId: number;
  timeRange: string; // Khoảng thời gian hiển thị (vd "08:00 - 09:00")
  isAvailable: boolean;
  reason: string | null; // Lý do không khả dụng (nếu có)
}

/** Pending overload suggestion returned by the authenticated booking endpoint. */
/** Quyết định của khách với đề xuất dời chi nhánh: đổi / huỷ / giữ nguyên */
export type OverloadDecision = "Switch" | "Cancel" | "Keep";

/** Đề xuất dời lịch sang chi nhánh khác khi chi nhánh hiện tại quá tải */
export interface OverloadSuggestion {
  suggestionId: number;
  bookingId: number;
  suggestedBranchId: number; // Chi nhánh được gợi ý chuyển đến
  suggestedBranchName: string;
  suggestedSlotId: number; // Khung giờ được gợi ý ở chi nhánh mới
  suggestedTime: string;
  expiresAt: string; // Thời điểm đề xuất hết hiệu lực
}

/** Body gửi lên khi khách phản hồi đề xuất dời chi nhánh */
export interface HandleOverloadSuggestionRequest {
  decision: OverloadDecision;
}

/** Voucher đền bù khi khách đồng ý đổi chi nhánh */
export interface OverloadVoucher {
  voucherId: number;
  code: string;
  discountAmount: number;
  expiryDate: string;
  isActive: boolean;
}

/** Thông tin hoàn tiền/điểm khi khách chọn huỷ do quá tải */
export interface OverloadRefund {
  refundedAmount: number; // Số tiền được hoàn
  refundDestination: string | null; // Nơi nhận hoàn (ví, ...)
  refundedPoints: number; // Số điểm được hoàn
  restoredVoucherId: number | null; // Voucher được khôi phục (nếu có)
}

/** Kết quả sau khi backend xử lý phản hồi đề xuất dời chi nhánh */
export interface HandleOverloadSuggestionResponse {
  success: boolean;
  decision: OverloadDecision;
  message: string;
  updatedBooking: unknown | null; // Booking sau khi cập nhật (nếu đổi)
  voucher: OverloadVoucher | null; // Voucher đền bù (nếu đổi)
  refund: OverloadRefund | null; // Thông tin hoàn tiền (nếu huỷ)
}

/** Giá dịch vụ theo từng loại xe */
export interface ServicePrice {
  vehicleTypeId: number;
  vehicleTypeName: string;
  price: number;
  capacityWeight: number; // Trọng số sức chứa mà dịch vụ chiếm trong slot
}

/** Một dịch vụ rửa xe kèm bảng giá theo loại xe */
export interface Service {
  serviceId: number;
  serviceName: string;
  description: string;
  prices: ServicePrice[];
}

/** Kết quả kiểm tra tính tương thích giữa xe/dịch vụ và sức chứa của slot */
export interface CompatibilityDTO {
  isCompatible: boolean;
  message: string | null;
  remainingCapacity: number; // Sức chứa còn lại của slot
  totalCapacityWeight: number; // Tổng trọng số cần cho lần đặt này
  maxCapacityOfSlot: number; // Sức chứa tối đa của slot
}

/** Dữ liệu tạo một lần đặt lịch */
export interface BookingRequest {
  branchId: number;
  vehicleId?: number;
  licensePlate: string;
  serviceIds: number[];
  scheduledDate: string;
  slotId: number;
  pointsToUse: number; // Số điểm dùng để giảm giá
  voucherId: number | null; // Voucher áp dụng (nếu có)
  paymentMethod?: string;
}

/** Thông tin một xe trong chi tiết booking */
export interface BookingDetailVehicle {
  detailId: number;
  licensePlate: string;
  vehicleType: string;
  carModel: string | null;
  registrationPhotoUrl: string | null; // Ảnh đăng ký xe
  serviceName: string;
  status: string;
  subtotal: number; // Tạm tính cho xe này
}

/** Chi tiết đầy đủ của một booking (nhiều xe, giá, giảm giá) */
export interface BookingDetail {
  bookingId: number;
  scheduledDate: string;
  slotId: number;
  timeRange: string;
  status: string;
  subtotal: number; // Tổng tạm tính
  discountAmount: number; // Giảm giá từ voucher
  loyaltyPointsUsed: number; // Số điểm đã dùng
  pointsDiscount: number; // Số tiền giảm từ điểm
  finalAmount: number; // Số tiền phải trả cuối cùng
  createdAt: string;
  vehicles: BookingDetailVehicle[];
}

/** Phản hồi rút gọn của chi tiết booking (dạng tổng hợp một dòng) */
export interface BookingDetailResponse {
  bookingId: number;
  licensePlate: string;
  serviceNames: string[];
  scheduledTime: string;
  status: string;
  originalPrice: number;
  pointDiscountAmount: number;
  voucherDiscountAmount: number;
  finalAmount: number;
  checkInImageUrl?: string | null;
  checkOutImageUrl?: string | null;
}

/** Phản hồi khi tạo booking thành công — chỉ trả về id */
export interface CreateBookingResponse {
  bookingId: number;
}

/** Tham số tạo link thanh toán (URL quay lại/huỷ khi thanh toán online) */
export interface BookingPaymentLinkRequest {
  cancelUrl: string;
  returnUrl: string;
}

/** Link thanh toán được backend tạo (dùng cho cổng thanh toán) */
export interface BookingPaymentLinkResponse {
  paymentUrl: string;
  orderCode: string;
  bookingId: number;
  amount: number;
}

/** Các trạng thái thanh toán có thể có của booking */
export type BookingPaymentStatus =
  | "Unpaid"
  | "Pending"
  | "Completed"
  | "Expired"
  | "Failed";

/** Thông tin trạng thái thanh toán hiện tại của booking */
export interface BookingPaymentStatusResponse {
  bookingId: number;
  paymentStatus: BookingPaymentStatus;
  paymentMethod: string | null;
  orderCode: string | null;
  amount: number | null;
  paidAt: string | null; // Thời điểm thanh toán thành công
}

/** Body dời lịch: ngày và khung giờ mới */
export interface RescheduleBookingRequest {
  newScheduledDate: string;
  newSlotId: number;
}

/** Một mục trong danh sách booking của khách (màn hình "Lịch của tôi") */
export interface MyBookingItem {
  bookingId: number;
  licensePlate: string;
  serviceName?: string;
  serviceNames?: string[];
  scheduledTime: string;
  status: string;
  originalPrice: number;
  pointDiscountAmount: number;
  voucherDiscountAmount: number;
  finalAmount: number;
  checkInImageUrl?: string | null;
  checkOutImageUrl?: string | null;
}

/** Bộ lọc khi lấy danh sách booking của khách */
export interface GetMyBookingsParams {
  startDate?: string;
  endDate?: string;
  status?: string; // Lọc theo trạng thái
}

export const bookingService = {
  /** Lấy danh sách dịch vụ (tuỳ chọn lọc theo chi nhánh) */
  getServices: async (branchId?: number): Promise<ApiResponse<Service[]>> => {
    return apiClient.get<Service[]>('/services', branchId ? { branchId } : undefined);
  },

  /** Kiểm tra xe/dịch vụ có vừa sức chứa còn lại của slot hay không */
  checkCompatibility: async (data: {
    branchId: number;
    slotId: number;
    targetDate: string;
    licensePlate: string;
    vehicleId?: number;
    serviceIds: number[];
  }): Promise<ApiResponse<CompatibilityDTO>> => {
    return apiClient.post<CompatibilityDTO>('/bookings/check-compatibility', data);
  },

  /** Lấy danh sách khung giờ trống cho ngày/chi nhánh/loại xe/dịch vụ */
  getAvailableSlots: async (
    branchId: number,
    targetDate: string,
    vehicleTypeId: number,
    serviceIds: number[],
  ): Promise<ApiResponse<TimeSlot[]>> => {
    return apiClient.post<TimeSlot[]>('/bookings/available-slots', {
      branchId,
      targetDate,
      vehicleTypeId,
      serviceIds,
    });
  },

  /** Re-fetch trusted suggestion data from the backend by booking id. */
  getOverloadSuggestion: async (
    bookingId: number,
  ): Promise<ApiResponse<OverloadSuggestion | null>> => {
    return apiClient.get<OverloadSuggestion | null>(
      `/bookings/${bookingId}/overload-suggestion`,
    );
  },

  /** The request deliberately contains only the customer's decision. */
  handleOverloadSuggestion: async (
    bookingId: number,
    decision: OverloadDecision,
  ): Promise<ApiResponse<HandleOverloadSuggestionResponse>> => {
    return apiClient.post<HandleOverloadSuggestionResponse>(
      `/bookings/${bookingId}/handle-overload-suggestion`,
      { decision } satisfies HandleOverloadSuggestionRequest,
    );
  },

  /** Tạo một lần đặt lịch mới */
  createBooking: async (data: BookingRequest): Promise<ApiResponse<CreateBookingResponse>> => {
    return apiClient.post<CreateBookingResponse>('/bookings', data);
  },

  /** Tạo link thanh toán online cho một booking */
  createPaymentLink: async (
    bookingId: number,
    data: BookingPaymentLinkRequest,
  ): Promise<ApiResponse<BookingPaymentLinkResponse>> => {
    return apiClient.post<BookingPaymentLinkResponse>(`/bookings/${bookingId}/payment-link`, data);
  },

  /** Kiểm tra trạng thái thanh toán của booking (polling sau khi trả tiền) */
  getPaymentStatus: async (
    bookingId: number,
  ): Promise<ApiResponse<BookingPaymentStatusResponse>> => {
    return apiClient.get<BookingPaymentStatusResponse>(`/bookings/${bookingId}/payment-status`);
  },

  /** Lấy danh sách booking của khách đang đăng nhập (có thể lọc theo ngày/trạng thái) */
  getMyBookings: async (params?: GetMyBookingsParams): Promise<ApiResponse<MyBookingItem[]>> => {
    return apiClient.get<MyBookingItem[]>('/bookings/me', params as Record<string, unknown> | undefined);
  },

  /** Huỷ một booking */
  cancelBooking: async (bookingId: number): Promise<ApiResponse<void>> => {
    return apiClient.put<void>(`/bookings/${bookingId}/cancel`, {});
  },

  /** Cập nhật trạng thái booking (dành cho quản trị/nhân viên) */
  updateBookingStatus: async (bookingId: number, newStatus: string): Promise<ApiResponse<void>> => {
    return apiClient.put<void>(`/admin/bookings/${bookingId}/status`, { newStatus });
  },

  /** Yêu cầu gửi lại email xác nhận cho booking */
  triggerEmail: async (bookingId: number): Promise<ApiResponse<void>> => {
    return apiClient.post<void>(`/bookings/${bookingId}/trigger-email`, {});
  },

  /** Lấy chi tiết một booking theo id */
  getBookingDetail: async (bookingId: number): Promise<ApiResponse<BookingDetailResponse>> => {
    return apiClient.get<BookingDetailResponse>(`/bookings/${bookingId}`);
  },

  /** Dời lịch booking sang ngày/khung giờ mới */
  rescheduleBooking: async (
    bookingId: number,
    data: RescheduleBookingRequest,
  ): Promise<ApiResponse<BookingDetailResponse>> => {
    return apiClient.put<BookingDetailResponse>(`/bookings/${bookingId}/reschedule`, data);
  },
};
