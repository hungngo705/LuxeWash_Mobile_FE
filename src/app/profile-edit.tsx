/**
 * Profile Edit Screen
 * Displays all user data from GET /api/v1/users/me
 */

import { Header } from "@/components/ui/Header";
import { LuxeColors, LuxeShadows } from "@/constants/luxeTheme";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError, authService } from "@/services/api";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

const PHONE_REGEX = /^(0[3|5|7|8|9])+([0-9]{8})$/; // Regex số điện thoại Việt Nam
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // Regex email cơ bản
const DAYS_OF_WEEK = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"]; // Nhãn thứ trong tuần cho lịch

/** Lỗi cho từng trường trong form chỉnh sửa hồ sơ (kèm lỗi API). */
interface FormErrors {
  fullName?: string;
  phoneNumber?: string;
  email?: string;
  dateOfBirth?: string;
  api?: string;
}

/** Một ô ngày trong lưới lịch (null = ô trống đệm đầu tháng). */
interface CalendarDay {
  date: Date | null;
}

/** Chuyển chuỗi ISO thành dạng yyyy-mm-dd để đưa vào input. */
function formatDateForInput(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return dateStr.split("T")[0];
}

/** Định dạng ngày để hiển thị (dd/mm/yyyy), rỗng thì trả về placeholder. */
function formatDisplayDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "Chọn ngày sinh";
  const d = new Date(dateStr);
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Lấy 2 chữ cái đầu của tên để hiển thị trên avatar chữ. */
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

/** Chuyển Date sang chuỗi yyyy-mm-dd theo giờ địa phương (tránh lệch múi giờ). */
function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Dựng mảng ngày cho lưới lịch của 1 tháng, chèn ô trống đệm cho các ngày đầu tuần. */
function buildCalendarDays(year: number, month: number): CalendarDay[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const days: CalendarDay[] = [];

  for (let i = 0; i < firstDay.getDay(); i++) {
    days.push({ date: null });
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month, d);
    date.setHours(0, 0, 0, 0);
    days.push({ date });
  }

  return days;
}

/**
 * Màn hình Chỉnh sửa hồ sơ cá nhân.
 * Hiển thị và cho phép sửa họ tên, SĐT, email, ngày sinh (qua lịch hoặc nhập tay).
 * Chỉ bật nút Lưu khi có thay đổi; gọi API cập nhật rồi làm mới hồ sơ.
 */
