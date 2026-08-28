/**
 * Wallet Home Screen
 * Bold professional redesign with gradient balance card and clean solid cards
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { LuxeColors, LuxeSpacing, LuxeBorderRadius, LuxeShadows } from '@/constants/luxeTheme';
import { useAuth } from '@/contexts/AuthContext';
import { walletService, type WalletBalance, type Transaction } from '@/services/api';
import { vndToPoints, VND_PER_POINT } from '@/utils/format';
import { Header } from '@/components/ui/Header';

const POINTS_LABEL = 'điểm';

const transactionTypeLabel: Record<string, string> = {
  TopUp: 'Nạp tiền',
  Booking: 'Thanh toán đơn hàng',
  Refund: 'Hoàn điểm',
  Upsell: 'Phụ phí',
  PointReward: 'Tích điểm',
  PointRedeem: 'Đổi điểm',
};

const transactionTypeConfig: Record<string, { color: string; icon: string; borderColor: string }> = {
  TopUp:      { color: '#10b981', icon: 'plus-circle',  borderColor: '#10b981' },
  Refund:     { color: '#10b981', icon: 'rotate-ccw',   borderColor: '#10b981' },
  Booking:    { color: '#ef4444', icon: 'truck',        borderColor: '#ef4444' },
  Upsell:     { color: '#f97316', icon: 'plus-square',  borderColor: '#f97316' },
  PointReward:{ color: '#f59e0b', icon: 'star',         borderColor: '#f59e0b' },
  PointRedeem:{ color: '#8b5cf6', icon: 'gift',         borderColor: '#8b5cf6' },
};

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  Completed: { label: 'Thành công', bg: '#dcfce7', text: '#15803d' },
  Pending:   { label: 'Đang xử lý', bg: '#fef3c7', text: '#92400e' },
  Failed:    { label: 'Thất bại',    bg: '#fee2e2', text: '#dc2626' },
};

export default function WalletScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { walletBalance, refreshWallet } = useAuth();

  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [recentTxns, setRecentTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const [walletRes, txnRes] = await Promise.all([
      walletService.getBalance(),
      walletService.getTransactions(1, 10),
    ]);

    if (walletRes.statusCode === 200 && walletRes.data) {
      setWallet(walletRes.data);
    }
    if (txnRes.statusCode === 200 && txnRes.data) {
      setRecentTxns(txnRes.data);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const primaryBalance = wallet?.balance ?? walletBalance ?? 0;
  const mainPoints = wallet?.totalPoints || Math.floor(primaryBalance / VND_PER_POINT);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Header title="Ví của tôi" onBack={() => router.back()} />
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={LuxeColors.primaryContainer} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Header title="Ví của tôi" onBack={() => router.back()} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={LuxeColors.primaryContainer} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Balance Card - Bold Gradient */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceTopRow}>
            <View>
              <Text style={styles.balanceLabel}>Số dư điểm</Text>
              <Text style={styles.balancePoints}>{mainPoints.toLocaleString('vi-VN')}</Text>
              <Text style={styles.balanceUnit}>{POINTS_LABEL}</Text>
            </View>
          </View>
          <View style={styles.balanceDivider} />
          <View style={styles.balanceBottomRow}>
            <Text style={styles.balanceSubtitle}>1 điểm = {VND_PER_POINT.toLocaleString('vi-VN')}đ</Text>
            <TouchableOpacity
              style={styles.topUpBtn}
              onPress={() => router.push('/wallet/top-up')}
            >
              <Feather name="plus" size={14} color={LuxeColors.primary} />
              <Text style={styles.topUpBtnText}>Nạp điểm</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/wallet/top-up')}>
            <View style={[styles.actionIconWrap, { backgroundColor: '#10b98118' }]}>
              <Feather name="plus-circle" size={22} color="#10b981" />
            </View>
            <Text style={styles.actionLabel}>Nạp điểm</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/wallet/transactions')}>
            <View style={[styles.actionIconWrap, { backgroundColor: LuxeColors.primaryContainer + '18' }]}>
              <Feather name="list" size={22} color={LuxeColors.primaryContainer} />
            </View>
            <Text style={styles.actionLabel}>Lịch sử</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Transactions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Giao dịch gần đây</Text>
            {recentTxns.length > 0 && (
              <TouchableOpacity onPress={() => router.push('/wallet/transactions')}>
                <Text style={styles.seeAll}>Xem tất cả</Text>
              </TouchableOpacity>
            )}
          </View>

          {recentTxns.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Feather name="inbox" size={40} color={LuxeColors.outlineVariant} />
              </View>
              <Text style={styles.emptyTitle}>Chưa có giao dịch nào</Text>
              <Text style={styles.emptySubtitle}>Nạp điểm để bắt đầu sử dụng</Text>
            </View>
          ) : (
            <View style={styles.txnList}>
              {recentTxns.map((txn) => {
                const isPositive = txn.amount >= 0;
                const color = transactionTypeConfig[txn.transactionType]?.color ?? '#6f787f';
                const borderColor = transactionTypeConfig[txn.transactionType]?.borderColor ?? color;
                const icon = transactionTypeConfig[txn.transactionType]?.icon ?? 'circle';
                const status = statusConfig[txn.status] ?? statusConfig['Pending'];
                const amountColor = isPositive ? '#10b981' : '#ef4444';
                return (
                  <View key={txn.transactionId} style={[styles.txnItem, { borderLeftColor: borderColor }]}>
                    <View style={styles.txnLeft}>
                      <View style={[styles.txnIconWrap, { backgroundColor: color + '20' }]}>
                        <Feather name={icon as any} size={14} color={color} />
                      </View>
                      <View style={styles.txnLeftText}>
                        <Text style={styles.txnLabel}>
                          {transactionTypeLabel[txn.transactionType] ?? txn.transactionType}
                        </Text>
                        <Text style={styles.txnDate}>{formatDate(txn.createdAt)}</Text>
                      </View>
                    </View>
                    <View style={styles.txnRight}>
                      <Text style={[styles.txnPoints, { color: amountColor }]}>
                        {isPositive ? '+' : '-'}{Math.abs(txn.amount).toLocaleString('vi-VN')}
                      </Text>
                      <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                        <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={{ height: 80 + insets.bottom }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: LuxeColors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, gap: 16, paddingBottom: 20 },
  balanceCard: {
    backgroundColor: LuxeColors.primary,
    borderRadius: 24,
    padding: 24,
    ...LuxeShadows.lg,
  },
  balanceTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  balanceLabel: { fontSize: 14, color: 'rgba(255,255,255,0.75)', fontWeight: '500', marginBottom: 4 },
  balancePoints: {
    fontSize: 48, fontWeight: '800', color: '#fff',
    letterSpacing: -1, lineHeight: 54,
  },
  balanceUnit: { fontSize: 16, color: 'rgba(255,255,255,0.75)', fontWeight: '600', marginTop: -4 },
  balanceIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  balanceDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginBottom: 16 },
  balanceBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.65)' },
  topUpBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#ffffff',
    borderRadius: LuxeBorderRadius.full,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  topUpBtnText: { fontSize: 14, fontWeight: '700', color: LuxeColors.primary },
  pointsRow: { flexDirection: 'row' },
  pointCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    ...LuxeShadows.sm,
  },
  pointIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  pointLabel: {
    fontSize: 12, color: LuxeColors.onSurfaceVariant,
    marginBottom: 4, textAlign: 'center', fontWeight: '500',
  },
  pointValue: {
    fontSize: 22, fontWeight: '800', color: LuxeColors.primary,
    marginBottom: 2,
  },
  pointSubtext: { fontSize: 11, color: LuxeColors.outline, textAlign: 'center' },
  actionsRow: { flexDirection: 'row', gap: 14 },
  actionBtn: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    ...LuxeShadows.sm,
  },
  actionIconWrap: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  actionLabel: { fontSize: 13, fontWeight: '700', color: LuxeColors.onSurface },
  section: { gap: 14 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: LuxeColors.onSurface },
  seeAll: { fontSize: 13, color: LuxeColors.primaryContainer, fontWeight: '600' },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    ...LuxeShadows.sm,
  },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: LuxeColors.surfaceContainer,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: LuxeColors.onSurface, marginBottom: 4 },
  emptySubtitle: { fontSize: 13, color: LuxeColors.onSurfaceVariant },
  txnList: { gap: 10 },
  txnItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderLeftWidth: 3,
    ...LuxeShadows.sm,
  },
  txnLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  txnIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  txnLeftText: { flex: 1 },
  txnLabel: { fontSize: 13, fontWeight: '600', color: LuxeColors.onSurface },
  txnDate: { fontSize: 11, color: LuxeColors.onSurfaceVariant, marginTop: 2 },
  txnRight: { alignItems: 'flex-end', gap: 4 },
  txnPoints: { fontSize: 14, fontWeight: '800' },
  txnUnit: { fontSize: 11, color: LuxeColors.onSurfaceVariant },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statusText: { fontSize: 10, fontWeight: '600' },
});
