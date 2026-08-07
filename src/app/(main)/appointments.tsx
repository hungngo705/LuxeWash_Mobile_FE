/**
 * Appointments Screen
 * Bold professional redesign with solid white booking cards and cleaner tabs
 */

import {
    LuxeColors,
    LuxeShadows
} from "@/constants/luxeTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useOverloadSuggestions } from "@/contexts/OverloadSuggestionContext";
import { bookingService, type MyBookingItem } from "@/services/api";
import {
    formatDate,
    formatTime,
    formatVnd,
    getDateKey,
    getGreeting,
} from "@/utils/format";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Image,
    Modal,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { Calendar, DateData } from "react-native-calendars";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

type TabType = "all" | "pending" | "completed" | "cancelled";

const statusMap: Record<string, string> = {
  Pending: "pending",
  CheckedIn: "pending",
  Processing: "pending",
  Completed: "completed",
  Cancelled: "cancelled",
  CancelledBySystem: "cancelled",
  NoShow: "cancelled",
  Delayed: "pending",
};

const STATUS_LABEL: Record<string, string> = {
  completed: "Hoàn thành",
  pending: "Đang chờ",
  cancelled: "Đã hủy",
};

const { width: SCREEN_W } = Dimensions.get("window");

const getStatusStyle = (mapped: string) => {
  switch (mapped) {
    case "completed":
      return {
        bg: LuxeColors.primary + "12",
        text: LuxeColors.primary,
        dot: LuxeColors.primary,
      };
    case "pending":
      return {
        bg: LuxeColors.tertiary + "12",
        text: LuxeColors.tertiary,
        dot: LuxeColors.tertiary,
      };
    case "cancelled":
      return {
        bg: LuxeColors.surfaceContainer,
        text: LuxeColors.onSurfaceVariant,
        dot: LuxeColors.outline,
      };
    default:
      return {
        bg: LuxeColors.surfaceContainer,
        text: LuxeColors.onSurfaceVariant,
        dot: LuxeColors.outline,
      };
  }
};

