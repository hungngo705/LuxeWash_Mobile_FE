/**
 * Advance Booking Flow - Step 3: Select Date & Time
 * Bold professional redesign with solid white cards
 */

import { BottomActionBar } from "@/components/ui/BottomActionBar";
import { Header } from "@/components/ui/Header";
import { ProgressSteps } from "@/components/ui/ProgressSteps";
import {
    LuxeColors,
    LuxeShadows,
    MembershipConfig,
} from "@/constants/luxeTheme";
import { useAuth } from "@/contexts/AuthContext";
import { bookingService, type TimeSlot } from "@/services/api";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const DAYS_OF_WEEK = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

const toLocalDateString = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};



interface DayCell {
  date: Date | null;
  isPast: boolean;
  isLocked: boolean;
}

const PERIOD_LABEL: Record<string, string> = {
  morning: "Sáng",
  afternoon: "Chiều",
  evening: "Tối",
};

export default function SelectDateScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams();

  const serviceIdParam = parseInt(params.serviceId as string) || 0;
  const serviceNameParam = (params.serviceName as string) || "";
  const servicePriceParam = parseInt(params.servicePrice as string) || 0;
  const membershipDiscountParam =
    parseFloat(params.membershipDiscount as string) || 0;
  const vehicleIdParam = (params.vehicleId as string) || "";
  const vehicleDbIdParam = (params.vehicleDbId as string) || "";
  const vehicleTypeIdParam = parseInt(params.vehicleTypeId as string) || 1;
  const vehicleBrandParam = (params.vehicleBrand as string) || "";
  const branchIdParam = parseInt(params.branchId as string) || 1;
  const branchNameParam = (params.branchName as string) || "LuxeWash";

  const membershipInfo = user
    ? MembershipConfig[user.membershipTier]
    : MembershipConfig.standard;
  const maxAdvanceDays = membershipInfo.maxAdvanceDays;

  const getFirstOfMonth = (d: Date) => {
    const next = new Date(d);
    next.setDate(1);
    return next;
  };

  const [currentMonth, setCurrentMonth] = useState(getFirstOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const loadSlots = async (date: Date) => {
    setLoadingSlots(true);
    setSlots([]);
    setSelectedSlot(null);
    try {
      const targetDateStr = toLocalDateString(date);
      const res = await bookingService.getAvailableSlots(
        branchIdParam,
        targetDateStr,
        vehicleTypeIdParam,
        [serviceIdParam],
      );
      if (res.statusCode === 200 && res.data) {
        setSlots(res.data);
      } else {
        setSlots([]);
      }
    } catch (e) {
      alert("Không thể tải lịch trống");
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => {
      const next = new Date(prev);
      next.setDate(1);
      next.setMonth(next.getMonth() - 1);
      return next;
    });
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => {
      const next = new Date(prev);
      next.setDate(1);
      next.setMonth(next.getMonth() + 1);
      return next;
    });
  };

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
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + maxAdvanceDays);

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      days.push({
        date,
        isPast: date < today,
        isLocked: date >= today && date > maxDate,
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

  const handleDateSelect = (day: DayCell) => {
    if (!day.date || day.isPast || day.isLocked) return;
    setSelectedDate(day.date);
    setSelectedSlot(null);
    loadSlots(day.date);
  };

  const handleContinue = () => {
    if (!selectedDate || !selectedSlot) return;
    router.push({
      pathname: "/booking/confirmation",
      params: {
        serviceId: String(serviceIdParam),
        serviceName: serviceNameParam,
        servicePrice: String(servicePriceParam),
        membershipDiscount: String(membershipDiscountParam),
        vehicleId: vehicleIdParam,
        vehicleDbId: vehicleDbIdParam,
        vehicleTypeId: String(vehicleTypeIdParam),
        vehicleBrand: vehicleBrandParam,
        date: toLocalDateString(selectedDate),
        slotId: String(selectedSlot.slotId),
        timeRange: selectedSlot.timeRange,
        branchId: String(branchIdParam),
        branchName: branchNameParam,
      },
    });
  };

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

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <Header title="Đặt lịch rửa xe" onBack={() => router.back()} />

        <ProgressSteps
          steps={[
            { label: "Chi nhánh" },
            { label: "Xe" },
            { label: "Dịch vụ" },
            { label: "Ngày" },
            { label: "Xác nhận" },
          ]}
          currentStep={3}
        />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Summary */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Feather
                name="map-pin"
                size={16}
                color={LuxeColors.primaryContainer}
              />
              <Text style={styles.summaryText}>{branchNameParam}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Feather
                name="truck"
                size={16}
                color={LuxeColors.primaryContainer}
              />
              <Text style={styles.summaryText}>
                {vehicleBrandParam} - {vehicleIdParam}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Feather
                name="droplet"
                size={16}
                color={LuxeColors.primaryContainer}
              />
              <Text style={styles.summaryText}>{serviceNameParam}</Text>
            </View>
          </View>

          {/* Calendar */}
          <View style={styles.calendarCard}>
            <Text style={styles.sectionTitle}>Chọn ngày</Text>
            <View style={styles.monthNav}>
              <TouchableOpacity style={styles.navBtn} onPress={handlePrevMonth}>
                <Feather
                  name="chevron-left"
                  size={20}
                  color={LuxeColors.onSurface}
                />
              </TouchableOpacity>
              <Text style={styles.monthTitle}>{monthYearDisplay}</Text>
              <TouchableOpacity style={styles.navBtn} onPress={handleNextMonth}>
                <Feather
                  name="chevron-right"
                  size={20}
                  color={LuxeColors.onSurface}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.daysOfWeek}>
              {DAYS_OF_WEEK.map((day, index) => (
                <View key={index} style={styles.dayOfWeekCell}>
                  <Text style={styles.dayOfWeekText}>{day}</Text>
                </View>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {calendarWeeks.map((week, weekIndex) => (
                <View key={weekIndex} style={styles.calendarWeek}>
                  {week.map((day, dayIndex) => {
                    const cellKey = `${weekIndex}-${dayIndex}`;
                    if (!day.date) {
                      return <View key={cellKey} style={styles.dayCell} />;
                    }
                    const isToday =
                      day.date.toDateString() === new Date().toDateString();
                    const isSelected =
                      selectedDate?.toDateString() === day.date.toDateString();
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
                            isToday && !isSelected && styles.dayPillToday,
                          ]}
                        >
                          <Text
                            style={[
                              styles.dayNumber,
                              day.isPast && styles.dayTextPast,
                              day.isLocked && styles.dayTextLocked,
                              isSelected && styles.dayTextSelected,
                              isToday && !isSelected && styles.dayTextToday,
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

          {/* Time Slots */}
          {selectedDate && (
            <View style={styles.slotsSection}>
              <View style={styles.slotsSectionHeader}>
                <Text style={styles.sectionTitle}>Chọn giờ</Text>
                <Text style={styles.selectedDateLabel}>
                  {selectedDateDisplay}
                </Text>
              </View>

              {loadingSlots ? (
                <View style={styles.loadingSlots}>
                  <ActivityIndicator
                    size="small"
                    color={LuxeColors.primaryContainer}
                  />
                  <Text style={styles.loadingText}>Đang tải lịch trống...</Text>
                </View>
              ) : slots.length === 0 ? (
                <View style={styles.noSlotsCard}>
                  <Feather
                    name="calendar"
                    size={36}
                    color={LuxeColors.outlineVariant}
                  />
                  <Text style={styles.noSlotsText}>
                    Không có lịch trống cho ngày này
                  </Text>
                  <Text style={styles.noSlotsSubtext}>
                    Vui lòng chọn ngày khác
                  </Text>
                </View>
              ) : (
                <>
                  <View style={styles.slotsSummary}>
                    <Feather name="zap" size={16} color="#F59E0B" />
                    <Text style={styles.slotsSummaryText}>
                      {slots.filter((s) => s.isAvailable).length} khung giờ
                      trống
                    </Text>
                  </View>

                  {Object.entries(groupedSlots).map(([period, periodSlots]) =>
                    periodSlots.length > 0 ? (
                      <View key={period} style={styles.timePeriod}>
                        <Text style={styles.periodLabel}>
                          {PERIOD_LABEL[period] || period}
                        </Text>
                        <View style={styles.timeSlotsGrid}>
                          {periodSlots.map((slot) => {
                            const isSelected =
                              selectedSlot?.slotId === slot.slotId;
                            return (
                              <TouchableOpacity
                                key={slot.slotId}
                                style={[
                                  styles.timeSlot,
                                  !slot.isAvailable &&
                                    styles.timeSlotUnavailable,
                                  isSelected && styles.timeSlotSelected,
                                ]}
                                onPress={() =>
                                  slot.isAvailable && setSelectedSlot(slot)
                                }
                                disabled={!slot.isAvailable}
                              >
                                <Text
                                  style={[
                                    styles.timeSlotText,
                                    !slot.isAvailable &&
                                      styles.timeSlotTextUnavailable,
                                    isSelected && styles.timeSlotTextSelected,
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

          {/* Membership info */}
          <View style={styles.membershipCard}>
            <View style={styles.membershipIconWrap}>
              <Feather
                name="star"
                size={20}
                color={LuxeColors.primaryContainer}
              />
            </View>
            <View style={styles.membershipContent}>
              <Text style={styles.membershipTitle}>
                Đặc quyền {membershipInfo.nameVi}
              </Text>
              <Text style={styles.membershipDesc}>
                Đặt trước tối đa {maxAdvanceDays} ngày
              </Text>
            </View>
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>

        <BottomActionBar
          title="TIẾP THEO"
          onPress={handleContinue}
          disabled={!selectedDate || !selectedSlot}
          icon="arrow-right"
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: LuxeColors.background },
  safeArea: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8 },
  summaryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    gap: 8,
    ...LuxeShadows.sm,
  },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  summaryText: {
    fontSize: 13,
    color: LuxeColors.onSurface,
    fontWeight: "500",
    flex: 1,
  },
  calendarCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    ...LuxeShadows.sm,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: LuxeColors.onSurface,
    marginBottom: 12,
  },
  slotsSection: {},
  slotsSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  selectedDateLabel: {
    fontSize: 12,
    color: LuxeColors.primaryContainer,
    fontWeight: "600",
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
  monthTitle: { fontSize: 17, fontWeight: "700", color: LuxeColors.onSurface },
  daysOfWeek: { flexDirection: "row", marginBottom: 8 },
  dayOfWeekCell: { flex: 1, alignItems: "center", paddingVertical: 6 },
  dayOfWeekText: {
    fontSize: 12,
    fontWeight: "600",
    color: LuxeColors.onSurfaceVariant,
  },
  calendarGrid: { gap: 0 },
  calendarWeek: { flexDirection: "row" },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
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
  dayTextPast: { color: LuxeColors.onSurfaceVariant },
  dayTextLocked: { color: LuxeColors.onSurfaceVariant },
  dayTextSelected: { color: "#ffffff", fontWeight: "700" },
  dayTextToday: { color: LuxeColors.primaryContainer, fontWeight: "700" },
  loadingSlots: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    gap: 8,
  },
  loadingText: { fontSize: 14, color: LuxeColors.onSurfaceVariant },
  noSlotsCard: {
    alignItems: "center",
    padding: 24,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    gap: 8,
    ...LuxeShadows.sm,
  },
  noSlotsText: { fontSize: 14, fontWeight: "600", color: LuxeColors.onSurface },
  noSlotsSubtext: { fontSize: 13, color: LuxeColors.onSurfaceVariant },
  slotsSummary: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF4DC",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
    ...LuxeShadows.sm,
    elevation: 0,
    shadowOpacity: 0,
  },
  slotsSummaryText: { fontSize: 13, fontWeight: "700", color: "#F59E0B" },
  timePeriod: { marginBottom: 16 },
  periodLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: LuxeColors.onSurfaceVariant,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
  },
  timeSlotsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  timeSlot: {
    width: "48%",
    backgroundColor: "#ffffff",
    borderRadius: 14,
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
    fontWeight: "700",
    color: LuxeColors.onSurface,
  },
  timeSlotTextUnavailable: {
    color: LuxeColors.onSurfaceVariant,
    textDecorationLine: "line-through",
  },
  timeSlotTextSelected: { color: "#ffffff" },
  membershipCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    gap: 14,
    ...LuxeShadows.sm,
  },
  membershipIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: LuxeColors.primaryContainer + "15",
    alignItems: "center",
    justifyContent: "center",
  },
  membershipContent: { flex: 1 },
  membershipTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: LuxeColors.onSurface,
    marginBottom: 2,
  },
  membershipDesc: { fontSize: 13, color: LuxeColors.onSurfaceVariant },
});
