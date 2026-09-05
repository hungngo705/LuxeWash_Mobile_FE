/**
 * Shared formatting utilities for LuxeWash app
 *
 * Các hàm tiện ích định dạng dùng chung: tiền tệ VND, quy đổi điểm,
 * định dạng ngày/giờ, và lời chào theo thời điểm trong ngày.
 */

export const VND_PER_POINT = 1000; // Tỉ giá quy đổi: 1 điểm = 1000đ

/** Quy đổi số tiền (VND) sang số điểm (làm tròn xuống) */
export const vndToPoints = (vnd: number): number => {
  return Math.floor(vnd / VND_PER_POINT);
};

/** Quy đổi số điểm sang số tiền (VND) */
export const pointsToVnd = (points: number): number => {
  return points * VND_PER_POINT;
};

/** Định dạng số tiền theo tiền tệ VND (vd "100.000 ₫") */
export const formatVnd = (amount: number): string => {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
};

/** Định dạng tiền rút gọn: từ 1 triệu trở lên hiển thị dạng "1.2M" */
export const formatVndShort = (amount: number): string => {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M`;
  }
  return amount.toLocaleString("vi-VN");
};

/** Định dạng số điểm tương ứng với một số tiền */
export const formatPoints = (vnd: number): string => {
  const pts = vndToPoints(vnd);
  return pts.toLocaleString("vi-VN");
};

/** Định dạng điểm kèm giá trị tiền tương đương (vd "100 điểm (≈ 100.000 ₫)") */
export const formatPointsWithVnd = (vnd: number): string => {
  const pts = vndToPoints(vnd);
  return `${pts.toLocaleString("vi-VN")} điểm (≈ ${formatVnd(vnd)})`;
};

/** Định dạng ngày theo chuẩn Việt Nam (dd/mm/yyyy) */
export const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("vi-VN");
};

/** Định dạng giờ:phút từ chuỗi ISO */
export const formatTime = (isoDateStr: string): string => {
  if (!isoDateStr) return "";
  const date = new Date(isoDateStr);
  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

/** Định dạng ngày kèm giờ (vd "01/01/2026 lúc 08:00") */
export const formatDateTime = (isoDateStr: string): string => {
  if (!isoDateStr) return "";
  return `${formatDate(isoDateStr)} lúc ${formatTime(isoDateStr)}`;
};

/** Lấy phần ngày dạng ISO (yyyy-mm-dd) từ một chuỗi ngày */
export const toIsoDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toISOString().split("T")[0];
};

/** Trả lời chào phù hợp theo giờ hiện tại (sáng/chiều/tối) */
export const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return "Buổi sáng tốt lành";
  if (hour < 18) return "Buổi chiều tốt lành";
  return "Buổi tối tốt lành";
};

/** Lấy khoá ngày (yyyy-mm-dd) từ chuỗi ISO để nhóm/so sánh theo ngày */
export const getDateKey = (isoDateStr: string): string => {
  return isoDateStr.split("T")[0];
};

/** Một cặp giờ (start, end) tính bằng phút kể từ 00:00 trong ngày */
export interface SlotClockRange {
  startMinutes: number; // phút kể từ 00:00 (vd 16:00 -> 960)
  endMinutes: number; // phút kể từ 00:00 (vd 16:30 -> 990)
}

/**
 * Parse chuỗi "HH:mm - HH:mm" (vd "16:00 - 16:30") thành cặp số phút.
 * Trả về null nếu chuỗi không đúng định dạng — FE sẽ fallback vào `slot.isAvailable`
 * của backend.
 */
export const parseSlotTimeRange = (timeRange: string | null | undefined): SlotClockRange | null => {
  if (!timeRange || typeof timeRange !== "string") return null;
  const match = timeRange.match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const [, sh, sm, eh, em] = match;
  const startMinutes = Number(sh) * 60 + Number(sm);
  const endMinutes = Number(eh) * 60 + Number(em);
  if (
    !Number.isFinite(startMinutes) ||
    !Number.isFinite(endMinutes) ||
    startMinutes < 0 ||
    endMinutes <= startMinutes ||
    endMinutes > 24 * 60
  ) {
    return null;
  }
  return { startMinutes, endMinutes };
};

/**
 * Trả về true nếu khung giờ của slot đã KẾT THÚC so với giờ hiện tại của thiết bị.
 * Dùng để FE tự bảo vệ khi backend trả isAvailable=true cho slot đã qua EndTime
 * (do chênh múi giờ, cache, hoặc backend chưa cập nhật).
 *
 * @param timeRange Chuỗi "HH:mm - HH:mm"
 * @param selectedDate Ngày mà slot này thuộc về (chỉ so sánh EndTime nếu là hôm nay)
 * @param now Tham số now để dễ test; mặc định là `new Date()`
 */
export const isSlotEnded = (
  timeRange: string | null | undefined,
  selectedDate: Date | null,
  now: Date = new Date(),
): boolean => {
  const range = parseSlotTimeRange(timeRange);
  if (!range || !selectedDate) return false;

  const isToday =
    selectedDate.getFullYear() === now.getFullYear() &&
    selectedDate.getMonth() === now.getMonth() &&
    selectedDate.getDate() === now.getDate();
  if (!isToday) return false;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes >= range.endMinutes;
};

/**
 * Trả về true nếu slot đang diễn ra (StartTime <= now < EndTime) cho ngày hôm nay.
 * Kết hợp với `isAvailable` của backend để vô hiệu hoá slot đang chạy.
 */
export const isSlotInProgress = (
  timeRange: string | null | undefined,
  selectedDate: Date | null,
  now: Date = new Date(),
): boolean => {
  const range = parseSlotTimeRange(timeRange);
  if (!range || !selectedDate) return false;

  const isToday =
    selectedDate.getFullYear() === now.getFullYear() &&
    selectedDate.getMonth() === now.getMonth() &&
    selectedDate.getDate() === now.getDate();
  if (!isToday) return false;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes >= range.startMinutes && nowMinutes < range.endMinutes;
};
