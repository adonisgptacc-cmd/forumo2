import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { brandColors, spacing } from '@forumo/config';
import { useAuth } from '../providers/AuthProvider';
import type { MainStackParamList } from '../navigation/types';
import { cartStore } from './CartScreen';

type Props = NativeStackScreenProps<MainStackParamList, 'Checkout'>;

function formatCents(cents: number, currency = 'USD') {
  return `${currency} ${(cents / 100).toFixed(2)}`;
}

export const CheckoutScreen: React.FC<Props> = ({ route, navigation }) => {
  const { sellerId } = route.params;
  const { apiClient, user } = useAuth();
  const [placing, setPlacing] = useState(false);

  const allItems = cartStore.getItems();
  const sellerItems = allItems.filter((i) => i.listing.sellerId === sellerId);

  const subtotalCents = sellerItems.reduce(
    (sum, item) => sum + item.listing.priceCents * item.quantity,
    0
  );
  const currency = sellerItems[0]?.listing.currency ?? 'USD';
  const platformFeeCents = Math.round(subtotalCents * 0.03);
  const totalCents = subtotalCents + platformFeeCents;

  const placeOrder = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to place an order.');
      return;
    }
    if (sellerItems.length === 0) {
      Alert.alert('Empty Cart', 'No items to order.');
      return;
    }

    setPlacing(true);
    try {
      const order = await apiClient.orders.create({
        buyerId: user.id,
        sellerId,
        currency,
        items: sellerItems.map((i) => ({
          listingId: i.listingId,
          quantity: i.quantity,
        })),
        feeCents: platformFeeCents,
      });

      // Remove ordered items from cart
      sellerItems.forEach((i) => cartStore.removeItem(i.listingId));

      const payment = await apiClient.orders.initiatePayment(order.id, {
        callbackUrl: 'forumo://checkout/success',
      });

      if (payment.provider === 'paystack' && payment.authorizationUrl) {
        await Linking.openURL(payment.authorizationUrl);
        return;
      }

      Alert.alert('Order Placed!', `Order #${order.orderNumber} confirmed.`, [
        {
          text: 'View Order',
          onPress: () => {
            navigation.replace('OrderDetail', { orderId: order.id, order });
          },
        },
        {
          text: 'Continue Shopping',
          onPress: () => navigation.navigate('Tabs'),
        },
      ]);
    } catch (err: any) {
      Alert.alert('Order Failed', err.message ?? 'Could not place order. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  if (sellerItems.length === 0) {
    return (
      <View style={styles.emptyContainer} testID="checkout-empty">
        <Text style={styles.emptyText}>No items to checkout for this seller.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} testID="checkout-screen">
      <Text style={styles.heading}>Review Order</Text>

      {/* Order items */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Items</Text>
        {sellerItems.map((item) => (
          <View key={item.listingId} style={styles.itemRow}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemTitle} numberOfLines={1}>{item.listing.title}</Text>
              <Text style={styles.itemQty}>Qty: {item.quantity}</Text>
            </View>
            <Text style={styles.itemPrice}>
              {formatCents(item.listing.priceCents * item.quantity, currency)}
            </Text>
          </View>
        ))}
      </View>

      {/* Price breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Price Summary</Text>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Subtotal</Text>
          <Text style={styles.priceValue}>{formatCents(subtotalCents, currency)}</Text>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Platform fee (3%)</Text>
          <Text style={styles.priceValue}>{formatCents(platformFeeCents, currency)}</Text>
        </View>
        <View style={[styles.priceRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatCents(totalCents, currency)}</Text>
        </View>
      </View>

      {/* Escrow notice */}
      <View style={styles.escrowNotice}>
        <Text style={styles.escrowIcon}>🔒</Text>
        <Text style={styles.escrowText}>
          Payment is held in escrow and only released to the seller after you confirm receipt.
        </Text>
      </View>

      {/* Place order button */}
      <TouchableOpacity
        style={[styles.placeOrderBtn, placing && styles.btnDisabled]}
        onPress={placeOrder}
        disabled={placing}
        testID="place-order-button"
      >
        {placing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.placeOrderBtnText}>
            Place Order — {formatCents(totalCents, currency)}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()} disabled={placing}>
        <Text style={styles.cancelBtnText}>Back to Cart</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brandColors.background },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  emptyText: { color: brandColors.muted, marginBottom: spacing.md },
  backBtn: { backgroundColor: brandColors.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  backBtnText: { color: '#fff', fontWeight: '700' },
  heading: { fontSize: 22, fontWeight: '700', padding: spacing.md, paddingBottom: 8 },
  section: {
    backgroundColor: brandColors.card,
    marginHorizontal: spacing.md,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  itemInfo: { flex: 1, marginRight: 12 },
  itemTitle: { fontSize: 14, fontWeight: '500' },
  itemQty: { fontSize: 12, color: brandColors.muted, marginTop: 2 },
  itemPrice: { fontSize: 15, fontWeight: '700', color: brandColors.primary },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  priceLabel: { color: brandColors.muted },
  priceValue: { fontWeight: '500' },
  totalRow: { borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 6, paddingTop: 12 },
  totalLabel: { fontSize: 16, fontWeight: '700' },
  totalValue: { fontSize: 18, fontWeight: '700', color: brandColors.primary },
  escrowNotice: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    marginHorizontal: spacing.md,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: 10,
    alignItems: 'flex-start',
  },
  escrowIcon: { fontSize: 20 },
  escrowText: { flex: 1, fontSize: 13, color: '#1d4ed8', lineHeight: 18 },
  placeOrderBtn: {
    backgroundColor: brandColors.primary,
    marginHorizontal: spacing.md,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  btnDisabled: { opacity: 0.6 },
  placeOrderBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancelBtn: {
    marginHorizontal: spacing.md,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cancelBtnText: { color: brandColors.muted, fontWeight: '600' },
});
