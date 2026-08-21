import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { SafeOrder } from "@forumo/shared";
import { brandColors, spacing } from "@forumo/config";
import { useAuth } from "../providers/AuthProvider";
import type { MainStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<MainStackParamList, "OrderDetail">;

function formatCents(cents: number, currency = "USD") {
  return `${currency} ${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: "#fef9c3", text: "#854d0e" },
  CONFIRMED: { bg: "#dbeafe", text: "#1d4ed8" },
  PAID: { bg: "#dcfce7", text: "#15803d" },
  FULFILLED: { bg: "#e0f2fe", text: "#0369a1" },
  DELIVERED: { bg: "#d1fae5", text: "#065f46" },
  COMPLETED: { bg: "#f0fdf4", text: "#16a34a" },
  CANCELLED: { bg: "#fee2e2", text: "#dc2626" },
  REFUNDED: { bg: "#f3e8ff", text: "#7c3aed" },
  DISPUTED: { bg: "#fff7ed", text: "#c2410c" },
};

const TIMELINE_ICONS: Record<string, string> = {
  PENDING: "🕐",
  CONFIRMED: "✅",
  PAID: "💳",
  FULFILLED: "📦",
  DELIVERED: "🚚",
  COMPLETED: "🎉",
  CANCELLED: "❌",
  REFUNDED: "↩️",
  DISPUTED: "⚠️",
};

export const OrderDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { orderId, order: initialOrder } = route.params;
  const { apiClient, user } = useAuth();

  const [order, setOrder] = useState<SafeOrder | undefined>(initialOrder);
  const [loading, setLoading] = useState(!initialOrder);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const loadOrder = useCallback(async () => {
    try {
      const data = await apiClient.orders.get(orderId);
      setOrder(data);
    } catch {
      // keep whatever we have
    }
  }, [apiClient, orderId]);

  useEffect(() => {
    if (!initialOrder) {
      setLoading(true);
      loadOrder().finally(() => setLoading(false));
    } else {
      navigation.setOptions({ title: `Order #${initialOrder.orderNumber}` });
    }
  }, []);

  useEffect(() => {
    if (order) {
      navigation.setOptions({ title: `Order #${order.orderNumber}` });
    }
  }, [order]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrder();
    setRefreshing(false);
  };

  const releaseEscrow = async () => {
    Alert.alert(
      "Release Escrow",
      "Confirm you have received the item and release payment to the seller?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Release",
          onPress: async () => {
            setActionLoading(true);
            try {
              const updated = await apiClient.orders.updateStatus(orderId, {
                status: "COMPLETED",
                note: "Escrow released by buyer",
              });
              setOrder(updated);
              Alert.alert("Success", "Payment released to seller.");
            } catch (err: any) {
              Alert.alert("Failed", err.message ?? "Could not release escrow.");
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  };

  const disputeOrder = async () => {
    Alert.alert(
      "Open Dispute",
      "Are you sure you want to open a dispute for this order?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Open Dispute",
          style: "destructive",
          onPress: async () => {
            setActionLoading(true);
            try {
              const updated = await apiClient.orders.updateStatus(orderId, {
                status: "DISPUTED",
                note: "Dispute opened by buyer",
              });
              setOrder(updated);
            } catch (err: any) {
              Alert.alert("Failed", err.message ?? "Could not open dispute.");
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.center} testID="order-detail-loading">
        <ActivityIndicator size="large" color={brandColors.primary} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Order not found.</Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isBuyer = user?.id === order.buyerId;
  const isSeller = user?.id === order.sellerId;
  const colors = STATUS_COLORS[order.status] ?? {
    bg: "#f3f4f6",
    text: "#374151",
  };
  const totalCents =
    order.totalItemCents + order.shippingCents + order.feeCents;

  return (
    <ScrollView
      style={styles.container}
      testID="order-detail"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.headerSection}>
        <View style={styles.headerRow}>
          <Text style={styles.orderNum}>#{order.orderNumber}</Text>
          <View style={[styles.badge, { backgroundColor: colors.bg }]}>
            <Text style={[styles.badgeText, { color: colors.text }]}>
              {order.status}
            </Text>
          </View>
        </View>
        {order.placedAt ? (
          <Text style={styles.dateText}>
            Placed: {formatDate(order.placedAt)}
          </Text>
        ) : null}
      </View>

      {/* Items */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Items</Text>
        {order.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemTitle} numberOfLines={2}>
                {item.listingTitle}
              </Text>
              <Text style={styles.itemQty}>Qty: {item.quantity}</Text>
            </View>
            <Text style={styles.itemPrice}>
              {formatCents(item.unitPriceCents * item.quantity, item.currency)}
            </Text>
          </View>
        ))}
        <View style={styles.priceSummary}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Subtotal</Text>
            <Text style={styles.priceValue}>
              {formatCents(order.totalItemCents, order.currency)}
            </Text>
          </View>
          {order.shippingCents > 0 && (
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Shipping</Text>
              <Text style={styles.priceValue}>
                {formatCents(order.shippingCents, order.currency)}
              </Text>
            </View>
          )}
          {order.feeCents > 0 && (
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Platform fee</Text>
              <Text style={styles.priceValue}>
                {formatCents(order.feeCents, order.currency)}
              </Text>
            </View>
          )}
          <View style={[styles.priceRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>
              {formatCents(totalCents, order.currency)}
            </Text>
          </View>
        </View>
      </View>

      {/* Escrow */}
      {order.escrow && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔒 Escrow</Text>
          <View style={styles.escrowRow}>
            <Text style={styles.escrowLabel}>Status</Text>
            <Text style={styles.escrowValue}>{order.escrow.status}</Text>
          </View>
          <View style={styles.escrowRow}>
            <Text style={styles.escrowLabel}>Amount</Text>
            <Text style={styles.escrowValue}>
              {formatCents(order.escrow.amountCents, order.escrow.currency)}
            </Text>
          </View>
        </View>
      )}

      {/* Timeline */}
      {order.timeline.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Timeline</Text>
          {order.timeline.map((event, idx) => (
            <View key={event.id ?? idx} style={styles.timelineRow}>
              <Text style={styles.timelineIcon}>
                {TIMELINE_ICONS[event.status] ?? "•"}
              </Text>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineStatus}>{event.status}</Text>
                {event.note ? (
                  <Text style={styles.timelineNote}>{event.note}</Text>
                ) : null}
                <Text style={styles.timelineDate}>
                  {formatDate(event.createdAt)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Buyer actions */}
      {isBuyer &&
        (order.status === "DELIVERED" || order.status === "FULFILLED") && (
          <View style={styles.actionsSection}>
            <TouchableOpacity
              style={[
                styles.actionBtn,
                styles.releaseBtn,
                actionLoading && styles.btnDisabled,
              ]}
              onPress={releaseEscrow}
              disabled={actionLoading}
              testID="release-escrow-button"
            >
              {actionLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.actionBtnText}>
                  ✓ Confirm Receipt & Release Payment
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionBtn,
                styles.disputeBtn,
                actionLoading && styles.btnDisabled,
              ]}
              onPress={disputeOrder}
              disabled={actionLoading}
              testID="dispute-button"
            >
              <Text style={[styles.actionBtnText, { color: "#ef4444" }]}>
                ⚠ Open Dispute
              </Text>
            </TouchableOpacity>
          </View>
        )}

      {/* Seller info */}
      {isSeller && order.status === "PAID" && (
        <View style={styles.actionsSection}>
          <View style={styles.sellerNotice}>
            <Text style={styles.sellerNoticeText}>
              Payment received in escrow. Ship the item and mark as fulfilled.
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              styles.releaseBtn,
              actionLoading && styles.btnDisabled,
            ]}
            onPress={async () => {
              setActionLoading(true);
              try {
                const updated = await apiClient.orders.updateStatus(orderId, {
                  status: "FULFILLED",
                  note: "Item shipped",
                });
                setOrder(updated);
              } catch (err: any) {
                Alert.alert(
                  "Failed",
                  err.message ?? "Could not update status.",
                );
              } finally {
                setActionLoading(false);
              }
            }}
            disabled={actionLoading}
            testID="mark-fulfilled-button"
          >
            {actionLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.actionBtnText}>📦 Mark as Shipped</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brandColors.background },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  errorText: { color: brandColors.muted, marginBottom: spacing.md },
  backBtn: {
    backgroundColor: brandColors.primary,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  backBtnText: { color: "#fff", fontWeight: "700" },
  headerSection: { padding: spacing.md, paddingBottom: 8 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  orderNum: { fontSize: 22, fontWeight: "700" },
  badge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: "700" },
  dateText: { fontSize: 13, color: brandColors.muted },
  section: {
    backgroundColor: brandColors.card,
    marginHorizontal: spacing.md,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginBottom: 12 },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  itemInfo: { flex: 1, marginRight: 12 },
  itemTitle: { fontSize: 14, fontWeight: "500" },
  itemQty: { fontSize: 12, color: brandColors.muted, marginTop: 2 },
  itemPrice: { fontSize: 15, fontWeight: "700", color: brandColors.primary },
  priceSummary: { marginTop: 8, gap: 4 },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  priceLabel: { color: brandColors.muted },
  priceValue: { fontWeight: "500" },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    marginTop: 6,
    paddingTop: 10,
  },
  totalLabel: { fontSize: 15, fontWeight: "700" },
  totalValue: { fontSize: 17, fontWeight: "700", color: brandColors.primary },
  escrowRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  escrowLabel: { color: brandColors.muted },
  escrowValue: { fontWeight: "600" },
  timelineRow: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  timelineIcon: { fontSize: 20, width: 28, textAlign: "center" },
  timelineContent: { flex: 1, gap: 2 },
  timelineStatus: { fontWeight: "600", fontSize: 14 },
  timelineNote: { fontSize: 13, color: "#374151" },
  timelineDate: { fontSize: 11, color: brandColors.muted },
  actionsSection: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  actionBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  releaseBtn: { backgroundColor: brandColors.primary },
  disputeBtn: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#fca5a5",
  },
  btnDisabled: { opacity: 0.6 },
  actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  sellerNotice: {
    backgroundColor: "#eff6ff",
    borderRadius: 10,
    padding: spacing.md,
  },
  sellerNoticeText: { color: "#1d4ed8", fontSize: 13, lineHeight: 18 },
});
