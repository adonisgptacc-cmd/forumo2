import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { SafeListing } from "@forumo/shared";
import { brandColors, spacing } from "@forumo/config";
import { useAuth } from "../providers/AuthProvider";
import type { MainStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<MainStackParamList, "Cart">;

export interface CartItem {
  listingId: string;
  listing: SafeListing;
  quantity: number;
}

const CART_STORAGE_KEY = "@forumo/cart";

// Persisted cart store singleton
let globalCart: CartItem[] = [];
const cartListeners: Array<(items: CartItem[]) => void> = [];

function persist(cart: CartItem[]) {
  AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart)).catch(() => {});
}

function notify() {
  cartListeners.forEach((fn) => fn([...globalCart]));
}

export const cartStore = {
  getItems: () => globalCart,
  // Called once at app start to rehydrate from storage
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(CART_STORAGE_KEY);
      if (raw) {
        globalCart = JSON.parse(raw) as CartItem[];
        notify();
      }
    } catch {
      // ignore parse errors
    }
  },
  addItem: (listing: SafeListing, quantity = 1) => {
    const existing = globalCart.find((i) => i.listingId === listing.id);
    if (existing) {
      globalCart = globalCart.map((i) =>
        i.listingId === listing.id
          ? { ...i, quantity: i.quantity + quantity }
          : i,
      );
    } else {
      globalCart = [
        ...globalCart,
        { listingId: listing.id, listing, quantity },
      ];
    }
    persist(globalCart);
    notify();
  },
  removeItem: (listingId: string) => {
    globalCart = globalCart.filter((i) => i.listingId !== listingId);
    persist(globalCart);
    notify();
  },
  updateQuantity: (listingId: string, quantity: number) => {
    if (quantity <= 0) {
      cartStore.removeItem(listingId);
      return;
    }
    globalCart = globalCart.map((i) =>
      i.listingId === listingId ? { ...i, quantity } : i,
    );
    persist(globalCart);
    notify();
  },
  clear: () => {
    globalCart = [];
    persist(globalCart);
    notify();
  },
  subscribe: (fn: (items: CartItem[]) => void) => {
    cartListeners.push(fn);
    return () => {
      const idx = cartListeners.indexOf(fn);
      if (idx !== -1) cartListeners.splice(idx, 1);
    };
  },
};

function useCart() {
  const [items, setItems] = useState<CartItem[]>(() => cartStore.getItems());
  useEffect(() => {
    return cartStore.subscribe(setItems);
  }, []);
  return items;
}

function formatCents(cents: number, currency = "USD") {
  return `${currency} ${(cents / 100).toFixed(2)}`;
}

// Group items by seller
function groupBySeller(items: CartItem[]): Map<string, CartItem[]> {
  const map = new Map<string, CartItem[]>();
  for (const item of items) {
    const sellerId = item.listing.sellerId;
    if (!map.has(sellerId)) map.set(sellerId, []);
    map.get(sellerId)!.push(item);
  }
  return map;
}

interface CartItemRowProps {
  item: CartItem;
  onRemove: (id: string) => void;
  onQtyChange: (id: string, qty: number) => void;
}

