/**
 * Auth API Service
 * Handles authentication endpoints
 *
 * Nhóm API xác thực: đăng ký, đăng nhập, xác thực OTP, đổi mật khẩu,
 * làm mới token, cập nhật hồ sơ và đăng xuất.
 */

import {
  apiClient,
  ApiError,
  ApiResponse,
  setTokens,
  clearTokens,
} from './client';

const ensureCustomerAccount = (role: string | undefined) => {
  if (role?.trim().toLowerCase() !== 'customer') {
    throw new ApiError(
      403,
      'Ứng dụng LuxeWash Mobile chỉ dành cho tài khoản khách hàng.',
    );
  }
};

/** Dữ liệu gửi lên khi đăng ký tài khoản mới */
export interface RegisterRequest {
  phoneNumber: string;
  email: string;
  password: string;
  fullName: string;
}

/** Dữ liệu đăng nhập (dùng số điện thoại hoặc email) */
export interface LoginRequest {
  phoneOrEmail: string;
  password: string;
}

/** Phản hồi đăng nhập thành công, kèm token và thông tin cơ bản của người dùng */
export interface LoginResponse {
  userId: number;
  phoneNumber: string;
  fullName: string;
  token: string; // Access token dùng cho các request tiếp theo
  refreshToken: string; // Token để làm mới access token khi hết hạn
  role: string; // Vai trò người dùng (khách, nhân viên, quản lý...)
}

/** Hồ sơ chi tiết của người dùng đang đăng nhập */
export interface UserProfile {
  userId: number;
  fullName: string;
  phoneNumber: string;
  tierName: string; // Tên hạng thành viên (Standard, Gold...)
  totalPoint: number; // Tổng điểm tích luỹ
  promotionPoint: number; // Điểm khuyến mãi
  churnScore: number; // Điểm dự đoán nguy cơ rời bỏ (dùng cho phân tích)
  vehicles: {
    licensePlate: string;
    vehicleTypeId: number;
    vehicleType: string;
    registrationPhotoUrl: string | null;
    carModel: string | null;
  }[]; // Danh sách xe đã đăng ký của người dùng
  dateOfBirth: string | null;
  email: string | null;
  status: string; // Trạng thái tài khoản (active, pending...)
}

/** Phản hồi khi làm mới token thành công */
export interface RefreshTokenResponse {
  token: string;
  refreshToken: string;
}

/** Dữ liệu gửi lên để làm mới token (kèm cả access token cũ) */
export interface RefreshTokenRequest {
  accessToken: string;
  refreshToken: string;
}

/** Dữ liệu đổi mật khẩu */
export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

/** Dữ liệu cập nhật hồ sơ (mọi field đều tuỳ chọn) */
export interface UpdateProfileRequest {
  fullName?: string;
  phoneNumber?: string;
  email?: string;
  dateOfBirth?: string;
}

/** Dữ liệu xác thực mã OTP theo email */
export interface VerifyOtpRequest {
  email: string;
  otp: string;
}

/** Dữ liệu yêu cầu gửi lại OTP */
export interface ResendOtpRequest {
  email: string;
}

/** Phản hồi khi gửi lại OTP, kèm thời điểm OTP hết hạn */
export interface ResendOtpResponse {
  userId: number;
  email: string;
  status: string;
  otpExpiresAt: string;
}

export const authService = {
  /** Đăng ký tài khoản mới */
  register: async (data: RegisterRequest): Promise<ApiResponse<void>> => {
    return apiClient.post<void>('/auth/register', data);
  },

  /** Đăng nhập và tự động lưu token nếu thành công */
  login: async (data: LoginRequest): Promise<ApiResponse<LoginResponse>> => {
    const response = await apiClient.post<LoginResponse>('/auth/login', data);
    if (response.data?.token) {
      ensureCustomerAccount(response.data.role);
      await setTokens(response.data.token, response.data.refreshToken);
    }
    return response;
  },

  /** Lấy hồ sơ người dùng đang đăng nhập */
  getProfile: async (): Promise<ApiResponse<UserProfile>> => {
    return apiClient.get<UserProfile>('/users/me');
  },

  /** Làm mới access token bằng refresh token */
  refreshToken: async (data: RefreshTokenRequest): Promise<ApiResponse<RefreshTokenResponse>> => {
    return apiClient.post<RefreshTokenResponse>('/auth/refresh-token', data);
  },

  /** Đăng xuất: xoá token khỏi bộ nhớ cục bộ */
  logout: async () => {
    await clearTokens();
  },

  /** Đổi mật khẩu tài khoản */
  changePassword: async (data: ChangePasswordRequest): Promise<ApiResponse<void>> => {
    return apiClient.post<void>('/auth/change-password', data);
  },

  /** Cập nhật thông tin hồ sơ người dùng */
  updateProfile: async (data: UpdateProfileRequest): Promise<ApiResponse<void>> => {
    return apiClient.put<void>('/users/me', data);
  },

  /** Xác thực OTP (thường sau khi đăng ký) và tự lưu token nếu thành công */
  verifyOtp: async (data: VerifyOtpRequest): Promise<ApiResponse<LoginResponse>> => {
    const response = await apiClient.post<LoginResponse>('/auth/verify-otp', data);
    if (response.data?.token) {
      ensureCustomerAccount(response.data.role);
      await setTokens(response.data.token, response.data.refreshToken);
    }
    return response;
  },

  /** Gửi lại mã OTP về email */
  resendOtp: async (data: ResendOtpRequest): Promise<ApiResponse<ResendOtpResponse>> => {
    return apiClient.post<ResendOtpResponse>('/auth/resend-otp', data);
  },
};
