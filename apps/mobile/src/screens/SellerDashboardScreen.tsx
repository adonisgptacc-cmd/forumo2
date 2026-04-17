import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { brandColors, spacing } from '@forumo/config';
import { useAuth } from '../providers/AuthProvider';
import type { MainStackParamList } from '../navigation/types';

interface RevenueMonth {
  month: string;
  revenueCents: number;
  orderCount: number;
}

interface SellerAnalytics {
  totalOrders: number;
  completedOrders: number;
  totalRevenueCents: number;
  avgOrderValueCents: number;
  ordersByStatus: Record<string, number>;
  revenueByMonth: RevenueMonth[];
}

function fmt(cents: number): string {
  return new Intl.NumberFormat('en', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export const SellerDashboardScreen: React.FC = () => {
  const { apiClient } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const [analytics, setAnalytics] = useState<SellerAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await apiClient.get<SellerAnalytics>('/orders/seller/analytics', { auth: true });
      setAnalytics(data);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load analytics');
    }
  }, [apiClient]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={brandColors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={() => { setLoading(true); load().finally(() => setLoading(false)); }}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const a = analytics;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.heading}>Seller Dashboard</Text>

      {/* KPI cards */}
      <View style={styles.cardRow}>
        <View style={[styles.kpiCard, { backgroundColor: '#1e3a2f' }]}>
          <Text style={styles.kpiLabel}>Total Revenue</Text>
          <Text style={[styles.kpiValue, { color: '#4ade80' }]}>{fmt(a?.totalRevenueCents ?? 0)}</Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: '#1e2a3a' }]}>
          <Text style={styles.kpiLabel}>Avg Order</Text>
          <Text style={[styles.kpiValue, { color: '#60a5fa' }]}>{fmt(a?.avgOrderValueCents ?? 0)}</Text>
        </View>
      </View>

      <View style={styles.cardRow}>
        <View style={[styles.kpiCard, { backgroundColor: '#2a1e3a' }]}>
          <Text style={styles.kpiLabel}>Total Orders</Text>
          <Text style={[styles.kpiValue, { color: '#c084fc' }]}>{a?.totalOrders ?? 0}</Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: '#3a2a1e' }]}>
          <Text style={styles.kpiLabel}>Completed</Text>
          <Text style={[styles.kpiValue, { color: '#fb923c' }]}>{a?.completedOrders ?? 0}</Text>
        </View>
      </View>

      {/* Orders by status */}
      {a?.ordersByStatus && Object.keys(a.ordersByStatus).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Orders by Status</Text>
          {Object.entries(a.ordersByStatus).map(([status, count]) => (
            <View key={status} style={styles.statusRow}>
              <Text style={styles.statusLabel}>{status}</Text>
              <Text style={styles.statusCount}>{count}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Monthly revenue */}
      {a?.revenueByMonth && a.revenueByMonth.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Revenue by Month</Text>
          {a.revenueByMonth.slice(-6).reverse().map((row) => (
            <View key={row.month} style={styles.monthRow}>
              <Text style={styles.monthLabel}>{row.month}</Text>
              <View style={styles.monthRight}>
                <Text style={styles.monthRevenue}>{fmt(row.revenueCents)}</Text>
                <Text style={styles.monthOrders}>{row.orderCount} orders</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Quick actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.push('MyListings')}>
          <Text style={styles.actionBtnText}>My Listings →</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.push('CreateListing')}>
          <Text style={styles.actionBtnText}>+ New Listing →</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.push('Offers')}>
          <Text style={styles.actionBtnText}>My Offers →</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brandColors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  heading: { fontSize: 24, fontWeight: '800', margin: spacing.md, color: '#111827' },
  cardRow: { flexDirection: 'row', gap: 12, marginHorizontal: spacing.md, marginBottom: 12 },
  kpiCard: {
    flex: 1,
    borderRadius: 12,
    padding: spacing.md,
  },
  kpiLabel: { fontSize: 12, color: '#9ca3af', marginBottom: 4 },
  kpiValue: { fontSize: 22, fontWeight: '800' },
  section: {
    backgroundColor: brandColors.card,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: 12,
    padding: spacing.md,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  statusLabel: { fontSize: 14, color: '#374151' },
  statusCount: { fontSize: 14, fontWeight: '700', color: brandColors.primary },
  monthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  monthLabel: { fontSize: 14, color: '#374151' },
  monthRight: { alignItems: 'flex-end' },
  monthRevenue: { fontSize: 14, fontWeight: '700', color: '#111827' },
  monthOrders: { fontSize: 12, color: '#9ca3af' },
  actionBtn: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  actionBtnText: { fontSize: 15, color: brandColors.primary, fontWeight: '600' },
  errorText: { fontSize: 15, color: '#dc2626', marginBottom: 12 },
  retryText: { fontSize: 15, color: brandColors.primary, fontWeight: '600' },
});
