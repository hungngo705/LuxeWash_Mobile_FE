/**
 * Customer booking reschedule screen.
 */

import { BottomActionBar } from "@/components/ui/BottomActionBar";
import { Header } from "@/components/ui/Header";
import {
    LuxeBorderRadius,
    LuxeColors,
    LuxeShadows,
    MembershipConfig,
} from "@/constants/luxeTheme";
import { useAuth } from "@/contexts/AuthContext";
import {
    ApiError,
    bookingService,
    branchService,
    type BookingDetailResponse,
    type BranchDTO,
    type Service,
    type TimeSlot,
} from "@/services/api";
import { formatDate, formatTime } from "@/utils/format";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const DAYS_OF_WEEK = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const PERIOD_LABEL: Record<string, string> = {
  morning: "Sáng",
  afternoon: "Chiều",
  evening: "Tối",
};
const RESCHEDULABLE_STATUSES = ["Pending", "Confirmed"];

interface DayCell {
  date: Date | null;
  isPast: boolean;
  isLocked: boolean;
}

const toUTCMidnight = (date: Date): string => {
  const utc = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  return utc.toISOString();
};

const normalizePlate = (value: string): string =>
  value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

const normalizeServiceName = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof ApiError && error.message) {
    return error.message;
  }
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  return fallback;
};

const getFirstOfMonth = (date: Date): Date => {
  const next = new Date(date);
  next.setDate(1);
  next.setHours(0, 0, 0, 0);
  return next;
};

function matchServiceIds(serviceNames: string[], services: Service[]) {
  const serviceByName = new Map(
    services.map((service) => [
      normalizeServiceName(service.serviceName),
      service,
    ]),
  );
  const missing: string[] = [];
  const ids = serviceNames
    .map((name) => {
      const service = serviceByName.get(normalizeServiceName(name));
      if (!service) {
        missing.push(name);
        return null;
      }
      return service.serviceId;
    })
    .filter((id): id is number => typeof id === "number");

  return { ids, missing };
}

