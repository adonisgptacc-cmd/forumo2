import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { SavedListing } from "@forumo/shared";
import { brandColors, spacing } from "@forumo/config";
import { useAuth } from "../providers/AuthProvider";
import type { MainStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<MainStackParamList, "Wishlist">;

function formatCents(cents: number, currency = "USD") {
  return `${currency} ${(cents / 100).toFixed(2)}`;
}

export const WishlistScreen: React.FC<Props> = ({ navigation }) => {
  const { apiClient, user } = useAuth();
  const [items, setItems] = useState<SavedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiClient.wishlist.list();
      setItems(data);
    } catch {
      setItems([]);
    }
  }, [apiClient]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleRemove = (listingId: string) => {
    Alert.alert("Remove from Wishlist", "Remove this item?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setRemoving(listingId);
          try {
            await apiClient.wishlist.remove(listingId);
            setItems((prev) => prev.filter((i) => i.listingId !== listingId));
          } catch {
            Alert.alert("Error", "Could not remove item. Please try again.");
          } finally {
            setRemoving(null);
          }
        },
      },
    ]);
  };

  if (!user) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyIcon}>♡</Text>
        <Text style={styles.emptyTitle}>Sign in to see your wishlist</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={brandColors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.list}
      data={items}
      keyExtractor={(item) => item.listingId}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      ListEmptyComponent={
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>♡</Text>
          <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
          <Text style={styles.emptySub}>
            Browse listings and tap ♡ to save items.
          </Text>
          <TouchableOpacity
            style={styles.browseBtn}
            onPress={() => navigation.navigate("Tabs")}
          >
            <Text style={styles.browseBtnText}>Browse Listings</Text>
          </TouchableOpacity>
        </View>
      }
      renderItem={({ item }) => {
        const listing = item.listing;
        if (!listing) return null;
        const image = listing.images?.[0];
        const isRemoving = removing === item.listingId;

        return (
          <TouchableOpacity
            style={styles.card}
            onPress={() =>
              navigation.push("ListingDetail", { listingId: listing.id })
            }
            testID={`wishlist-item-${listing.id}`}
          >
            {image?.url ? (
              <Image
                source={{ uri: image.url }}
                style={styles.image}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.imagePlaceholderText}>🖼</Text>
              </View>
            )}
            <View style={styles.info}>
              <Text style={styles.title} numberOfLines={2}>
                {listing.title}
              </Text>
              <Text style={styles.price}>
                {formatCents(listing.priceCents, listing.currency)}
              </Text>
              {listing.location ? (
                <Text style={styles.location} numberOfLines={1}>
                  📍 {listing.location}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => handleRemove(item.listingId)}
              disabled={isRemoving}
              testID={`remove-wishlist-${listing.id}`}
            >
              {isRemoving ? (
                <ActivityIndicator size="small" color="#ef4444" />
              ) : (
                <Text style={styles.removeBtnText}>♥</Text>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        );
      }}
    />
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brandColors.background },
  list: { padding: spacing.md, gap: spacing.sm, flexGrow: 1 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    minHeight: 300,
  },
  emptyIcon: { fontSize: 56, marginBottom: 12 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySub: {
    fontSize: 14,
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

  card: {
    backgroundColor: brandColors.card,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },
  image: { width: 80, height: 80 },
  imagePlaceholder: {
    width: 80,
    height: 80,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  imagePlaceholderText: { fontSize: 24 },
  info: { flex: 1, padding: spacing.sm, gap: 4 },
  title: { fontSize: 14, fontWeight: "600", lineHeight: 19 },
  price: { fontSize: 15, fontWeight: "700", color: brandColors.success },
  location: { fontSize: 12, color: brandColors.muted },
  removeBtn: {
    padding: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  removeBtnText: { fontSize: 22, color: "#ef4444" },
});
