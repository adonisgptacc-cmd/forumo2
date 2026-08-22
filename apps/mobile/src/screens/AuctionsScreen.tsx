import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import type { Auction } from "@forumo/shared";
import { brandColors, spacing } from "@forumo/config";
import { useAuth } from "../providers/AuthProvider";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../navigation/types";

const DEMO_AUCTIONS: Auction[] = [
  {
    id: "demo-1",
    listingId: "listing-1",
    sellerId: "seller-1",
    status: "ACTIVE",
    startingBidCents: 5000,
    currency: "USD",
    reserveCents: null,
    buyNowCents: 20000,
    startAt: new Date(Date.now() - 3600000).toISOString(),
    endAt: new Date(Date.now() + 7200000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    currentBidCents: 8500,
    bidCount: 5,
    listing: {
      id: "listing-1",
      title: "Vintage Mechanical Watch",
      description: "Rare 1960s automatic dress watch",
      priceCents: 20000,
      currency: "USD",
      status: "PUBLISHED",
      sellerId: "seller-1",
      moderationStatus: "APPROVED",
      images: [],
      variants: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  },
  {
    id: "demo-2",
    listingId: "listing-2",
    sellerId: "seller-2",
    status: "ACTIVE",
    startingBidCents: 2000,
    currency: "USD",
    reserveCents: null,
    buyNowCents: null,
    startAt: new Date(Date.now() - 1800000).toISOString(),
    endAt: new Date(Date.now() + 3600000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    currentBidCents: 3200,
    bidCount: 2,
    listing: {
      id: "listing-2",
      title: "Signed Sports Memorabilia",
      description: "Authenticated signed jersey",
      priceCents: 10000,
      currency: "USD",
      status: "PUBLISHED",
      sellerId: "seller-2",
      moderationStatus: "APPROVED",
      images: [],
      variants: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  },
];

function formatCents(cents: number, currency = "USD") {
  return `${currency} ${(cents / 100).toFixed(2)}`;
}

function useCountdownShort(endAt: string) {
  const [remaining, setRemaining] = useState("");
  useEffect(() => {
    const tick = () => {
      const diff = new Date(endAt).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining("Ended");
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (h > 0) setRemaining(`${h}h ${m}m`);
      else if (m > 0) setRemaining(`${m}m ${s}s`);
      else setRemaining(`${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endAt]);
  return remaining;
}

interface AuctionCardProps {
  item: Auction;
  onPress: () => void;
}

const AuctionCard: React.FC<AuctionCardProps> = ({ item, onPress }) => {
  const remaining = useCountdownShort(item.endAt);
  const isEnding = new Date(item.endAt).getTime() - Date.now() < 2 * 60 * 1000;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      testID={`auction-card-${item.id}`}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.listing?.title ?? "Auction"}
        </Text>
        <View style={[styles.timerBadge, isEnding && styles.timerBadgeUrgent]}>
          <Text style={[styles.timerText, isEnding && styles.timerTextUrgent]}>
            {remaining}
          </Text>
        </View>
      </View>
      <View style={styles.cardRow}>
        <View>
          <Text style={styles.label}>Current Bid</Text>
          <Text style={styles.currentBid}>
            {formatCents(
              item.currentBidCents ?? item.startingBidCents,
              item.currency,
            )}
          </Text>
          <Text style={styles.bidCount}>{item.bidCount ?? 0} bids</Text>
        </View>
        {item.buyNowCents ? (
          <View style={styles.buyNowBox}>
            <Text style={styles.label}>Buy Now</Text>
            <Text style={styles.buyNowPrice}>
              {formatCents(item.buyNowCents, item.currency)}
            </Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

export const AuctionsTab: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { apiClient } = useAuth();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const loadPage = useCallback(
    async (pageToLoad: number, append = true) => {
      if (loading || (!hasMore && append)) return;
      setLoading(true);
      setError(undefined);
      try {
        const response = await apiClient.auctions.list({
          page: pageToLoad,
          pageSize: 10,
          status: "ACTIVE",
        });
        const items: Auction[] = Array.isArray(response?.data)
          ? response.data
          : DEMO_AUCTIONS;
        const total = response?.pageCount ?? 1;
        setHasMore(pageToLoad < total);
        setAuctions((prev) => (append ? [...prev, ...items] : items));
        setPage(pageToLoad);
      } catch {
        if (!append) {
          setAuctions(DEMO_AUCTIONS);
          setError("Showing demo auctions.");
        }
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [apiClient, hasMore, loading],
  );

  useEffect(() => {
    loadPage(1, false);
  }, [loadPage]);

  const onRefresh = async () => {
    setRefreshing(true);
    setHasMore(true);
    await loadPage(1, false);
    setRefreshing(false);
  };

  return (
    <View style={styles.container} testID="auctions-tab">
      <Text style={styles.heading}>Live Auctions</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={auctions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <AuctionCard
            item={item}
            onPress={() =>
              navigation.push("AuctionDetail", {
                auctionId: item.id,
                auction: item,
              })
            }
          />
        )}
        contentContainerStyle={styles.list}
        onEndReached={() => {
          if (hasMore && !loading) loadPage(page + 1);
        }}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>No active auctions right now.</Text>
          ) : null
        }
        ListFooterComponent={
          loading ? (
            <View style={styles.footer}>
              <ActivityIndicator />
            </View>
          ) : null
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brandColors.background },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    padding: spacing.md,
    paddingBottom: 8,
  },
  list: { padding: spacing.md, gap: spacing.sm },
  card: {
    backgroundColor: brandColors.card,
    borderRadius: 12,
    padding: spacing.md,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
    gap: 10,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: { fontSize: 16, fontWeight: "600", flex: 1, marginRight: 8 },
  timerBadge: {
    backgroundColor: "#f3f4f6",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  timerBadgeUrgent: { backgroundColor: "#fef2f2" },
  timerText: { fontSize: 12, fontWeight: "600", color: "#374151" },
  timerTextUrgent: { color: "#ef4444" },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  label: { fontSize: 11, color: brandColors.muted, marginBottom: 2 },
  currentBid: { fontSize: 20, fontWeight: "700", color: brandColors.primary },
  bidCount: { fontSize: 12, color: brandColors.muted },
  buyNowBox: { alignItems: "flex-end" },
  buyNowPrice: { fontSize: 15, fontWeight: "600", color: "#f97316" },
  error: { color: "#f97316", paddingHorizontal: spacing.md, marginBottom: 4 },
  empty: { textAlign: "center", marginTop: 40, color: brandColors.muted },
  footer: { padding: 16, alignItems: "center" },
});