export default function RescheduleBookingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookingId?: string; id?: string }>();
  const { user } = useAuth();
  const bookingId = Number(params.bookingId ?? params.id ?? 0);

  const [booking, setBooking] = useState<BookingDetailResponse | null>(null);
  const [branches, setBranches] = useState<BranchDTO[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<BranchDTO | null>(null);
  const [serviceIds, setServiceIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingServices, setLoadingServices] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(getFirstOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);

  const membershipInfo = user
    ? MembershipConfig[user.membershipTier]
    : MembershipConfig.standard;
  const maxAdvanceDays = membershipInfo.maxAdvanceDays;

  const userVehicle = useMemo(() => {
    if (!booking || !user?.vehicles) return null;
    const bookingPlate = normalizePlate(booking.licensePlate);
    return (
      user.vehicles.find(
        (vehicle) => normalizePlate(vehicle.licensePlate) === bookingPlate,
      ) ?? null
    );
  }, [booking, user?.vehicles]);

  const hoursUntilOldSchedule = useMemo(() => {
    if (!booking?.scheduledTime) return null;
    const scheduledAt = new Date(booking.scheduledTime).getTime();
    if (!Number.isFinite(scheduledAt)) return null;
    return (scheduledAt - Date.now()) / (1000 * 60 * 60);
  }, [booking?.scheduledTime]);

  const hardBlocker = useMemo(() => {
    if (!booking) return null;
    if (!RESCHEDULABLE_STATUSES.includes(booking.status)) {
      return "Chỉ có thể thay đổi lịch hẹn ở trạng thái Pending hoặc Confirmed.";
    }
    if (hoursUntilOldSchedule != null && hoursUntilOldSchedule < 2) {
      return "Chỉ có thể thay đổi lịch hẹn trước 2 tiếng so với giờ bắt đầu.";
    }
    if (!userVehicle) {
      return "Không tìm thấy xe này trong hồ sơ của bạn.";
    }
    if (!userVehicle.vehicleTypeId) {
      return "Không xác định được loại xe để kiểm tra lịch trống.";
    }
    return null;
  }, [booking, hoursUntilOldSchedule, userVehicle]);

  const loadInitialData = useCallback(async () => {
    if (!bookingId) {
      setError("Không tìm thấy mã lịch hẹn.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [bookingRes, branchRes] = await Promise.all([
        bookingService.getBookingDetail(bookingId),
        branchService.getBranches(),
      ]);
      setBooking(bookingRes.data);
      setBranches(Array.isArray(branchRes.data) ? branchRes.data : []);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Không thể tải thông tin đổi lịch."));
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  React.useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const calendarDays = useMemo<DayCell[]>(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();
    const days: DayCell[] = [];

    for (let i = 0; i < startDayOfWeek; i++) {
      days.push({ date: null, isPast: false, isLocked: false });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + maxAdvanceDays);

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      date.setHours(0, 0, 0, 0);
      days.push({
        date,
        isPast: date < today,
        isLocked: date > maxDate,
      });
    }

    while (days.length % 7 !== 0) {
      days.push({ date: null, isPast: false, isLocked: false });
    }

    return days;
  }, [currentMonth, maxAdvanceDays]);

  const calendarWeeks = useMemo(() => {
    const weeks: DayCell[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      weeks.push(calendarDays.slice(i, i + 7));
    }
    return weeks;
  }, [calendarDays]);

  const groupedSlots = useMemo(() => {
    const groups: Record<string, TimeSlot[]> = {
      morning: [],
      afternoon: [],
      evening: [],
    };
    for (const slot of slots) {
      const hour = parseInt((slot.timeRange || "00:00").split(":")[0], 10);
      if (hour < 12) groups.morning.push(slot);
      else if (hour < 17) groups.afternoon.push(slot);
      else groups.evening.push(slot);
    }
    return groups;
  }, [slots]);

  const loadSlots = async (date: Date) => {
    if (
      !selectedBranch ||
      !userVehicle?.vehicleTypeId ||
      serviceIds.length === 0
    )
      return;

    setLoadingSlots(true);
    setSlotError(null);
    setSlots([]);
    setSelectedSlot(null);
    try {
      const res = await bookingService.getAvailableSlots(
        selectedBranch.branchId,
        toUTCMidnight(date),
        userVehicle.vehicleTypeId,
        serviceIds,
      );
      setSlots(Array.isArray(res.data) ? res.data : []);
    } catch (e: unknown) {
      setSlotError(getErrorMessage(e, "Không thể tải lịch trống."));
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleBranchSelect = async (branch: BranchDTO) => {
    if (!booking) return;
    setSelectedBranch(branch);
    setServiceIds([]);
    setServiceError(null);
    setSlotError(null);
    setSlots([]);
    setSelectedDate(null);
    setSelectedSlot(null);
    setLoadingServices(true);

    try {
      const res = await bookingService.getServices(branch.branchId);
      const { ids, missing } = matchServiceIds(
        booking.serviceNames ?? [],
        res.data ?? [],
      );
      if (missing.length > 0 || ids.length === 0) {
        setServiceError(
          `Không tìm thấy dịch vụ đã đặt tại chi nhánh này: ${missing.join(", ") || "dịch vụ đã đặt"}.`,
        );
        return;
      }
      setServiceIds(ids);
    } catch (e: unknown) {
      setServiceError(
        getErrorMessage(e, "Không thể tải dịch vụ của chi nhánh."),
      );
    } finally {
      setLoadingServices(false);
    }
  };

  const handleDateSelect = (day: DayCell) => {
    if (
      !day.date ||
      day.isPast ||
      day.isLocked ||
      hardBlocker ||
      serviceError ||
      loadingServices
    ) {
      return;
    }
    setSelectedDate(day.date);
    loadSlots(day.date);
  };

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() - 1);
      return getFirstOfMonth(next);
    });
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + 1);
      return getFirstOfMonth(next);
    });
  };

  const handleSubmit = async () => {
    if (!booking || !selectedDate || !selectedSlot) return;
    const blocker = hardBlocker || serviceError;
    if (blocker) {
      Alert.alert("Không thể đổi lịch", blocker);
      return;
    }

    setSubmitting(true);
    try {
      const res = await bookingService.rescheduleBooking(booking.bookingId, {
        newScheduledDate: toUTCMidnight(selectedDate),
        newSlotId: selectedSlot.slotId,
      });
      const message = /^booking rescheduled successfully\.?$/i.test(
        res.message?.trim() ?? "",
      )
        ? "Đã thay đổi lịch hẹn thành công."
        : res.message || "Đã thay đổi lịch hẹn thành công.";
      Alert.alert("Đổi lịch thành công", message, [
        {
          text: "Đã hiểu",
          onPress: () => router.replace(`/booking/${booking.bookingId}` as any),
        },
      ]);
    } catch (e: unknown) {
      Alert.alert(
        "Không thể đổi lịch",
        getErrorMessage(e, "Vui lòng thử lại."),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const monthYearDisplay = currentMonth.toLocaleDateString("vi-VN", {
    month: "long",
    year: "numeric",
  });
  const selectedDateDisplay = selectedDate
    ? selectedDate.toLocaleDateString("vi-VN", {
        weekday: "long",
        day: "numeric",
        month: "numeric",
        year: "numeric",
      })
    : "";

  const canSubmit =
    !hardBlocker &&
    !serviceError &&
    !loadingServices &&
    !loadingSlots &&
    !!selectedBranch &&
    !!selectedDate &&
    !!selectedSlot;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <Header title="Đổi lịch hẹn" onBack={() => router.back()} />

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator
              size="large"
              color={LuxeColors.primaryContainer}
            />
            <Text style={styles.centerText}>Đang tải...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerState}>
            <Feather name="alert-circle" size={48} color={LuxeColors.outline} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadInitialData}>
              <Text style={styles.retryBtnText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        ) : booking ? (
          <>
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.summaryCard}>
                <View style={styles.summaryTop}>
                  <View>
                    <Text style={styles.summaryLabel}>Mã lịch hẹn</Text>
                    <Text style={styles.summaryId}>#{booking.bookingId}</Text>
                  </View>
                  <View style={styles.plateBadge}>
                    <Text style={styles.plateText}>{booking.licensePlate}</Text>
                  </View>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryMeta}>
                  <View style={styles.summaryMetaItem}>
                    <Feather
                      name="calendar"
                      size={14}
                      color={LuxeColors.onSurfaceVariant}
                    />
                    <Text style={styles.summaryMetaText}>
                      {formatDate(booking.scheduledTime)}
                    </Text>
                  </View>
                  <View style={styles.summaryMetaItem}>
                    <Feather
                      name="clock"
                      size={14}
                      color={LuxeColors.onSurfaceVariant}
                    />
                    <Text style={styles.summaryMetaText}>
                      {formatTime(booking.scheduledTime)}
                    </Text>
                  </View>
                </View>
              </View>

              {hardBlocker ? (
                <View style={styles.noticeError}>
                  <Feather
                    name="alert-triangle"
                    size={18}
                    color={LuxeColors.error}
                  />
                  <Text style={styles.noticeErrorText}>{hardBlocker}</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.sectionTitle}>Chi nhánh đã đặt</Text>
                  <View style={styles.branchList}>
                    {branches.map((branch) => {
                      const isSelected =
                        selectedBranch?.branchId === branch.branchId;
                      return (
                        <TouchableOpacity
                          key={branch.branchId}
                          style={[
                            styles.branchCard,
                            isSelected && styles.branchCardSelected,
                          ]}
                          onPress={() => handleBranchSelect(branch)}
                          activeOpacity={0.8}
                        >
                          <View
                            style={[
                              styles.radio,
                              isSelected && styles.radioSelected,
                            ]}
                          >
                            {isSelected && <View style={styles.radioInner} />}
                          </View>
                          <View style={styles.branchIconWrap}>
                            <Feather
                              name="map-pin"
                              size={20}
                              color={
                                isSelected
                                  ? LuxeColors.primaryContainer
                                  : LuxeColors.onSurfaceVariant
                              }
                            />
                          </View>
                          <View style={styles.branchInfo}>
                            <Text style={styles.branchName} numberOfLines={1}>
                              {branch.name}
                            </Text>
                            {!!branch.address && (
                              <Text
                                style={styles.branchAddress}
                                numberOfLines={2}
                              >
                                {branch.address}
                              </Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {loadingServices && (
                    <View style={styles.inlineLoading}>
                      <ActivityIndicator
                        size="small"
                        color={LuxeColors.primaryContainer}
                      />
                      <Text style={styles.centerText}>Đang tải dịch vụ...</Text>
                    </View>
                  )}

                  {serviceError && (
                    <View style={styles.noticeError}>
                      <Feather
                        name="alert-triangle"
                        size={18}
                        color={LuxeColors.error}
                      />
                      <Text style={styles.noticeErrorText}>{serviceError}</Text>
                    </View>
                  )}

                  {selectedBranch &&
                    !loadingServices &&
                    !serviceError &&
                    serviceIds.length > 0 && (
                      <View style={styles.recoveredCard}>
                        <View style={styles.recoveredRow}>
                          <Feather
                            name="truck"
                            size={15}
                            color={LuxeColors.primaryContainer}
                          />
                          <Text style={styles.recoveredText}>
                            {userVehicle?.brand} {userVehicle?.model}
                          </Text>
                        </View>
                        <View style={styles.recoveredRow}>
                          <Feather
                            name="droplet"
                            size={15}
                            color={LuxeColors.primaryContainer}
                          />
                          <Text style={styles.recoveredText}>
                            {booking.serviceNames.join(", ")}
                          </Text>
                        </View>
                      </View>
                    )}

                  {selectedBranch &&
                    !loadingServices &&
                    !serviceError &&
                    serviceIds.length > 0 && (
                      <>
                        <View style={styles.calendarCard}>
                          <Text style={styles.sectionTitle}>Ngày mới</Text>
                          <View style={styles.monthNav}>
                            <TouchableOpacity
                              style={styles.navBtn}
                              onPress={handlePrevMonth}
                            >
                              <Feather
                                name="chevron-left"
                                size={20}
                                color={LuxeColors.onSurface}
                              />
                            </TouchableOpacity>
                            <Text style={styles.monthTitle}>
                              {monthYearDisplay}
                            </Text>
                            <TouchableOpacity
                              style={styles.navBtn}
                              onPress={handleNextMonth}
                            >
                              <Feather
                                name="chevron-right"
                                size={20}
                                color={LuxeColors.onSurface}
                              />
                            </TouchableOpacity>
                          </View>

                          <View style={styles.daysOfWeek}>
                            {DAYS_OF_WEEK.map((day) => (
                              <View key={day} style={styles.dayOfWeekCell}>
                                <Text style={styles.dayOfWeekText}>{day}</Text>
                              </View>
                            ))}
                          </View>

                          <View style={styles.calendarGrid}>
                            {calendarWeeks.map((week, weekIndex) => (
                              <View key={weekIndex} style={styles.calendarWeek}>
                                {week.map((day, dayIndex) => {
                                  const cellKey = `${weekIndex}-${dayIndex}`;
                                  if (!day.date)
                                    return (
                                      <View key={cellKey} style={styles.dayCell} />
                                    );
                                  const isToday =
                                    day.date.toDateString() ===
                                    new Date().toDateString();
                                  const isSelected =
                                    selectedDate?.toDateString() ===
                                    day.date.toDateString();
                                  return (
                                    <TouchableOpacity
                                      key={cellKey}
                                      style={[
                                        styles.dayCell,
                                        day.isPast && styles.dayCellPast,
                                        day.isLocked && styles.dayCellLocked,
                                      ]}
                                      onPress={() => handleDateSelect(day)}
                                      disabled={day.isPast || day.isLocked}
                                    >
                                      <View
                                        style={[
                                          styles.dayPill,
                                          isSelected && styles.dayPillSelected,
                                          isToday &&
                                            !isSelected &&
                                            styles.dayPillToday,
                                        ]}
                                      >
                                        <Text
                                          style={[
                                            styles.dayNumber,
                                            (day.isPast || day.isLocked) &&
                                              styles.dayTextMuted,
                                            isToday &&
                                              !isSelected &&
                                              styles.dayTextToday,
                                            isSelected && styles.dayTextSelected,
                                          ]}
                                        >
                                          {day.date.getDate()}
                                        </Text>
                                      </View>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            ))}
                          </View>
                        </View>

                        {selectedDate && (
                          <View style={styles.slotsSection}>
                            <View style={styles.slotsHeader}>
                              <Text style={styles.sectionTitle}>Giờ mới</Text>
                              <Text style={styles.selectedDateLabel}>
                                {selectedDateDisplay}
                              </Text>
                            </View>

                            {loadingSlots ? (
                              <View style={styles.inlineLoading}>
                                <ActivityIndicator
                                  size="small"
                                  color={LuxeColors.primaryContainer}
                                />
                                <Text style={styles.centerText}>
                                  Đang tải lịch trống...
                                </Text>
                              </View>
                            ) : slotError ? (
                              <View style={styles.noticeError}>
                                <Feather
                                  name="alert-triangle"
                                  size={18}
                                  color={LuxeColors.error}
                                />
                                <Text style={styles.noticeErrorText}>
                                  {slotError}
                                </Text>
                              </View>
                            ) : slots.length === 0 ? (
                              <View style={styles.emptySlotsCard}>
                                <Feather
                                  name="calendar"
                                  size={36}
                                  color={LuxeColors.outlineVariant}
                                />
                                <Text style={styles.emptySlotsTitle}>
                                  Không có lịch trống
                                </Text>
                                <Text style={styles.emptySlotsText}>
                                  Vui lòng chọn ngày khác.
                                </Text>
                              </View>
                            ) : (
                              <>
                                <View style={styles.slotsSummary}>
                                  <Feather name="zap" size={16} color="#F59E0B" />
                                  <Text style={styles.slotsSummaryText}>
                                    {
                                      slots.filter((slot) => slot.isAvailable)
                                        .length
                                    }{" "}
                                    khung giờ trống
                                  </Text>
                                </View>

                                {Object.entries(groupedSlots).map(
                                  ([period, periodSlots]) =>
                                    periodSlots.length > 0 ? (
                                      <View key={period} style={styles.timePeriod}>
                                        <Text style={styles.periodLabel}>
                                          {PERIOD_LABEL[period] || period}
                                        </Text>
                                        <View style={styles.timeSlotsGrid}>
                                          {periodSlots.map((slot) => {
                                            const isSelected =
                                              selectedSlot?.slotId ===
                                              slot.slotId;
                                            return (
                                              <TouchableOpacity
                                                key={slot.slotId}
                                                style={[
                                                  styles.timeSlot,
                                                  !slot.isAvailable &&
                                                    styles.timeSlotUnavailable,
                                                  isSelected &&
                                                    styles.timeSlotSelected,
                                                ]}
                                                onPress={() =>
                                                  slot.isAvailable &&
                                                  setSelectedSlot(slot)
                                                }
                                                disabled={!slot.isAvailable}
                                              >
                                                <Text
                                                  style={[
                                                    styles.timeSlotText,
                                                    !slot.isAvailable &&
                                                      styles.timeSlotTextUnavailable,
                                                    isSelected &&
                                                      styles.timeSlotTextSelected,
                                                  ]}
                                                >
                                                  {slot.timeRange}
                                                </Text>
                                              </TouchableOpacity>
                                            );
                                          })}
                                        </View>
                                      </View>
                                    ) : null,
                                )}
                              </>
                            )}
                          </View>
                        )}
                      </>
                    )}

                </>
              )}

              <View style={styles.bottomSpacer} />
            </ScrollView>

            <BottomActionBar
              title="XÁC NHẬN ĐỔI LỊCH"
              onPress={handleSubmit}
              loading={submitting}
              disabled={!canSubmit}
              icon="check"
            />
          </>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: LuxeColors.background },
  safeArea: { flex: 1 },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24,
  },
  centerText: { fontSize: 14, color: LuxeColors.onSurfaceVariant },
  errorText: { fontSize: 14, color: LuxeColors.error, textAlign: "center" },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: LuxeColors.primaryContainer,
    borderRadius: LuxeBorderRadius.lg,
  },
  retryBtnText: { fontSize: 14, fontWeight: "700", color: "#ffffff" },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12 },
  summaryCard: {
    backgroundColor: "#ffffff",
    borderRadius: LuxeBorderRadius.xl,
    padding: 18,
    marginBottom: 18,
    ...LuxeShadows.md,
  },
  summaryTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryLabel: {
    fontSize: 12,
    color: LuxeColors.onSurfaceVariant,
    marginBottom: 2,
  },
  summaryId: { fontSize: 26, fontWeight: "800", color: LuxeColors.onSurface },
  plateBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: LuxeBorderRadius.lg,
    backgroundColor: LuxeColors.primaryContainer + "16",
  },
  plateText: { fontSize: 13, fontWeight: "800", color: LuxeColors.primary },
  summaryDivider: {
    height: 1,
    backgroundColor: LuxeColors.outlineVariant + "30",
    marginVertical: 14,
  },
  summaryMeta: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  summaryMetaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  summaryMetaText: {
    fontSize: 14,
    fontWeight: "600",
    color: LuxeColors.onSurface,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: LuxeColors.onSurface,
    marginBottom: 12,
  },
  noticeError: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: LuxeColors.errorContainer,
    borderRadius: LuxeBorderRadius.lg,
    padding: 14,
    marginBottom: 16,
  },
  noticeErrorText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    color: LuxeColors.onErrorContainer,
  },
  branchList: { gap: 10, marginBottom: 16 },
  branchCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#ffffff",
    borderRadius: LuxeBorderRadius.xl,
    padding: 14,
    borderWidth: 2,
    borderColor: "transparent",
    ...LuxeShadows.sm,
  },
  branchCardSelected: {
    borderColor: LuxeColors.primaryContainer,
    backgroundColor: LuxeColors.primaryContainer + "08",
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: LuxeColors.outlineVariant,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: { borderColor: LuxeColors.primaryContainer },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: LuxeColors.primaryContainer,
  },
  branchIconWrap: {
    width: 40,
    height: 40,
    borderRadius: LuxeBorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: LuxeColors.surfaceContainer,
  },
  branchInfo: { flex: 1 },
  branchName: { fontSize: 15, fontWeight: "800", color: LuxeColors.onSurface },
  branchAddress: {
    fontSize: 12,
    lineHeight: 17,
    color: LuxeColors.onSurfaceVariant,
    marginTop: 3,
  },
  inlineLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 18,
  },
  recoveredCard: {
    backgroundColor: "#ffffff",
    borderRadius: LuxeBorderRadius.xl,
    padding: 14,
    gap: 9,
    marginBottom: 16,
    ...LuxeShadows.sm,
  },
  recoveredRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  recoveredText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: LuxeColors.onSurface,
  },
  calendarCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    ...LuxeShadows.sm,
  },
  monthNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: LuxeColors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  monthTitle: { fontSize: 17, fontWeight: "800", color: LuxeColors.onSurface },
  daysOfWeek: { flexDirection: "row", marginBottom: 8 },
  dayOfWeekCell: { flex: 1, alignItems: "center", paddingVertical: 6 },
  dayOfWeekText: {
    fontSize: 12,
    fontWeight: "700",
    color: LuxeColors.onSurfaceVariant,
  },
  calendarGrid: { gap: 0 },
  calendarWeek: { flexDirection: "row" },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: LuxeBorderRadius.lg,
  },
  dayCellPast: { opacity: 0.3 },
  dayCellLocked: { opacity: 0.4 },
  dayPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  dayPillToday: {
    backgroundColor: LuxeColors.surfaceContainer,
    borderWidth: 1,
    borderColor: LuxeColors.outlineVariant,
    borderRadius: 18,
  },
  dayPillSelected: {
    backgroundColor: LuxeColors.primaryContainer,
    borderRadius: 18,
  },
  dayNumber: {
    fontSize: 15,
    lineHeight: 18,
    color: LuxeColors.onSurface,
    textAlign: "center",
    includeFontPadding: false,
  },
  dayTextMuted: { color: LuxeColors.onSurfaceVariant },
  dayTextToday: { color: LuxeColors.primaryContainer, fontWeight: "800" },
  dayTextSelected: { color: "#ffffff", fontWeight: "800" },
  slotsSection: { marginBottom: 16 },
  slotsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  selectedDateLabel: {
    flex: 1,
    textAlign: "right",
    fontSize: 12,
    color: LuxeColors.primaryContainer,
    fontWeight: "700",
  },
  emptySlotsCard: {
    alignItems: "center",
    padding: 24,
    backgroundColor: "#ffffff",
    borderRadius: LuxeBorderRadius.xl,
    gap: 8,
    ...LuxeShadows.sm,
  },
  emptySlotsTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: LuxeColors.onSurface,
  },
  emptySlotsText: {
    fontSize: 13,
    color: LuxeColors.onSurfaceVariant,
    textAlign: "center",
  },
  slotsSummary: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F59E0B15",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: LuxeBorderRadius.lg,
    gap: 8,
    marginBottom: 16,
    ...LuxeShadows.sm,
  },
  slotsSummaryText: { fontSize: 13, fontWeight: "800", color: "#F59E0B" },
  timePeriod: { marginBottom: 16 },
  periodLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: LuxeColors.onSurfaceVariant,
    textTransform: "uppercase",
    letterSpacing: 0,
    marginBottom: 10,
  },
  timeSlotsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  timeSlot: {
    width: "48%",
    backgroundColor: "#ffffff",
    borderRadius: LuxeBorderRadius.lg,
    padding: 14,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
    ...LuxeShadows.sm,
  },
  timeSlotUnavailable: {
    backgroundColor: LuxeColors.surfaceContainer,
    opacity: 0.6,
  },
  timeSlotSelected: {
    backgroundColor: LuxeColors.primaryContainer,
    borderColor: LuxeColors.primaryContainer,
  },
  timeSlotText: {
    fontSize: 14,
    fontWeight: "800",
    color: LuxeColors.onSurface,
  },
  timeSlotTextUnavailable: {
    color: LuxeColors.onSurfaceVariant,
    textDecorationLine: "line-through",
  },
  timeSlotTextSelected: { color: "#ffffff" },
  bottomSpacer: { height: 116 },
});
