import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants, { ExecutionEnvironment } from "expo-constants";
import type { DevicePushToken } from "expo-notifications";
import { Platform } from "react-native";

import { notificationService } from "@/services/api/notificationService";

/**
 * Dịch vụ thông báo đẩy (push notification) cho luồng "chi nhánh quá tải".
 * Nạp expo-notifications theo kiểu lazy và chỉ chạy trên Android dev/release build
 * (không chạy trong Expo Go). Xử lý: đăng ký FCM token, tạo kênh, lắng nghe thông báo.
 */

export const OVERLOAD_NOTIFICATION_CHANNEL_ID = "overload-alerts"; // ID kênh thông báo Android
const DEVICE_PUSH_TOKEN_KEY = "@luxewash_device_push_token"; // Khoá lưu token trong AsyncStorage

/** Dữ liệu đính kèm thông báo đẩy về đề xuất dời chi nhánh */
export interface OverloadNotificationPayload {
  type: "OVERLOAD_SUGGESTION";
  suggestionId: number;
  bookingId: number;
}

/** Đích điều hướng khi khách bấm một push notification thông thường. */
export interface UserNotificationTarget {
  type: "Booking" | "Vehicle" | "Voucher";
  referenceId: string | null;
}

/** Kết quả đăng ký token đẩy: thành công (kèm token) hoặc thất bại (kèm lý do) */
export type PushRegistrationResult =
  | { status: "registered"; token: string }
  | { status: "permission-denied" | "unsupported" | "error"; message: string };

type NotificationsModule = typeof import("expo-notifications");

/** Sự kiện thông báo đã chuẩn hoá (dữ liệu + id) */
interface NotificationEvent {
  data: Record<string, unknown>;
  notificationId: string;
}

/** Các callback khi nhận thông báo (đang mở app) và khi người dùng bấm vào thông báo */
interface NotificationListeners {
  onReceived: (event: NotificationEvent) => void | Promise<void>;
  onResponse: (event: NotificationEvent) => void | Promise<void>;
}

// Cache promise nạp module để chỉ import & cấu hình một lần
let notificationsModulePromise: Promise<NotificationsModule> | null = null;

/**
 * Expo Go is a StoreClient runtime. Importing expo-notifications there emits
 * an SDK 53+ Android remote-push error, so the module is loaded lazily only
 * inside a custom development/release build.
 */
export function isRemotePushSupportedRuntime(): boolean {
  return (
    Platform.OS === "android" &&
    Constants.executionEnvironment !== ExecutionEnvironment.StoreClient
  );
}

// Nạp lazy module expo-notifications (chỉ khi runtime hỗ trợ) và thiết lập cách hiển thị
async function loadNotificationsModule(): Promise<NotificationsModule | null> {
  if (!isRemotePushSupportedRuntime()) return null;

  if (!notificationsModulePromise) {
    notificationsModulePromise = import("expo-notifications").then((Notifications) => {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
      return Notifications;
    });
  }

  return notificationsModulePromise;
}

