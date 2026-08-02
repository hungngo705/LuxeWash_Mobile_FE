/**
 * Register Screen - LuxeWash
 * Professional bold redesign with solid white cards and brand accents
 */

import {
  LuxeBorderRadius,
  LuxeColors,
  LuxeSpacing,
  LuxeShadows,
} from "@/constants/luxeTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
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
import { Feather } from "@expo/vector-icons";

const PASSWORD_MIN_LENGTH = 8; // Độ dài mật khẩu tối thiểu

/** Lỗi cho từng trường trong form đăng ký (kèm lỗi trả về từ API). */
interface FieldErrors {
  fullName?: string;
  phoneNumber?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  apiError?: string;
}

/**
 * Màn hình Đăng ký.
 * Thu thập họ tên, SĐT, email, mật khẩu; validate phía client rồi gọi API đăng ký.
 * Thành công thì chuyển sang màn xác thực OTP theo email.
 */
export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false); // Đang gửi đăng ký
  const [showPassword, setShowPassword] = useState(false); // Hiện/ẩn mật khẩu
  const [showConfirmPassword, setShowConfirmPassword] = useState(false); // Hiện/ẩn mật khẩu xác nhận
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({}); // Lỗi từng trường

  // Xóa lỗi của một trường khi người dùng bắt đầu nhập lại
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

  // Kiểm tra hợp lệ toàn bộ form rồi gửi đăng ký; gom lỗi theo từng trường
  const validateAndSubmit = async () => {
    Keyboard.dismiss();

    const errors: FieldErrors = {};

    if (!fullName.trim()) {
      errors.fullName = "Vui lòng nhập họ và tên";
    }

    if (!phoneNumber.trim()) {
      errors.phoneNumber = "Vui lòng nhập số điện thoại";
    }

    if (!email.trim()) {
      errors.email = "Vui lòng nhập email";
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        errors.email = "Email không hợp lệ";
      }
    }

    if (!password.trim()) {
      errors.password = "Vui lòng nhập mật khẩu";
    } else if (password.length < PASSWORD_MIN_LENGTH) {
      errors.password = `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự`;
    } else {
      const passwordRegex = /^(?=.*[A-Z])(?=.*\d)/;
      if (!passwordRegex.test(password)) {
        errors.password = "Mật khẩu phải có ít nhất 1 chữ hoa và 1 chữ số";
      }
    }

    if (!confirmPassword.trim()) {
      errors.confirmPassword = "Vui lòng xác nhận mật khẩu";
    } else if (password !== confirmPassword) {
      errors.confirmPassword = "Mật khẩu xác nhận không khớp";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    const result = await register(
      phoneNumber.trim(),
      email.trim(),
      password,
      fullName.trim(),
    );

    setIsSubmitting(false);

    if (result.success) {
      router.replace({
        pathname: "/verify-otp",
        params: { email: email.trim() },
      });
    } else {
      setFieldErrors({ apiError: result.error || "Đăng ký thất bại. Vui lòng thử lại." });
    }
  };

  // Hàm tạo một ô nhập liệu dùng chung cho các trường trong form (kèm nút hiện/ẩn mật khẩu và lỗi)
  const renderInput = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    error?: string,
    keyboardType: "default" | "email-address" | "phone-pad" | "visible-password" = "default",
    secureTextEntry = false,
    autoCapitalize: "none" | "words" | "sentences" = "sentences",
    maxLength?: number,
    showPasswordToggle?: boolean,
    togglePasswordVisible?: () => void,
    isPasswordVisible?: boolean,
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
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          autoCapitalize={autoCapitalize}
          maxLength={maxLength}
        />
        {showPasswordToggle && togglePasswordVisible && (
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={togglePasswordVisible}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather
              name={isPasswordVisible ? "eye-off" : "eye"}
              size={18}
              color={LuxeColors.onSurfaceVariant}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Brand Accent Bar */}
      <View style={styles.brandStrip} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoWrap}>
              <View style={styles.logoCircle}>
                <Feather name="sun" size={30} color={LuxeColors.primaryContainer} />
              </View>
            </View>
            <Text style={styles.brandName}>LuxeWash</Text>
            <Text style={styles.brandTagline}>Premium Car Care</Text>
          </View>

          {/* Form Card */}
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Tạo tài khoản</Text>
            <Text style={styles.formSubtitle}>
              Đăng ký để trải nghiệm dịch vụ rửa xe cao cấp
            </Text>

            {/* API Error Banner */}
            {fieldErrors.apiError && (
              <View style={styles.apiErrorBanner}>
                <Feather name="alert-circle" size={16} color="#dc2626" />
                <Text style={styles.apiErrorText}>{fieldErrors.apiError}</Text>
              </View>
            )}

            {renderInput(
              "Họ và tên",
              fullName,
              setFullName,
              "Nhập họ và tên",
              fieldErrors.fullName,
              "default",
              false,
              "words",
            )}

            {renderInput(
              "Số điện thoại",
              phoneNumber,
              setPhoneNumber,
              "Nhập số điện thoại",
              fieldErrors.phoneNumber,
              "phone-pad",
              false,
              "none",
              12,
            )}

            {renderInput(
              "Email",
              email,
              setEmail,
              "Nhập email",
              fieldErrors.email,
              "email-address",
              false,
              "none",
            )}

            {renderInput(
              "Mật khẩu",
              password,
              setPassword,
              `Ít nhất ${PASSWORD_MIN_LENGTH} ký tự, 1 chữ hoa và 1 số`,
              fieldErrors.password,
              "visible-password",
              true,
              "none",
              undefined,
              true,
              () => setShowPassword(prev => !prev),
              showPassword,
            )}

            {renderInput(
              "Xác nhận mật khẩu",
              confirmPassword,
              setConfirmPassword,
              "Nhập lại mật khẩu",
              fieldErrors.confirmPassword,
              "visible-password",
              true,
              "none",
              undefined,
              true,
              () => setShowConfirmPassword(prev => !prev),
              showConfirmPassword,
            )}

            <View style={styles.btnWrapper}>
              <TouchableOpacity
                style={[
                  styles.registerBtn,
                  isSubmitting && styles.registerBtnDisabled,
                ]}
                onPress={validateAndSubmit}
                disabled={isSubmitting}
                activeOpacity={0.85}
              >
                <View style={styles.registerBtnContent}>
                  {isSubmitting ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <>
                      <Text style={styles.registerBtnText}>Đăng ký</Text>
                      <Feather name="arrow-right" size={18} color="#ffffff" />
                    </>
                  )}
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Login Link */}
          <View style={styles.loginSection}>
            <Text style={styles.loginText}>Đã có tài khoản? </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.loginLink}>Đăng nhập ngay</Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <Text style={styles.footer}>LuxeWash v1.0.0</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LuxeColors.background,
  },
  brandStrip: {
    height: 5,
    backgroundColor: LuxeColors.primaryContainer,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 32,
  },
  header: {
    alignItems: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  logoWrap: {
    marginBottom: 10,
  },
  logoCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: LuxeColors.primaryContainer + '20',
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: LuxeColors.primaryContainer + '40',
  },
  brandName: {
    fontSize: 26,
    fontWeight: "800",
    color: LuxeColors.primaryContainer,
    letterSpacing: 2,
  },
  brandTagline: {
    fontSize: 12,
    color: LuxeColors.onSurfaceVariant,
    marginTop: 4,
    fontWeight: '500',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  formCard: {
    backgroundColor: "#ffffff",
    borderRadius: LuxeBorderRadius.xl,
    padding: 24,
    ...LuxeShadows.lg,
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: LuxeColors.onSurface,
    textAlign: 'center',
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: 13,
    color: LuxeColors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  apiErrorBanner: {
    backgroundColor: "#FEF2F2",
    borderRadius: LuxeBorderRadius.lg,
    padding: 12,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  apiErrorText: {
    fontSize: 13,
    color: "#DC2626",
    fontWeight: "500",
    flex: 1,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: LuxeColors.onSurfaceVariant,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: LuxeColors.background,
    borderRadius: LuxeBorderRadius.lg,
    borderWidth: 1.5,
    borderColor: LuxeColors.outlineVariant,
    overflow: "hidden",
  },
  inputWrapError: {
    borderColor: "#ef4444",
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    fontSize: 15,
    color: LuxeColors.onSurface,
  },
  eyeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  errorText: {
    fontSize: 12,
    color: "#ef4444",
    marginTop: 6,
    fontWeight: "500",
  },
  registerBtn: {
    height: 57,
    backgroundColor: LuxeColors.primaryContainer,
    borderRadius: LuxeBorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    ...LuxeShadows.primary,
  },
  registerBtnDisabled: {
    opacity: 0.7,
  },
  btnWrapper: {
    marginTop: 6,
  },
  registerBtnContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 24,
  },
  registerBtnText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  loginSection: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  loginText: {
    fontSize: 14,
    color: LuxeColors.onSurfaceVariant,
  },
  loginLink: {
    fontSize: 14,
    fontWeight: "700",
    color: LuxeColors.primaryContainer,
  },
  footer: {
    textAlign: "center",
    fontSize: 12,
    color: LuxeColors.outline,
    marginTop: 4,
  },
});
