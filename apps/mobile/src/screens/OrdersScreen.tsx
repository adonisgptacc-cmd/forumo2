import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import type { SafeOrder } from '@forumo/shared';
import { brandColors, spacing } from '@forumo/config';
import { useAuth } from '../providers/AuthProvider';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../navigation/types';
import { formatCents, formatDate, ORDER_STATUS_COLORS } from '../utils/format';

const DEMO_ORDERS: SafeOrder[] = [
  {
    id: 'demo-order-1',
    orderNumber: 'ORD-001',
    buyerId: 'demo-buyer',
    sellerId: 'demo-seller',
    status: 'PAID',
    paymentStatus: 'CAPTURED',
    totalItemCents: 15000,
    shippingCents: 500,
    feeCents: 450,
    feePercent: 3,
    currency: 'USD',
    placedAt: new Date(Date.now() - 86400000).toISOString(),
    timeline: [],
    items: [{ id: 'item-1', listingId: 'l-1', listingTitle: 'Demo Product', unitPriceCents: 15000, quantity: 1, currency: 'USD' }],
    shipments: [],
    payments: [],
  },
  {
    id: 'demo-order-2',
    orderNumber: 'ORD-002',
    buyerId: 'demo-buyer',
    sellerId: 'demo-seller-2',
    status: 'COMPLETED',
    paymentStatus: 'SETTLED',
    totalItemCents: 8000,
    shippingCents: 0,
    feeCents: 240,
    feePercent: 3,
    currency: 'USD',
    placedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    timeline: [],
    items: [{ id: 'item-2', listingId: 'l-2', listingTitle: 'Another Item', unitPriceCents: 8000, quantity: 1, currency: 'USD' }],
    shipments: [],
    payments: [],
  },
];



interface OrderCardProps {
  order: SafeOrder;
  onPress: () => void;
}

const OrderCard: React.FC<OrderCardProps> = ({ order, onPress }) => {
  const colors = ORDER_STATUS_COLORS[order.status] ?? { bg: '#f3f4f6', text: '#374151' };
  const firstItem = order.items[0];

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} testID={`order-card-${order.id}`}>
      <View style={styles.cardHeader}>
        <Text style={styles.orderNum}>#{order.orderNumber}</Text>
        <View style={[styles.badge, { backgroundColor: colors.bg }]}>
          <Text style={[styles.badgeText, { color: colors.text }]}>{order.status}</Text>
        </View>
      </View>
      {firstItem ? (
        <Text style={styles.itemName} numberOfLines={1}>{firstItem.listingTitle}</Text>
      ) : null}
      {order.items.length > 1 ? (
        <Text style={styles.moreItems}>+{order.items.length - 1} more item(s)</Text>
      ) : null}
      <View style={styles.cardFooter}>
        <Text style={styles.amount}>
          {formatCents(order.totalItemCents + order.shippingCents + order.feeCents, order.currency)}
        </Text>
        {order.placedAt ? (
          <Text style={styles.date}>{formatDate(order.placedAt)}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

export const OrdersTab: React.FC = () => {
  const { apiClient } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const [orders, setOrders] = useState<SafeOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const data = await apiClient.orders.list();
      setOrders(Array.isArray(data) ? data : []);
    } catch {
      setOrders(DEMO_ORDERS);
      setError('Showing demo orders.');
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.container} testID="orders-tab">
      <Text style={styles.heading}>My Orders</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading && orders.length === 0 ? (
        <View style={styles.center}><ActivityIndicator size="large" color={brandColors.primary} /></View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              onPress={() => navigation.push('OrderDetail', { orderId: item.id, order: item })}
            />
          )}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>📦</Text>
                <Text style={styles.emptyText}>No orders yet.</Text>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brandColors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 22, fontWeight: '700', padding: spacing.md, paddingBottom: 8 },
  error: { color: '#f97316', paddingHorizontal: spacing.md, marginBottom: 4 },
  list: { padding: spacing.md, gap: spacing.sm },
  card: {
    backgroundColor: brandColors.card,
    borderRadius: 12,
    padding: spacing.md,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNum: { fontWeight: '700', fontSize: 15 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  itemName: { fontSize: 14, color: '#374151' },
  moreItems: { fontSize: 12, color: brandColors.muted },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  amount: { fontSize: 16, fontWeight: '700', color: brandColors.primary },
  date: { fontSize: 12, color: brandColors.muted },
  emptyBox: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: brandColors.muted, fontSize: 16 },
});
