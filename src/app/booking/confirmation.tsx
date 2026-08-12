/**
 * Advance Booking Flow - Final Step: Confirmation
 * Bold professional redesign with solid white cards, fixed text encoding
 */

import {
  LuxeColors,
  LuxeShadows,
} from "@/constants/luxeTheme";
import { useAuth } from "@/contexts/AuthContext";
import { bookingService, loyaltyService, type Voucher } from "@/services/api";
import { branchHistoryService } from "@/services/branchHistoryService";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { vndToPoints, formatVnd } from "@/utils/format";
import { Header } from "@/components/ui/Header";
import { ProgressSteps } from "@/components/ui/ProgressSteps";
import { BottomActionBar } from "@/components/ui/BottomActionBar";
import { VoucherSelectionModal } from "@/components/booking/VoucherSelectionModal";
import * as Linking from "expo-linking";
import { openBrowserAsync } from "expo-web-browser";

const PAYMENT_POLL_ATTEMPTS = 20;
const PAYMENT_POLL_INTERVAL_MS = 3000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function BookingConfirmationScreen() {
  const router = useRouter();
  const { walletBalance, refreshWallet } = useAuth();
  const params = useLocalSearchParams();

  const serviceIdParam = parseInt(params.serviceId as string) || 0;
  const serviceNameParam = (params.serviceName as string) || "";
  const servicePriceParam = parseInt(params.servicePrice as string) || 0;
  const membershipDiscountParam = parseFloat(params.membershipDiscount as string) || 0;
  const dateParam = (params.date as string) || "";
  const slotIdParam = parseInt(params.slotId as string) || 0;
  const timeRangeParam = (params.timeRange as string) || "";
  const vehicleIdParam = (params.vehicleId as string) || "";
  const vehicleDbIdParam = (params.vehicleDbId as string) || "";
  const vehicleIdNumericParam = parseInt(vehicleDbIdParam) || 0;
  const vehicleBrandParam = (params.vehicleBrand as string) || "";
  const branchIdParam = parseInt(params.branchId as string) || 1;
  const branchNameParam = (params.branchName as string) || "LuxeWash";

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"wallet" | "bank">("wallet");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [loadingVouchers, setLoadingVouchers] = useState(false);
  const [bankPaymentMessage, setBankPaymentMessage] = useState<string | null>(null);

  const subtotal = servicePriceParam;
  const membershipDiscountAmount = Math.round(subtotal * membershipDiscountParam);
  const priceAfterMembership = subtotal - membershipDiscountAmount;
  const voucherDiscountAmount = selectedVoucher
    ? Math.min(selectedVoucher.discountAmount, priceAfterMembership)
    : 0;
  const finalPrice = Math.max(0, priceAfterMembership - voucherDiscountAmount);

  const formatDateDisplay = (dateStr: string): string => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("vi-VN", {
      weekday: "long",
      day: "numeric",
      month: "numeric",
      year: "numeric",
    });
  };

  const loadVouchers = useCallback(async () => {
    setLoadingVouchers(true);
    try {
      const res = await loyaltyService.getMyVouchers();
      if (res.statusCode === 200 && res.data) {
        const usable = (res.data as Voucher[]).filter(
          (v) =>
            v.voucherType === 0 &&
            !v.isUsed &&
            v.remainingUsage > 0 &&
            new Date(v.expiryDate) > new Date(),
        );
        setVouchers(usable);
      }
    } catch {
      // silently fail — vouchers are optional
    } finally {
      setLoadingVouchers(false);
    }
  }, []);

  useEffect(() => {
    loadVouchers();
  }, [loadVouchers]);

  const buildPaymentReturnUrl = (bookingId: number) =>
    Linking.createURL("booking/confirmation", {
      queryParams: {
        bookingId: String(bookingId),
        payment: "return",
      },
    });

  const buildPaymentCancelUrl = (bookingId: number) =>
    Linking.createURL("booking/confirmation", {
      queryParams: {
        bookingId: String(bookingId),
        payment: "cancelled",
      },
    });

  const goToSuccess = useCallback(
    async (
      bookingId: number,
      confirmedFinalAmount = finalPrice,
      confirmedVoucherDiscount = voucherDiscountAmount,
    ) => {
      await refreshWallet?.();
      bookingService.triggerEmail(bookingId).catch(() => {});
      branchHistoryService.addRecentBranch({
        branchId: branchIdParam,
        name: branchNameParam,
        address: '',
        isActive: true,
      });
      router.replace({
        pathname: "/booking/success",
        params: {
          bookingId: String(bookingId),
          date: dateParam,
          timeSlot: timeRangeParam,
          finalAmount: String(confirmedFinalAmount),
          branchName: branchNameParam,
          voucherDiscount: String(confirmedVoucherDiscount),
        },
      });
    },
    [
      branchIdParam,
      branchNameParam,
      dateParam,
      finalPrice,
      refreshWallet,
      router,
      timeRangeParam,
      voucherDiscountAmount,
    ],
  );

  const waitForBookingPayment = async (bookingId: number) => {
    for (let attempt = 1; attempt <= PAYMENT_POLL_ATTEMPTS; attempt++) {
      setBankPaymentMessage(
        `Đang xác nhận chuyển khoản... (${attempt}/${PAYMENT_POLL_ATTEMPTS})`,
      );

      try {
        const statusRes = await bookingService.getPaymentStatus(bookingId);
        const paymentStatus = statusRes.data?.paymentStatus;

        if (paymentStatus === "Completed") {
          setBankPaymentMessage("Thanh toán đã được xác nhận.");
          return true;
        }

        if (paymentStatus === "Expired" || paymentStatus === "Failed") {
          throw new Error("Giao dịch đã hết hạn hoặc thất bại.");
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes("hết hạn")) {
          throw error;
        }
      }

      await wait(PAYMENT_POLL_INTERVAL_MS);
    }

    return false;
  };

  const handleConfirmBooking = async () => {
    if (selectedPaymentMethod === "wallet" && walletBalance < finalPrice) {
      alert("Số dư không đủ. Vui lòng nạp thêm tiền vào ví hoặc chọn phương thức thanh toán khác.");
      return;
    }

    setIsSubmitting(true);
    setBankPaymentMessage(null);

    try {
      const [year, month, day] = dateParam.split("-").map(Number);
      const scheduledDate = new Date(
        Date.UTC(year, month - 1, day, 0, 0, 0, 0),
      ).toISOString();

      const res = await bookingService.createBooking({
        branchId: branchIdParam,
        vehicleId: vehicleIdNumericParam || undefined,
        licensePlate: vehicleIdParam,
        serviceIds: [serviceIdParam],
        scheduledDate,
        slotId: slotIdParam,
        pointsToUse: 0,
        voucherId: selectedVoucher?.voucherId ?? null,
        paymentMethod: selectedPaymentMethod === "wallet" ? "Wallet" : "QR",
      });

      if (res.statusCode === 200 || res.statusCode === 201) {
        const bookingId = res.data?.bookingId || 0;

        if (!bookingId) {
          throw new Error("Không tìm thấy mã đặt lịch sau khi tạo booking.");
        }

        // Backend là nguồn giá tin cậy cho cả ví và PayOS. Giá phía client chỉ
        // dùng để preview trước khi tạo lịch.
        const confirmedFinalAmount = Number(res.data?.finalAmount);
        const chargedAmount = Number.isFinite(confirmedFinalAmount)
          ? Math.max(0, confirmedFinalAmount)
          : finalPrice;
        const confirmedVoucherDiscount = Number(res.data?.voucherDiscountAmount);
        const appliedVoucherDiscount = Number.isFinite(confirmedVoucherDiscount)
          ? Math.max(0, confirmedVoucherDiscount)
          : voucherDiscountAmount;

        if (selectedPaymentMethod === "bank" && chargedAmount > 0) {
          setBankPaymentMessage("Đang tạo mã QR chuyển khoản...");
          const linkRes = await bookingService.createPaymentLink(bookingId, {
            returnUrl: buildPaymentReturnUrl(bookingId),
            cancelUrl: buildPaymentCancelUrl(bookingId),
          });

          if (linkRes.statusCode !== 200 || !linkRes.data?.paymentUrl) {
            throw new Error(linkRes.message || "Không thể tạo link thanh toán chuyển khoản.");
          }

          setBankPaymentMessage("Đang mở cổng thanh toán PayOS...");
          await openBrowserAsync(linkRes.data.paymentUrl);

          const isPaid = await waitForBookingPayment(bookingId);
          if (isPaid) {
            await goToSuccess(bookingId, chargedAmount, appliedVoucherDiscount);
            return;
          }

          setBankPaymentMessage("Chưa xác nhận được thanh toán. Bạn có thể kiểm tra lại trong lịch hẹn.");
          alert("Thanh toán đang chờ xác nhận. Vui lòng kiểm tra lại trạng thái trong lịch hẹn sau vài phút.");
          return;
        }

        await refreshWallet?.();
        bookingService.triggerEmail(bookingId).catch(() => {});
        // Record this branch as recently used for the "Đã đặt" tab
        branchHistoryService.addRecentBranch({
          branchId: branchIdParam,
          name: branchNameParam,
          address: '',
          isActive: true,
        });
        router.replace({
          pathname: "/booking/success",
          params: {
            bookingId: String(bookingId),
            date: dateParam,
            timeSlot: timeRangeParam,
            finalAmount: String(chargedAmount),
            branchName: branchNameParam,
            voucherDiscount: String(appliedVoucherDiscount),
          },
        });
      } else {
        alert(res.message || "Đặt lịch thất bại. Vui lòng thử lại.");
      }
    } catch (e: unknown) {
      const err = e as { message?: string };
      alert(err?.message || "Đã xảy ra lỗi khi tạo đặt lịch");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <Header title="Xác nhận đặt lịch" onBack={() => router.back()} />

        <ProgressSteps
          steps={[
            { label: 'Chi nhánh' },
            { label: 'Xe' },
            { label: 'Dịch vụ' },
            { label: 'Ngày' },
            { label: 'Xác nhận' },
          ]}
          currentStep={4}
        />

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Service Card */}
          <View style={styles.serviceCard}>
            <View style={styles.serviceCardHeader}>
              <View style={styles.serviceIconWrap}>
                <Feather name="award" size={24} color={LuxeColors.primaryContainer} />
              </View>
              <View style={styles.serviceInfo}>
                <Text style={styles.serviceName}>{serviceNameParam}</Text>
                <Text style={styles.serviceMeta}>{servicePriceParam.toLocaleString("vi-VN")}đ</Text>
              </View>
            </View>
          </View>

          {/* Booking Details Card */}
          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <View style={styles.detailIconWrap}>
                <Feather name="calendar" size={18} color={LuxeColors.primaryContainer} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Ngày</Text>
                <Text style={styles.detailValue}>{formatDateDisplay(dateParam)}</Text>
              </View>
            </View>

            <View style={styles.detailDivider} />

            <View style={styles.detailRow}>
              <View style={styles.detailIconWrap}>
                <Feather name="clock" size={18} color={LuxeColors.primaryContainer} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Giờ</Text>
                <Text style={styles.detailValue}>{timeRangeParam}</Text>
              </View>
            </View>

            <View style={styles.detailDivider} />

            <View style={styles.detailRow}>
              <View style={styles.detailIconWrap}>
                <Feather name="truck" size={18} color={LuxeColors.primaryContainer} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Xe</Text>
                <Text style={styles.detailValue}>{vehicleIdParam} - {vehicleBrandParam}</Text>
              </View>
            </View>

            <View style={styles.detailDivider} />

            <View style={styles.detailRow}>
              <View style={styles.detailIconWrap}>
                <Feather name="map-pin" size={18} color={LuxeColors.primaryContainer} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Trạm</Text>
                <Text style={styles.detailValue}>{branchNameParam || 'LuxeWash'}</Text>
              </View>
            </View>
          </View>

          {/* Payment Methods */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Phương thức thanh toán</Text>
          </View>

          <View style={styles.paymentMethods}>
            <TouchableOpacity
              style={[
                styles.paymentMethod,
                selectedPaymentMethod === "wallet" && styles.paymentMethodSelected,
                walletBalance < finalPrice && styles.paymentMethodDisabled,
              ]}
              onPress={() => { if (walletBalance >= finalPrice) setSelectedPaymentMethod("wallet"); }}
              disabled={walletBalance < finalPrice}
              activeOpacity={0.8}
            >
              <View style={[styles.paymentRadio, selectedPaymentMethod === "wallet" && styles.paymentRadioSelected]}>
                {selectedPaymentMethod === "wallet" && <View style={styles.paymentRadioInner} />}
              </View>
              <View style={styles.paymentIconWrap}>
                <Feather name="credit-card" size={22} color={LuxeColors.primaryContainer} />
              </View>
              <View style={styles.paymentInfo}>
                <Text style={styles.paymentTitle}>Thanh toán bằng điểm</Text>
                <Text style={[styles.paymentBalance, walletBalance < finalPrice && styles.paymentBalanceDanger]}>
                  {vndToPoints(walletBalance).toLocaleString("vi-VN")} điểm
                </Text>
                <Text style={styles.paymentSubtext}>(≈ {formatVnd(walletBalance)})</Text>
              </View>
              {walletBalance < finalPrice && (
                <View style={styles.warningBadge}>
                  <Text style={styles.warningText}>Không đủ</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.paymentMethod, selectedPaymentMethod === "bank" && styles.paymentMethodSelected]}
              onPress={() => setSelectedPaymentMethod("bank")}
              activeOpacity={0.8}
            >
              <View style={[styles.paymentRadio, selectedPaymentMethod === "bank" && styles.paymentRadioSelected]}>
                {selectedPaymentMethod === "bank" && <View style={styles.paymentRadioInner} />}
              </View>
              <View style={styles.paymentIconWrap}>
                <Feather name="grid" size={22} color={LuxeColors.primaryContainer} />
              </View>
              <View style={styles.paymentInfo}>
                <Text style={styles.paymentTitle}>Chuyển khoản ngân hàng</Text>
                <Text style={styles.paymentSubtext}>Thanh toán QR / chuyển khoản</Text>
              </View>
            </TouchableOpacity>
          </View>

          {bankPaymentMessage && (
            <View style={styles.bankStatusCard}>
              <ActivityIndicator size="small" color={LuxeColors.primaryContainer} />
              <Text style={styles.bankStatusText}>{bankPaymentMessage}</Text>
            </View>
          )}

          {/* Voucher Selection */}
          <TouchableOpacity
            style={styles.voucherSelectCard}
            onPress={() => setShowVoucherModal(true)}
            activeOpacity={0.7}
          >
            <View style={styles.voucherSelectLeft}>
              <View style={styles.voucherSelectIconWrap}>
                {loadingVouchers ? (
                  <ActivityIndicator size="small" color={LuxeColors.primaryContainer} />
                ) : (
                  <Feather name="tag" size={20} color={LuxeColors.primaryContainer} />
                )}
              </View>
              <View style={styles.voucherSelectInfo}>
                <Text style={styles.voucherSelectTitle}>Voucher giảm giá</Text>
                {selectedVoucher ? (
                  <Text style={styles.voucherSelectValue}>
                    -{selectedVoucher.discountAmount.toLocaleString("vi-VN")}đ
                    {" · "}
                    {selectedVoucher.code}
                  </Text>
                ) : (
                  <Text style={styles.voucherSelectPlaceholder}>
                    {vouchers.length > 0
                      ? `${vouchers.length} voucher khả dụng`
                      : "Chưa chọn voucher"}
                  </Text>
                )}
              </View>
            </View>
            <View style={styles.voucherSelectRight}>
              {selectedVoucher ? (
                <TouchableOpacity
                  hitSlop={10}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    setSelectedVoucher(null);
                  }}
                >
                  <Feather name="x-circle" size={22} color={LuxeColors.error} />
                </TouchableOpacity>
              ) : (
                <Feather name="chevron-right" size={20} color={LuxeColors.onSurfaceVariant} />
              )}
            </View>
          </TouchableOpacity>

          {/* Billing Details */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Chi tiết thanh toán</Text>
          </View>

          <View style={styles.billingCard}>
            <View style={styles.billingRow}>
              <Text style={styles.billingLabel}>{serviceNameParam}</Text>
              <Text style={styles.billingValue}>{subtotal.toLocaleString("vi-VN")}đ</Text>
            </View>
            {membershipDiscountAmount > 0 && (
              <View style={styles.billingRow}>
                <View style={styles.discountLabelWrap}>
                  <Feather name="tag" size={14} color={LuxeColors.primaryContainer} />
                  <Text style={[styles.billingLabel, styles.billingDiscountLabel]}>
                    Giảm thành viên ({Math.round(membershipDiscountParam * 100)}%)
                  </Text>
                </View>
                <Text style={styles.billingDiscount}>-{membershipDiscountAmount.toLocaleString("vi-VN")}đ</Text>
              </View>
            )}
            {voucherDiscountAmount > 0 && (
              <View style={styles.billingRow}>
                <View style={styles.discountLabelWrap}>
                  <Feather name="percent" size={14} color={LuxeColors.primaryContainer} />
                  <Text style={[styles.billingLabel, styles.billingDiscountLabel]}>
                    Giảm từ voucher
                  </Text>
                </View>
                <Text style={styles.billingDiscount}>-{voucherDiscountAmount.toLocaleString("vi-VN")}đ</Text>
              </View>
            )}
            <View style={styles.billingDivider} />
            <View style={styles.billingRow}>
              <Text style={styles.billingTotalLabel}>Tổng thanh toán</Text>
              <Text style={styles.billingTotalValue}>{finalPrice.toLocaleString("vi-VN")}đ</Text>
            </View>
          </View>

          {/* Terms */}
          <Text style={styles.termsText}>
            Bằng việc xác nhận đặt lịch, bạn đồng ý với{" "}
            <Text style={styles.termsLink}>Điều khoản dịch vụ</Text> và{" "}
            <Text style={styles.termsLink}>chính sách hủy lịch</Text> của LuxeWash.
          </Text>

          <View style={{ height: 120 }} />
        </ScrollView>

        <BottomActionBar
          title="XÁC NHẬN ĐẶT LỊCH"
          onPress={handleConfirmBooking}
          loading={isSubmitting}
          disabled={isSubmitting}
          icon="check-circle"
        />

        <VoucherSelectionModal
          visible={showVoucherModal}
          vouchers={vouchers}
          selectedVoucher={selectedVoucher}
          orderAmount={priceAfterMembership}
          loading={loadingVouchers}
          onSelect={(v) => {
            setSelectedVoucher(v);
            setShowVoucherModal(false);
          }}
          onClose={() => setShowVoucherModal(false)}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: LuxeColors.background },
  safeArea: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8 },
  serviceCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginBottom: 16, ...LuxeShadows.sm },
  serviceCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  serviceIconWrap: { width: 48, height: 48, borderRadius: 14, backgroundColor: LuxeColors.primaryContainer + '18', alignItems: 'center', justifyContent: 'center' },
  serviceInfo: { flex: 1 },
  serviceName: { fontSize: 16, fontWeight: '800', color: LuxeColors.onSurface, marginBottom: 4 },
  serviceMeta: { fontSize: 13, color: LuxeColors.primaryContainer, fontWeight: '600' },
  detailsCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginBottom: 20, ...LuxeShadows.sm },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8 },
  detailIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: LuxeColors.primaryContainer + '15', alignItems: 'center', justifyContent: 'center' },
  detailContent: { flex: 1 },
  detailLabel: { fontSize: 12, color: LuxeColors.onSurfaceVariant, marginBottom: 2 },
  detailValue: { fontSize: 14, fontWeight: '600', color: LuxeColors.onSurface },
  detailDivider: { height: 1, backgroundColor: LuxeColors.outlineVariant + '25', marginVertical: 4 },
  sectionHeader: { marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: LuxeColors.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 1 },
  paymentMethods: { gap: 12, marginBottom: 20 },
  paymentMethod: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 16, padding: 16, borderWidth: 2, borderColor: 'transparent', ...LuxeShadows.sm },
  paymentMethodSelected: {
    borderColor: LuxeColors.primaryContainer,
    backgroundColor: "#DDF3FB",
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  paymentMethodDisabled: { opacity: 0.6 },
  paymentRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: LuxeColors.outline, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  paymentRadioSelected: { borderColor: LuxeColors.primaryContainer },
  paymentRadioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: LuxeColors.primaryContainer },
  paymentIconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: LuxeColors.primaryContainer + '18', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  paymentInfo: { flex: 1 },
  paymentTitle: { fontSize: 15, fontWeight: '700', color: LuxeColors.onSurface, marginBottom: 2 },
  paymentBalance: { fontSize: 13, color: LuxeColors.onSurfaceVariant, fontWeight: '500' },
  paymentBalanceDanger: { color: LuxeColors.error },
  paymentSubtext: { fontSize: 11, color: LuxeColors.outline, marginTop: 2 },
  bankStatusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: LuxeColors.primaryContainer + "15",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LuxeColors.primaryContainer + "35",
    padding: 12,
    marginBottom: 16,
  },
  bankStatusText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: LuxeColors.onSurface,
  },
  warningBadge: { backgroundColor: LuxeColors.error + '18', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  warningText: { fontSize: 11, fontWeight: '700', color: LuxeColors.error },
  billingCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginBottom: 16, ...LuxeShadows.sm },
  billingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  billingLabel: { fontSize: 14, color: LuxeColors.onSurface },
  billingDiscountLabel: { color: LuxeColors.primaryContainer, fontWeight: '600' },
  discountLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  billingValue: { fontSize: 14, fontWeight: '500', color: LuxeColors.onSurface },
  billingDiscount: { fontSize: 14, fontWeight: '700', color: LuxeColors.primaryContainer },
  billingDivider: { height: 1, backgroundColor: LuxeColors.outlineVariant + '30', marginVertical: 8 },
  billingTotalLabel: { fontSize: 16, fontWeight: '800', color: LuxeColors.onSurface },
  billingTotalValue: { fontSize: 22, fontWeight: '800', color: LuxeColors.primaryContainer },
  termsText: { fontSize: 12, color: LuxeColors.onSurfaceVariant, textAlign: 'center', lineHeight: 18, paddingHorizontal: 8 },
  termsLink: { color: LuxeColors.primaryContainer, fontWeight: '600' },
  voucherSelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: LuxeColors.primaryContainer + '40',
    ...LuxeShadows.sm,
  },
  voucherSelectLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  voucherSelectIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: LuxeColors.primaryContainer + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voucherSelectInfo: { flex: 1 },
  voucherSelectTitle: { fontSize: 13, fontWeight: '700', color: LuxeColors.onSurface, marginBottom: 2 },
  voucherSelectValue: { fontSize: 13, fontWeight: '600', color: LuxeColors.primaryContainer },
  voucherSelectPlaceholder: { fontSize: 13, color: LuxeColors.onSurfaceVariant },
  voucherSelectRight: { marginLeft: 8 },
});
