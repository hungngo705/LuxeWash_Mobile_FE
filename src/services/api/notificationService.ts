/**
 * Notification API Service
 *
 * Nhóm API thông báo: danh sách thông báo trong app, trạng thái đã đọc
 * và đăng ký / huỷ đăng ký device token để nhận push notification.
 */

import { apiClient, type ApiResponse } from "./client";

/** Dữ liệu gửi lên chứa push token của thiết bị */
interface NotificationTokenRequest {
  token: string;
}

/** Một thông báo đã được backend lưu cho khách hàng. */
export interface UserNotification {
  id: number;
  title: string;
  body: string;
  type: string;
  referenceId: string | null;
  isRead: boolean;
  createdAt: string;
}

export const notificationService = {
  /** Lấy toàn bộ thông báo của tài khoản đang đăng nhập, mới nhất trước. */
  getNotifications: (): Promise<ApiResponse<UserNotification[]>> =>
    apiClient.get<UserNotification[]>("/notifications"),

  /** Lấy số thông báo chưa đọc để hiển thị badge. */
  getUnreadCount: (): Promise<ApiResponse<number>> =>
    apiClient.get<number>("/notifications/unread-count"),

  /** Đánh dấu một thông báo là đã đọc. */
  markAsRead: (notificationId: number): Promise<ApiResponse<void>> =>
    apiClient.put<void>(`/notifications/${notificationId}/read`),

  /** Đánh dấu tất cả thông báo là đã đọc. */
  markAllAsRead: (): Promise<ApiResponse<void>> =>
    apiClient.put<void>("/notifications/read-all"),

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
