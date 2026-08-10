import { Header } from "@/components/ui/Header";
import {
  LuxeBorderRadius,
  LuxeColors,
  LuxeShadows,
} from "@/constants/luxeTheme";
import {
  ApiError,
  bookingService,
  type BookingDetailResponse,
  type BookingPaymentStatus,
} from "@/services/api";
import {
  isPendingBookingPayment,
  isRetryableBookingPayment,
  PAYMENT_STATUS_LABEL,
} from "@/utils/bookingPayment";
import { formatDate, formatTime, formatVnd } from "@/utils/format";
import { Feather } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { dismissBrowser, openBrowserAsync } from "expo-web-browser";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const PAYMENT_POLL_ATTEMPTS = 20;
const PAYMENT_POLL_INTERVAL_MS = 3000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof ApiError && error.message) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

const getStatusColors = (status: BookingPaymentStatus) => {
  switch (status) {
    case "Completed":
      return { background: "#DCFCE7", foreground: "#15803D", icon: "check-circle" as const };
    case "Refunded":
      return { background: "#DBEAFE", foreground: "#1D4ED8", icon: "rotate-ccw" as const };
    case "Pending":
      return { background: "#FEF3C7", foreground: "#B45309", icon: "clock" as const };
    case "Expired":
    case "Failed":
      return { background: "#FEE2E2", foreground: "#B91C1C", icon: "alert-circle" as const };
    default:
      return { background: "#FFF7ED", foreground: "#C2410C", icon: "credit-card" as const };
  }
};

