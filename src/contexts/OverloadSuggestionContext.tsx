import { router } from "expo-router";
import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";

import { OverloadSuggestionModal } from "@/components/booking/OverloadSuggestionModal";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { useAuth } from "@/contexts/AuthContext";
import {
  ApiError,
  bookingService,
  type MyBookingItem,
  type OverloadDecision,
  type OverloadSuggestion,
} from "@/services/api";
import {
  isRemotePushSupportedRuntime,
  parseOverloadNotification,
  registerCurrentDevicePushToken,
  subscribeToOverloadNotifications,
} from "@/services/pushNotificationService";
import { formatVnd } from "@/utils/format";

/**
 * Context xử lý đề xuất dời chi nhánh khi quá tải (proactive relocation).
 * - Dò các booking sắp tới có đề xuất dời chi nhánh (từ API và/hoặc thông báo đẩy).
 * - Hiển thị modal cho khách chọn: Đổi chi nhánh / Huỷ / Giữ nguyên.
 * - Gửi quyết định lên backend và cập nhật lại hồ sơ, ví, danh sách đề xuất.
 */

/** Đề xuất đang mở trên modal (kèm booking tương ứng nếu tìm được) */
interface ActiveSuggestion {
  suggestion: OverloadSuggestion;
  booking: MyBookingItem | null;
}

/** Giá trị context cung cấp cho các màn hình */
interface OverloadSuggestionContextValue {
  suggestionsByBookingId: Record<number, OverloadSuggestion>; // Map bookingId -> đề xuất còn hiệu lực
  isDiscovering: boolean; // Đang dò đề xuất
  revision: number; // Số phiên bản, tăng mỗi khi xử lý xong (để màn hình biết mà tải lại)
  discoverSuggestions: (
    bookings?: MyBookingItem[],
    openFirst?: boolean,
  ) => Promise<void>;
  openSuggestionForBooking: (booking: MyBookingItem) => Promise<void>;
}

const OverloadSuggestionContext = createContext<OverloadSuggestionContextValue | null>(null);