export default function ProfileEditScreen() {
  const router = useRouter();
  const { user, refreshProfile } = useAuth();

  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false); // Đang lưu

  // Calendar modal state — trạng thái của modal chọn ngày sinh
  const [showCalendar, setShowCalendar] = useState(false); // Hiển thị modal lịch
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear()); // Năm đang xem
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth()); // Tháng đang xem
  const [manualDateInput, setManualDateInput] = useState(""); // Giá trị nhập tay
  const [showManualInput, setShowManualInput] = useState(false); // Chế độ nhập tay hay chọn lịch

  // Danh sách ô ngày của tháng đang xem (tính lại khi đổi tháng/năm)
  const calendarDays = useMemo(
    () => buildCalendarDays(calendarYear, calendarMonth),
    [calendarYear, calendarMonth],
  );

  const monthYearDisplay = useMemo(() => {
    const d = new Date(calendarYear, calendarMonth);
    return d.toLocaleDateString("vi-VN", { month: "long", year: "numeric" });
  }, [calendarYear, calendarMonth]);

  // Ngày sinh đang chọn (chuẩn hóa về 0h để so sánh chính xác)
  const selectedDate = useMemo(() => {
    if (!dateOfBirth) return null;
    const d = new Date(dateOfBirth);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [dateOfBirth]);

  // Nạp dữ liệu người dùng vào form khi user thay đổi
  useEffect(() => {
    if (user) {
      setFullName(user.name || "");
      setPhoneNumber(user.phoneNumber || "");
      setEmail(user.email || "");
      setDateOfBirth(formatDateForInput(user.dateOfBirth));
      setManualDateInput(formatDateForInput(user.dateOfBirth));
      if (user.dateOfBirth) {
        const d = new Date(user.dateOfBirth);
        setCalendarYear(d.getFullYear());
        setCalendarMonth(d.getMonth());
      }
    }
  }, [user]);

  // Điều hướng năm trước/năm sau
  const handlePrevYear = () => setCalendarYear(calendarYear - 1);
  const handleNextYear = () => setCalendarYear(calendarYear + 1);

  // Về tháng trước (nhảy sang tháng 12 năm trước nếu đang ở tháng 1)
  const handlePrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear(calendarYear - 1);
    } else {
      setCalendarMonth(calendarMonth - 1);
    }
  };

  // Sang tháng sau (nhảy sang tháng 1 năm sau nếu đang ở tháng 12)
  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear(calendarYear + 1);
    } else {
      setCalendarMonth(calendarMonth + 1);
    }
  };

  // Chọn một ngày trên lịch: cập nhật ngày sinh và đóng modal
  const handleDaySelect = (day: CalendarDay) => {
    if (!day.date) return;
    const dateStr = toLocalDateString(day.date);
    setDateOfBirth(dateStr);
    setManualDateInput(dateStr);
    setErrors((prev) => ({ ...prev, dateOfBirth: undefined }));
    setShowCalendar(false);
  };

  const handleManualDateSubmit = () => {
    const trimmed = manualDateInput.trim();
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(trimmed)) {
      setErrors((prev) => ({
        ...prev,
        dateOfBirth: "Định dạng: YYYY-MM-DD (VD: 2000-01-15)",
      }));
      return;
    }
    const d = new Date(trimmed);
    if (isNaN(d.getTime())) {
      setErrors((prev) => ({ ...prev, dateOfBirth: "Ngày không hợp lệ" }));
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (d >= today) {
      setErrors((prev) => ({
        ...prev,
        dateOfBirth: "Ngày sinh phải là ngày trong quá khứ",
      }));
      return;
    }
    setDateOfBirth(trimmed);
    setCalendarYear(d.getFullYear());
    setCalendarMonth(d.getMonth());
    setErrors((prev) => ({ ...prev, dateOfBirth: undefined }));
    setShowCalendar(false);
  };

  const handleClearDate = () => {
    setDateOfBirth("");
    setManualDateInput("");
    setErrors((prev) => ({ ...prev, dateOfBirth: undefined }));
  };

  const openCalendar = () => {
    setManualDateInput(dateOfBirth);
    setErrors((prev) => ({ ...prev, dateOfBirth: undefined }));
    setShowManualInput(false);
    setShowCalendar(true);
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!fullName.trim()) {
      newErrors.fullName = "Họ tên không được để trống";
    } else if (fullName.trim().length < 2) {
      newErrors.fullName = "Họ tên phải có ít nhất 2 ký tự";
    }

    if (!phoneNumber.trim()) {
      newErrors.phoneNumber = "Số điện thoại không được để trống";
    } else if (!PHONE_REGEX.test(phoneNumber.trim())) {
      newErrors.phoneNumber = "Số điện thoại không hợp lệ (VD: 0912345678)";
    }

    if (email.trim() && !EMAIL_REGEX.test(email.trim())) {
      newErrors.email = "Email không đúng định dạng";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setSubmitting(true);
    setErrors({});

    try {
      const response = await authService.updateProfile({
        fullName: fullName.trim(),
        phoneNumber: phoneNumber.trim(),
        email: email.trim() || undefined,
        dateOfBirth: dateOfBirth.trim() || undefined,
      });

      if (response.statusCode === 200) {
        await refreshProfile?.();
        router.back();
      } else {
        setErrors({ api: response.message || "Cập nhật thất bại." });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors({ api: (err as ApiError).message });
      } else {
        setErrors({ api: "Đã xảy ra lỗi. Vui lòng thử lại." });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const statusColor = user?.status === "Active" ? "#22C55E" : "#EF4444";
  const statusLabel =
    user?.status === "Active" ? "Hoạt động" : user?.status || "Không xác định";

  const hasChanges =
    fullName.trim() !== (user?.name || "") ||
    phoneNumber.trim() !== (user?.phoneNumber || "") ||
    email.trim() !== (user?.email || "") ||
    dateOfBirth.trim() !== formatDateForInput(user?.dateOfBirth);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Header title="Hồ sơ cá nhân" onBack={() => router.back()} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {errors.api && (
            <View style={styles.errorBanner}>
              <Feather name="alert-circle" size={16} color="#dc2626" />
              <Text style={styles.errorBannerText}>{errors.api}</Text>
            </View>
          )}

          {/* Avatar & Identity */}
          <View style={styles.avatarSection}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: LuxeColors.primaryContainer },
              ]}
            >
              <Text style={styles.avatarText}>{getInitials(fullName)}</Text>
            </View>
            <Text style={styles.userName}>{fullName || "Người dùng"}</Text>
          </View>

          {/* Account Status */}
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Trạng thái tài khoản</Text>
              <View
                style={[styles.statusDot, { backgroundColor: statusColor }]}
              />
              <Text style={[styles.statusValue, { color: statusColor }]}>
                {statusLabel}
              </Text>
            </View>
          </View>

          {/* Personal Information Form */}
          <View style={styles.formCard}>
            <Text style={styles.cardTitle}>Thông tin cá nhân</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Họ và tên</Text>
              <TextInput
                style={[styles.input, errors.fullName && styles.inputError]}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Nhập họ và tên"
                placeholderTextColor={LuxeColors.outline}
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={100}
              />
              {errors.fullName && (
                <Text style={styles.errorText}>{errors.fullName}</Text>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Số điện thoại</Text>
              <TextInput
                style={[styles.input, errors.phoneNumber && styles.inputError]}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder="VD: 0912345678"
                placeholderTextColor={LuxeColors.outline}
                keyboardType="phone-pad"
                autoCorrect={false}
                maxLength={15}
              />
              {errors.phoneNumber && (
                <Text style={styles.errorText}>{errors.phoneNumber}</Text>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput
                style={[styles.input, errors.email && styles.inputError]}
                value={email}
                onChangeText={setEmail}
                placeholder="VD: user@example.com"
                placeholderTextColor={LuxeColors.outline}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={100}
              />
              {errors.email && (
                <Text style={styles.errorText}>{errors.email}</Text>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Ngày sinh</Text>
              <View style={styles.datePickerRow}>
                <TouchableOpacity
                  style={[
                    styles.datePickerInput,
                    errors.dateOfBirth && styles.inputError,
                  ]}
                  onPress={openCalendar}
                >
                  <Feather
                    name="calendar"
                    size={18}
                    color={
                      dateOfBirth
                        ? LuxeColors.primaryContainer
                        : LuxeColors.outline
                    }
                  />
                  <Text
                    style={[
                      styles.datePickerText,
                      !dateOfBirth && styles.datePickerPlaceholder,
                    ]}
                  >
                    {formatDisplayDate(dateOfBirth)}
                  </Text>
                </TouchableOpacity>
                {dateOfBirth ? (
                  <TouchableOpacity
                    style={styles.clearBtn}
                    onPress={handleClearDate}
                  >
                    <Feather
                      name="x"
                      size={16}
                      color={LuxeColors.onSurfaceVariant}
                    />
                  </TouchableOpacity>
                ) : null}
              </View>
              {errors.dateOfBirth && (
                <Text style={styles.errorText}>{errors.dateOfBirth}</Text>
              )}
            </View>
          </View>

          {/* Buttons */}
          <View style={styles.buttons}>
            <TouchableOpacity
              style={[
                styles.saveBtn,
                (!hasChanges || submitting) && styles.saveBtnDisabled,
              ]}
              onPress={handleSave}
              disabled={!hasChanges || submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Feather name="check" size={18} color="#ffffff" />
                  <Text style={styles.saveBtnText}>Lưu thay đổi</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => router.back()}
            >
              <Text style={styles.cancelBtnText}>Hủy bỏ</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Calendar Modal */}
      <Modal
        visible={showCalendar}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCalendar(false)}
      >
        <SafeAreaProvider style={styles.modalProvider}>
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setShowCalendar(false)}
          >
            <Pressable style={styles.calendarModal} onPress={() => {}}>
            {/* Header */}
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>Chọn ngày sinh</Text>
              <TouchableOpacity onPress={() => setShowCalendar(false)}>
                <Feather name="x" size={22} color={LuxeColors.onSurface} />
              </TouchableOpacity>
            </View>

            {/* Tab Toggle: Calendar / Nhap tay */}
            <View style={styles.tabToggle}>
              <TouchableOpacity
                style={[styles.tabBtn, !showManualInput && styles.tabBtnActive]}
                onPress={() => setShowManualInput(false)}
              >
                <Feather
                  name="calendar"
                  size={15}
                  color={
                    !showManualInput ? "#ffffff" : LuxeColors.primaryContainer
                  }
                />
                <Text
                  style={[
                    styles.tabBtnText,
                    !showManualInput && styles.tabBtnTextActive,
                  ]}
                >
                  Lịch
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, showManualInput && styles.tabBtnActive]}
                onPress={() => setShowManualInput(true)}
              >
                <Feather
                  name="edit-2"
                  size={15}
                  color={
                    showManualInput ? "#ffffff" : LuxeColors.primaryContainer
                  }
                />
                <Text
                  style={[
                    styles.tabBtnText,
                    showManualInput && styles.tabBtnTextActive,
                  ]}
                >
                  Nhập tay
                </Text>
              </TouchableOpacity>
            </View>

            {!showManualInput ? (
              <>
                {/* Year Navigation */}
                <View style={styles.yearNav}>
                  <TouchableOpacity
                    style={styles.yearNavBtn}
                    onPress={handlePrevYear}
                  >
                    <Feather
                      name="chevrons-left"
                      size={20}
                      color={LuxeColors.onSurface}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.yearDisplay}
                    onPress={handlePrevYear}
                    onLongPress={handleNextYear}
                  >
                    <Text style={styles.yearDisplayText}>{calendarYear}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.yearNavBtn}
                    onPress={handleNextYear}
                  >
                    <Feather
                      name="chevrons-right"
                      size={20}
                      color={LuxeColors.onSurface}
                    />
                  </TouchableOpacity>
                </View>

                {/* Month Navigation */}
                <View style={styles.monthNav}>
                  <TouchableOpacity
                    style={styles.navBtn}
                    onPress={handlePrevMonth}
                  >
                    <Feather
                      name="chevron-left"
                      size={22}
                      color={LuxeColors.onSurface}
                    />
                  </TouchableOpacity>
                  <Text style={styles.monthTitle}>{monthYearDisplay}</Text>
                  <TouchableOpacity
                    style={styles.navBtn}
                    onPress={handleNextMonth}
                  >
                    <Feather
                      name="chevron-right"
                      size={22}
                      color={LuxeColors.onSurface}
                    />
                  </TouchableOpacity>
                </View>

                {/* Days of Week */}
                <View style={styles.daysOfWeek}>
                  {DAYS_OF_WEEK.map((day, index) => (
                    <View key={index} style={styles.dayOfWeekCell}>
                      <Text style={styles.dayOfWeekText}>{day}</Text>
                    </View>
                  ))}
                </View>

                {/* Calendar Grid */}
                <View style={styles.calendarGrid}>
                  {calendarDays.map((day, index) => {
                    if (!day.date) {
                      return <View key={index} style={styles.dayCell} />;
                    }
                    const isToday =
                      day.date.toDateString() === new Date().toDateString();
                    const isSelected =
                      selectedDate?.toDateString() === day.date.toDateString();
                    return (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.dayCell,
                          isSelected && styles.dayCellSelected,
                          isToday && !isSelected && styles.dayCellToday,
                        ]}
                        onPress={() => handleDaySelect(day)}
                      >
                        <Text
                          style={[
                            styles.dayNumber,
                            isSelected && styles.dayTextSelected,
                            isToday && !isSelected && styles.dayTextToday,
                          ]}
                        >
                          {day.date.getDate()}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : (
              <>
                {/* Manual Input */}
                <View style={styles.manualInputSection}>
                  <Text style={styles.manualInputLabel}>Nhập ngày sinh</Text>
                  <TextInput
                    style={[
                      styles.manualInput,
                      errors.dateOfBirth && styles.inputError,
                    ]}
                    value={manualDateInput}
                    onChangeText={(text) => {
                      setManualDateInput(text);
                      setErrors((prev) => ({
                        ...prev,
                        dateOfBirth: undefined,
                      }));
                    }}
                    placeholder="VD: 2000-01-15"
                    placeholderTextColor={LuxeColors.outline}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                  {errors.dateOfBirth ? (
                    <Text style={styles.errorText}>{errors.dateOfBirth}</Text>
                  ) : (
                    <Text style={styles.manualInputHint}>
                      Định dạng: YYYY-MM-DD
                    </Text>
                  )}
                  <TouchableOpacity
                    style={styles.applyDateBtn}
                    onPress={handleManualDateSubmit}
                  >
                    <Feather name="check" size={16} color="#ffffff" />
                    <Text style={styles.applyDateBtnText}>Áp dụng</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
            </Pressable>
          </Pressable>
        </SafeAreaProvider>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: LuxeColors.background },
  modalProvider: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingTop: 16 },
  errorBanner: {
    backgroundColor: "#FEF2F2",
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorBannerText: {
    fontSize: 13,
    color: "#DC2626",
    fontWeight: "500",
    flex: 1,
  },
  avatarSection: { alignItems: "center", marginBottom: 20 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    ...LuxeShadows.lg,
  },
  avatarText: { fontSize: 32, fontWeight: "700", color: "#ffffff" },
  userName: {
    fontSize: 22,
    fontWeight: "700",
    color: LuxeColors.onSurface,
    marginBottom: 8,
  },
  statusCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...LuxeShadows.sm,
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusLabel: { fontSize: 14, color: LuxeColors.onSurfaceVariant, flex: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusValue: { fontSize: 14, fontWeight: "600" },
  formCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    ...LuxeShadows.md,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: LuxeColors.onSurface,
    marginBottom: 16,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldGroup: { marginBottom: 18 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: LuxeColors.onSurfaceVariant,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: LuxeColors.background,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    fontSize: 16,
    color: LuxeColors.onSurface,
    borderWidth: 1.5,
    borderColor: LuxeColors.outlineVariant,
  },
  inputError: { borderColor: "#DC2626" },
  errorText: {
    fontSize: 12,
    color: "#DC2626",
    marginTop: 6,
    fontWeight: "500",
  },
  datePickerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  datePickerInput: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: LuxeColors.background,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: LuxeColors.outlineVariant,
  },
  datePickerText: { fontSize: 16, color: LuxeColors.onSurface },
  datePickerPlaceholder: { color: LuxeColors.outline },
  clearBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: LuxeColors.background,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: LuxeColors.outlineVariant,
  },
  buttons: { gap: 12, marginTop: 8 },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: LuxeColors.primaryContainer,
    borderRadius: 14,
    paddingVertical: 16,
    ...LuxeShadows.primary,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
  cancelBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: LuxeColors.outlineVariant,
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: LuxeColors.onSurfaceVariant,
  },
  // Calendar Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  calendarModal: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    width: "100%",
    maxWidth: 380,
    ...LuxeShadows.xl,
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  calendarTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: LuxeColors.onSurface,
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: LuxeColors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: LuxeColors.onSurface,
    textTransform: "capitalize",
  },
  daysOfWeek: { flexDirection: "row", marginBottom: 8 },
  dayOfWeekCell: { flex: 1, alignItems: "center", paddingVertical: 6 },
  dayOfWeekText: {
    fontSize: 12,
    fontWeight: "600",
    color: LuxeColors.onSurfaceVariant,
  },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: {
    width: "14.28%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCellSelected: {
    backgroundColor: LuxeColors.primaryContainer,
    borderRadius: 20,
  },
  dayCellToday: {
    backgroundColor: LuxeColors.outlineVariant,
    borderRadius: 20,
  },
  dayNumber: { fontSize: 15, fontWeight: "500", color: LuxeColors.onSurface },
  dayTextSelected: { color: "#ffffff", fontWeight: "700" },
  dayTextToday: { color: LuxeColors.primaryContainer, fontWeight: "700" },
  clearDateBtn: { marginTop: 16, alignItems: "center", paddingVertical: 12 },
  clearDateBtnText: { fontSize: 14, fontWeight: "600", color: "#DC2626" },
  // Year & Month Navigation
  yearNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    gap: 16,
  },
  yearNavBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: LuxeColors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  yearDisplay: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: LuxeColors.background,
  },
  yearDisplayText: {
    fontSize: 20,
    fontWeight: "800",
    color: LuxeColors.onSurface,
  },
  // Tab Toggle
  tabToggle: {
    flexDirection: "row",
    backgroundColor: LuxeColors.background,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabBtnActive: { backgroundColor: LuxeColors.primaryContainer },
  tabBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: LuxeColors.primaryContainer,
  },
  tabBtnTextActive: { color: "#ffffff" },
  // Manual Input
  manualInputSection: { paddingVertical: 8 },
  manualInputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: LuxeColors.onSurfaceVariant,
    marginBottom: 12,
  },
  manualInput: {
    backgroundColor: LuxeColors.background,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    fontSize: 18,
    color: LuxeColors.onSurface,
    borderWidth: 1.5,
    borderColor: LuxeColors.outlineVariant,
    textAlign: "center",
    fontWeight: "600",
    letterSpacing: 2,
  },
  manualInputHint: {
    fontSize: 12,
    color: LuxeColors.onSurfaceVariant,
    marginTop: 8,
    textAlign: "center",
  },
  applyDateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: LuxeColors.primaryContainer,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 16,
  },
  applyDateBtnText: { fontSize: 15, fontWeight: "700", color: "#ffffff" },
});