export default function BookingPaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookingId?: string; payment?: string }>();
  const bookingId = Number(params.bookingId);

  const [booking, setBooking] = useState<BookingDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);

  const updatePaymentStatus = useCallback(
    async (showLoadingMessage = false): Promise<BookingPaymentStatus | null> => {
      if (!Number.isInteger(bookingId) || bookingId <= 0) return null;
      if (showLoadingMessage) setPaymentMessage("Đang kiểm tra trạng thái thanh toán...");

      const response = await bookingService.getPaymentStatus(bookingId);
      const nextStatus = response.data?.paymentStatus ?? null;
      if (!nextStatus) return null;

      setBooking((current) =>
        current
          ? {
              ...current,
              paymentStatus: nextStatus,
              paymentMethod: response.data?.paymentMethod ?? current.paymentMethod,
            }
          : current,
      );

      if (nextStatus === "Completed") {
        setPaymentMessage("Thanh toán đã được xác nhận thành công.");
      } else if (nextStatus === "Refunded") {
        setPaymentMessage("Khoản thanh toán của lịch hẹn đã được hoàn tiền.");
      } else if (nextStatus === "Pending") {
        setPaymentMessage("Giao dịch đang chờ PayOS xác nhận.");
      } else if (nextStatus === "Expired") {
        setPaymentMessage("Giao dịch đã hết hạn. Bạn có thể tạo giao dịch mới.");
      } else if (nextStatus === "Failed") {
        setPaymentMessage("Giao dịch thất bại. Bạn có thể thanh toán lại.");
      } else {
        setPaymentMessage("Lịch hẹn này chưa được thanh toán.");
      }

      return nextStatus;
    },
    [bookingId],
  );

  const loadBooking = useCallback(async () => {
    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      setError("Mã lịch hẹn không hợp lệ.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await bookingService.getBookingDetail(bookingId);
      if (response.statusCode !== 200 || !response.data) {
        throw new Error(response.message || "Không tìm thấy lịch hẹn.");
      }
      setBooking(response.data);
      await updatePaymentStatus();
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Không thể tải thông tin thanh toán."));
    } finally {
      setLoading(false);
    }
  }, [bookingId, updatePaymentStatus]);

  useEffect(() => {
    void loadBooking();
  }, [loadBooking]);

  useEffect(() => {
    const subscription = Linking.addEventListener("url", ({ url }) => {
      const parsed = Linking.parse(url);
      if (String(parsed.queryParams?.bookingId ?? "") !== String(bookingId)) return;

      void dismissBrowser().catch(() => undefined);
      void updatePaymentStatus(true).catch(() => undefined);
    });
    return () => subscription.remove();
  }, [bookingId, updatePaymentStatus]);

  useEffect(() => {
    if (params.payment) {
      void updatePaymentStatus(true).catch(() => undefined);
    }
  }, [params.payment, updatePaymentStatus]);

  const buildReturnUrl = (payment: "return" | "cancelled") =>
    Linking.createURL("booking/payment", {
      queryParams: { bookingId: String(bookingId), payment },
    });

  const pollPaymentStatus = async () => {
    for (let attempt = 1; attempt <= PAYMENT_POLL_ATTEMPTS; attempt += 1) {
      setPaymentMessage(
        `Đang xác nhận thanh toán... (${attempt}/${PAYMENT_POLL_ATTEMPTS})`,
      );
      try {
        const status = await updatePaymentStatus();
        if (
          status === "Completed" ||
          status === "Refunded" ||
          status === "Expired" ||
          status === "Failed"
        ) {
          return status;
        }
      } catch {
        // PayOS hoặc mạng có thể phản hồi chậm; tiếp tục polling trong giới hạn.
      }
      await wait(PAYMENT_POLL_INTERVAL_MS);
    }
    return null;
  };

  const handleRetryPayment = async () => {
    if (!booking || processing) return;
    setProcessing(true);
    setError(null);
    setPaymentMessage("Đang chuẩn bị giao dịch thanh toán...");

    try {
      const latestStatus = await updatePaymentStatus();
      if (latestStatus === "Completed" || latestStatus === "Refunded") return;
      setPaymentMessage(
        latestStatus === "Pending"
          ? "Đang tạo giao dịch thanh toán mới..."
          : "Đang chuẩn bị giao dịch thanh toán...",
      );

      const linkResponse = await bookingService.createPaymentLink(booking.bookingId, {
        returnUrl: buildReturnUrl("return"),
        cancelUrl: buildReturnUrl("cancelled"),
      });

      if (linkResponse.statusCode !== 200 || !linkResponse.data?.paymentUrl) {
        throw new Error(linkResponse.message || "Không thể tạo link thanh toán PayOS.");
      }

      setBooking((current) =>
        current ? { ...current, paymentStatus: "Pending", paymentMethod: "PayOS" } : current,
      );
      setPaymentMessage("Đang mở cổng thanh toán PayOS...");
      await openBrowserAsync(linkResponse.data.paymentUrl);

      const status = await pollPaymentStatus();
      if (status === "Completed" || status === "Refunded") return;
      if (status === "Expired" || status === "Failed") return;

      setPaymentMessage(
        "Chưa nhận được xác nhận từ PayOS. Bạn có thể bấm kiểm tra trạng thái sau ít phút.",
      );
    } catch (paymentError) {
      setError(getErrorMessage(paymentError, "Không thể thực hiện thanh toán. Vui lòng thử lại."));
    } finally {
      setProcessing(false);
    }
  };

  const handleCheckStatus = async () => {
    if (processing) return;
    setProcessing(true);
    setError(null);
    try {
      await updatePaymentStatus(true);
    } catch (statusError) {
      setError(getErrorMessage(statusError, "Không thể kiểm tra trạng thái thanh toán."));
    } finally {
      setProcessing(false);
    }
  };

  const paymentStatus = booking?.paymentStatus ?? "Unpaid";
  const statusColors = getStatusColors(paymentStatus);
  const canRetry = booking
    ? isRetryableBookingPayment(paymentStatus, booking.finalAmount, booking.status)
    : false;
  const isPending = booking
    ? isPendingBookingPayment(paymentStatus, booking.finalAmount)
    : false;

  return (
    <View style={styles.container}>
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <Header title="Thanh toán lịch hẹn" onBack={() => router.back()} />
      </SafeAreaView>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={LuxeColors.primaryContainer} />
          <Text style={styles.centerText}>Đang tải thông tin thanh toán...</Text>
        </View>
      ) : error && !booking ? (
        <View style={styles.centerState}>
          <Feather name="alert-circle" size={40} color={LuxeColors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => void loadBooking()}>
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : booking ? (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.bookingCard}>
            <View>
              <Text style={styles.eyebrow}>Mã lịch hẹn</Text>
              <Text style={styles.bookingCode}>#{booking.bookingId}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColors.background }]}>
              <Feather name={statusColors.icon} size={15} color={statusColors.foreground} />
              <Text style={[styles.statusText, { color: statusColors.foreground }]}>
                {PAYMENT_STATUS_LABEL[paymentStatus]}
              </Text>
            </View>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Biển số xe</Text>
              <Text style={styles.summaryValue}>{booking.licensePlate}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Thời gian</Text>
              <Text style={styles.summaryValue}>
                {formatDate(booking.scheduledTime)} · {formatTime(booking.scheduledTime)}
              </Text>
            </View>
            <View style={[styles.summaryRow, styles.amountRow]}>
              <Text style={styles.amountLabel}>Cần thanh toán</Text>
              <Text style={styles.amountValue}>{formatVnd(booking.finalAmount)}</Text>
            </View>
          </View>

          <View style={[styles.noticeCard, { backgroundColor: statusColors.background }]}>
            <Feather name={statusColors.icon} size={22} color={statusColors.foreground} />
            <View style={styles.noticeContent}>
              <Text style={[styles.noticeTitle, { color: statusColors.foreground }]}>
                {PAYMENT_STATUS_LABEL[paymentStatus]}
              </Text>
              <Text style={styles.noticeText}>
                {paymentStatus === "Completed"
                  ? "Khoản thanh toán cho lịch hẹn đã được xác nhận."
                  : paymentStatus === "Refunded"
                    ? "Khoản thanh toán đã được hoàn. Lịch hẹn này không cần thanh toán lại."
                  : paymentStatus === "Pending"
                    ? "Giao dịch trước vẫn đang chờ. Bạn có thể thanh toán lại bằng link mới hoặc kiểm tra trạng thái."
                    : "Thanh toán an toàn qua cổng PayOS để hoàn tất lịch hẹn này."}
              </Text>
            </View>
          </View>

          {paymentMessage && <Text style={styles.paymentMessage}>{paymentMessage}</Text>}
          {error && booking && <Text style={styles.inlineError}>{error}</Text>}

          {canRetry && (
            <TouchableOpacity
              style={[styles.primaryButton, processing && styles.buttonDisabled]}
              onPress={() => void handleRetryPayment()}
              disabled={processing}
            >
              {processing ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Feather name="credit-card" size={19} color="#ffffff" />
              )}
              <Text style={styles.primaryButtonText}>
                {processing
                  ? "Đang xử lý..."
                  : isPending
                    ? "Thanh toán lại qua PayOS"
                    : "Thanh toán ngay qua PayOS"}
              </Text>
            </TouchableOpacity>
          )}

          {isPending && (
            <TouchableOpacity
              style={[styles.secondaryButton, processing && styles.buttonDisabled]}
              onPress={() => void handleCheckStatus()}
              disabled={processing}
            >
              {processing ? (
                <ActivityIndicator size="small" color={LuxeColors.primaryContainer} />
              ) : (
                <Feather name="refresh-cw" size={18} color={LuxeColors.primaryContainer} />
              )}
              <Text style={styles.secondaryButtonText}>Kiểm tra trạng thái</Text>
            </TouchableOpacity>
          )}

          {(paymentStatus === "Completed" || paymentStatus === "Refunded") && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.replace(`/booking/${booking.bookingId}` as any)}
            >
              <Feather name="file-text" size={18} color={LuxeColors.primaryContainer} />
              <Text style={styles.secondaryButtonText}>Xem chi tiết lịch hẹn</Text>
            </TouchableOpacity>
          )}

          <View style={styles.securityRow}>
            <Feather name="shield" size={15} color={LuxeColors.onSurfaceVariant} />
            <Text style={styles.securityText}>
              Giao dịch được xử lý bởi PayOS. LuxeWash không lưu thông tin ngân hàng của bạn.
            </Text>
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: LuxeColors.background },
  headerSafeArea: { backgroundColor: "#ffffff" },
  content: { padding: 18, paddingBottom: 40, gap: 14 },
  centerState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 28 },
  centerText: { fontSize: 14, color: LuxeColors.onSurfaceVariant },
  errorText: { fontSize: 14, lineHeight: 20, color: LuxeColors.error, textAlign: "center" },
  retryButton: { paddingHorizontal: 22, paddingVertical: 11, borderRadius: 12, backgroundColor: LuxeColors.primaryContainer },
  retryButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  bookingCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 18,
    borderRadius: LuxeBorderRadius.xl,
    backgroundColor: "#ffffff",
    ...LuxeShadows.sm,
  },
  eyebrow: { fontSize: 12, color: LuxeColors.onSurfaceVariant, marginBottom: 3 },
  bookingCode: { fontSize: 28, fontWeight: "800", color: LuxeColors.onSurface },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 18 },
  statusText: { fontSize: 12, fontWeight: "700" },
  summaryCard: { padding: 18, borderRadius: LuxeBorderRadius.xl, backgroundColor: "#ffffff", ...LuxeShadows.sm },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 },
  summaryLabel: { fontSize: 14, color: LuxeColors.onSurfaceVariant },
  summaryValue: { flex: 1, marginLeft: 16, fontSize: 14, fontWeight: "600", color: LuxeColors.onSurface, textAlign: "right" },
  amountRow: { marginTop: 4, paddingTop: 16, borderTopWidth: 1, borderTopColor: LuxeColors.outlineVariant + "35" },
  amountLabel: { fontSize: 16, fontWeight: "700", color: LuxeColors.onSurface },
  amountValue: { fontSize: 21, fontWeight: "800", color: LuxeColors.primaryContainer },
  noticeCard: { flexDirection: "row", gap: 12, padding: 16, borderRadius: LuxeBorderRadius.lg },
  noticeContent: { flex: 1 },
  noticeTitle: { fontSize: 15, fontWeight: "800", marginBottom: 4 },
  noticeText: { fontSize: 13, lineHeight: 19, color: LuxeColors.onSurfaceVariant },
  paymentMessage: { fontSize: 13, lineHeight: 19, color: LuxeColors.onSurfaceVariant, textAlign: "center" },
  inlineError: { padding: 12, borderRadius: 10, backgroundColor: "#FEE2E2", color: "#B91C1C", fontSize: 13, lineHeight: 18 },
  primaryButton: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    borderRadius: LuxeBorderRadius.lg,
    backgroundColor: LuxeColors.primaryContainer,
    ...LuxeShadows.primary,
  },
  primaryButtonText: { fontSize: 15, fontWeight: "800", color: "#ffffff" },
  secondaryButton: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    borderRadius: LuxeBorderRadius.lg,
    borderWidth: 1,
    borderColor: LuxeColors.primaryContainer,
    backgroundColor: "#ffffff",
  },
  secondaryButtonText: { fontSize: 14, fontWeight: "700", color: LuxeColors.primaryContainer },
  buttonDisabled: { opacity: 0.65 },
  securityRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "center", gap: 8, paddingHorizontal: 8, marginTop: 4 },
  securityText: { flex: 1, fontSize: 11, lineHeight: 16, color: LuxeColors.onSurfaceVariant },
});
