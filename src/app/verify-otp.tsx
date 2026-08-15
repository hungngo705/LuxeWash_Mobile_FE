/**
 * Verify OTP Screen - LuxeWash
 * Xác thực email bằng mã OTP gửi qua email
 */

import {
  LuxeBorderRadius,
  LuxeColors,
  LuxeShadows,
} from "@/constants/luxeTheme";
import { useAuth } from "@/contexts/AuthContext";
import { authService } from "@/services/api/authService";
import { ApiError } from "@/services/api/client";
import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const OTP_LENGTH = 6;

function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return email;
  const [local] = email.split("@");
  if (local.length <= 2) return `${local}***@${email.split("@")[1]}`;
  const first = local.slice(0, 2);
  const last = local.slice(-2);
  return `${first}***${last}@${email.split("@")[1]}`;
}

export default function VerifyOtpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const { loginFromOtp } = useAuth();

  const email = params.email ?? "";

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  const isOtpComplete = otp.every(d => d.length === 1 && /^\d$/.test(d));

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown > 0]);

  const handleOtpChange = (index: number, value: string) => {
    setApiError(null);

    // Handle paste: when value length > 1, it means user pasted digits
    if (value.length > 1) {
      const digits = value.replace(/\D/g, "").slice(0, OTP_LENGTH);
      const newOtp = Array(OTP_LENGTH).fill("");
      for (let i = 0; i < digits.length; i++) {
        newOtp[i] = digits[i];
      }
      setOtp(newOtp);
      const nextIndex = Math.min(digits.length, OTP_LENGTH - 1);
      inputRefs.current[nextIndex]?.focus();
      if (digits.length >= OTP_LENGTH) {
        inputRefs.current[OTP_LENGTH - 1]?.blur();
      }
      return;
    }

    const cleaned = value.replace(/\D/g, "").slice(-1);
    const newOtp = [...otp];
    newOtp[index] = cleaned;
    setOtp(newOtp);

    if (cleaned && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (index: number, e: { nativeEvent: { key: string } }) => {
    if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async () => {
    if (!isOtpComplete || isSubmitting) return;

    Keyboard.dismiss();
    setIsSubmitting(true);
    setApiError(null);

    const otpCode = otp.join("");

    const timeoutId = setTimeout(() => {
      setIsSubmitting(false);
    }, 15000);

    try {
      const response = await authService.verifyOtp({ email, otp: otpCode });

      clearTimeout(timeoutId);

      if (response.statusCode !== 200) {
        setApiError(response.message || "Mã xác thực không chính xác.");
        setIsSubmitting(false);
        return;
      }

      const data = response.data!;

      await loginFromOtp(
        String(data.userId),
        data.phoneNumber,
        data.fullName,
        data.role,
      );

      Alert.alert(
        "Thành công",
        "Xác thực OTP thành công! Bạn đã đăng ký tài khoản thành công.",
        [{ text: "Xác nhận", onPress: () => router.replace("/(main)") }],
      );
    } catch (error) {
      clearTimeout(timeoutId);
      const message =
        error instanceof ApiError
          ? error.message
          : "Đã xảy ra lỗi. Vui lòng thử lại.";
      setApiError(message);
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || isResending) return;
    setIsResending(true);
    setResendError(null);

    try {
      await authService.resendOtp({ email });
      setCountdown(30);
      setOtp(Array(OTP_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    } catch (error) {
      setResendError(
        error instanceof ApiError
          ? error.message
          : "Không thể gửi lại mã. Thử lại sau.",
      );
    } finally {
      setIsResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.brandStrip} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="arrow-left" size={24} color={LuxeColors.onSurface} />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Feather name="mail" size={32} color={LuxeColors.primaryContainer} />
            </View>
            <Text style={styles.title}>Xác thực email</Text>
            <Text style={styles.subtitle}>
              Nhập mã 6 chữ số gửi đến{"\n"}
              <Text style={styles.emailText}>{maskEmail(email)}</Text>
            </Text>
          </View>

          {/* OTP Input Row */}
          <View style={styles.otpRow}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={el => { inputRefs.current[index] = el; }}
                style={[
                  styles.otpInput,
                  apiError && styles.otpInputError,
                  digit && styles.otpInputFilled,
                ]}
                value={digit}
                onChangeText={v => handleOtpChange(index, v)}
                onKeyPress={e => handleKeyPress(index, e)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                autoFocus={index === 0}
              />
            ))}
          </View>

          {/* API Error Banner */}
          {apiError && (
            <View style={styles.errorBanner}>
              <Feather name="alert-circle" size={16} color="#dc2626" />
              <Text style={styles.errorText}>{apiError}</Text>
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              (!isOtpComplete || isSubmitting) && styles.submitBtnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!isOtpComplete || isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.submitBtnText}>Xác nhận</Text>
            )}
          </TouchableOpacity>

          {/* Resend Section */}
          <View style={styles.resendSection}>
            {countdown > 0 ? (
              <Text style={styles.resendText}>
                Gửi lại mã sau {countdown}s
              </Text>
            ) : (
              <TouchableOpacity
                onPress={handleResend}
                disabled={isResending}
              >
                <Text style={styles.resendLink}>
                  {isResending ? "Đang gửi..." : "Gửi lại mã"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Resend Error Banner */}
          {resendError && (
            <View style={styles.errorBanner}>
              <Feather name="alert-circle" size={16} color="#dc2626" />
              <Text style={styles.errorText}>{resendError}</Text>
            </View>
          )}

          {/* Footer */}
          <Text style={styles.footer}>Mã hết hạn trong 10 phút</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const INPUT_SIZE = (SCREEN_WIDTH - 48 - 48 - 10 * 5) / 6;

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
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -4,
    marginBottom: 8,
  },
  header: {
    alignItems: "center",
    marginTop: 8,
    marginBottom: 36,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: LuxeColors.primaryContainer + "20",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    borderWidth: 2,
    borderColor: LuxeColors.primaryContainer + "40",
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: LuxeColors.onSurface,
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: LuxeColors.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 22,
  },
  emailText: {
    fontWeight: "700",
    color: LuxeColors.primaryContainer,
  },
  otpRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginBottom: 20,
  },
  otpInput: {
    width: INPUT_SIZE,
    height: INPUT_SIZE,
    borderRadius: LuxeBorderRadius.lg,
    borderWidth: 2,
    borderColor: LuxeColors.outlineVariant,
    backgroundColor: LuxeColors.surfaceContainerLowest,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "700",
    color: LuxeColors.onSurface,
    paddingVertical: 0,
    ...Platform.select({ ios: { paddingVertical: 0 }, android: { paddingTop: 0, paddingBottom: 2 } }),
    overflow: "hidden",
  },
  otpInputFilled: {
    borderColor: LuxeColors.primaryContainer,
    backgroundColor: LuxeColors.primaryContainer + "10",
  },
  otpInputError: {
    borderColor: "#ef4444",
  },
  errorBanner: {
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
  errorText: {
    fontSize: 13,
    color: "#DC2626",
    fontWeight: "500",
    flex: 1,
  },
  submitBtn: {
    height: 57,
    backgroundColor: LuxeColors.primaryContainer,
    borderRadius: LuxeBorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    ...LuxeShadows.primary,
  },
  submitBtnDisabled: {
    opacity: 0.55,
  },
  submitBtnText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  resendSection: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
    gap: 4,
  },
  resendText: {
    fontSize: 14,
    color: LuxeColors.onSurfaceVariant,
  },
  resendLink: {
    fontSize: 14,
    fontWeight: "700",
    color: LuxeColors.primaryContainer,
  },
  footer: {
    textAlign: "center",
    fontSize: 12,
    color: LuxeColors.outline,
    marginTop: 8,
  },
});
