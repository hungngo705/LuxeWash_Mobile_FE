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
