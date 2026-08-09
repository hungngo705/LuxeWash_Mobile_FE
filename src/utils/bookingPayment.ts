import type { BookingPaymentStatus } from "@/services/api";

const TERMINAL_BOOKING_STATUSES = new Set([
  "Cancelled",
  "CancelledBySystem",
  "NoShow",
]);

export const PAYMENT_STATUS_LABEL: Record<BookingPaymentStatus, string> = {
  Unpaid: "Chưa thanh toán",
  Pending: "Đang chờ xác nhận",
  Completed: "Đã thanh toán",
  Expired: "Thanh toán hết hạn",
  Failed: "Thanh toán thất bại",
};

export const isRetryableBookingPayment = (
  paymentStatus: BookingPaymentStatus | null | undefined,
  finalAmount: number,
  bookingStatus?: string,
) =>
  finalAmount > 0 &&
  !TERMINAL_BOOKING_STATUSES.has(bookingStatus ?? "") &&
  (paymentStatus === "Unpaid" ||
    paymentStatus === "Pending" ||
    paymentStatus === "Expired" ||
    paymentStatus === "Failed");

export const isPendingBookingPayment = (
  paymentStatus: BookingPaymentStatus | null | undefined,
  finalAmount: number,
) => finalAmount > 0 && paymentStatus === "Pending";
