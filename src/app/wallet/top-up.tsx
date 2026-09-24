/**
 * Top-Up Screen
 * POST /api/v1/wallets/top-up -> returns paymentUrl, opens via WebBrowser
 * Polls GET /api/v1/wallets/me until balance increases after return
 */

import {
    LuxeBorderRadius,
    LuxeColors,
    LuxeSpacing,
} from "@/constants/luxeTheme";
import { useAuth } from "@/contexts/AuthContext";
import { walletService } from "@/services/api";
import { coinsToVnd, VND_PER_COIN } from "@/utils/format";
import { Feather } from "@expo/vector-icons";
import { useRouter, type RelativePathString } from "expo-router";
import React, { useRef, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { openBrowserAsync } from "expo-web-browser";
import { SafeAreaView } from "react-native-safe-area-context";

const PRESET_COINS = [50, 100, 200, 500];

const formatCoin = (coins: number): string => `${coins.toLocaleString("en-US")} coin`;

export default function TopUpScreen() {
  const router = useRouter();
  const { refreshWallet } = useAuth();

  const [amount, setAmount] = useState("100");
  const [selectedPreset, setSelectedPreset] = useState<number | null>(100);
  const [isLoading, setIsLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<
    "idle" | "success" | "cancelled"
  >("idle");
  const pollCount = useRef(0);
  const initialBalance = useRef(0);

  const handlePreset = (value: number) => {
    setSelectedPreset(value);
    setAmount(String(value));
  };

  const handleCustomAmount = (text: string) => {
    const numeric = text.replace(/[^0-9]/g, "");
    setSelectedPreset(null);
    setAmount(numeric);
  };

  const numericCoins = parseInt(amount, 10) || 0;
  const backendAmount = coinsToVnd(numericCoins);

  const getReturnUrl = (): string => {
    return "luxewash://wallet/top-up";
  };

  const getCancelUrl = (): string => {
    return "luxewash://wallet/top-up?status=cancelled";
  };

  const startPolling = async () => {
    setPolling(true);
    pollCount.current = 0;

    while (pollCount.current < 20) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      pollCount.current++;

      try {
        const res = await walletService.getBalance();
        if (res.statusCode === 200 && res.data) {
          if (res.data.balance > initialBalance.current) {
            setPaymentStatus("success");
            setPolling(false);
            return true;
          }
        }
      } catch {
        // continue polling
      }
    }

    setPolling(false);
    return false;
  };

  const handleTopUp = async () => {
    if (numericCoins < 10) {
      alert("Số coin nạp tối thiểu là 10 coin");
      return;
    }

    setIsLoading(true);
    setPaymentStatus("idle");

    try {
      const res = await walletService.topUp({
        amount: backendAmount,
        returnUrl: getReturnUrl(),
        cancelUrl: getCancelUrl(),
      });

      if (res.statusCode === 200 && res.data?.paymentUrl) {
        const paymentUrl: string = res.data.paymentUrl;

        const balanceRes = await walletService.getBalance();
        if (balanceRes.statusCode === 200 && balanceRes.data) {
          initialBalance.current = balanceRes.data.balance;
        }

        await openBrowserAsync(paymentUrl);
        startPolling();
      } else {
        alert(res.message || "Không thể khởi tạo thanh toán");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Đã xảy ra lỗi";
      alert(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const renderPolling = () => {
    if (!polling) return null;

    return (
      <View style={styles.pollingCard}>
        <ActivityIndicator size="small" color={LuxeColors.primaryContainer} />
        <Text style={styles.pollingText}>
          Đang xác nhận thanh toán... ({pollCount.current * 3}s)
        </Text>
        <Text style={styles.pollingSubtext}>Vui lòng không tắt ứng dụng</Text>
      </View>
    );
  };

  const renderSuccess = () => {
    if (paymentStatus !== "success") return null;

    return (
      <View style={styles.successCard}>
        <View
          style={[styles.successIconWrap, { backgroundColor: "#10b98120" }]}
        >
          <Feather name="check-circle" size={40} color="#10b981" />
        </View>
        <Text style={styles.successText}>Nạp coin thành công!</Text>
        <TouchableOpacity
          style={styles.doneBtn}
          onPress={() => {
            refreshWallet();
            router.replace("/wallet" as RelativePathString);
          }}
        >
          <Text style={styles.doneBtnText}>Xong</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={24} color={LuxeColors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nạp coin</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.section}>
          <Text style={styles.label}>Chọn số coin cần nạp</Text>
          <View style={styles.presetsGrid}>
            {PRESET_COINS.map((preset) => (
              <TouchableOpacity
                key={preset}
                style={[
                  styles.presetBtn,
                  selectedPreset === preset && styles.presetBtnSelected,
                ]}
                onPress={() => handlePreset(preset)}
              >
                <Text
                  style={[
                    styles.presetText,
                    selectedPreset === preset && styles.presetTextSelected,
                  ]}
                >
                  {formatCoin(preset)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Hoặc nhập số coin khác</Text>
          <View style={styles.customInputWrapper}>
            <TextInput
              style={styles.customInput}
              value={amount}
              onChangeText={handleCustomAmount}
              placeholder="0"
              placeholderTextColor={LuxeColors.onSurfaceVariant}
              keyboardType="numeric"
              maxLength={10}
            />
            <Text style={styles.currencySymbol}>coin</Text>
          </View>
          {numericCoins > 0 && numericCoins < 10 && (
            <Text style={styles.minWarning}>
              Số coin nạp tối thiểu: 10 coin
            </Text>
          )}
        </View>

        {renderPolling()}
        {renderSuccess()}

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Thông tin</Text>
          <Text style={styles.infoText}>
            • 1 coin = {VND_PER_COIN.toLocaleString("en-US")} VNĐ.
          </Text>
          <Text style={styles.infoText}>
            • Số dư coin sẽ được cập nhật sau khi thanh toán thành công.
          </Text>
          <Text style={styles.infoText}>
            • Thanh toán qua PayOS - an toàn và bảo mật.
          </Text>
        </View>
      </ScrollView>

      {!polling && paymentStatus !== "success" && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.submitBtn,
              numericCoins < 10 && styles.submitBtnDisabled,
            ]}
            onPress={handleTopUp}
            disabled={isLoading || numericCoins < 10}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>
                Thanh toán{" "}
                {numericCoins > 0 ? formatCoin(numericCoins) : ""}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LuxeColors.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: LuxeSpacing.lg,
    paddingVertical: LuxeSpacing.md,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderBottomWidth: 1,
    borderBottomColor: LuxeColors.outlineVariant + "30",
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: LuxeColors.onSurface,
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: LuxeSpacing.lg,
    gap: LuxeSpacing.xl,
    paddingBottom: 120,
  },
  section: {
    gap: LuxeSpacing.sm,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: LuxeColors.onSurface,
  },
  presetsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: LuxeSpacing.sm,
  },
  presetBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: LuxeBorderRadius.lg,
    paddingHorizontal: LuxeSpacing.lg,
    paddingVertical: LuxeSpacing.md,
    borderWidth: 1.5,
    borderColor: LuxeColors.outlineVariant,
  },
  presetBtnSelected: {
    backgroundColor: LuxeColors.primaryContainer,
    borderColor: LuxeColors.primaryContainer,
  },
  presetText: {
    fontSize: 16,
    fontWeight: "700",
    color: LuxeColors.onSurface,
  },
  presetTextSelected: {
    color: "#ffffff",
  },
  customInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: LuxeBorderRadius.lg,
    borderWidth: 1,
    borderColor: LuxeColors.outlineVariant,
    paddingHorizontal: LuxeSpacing.md,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: "600",
    color: LuxeColors.onSurfaceVariant,
    marginRight: 8,
  },
  customInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: LuxeColors.primaryContainer,
    paddingVertical: LuxeSpacing.md,
  },
  minWarning: {
    fontSize: 12,
    color: LuxeColors.error,
    marginTop: 4,
  },
  pollingCard: {
    backgroundColor: LuxeColors.primaryContainer + "15",
    borderRadius: LuxeBorderRadius.lg,
    padding: LuxeSpacing.lg,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: LuxeColors.primaryContainer + "30",
  },
  pollingText: {
    fontSize: 14,
    fontWeight: "600",
    color: LuxeColors.onSurface,
  },
  pollingSubtext: {
    fontSize: 12,
    color: LuxeColors.onSurfaceVariant,
  },
  successCard: {
    backgroundColor: "#dcfce7",
    borderRadius: LuxeBorderRadius.lg,
    padding: LuxeSpacing.xl,
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#86efac",
  },
  successIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  successText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#15803d",
  },
  doneBtn: {
    backgroundColor: "#15803d",
    borderRadius: LuxeBorderRadius.full,
    paddingHorizontal: LuxeSpacing.xl,
    paddingVertical: LuxeSpacing.sm,
  },
  doneBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
  },
  infoCard: {
    backgroundColor: LuxeColors.primaryContainer + "10",
    borderRadius: LuxeBorderRadius.lg,
    padding: LuxeSpacing.md,
    gap: 6,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: LuxeColors.onSurface,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    color: LuxeColors.onSurfaceVariant,
    lineHeight: 18,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: LuxeSpacing.lg,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderTopWidth: 1,
    borderTopColor: LuxeColors.outlineVariant + "30",
  },
  submitBtn: {
    backgroundColor: LuxeColors.primaryContainer,
    borderRadius: LuxeBorderRadius.md,
    paddingVertical: LuxeSpacing.md,
    alignItems: "center",
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
  },
});