export default function AppointmentsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    suggestionsByBookingId,
    discoverSuggestions,
    openSuggestionForBooking,
    revision: overloadRevision,
  } = useOverloadSuggestions();
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [bookings, setBookings] = useState<MyBookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const [selectedCalDate, setSelectedCalDate] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    try {
      const res = await bookingService.getMyBookings();
      if (res.statusCode === 200 && res.data) {
        const nextBookings = Array.isArray(res.data) ? res.data : [];
        setBookings(nextBookings);
        void discoverSuggestions(nextBookings);
      } else {
        setBookings([]);
      }
    } catch {
      setBookings([]);
    }
  }, [discoverSuggestions]);

  useEffect(() => {
    if (overloadRevision > 0) {
      void loadBookings();
    }
  }, [loadBookings, overloadRevision]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const doLoad = async () => {
        setLoading(true);
        await loadBookings();
        if (isActive) {
          setLoading(false);
        }
      };

      doLoad();
      return () => {
        isActive = false;
      };
    }, [loadBookings]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadBookings();
    setRefreshing(false);
  }, [loadBookings]);

  const filteredBookings = useMemo(() => {
    let result = (bookings || []).filter((b) => {
      if (!b) return false;
      if (activeTab === "all") return true;
      const mapped = statusMap[b.status] || b.status;
      if (activeTab === "pending") return mapped === "pending";
      if (activeTab === "completed") return mapped === "completed";
      if (activeTab === "cancelled") return mapped === "cancelled";
      return true;
    });

    if (viewMode === "calendar" && selectedCalDate) {
      result = result.filter(
        (b) =>
          b.scheduledTime && getDateKey(b.scheduledTime) === selectedCalDate,
      );
    }

    result.sort((a, b) => {
      const dateA = a.scheduledTime ? new Date(a.scheduledTime).getTime() : 0;
      const dateB = b.scheduledTime ? new Date(b.scheduledTime).getTime() : 0;
      return dateB - dateA;
    });

    return result;
  }, [bookings, activeTab, viewMode, selectedCalDate]);

  const markedDates = useMemo(() => {
    const marks: Record<
      string,
      {
        marked: boolean;
        dotColor: string;
        selected?: boolean;
        selectedColor?: string;
      }
    > = {};
    bookings.forEach((b) => {
      if (!b.scheduledTime) return;
      const key = getDateKey(b.scheduledTime);
      const mapped = statusMap[b.status] || b.status;
      marks[key] = {
        marked: true,
        dotColor:
          mapped === "completed"
            ? LuxeColors.primary
            : mapped === "pending"
              ? LuxeColors.tertiary
              : LuxeColors.outline,
      };
    });
    if (selectedCalDate) {
      marks[selectedCalDate] = {
        ...(marks[selectedCalDate] || {}),
        selected: true,
        selectedColor: LuxeColors.primary,
      };
    }
    return marks;
  }, [bookings, selectedCalDate]);

  const handleApplyDateFilter = (day: DateData, isStart: boolean) => {
    if (isStart) {
      setStartDate(day.dateString);
      setShowStartPicker(false);
    } else {
      setEndDate(day.dateString);
      setShowEndPicker(false);
    }
  };

  const clearDateFilter = () => {
    setStartDate(null);
    setEndDate(null);
  };

  const handleBookNow = () => router.push("/booking/select-branch");

  const greeting = getGreeting();
  const now = new Date();
  const today = `${now.getDate().toString().padStart(2, "0")}/${(now.getMonth() + 1).toString().padStart(2, "0")}/${now.getFullYear()}`;

  const renderBookingCard = ({ item }: { item: MyBookingItem }) => {
    const mapped = statusMap[item.status] || item.status;
    const statusStyle = getStatusStyle(mapped);
    const date = item.scheduledTime ? formatDate(item.scheduledTime) : "";
    const time = item.scheduledTime ? formatTime(item.scheduledTime) : "";
    const vehiclePlate = item.licensePlate || "";
    const serviceName = item.serviceNames?.join(", ") || item.serviceName || "";
    const userVehicle = user?.vehicles?.find(
      (v) => v.licensePlate === vehiclePlate,
    );
    const vehicleImage = userVehicle?.imageUrl;
    const stationImages = [
      item.checkInImageUrl
        ? { key: "check-in", label: "Check-in", url: item.checkInImageUrl }
        : null,
      item.checkOutImageUrl
        ? { key: "check-out", label: "Check-out", url: item.checkOutImageUrl }
        : null,
    ].filter((image): image is { key: string; label: string; url: string } => Boolean(image));
    const overloadSuggestion = suggestionsByBookingId[item.bookingId];

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/booking/${String(item.bookingId)}` as any)}
        activeOpacity={0.7}
      >
        <View
          style={[styles.cardAccentBar, { backgroundColor: statusStyle.dot }]}
        />
        <View style={styles.cardBody}>
          {!!overloadSuggestion && (
            <TouchableOpacity
              style={styles.relocationBanner}
              activeOpacity={0.85}
              onPress={() => void openSuggestionForBooking(item)}
            >
              <View style={styles.relocationBannerIcon}>
                <Feather name="alert-circle" size={16} color="#DC2626" />
              </View>
              <View style={styles.relocationBannerContent}>
                <Text style={styles.relocationBannerTitle}>
                  Chi nhánh quá tải — có đề xuất dời lịch
                </Text>
                <Text style={styles.relocationBannerSubtitle} numberOfLines={1}>
                  Đổi sang {overloadSuggestion.suggestedBranchName} và nhận voucher
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color="#DC2626" />
            </TouchableOpacity>
          )}
          <View style={styles.cardHeader}>
            <View style={styles.dateTimeRow}>
              <Feather
                name="calendar"
                size={13}
                color={LuxeColors.onSurfaceVariant}
              />
              <Text style={styles.cardDate}>{date}</Text>
              <Text style={styles.dateSep}>•</Text>
              <Feather
                name="clock"
                size={13}
                color={LuxeColors.onSurfaceVariant}
              />
              <Text style={styles.cardTime}>{time}</Text>
            </View>
            <View
              style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}
            >
              <View
                style={[styles.statusDot, { backgroundColor: statusStyle.dot }]}
              />
              <Text style={[styles.statusText, { color: statusStyle.text }]}>
                {STATUS_LABEL[mapped] || item.status}
              </Text>
            </View>
          </View>

          <View style={styles.vehicleRow}>
            {vehicleImage ? (
              <Image
                source={{ uri: vehicleImage }}
                style={styles.vehicleImage}
              />
            ) : (
              <View
                style={[styles.vehicleImage, styles.vehicleImagePlaceholder]}
              >
                <Feather name="truck" size={28} color={LuxeColors.outline} />
              </View>
            )}
            <View style={styles.vehicleInfo}>
              <Text style={styles.serviceName} numberOfLines={1}>
                {serviceName}
              </Text>
              <View style={styles.plateBadge}>
                <Text style={styles.plateText}>{vehiclePlate}</Text>
              </View>
            </View>
            <Feather
              name="chevron-right"
              size={20}
              color={LuxeColors.outline}
            />
          </View>

          {stationImages.length > 0 && (
            <View style={styles.stationPhotosSection}>
              <View style={styles.stationPhotosTitleRow}>
                <Feather name="camera" size={13} color={LuxeColors.onSurfaceVariant} />
                <Text style={styles.stationPhotosTitle}>Ảnh tại trạm</Text>
              </View>
              <View style={styles.stationPhotosRow}>
                {stationImages.map((stationImage) => (
                  <View key={stationImage.key} style={styles.stationPhotoWrap}>
                    <Image
                      source={{ uri: stationImage.url }}
                      style={styles.stationPhoto}
                      resizeMode="cover"
                    />
                    <View style={styles.stationPhotoLabelWrap}>
                      <Text style={styles.stationPhotoLabel}>{stationImage.label}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.cardDivider} />

          <View style={styles.priceRow}>
            <View style={styles.priceRight}>
              <Text style={styles.priceLabel}>Thành tiền</Text>
              <Text
                style={[
                  styles.finalPrice,
                  mapped === "cancelled" && styles.finalPriceCancelled,
                ]}
              >
                {formatVnd(item.finalAmount || 0)}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const tabs: { key: TabType; label: string }[] = [
    { key: "all", label: "Tất cả" },
    { key: "pending", label: "Đang chờ" },
    { key: "completed", label: "Hoàn thành" },
    { key: "cancelled", label: "Đã hủy" },
  ];

  const ListHeader = () => (
    <View>
      <View style={styles.greetingRow}>
        <View>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.todayDate}>{today}</Text>
        </View>
        <TouchableOpacity
          style={styles.viewToggle}
          onPress={() =>
            setViewMode((v) => (v === "list" ? "calendar" : "list"))
          }
        >
          <Feather
            name={viewMode === "list" ? "calendar" : "list"}
            size={18}
            color={LuxeColors.primaryContainer}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab.key && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.dateFilterRow}>
        <TouchableOpacity
          style={[styles.dateChip, startDate && styles.dateChipActive]}
          onPress={() => setShowStartPicker(true)}
        >
          <Feather
            name="calendar"
            size={14}
            color={
              startDate
                ? LuxeColors.primaryContainer
                : LuxeColors.onSurfaceVariant
            }
          />
          <Text
            style={[
              styles.dateChipText,
              startDate && styles.dateChipTextActive,
            ]}
          >
            {startDate ? formatDate(startDate) : "Từ ngày"}
          </Text>
        </TouchableOpacity>
        <Text style={styles.dateSep}>—</Text>
        <TouchableOpacity
          style={[styles.dateChip, endDate && styles.dateChipActive]}
          onPress={() => setShowEndPicker(true)}
        >
          <Feather
            name="calendar"
            size={14}
            color={
              endDate
                ? LuxeColors.primaryContainer
                : LuxeColors.onSurfaceVariant
            }
          />
          <Text
            style={[styles.dateChipText, endDate && styles.dateChipTextActive]}
          >
            {endDate ? formatDate(endDate) : "Đến ngày"}
          </Text>
        </TouchableOpacity>
        {(startDate || endDate) && (
          <TouchableOpacity
            onPress={clearDateFilter}
            style={styles.clearFilterBtn}
          >
            <Feather name="x" size={16} color={LuxeColors.error} />
          </TouchableOpacity>
        )}
      </View>

      {viewMode === "calendar" && (
        <View style={styles.calendarContainer}>
          <Calendar
            markedDates={markedDates}
            onDayPress={(d) => setSelectedCalDate(d.dateString)}
            markingType="dot"
            theme={{
              backgroundColor: "#fff",
              calendarBackground: "#fff",
              textSectionTitleColor: LuxeColors.onSurfaceVariant,
              selectedDayBackgroundColor: LuxeColors.primary,
              selectedDayTextColor: "#ffffff",
              todayTextColor: LuxeColors.primaryContainer,
              dayTextColor: LuxeColors.onSurface,
              textDisabledColor: LuxeColors.outlineVariant,
              dotColor: LuxeColors.primary,
              arrowColor: LuxeColors.primary,
              monthTextColor: LuxeColors.onSurface,
              textDayFontWeight: "400",
              textMonthFontWeight: "600",
              textDayHeaderFontWeight: "500",
              textDayFontSize: 14,
              textMonthFontSize: 15,
              textDayHeaderFontSize: 12,
            }}
          />
        </View>
      )}

      {!loading && (
        <Text style={styles.resultCount}>
          {filteredBookings.length} lịch hẹn
          {activeTab !== "all" &&
            ` · ${tabs.find((t) => t.key === activeTab)?.label}`}
          {selectedCalDate &&
            viewMode === "calendar" &&
            ` · ${formatDate(selectedCalDate)}`}
        </Text>
      )}
    </View>
  );

  const ListEmpty = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Feather name="calendar" size={40} color={LuxeColors.outlineVariant} />
      </View>
      <Text style={styles.emptyTitle}>Chưa có lịch hẹn nào</Text>
      <Text style={styles.emptySubtitle}>
        {viewMode === "calendar" && selectedCalDate
          ? "Không có lịch hẹn vào ngày này"
          : "Đặt lịch ngay để trải nghiệm dịch vụ"}
      </Text>
      <TouchableOpacity style={styles.emptyActionBtn} onPress={handleBookNow}>
        <Feather name="plus" size={18} color="#fff" />
        <Text style={styles.emptyActionBtnText}>Đặt lịch ngay</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Lịch hẹn</Text>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator
              size="large"
              color={LuxeColors.primaryContainer}
            />
            <Text style={styles.loadingText}>Đang tải lịch hẹn...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredBookings}
            renderItem={renderBookingCard}
            keyExtractor={(item) => String(item.bookingId || "unknown")}
            ListHeaderComponent={ListHeader}
            ListEmptyComponent={ListEmpty}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={LuxeColors.primaryContainer}
                colors={[LuxeColors.primaryContainer]}
              />
            }
          />
        )}
      </SafeAreaView>

      {/* Start Date Picker */}
      <Modal visible={showStartPicker} transparent animationType="fade">
        <SafeAreaProvider style={styles.modalProvider}>
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setShowStartPicker(false)}
          >
            <View style={styles.pickerCard}>
              <Calendar
                current={startDate || undefined}
                onDayPress={(d) => handleApplyDateFilter(d, true)}
                markedDates={
                  startDate
                    ? {
                        [startDate]: {
                          selected: true,
                          selectedColor: LuxeColors.primary,
                        },
                      }
                    : {}
                }
                markingType="dot"
                theme={{
                  backgroundColor: "#fff",
                  calendarBackground: "#fff",
                  selectedDayBackgroundColor: LuxeColors.primary,
                  selectedDayTextColor: "#fff",
                  todayTextColor: LuxeColors.primaryContainer,
                  dayTextColor: LuxeColors.onSurface,
                  textDisabledColor: LuxeColors.outlineVariant,
                  arrowColor: LuxeColors.primary,
                  monthTextColor: LuxeColors.onSurface,
                  textDayFontSize: 14,
                  textMonthFontSize: 15,
                }}
              />
            </View>
          </Pressable>
        </SafeAreaProvider>
      </Modal>

      {/* End Date Picker */}
      <Modal visible={showEndPicker} transparent animationType="fade">
        <SafeAreaProvider style={styles.modalProvider}>
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setShowEndPicker(false)}
          >
            <View style={styles.pickerCard}>
              <Calendar
                current={endDate || undefined}
                onDayPress={(d) => handleApplyDateFilter(d, false)}
                markedDates={
                  endDate
                    ? {
                        [endDate]: {
                          selected: true,
                          selectedColor: LuxeColors.primary,
                        },
                      }
                    : {}
                }
                markingType="dot"
                theme={{
                  backgroundColor: "#fff",
                  calendarBackground: "#fff",
                  selectedDayBackgroundColor: LuxeColors.primary,
                  selectedDayTextColor: "#fff",
                  todayTextColor: LuxeColors.primaryContainer,
                  dayTextColor: LuxeColors.onSurface,
                  textDisabledColor: LuxeColors.outlineVariant,
                  arrowColor: LuxeColors.primary,
                  monthTextColor: LuxeColors.onSurface,
                  textDayFontSize: 14,
                  textMonthFontSize: 15,
                }}
              />
            </View>
          </Pressable>
        </SafeAreaProvider>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: LuxeColors.background },
  safeArea: { flex: 1 },
  modalProvider: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: LuxeColors.outlineVariant + "30",
  },
  headerTitle: { fontSize: 24, fontWeight: "800", color: LuxeColors.onSurface },
  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: LuxeColors.onSurfaceVariant,
  },
  listContent: { paddingHorizontal: 20, paddingBottom: 100 },
  greetingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingTop: 16,
    paddingBottom: 4,
  },
  greeting: {
    fontSize: 16,
    fontWeight: "600",
    color: LuxeColors.onSurfaceVariant,
  },
  todayDate: { fontSize: 13, color: LuxeColors.outline, marginTop: 2 },
  viewToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: LuxeColors.primaryContainer + "18",
    alignItems: "center",
    justifyContent: "center",
  },
  tabs: { flexDirection: "row", gap: 8, paddingVertical: 14, flexWrap: "wrap" },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: LuxeColors.surfaceContainer,
  },
  tabActive: {
    backgroundColor: LuxeColors.primaryContainer + "18",
    borderWidth: 1,
    borderColor: LuxeColors.primaryContainer,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "500",
    color: LuxeColors.onSurfaceVariant,
  },
  tabTextActive: { color: LuxeColors.primaryContainer, fontWeight: "700" },
  dateFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  dateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: LuxeColors.outlineVariant,
    ...LuxeShadows.sm,
  },
  dateChipActive: {
    backgroundColor: LuxeColors.primaryContainer + "12",
    borderColor: LuxeColors.primaryContainer,
  },
  dateChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: LuxeColors.onSurfaceVariant,
  },
  dateChipTextActive: { color: LuxeColors.primaryContainer },
  clearFilterBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
  },
  calendarContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: LuxeColors.outlineVariant,
    ...LuxeShadows.sm,
  },
  resultCount: {
    fontSize: 12,
    color: LuxeColors.onSurfaceVariant,
    marginBottom: 12,
    fontWeight: "500",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    marginBottom: 14,
    flexDirection: "row",
    overflow: "hidden",
    ...LuxeShadows.md,
  },
  cardAccentBar: { width: 5 },
  cardBody: { flex: 1, padding: 16 },
  relocationBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  relocationBannerIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  relocationBannerContent: { flex: 1 },
  relocationBannerTitle: { fontSize: 13, fontWeight: "700", color: "#DC2626" },
  relocationBannerSubtitle: {
    fontSize: 12,
    color: "#B91C1C",
    marginTop: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  dateTimeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardDate: { fontSize: 12, color: LuxeColors.onSurfaceVariant, marginLeft: 4 },
  cardTime: { fontSize: 12, color: LuxeColors.onSurfaceVariant, marginLeft: 2 },
  dateSep: {
    fontSize: 12,
    color: LuxeColors.outlineVariant,
    marginHorizontal: 2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 5,
  },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  statusText: { fontSize: 12, fontWeight: "600" },
  vehicleRow: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  vehicleImage: {
    width: 72,
    height: 72,
    borderRadius: 14,
    backgroundColor: LuxeColors.surfaceContainer,
    flexShrink: 0,
  },
  vehicleImagePlaceholder: { alignItems: "center", justifyContent: "center" },
  vehicleInfo: { flex: 1, marginLeft: 14, justifyContent: "center" },
  serviceName: {
    fontSize: 16,
    fontWeight: "800",
    color: LuxeColors.onSurface,
    marginBottom: 8,
  },
  plateBadge: {
    backgroundColor: LuxeColors.primaryContainer + "18",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  plateText: {
    fontSize: 13,
    fontWeight: "800",
    color: LuxeColors.primaryContainer,
    letterSpacing: 0.5,
  },
  stationPhotosSection: { marginBottom: 14 },
  stationPhotosTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  stationPhotosTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: LuxeColors.onSurfaceVariant,
  },
  stationPhotosRow: { flexDirection: "row", gap: 8 },
  stationPhotoWrap: {
    flex: 1,
    height: 92,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: LuxeColors.surfaceContainer,
  },
  stationPhoto: { width: "100%", height: "100%" },
  stationPhotoLabelWrap: {
    position: "absolute",
    left: 6,
    bottom: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: "rgba(0, 0, 0, 0.62)",
  },
  stationPhotoLabel: { fontSize: 11, fontWeight: "700", color: "#ffffff" },
  cardDivider: {
    height: 1,
    backgroundColor: LuxeColors.outlineVariant + "25",
    marginBottom: 14,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  priceRight: {
    alignItems: "flex-end",
  },
  priceLabel: {
    fontSize: 11,
    color: LuxeColors.onSurfaceVariant,
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  finalPrice: { fontSize: 18, fontWeight: "800", color: LuxeColors.primary },
  finalPriceCancelled: {
    color: LuxeColors.onSurfaceVariant,
    textDecorationLine: "line-through",
  },
  emptyState: { alignItems: "center", paddingVertical: 48 },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: LuxeColors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: LuxeColors.onSurface,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: LuxeColors.onSurfaceVariant,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  emptyActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: LuxeColors.primaryContainer,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    ...LuxeShadows.primary,
  },
  emptyActionBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  pickerCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    overflow: "hidden",
    width: SCREEN_W - 40,
    maxWidth: 400,
  },
});
