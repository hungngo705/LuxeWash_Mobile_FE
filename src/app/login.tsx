/**
 * Login Screen - LuxeWash
 * Professional bold redesign with solid white cards and brand accents
 */

import {
  LuxeBorderRadius,
  LuxeColors,
  LuxeSpacing,
  LuxeShadows,
} from "@/constants/luxeTheme";
import { useAuth } from "@/contexts/AuthContext";
import { authService } from "@/services/api/authService";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
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

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoggingIn } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingEmailError, setPendingEmailError] = useState("");

  const handleLogin = async () => {
    if (!phoneNumber.trim()) {
      alert("Vui lòng nhập số điện thoại");
      return;
    }
    if (!password.trim()) {
      alert("Vui lòng nhập mật khẩu");
      return;
    }

    setPendingEmail("");
    setPendingEmailError("");
    setShowOtpModal(false);
    const result = await login({ phoneOrEmail: phoneNumber.trim(), password });

    if (result.success) {
      router.replace("/(main)" as any);
    } else {
      if (result.unverifiedEmail !== undefined) {
        setPendingEmail(result.unverifiedEmail || "");
        setShowOtpModal(true);
      } else {
        alert(result.error || "Vui lòng thử lại");
      }
    }
  };

  const handleVerifyOtp = async () => {
    const email = pendingEmail.trim();
    if (!email) {
      setPendingEmailError("Vui lòng nhập địa chỉ email của bạn");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setPendingEmailError("Địa chỉ email không hợp lệ");
      return;
    }
    setPendingEmailError("");
    const res = await authService.resendOtp({ email });
    if (res.statusCode === 200 || res.statusCode === 201) {
      router.push({ pathname: "/verify-otp", params: { email } });
    } else {
      alert(res.message || "Không thể gửi mã OTP. Vui lòng thử lại.");
    }
  };

  return (
    <>
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
                <Feather name="sun" size={36} color={LuxeColors.primaryContainer} />
              </View>
            </View>
            <Text style={styles.brandName}>LuxeWash</Text>
            <Text style={styles.brandTagline}>Premium Car Care</Text>
          </View>

            {/* Form Card */}
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Đăng nhập</Text>
            <Text style={styles.formSubtitle}>
              Chào mừng bạn quay trở lại
            </Text>

            {/* Phone / Email Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Số điện thoại / Email</Text>
              <View style={styles.inputWrap}>
                <View style={styles.inputIcon}>
                  <Feather name="user" size={18} color={LuxeColors.onSurfaceVariant} />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Nhập số điện thoại hoặc email"
                  placeholderTextColor={LuxeColors.outline}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </View>
            </View>

            {/* Password Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Mật khẩu</Text>
              <View style={styles.inputWrap}>
                <View style={styles.inputIcon}>
                  <Feather name="lock" size={18} color={LuxeColors.onSurfaceVariant} />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Nhập mật khẩu"
                  placeholderTextColor={LuxeColors.outline}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword((prev) => !prev)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Feather
                    name={showPassword ? "eye-off" : "eye"}
                    size={18}
                    color={LuxeColors.onSurfaceVariant}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.loginBtn, isLoggingIn && styles.loginBtnDisabled]}
              onPress={handleLogin}
              disabled={isLoggingIn}
              activeOpacity={0.85}
            >
              {isLoggingIn ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Text style={styles.loginBtnText}>Đăng nhập</Text>
                  <Feather name="arrow-right" size={18} color="#ffffff" />
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Register Link */}
          <View style={styles.registerSection}>
            <Text style={styles.registerText}>Chưa có tài khoản? </Text>
            <TouchableOpacity onPress={() => router.push("/register" as any)}>
              <Text style={styles.registerLink}>Đăng ký ngay</Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <Text style={styles.footer}>LuxeWash v1.0.0</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>

    {/* Unverified Email Modal */}
    {showOtpModal && (
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowOtpModal(false)}
        />
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={styles.modalIconWrap}>
              <Feather name="mail" size={28} color="#D97706" />
            </View>
            <Text style={styles.modalTitle}>Xác thực email</Text>
            <Text style={styles.modalSubtitle}>
              Tài khoản của bạn chưa xác thực email.{'\n'}
              Vui lòng nhập email đã đăng ký để nhận mã OTP.
            </Text>
          </View>

          <View style={styles.modalEmailInput}>
            <Feather name="at-sign" size={16} color={LuxeColors.onSurfaceVariant} />
            <TextInput
              style={styles.modalEmailField}
              placeholder="Nhập email của bạn"
              placeholderTextColor={LuxeColors.outline}
              value={pendingEmail}
              onChangeText={text => {
                setPendingEmail(text);
                setPendingEmailError("");
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {pendingEmailError ? (
            <Text style={styles.emailInputError}>{pendingEmailError}</Text>
          ) : null}

          <TouchableOpacity
            style={styles.modalSendBtn}
            onPress={handleVerifyOtp}
            activeOpacity={0.85}
          >
            <Feather name="send" size={16} color="#ffffff" />
            <Text style={styles.modalSendBtnText}>Gửi mã OTP</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.modalCancelBtn}
            onPress={() => setShowOtpModal(false)}
          >
            <Text style={styles.modalCancelText}>Đóng</Text>
          </TouchableOpacity>
        </View>
      </View>
    )}
    </>
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
    paddingTop: 16,
    paddingBottom: 32,
  },
  header: {
    alignItems: "center",
    marginTop: 8,
    marginBottom: 32,
  },
  logoWrap: {
    marginBottom: 12,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: LuxeColors.primaryContainer + '20',
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: LuxeColors.primaryContainer + '40',
  },
  brandName: {
    fontSize: 30,
    fontWeight: "800",
    color: LuxeColors.primaryContainer,
    letterSpacing: 2,
  },
  brandTagline: {
    fontSize: 13,
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
    marginBottom: 24,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: LuxeColors.onSurface,
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: 14,
    color: LuxeColors.onSurfaceVariant,
    marginBottom: 24,
  },
  fieldGroup: {
    marginBottom: 16,
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
  inputIcon: {
    paddingLeft: 14,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    fontSize: 15,
    color: LuxeColors.onSurface,
  },
  eyeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  loginBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: LuxeColors.primaryContainer,
    borderRadius: LuxeBorderRadius.lg,
    paddingVertical: 16,
    marginTop: 8,
    ...LuxeShadows.primary,
  },
  loginBtnDisabled: {
    opacity: 0.7,
  },
  loginBtnText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  registerSection: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  registerText: {
    fontSize: 14,
    color: LuxeColors.onSurfaceVariant,
  },
  registerLink: {
    fontSize: 14,
    fontWeight: "700",
    color: LuxeColors.primaryContainer,
  },
  emailInputError: {
    fontSize: 12,
    color: "#DC2626",
    fontWeight: "500",
    marginBottom: 8,
  },
  footer: {
    textAlign: "center",
    fontSize: 12,
    color: LuxeColors.outline,
    marginTop: 8,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalCard: {
    backgroundColor: "#ffffff",
    borderRadius: LuxeBorderRadius.xl,
    padding: 28,
    marginHorizontal: 24,
    width: Math.min(SCREEN_WIDTH - 48, 360),
    ...LuxeShadows.xl,
  },
  modalHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  modalIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FFFBEB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: LuxeColors.onSurface,
    marginBottom: 8,
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 14,
    color: LuxeColors.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 20,
  },
  modalEmailInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: LuxeColors.background,
    borderRadius: LuxeBorderRadius.lg,
    borderWidth: 1.5,
    borderColor: LuxeColors.outlineVariant,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  modalEmailField: {
    flex: 1,
    fontSize: 15,
    color: LuxeColors.onSurface,
  },
  modalSendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#D97706",
    borderRadius: LuxeBorderRadius.lg,
    paddingVertical: 14,
    marginTop: 8,
    ...LuxeShadows.primary,
  },
  modalSendBtnText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  modalCancelBtn: {
    alignItems: "center",
    paddingVertical: 12,
    marginTop: 4,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: LuxeColors.onSurfaceVariant,
  },
});
