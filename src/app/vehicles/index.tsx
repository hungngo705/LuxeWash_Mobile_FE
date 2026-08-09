/**
 * Vehicles List Screen
 * Bold professional redesign with solid white vehicle cards
 */

import { useConfirmDialog } from "@/components/ConfirmDialog";
import { Header } from "@/components/ui/Header";
import {
  LuxeColors,
  LuxeShadows
} from "@/constants/luxeTheme";
import { useAuth } from "@/contexts/AuthContext";
import type { Vehicle } from "@/contexts/AuthContext";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function VehiclesScreen() {
  const router = useRouter();
  const { user, removeVehicle } = useAuth();
  const vehicles = user?.vehicles || [];
  const { confirm } = useConfirmDialog();

  const handleDeleteVehicle = async (vehicle: Vehicle) => {
    confirm({
      title: "Xóa xe",
      message: `Bạn có chắc muốn xóa xe ${vehicle.licensePlate}?`,
      confirmText: "Xóa",
      destructive: true,
      onConfirm: async () => {
        const result = await removeVehicle(vehicle.licensePlate);
        if (!result.success) {
          alert(result.error || "Không thể xóa xe. Vui lòng thử lại.");
        }
      },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Header
        title="Xe của tôi"
        onBack={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace("/(main)" as any);
          }
        }}
        rightElement={
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push("/vehicles/add-vehicle")}
          >
            <Feather
              name="plus"
              size={18}
              color={LuxeColors.primaryContainer}
            />
            <Text style={styles.addBtnText}>Thêm</Text>
          </TouchableOpacity>
        }
        showBack
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {vehicles.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Feather
                name="truck"
                size={48}
                color={LuxeColors.outlineVariant}
              />
            </View>
            <Text style={styles.emptyTitle}>Chưa có xe nào</Text>
            <Text style={styles.emptyText}>
              Thêm xe của bạn để đặt lịch rửa xe dễ dàng hơn
            </Text>
            <TouchableOpacity
              style={styles.emptyAddBtn}
              onPress={() => router.push("/vehicles/add-vehicle")}
            >
              <Feather name="plus" size={18} color="#fff" />
              <Text style={styles.emptyAddBtnText}>+ Thêm xe mới</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.vehicleList}>
            {vehicles.map((vehicle) => (
              <View key={vehicle.id} style={styles.vehicleCard}>
                <View style={styles.vehicleImageContainer}>
                  {vehicle.imageUrl ? (
                    <Image
                      source={{ uri: vehicle.imageUrl }}
                      style={styles.vehicleImage}
                    />
                  ) : (
                    <View style={styles.vehicleImagePlaceholder}>
                      <Feather
                        name="truck"
                        size={36}
                        color={LuxeColors.outline}
                      />
                    </View>
                  )}
                </View>
                <View style={styles.vehicleInfo}>
                  <View style={styles.vehicleHeader}>
                    <View style={styles.vehicleHeaderLeft}>
                      <View style={styles.plateBadge}>
                        <Text style={styles.plateText}>
                          {vehicle.licensePlate}
                        </Text>
                      </View>
                      <View style={styles.vehicleActions}>
                        <TouchableOpacity
                          style={styles.editBtn}
                          onPress={() =>
                            router.push({
                              pathname: "/vehicles/edit-vehicle",
                              params: { licensePlate: vehicle.licensePlate },
                            })
                          }
                          accessibilityRole="button"
                          accessibilityLabel={`Sửa thông tin xe ${vehicle.licensePlate}`}
                        >
                          <Feather name="edit-2" size={17} color={LuxeColors.primaryContainer} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.deleteBtn}
                          onPress={() => handleDeleteVehicle(vehicle)}
                          accessibilityRole="button"
                          accessibilityLabel={`Xóa xe ${vehicle.licensePlate}`}
                        >
                          <Feather name="trash-2" size={18} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.vehicleCarModel}>
                    {vehicle.model || vehicle.brand || "Chưa có thông tin"}
                  </Text>
                  {vehicle.brand && vehicle.model ? (
                    <Text style={styles.vehicleBrand}>{vehicle.brand}</Text>
                  ) : null}
                  <View style={styles.vehicleTypeBadge}>
                    <Feather
                      name="tag"
                      size={12}
                      color={LuxeColors.primaryContainer}
                    />
                    <Text style={styles.vehicleTypeText}>{vehicle.vehicleType || "N/A"}</Text>
                  </View>
                </View>
              </View>
            ))}

            {vehicles.length < 5 && (
              <TouchableOpacity
                style={styles.addMoreCard}
                onPress={() => router.push("/vehicles/add-vehicle")}
              >
                <View style={styles.addMoreIconWrap}>
                  <Feather
                    name="plus"
                    size={20}
                    color={LuxeColors.primaryContainer}
                  />
                </View>
                <Text style={styles.addMoreText}>Thêm xe mới</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.limitNote}>Tối đa 5 xe mỗi tài khoản</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: LuxeColors.background },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: LuxeColors.primaryContainer + "18",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: LuxeColors.primaryContainer,
  },
  emptyState: { alignItems: "center", paddingVertical: 48 },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: LuxeColors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: LuxeColors.onSurface,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: LuxeColors.onSurfaceVariant,
    textAlign: "center",
    marginBottom: 24,
    paddingHorizontal: 20,
    lineHeight: 20,
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
  emptyAddBtnText: { fontSize: 16, fontWeight: "700", color: "#ffffff" },
  vehicleList: { gap: 14 },
  vehicleCard: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    ...LuxeShadows.md,
  },
  vehicleImageContainer: {
    width: 88,
    height: 88,
    borderRadius: 14,
    overflow: "hidden",
    marginRight: 16,
  },
  vehicleImage: { width: "100%", height: "100%" },
  vehicleImagePlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: LuxeColors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  vehicleInfo: { flex: 1, justifyContent: "center" },
  vehicleHeader: { marginBottom: 4 },
  vehicleHeaderLeft: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  plateBadge: {
    backgroundColor: LuxeColors.primaryContainer,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  plateText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  vehicleActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  editBtn: {
    padding: 7,
    borderRadius: 10,
    backgroundColor: LuxeColors.primaryContainer + "12",
  },
  deleteBtn: { padding: 4 },
  vehicleCarModel: {
    fontSize: 16,
    fontWeight: "700",
    color: LuxeColors.onSurface,
    marginTop: 4,
  },
  vehicleBrand: {
    fontSize: 12,
    color: LuxeColors.onSurfaceVariant,
    marginTop: 2,
    marginBottom: 8,
  },
  vehicleTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: LuxeColors.primaryContainer + "15",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  vehicleTypeText: {
    fontSize: 11,
    fontWeight: "600",
    color: LuxeColors.primaryContainer,
  },
  addMoreCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: LuxeColors.outlineVariant,
    gap: 10,
    ...LuxeShadows.sm,
  },
  addMoreIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: LuxeColors.primaryContainer + "18",
    alignItems: "center",
    justifyContent: "center",
  },
  addMoreText: {
    fontSize: 16,
    fontWeight: "600",
    color: LuxeColors.primaryContainer,
  },
  limitNote: {
    textAlign: "center",
    fontSize: 12,
    color: LuxeColors.outline,
    marginTop: 16,
  },
});
