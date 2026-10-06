/**
 * Advance Booking Flow - Step 1: Select Vehicle (1 booking = 1 xe)
 * Bold professional redesign with solid white cards
 */

import { BottomActionBar } from "@/components/ui/BottomActionBar";
import { Header } from "@/components/ui/Header";
import { ProgressSteps } from "@/components/ui/ProgressSteps";
import { LuxeColors, LuxeShadows } from "@/constants/luxeTheme";
import { useAuth } from "@/contexts/AuthContext";
import type { Vehicle } from "@/contexts/AuthContext";
import { bookingService, type ActiveVehicleBooking } from "@/services/api/bookingService";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const DEFAULT_BRANCH_ID = 1;
const DEFAULT_BRANCH_NAME = "LuxeWash";
const normalizePlate = (plate: string) => plate.replace(/[\s.-]/g, "").toUpperCase();

export default function SelectVehiclesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams();

  const branchIdParam = parseInt(params.branchId as string) || DEFAULT_BRANCH_ID;
  const branchNameParam = (params.branchName as string) || DEFAULT_BRANCH_NAME;

  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [activeBookings, setActiveBookings] = useState<ActiveVehicleBooking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [bookingError, setBookingError] = useState(false);
  const vehicles = user?.vehicles || [];

  const loadActiveBookings = useCallback(async () => {
    setLoadingBookings(true);
    setBookingError(false);
    try {
      const response = await bookingService.getActiveVehicleBookings();
      if (response.statusCode !== 200 || !Array.isArray(response.data)) {
        throw new Error("Không thể kiểm tra lịch hiện tại của xe.");
      }
      setActiveBookings(response.data);
    } catch {
      setActiveBookings([]);
      setBookingError(true);
    } finally {
      setLoadingBookings(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadActiveBookings();
  }, [loadActiveBookings]));

  const activeBookingFor = useCallback((plate: string) =>
    activeBookings.find((booking) => normalizePlate(booking.licensePlate) === normalizePlate(plate)),
  [activeBookings]);

  useEffect(() => {
    if (selectedVehicle && activeBookingFor(selectedVehicle.licensePlate)) {
      setSelectedVehicle(null);
    }
  }, [activeBookingFor, selectedVehicle]);

  const handleSelectVehicle = (vehicle: Vehicle) => {
    if (loadingBookings || bookingError || activeBookingFor(vehicle.licensePlate)) return;
    setSelectedVehicle(vehicle);
  };

  const handleContinue = () => {
    if (loadingBookings || bookingError || (selectedVehicle && activeBookingFor(selectedVehicle.licensePlate))) return;
    if (!selectedVehicle) {
      alert("Vui lòng chọn 1 xe để đặt lịch");
      return;
    }

    router.push({
      pathname: "/booking/select-service",
      params: {
        vehicleId: selectedVehicle.licensePlate,
        vehicleDbId: selectedVehicle.id,
        vehicleTypeId: String(selectedVehicle.vehicleTypeId ?? 1),
        vehicleBrand: `${selectedVehicle.brand}${selectedVehicle.model ? ` · ${selectedVehicle.model}` : ""}`,
        branchId: String(branchIdParam),
        branchName: branchNameParam,
      },
    });
  };

  const handleAddVehicle = () => router.push("/vehicles/add-vehicle");

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Header title="Đặt lịch rửa xe" onBack={() => router.back()} />

      <ProgressSteps
        steps={[
          { label: 'Chi nhánh' },
          { label: 'Xe' },
          { label: 'Dịch vụ' },
          { label: 'Ngày' },
          { label: 'Xác nhận' },
        ]}
        currentStep={1}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Welcome */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>Chọn xe của bạn</Text>
        </View>

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Xe của tôi</Text>
          <TouchableOpacity
            style={styles.addVehicleBtn}
            onPress={handleAddVehicle}
          >
            <Feather
              name="plus"
              size={14}
              color={LuxeColors.primaryContainer}
            />
            <Text style={styles.addVehicleText}>Thêm xe</Text>
          </TouchableOpacity>
        </View>

        {/* Vehicle List */}
        {loadingBookings && (
          <View style={styles.bookingCheck}>
            <ActivityIndicator color={LuxeColors.primaryContainer} />
            <Text style={styles.bookingCheckText}>Đang kiểm tra lịch của xe...</Text>
          </View>
        )}
        {bookingError && (
          <TouchableOpacity style={styles.bookingCheck} onPress={() => void loadActiveBookings()}>
            <Text style={styles.bookingCheckText}>Không thể kiểm tra lịch hiện tại. Nhấn để thử lại.</Text>
          </TouchableOpacity>
        )}
        {vehicles.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Feather
                name="truck"
                size={40}
                color={LuxeColors.outlineVariant}
              />
            </View>
            <Text style={styles.emptyTitle}>Bạn chưa có xe nào</Text>
            <Text style={styles.emptySubtitle}>
              Thêm xe để đặt lịch rửa xe
            </Text>
            <TouchableOpacity
              style={styles.emptyAddBtn}
              onPress={handleAddVehicle}
            >
              <Feather name="plus" size={16} color="#fff" />
              <Text style={styles.emptyAddBtnText}>+ Thêm xe mới</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.vehicleList}>
            {vehicles.map((vehicle) => {
              const activeBooking = activeBookingFor(vehicle.licensePlate);
              const isSelected =
                selectedVehicle?.licensePlate === vehicle.licensePlate;
              return (
                <View key={vehicle.licensePlate}>
                  <TouchableOpacity
                    style={[
                      styles.vehicleCard,
                      isSelected && styles.vehicleCardSelected,
                      !!activeBooking && styles.vehicleCardBlocked,
                    ]}
                    onPress={() => handleSelectVehicle(vehicle)}
                    disabled={loadingBookings || bookingError || !!activeBooking}
                    activeOpacity={0.8}
                  >
                    {/* Radio indicator */}
                    <View
                      style={[styles.radio, isSelected && styles.radioSelected]}
                    >
                      {isSelected && <View style={styles.radioInner} />}
                    </View>

                    <View
                      style={[
                        styles.vehicleImageWrap,
                        isSelected && styles.vehicleImageWrapSelected,
                      ]}
                    >
                      {vehicle.imageUrl ? (
                        <Image
                          source={{ uri: vehicle.imageUrl }}
                          style={styles.vehicleImage}
                        />
                      ) : (
                        <View style={styles.vehicleImagePlaceholder}>
                          <Feather
                            name="truck"
                            size={28}
                            color={LuxeColors.outline}
                          />
                        </View>
                      )}
                    </View>

                    <View style={styles.vehicleInfo}>
                      <Text style={styles.vehicleName}>
                        {vehicle.model
                          ? `${vehicle.brand} · ${vehicle.model}`
                          : vehicle.brand}
                      </Text>
                      <View style={styles.plateBadge}>
                        <Text style={styles.plateText}>
                          {vehicle.licensePlate}
                        </Text>
                      </View>
                      {activeBooking && (
                        <Text style={styles.activeBookingLabel}>Đã có lịch #{activeBooking.bookingId}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                  {activeBooking && (
                    <TouchableOpacity
                      style={styles.viewBookingButton}
                      onPress={() => router.push(`/booking/${activeBooking.bookingId}` as any)}
                    >
                      <Text style={styles.viewBookingText}>Xem lịch hiện tại</Text>
                      <Feather name="arrow-right" size={14} color={LuxeColors.primaryContainer} />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Selected Summary */}
        {selectedVehicle && (
          <View style={styles.selectedSummary}>
            <View style={styles.selectedSummaryHeader}>
              <Feather
                name="check-circle"
                size={18}
                color={LuxeColors.primaryContainer}
              />
              <Text style={styles.selectedSummaryTitle}>Xe đã chọn</Text>
            </View>
            <Text style={styles.selectedItem}>
              {selectedVehicle.licensePlate} —{' '}
              {selectedVehicle.model
                ? `${selectedVehicle.brand} · ${selectedVehicle.model}`
                : selectedVehicle.brand}
            </Text>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      <BottomActionBar
        title={selectedVehicle ? "TIẾP THEO" : "CHỌN XE ĐỂ TIẾP TỤC"}
        onPress={handleContinue}
        disabled={!selectedVehicle || loadingBookings || bookingError}
        icon="arrow-right"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: LuxeColors.background },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8 },
  welcomeSection: { marginBottom: 20 },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: LuxeColors.onSurface,
    marginBottom: 6,
  },
  welcomeSubtitle: { fontSize: 14, color: LuxeColors.onSurfaceVariant },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: LuxeColors.onSurface,
  },
  addVehicleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: LuxeColors.primaryContainer + "18",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  addVehicleText: {
    fontSize: 13,
    fontWeight: "600",
    color: LuxeColors.primaryContainer,
  },
  emptyState: {
    alignItems: "center",
    padding: 32,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    ...LuxeShadows.sm,
  },
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
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: LuxeColors.onSurfaceVariant,
    marginBottom: 20,
  },
  emptyAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: LuxeColors.primaryContainer,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    ...LuxeShadows.primary,
  },
  emptyAddBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  vehicleList: { gap: 12 },
  vehicleCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: "transparent",
    ...LuxeShadows.sm,
  },
  vehicleCardSelected: {
    borderColor: LuxeColors.primaryContainer,
    backgroundColor: "#DDF3FB",
    ...LuxeShadows.md,
    elevation: 0,
    shadowOpacity: 0,
  },
  vehicleCardBlocked: {
    opacity: 0.65,
  },
  bookingCheck: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 12,
    marginBottom: 12,
  },
  bookingCheckText: {
    color: LuxeColors.onSurfaceVariant,
    fontSize: 13,
  },
  activeBookingLabel: {
    color: LuxeColors.tertiary,
    fontSize: 12,
    fontWeight: "700",
  },
  viewBookingButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  viewBookingText: {
    color: LuxeColors.primaryContainer,
    fontSize: 13,
    fontWeight: "700",
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: LuxeColors.outline,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
    flexShrink: 0,
  },
  radioSelected: {
    borderColor: LuxeColors.primaryContainer,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: LuxeColors.primaryContainer,
  },
  vehicleImageWrap: {
    width: 64,
    height: 64,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: LuxeColors.surfaceContainer,
  },
  vehicleImageWrapSelected: {
    backgroundColor: "#CFEFFA",
  },
  vehicleImage: { width: "100%", height: "100%" },
  vehicleImagePlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  vehicleInfo: { flex: 1, marginLeft: 14 },
  vehicleName: {
    fontSize: 16,
    fontWeight: "700",
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
  selectedSummary: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    ...LuxeShadows.sm,
  },
  selectedSummaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  selectedSummaryTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: LuxeColors.onSurface,
  },
  selectedItem: {
    fontSize: 13,
    color: LuxeColors.onSurfaceVariant,
    marginLeft: 4,
  },
});