// Đề xuất còn hiệu lực khi thời điểm hết hạn vẫn ở tương lai
function isActiveSuggestion(suggestion: OverloadSuggestion): boolean {
  const expiresAt = new Date(suggestion.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

// Booking đủ điều kiện xét quá tải: đang "pending" và giờ hẹn còn ở tương lai
function isPendingFutureBooking(booking: MyBookingItem): boolean {
  const scheduledAt = new Date(booking.scheduledTime).getTime();
  return (
    booking.status.toLowerCase() === "pending" &&
    Number.isFinite(scheduledAt) &&
    scheduledAt > Date.now()
  );
}

export function OverloadSuggestionProvider({ children }: { children: ReactNode }) {
  const { confirm } = useConfirmDialog();
  const {
    isAuthenticated,
    isLoading: isAuthLoading,
    user,
    refreshProfile,
    refreshWallet,
  } = useAuth();

  const [suggestionsByBookingId, setSuggestionsByBookingId] = useState<
    Record<number, OverloadSuggestion>
  >({});
  const [activeSuggestion, setActiveSuggestion] = useState<ActiveSuggestion | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revision, setRevision] = useState(0);

  const bookingsRef = useRef<MyBookingItem[]>([]); // Cache danh sách booking gần nhất
  const handledNotificationIdsRef = useRef(new Set<string>()); // ID thông báo đã xử lý (chống trùng)

  // Hiển thị hộp thoại thông báo đơn giản (chỉ nút "Đã hiểu")
  const showMessage = useCallback(
    (title: string, message: string) => {
      confirm({ title, message, confirmText: "Đã hiểu", showCancel: false });
    },
    [confirm],
  );

  // Gỡ một đề xuất khỏi danh sách (khi đã xử lý hoặc hết hạn)
  const removeSuggestion = useCallback((bookingId: number) => {
    setSuggestionsByBookingId((current) => {
      const next = { ...current };
      delete next[bookingId];
      return next;
    });
  }, []);

  /**
   * Lấy đề xuất tin cậy từ backend theo bookingId.
   * shouldOpen = true thì mở modal luôn (tự tìm booking tương ứng nếu chưa có).
   * Trả null nếu không còn đề xuất hợp lệ; lỗi 404/409 coi như đã hết hiệu lực.
   */
  const fetchSuggestion = useCallback(
    async (bookingId: number, shouldOpen: boolean): Promise<OverloadSuggestion | null> => {
      try {
        const response = await bookingService.getOverloadSuggestion(bookingId);
        const suggestion = response.data;
        if (!suggestion || !isActiveSuggestion(suggestion)) {
          removeSuggestion(bookingId);
          return null;
        }

        setSuggestionsByBookingId((current) => ({
          ...current,
          [bookingId]: suggestion,
        }));

        if (shouldOpen) {
          let booking = bookingsRef.current.find((item) => item.bookingId === bookingId) ?? null;
          if (!booking) {
            const bookingsResponse = await bookingService.getMyBookings();
            const bookings = Array.isArray(bookingsResponse.data) ? bookingsResponse.data : [];
            bookingsRef.current = bookings;
            booking = bookings.find((item) => item.bookingId === bookingId) ?? null;
          }
          setActiveSuggestion({ suggestion, booking });
        }

        return suggestion;
      } catch (error) {
        if (error instanceof ApiError && (error.statusCode === 404 || error.statusCode === 409)) {
          removeSuggestion(bookingId);
          return null;
        }
        throw error;
      }
    },
    [removeSuggestion],
  );

  /**
   * Dò tất cả đề xuất cho các booking sắp tới của khách.
   * Chỉ chạy cho tài khoản khách hàng. openFirst = true thì mở modal cho đề xuất đầu tiên tìm được.
   */
  const discoverSuggestions = useCallback(
    async (providedBookings?: MyBookingItem[], openFirst = false) => {
      if (!isAuthenticated || user?.role !== "customer") return;

      setIsDiscovering(true);
      try {
        // Dùng danh sách được truyền vào, nếu không thì tự tải
        let bookings = providedBookings;
        if (!bookings) {
          const response = await bookingService.getMyBookings();
          bookings = Array.isArray(response.data) ? response.data : [];
        }
        bookingsRef.current = bookings;

        // Chỉ xét các booking đang chờ và ở tương lai; loại bỏ đề xuất cũ không còn ứng viên
        const candidates = bookings.filter(isPendingFutureBooking);
        const candidateIds = new Set(candidates.map((booking) => booking.bookingId));
        setSuggestionsByBookingId((current) =>
          Object.fromEntries(
            Object.entries(current).filter(([bookingId]) => candidateIds.has(Number(bookingId))),
          ),
        );
        // Gọi song song để lấy đề xuất cho từng ứng viên
        const results = await Promise.allSettled(
          candidates.map((booking) => fetchSuggestion(booking.bookingId, false)),
        );

        // Mở modal cho đề xuất hợp lệ đầu tiên (nếu được yêu cầu)
        if (openFirst) {
          for (let index = 0; index < results.length; index += 1) {
            const result = results[index];
            if (result.status === "fulfilled" && result.value) {
              const booking = candidates[index] ?? null;
              setActiveSuggestion({ suggestion: result.value, booking });
              break;
            }
          }
        }
      } catch {
        // FCM is not the only source of truth; the screen retries discovery on focus/refresh.
      } finally {
        setIsDiscovering(false);
      }
    },
    [fetchSuggestion, isAuthenticated, user?.role],
  );

  // Mở modal đề xuất cho một booking cụ thể (khi khách bấm vào từ màn hình)
  const openSuggestionForBooking = useCallback(
    async (booking: MyBookingItem) => {
      try {
        const suggestion = await fetchSuggestion(booking.bookingId, false);
        if (suggestion) {
          setActiveSuggestion({ suggestion, booking });
        } else {
          showMessage("Đề xuất không còn hiệu lực", "Đề xuất đã được xử lý hoặc đã hết hạn.");
        }
      } catch (error) {
        showMessage(
          "Không thể tải đề xuất",
          error instanceof ApiError ? error.message : "Vui lòng kiểm tra kết nối và thử lại.",
        );
      }
    },
    [fetchSuggestion, showMessage],
  );

  // Dựng thông điệp thành công tuỳ theo quyết định (đổi/huỷ/giữ), gồm cả thông tin voucher/hoàn tiền
  const buildSuccessMessage = useCallback(
    (
      decision: OverloadDecision,
      data: Awaited<ReturnType<typeof bookingService.handleOverloadSuggestion>>["data"],
    ): string => {
      if (decision === "Switch") {
        const voucher = data.voucher;
        return voucher
          ? `Đã đổi chi nhánh thành công. Voucher ${voucher.code} trị giá ${formatVnd(voucher.discountAmount)} đã được thêm vào tài khoản.`
          : "Đã đổi sang chi nhánh đề xuất thành công.";
      }

      if (decision === "Cancel") {
        const refund = data.refund;
        const details: string[] = ["Lịch hẹn đã được hủy và không tính phí phạt."];
        if (refund?.refundedAmount) details.push(`Hoàn ${formatVnd(refund.refundedAmount)} vào ví.`);
        if (refund?.refundedPoints) details.push(`Hoàn ${refund.refundedPoints} điểm.`);
        if (refund?.restoredVoucherId) details.push("Voucher đã dùng được khôi phục.");
        return details.join(" ");
      }

      return "Đã ghi nhận lựa chọn giữ lịch hiện tại và chờ tại chi nhánh cũ.";
    },
    [],
  );

  /**
   * Gửi quyết định của khách lên backend và cập nhật trạng thái.
   * Nếu đổi/huỷ thì tải lại hồ sơ + ví (do có voucher/hoàn tiền).
   * Lỗi 404/409 nghĩa là đề xuất đã thay đổi -> gỡ khỏi danh sách.
   */
  const executeDecision = useCallback(
    async (decision: OverloadDecision, target: ActiveSuggestion) => {
      setActiveSuggestion(target);
      setIsSubmitting(true);
      try {
        const response = await bookingService.handleOverloadSuggestion(
          target.suggestion.bookingId,
          decision,
        );
        if (!response.data?.success) {
          throw new ApiError(response.statusCode, response.message || "Không thể xử lý đề xuất.");
        }

        removeSuggestion(target.suggestion.bookingId);
        setActiveSuggestion(null);
        setRevision((current) => current + 1);

        if (decision === "Switch" || decision === "Cancel") {
          await Promise.allSettled([refreshProfile(), refreshWallet()]);
        }

        showMessage("Đã xử lý thành công", buildSuccessMessage(decision, response.data));
      } catch (error) {
        const isStale =
          error instanceof ApiError && (error.statusCode === 404 || error.statusCode === 409);
        if (isStale) {
          removeSuggestion(target.suggestion.bookingId);
          setActiveSuggestion(null);
          setRevision((current) => current + 1);
        }

        const message =
          error instanceof ApiError
            ? error.message
            : "Không thể xử lý lựa chọn. Vui lòng thử lại.";
        showMessage(isStale ? "Đề xuất đã thay đổi" : "Xử lý thất bại", message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [buildSuccessMessage, refreshProfile, refreshWallet, removeSuggestion, showMessage],
  );

  // Xử lý khi khách chọn một phương án; riêng "Huỷ" cần xác nhận thêm trước khi thực thi
  const requestDecision = useCallback(
    (decision: OverloadDecision) => {
      if (!activeSuggestion || isSubmitting) return;
      const target = activeSuggestion;

      if (decision === "Cancel") {
        setActiveSuggestion(null);
        confirm({
          title: "Xác nhận hủy lịch",
          message:
            "Booking sẽ bị hủy. Backend sẽ miễn phí phạt và hoàn lại tiền, điểm, voucher đủ điều kiện.",
          confirmText: "Hủy lịch",
          cancelText: "Quay lại",
          destructive: true,
          onConfirm: () => executeDecision("Cancel", target),
          onCancel: () => setActiveSuggestion(target),
        });
        return;
      }

      void executeDecision(decision, target);
    },
    [activeSuggestion, confirm, executeDecision, isSubmitting],
  );

  /**
   * Xử lý dữ liệu từ thông báo đẩy: nếu là đề xuất quá tải thì tải và mở modal.
   * Chống xử lý trùng một thông báo; có thể điều hướng sang màn hình "Lịch của tôi".
   */
  const handleNotificationData = useCallback(
    async (
      data: Record<string, unknown>,
      notificationId: string | undefined,
      navigateToAppointments: boolean,
    ) => {
      const payload = parseOverloadNotification(data);
      if (!payload) return;

      // Bỏ qua nếu thông báo này đã xử lý; giới hạn kích thước tập ID đã lưu
      if (notificationId) {
        if (handledNotificationIdsRef.current.has(notificationId)) return;
        if (handledNotificationIdsRef.current.size >= 20) {
          handledNotificationIdsRef.current.clear();
        }
        handledNotificationIdsRef.current.add(notificationId);
      }

      if (navigateToAppointments) {
        router.push("/(main)/appointments" as never);
      }

      try {
        await fetchSuggestion(payload.bookingId, true);
      } catch {
        // The appointments screen still runs API discovery as a fallback.
      }
    },
    [fetchSuggestion],
  );

  // Thiết lập khi khách đăng nhập: dò đề xuất, đăng ký push, và dò lại khi app trở lại foreground
  useEffect(() => {
    // Chưa đăng nhập hoặc không phải khách -> xoá trạng thái và dừng
    if (isAuthLoading || !isAuthenticated || user?.role !== "customer") {
      setSuggestionsByBookingId({});
      setActiveSuggestion(null);
      return;
    }

    void discoverSuggestions(undefined, true);
    const supportsRemotePush = isRemotePushSupportedRuntime();
    let disposed = false;
    let removeNotificationListeners = () => {};

    if (supportsRemotePush) {
      void registerCurrentDevicePushToken();
      void subscribeToOverloadNotifications({
        onReceived: ({ data, notificationId }) =>
          handleNotificationData(data, notificationId, false),
        onResponse: ({ data, notificationId }) =>
          handleNotificationData(data, notificationId, true),
      }).then((removeListeners) => {
        if (disposed) {
          removeListeners();
        } else {
          removeNotificationListeners = removeListeners;
        }
      }).catch(() => {
        // API discovery remains available if the native notification module fails to load.
      });
    }

    // Mỗi khi app trở lại (active): đăng ký lại token và dò lại đề xuất
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        if (supportsRemotePush) {
          void registerCurrentDevicePushToken();
        }
        void discoverSuggestions();
      }
    });

    return () => {
      disposed = true;
      removeNotificationListeners();
      appStateSubscription.remove();
    };
  }, [
    discoverSuggestions,
    handleNotificationData,
    isAuthLoading,
    isAuthenticated,
    user?.id,
    user?.role,
  ]);

  return (
    <OverloadSuggestionContext.Provider
      value={{
        suggestionsByBookingId,
        isDiscovering,
        revision,
        discoverSuggestions,
        openSuggestionForBooking,
      }}
    >
      {children}
      <OverloadSuggestionModal
        visible={!!activeSuggestion}
        suggestion={activeSuggestion?.suggestion ?? null}
        booking={activeSuggestion?.booking ?? null}
        submitting={isSubmitting}
        onDecision={requestDecision}
        onDismiss={() => {
          if (!isSubmitting) setActiveSuggestion(null);
        }}
      />
    </OverloadSuggestionContext.Provider>
  );
}

/** Hook truy cập context đề xuất quá tải; phải dùng trong OverloadSuggestionProvider */
export function useOverloadSuggestions(): OverloadSuggestionContextValue {
  const context = useContext(OverloadSuggestionContext);
  if (!context) {
    throw new Error("useOverloadSuggestions must be used within OverloadSuggestionProvider");
  }
  return context;
}