// Ép giá trị về số nguyên dương, không hợp lệ thì trả null
function toPositiveInteger(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

// Gộp payload lồng nhau (chuỗi JSON) vào data phẳng để dễ đọc các trường
function normalizeData(data: Record<string, unknown>): Record<string, unknown> {
  const nestedPayload = data.payload;
  if (typeof nestedPayload !== "string") return data;

  try {
    const parsed = JSON.parse(nestedPayload);
    return parsed && typeof parsed === "object"
      ? { ...data, ...(parsed as Record<string, unknown>) }
      : data;
  } catch {
    return data;
  }
}

/**
 * Đọc dữ liệu thông báo thô và trích ra payload đề xuất quá tải (nếu đúng loại).
 * Chấp nhận cả tên trường viết hoa/thường (bookingId/BookingId) để tương thích backend.
 * Trả null nếu không phải thông báo OVERLOAD_SUGGESTION hoặc thiếu id.
 */
export function parseOverloadNotification(
  rawData: Record<string, unknown> | null | undefined,
): OverloadNotificationPayload | null {
  if (!rawData) return null;

  const data = normalizeData(rawData);
  const type = String(data.type ?? data.Type ?? "").toUpperCase();
  if (type !== "OVERLOAD_SUGGESTION") return null;

  const bookingId = toPositiveInteger(data.bookingId ?? data.BookingId);
  const suggestionId = toPositiveInteger(data.suggestionId ?? data.SuggestionId);
  if (!bookingId || !suggestionId) return null;

  return { type: "OVERLOAD_SUGGESTION", bookingId, suggestionId };
}

/** Đọc payload push do UserNotificationService của backend gửi kèm. */
export function parseUserNotificationTarget(
  rawData: Record<string, unknown> | null | undefined,
): UserNotificationTarget | null {
  if (!rawData) return null;
  const data = normalizeData(rawData);
  const rawType = String(data.type ?? data.Type ?? "").toLowerCase();
  const type =
    rawType === "booking"
      ? "Booking"
      : rawType === "vehicle"
        ? "Vehicle"
        : rawType === "voucher"
          ? "Voucher"
          : null;
  if (!type) return null;

  const value = data.referenceId ?? data.ReferenceId;
  return {
    type,
    referenceId: value === null || value === undefined ? null : String(value),
  };
}

// Tạo/cấu hình kênh thông báo Android riêng cho cảnh báo quá tải (độ ưu tiên cao)
export async function configureOverloadNotificationChannel(): Promise<void> {
  const Notifications = await loadNotificationsModule();
  if (!Notifications) return;

  await Notifications.setNotificationChannelAsync(
    OVERLOAD_NOTIFICATION_CHANNEL_ID,
    {
      name: "Cảnh báo chi nhánh quá tải",
      description: "Thông báo cần phản hồi khi chi nhánh đặt lịch bị quá tải.",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#0B1A37",
      sound: "default",
    },
  );
}

/**
 * Registers the native Android FCM token expected by Firebase Admin.
 * iOS returns an APNs token here, which is not compatible with this backend endpoint.
 */
export async function registerCurrentDevicePushToken(): Promise<PushRegistrationResult> {
  if (!isRemotePushSupportedRuntime()) {
    return {
      status: "unsupported",
      message: "Remote push chỉ được khởi tạo trong Android development build.",
    };
  }

  try {
    const Notifications = await loadNotificationsModule();
    if (!Notifications) {
      return {
        status: "unsupported",
        message: "Remote push không khả dụng trong runtime hiện tại.",
      };
    }

    await configureOverloadNotificationChannel();

    // Kiểm tra quyền thông báo; nếu chưa có thì xin quyền người dùng
    const currentPermissions = await Notifications.getPermissionsAsync();
    let permissionStatus = currentPermissions.status;
    if (permissionStatus !== "granted") {
      const requestedPermissions = await Notifications.requestPermissionsAsync();
      permissionStatus = requestedPermissions.status;
    }

    if (permissionStatus !== "granted") {
      return {
        status: "permission-denied",
        message: "Người dùng chưa cấp quyền nhận thông báo.",
      };
    }

    // Lấy native FCM token của thiết bị rồi gửi lên backend và lưu lại cục bộ
    const nativeToken = await Notifications.getDevicePushTokenAsync();
    if (typeof nativeToken.data !== "string" || !nativeToken.data.trim()) {
      return {
        status: "error",
        message: "Không lấy được native FCM token từ thiết bị.",
      };
    }

    const token = nativeToken.data.trim();
    await notificationService.registerToken(token);
    await AsyncStorage.setItem(DEVICE_PUSH_TOKEN_KEY, token);
    return { status: "registered", token };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Không thể đăng ký FCM token.",
    };
  }
}

// Đăng ký lại khi FCM token bị xoay vòng (hệ thống cấp token mới)
export async function registerRotatedDevicePushToken(
  token: DevicePushToken,
): Promise<void> {
  if (!isRemotePushSupportedRuntime() || typeof token.data !== "string") return;

  const value = token.data.trim();
  if (!value) return;

  try {
    await notificationService.registerToken(value);
    await AsyncStorage.setItem(DEVICE_PUSH_TOKEN_KEY, value);
  } catch {
    // The next app activation retries registration with the current token.
  }
}

/**
 * Đăng ký lắng nghe thông báo: khi nhận (đang mở app), khi bấm vào thông báo,
 * và khi token xoay vòng. Cũng xử lý trường hợp app khởi động lạnh từ 1 thông báo.
 * Trả về hàm huỷ đăng ký để gọi khi dọn dẹp.
 */
export async function subscribeToOverloadNotifications({
  onReceived,
  onResponse,
}: NotificationListeners): Promise<() => void> {
  const Notifications = await loadNotificationsModule();
  if (!Notifications) return () => {};

  // Lắng nghe thông báo đến khi app đang chạy (foreground)
  const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
    void onReceived({
      data: notification.request.content.data,
      notificationId: notification.request.identifier,
    });
  });

  // Lắng nghe khi người dùng bấm vào thông báo (mở/điều hướng)
  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    void onResponse({
      data: response.notification.request.content.data,
      notificationId: response.notification.request.identifier,
    });
  });

  // Lắng nghe khi token đẩy thay đổi để đăng ký lại
  const tokenSubscription = Notifications.addPushTokenListener((token) => {
    void registerRotatedDevicePushToken(token);
  });

  // SDK 54 lưu response cuối ở native ngay cả khi JS chưa khởi tạo. Đọc đồng bộ
  // sau khi listener đã được gắn để không bỏ lỡ thao tác mở app từ trạng thái tắt hẳn.
  try {
    const response = Notifications.getLastNotificationResponse();
    if (response) {
      void Promise.resolve(
        onResponse({
          data: response.notification.request.content.data,
          notificationId: response.notification.request.identifier,
        }),
      ).finally(() => {
        Notifications.clearLastNotificationResponse();
      });
    }
  } catch {
    // API discovery remains the fallback if native response state is unavailable.
  }

  // Hàm dọn dẹp: gỡ toàn bộ listener
  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
    tokenSubscription.remove();
  };
}

// Gỡ đăng ký token đẩy hiện tại (gọi khi đăng xuất) và xoá token cục bộ
export async function unregisterCurrentDevicePushToken(): Promise<void> {
  const token = await AsyncStorage.getItem(DEVICE_PUSH_TOKEN_KEY);
  if (!token) return;

  try {
    await notificationService.unregisterToken(token);
  } finally {
    await AsyncStorage.removeItem(DEVICE_PUSH_TOKEN_KEY);
  }
}
