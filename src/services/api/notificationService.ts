/**
 * Notification API Service
 *
 * Nhóm API thông báo đẩy: đăng ký / huỷ đăng ký device token (Expo push token)
 * với backend để nhận thông báo đẩy về máy.
 */

import { apiClient, type ApiResponse } from "./client";

/** Dữ liệu gửi lên chứa push token của thiết bị */
interface NotificationTokenRequest {
  token: string;
}

export const notificationService = {
  /** Đăng ký device token để bắt đầu nhận thông báo đẩy */
  registerToken: (token: string): Promise<ApiResponse<void>> =>
    apiClient.post<void>("/notifications/token", {
      token,
    } satisfies NotificationTokenRequest),

  /** Huỷ đăng ký device token (vd khi đăng xuất) để ngừng nhận thông báo */
  unregisterToken: (token: string): Promise<ApiResponse<void>> =>
    apiClient.delete<void>("/notifications/token", {
      token,
    } satisfies NotificationTokenRequest),
};
