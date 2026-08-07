import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { LuxeColors, LuxeShadows } from "@/constants/luxeTheme";
import type {
  MyBookingItem,
  OverloadDecision,
  OverloadSuggestion,
} from "@/services/api";
import { formatDate, formatTime } from "@/utils/format";

/** Props cho modal xử lý chi nhánh quá tải (dời lịch trước giờ hẹn). */
interface OverloadSuggestionModalProps {
  visible: boolean; // Hiển thị modal hay không
  suggestion: OverloadSuggestion | null; // Đề xuất chuyển chi nhánh từ backend
  booking: MyBookingItem | null; // Lịch hẹn liên quan
  submitting: boolean; // Đang gửi quyết định lên backend
  onDecision: (decision: OverloadDecision) => void; // Chọn cách xử lý (Switch/Keep/Cancel)
  onDismiss: () => void; // Đóng modal
}

/**
 * Modal thông báo chi nhánh quá tải và đề xuất chuyển sang chi nhánh khác.
 * Khách chọn: đổi chi nhánh (Switch), giữ lịch và chờ (Keep), hoặc hủy và hoàn quyền lợi (Cancel).
 * Đề xuất có thời hạn — hết hạn thì khóa các nút hành động.
 */
export function OverloadSuggestionModal({
  visible,
  suggestion,
  booking,
  submitting,
  onDecision,
  onDismiss,
}: OverloadSuggestionModalProps) {
  // Mốc thời gian hiện tại, cập nhật mỗi 30s để kiểm tra hết hạn
  const [now, setNow] = useState(Date.now());

  // Chạy bộ đếm cập nhật "now" khi modal đang mở, dọn dẹp khi đóng
  useEffect(() => {
    if (!visible) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [visible]);

  if (!suggestion) return null;

  // Tính trạng thái hết hạn của đề xuất
  const expiresAt = new Date(suggestion.expiresAt);
  const isExpired = Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={submitting ? undefined : onDismiss}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={submitting ? undefined : onDismiss}
        />

        <View style={styles.sheet}>
          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            <View style={styles.header}>
              <View style={styles.headerIconWrap}>
                <Feather name="alert-triangle" size={26} color="#DC2626" />
              </View>
              <View style={styles.headerTextWrap}>
                <Text style={styles.headerTitle}>Chi nhánh đang quá tải</Text>
                <Text style={styles.headerSubtitle}>
                  Chọn cách xử lý lịch hẹn #{suggestion.bookingId}
                </Text>
              </View>
              <TouchableOpacity
                onPress={onDismiss}
                disabled={submitting}
                style={styles.closeButton}
              >
                <Feather name="x" size={20} color={LuxeColors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            {booking && (
              <View style={styles.bookingCard}>
                <View style={styles.infoRow}>
                  <Feather name="truck" size={15} color={LuxeColors.onSurfaceVariant} />
                  <Text style={styles.infoText}>{booking.licensePlate}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Feather name="droplet" size={15} color={LuxeColors.onSurfaceVariant} />
                  <Text style={styles.infoText}>
                    {booking.serviceNames?.join(", ") || booking.serviceName || "Dịch vụ rửa xe"}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.suggestionCard}>
              <View style={styles.suggestionLabelRow}>
                <Feather name="map-pin" size={17} color={LuxeColors.primaryContainer} />
                <Text style={styles.suggestionLabel}>CHI NHÁNH ĐƯỢC ĐỀ XUẤT</Text>
              </View>
              <Text style={styles.branchName}>{suggestion.suggestedBranchName}</Text>
              <View style={styles.infoRow}>
                <Feather name="calendar" size={14} color={LuxeColors.onSurfaceVariant} />
                <Text style={styles.infoText}>
                  {formatDate(suggestion.suggestedTime)} • {formatTime(suggestion.suggestedTime)}
                </Text>
              </View>
            </View>

            <View style={[styles.expiryCard, isExpired && styles.expiredCard]}>
              <Feather name="clock" size={16} color={isExpired ? "#DC2626" : "#B45309"} />
              <Text style={[styles.expiryText, isExpired && styles.expiredText]}>
                {isExpired
                  ? "Đề xuất đã hết hạn. Hãy tải lại lịch hẹn."
                  : `Phản hồi trước ${formatTime(suggestion.expiresAt)}, ${formatDate(suggestion.expiresAt)}`}
              </Text>
            </View>

            <View style={styles.noteCard}>
              <Feather name="gift" size={18} color="#B45309" />
              <Text style={styles.noteText}>
                Nếu đổi chi nhánh, voucher đền bù sẽ được backend tạo sau khi xử lý thành công.
              </Text>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.switchButton, (submitting || isExpired) && styles.disabled]}
                onPress={() => onDecision("Switch")}
                disabled={submitting || isExpired}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Feather name="repeat" size={18} color="#FFFFFF" />
                    <Text style={styles.switchButtonText}>Đổi sang chi nhánh đề xuất</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.keepButton, (submitting || isExpired) && styles.disabled]}
                onPress={() => onDecision("Keep")}
                disabled={submitting || isExpired}
              >
                <Text style={styles.keepButtonText}>Giữ lịch hiện tại và chờ</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.cancelButton, (submitting || isExpired) && styles.disabled]}
                onPress={() => onDecision("Cancel")}
                disabled={submitting || isExpired}
              >
                <Text style={styles.cancelButtonText}>Hủy lịch và hoàn quyền lợi</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  backdrop: { flex: 1 },
  sheet: {
    maxHeight: "90%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 38 : 24,
    ...LuxeShadows.xl,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  headerIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextWrap: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#B91C1C" },
  headerSubtitle: { marginTop: 2, fontSize: 13, color: LuxeColors.onSurfaceVariant },
  closeButton: { padding: 6 },
  bookingCard: {
    backgroundColor: LuxeColors.surfaceContainerLow,
    borderRadius: 14,
    padding: 13,
    gap: 8,
    marginBottom: 12,
  },
  suggestionCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: LuxeColors.primaryContainer + "35",
    backgroundColor: LuxeColors.primaryContainer + "08",
    marginBottom: 12,
  },
  suggestionLabelRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  suggestionLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: LuxeColors.primaryContainer,
  },
  branchName: { fontSize: 18, fontWeight: "800", color: LuxeColors.onSurface, marginVertical: 12 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  infoText: { flex: 1, fontSize: 13, color: LuxeColors.onSurfaceVariant, fontWeight: "500" },
  expiryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#FFFBEB",
    marginBottom: 12,
  },
  expiredCard: { backgroundColor: "#FEF2F2" },
  expiryText: { flex: 1, fontSize: 12, color: "#92400E", fontWeight: "600" },
  expiredText: { color: "#B91C1C" },
  noteCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 13,
    borderRadius: 12,
    backgroundColor: "#FFF7ED",
    marginBottom: 20,
  },
  noteText: { flex: 1, fontSize: 12, lineHeight: 18, color: "#92400E" },
  actions: { gap: 10 },
  switchButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: LuxeColors.primaryContainer,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...LuxeShadows.md,
  },
  switchButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  keepButton: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: LuxeColors.primaryContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  keepButtonText: { color: LuxeColors.primaryContainer, fontSize: 14, fontWeight: "700" },
  cancelButton: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  cancelButtonText: { color: "#DC2626", fontSize: 13, fontWeight: "700" },
  disabled: { opacity: 0.55 },
});
