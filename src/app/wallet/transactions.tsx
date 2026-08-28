/**
 * Transaction History Screen
 * GET /api/v1/transactions
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { LuxeColors, LuxeSpacing, LuxeBorderRadius, LuxeShadows } from '@/constants/luxeTheme';
import { walletService, type Transaction } from '@/services/api';

const transactionTypeConfig: Record<string, { label: string; color: string; icon: string; borderColor: string }> = {
  TopUp:       { label: 'Nạp tiền',          color: '#10b981', icon: 'plus-circle',   borderColor: '#10b981' },
  Refund:      { label: 'Hoàn điểm',         color: '#10b981', icon: 'rotate-ccw',    borderColor: '#10b981' },
  Booking:     { label: 'Thanh toán đơn hàng', color: '#ef4444', icon: 'truck',         borderColor: '#ef4444' },
  Upsell:      { label: 'Phụ phí',           color: '#f97316', icon: 'plus-square',   borderColor: '#f97316' },
  PointReward: { label: 'Tích điểm',         color: '#f59e0b', icon: 'star',          borderColor: '#f59e0b' },
  PointRedeem: { label: 'Đổi điểm',         color: '#8b5cf6', icon: 'gift',          borderColor: '#8b5cf6' },
};

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  Completed: { label: 'Thành công', bg: '#dcfce7', text: '#15803d' },
  Pending:   { label: 'Đang xử lý', bg: '#fef3c7', text: '#92400e' },
  Failed:    { label: 'Thất bại',    bg: '#fee2e2', text: '#dc2626' },
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Math.abs(amount));
};

export default function TransactionsScreen() {
  const router = useRouter();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTransactions = useCallback(async () => {
    try {
      const res = await walletService.getTransactions(1, 100);
      if (res.statusCode === 200 && res.data) {
        setTransactions(res.data);
      }
    } catch (e) {
      console.error('Failed to load transactions:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTransactions();
    }, [loadTransactions])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadTransactions();
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isPositive = (txn: Transaction) => txn.amount >= 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={LuxeColors.primaryContainer} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={24} color={LuxeColors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lịch sử giao dịch</Text>
        <View style={styles.placeholder} />
      </View>

      {transactions.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="inbox" size={48} color={LuxeColors.outlineVariant} />
          <Text style={styles.emptyTitle}>Chưa có giao dịch</Text>
          <Text style={styles.emptySubtitle}>
            Các giao dịch nạp tiền, thanh toán và hoàn tiền sẽ hiển thị ở đây
          </Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => String(item.transactionId)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={LuxeColors.primaryContainer}
            />
          }
          renderItem={({ item: txn }) => {
            const config = transactionTypeConfig[txn.transactionType] ?? {
              label: txn.transactionType,
              color: '#6f787f',
              icon: 'circle',
              borderColor: '#6f787f',
            };
            const positive = isPositive(txn);
            const amountColor = positive ? '#10b981' : '#ef4444';
            const arrowIcon = positive ? 'arrow-up-right' : 'arrow-down-right';
            const status = statusConfig[txn.status] ?? statusConfig['Pending'];

            return (
              <View style={[styles.txnCard, { borderLeftColor: config.borderColor }]}>
                <View style={styles.txnHeader}>
                  <View style={styles.txnLeft}>
                    <View style={[styles.txnIconWrap, { backgroundColor: config.color + '20' }]}>
                      <Feather name={config.icon as any} size={16} color={config.color} />
                    </View>
                    <View style={styles.txnLeftContent}>
                      <Text style={styles.txnLabel}>{config.label}</Text>
                      {txn.referenceId && (
                        <Text style={styles.txnRef}>#{txn.referenceId}</Text>
                      )}
                    </View>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                    <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
                  </View>
                </View>
                <View style={styles.txnFooter}>
                  <Text style={styles.txnDate}>{formatDate(txn.createdAt)}</Text>
                  <View style={styles.amountRow}>
                    <Feather name={arrowIcon as any} size={14} color={amountColor} />
                    <Text style={[styles.txnAmount, { color: amountColor }]}>
                      {`${positive ? '+' : '-'} ${formatCurrency(Math.abs(txn.amount))}`}
                    </Text>
                  </View>
                </View>
                {txn.description && (
                  <Text style={styles.txnDesc}>{txn.description}</Text>
                )}
              </View>
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LuxeColors.background,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: LuxeSpacing.lg,
    paddingVertical: LuxeSpacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: LuxeColors.outlineVariant + '30',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: LuxeColors.onSurface,
  },
  placeholder: {
    width: 40,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: LuxeSpacing.xl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: LuxeColors.onSurface,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: LuxeColors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20,
  },
  listContent: {
    padding: LuxeSpacing.lg,
    paddingBottom: 100,
  },
  txnCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: LuxeBorderRadius.lg,
    padding: LuxeSpacing.md,
    borderLeftWidth: 4,
    ...LuxeShadows.sm,
  },
  txnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  txnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  txnIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  txnLeftContent: { flex: 1 },
  txnLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: LuxeColors.onSurface,
  },
  txnRef: {
    fontSize: 12,
    color: LuxeColors.onSurfaceVariant,
    marginTop: 2,
  },
  txnRight: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 0,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  txnFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginLeft: 50,
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: LuxeColors.outlineVariant + '40',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  txnAmount: {
    fontSize: 16,
    fontWeight: '800',
  },
  txnDate: {
    fontSize: 12,
    color: LuxeColors.onSurfaceVariant,
  },
  txnDesc: {
    fontSize: 12,
    color: LuxeColors.onSurfaceVariant,
    marginTop: 8,
    marginLeft: 50,
    lineHeight: 18,
    fontStyle: 'italic',
  },
});
