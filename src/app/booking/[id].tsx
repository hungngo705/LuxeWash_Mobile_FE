/**
 * Booking Detail Screen
 * Displays full appointment details with cancel action
 */

import { useConfirmDialog } from "@/components/ConfirmDialog";
import { Header } from "@/components/ui/Header";
import {
    LuxeColors,
    LuxeShadows,
    LuxeBorderRadius,
} from "@/constants/luxeTheme";
import { useAuth } from "@/contexts/AuthContext";
import {
    ApiError,
    bookingService,
    type BookingDetailResponse,
} from "@/services/api";
import {
    formatDate,
    formatTime,
    formatVnd,
} from "@/utils/format";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
    Pending: { label: "Đang chờ", bg: LuxeColors.tertiary + "12", text: LuxeColors.tertiary, dot: LuxeColors.tertiary },
    CheckedIn: { label: "Đã check-in", bg: LuxeColors.tertiary + "12", text: LuxeColors.tertiary, dot: LuxeColors.tertiary },
    Processing: { label: "Đang xử lý", bg: LuxeColors.secondary + "12", text: LuxeColors.secondary, dot: LuxeColors.secondary },
    Completed: { label: "Hoàn thành", bg: LuxeColors.primary + "12", text: LuxeColors.primary, dot: LuxeColors.primary },
    Cancelled: { label: "Đã hủy", bg: LuxeColors.surfaceContainer, text: LuxeColors.onSurfaceVariant, dot: LuxeColors.outline },
    CancelledBySystem: { label: "Hủy hệ thống", bg: LuxeColors.surfaceContainer, text: LuxeColors.onSurfaceVariant, dot: LuxeColors.outline },
    NoShow: { label: "Vắng mặt", bg: LuxeColors.surfaceContainer, text: LuxeColors.onSurfaceVariant, dot: LuxeColors.outline },
    Delayed: { label: "Trễ", bg: LuxeColors.tertiary + "12", text: LuxeColors.tertiary, dot: LuxeColors.tertiary },
};

const SectionCard: React.FC<{ children: React.ReactNode; style?: object }> = ({ children, style }) => (
    <View style={[styles.sectionCard, style]}>
        {children}
    </View>
);

const SectionTitle: React.FC<{ icon: string; title: string }> = ({ icon, title }) => (
    <View style={styles.sectionTitle}>
        <Feather name={icon as any} size={15} color={LuxeColors.onSurfaceVariant} />
        <Text style={styles.sectionTitleText}>{title}</Text>
    </View>
);

const InfoRow: React.FC<{ label: string; value: string | React.ReactNode; last?: boolean }> = ({ label, value, last }) => (
    <View style={[styles.infoRow, last && styles.infoRowLast]}>
        <Text style={styles.infoLabel}>{label}</Text>
        {typeof value === "string" ? (
            <Text style={styles.infoValue}>{value}</Text>
        ) : value}
    </View>
);

const getErrorMessage = (error: unknown, fallback: string): string => {
    if (error instanceof ApiError && error.message) {
        return error.message;
    }
    if (error && typeof error === "object" && "message" in error) {
        const message = (error as { message?: unknown }).message;
        if (typeof message === "string" && message.trim()) {
            return message;
        }
    }
    return fallback;
};

