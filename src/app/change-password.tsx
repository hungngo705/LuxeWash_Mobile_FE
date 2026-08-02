/**
 * Change Password Screen - LuxeWash
 * Bold professional redesign with solid white form card
 */

import { useConfirmDialog } from "@/components/ConfirmDialog";
import {
    LuxeBorderRadius,
    LuxeColors,
    LuxeShadows,
} from "@/constants/luxeTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Header } from "@/components/ui/Header";

const PASSWORD_MIN_LENGTH = 8; // Độ dài mật khẩu tối thiểu

/** Lỗi cho từng trường trong form đổi mật khẩu (kèm lỗi từ API). */
interface FieldErrors {
  oldPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
  apiError?: string;
}

/**
 * Màn hình Đổi mật khẩu.
 * Nhập mật khẩu cũ + mật khẩu mới, validate theo quy tắc (độ dài, chữ hoa, chữ số),
 * gọi API đổi mật khẩu và hiển thị hộp thoại kết quả.
 */
export default function ChangePasswordScreen() {
  const router = useRouter();
  const { changePassword } = useAuth();
  const { confirm } = useConfirmDialog();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false); // Hiện/ẩn mật khẩu cũ
  const [showNewPassword, setShowNewPassword] = useState(false); // Hiện/ẩn mật khẩu mới
  const [showConfirmPassword, setShowConfirmPassword] = useState(false); // Hiện/ẩn xác nhận
  const [isSubmitting, setIsSubmitting] = useState(false); // Đang gửi yêu cầu
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({}); // Lỗi từng trường

  // Xóa lỗi của một trường khi người dùng nhập lại
  const clearFieldError = (field: keyof FieldErrors) => {
    setFieldErrors(prev => {
      if (prev[field]) {
        const next = { ...prev };
        delete next[field];
        return next;
      }
      return prev;
    });
  };

  // Kiểm tra hợp lệ (kể cả mật khẩu mới không trùng mật khẩu cũ) rồi gọi API đổi mật khẩu
  const validateAndSubmit = async () => {
    const errors: FieldErrors = {};

    if (!oldPassword.trim()) {
      errors.oldPassword = "Vui lòng nhập mật khẩu cũ";
    }

    if (!newPassword.trim()) {
      errors.newPassword = "Vui lòng nhập mật khẩu mới";
    } else if (newPassword.length < PASSWORD_MIN_LENGTH) {
      errors.newPassword = `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự`;
    } else {
      const passwordRegex = /^(?=.*[A-Z])(?=.*\d)/;
      if (!passwordRegex.test(newPassword)) {
        errors.newPassword = "Mật khẩu phải có ít nhất 1 chữ hoa và 1 chữ số";
      }
    }

    if (!confirmPassword.trim()) {
      errors.confirmPassword = "Vui lòng xác nhận mật khẩu mới";
    } else if (newPassword !== confirmPassword) {
      errors.confirmPassword = "Mật khẩu xác nhận không khớp";
    }

    if (oldPassword && newPassword && oldPassword === newPassword) {
      errors.newPassword = "Mật khẩu mới không được trùng với mật khẩu cũ";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    const result = await changePassword(oldPassword, newPassword);

    setIsSubmitting(false);

    if (result.success) {
      confirm({
        title: "Thành công",
        message: "Mật khẩu đã được thay đổi.",
        confirmText: "Xác nhận",
        showCancel: false,
        onConfirm: () => router.back(),
      });
    } else {
      setFieldErrors({ apiError: result.error || "Đổi mật khẩu thất bại. Vui lòng thử lại." });
    }
  };

  // Tạo một ô nhập mật khẩu dùng chung (có nút hiện/ẩn và hiển thị lỗi)
  const renderPasswordField = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    showPass: boolean,
    togglePass: () => void,
    error?: string,
  ) => (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputWrap, error && styles.inputWrapError]}>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={LuxeColors.outline}
          value={value}
          onChangeText={text => {
            onChangeText(text);
            clearFieldError(label as keyof FieldErrors);
          }}
          secureTextEntry={!showPass}
          autoCapitalize="none"
          autoComplete="password-new"
        />
        <TouchableOpacity style={styles.eyeBtn} onPress={togglePass} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name={showPass ? "eye-off" : "eye"} size={18} color={LuxeColors.onSurfaceVariant} />
        </TouchableOpacity>
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Header title="Đổi mật khẩu" onBack={() => router.back()} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Icon */}
          <View style={styles.iconSection}>
            <View style={styles.iconWrap}>
              <Feather name="lock" size={32} color={LuxeColors.primaryContainer} />
            </View>
            <Text style={styles.iconTitle}>Đổi mật khẩu</Text>
            <Text style={styles.iconSubtitle}>Cập nhật mật khẩu để bảo vệ tài khoản</Text>
          </View>

          {/* Form Card */}
          <View style={styles.formCard}>
            {fieldErrors.apiError && (
              <View style={styles.apiErrorBanner}>
                <Feather name="alert-circle" size={16} color="#dc2626" />
                <Text style={styles.apiErrorText}>{fieldErrors.apiError}</Text>
              </View>
            )}

            {renderPasswordField("Mật khẩu cũ", oldPassword, setOldPassword, "Nhập mật khẩu cũ", showOldPassword, () => setShowOldPassword(p => !p), fieldErrors.oldPassword)}

            {renderPasswordField("Mật khẩu mới", newPassword, setNewPassword, "Nhập mật khẩu mới", showNewPassword, () => setShowNewPassword(p => !p), fieldErrors.newPassword)}

            {renderPasswordField("Xác nhận mật khẩu", confirmPassword, setConfirmPassword, "Nhập lại mật khẩu mới", showConfirmPassword, () => setShowConfirmPassword(p => !p), fieldErrors.confirmPassword)}

            {/* Password Rules */}
            <View style={styles.rulesHint}>
              <Text style={styles.rulesTitle}>Yêu cầu mật khẩu:</Text>
              <View style={styles.ruleItem}>
                <Feather name={newPassword.length >= PASSWORD_MIN_LENGTH ? "check-circle" : "circle"} size={14} color={newPassword.length >= PASSWORD_MIN_LENGTH ? '#10b981' : LuxeColors.outline} />
                <Text style={[styles.ruleText, newPassword.length >= PASSWORD_MIN_LENGTH && styles.ruleTextOk]}>Ít nhất 8 ký tự</Text>
              </View>
              <View style={styles.ruleItem}>
                <Feather name={/(?=.*[A-Z])/.test(newPassword) ? "check-circle" : "circle"} size={14} color={/(?=.*[A-Z])/.test(newPassword) ? '#10b981' : LuxeColors.outline} />
                <Text style={[styles.ruleText, /(?=.*[A-Z])/.test(newPassword) && styles.ruleTextOk]}>Chứa ít nhất 1 chữ hoa (A-Z)</Text>
              </View>
              <View style={styles.ruleItem}>
                <Feather name={/(?=.*\d)/.test(newPassword) ? "check-circle" : "circle"} size={14} color={/(?=.*\d)/.test(newPassword) ? '#10b981' : LuxeColors.outline} />
                <Text style={[styles.ruleText, /(?=.*\d)/.test(newPassword) && styles.ruleTextOk]}>Chứa ít nhất 1 chữ số (0-9)</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
              onPress={validateAndSubmit}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Feather name="check" size={18} color="#ffffff" />
                  <Text style={styles.submitBtnText}>Xác nhận</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: LuxeColors.background },
  keyboardView: { flex: 1 },
  scrollContent: { padding: 20, paddingTop: 24 },
  iconSection: { alignItems: "center", marginBottom: 24 },
  iconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: LuxeColors.primaryContainer + '18',
    alignItems: "center", justifyContent: "center",
    marginBottom: 16,
  },
  iconTitle: { fontSize: 22, fontWeight: "800", color: LuxeColors.onSurface, marginBottom: 6 },
  iconSubtitle: { fontSize: 14, color: LuxeColors.onSurfaceVariant, textAlign: "center" },
  formCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 24,
    ...LuxeShadows.lg,
  },
  apiErrorBanner: {
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  apiErrorText: { fontSize: 13, color: "#DC2626", fontWeight: "500", flex: 1 },
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: LuxeColors.onSurfaceVariant, marginBottom: 8 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: LuxeColors.background,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: LuxeColors.outlineVariant,
  },
  inputWrapError: { borderColor: "#ef4444" },
  input: { flex: 1, paddingVertical: 14, paddingHorizontal: 14, fontSize: 15, color: LuxeColors.onSurface },
  eyeBtn: { paddingHorizontal: 14, paddingVertical: 14 },
  errorText: { fontSize: 12, color: "#ef4444", marginTop: 6, fontWeight: "500" },
  rulesHint: {
    backgroundColor: LuxeColors.surfaceContainer,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 8,
  },
  rulesTitle: { fontSize: 12, fontWeight: "600", color: LuxeColors.onSurfaceVariant, marginBottom: 4 },
  ruleItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  ruleText: { fontSize: 12, color: LuxeColors.onSurfaceVariant },
  ruleTextOk: { color: '#10b981', fontWeight: "600" },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: LuxeColors.primaryContainer,
    borderRadius: 14,
    paddingVertical: 16,
    ...LuxeShadows.primary,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
});
