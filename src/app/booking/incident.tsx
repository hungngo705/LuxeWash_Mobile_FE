import { useConfirmDialog } from "@/components/ConfirmDialog";
import { Header } from "@/components/ui/Header";
import { LuxeColors } from "@/constants/luxeTheme";
import { ApiError, incidentService, type IncidentAvailableSlot, type IncidentAvailabilityContext, type IncidentOptions } from "@/services/api";
import { formatVnd } from "@/utils/format";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const errorText = (error: unknown) =>
  error instanceof ApiError && error.message
    ? error.message
    : "Không thể kết nối. Vui lòng thử lại.";

// Backend sends Vietnam wall-clock strings (no offset); do not parse as UTC.
const dateTime = (value: string) => {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]} · ${match[4]}:${match[5]}` : value;
};

const caseStatusLabel: Record<string, string> = {
  AwaitingCustomer: "Đang chờ bạn phản hồi",
  Cancelled: "Đã hủy lịch",
  Transferred: "Đã chuyển chi nhánh",
  Kept: "Giữ nguyên lịch",
  CancelledBySystem: "Hệ thống đã hủy lịch",
};

const SLOTS_PER_PAGE = 8;

export default function IncidentDecisionScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router = useRouter();
  const { confirm } = useConfirmDialog();
  const id = Number(bookingId);
  const [item, setItem] = useState<IncidentOptions | null>(null);
  const [selected, setSelected] = useState<IncidentAvailableSlot | null>(null);
  const [expandedBranchId, setExpandedBranchId] = useState<number | null>(null);
  const [slotPage, setSlotPage] = useState(0);
  const [availabilityContext, setAvailabilityContext] = useState<IncidentAvailabilityContext | null>(null);
  const availabilityContextRef = useRef<IncidentAvailabilityContext | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<IncidentAvailableSlot[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsFailedCount, setSuggestionsFailedCount] = useState(0);
  const [branchSlots, setBranchSlots] = useState<Record<number, IncidentAvailableSlot[]>>({});
  const [branchLoading, setBranchLoading] = useState<Record<number, boolean>>({});
  const [branchErrors, setBranchErrors] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [slow, setSlow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!Number.isInteger(id) || id <= 0) {
      setError("Mã lịch hẹn không hợp lệ.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setSlow(false);
    setError(null);
    setItem(null);
    setSelected(null);
    setExpandedBranchId(null);
    setSlotPage(0);
    availabilityContextRef.current = null;
    setAvailabilityContext(null);
    setContextLoading(true);
    setContextError(null);
    setSuggestions([]);
    setSuggestionsLoading(false);
    setSuggestionsFailedCount(0);
    setBranchSlots({});
    setBranchLoading({});
    setBranchErrors({});
    const slowTimer = setTimeout(() => setSlow(true), 10_000);
    try {
      setItem(await incidentService.getOptions(id));
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      clearTimeout(slowTimer);
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!item || item.caseStatus !== "AwaitingCustomer" || !Number.isInteger(id) || id <= 0) return;
    let active = true;
    setContextLoading(true);
    setContextError(null);
    setSuggestions([]);
    setSuggestionsFailedCount(0);
    setBranchSlots({});
    setBranchErrors({});
    void incidentService.getAvailabilityContext(id, item).then((context) => {
      if (!active) return;
      availabilityContextRef.current = context;
      setAvailabilityContext(context);
      setContextLoading(false);
      setSuggestionsLoading(true);
      void incidentService.getSameTimeSuggestions(context).then((result) => {
        if (!active) return;
        setSuggestions(result.suggestions);
        setSuggestionsFailedCount(result.failedCount);
      }).catch(() => {
        if (active) setSuggestionsFailedCount(context.branches.length);
      }).finally(() => {
        if (active) setSuggestionsLoading(false);
      });
    }).catch((cause) => {
      if (!active) return;
      setContextError(errorText(cause));
      setContextLoading(false);
    });
    return () => { active = false; };
  }, [id, item]);

  const fetchBranchSlots = useCallback(async (branch: IncidentAvailabilityContext["branches"][number]) => {
    const context = availabilityContextRef.current;
    if (!context) return;
    setBranchLoading((current) => ({ ...current, [branch.branchId]: true }));
    setBranchErrors((current) => ({ ...current, [branch.branchId]: "" }));
    try {
      const slots = await incidentService.getBranchSlots(context, branch);
      if (availabilityContextRef.current !== context) return;
      setBranchSlots((current) => ({ ...current, [branch.branchId]: slots }));
    } catch (cause) {
      if (availabilityContextRef.current !== context) return;
      setBranchErrors((current) => ({ ...current, [branch.branchId]: errorText(cause) }));
    } finally {
      if (availabilityContextRef.current === context) {
        setBranchLoading((current) => ({ ...current, [branch.branchId]: false }));
      }
    }
  }, []);

  const openBranch = (branch: IncidentAvailabilityContext["branches"][number]) => {
    const expanded = expandedBranchId === branch.branchId;
    setExpandedBranchId(expanded ? null : branch.branchId);
    setSlotPage(0);
    if (!expanded) {
      setSelected(null);
      if (!branchLoading[branch.branchId]) void fetchBranchSlots(branch);
    }
  };

  const decide = (decision: "Cancel" | "Transfer", directSlot?: IncidentAvailableSlot) => {
    if (!item || submitting || loading || error || item.caseStatus !== "AwaitingCustomer") return;
    if (decision === "Cancel" && !item.allowedActions.includes("Cancel")) return;
    const slot = directSlot ?? selected;
    if (decision === "Transfer" && !slot) return;
    confirm({
      title: decision === "Cancel" ? "Xác nhận hủy lịch" : "Xác nhận chuyển chi nhánh",
      message: decision === "Cancel"
        ? `Lịch sẽ được hủy. Dự kiến hoàn ${formatVnd(item.refundPreview.amount)} vào ví, hoàn ${item.refundPreview.pointsRestored} điểm và cấp voucher giảm ${item.voucherTerms.discountPercent}%.`
        : `Chuyển lịch sang ${slot?.branchName}, ${slot?.startAt}–${slot?.endAt}? Hệ thống sẽ kiểm tra lại chỗ trống khi xác nhận. Bạn cũng sẽ nhận voucher giảm ${item.voucherTerms.discountPercent}% cho lần rửa tiếp theo.`,
      confirmText: decision === "Cancel" ? "Hủy lịch" : "Chuyển lịch",
      destructive: decision === "Cancel",
      onConfirm: async () => {
        setSubmitting(true);
        setError(null);
        try {
          const result = await incidentService.decide(
            id,
            item,
            decision === "Cancel"
              ? { decision: "Cancel" }
              : { decision: "Transfer", targetBranchId: slot!.branchId, targetSlotId: slot!.slotId },
          );
          setItem((current) => current ? { ...current, caseStatus: result.caseStatus } : current);
          confirm({
            title: "Đã xử lý",
            message: result.compensationVoucher
              ? `Lựa chọn đã được ghi nhận. Voucher giảm ${result.compensationVoucher.discountPercent}% dùng đến ${result.compensationVoucher.expiresAt} đã được cấp.`
              : "Lựa chọn của bạn đã được ghi nhận.",
            showCancel: false,
            confirmText: "Xem lịch hẹn",
            onConfirm: () => router.replace({ pathname: "/booking/[id]", params: { id: String(id) } }),
          });
        } catch (cause) {
          setSelected(null);
          setError(cause instanceof ApiError && cause.statusCode === 409
            ? "Sự cố hoặc khung giờ đã thay đổi. Hãy tải lại lựa chọn rồi chọn lại."
            : `${errorText(cause)} Hãy kiểm tra trạng thái lịch trước khi thử lại.`);
        } finally {
          setSubmitting(false);
        }
      },
    });
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={["top"]} style={styles.header}>
        <Header title="Xử lý lịch do sự cố" onBack={() => router.back()} />
      </SafeAreaView>
      {loading && !item ? (
        <View style={styles.center}>
          <ActivityIndicator color={LuxeColors.primary} />
          <Text style={styles.message}>{slow ? "Máy chủ đang tải thông tin sự cố. Vui lòng đợi hoặc thử lại sau…" : "Đang tải thông tin sự cố..."}</Text>
          {slow && <Text style={styles.footnote}>Bạn có thể quay lại lịch hẹn và mở màn hình này sau.</Text>}
        </View>
      ) : !item ? (
        <View style={styles.center}>
          <Text style={styles.message}>{error || "Lịch hẹn này không có yêu cầu xử lý sự cố."}</Text>
          <TouchableOpacity style={styles.button} onPress={load}><Text style={styles.buttonText}>Thử lại</Text></TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.refreshButton} onPress={load} disabled={loading || submitting}>
            <Text style={styles.refreshText}>{loading ? "Đang cập nhật…" : "Làm mới lựa chọn"}</Text>
          </TouchableOpacity>
          <View style={styles.card}>
            <Text style={styles.title}>Lịch #{item.originalBooking?.bookingId ?? id} bị ảnh hưởng</Text>
            {!!item.originalBooking?.licensePlate && <Text style={styles.text}>Biển số: {item.originalBooking.licensePlate}</Text>}
            <Text style={styles.text}>Lịch ban đầu: {dateTime(item.originalBooking?.scheduledTime ?? "")}</Text>
            <Text style={styles.text}>Sự cố: {item.reason}</Text>
            <Text style={styles.text}>Dự kiến khắc phục: {dateTime(item.eta)}</Text>
            {item.caseStatus === "AwaitingCustomer" ? (
              <Text style={styles.deadline}>Vui lòng phản hồi trước {dateTime(item.responseDeadlineAt)}</Text>
            ) : (
              <Text style={styles.deadline}>Trạng thái xử lý: {caseStatusLabel[item.caseStatus] ?? item.caseStatus}</Text>
            )}
          </View>
          {item.caseStatus === "AwaitingCustomer" && <View style={styles.voucherCard}>
            <Text style={styles.voucherTitle}>Quà xin lỗi: voucher giảm {item.voucherTerms.discountPercent}%</Text>
            <Text style={styles.voucherText}>Dù chuyển sang chi nhánh khác hay hủy lịch, bạn đều nhận voucher cho lần rửa tiếp theo. Voucher có hiệu lực 6 tháng sau khi được cấp.</Text>
          </View>}
          {error && <View style={styles.card}>
            <Text style={styles.error}>{error}</Text>
            <TouchableOpacity style={styles.button} onPress={load} disabled={loading}>
              <Text style={styles.buttonText}>Tải lại lựa chọn</Text>
            </TouchableOpacity>
          </View>}
          {item.caseStatus === "AwaitingCustomer" && (
            <>
              <Text style={styles.sectionTitle}>Chuyển sang chi nhánh khác</Text>
              <Text style={styles.text}>Ưu tiên giờ đã đặt tại chi nhánh khác, hoặc mở một chi nhánh bên dưới để xem giờ trống.</Text>
              <View style={styles.card}>
                <Text style={styles.branch}>Gợi ý giữ nguyên khung giờ</Text>
                {!!availabilityContext && <Text style={styles.branchMeta}>Giờ đã đặt: {availabilityContext.originalStartAt} · {availabilityContext.targetDate}</Text>}
                {(contextLoading || suggestionsLoading) && <View style={styles.inlineLoading}>
                  <ActivityIndicator color={LuxeColors.primary} size="small" />
                  <Text style={styles.text}>Đang kiểm tra chi nhánh khác cùng giờ...</Text>
                </View>}
                {!contextLoading && !suggestionsLoading && suggestions.map((option) => (
                  <TouchableOpacity key={`${option.branchId}-${option.slotId}`} style={styles.suggestion} onPress={() => decide("Transfer", option)} disabled={submitting || loading || !!error}>
                    <View style={styles.branchHeaderText}>
                      <Text style={styles.branch}>{option.branchName}</Text>
                      <Text style={styles.branchMeta}>{option.startAt}–{option.endAt}</Text>
                    </View>
                    <Text style={styles.refreshText}>Chọn ›</Text>
                  </TouchableOpacity>
                ))}
                {!contextLoading && !suggestionsLoading && !contextError && suggestions.length === 0 && (
                  <Text style={styles.text}>Chưa tìm thấy chi nhánh còn chỗ đúng giờ đã đặt. Bạn có thể xem giờ khác bên dưới hoặc hủy lịch.</Text>
                )}
                {!suggestionsLoading && suggestionsFailedCount > 0 && (
                  <Text style={styles.error}>Không kiểm tra được {suggestionsFailedCount} chi nhánh. Hãy làm mới để thử lại.</Text>
                )}
                {!!contextError && <Text style={styles.error}>{contextError}</Text>}
              </View>

              <Text style={styles.sectionTitle}>Tất cả chi nhánh khác</Text>
              {contextLoading && <View style={styles.inlineLoading}>
                <ActivityIndicator color={LuxeColors.primary} size="small" />
                <Text style={styles.text}>Đang tải danh sách chi nhánh...</Text>
              </View>}
              {!contextLoading && !contextError && availabilityContext?.branches.length === 0 && (
                <Text style={styles.text}>Không có chi nhánh khác đang hoạt động. Bạn vẫn có thể hủy lịch.</Text>
              )}
              {availabilityContext?.branches.map((branch) => {
                const expanded = expandedBranchId === branch.branchId;
                const slots = branchSlots[branch.branchId] ?? [];
                const pageCount = Math.ceil(slots.length / SLOTS_PER_PAGE);
                const visibleSlots = slots.slice(slotPage * SLOTS_PER_PAGE, (slotPage + 1) * SLOTS_PER_PAGE);
                return <View key={branch.branchId} style={styles.branchCard}>
                  <TouchableOpacity
                    style={styles.branchHeader}
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    onPress={() => openBranch(branch)}
                    disabled={submitting}
                  >
                    <View style={styles.branchHeaderText}>
                      <Text style={styles.branch}>{branch.name}</Text>
                      <Text style={styles.branchMeta}>{selected?.branchId === branch.branchId
                        ? `Đã chọn ${selected.startAt}–${selected.endAt}`
                        : "Chạm để kiểm tra giờ trống"}</Text>
                    </View>
                    <Text style={styles.chevron}>{expanded ? "▴" : "▾"}</Text>
                  </TouchableOpacity>
                  {expanded && <View style={styles.slotsArea}>
                    {branchLoading[branch.branchId] && <View style={styles.inlineLoading}>
                      <ActivityIndicator color={LuxeColors.primary} size="small" />
                      <Text style={styles.text}>Đang kiểm tra giờ trống...</Text>
                    </View>}
                    {!!branchErrors[branch.branchId] && <>
                      <Text style={styles.error}>{branchErrors[branch.branchId]}</Text>
                      <TouchableOpacity onPress={() => void fetchBranchSlots(branch)}><Text style={styles.refreshText}>Thử lại</Text></TouchableOpacity>
                    </>}
                    {!branchLoading[branch.branchId] && !branchErrors[branch.branchId] && branchSlots[branch.branchId] && slots.length === 0 && (
                      <Text style={styles.text}>Chi nhánh này không có khung giờ phù hợp trong ngày đã đặt.</Text>
                    )}
                    {!branchLoading[branch.branchId] && !branchErrors[branch.branchId] && slots.length > 0 && <>
                      <Text style={styles.slotPrompt}>Chọn giờ bắt đầu · {slots.length} khung giờ</Text>
                      <View style={styles.slotGrid}>
                        {visibleSlots.map((option) => {
                          const active = selected?.branchId === option.branchId && selected.slotId === option.slotId;
                          return <TouchableOpacity
                            key={`${option.branchId}-${option.slotId}`}
                            accessibilityRole="radio"
                            accessibilityLabel={`${branch.name}, ${option.startAt} đến ${option.endAt}`}
                            accessibilityState={{ selected: active }}
                            style={[styles.slotChip, active && styles.slotChipSelected]}
                            onPress={() => setSelected(option)}
                            disabled={submitting}
                          >
                            <Text style={[styles.slotTime, active && styles.slotTimeSelected]}>{option.startAt}–{option.endAt}</Text>
                          </TouchableOpacity>;
                        })}
                      </View>
                      {pageCount > 1 && <View style={styles.pagination}>
                        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Trang khung giờ trước" disabled={slotPage === 0} onPress={() => setSlotPage((page) => page - 1)}>
                          <Text style={[styles.pageButton, slotPage === 0 && styles.disabled]}>‹ Trước</Text>
                        </TouchableOpacity>
                        <Text style={styles.branchMeta}>{slotPage + 1}/{pageCount}</Text>
                        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Trang khung giờ tiếp theo" disabled={slotPage >= pageCount - 1} onPress={() => setSlotPage((page) => page + 1)}>
                          <Text style={[styles.pageButton, slotPage >= pageCount - 1 && styles.disabled]}>Sau ›</Text>
                        </TouchableOpacity>
                      </View>}
                    </>}
                  </View>}
                </View>;
              })}
              <TouchableOpacity style={[styles.button, (!selected || submitting || loading || !!error) && styles.disabled]} onPress={() => decide("Transfer")} disabled={!selected || submitting || loading || !!error}>
                <Text style={styles.buttonText}>Xác nhận chuyển chi nhánh</Text>
              </TouchableOpacity>
              {item.allowedActions.includes("Cancel") && <TouchableOpacity style={[styles.cancelButton, (submitting || !!error) && styles.disabled]} onPress={() => decide("Cancel")} disabled={submitting || !!error}>
                <Text style={styles.cancelText}>Hủy lịch hẹn</Text>
              </TouchableOpacity>}
              <Text style={styles.footnote}>Nếu hủy lịch: dự kiến hoàn {formatVnd(item.refundPreview.amount)} về {item.refundPreview.destination}; hoàn {item.refundPreview.pointsRestored} điểm{item.refundPreview.originalVoucherRestored ? ", trả lại voucher cũ" : ""}.</Text>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: LuxeColors.background },
  header: { backgroundColor: LuxeColors.surfaceContainerLowest },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 14 },
  content: { padding: 16, paddingBottom: 48, gap: 14 },
  card: { backgroundColor: LuxeColors.surfaceContainerLowest, borderRadius: 16, padding: 18, gap: 8 },
  title: { fontSize: 19, fontWeight: "700", color: LuxeColors.onSurface },
  branch: { fontSize: 16, fontWeight: "700", color: LuxeColors.onSurface },
  branchCard: { backgroundColor: LuxeColors.surfaceContainerLowest, borderRadius: 16, overflow: "hidden" },
  suggestion: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: 1, borderColor: LuxeColors.outlineVariant },
  inlineLoading: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  branchHeader: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  branchHeaderText: { flex: 1, gap: 4 },
  branchMeta: { fontSize: 13, color: LuxeColors.onSurfaceVariant },
  chevron: { fontSize: 22, color: LuxeColors.primary },
  slotsArea: { borderTopWidth: 1, borderColor: LuxeColors.outlineVariant, padding: 14, gap: 12 },
  slotPrompt: { fontSize: 13, fontWeight: "600", color: LuxeColors.onSurfaceVariant },
  slotGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  slotChip: { width: "48%", borderWidth: 1, borderColor: LuxeColors.outlineVariant, borderRadius: 10, paddingVertical: 11, alignItems: "center" },
  slotChipSelected: { borderColor: LuxeColors.primary, backgroundColor: LuxeColors.primary + "18" },
  slotTime: { fontSize: 13, fontWeight: "600", color: LuxeColors.onSurface },
  slotTimeSelected: { color: LuxeColors.primary },
  pagination: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  pageButton: { fontSize: 14, fontWeight: "700", color: LuxeColors.primary, paddingHorizontal: 8, paddingVertical: 5 },
  voucherCard: { backgroundColor: LuxeColors.primary + "12", borderWidth: 1, borderColor: LuxeColors.primary + "45", borderRadius: 16, padding: 16, gap: 6 },
  voucherTitle: { fontSize: 17, fontWeight: "800", color: LuxeColors.primary },
  voucherText: { fontSize: 14, lineHeight: 21, color: LuxeColors.onSurface },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: LuxeColors.onSurface, marginTop: 8 },
  text: { fontSize: 14, lineHeight: 21, color: LuxeColors.onSurfaceVariant },
  message: { fontSize: 15, textAlign: "center", color: LuxeColors.onSurfaceVariant },
  deadline: { fontSize: 14, fontWeight: "600", color: LuxeColors.primary },
  error: { fontSize: 14, color: LuxeColors.error },
  refreshButton: { alignSelf: "flex-end", paddingVertical: 6, paddingHorizontal: 4 },
  refreshText: { color: LuxeColors.primary, fontSize: 14, fontWeight: "700" },
  button: { backgroundColor: LuxeColors.primary, borderRadius: 12, padding: 15, alignItems: "center" },
  buttonText: { color: LuxeColors.onPrimary, fontSize: 15, fontWeight: "700" },
  cancelButton: { borderWidth: 1, borderColor: LuxeColors.error, borderRadius: 12, padding: 15, alignItems: "center" },
  cancelText: { color: LuxeColors.error, fontSize: 15, fontWeight: "700" },
  disabled: { opacity: 0.5 },
  footnote: { fontSize: 13, lineHeight: 19, color: LuxeColors.onSurfaceVariant },
});