export default function BookingDetailScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { user } = useAuth();
    const { confirm } = useConfirmDialog();

    const [booking, setBooking] = useState<BookingDetailResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [cancelling, setCancelling] = useState(false);

    const loadBooking = useCallback(async () => {
        if (!id) return;
        try {
            setLoading(true);
            setError(null);
            const res = await bookingService.getBookingDetail(Number(id));
            if (res.statusCode === 200 && res.data) {
                setBooking(res.data);
            } else {
                setError("Không tìm thấy lịch hẹn.");
            }
        } catch {
            setError("Không thể tải thông tin lịch hẹn.");
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        loadBooking();
    }, [loadBooking]);

    const handleCancel = () => {
        confirm({
            title: "Hủy lịch hẹn",
            message: "Bạn có chắc muốn hủy lịch hẹn này? Điều kiện hoàn tiền sẽ được hệ thống kiểm tra tự động.",
            confirmText: "Hủy lịch",
            destructive: true,
            onConfirm: async () => {
                if (!id) return;
                setCancelling(true);
                try {
                    const res = await bookingService.cancelBooking(Number(id));
                    if (res.statusCode === 200) {
                        setBooking((prev) => prev ? { ...prev, status: "Cancelled" } : prev);
                        setTimeout(() => {
                            confirm({
                                title: "Hủy thành công",
                                message: "Lịch hẹn đã được hủy thành công. Nếu đủ điều kiện, tiền và điểm sẽ được hoàn lại.",
                                confirmText: "Đã hiểu",
                                showCancel: false,
                                destructive: false,
                                onConfirm: () => {
                                    if (router.canGoBack()) {
                                        router.back();
                                    } else {
                                        router.replace("/(main)/appointments" as any);
                                    }
                                },
                            });
                        }, 300);
                    } else {
                        alert(res.message || "Không thể hủy lịch. Vui lòng thử lại.");
                    }
                } catch (e: unknown) {
                    alert(getErrorMessage(e, "Không thể hủy lịch. Vui lòng thử lại."));
                } finally {
                    setCancelling(false);
                }
            },
        });
    };

    const statusConfig = booking ? (STATUS_CONFIG[booking.status] || {
        label: booking.status,
        bg: LuxeColors.surfaceContainer,
        text: LuxeColors.onSurfaceVariant,
        dot: LuxeColors.outline,
    }) : null;

    const userVehicle = user?.vehicles?.find(
        (v) => v.licensePlate === booking?.licensePlate,
    );
    const vehicleImage = userVehicle?.imageUrl;

    const isCancellable = booking?.status === "Pending";
    const isReschedulable = booking?.status === "Pending" || booking?.status === "Confirmed";
    const hasActions = isCancellable || isReschedulable;

    const scheduledDate = booking?.scheduledTime ? formatDate(booking.scheduledTime) : null;
    const scheduledTime = booking?.scheduledTime ? formatTime(booking.scheduledTime) : null;

    const handleReschedule = () => {
        if (!booking) return;
        router.push({
            pathname: "/booking/reschedule",
            params: { bookingId: String(booking.bookingId) },
        });
    };

    return (
        <View style={styles.container}>
            <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
                <Header
                    title="Chi tiết lịch hẹn"
                    onBack={() => {
                        if (router.canGoBack()) {
                            router.back();
                        } else {
                            router.replace("/(main)/appointments" as any);
                        }
                    }}
                    showBack
                />
            </SafeAreaView>

            {loading ? (
                <View style={styles.centerState}>
                    <ActivityIndicator size="large" color={LuxeColors.primaryContainer} />
                    <Text style={styles.centerText}>Đang tải...</Text>
                </View>
            ) : error ? (
                <View style={styles.centerState}>
                    <Feather name="alert-circle" size={48} color={LuxeColors.outline} />
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity style={styles.retryBtn} onPress={loadBooking}>
                        <Text style={styles.retryBtnText}>Thử lại</Text>
                    </TouchableOpacity>
                </View>
            ) : booking ? (
                <>
                    <ScrollView
                        style={styles.scrollView}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Hero Card: Status + Booking Info */}
                        {statusConfig && (
                            <View style={[styles.heroCard, { borderTopColor: statusConfig.dot }]}>
                                <View style={styles.heroTop}>
                                    <View style={styles.heroLeft}>
                                        <Text style={styles.heroIdLabel}>Mã lịch hẹn</Text>
                                        <Text style={styles.heroId}>#{booking.bookingId}</Text>
                                    </View>
                                    <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                                        <View style={[styles.statusDot, { backgroundColor: statusConfig.dot }]} />
                                        <Text style={[styles.statusText, { color: statusConfig.text }]}>
                                            {statusConfig.label}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.heroDivider} />
                                <View style={styles.heroMeta}>
                                    {scheduledDate && (
                                        <View style={styles.heroMetaItem}>
                                            <Feather name="calendar" size={14} color={LuxeColors.onSurfaceVariant} />
                                            <Text style={styles.heroMetaText}>{scheduledDate}</Text>
                                        </View>
                                    )}
                                    {scheduledTime && (
                                        <View style={styles.heroMetaItem}>
                                            <Feather name="clock" size={14} color={LuxeColors.onSurfaceVariant} />
                                            <Text style={styles.heroMetaText}>{scheduledTime}</Text>
                                        </View>
                                    )}
                                    {booking.licensePlate && (
                                        <View style={styles.heroMetaItem}>
                                            <Feather name="tag" size={14} color={LuxeColors.onSurfaceVariant} />
                                            <Text style={styles.heroMetaText}>{booking.licensePlate}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Vehicle Card */}
                        <SectionCard style={styles.mt10}>
                            <SectionTitle icon="truck" title="Xe" />
                            <View style={styles.vehicleRow}>
                                {vehicleImage ? (
                                    <Image source={{ uri: vehicleImage }} style={styles.vehicleImage} />
                                ) : (
                                    <View style={[styles.vehicleImage, styles.vehicleImagePlaceholder]}>
                                        <Feather name="truck" size={32} color={LuxeColors.outline} />
                                    </View>
                                )}
                                <View style={styles.vehicleInfo}>
                                    <Text style={styles.vehiclePlate}>{booking.licensePlate}</Text>
                                    {userVehicle?.model && (
                                        <Text style={styles.vehicleModel}>{userVehicle.model}</Text>
                                    )}
                                    {userVehicle?.brand && (
                                        <Text style={styles.vehicleBrand}>{userVehicle.brand}</Text>
                                    )}
                                </View>
                                <View style={styles.vehicleArrow}>
                                    <Feather name="chevron-right" size={20} color={LuxeColors.outline} />
                                </View>
                            </View>
                        </SectionCard>

                        {/* Services Card */}
                        <SectionCard style={styles.mt10}>
                            <SectionTitle icon="star" title="Dịch vụ đã đặt" />
                            {(booking.serviceNames || []).map((name, idx) => (
                                <View key={idx} style={styles.serviceItem}>
                                    <View style={styles.serviceCheckWrap}>
                                        <Feather name="check-circle" size={16} color="#16a34a" />
                                    </View>
                                    <Text style={styles.serviceName}>{name}</Text>
                                </View>
                            ))}
                        </SectionCard>

                        {(booking.status === "Completed" || booking.checkInImageUrl || booking.checkOutImageUrl) && (
                            <SectionCard style={styles.mt10}>
                                <SectionTitle icon="camera" title="Hình ảnh xe tại trạm" />
                                <View style={styles.stationPhotoGrid}>
                                    <View style={styles.stationPhotoItem}>
                                        {booking.checkInImageUrl ? (
                                            <Image
                                                source={{ uri: booking.checkInImageUrl }}
                                                style={styles.stationPhoto}
                                                resizeMode="cover"
                                            />
                                        ) : (
                                            <View style={[styles.stationPhoto, styles.stationPhotoMissing]}>
                                                <Feather name="image" size={24} color={LuxeColors.outline} />
                                                <Text style={styles.stationPhotoMissingText}>Không có ảnh</Text>
                                            </View>
                                        )}
                                        <View style={styles.stationPhotoCaption}>
                                            <Feather name="log-in" size={13} color={LuxeColors.primaryContainer} />
                                            <Text style={styles.stationPhotoCaptionText}>Ảnh check-in</Text>
                                        </View>
                                    </View>
                                    <View style={styles.stationPhotoItem}>
                                        {booking.checkOutImageUrl ? (
                                            <Image
                                                source={{ uri: booking.checkOutImageUrl }}
                                                style={styles.stationPhoto}
                                                resizeMode="cover"
                                            />
                                        ) : (
                                            <View style={[styles.stationPhoto, styles.stationPhotoMissing]}>
                                                <Feather name="image" size={24} color={LuxeColors.outline} />
                                                <Text style={styles.stationPhotoMissingText}>Không có ảnh</Text>
                                            </View>
                                        )}
                                        <View style={styles.stationPhotoCaption}>
                                            <Feather name="log-out" size={13} color={LuxeColors.primaryContainer} />
                                            <Text style={styles.stationPhotoCaptionText}>Ảnh check-out</Text>
                                        </View>
                                    </View>
                                </View>
                            </SectionCard>
                        )}

                        {/* Payment Card */}
                        <SectionCard style={styles.mt10}>
                            <SectionTitle icon="credit-card" title="Chi tiết thanh toán" />
                            <InfoRow
                                label="Tổng tiền"
                                value={formatVnd(booking.originalPrice || 0)}
                            />
                            {booking.pointDiscountAmount > 0 && (
                                <InfoRow
                                    label="Giảm từ điểm"
                                    value={
                                        <Text style={styles.discountValue}>
                                            -{formatVnd(booking.pointDiscountAmount)}
                                        </Text>
                                    }
                                />
                            )}
                            {booking.voucherDiscountAmount > 0 && (
                                <InfoRow
                                    label="Giảm từ voucher"
                                    value={
                                        <Text style={styles.discountValue}>
                                            -{formatVnd(booking.voucherDiscountAmount)}
                                        </Text>
                                    }
                                />
                            )}
                            <View style={styles.totalSection}>
                                <Text style={styles.totalLabel}>Thành tiền</Text>
                                <Text style={styles.totalValue}>{formatVnd(booking.finalAmount || 0)}</Text>
                            </View>
                        </SectionCard>

                        <View style={styles.bottomSpacer} />
                    </ScrollView>

                    {/* Booking Actions */}
                    {hasActions && (
                        <SafeAreaView edges={["bottom"]} style={styles.bottomBar}>
                            {isReschedulable && (
                                <TouchableOpacity
                                    style={styles.rescheduleBtn}
                                    onPress={handleReschedule}
                                    activeOpacity={0.75}
                                >
                                    <Feather name="calendar" size={18} color="#ffffff" />
                                    <Text style={styles.rescheduleBtnText}>Đổi lịch hẹn</Text>
                                </TouchableOpacity>
                            )}
                            {isCancellable && (
                                <TouchableOpacity
                                    style={styles.cancelBtn}
                                    onPress={handleCancel}
                                    disabled={cancelling}
                                    activeOpacity={0.75}
                                >
                                    {cancelling ? (
                                        <ActivityIndicator size="small" color="#DC2626" />
                                    ) : (
                                        <>
                                            <Feather name="x-circle" size={18} color="#DC2626" />
                                            <Text style={styles.cancelBtnText}>Hủy lịch hẹn</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            )}
                        </SafeAreaView>
                    )}
                </>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: LuxeColors.background },
    headerSafeArea: { backgroundColor: "#ffffff" },
    scrollView: { flex: 1 },
    scrollContent: { padding: 16, paddingTop: 12 },
    centerState: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
    centerText: { fontSize: 14, color: LuxeColors.onSurfaceVariant },
    errorText: { fontSize: 14, color: LuxeColors.error, textAlign: "center" },
    retryBtn: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        backgroundColor: LuxeColors.primaryContainer,
        borderRadius: LuxeBorderRadius.lg,
    },
    retryBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },

    // Hero card
    heroCard: {
        backgroundColor: "#ffffff",
        borderRadius: LuxeBorderRadius.xl,
        borderTopWidth: 4,
        padding: 18,
        ...LuxeShadows.md,
    },
    heroTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
    },
    heroLeft: { flex: 1 },
    heroIdLabel: { fontSize: 12, color: LuxeColors.onSurfaceVariant, marginBottom: 2 },
    heroId: { fontSize: 26, fontWeight: "800", color: LuxeColors.onSurface, letterSpacing: 0.3 },
    statusBadge: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        gap: 6,
    },
    statusDot: { width: 7, height: 7, borderRadius: 3.5 },
    statusText: { fontSize: 13, fontWeight: "600" },
    heroDivider: {
        height: 1,
        backgroundColor: LuxeColors.outlineVariant + "30",
        marginVertical: 14,
    },
    heroMeta: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
    heroMetaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    heroMetaText: { fontSize: 14, fontWeight: "500", color: LuxeColors.onSurface },

    // Section cards
    sectionCard: {
        backgroundColor: "#ffffff",
        borderRadius: LuxeBorderRadius.xl,
        padding: 18,
        ...LuxeShadows.sm,
    },
    mt10: { marginTop: 10 },
    bottomSpacer: { height: 156 },

    // Section title
    sectionTitle: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 14,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: LuxeColors.outlineVariant + "20",
    },
    sectionTitleText: { fontSize: 14, fontWeight: "600", color: LuxeColors.onSurface },

    // Info rows
    infoRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 9,
        borderBottomWidth: 1,
        borderBottomColor: LuxeColors.outlineVariant + "20",
    },
    infoRowLast: { borderBottomWidth: 0 },
    infoLabel: { fontSize: 14, color: LuxeColors.onSurfaceVariant },
    infoValue: { fontSize: 14, fontWeight: "600", color: LuxeColors.onSurface },
    discountValue: { fontSize: 14, fontWeight: "600", color: "#16a34a" },

    // Vehicle
    vehicleRow: { flexDirection: "row", alignItems: "center", gap: 14 },
    vehicleImage: {
        width: 72,
        height: 72,
        borderRadius: LuxeBorderRadius.xl,
        backgroundColor: LuxeColors.surfaceContainer,
        flexShrink: 0,
    },
    vehicleImagePlaceholder: { alignItems: "center", justifyContent: "center" },
    vehicleInfo: { flex: 1 },
    vehiclePlate: { fontSize: 18, fontWeight: "800", color: LuxeColors.onSurface, letterSpacing: 0.5 },
    vehicleModel: { fontSize: 13, fontWeight: "500", color: LuxeColors.onSurface, marginTop: 3 },
    vehicleBrand: { fontSize: 12, color: LuxeColors.onSurfaceVariant, marginTop: 2 },
    vehicleArrow: { padding: 4 },

    // Services
    serviceItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7 },
    serviceCheckWrap: { width: 22, height: 22, alignItems: "center", justifyContent: "center" },
    serviceName: { fontSize: 14, fontWeight: "500", color: LuxeColors.onSurface },

    // Station check-in/check-out photos
    stationPhotoGrid: { flexDirection: "row", gap: 10 },
    stationPhotoItem: {
        flex: 1,
        minWidth: 0,
        borderRadius: LuxeBorderRadius.lg,
        overflow: "hidden",
        backgroundColor: LuxeColors.surfaceContainer,
    },
    stationPhoto: { width: "100%", aspectRatio: 4 / 3 },
    stationPhotoMissing: {
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        backgroundColor: LuxeColors.surfaceContainer,
    },
    stationPhotoMissingText: {
        fontSize: 11,
        fontWeight: "600",
        color: LuxeColors.onSurfaceVariant,
    },
    stationPhotoCaption: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingHorizontal: 8,
        paddingVertical: 9,
        backgroundColor: LuxeColors.primaryContainer + "10",
    },
    stationPhotoCaptionText: {
        fontSize: 12,
        fontWeight: "700",
        color: LuxeColors.primaryContainer,
    },

    // Payment
    totalSection: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 12,
        paddingTop: 14,
        borderTopWidth: 2,
        borderTopColor: LuxeColors.outlineVariant + "30",
    },
    totalLabel: { fontSize: 16, fontWeight: "700", color: LuxeColors.onSurface },
    totalValue: { fontSize: 20, fontWeight: "800", color: LuxeColors.primary },

    // Bottom bar
    bottomBar: {
        backgroundColor: "#ffffff",
        paddingHorizontal: 16,
        paddingTop: 12,
        gap: 10,
        borderTopWidth: 1,
        borderTopColor: LuxeColors.outlineVariant + "20",
        ...LuxeShadows.lg,
    },
    rescheduleBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingVertical: 14,
        borderRadius: LuxeBorderRadius.lg,
        backgroundColor: LuxeColors.primaryContainer,
        ...LuxeShadows.primary,
    },
    rescheduleBtnText: { fontSize: 15, fontWeight: "700", color: "#ffffff" },
    cancelBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingVertical: 14,
        borderRadius: LuxeBorderRadius.lg,
        backgroundColor: "#FEE2E2",
    },
    cancelBtnText: { fontSize: 15, fontWeight: "700", color: "#DC2626" },
});
