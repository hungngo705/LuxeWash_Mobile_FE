/**
 * API Service Index
 * Re-exports all services for convenient imports
 *
 * File tổng hợp: gom (re-export) tất cả service và kiểu dữ liệu của tầng API
 * về một chỗ để các nơi khác import ngắn gọn từ "@/services/api".
 */

// Service & kiểu dữ liệu xác thực (đăng ký, đăng nhập, hồ sơ, đổi mật khẩu)
export { authService } from "./authService";
export type {
    ChangePasswordRequest, LoginRequest,
    LoginResponse, RefreshTokenRequest, RefreshTokenResponse, RegisterRequest, UpdateProfileRequest, UserProfile
} from "./authService";
// Service & kiểu dữ liệu đặt lịch (dịch vụ, slot, thanh toán, dời chi nhánh khi quá tải)
export { bookingService } from "./bookingService";
export type {
    BookingDetail, BookingDetailResponse, BookingDetailVehicle, BookingRelocationProposal, BookingRequest,
    BookingPaymentLinkRequest, BookingPaymentLinkResponse, BookingPaymentStatus,
    BookingPaymentStatusResponse,
    HandleOverloadSuggestionRequest, HandleOverloadSuggestionResponse,
    OverloadDecision, OverloadRefund, OverloadSuggestion, OverloadVoucher,
    CompatibilityDTO, CreateBookingResponse, GetMyBookingsParams, MyBookingItem,
    RescheduleBookingRequest, Service,
    ServicePrice, TimeSlot
} from "./bookingService";
// Service đăng ký/huỷ token thông báo đẩy
export { notificationService } from "./notificationService";
export type { UserNotification } from "./notificationService";
// Service & kiểu dữ liệu chi nhánh
export { branchService } from "./branchService";
export type { BranchDTO } from "./branchService";
// Tầng HTTP lõi: client, quản lý token, lỗi API, xử lý hết phiên đăng nhập
export {
    ApiError, ApiResponse, BASE_URL, apiClient, clearTokens,
    getStoredTokens, setTokens, setSessionExpiredHandler, clearSessionExpiredHandler
} from "./client";
// Service & kiểu dữ liệu khách hàng thân thiết (hạng, voucher)
export { loyaltyService } from "./loyaltyService";
export {
    PointHistoryItem,
    RedeemableVoucher,
    Tier,
    Voucher,
    VoucherCampaignType,
    VoucherType,
    CAMPAIGN_BADGE_CONFIG,
} from "./loyaltyService";
// Trợ lý AI dành riêng cho khách hàng
export { aiService } from "./aiService";
export type {
    AIChatRequest, AIChatResponse, AIRecommendationResponse
} from "./aiService";
// Service & kiểu dữ liệu phương tiện (loại xe, mẫu xe, xe của tôi)
export { vehicleService } from "./vehicleService";
export type {
    CarModel,
    RequestCarModelPayload,
    UpdateVehiclePayload,
    VehicleResponse,
} from "./vehicleService";
// Service & kiểu dữ liệu ví (số dư, nạp tiền, giao dịch)
export { walletService } from "./walletService";
export type {
    TopUpRequest,
    Transaction, TransactionStatus, TransactionType, WalletBalance
} from "./walletService";
