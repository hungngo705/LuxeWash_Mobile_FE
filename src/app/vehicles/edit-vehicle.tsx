import { useConfirmDialog } from "@/components/ConfirmDialog";
import { Header } from "@/components/ui/Header";
import {
  LuxeBorderRadius,
  LuxeColors,
} from "@/constants/luxeTheme";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/services/api/client";
import {
  type CarModel,
  vehicleService,
  type VehicleType,
} from "@/services/api/vehicleService";
import { Feather } from "@expo/vector-icons";
import { File as ExpoFile } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const normalizeValue = (value?: string | null) => value?.trim().toLowerCase() ?? "";

export default function EditVehicleScreen() {
  const router = useRouter();
  const { confirm } = useConfirmDialog();
  const { user, refreshProfile } = useAuth();
  const params = useLocalSearchParams<{ licensePlate?: string | string[] }>();
  const licensePlate = Array.isArray(params.licensePlate)
    ? params.licensePlate[0]
    : params.licensePlate;

  const vehicle = useMemo(
    () =>
      user?.vehicles.find(
        (item) => normalizeValue(item.licensePlate) === normalizeValue(licensePlate),
      ),
    [licensePlate, user?.vehicles],
  );

  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [carModels, setCarModels] = useState<CarModel[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const [selectedCarModel, setSelectedCarModel] = useState<CarModel | null>(null);
  const [customModel, setCustomModel] = useState("");
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [userNote, setUserNote] = useState("");
  const [pickedPhotoUri, setPickedPhotoUri] = useState<string | null>(null);
  const [modelSearch, setModelSearch] = useState("");
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const webFileRef = useRef<globalThis.File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!vehicle) {
      setIsLoading(false);
      return;
    }

    let active = true;
    const loadOptions = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const [typesResponse, modelsResponse] = await Promise.all([
          vehicleService.getVehicleTypes(),
          vehicleService.getCarModels(),
        ]);
        if (!active) return;

        if (typesResponse.statusCode !== 200 || !typesResponse.data) {
          throw new Error(typesResponse.message || "Không thể tải loại xe");
        }
        if (modelsResponse.statusCode !== 200 || !modelsResponse.data) {
          throw new Error(modelsResponse.message || "Không thể tải mẫu xe");
        }

        setVehicleTypes(typesResponse.data);
        setCarModels(modelsResponse.data);
        setSelectedTypeId(vehicle.vehicleTypeId ?? null);
        setUserNote(vehicle.userNote ?? "");

        const currentModel = modelsResponse.data.find(
          (model) =>
            normalizeValue(model.name) === normalizeValue(vehicle.model) &&
            (!vehicle.brand || normalizeValue(model.brand) === normalizeValue(vehicle.brand)),
        );
        if (currentModel) {
          setSelectedCarModel(currentModel);
          setSelectedTypeId(currentModel.vehicleTypeId ?? vehicle.vehicleTypeId ?? null);
          setIsCustomModel(false);
          setCustomModel("");
        } else {
          setSelectedCarModel(null);
          setIsCustomModel(true);
          setCustomModel(vehicle.model || vehicle.brand || "");
        }
      } catch (error) {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "Không thể tải dữ liệu xe");
      } finally {
        if (active) setIsLoading(false);
      }
    };

    loadOptions();
    return () => {
      active = false;
    };
  }, [reloadKey, vehicle]);

  const selectedType = vehicleTypes.find((type) => type.id === selectedTypeId);
  const isOtherType = ["khác", "other"].includes(normalizeValue(selectedType?.name));
  const previewPhotoUri = pickedPhotoUri ?? vehicle?.imageUrl ?? null;

  useEffect(() => {
    if (selectedTypeId != null && !isOtherType) {
      setUserNote("");
    }
  }, [isOtherType, selectedTypeId]);

  const filteredModels = useMemo(() => {
    const query = normalizeValue(modelSearch);
    return carModels
      .filter((model) => {
        if (!query) return true;
        return normalizeValue(`${model.brand} ${model.name}`).includes(query);
      })
      .slice(0, 80);
  }, [carModels, modelSearch]);

  const handlePickImage = useCallback(async () => {
    if (Platform.OS === "web") {
      fileInputRef.current?.click();
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== "granted") {
      alert("Vui lòng cấp quyền truy cập thư viện ảnh");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPickedPhotoUri(result.assets[0].uri);
    }
  }, []);

  const handleWebFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    webFileRef.current = file;
    setPickedPhotoUri(URL.createObjectURL(file));
  };

  const getPickedPhoto = (): Blob | undefined => {
    if (!pickedPhotoUri) return undefined;
    if (Platform.OS === "web") return webFileRef.current ?? undefined;
    return new ExpoFile(pickedPhotoUri);
  };

  const handleSubmit = async () => {
    if (!vehicle || !selectedTypeId) {
      alert("Vui lòng chọn loại xe");
      return;
    }
    if (!isCustomModel && !selectedCarModel) {
      alert("Vui lòng chọn mẫu xe");
      return;
    }
    if (isCustomModel && !customModel.trim()) {
      alert("Vui lòng nhập tên mẫu xe");
      return;
    }
    if (isOtherType && !previewPhotoUri) {
      alert("Loại xe khác cần có ảnh thực tế của xe");
      return;
    }
    if (isOtherType && !userNote.trim()) {
      alert("Vui lòng nhập mô tả loại xe thực tế");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await vehicleService.updateVehicle(vehicle.licensePlate, {
        vehicleTypeId: selectedTypeId,
        carModelId: isCustomModel ? undefined : selectedCarModel?.id,
        carModel: isCustomModel ? customModel.trim() : undefined,
        photoFile: getPickedPhoto(),
        userNote: isOtherType ? userNote.trim() : undefined,
      });

      if (response.statusCode !== 200) {
        throw new Error(response.message || "Không thể cập nhật xe");
      }

      confirm({
        title: "Cập nhật thành công",
        message: `Thông tin xe ${vehicle.licensePlate} đã được lưu.`,
        confirmText: "Xác nhận",
        showCancel: false,
        onConfirm: async () => {
          await refreshProfile();
          router.dismissTo("/vehicles");
        },
      });
    } catch (error) {
      const message =
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "Đã xảy ra lỗi khi cập nhật xe";
      alert(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!vehicle) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <Header title="Sửa thông tin xe" onBack={() => router.back()} showBack />
        <View style={styles.centerState}>
          <Feather name="alert-circle" size={42} color={LuxeColors.error} />
          <Text style={styles.stateTitle}>Không tìm thấy xe</Text>
          <Text style={styles.stateText} selectable>
            Xe có biển số {licensePlate || "không xác định"} không tồn tại trong tài khoản.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Header title="Sửa thông tin xe" onBack={() => router.back()} showBack />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.plateCard}>
          <View style={styles.plateIcon}>
            <Feather name="truck" size={22} color={LuxeColors.primaryContainer} />
          </View>
          <View style={styles.plateInfo}>
            <Text style={styles.plateLabel}>Biển số xe</Text>
            <Text style={styles.plateValue} selectable>{vehicle.licensePlate}</Text>
          </View>
          <View style={styles.lockBadge}>
            <Feather name="lock" size={13} color={LuxeColors.onSurfaceVariant} />
            <Text style={styles.lockText}>Không thể đổi</Text>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={LuxeColors.primaryContainer} />
            <Text style={styles.stateText}>Đang tải thông tin xe...</Text>
          </View>
        ) : loadError ? (
          <View style={styles.centerState}>
            <Feather name="wifi-off" size={38} color={LuxeColors.error} />
            <Text style={styles.stateTitle}>Không thể tải dữ liệu</Text>
            <Text style={styles.stateText} selectable>{loadError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => setReloadKey((key) => key + 1)}>
              <Feather name="refresh-cw" size={16} color="#ffffff" />
              <Text style={styles.retryButtonText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.formCard}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mẫu xe *</Text>
              <TouchableOpacity style={styles.picker} onPress={() => setShowModelPicker((value) => !value)}>
                <View style={styles.pickerContent}>
                  <Feather name="truck" size={18} color={LuxeColors.primaryContainer} />
                  <Text style={styles.pickerText} numberOfLines={1}>
                    {isCustomModel
                      ? customModel || "Nhập mẫu xe khác"
                      : selectedCarModel
                        ? `${selectedCarModel.brand} ${selectedCarModel.name}`
                        : "Chọn mẫu xe"}
                  </Text>
                </View>
                <Feather name={showModelPicker ? "chevron-up" : "chevron-down"} size={18} color={LuxeColors.onSurfaceVariant} />
              </TouchableOpacity>

              {showModelPicker ? (
                <View style={styles.dropdown}>
                  <View style={styles.searchBox}>
                    <Feather name="search" size={16} color={LuxeColors.onSurfaceVariant} />
                    <TextInput
                      style={styles.searchInput}
                      value={modelSearch}
                      onChangeText={setModelSearch}
                      placeholder="Tìm theo hãng hoặc mẫu xe"
                      placeholderTextColor={LuxeColors.outline}
                    />
                  </View>
                  <ScrollView style={styles.modelList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    {filteredModels.map((model) => (
                      <TouchableOpacity
                        key={model.id}
                        style={[styles.option, selectedCarModel?.id === model.id && !isCustomModel && styles.optionSelected]}
                        onPress={() => {
                          setSelectedCarModel(model);
                          setIsCustomModel(false);
                          setCustomModel("");
                          setSelectedTypeId(model.vehicleTypeId ?? selectedTypeId);
                          setShowModelPicker(false);
                          setModelSearch("");
                        }}
                      >
                        <View style={styles.optionTextWrap}>
                          <Text style={styles.optionTitle}>{model.name}</Text>
                          <Text style={styles.optionSubtitle}>{model.brand}</Text>
                        </View>
                        {selectedCarModel?.id === model.id && !isCustomModel ? (
                          <Feather name="check" size={17} color={LuxeColors.primaryContainer} />
                        ) : null}
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      style={[styles.option, isCustomModel && styles.optionSelected]}
                      onPress={() => {
                        setSelectedCarModel(null);
                        setIsCustomModel(true);
                        setCustomModel(vehicle.model || "");
                        setShowModelPicker(false);
                        setModelSearch("");
                      }}
                    >
                      <View style={styles.optionTextWrap}>
                        <Text style={styles.optionTitle}>Mẫu xe khác</Text>
                        <Text style={styles.optionSubtitle}>Nhập tên mẫu xe thủ công</Text>
                      </View>
                      {isCustomModel ? <Feather name="check" size={17} color={LuxeColors.primaryContainer} /> : null}
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              ) : null}

              {isCustomModel ? (
                <TextInput
                  style={styles.input}
                  value={customModel}
                  onChangeText={setCustomModel}
                  placeholder="VD: Santa Fe, VF 8..."
                  placeholderTextColor={LuxeColors.outline}
                  maxLength={100}
                />
              ) : null}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Loại xe *</Text>
              <TouchableOpacity
                style={[styles.picker, selectedCarModel && styles.pickerDisabled]}
                onPress={() => {
                  if (!selectedCarModel) setShowTypePicker((value) => !value);
                }}
              >
                <View style={styles.pickerContent}>
                  <Feather name="tag" size={18} color={LuxeColors.primaryContainer} />
                  <Text style={styles.pickerText}>{selectedType?.name || "Chọn loại xe"}</Text>
                </View>
                <Feather name={selectedCarModel ? "lock" : showTypePicker ? "chevron-up" : "chevron-down"} size={17} color={LuxeColors.onSurfaceVariant} />
              </TouchableOpacity>
              {selectedCarModel ? (
                <Text style={styles.hint}>Loại xe được xác định tự động theo mẫu xe.</Text>
              ) : null}
              {showTypePicker && !selectedCarModel ? (
                <View style={styles.dropdown}>
                  {vehicleTypes.map((type) => (
                    <TouchableOpacity
                      key={type.id}
                      style={[styles.option, selectedTypeId === type.id && styles.optionSelected]}
                      onPress={() => {
                        setSelectedTypeId(type.id);
                        setShowTypePicker(false);
                      }}
                    >
                      <Text style={styles.optionTitle}>{type.name}</Text>
                      {selectedTypeId === type.id ? <Feather name="check" size={17} color={LuxeColors.primaryContainer} /> : null}
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Ảnh thực tế xe {isOtherType ? "*" : ""}</Text>
              <TouchableOpacity style={styles.imagePicker} onPress={handlePickImage}>
                {previewPhotoUri ? (
                  <Image source={{ uri: previewPhotoUri }} style={styles.previewImage} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Feather name="camera" size={30} color={LuxeColors.primaryContainer} />
                    <Text style={styles.imagePlaceholderText}>Chọn ảnh xe</Text>
                  </View>
                )}
                <View style={styles.changePhotoBadge}>
                  <Feather name="edit-2" size={14} color="#ffffff" />
                  <Text style={styles.changePhotoText}>{previewPhotoUri ? "Đổi ảnh" : "Thêm ảnh"}</Text>
                </View>
              </TouchableOpacity>
              {Platform.OS === "web" ? (
                <input
                  ref={fileInputRef as any}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleWebFileChange as any}
                />
              ) : null}
              <Text style={styles.hint}>Nếu không chọn ảnh mới, hệ thống sẽ giữ ảnh hiện tại.</Text>
            </View>

            {isOtherType ? (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Mô tả loại xe *</Text>
                <TextInput
                  style={[styles.input, styles.noteInput]}
                  value={userNote}
                  onChangeText={setUserNote}
                  placeholder="Nhập mô tả loại xe"
                  placeholderTextColor={LuxeColors.outline}
                  multiline
                  maxLength={200}
                  textAlignVertical="top"
                />
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Feather name="save" size={18} color="#ffffff" />
                  <Text style={styles.submitButtonText}>Lưu thay đổi</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: LuxeColors.background },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 80, gap: 16 },
  plateCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    backgroundColor: LuxeColors.surface,
    borderRadius: LuxeBorderRadius.xl,
    boxShadow: "0 5px 18px rgba(20, 91, 120, 0.08)",
  },
  plateIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: LuxeColors.primaryContainer + "18",
  },
  plateInfo: { flex: 1, gap: 2 },
  plateLabel: { fontSize: 12, color: LuxeColors.onSurfaceVariant },
  plateValue: { fontSize: 18, fontWeight: "800", color: LuxeColors.onSurface, letterSpacing: 0.5 },
  lockBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  lockText: { fontSize: 11, color: LuxeColors.onSurfaceVariant },
  formCard: {
    gap: 20,
    padding: 18,
    backgroundColor: LuxeColors.surface,
    borderRadius: LuxeBorderRadius.xl,
    boxShadow: "0 5px 18px rgba(20, 91, 120, 0.08)",
  },
  inputGroup: { gap: 8 },
  label: { fontSize: 14, fontWeight: "700", color: LuxeColors.onSurface },
  picker: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 14,
    backgroundColor: LuxeColors.background,
    borderWidth: 1.5,
    borderColor: LuxeColors.outlineVariant,
    borderRadius: LuxeBorderRadius.lg,
  },
  pickerDisabled: { backgroundColor: LuxeColors.surfaceContainer },
  pickerContent: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  pickerText: { flex: 1, fontSize: 15, fontWeight: "600", color: LuxeColors.onSurface },
  dropdown: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: LuxeColors.outlineVariant,
    borderRadius: LuxeBorderRadius.lg,
    backgroundColor: LuxeColors.surface,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: LuxeColors.outlineVariant,
  },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 14, color: LuxeColors.onSurface, letterSpacing: 0 },
  modelList: { maxHeight: 260 },
  option: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LuxeColors.outlineVariant,
  },
  optionSelected: { backgroundColor: LuxeColors.primaryContainer + "12" },
  optionTextWrap: { flex: 1 },
  optionTitle: { fontSize: 14, fontWeight: "600", color: LuxeColors.onSurface },
  optionSubtitle: { fontSize: 12, color: LuxeColors.onSurfaceVariant, marginTop: 2 },
  input: {
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: "400",
    letterSpacing: 0,
    textAlign: "left",
    color: LuxeColors.onSurface,
    backgroundColor: LuxeColors.background,
    borderWidth: 1.5,
    borderColor: LuxeColors.outlineVariant,
    borderRadius: LuxeBorderRadius.lg,
  },
  noteInput: { minHeight: 96 },
  hint: { fontSize: 12, lineHeight: 17, color: LuxeColors.onSurfaceVariant },
  imagePicker: {
    position: "relative",
    height: 180,
    overflow: "hidden",
    backgroundColor: LuxeColors.surfaceContainer,
    borderRadius: LuxeBorderRadius.lg,
    borderWidth: 1.5,
    borderColor: LuxeColors.outlineVariant,
  },
  previewImage: { width: "100%", height: "100%" },
  imagePlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  imagePlaceholderText: { fontSize: 14, fontWeight: "600", color: LuxeColors.primaryContainer },
  changePhotoBadge: {
    position: "absolute",
    right: 12,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: LuxeColors.primaryContainer,
  },
  changePhotoText: { fontSize: 12, fontWeight: "700", color: "#ffffff" },
  submitButton: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    borderRadius: LuxeBorderRadius.lg,
    backgroundColor: LuxeColors.primaryContainer,
  },
  submitButtonDisabled: { opacity: 0.65 },
  submitButtonText: { fontSize: 16, fontWeight: "800", color: "#ffffff" },
  centerState: { alignItems: "center", justifyContent: "center", gap: 10, padding: 36 },
  stateTitle: { fontSize: 18, fontWeight: "700", color: LuxeColors.onSurface, textAlign: "center" },
  stateText: { fontSize: 13, lineHeight: 19, color: LuxeColors.onSurfaceVariant, textAlign: "center" },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 6,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: LuxeBorderRadius.lg,
    backgroundColor: LuxeColors.primaryContainer,
  },
  retryButtonText: { fontSize: 14, fontWeight: "700", color: "#ffffff" },
});