const CartItemRow: React.FC<CartItemRowProps> = ({
  item,
  onRemove,
  onQtyChange,
}) => {
  return (
    <View style={styles.itemRow} testID={`cart-item-${item.listingId}`}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemTitle} numberOfLines={2}>
          {item.listing.title}
        </Text>
        <Text style={styles.itemPrice}>
          {formatCents(
            item.listing.priceCents * item.quantity,
            item.listing.currency,
          )}
        </Text>
        <Text style={styles.itemUnitPrice}>
          {formatCents(item.listing.priceCents, item.listing.currency)} each
        </Text>
      </View>
      <View style={styles.qtyControls}>
        <TouchableOpacity
          style={styles.qtyBtn}
          onPress={() => onQtyChange(item.listingId, item.quantity - 1)}
          testID={`qty-decrease-${item.listingId}`}
        >
          <Text style={styles.qtyBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.qtyValue}>{item.quantity}</Text>
        <TouchableOpacity
          style={styles.qtyBtn}
          onPress={() => onQtyChange(item.listingId, item.quantity + 1)}
          testID={`qty-increase-${item.listingId}`}
        >
          <Text style={styles.qtyBtnText}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={() => onRemove(item.listingId)}
          testID={`remove-item-${item.listingId}`}
        >
          <Text style={styles.removeBtnText}>×</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export const CartScreen: React.FC<Props> = ({ navigation }) => {
  const items = useCart();
  const { user } = useAuth();

  const sellerGroups = groupBySeller(items);

  const totalCents = items.reduce(
    (sum, item) => sum + item.listing.priceCents * item.quantity,
    0,
  );

  const handleCheckout = (sellerId: string) => {
    if (!user) {
      Alert.alert("Sign In Required", "Please sign in to checkout.");
      return;
    }
    const sellerItems = sellerGroups.get(sellerId) ?? [];
    const sellerName = sellerItems[0]?.listing.sellerId ?? sellerId;
    navigation.push("Checkout", { sellerId, sellerName });
  };

  const handleClearCart = () => {
    Alert.alert("Clear Cart", "Remove all items?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: () => cartStore.clear() },
    ]);
  };

  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer} testID="cart-empty">
        <Text style={styles.emptyIcon}>🛒</Text>
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptySubtitle}>
          Browse listings and add items to your cart.
        </Text>
        <TouchableOpacity
          style={styles.browseBtn}
          onPress={() => navigation.navigate("Tabs")}
        >
          <Text style={styles.browseBtnText}>Browse Listings</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const sellerSections = Array.from(sellerGroups.entries());

  return (
    <View style={styles.container} testID="cart-screen">
      <FlatList
        data={sellerSections}
        keyExtractor={([sellerId]) => sellerId}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.headerRow}>
            <Text style={styles.heading}>Cart ({items.length} items)</Text>
            <TouchableOpacity onPress={handleClearCart}>
              <Text style={styles.clearText}>Clear all</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item: [sellerId, sellerItems] }) => {
          const sellerTotal = sellerItems.reduce(
            (sum, i) => sum + i.listing.priceCents * i.quantity,
            0,
          );
          const currency = sellerItems[0]?.listing.currency ?? "USD";
          return (
            <View style={styles.sellerGroup}>
              <Text style={styles.sellerLabel}>
                Seller: {sellerId.slice(0, 8)}…
              </Text>
              {sellerItems.map((item) => (
                <CartItemRow
                  key={item.listingId}
                  item={item}
                  onRemove={cartStore.removeItem}
                  onQtyChange={cartStore.updateQuantity}
                />
              ))}
              <View style={styles.sellerFooter}>
                <Text style={styles.sellerTotal}>
                  Subtotal: {formatCents(sellerTotal, currency)}
                </Text>
                <TouchableOpacity
                  style={styles.checkoutBtn}
                  onPress={() => handleCheckout(sellerId)}
                  testID={`checkout-seller-${sellerId}`}
                >
                  <Text style={styles.checkoutBtnText}>Checkout</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListFooterComponent={
          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>Cart Total</Text>
            <Text style={styles.totalValue}>{formatCents(totalCents)}</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brandColors.background },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  emptyIcon: { fontSize: 64, marginBottom: spacing.md },
  emptyTitle: { fontSize: 20, fontWeight: "700", marginBottom: 8 },
  emptySubtitle: {
    color: brandColors.muted,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  browseBtn: {
    backgroundColor: brandColors.primary,
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  browseBtnText: { color: "#fff", fontWeight: "700" },
  list: { padding: spacing.md, gap: spacing.md },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  heading: { fontSize: 22, fontWeight: "700" },
  clearText: { color: "#ef4444", fontSize: 14 },
  sellerGroup: {
    backgroundColor: brandColors.card,
    borderRadius: 12,
    padding: spacing.md,
    gap: 8,
  },
  sellerLabel: { fontSize: 12, color: brandColors.muted, fontWeight: "600" },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  itemInfo: { flex: 1, marginRight: 12 },
  itemTitle: { fontSize: 14, fontWeight: "500", marginBottom: 4 },
  itemPrice: { fontSize: 16, fontWeight: "700", color: brandColors.primary },
  itemUnitPrice: { fontSize: 11, color: brandColors.muted },
  qtyControls: { flexDirection: "row", alignItems: "center", gap: 8 },
  qtyBtn: {
    backgroundColor: "#f3f4f6",
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnText: { fontSize: 18, fontWeight: "600", color: "#374151" },
  qtyValue: {
    fontSize: 16,
    fontWeight: "600",
    minWidth: 24,
    textAlign: "center",
  },
  removeBtn: {
    backgroundColor: "#fee2e2",
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  removeBtnText: { fontSize: 18, color: "#ef4444", fontWeight: "700" },
  sellerFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  sellerTotal: { fontSize: 15, fontWeight: "600" },
  checkoutBtn: {
    backgroundColor: brandColors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  checkoutBtnText: { color: "#fff", fontWeight: "700" },
  totalBox: {
    backgroundColor: brandColors.card,
    borderRadius: 12,
    padding: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: { fontSize: 16, fontWeight: "600" },
  totalValue: { fontSize: 20, fontWeight: "700", color: brandColors.primary },
});
