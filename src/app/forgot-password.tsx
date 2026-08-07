import { Header } from "@/components/ui/Header";
import { LuxeBorderRadius, LuxeColors } from "@/constants/luxeTheme";
import { authService } from "@/services/api/authService";
import { ApiError } from "@/services/api/client";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ResetStep = "email" | "reset" | "success";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;

const maskEmail = (email: string) => {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local.charAt(0)}***@${domain}`;
  return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
};

const getFriendlyError = (error: unknown, fallback: string) => {
  if (!(error instanceof ApiError)) return fallback;

  const message = error.message.toLowerCase();
  if (message.includes("no account found")) {
    return "Không tìm thấy tài khoản đăng ký bằng email này.";
  }
  if (message.includes("not activated") || message.includes("locked")) {
    return "Tài khoản chưa được kích hoạt hoặc đang bị khóa.";
  }
  if (message.includes("could not send")) {
    return "Không thể gửi email OTP lúc này. Vui lòng thử lại sau.";
  }
  if (message.includes("expired")) {
    return "Mã OTP đã hết hạn. Vui lòng gửi lại mã mới.";
  }
  if (message.includes("incorrect otp")) {
    return "Mã OTP không chính xác.";
  }
  if (message.includes("no password reset request")) {
    return "Chưa có yêu cầu đặt lại mật khẩu. Vui lòng gửi lại OTP.";
  }
  return error.message || fallback;
};

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = useState<ResetStep>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const normalizedEmail = email.trim().toLowerCase();
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasNumber = /\d/.test(newPassword);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const title = useMemo(() => {
    if (step === "success") return "Đặt lại thành công";
    if (step === "reset") return "Nhập mã xác thực";
    return "Quên mật khẩu";
  }, [step]);

  const handleBack = () => {
    if (step === "reset") {
      setStep("email");
      setError(null);
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/login");
    }
  };

  const requestOtp = async (isResend = false) => {
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setError("Vui lòng nhập địa chỉ email hợp lệ.");
      return;
    }

    if (isResend) setIsResending(true);
    else setIsRequesting(true);
    setError(null);

    try {
      const response = await authService.forgotPassword({ email: normalizedEmail });
      if (response.statusCode !== 200) {
        setError(response.message || "Không thể gửi mã OTP.");
        return;
      }

      setOtp("");
      setCountdown(RESEND_SECONDS);
      setStep("reset");
    } catch (requestError) {
      setError(getFriendlyError(requestError, "Không thể gửi mã OTP. Vui lòng thử lại."));
    } finally {
      setIsRequesting(false);
      setIsResending(false);
    }
  };

  const handleResetPassword = async () => {
    Keyboard.dismiss();
    setError(null);

    if (!/^\d{6}$/.test(otp)) {
      setError("Mã OTP phải gồm đúng 6 chữ số.");
      return;
    }
    if (!PASSWORD_PATTERN.test(newPassword)) {
      setError("Mật khẩu mới phải có ít nhất 8 ký tự, gồm chữ hoa và chữ số.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setIsResetting(true);
    try {
      const response = await authService.resetPassword({
        email: normalizedEmail,
        otp,
        newPassword,
      });

      if (response.statusCode !== 200) {
        setError(response.message || "Không thể đặt lại mật khẩu.");
        return;
      }

      setNewPassword("");
      setConfirmPassword("");
      setOtp("");
      setStep("success");
    } catch (resetError) {
      setError(getFriendlyError(resetError, "Không thể đặt lại mật khẩu. Vui lòng thử lại."));
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <Header title={title} onBack={handleBack} />

      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === "email" && (
            <View style={styles.contentWrap}>
              <View style={styles.heroIcon}>
                <Feather name="key" size={30} color={LuxeColors.primary} />
              </View>
              <Text style={styles.heading}>Khôi phục tài khoản</Text>
              <Text style={styles.description} selectable>
                Nhập email đã đăng ký. LuxeWash sẽ gửi mã OTP có hiệu lực trong 10 phút.
              </Text>

              <View style={styles.formCard}>
                <Text style={styles.fieldLabel}>Email</Text>
                <View style={[styles.inputWrap, error && styles.inputWrapError]}>
                  <Feather name="mail" size={18} color={LuxeColors.onSurfaceVariant} />
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={value => {
                      setEmail(value);
                      setError(null);
                    }}
                    placeholder="Nhập email của bạn"
                    placeholderTextColor={LuxeColors.outline}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    returnKeyType="send"
                    onSubmitEditing={() => requestOtp(false)}
                  />
                </View>

                {error && <ErrorBanner message={error} />}

                <PrimaryButton
                  label="Gửi mã OTP"
                  icon="send"
                  loading={isRequesting}
                  onPress={() => requestOtp(false)}
                />
              </View>
            </View>
          )}

          {step === "reset" && (
            <View style={styles.contentWrap}>
              <View style={styles.heroIcon}>
                <Feather name="shield" size={30} color={LuxeColors.primary} />
              </View>
              <Text style={styles.heading}>Kiểm tra email</Text>
              <Text style={styles.description} selectable>
                Nhập mã OTP 6 số đã gửi đến {maskEmail(normalizedEmail)} và tạo mật khẩu mới.
              </Text>

              <View style={styles.formCard}>
                <Text style={styles.fieldLabel}>Mã OTP</Text>
                <TextInput
                  style={styles.otpInput}
                  value={otp}
                  onChangeText={value => {
                    setOtp(value.replace(/\D/g, "").slice(0, OTP_LENGTH));
                    setError(null);
                  }}
                  placeholder="000000"
                  placeholderTextColor={LuxeColors.outlineVariant}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  maxLength={OTP_LENGTH}
                  caretHidden={false}
                />

                <PasswordField
                  label="Mật khẩu mới"
                  value={newPassword}
                  visible={showNewPassword}
                  onToggle={() => setShowNewPassword(value => !value)}
                  onChange={value => {
                    setNewPassword(value);
                    setError(null);
                  }}
                />
                <PasswordField
                  label="Xác nhận mật khẩu"
                  value={confirmPassword}
                  visible={showConfirmPassword}
                  onToggle={() => setShowConfirmPassword(value => !value)}
                  onChange={value => {
                    setConfirmPassword(value);
                    setError(null);
                  }}
                />

                <View style={styles.rulesBox}>
                  <PasswordRule met={hasMinLength} label="Ít nhất 8 ký tự" />
                  <PasswordRule met={hasUppercase} label="Có ít nhất một chữ hoa" />
                  <PasswordRule met={hasNumber} label="Có ít nhất một chữ số" />
                </View>

                {error && <ErrorBanner message={error} />}

                <PrimaryButton
                  label="Đặt lại mật khẩu"
                  icon="check"
                  loading={isResetting}
                  onPress={handleResetPassword}
                />

                <View style={styles.resendRow}>
                  <Text style={styles.resendText}>Chưa nhận được mã?</Text>
                  <TouchableOpacity
                    disabled={countdown > 0 || isResending}
                    onPress={() => requestOtp(true)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={[styles.resendLink, countdown > 0 && styles.resendDisabled]}>
                      {isResending
                        ? "Đang gửi..."
                        : countdown > 0
                          ? `Gửi lại sau ${countdown}s`
                          : "Gửi lại OTP"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {step === "success" && (
            <View style={styles.successWrap}>
              <View style={styles.successIcon}>
                <Feather name="check" size={38} color="#15803D" />
              </View>
              <Text style={styles.heading}>Mật khẩu đã được đặt lại</Text>
              <Text style={styles.description} selectable>
                Bạn có thể đăng nhập bằng mật khẩu mới. Các phiên đăng nhập cũ đã bị vô hiệu hóa.
              </Text>
              <PrimaryButton
                label="Về màn hình đăng nhập"
                icon="log-in"
                loading={false}
                onPress={() => router.replace("/login")}
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={styles.errorBanner}>
      <Feather name="alert-circle" size={16} color={LuxeColors.error} />
      <Text style={styles.errorText} selectable>{message}</Text>
    </View>
  );
}

function PasswordField({
  label,
  value,
  visible,
  onToggle,
  onChange,
}: {
  label: string;
  value: string;
  visible: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.passwordGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputWrap}>
        <Feather name="lock" size={18} color={LuxeColors.onSurfaceVariant} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          placeholder="Nhập mật khẩu"
          placeholderTextColor={LuxeColors.outline}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
        />
        <TouchableOpacity onPress={onToggle} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name={visible ? "eye-off" : "eye"} size={18} color={LuxeColors.onSurfaceVariant} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function PasswordRule({ met, label }: { met: boolean; label: string }) {
  return (
    <View style={styles.ruleRow}>
      <Feather name={met ? "check-circle" : "circle"} size={14} color={met ? "#15803D" : LuxeColors.outline} />
      <Text style={[styles.ruleText, met && styles.ruleTextMet]}>{label}</Text>
    </View>
  );
}

function PrimaryButton({
  label,
  icon,
  loading,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  loading: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.primaryButton, loading && styles.buttonDisabled]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color="#ffffff" />
      ) : (
        <>
          <Feather name={icon} size={18} color="#ffffff" />
          <Text style={styles.primaryButtonText}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: LuxeColors.background },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 20, paddingBottom: 36 },
  contentWrap: { width: "100%", maxWidth: 520, alignSelf: "center", alignItems: "center" },
  heroIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: LuxeColors.primaryContainer + "1F",
    marginTop: 16,
    marginBottom: 14,
  },
  heading: { fontSize: 23, fontWeight: "800", color: LuxeColors.onSurface, textAlign: "center" },
  description: {
    fontSize: 14,
    lineHeight: 21,
    color: LuxeColors.onSurfaceVariant,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 22,
  },
  formCard: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: LuxeBorderRadius.xl,
    padding: 20,
    boxShadow: "0 8px 24px rgba(0, 102, 137, 0.12)",
  },
  fieldLabel: { fontSize: 13, fontWeight: "700", color: LuxeColors.onSurfaceVariant, marginBottom: 8 },
  inputWrap: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: LuxeColors.background,
    borderRadius: LuxeBorderRadius.lg,
    borderWidth: 1.5,
    borderColor: LuxeColors.outlineVariant,
    paddingHorizontal: 14,
  },
  inputWrapError: { borderColor: LuxeColors.error },
  input: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 15,
    fontWeight: "400",
    letterSpacing: 0,
    textAlign: "left",
    color: LuxeColors.onSurface,
  },
  otpInput: {
    height: 58,
    borderWidth: 1.5,
    borderColor: LuxeColors.outlineVariant,
    borderRadius: LuxeBorderRadius.lg,
    backgroundColor: LuxeColors.background,
    color: LuxeColors.onSurface,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 12,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
    marginBottom: 18,
  },
  passwordGroup: { marginBottom: 16 },
  errorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderColor: LuxeColors.errorContainer,
    backgroundColor: "#FFF5F4",
    borderRadius: LuxeBorderRadius.lg,
    padding: 12,
    marginTop: 14,
  },
  errorText: { flex: 1, fontSize: 13, lineHeight: 18, color: LuxeColors.error, fontWeight: "600" },
  rulesBox: { gap: 8, backgroundColor: LuxeColors.surfaceContainerLow, borderRadius: LuxeBorderRadius.lg, padding: 13 },
  ruleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  ruleText: { fontSize: 12, color: LuxeColors.onSurfaceVariant },
  ruleTextMet: { color: "#15803D", fontWeight: "600" },
  primaryButton: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: LuxeColors.primary,
    borderRadius: LuxeBorderRadius.lg,
    paddingHorizontal: 18,
    marginTop: 18,
  },
  buttonDisabled: { opacity: 0.7 },
  primaryButtonText: { color: "#ffffff", fontSize: 15, fontWeight: "800" },
  resendRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 18 },
  resendText: { color: LuxeColors.onSurfaceVariant, fontSize: 13 },
  resendLink: { color: LuxeColors.primary, fontSize: 13, fontWeight: "800" },
  resendDisabled: { color: LuxeColors.outline },
  successWrap: {
    flex: 1,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 48,
  },
  successIcon: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DCFCE7",
    marginBottom: 20,
  },
});
