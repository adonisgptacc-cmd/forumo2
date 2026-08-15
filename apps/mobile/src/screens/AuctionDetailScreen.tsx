import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Auction } from '@forumo/shared';
import { brandColors, spacing } from '@forumo/config';
import { useAuth } from '../providers/AuthProvider';
import type { MainStackParamList } from '../navigation/types';
import { formatCents } from '../utils/format';

type Props = NativeStackScreenProps<MainStackParamList, 'AuctionDetail'>;

interface BidEntry {
  id: string;
  bidderName?: string;
  amountCents: number;
  currency: string;
  createdAt: string;
  isAutoBid?: boolean;
}

const DEMO_BIDS: BidEntry[] = [
  { id: '1', bidderName: 'user_alpha', amountCents: 15000, currency: 'USD', createdAt: new Date(Date.now() - 60000).toISOString() },
  { id: '2', bidderName: 'user_beta', amountCents: 12500, currency: 'USD', createdAt: new Date(Date.now() - 180000).toISOString() },
  { id: '3', bidderName: 'user_gamma', amountCents: 10000, currency: 'USD', createdAt: new Date(Date.now() - 360000).toISOString() },
];



function useCountdown(endAt: string | undefined) {
  const [remaining, setRemaining] = useState('');
  const [isEnded, setIsEnded] = useState(false);
  const [isSnipingZone, setIsSnipingZone] = useState(false);

  useEffect(() => {
    if (!endAt) return;

    const tick = () => {
      const diff = new Date(endAt).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining('Ended');
        setIsEnded(true);
        setIsSnipingZone(false);
        return;
      }
      const twoMins = 2 * 60 * 1000;
      setIsSnipingZone(diff < twoMins);
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (h > 0) {
        setRemaining(`${h}h ${m}m ${s}s`);
      } else if (m > 0) {
        setRemaining(`${m}m ${s}s`);
      } else {
        setRemaining(`${s}s`);
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endAt]);

  return { remaining, isEnded, isSnipingZone };
}

export const AuctionDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { auctionId, auction: initialAuction } = route.params;
  const { apiClient, user, accessToken } = useAuth();

  const [auction, setAuction] = useState<Auction | undefined>(initialAuction);
  const [bids, setBids] = useState<BidEntry[]>([]);
  const [loading, setLoading] = useState(!initialAuction);
  const [refreshing, setRefreshing] = useState(false);
  const [bidding, setBidding] = useState(false);
  const [bidAmount, setBidAmount] = useState('');
  const [maxAutoBid, setMaxAutoBid] = useState('');
  const [showAutoBid, setShowAutoBid] = useState(false);
  const [liveStatus, setLiveStatus] = useState<'connecting' | 'connected' | 'error' | 'offline'>('offline');

  const socketRef = useRef<WebSocket | null>(null);

  const { remaining, isEnded, isSnipingZone } = useCountdown(auction?.endAt);

  // Fetch auction data
  const loadAuction = useCallback(async () => {
    try {
      const data = await apiClient.auctions.get(auctionId);
      setAuction(data);
      if (data.listing?.title) {
        navigation.setOptions({ title: data.listing.title });
      }
    } catch {
      if (!auction) {
        setAuction({
          id: auctionId,
          listingId: 'demo',
          sellerId: 'demo-seller',
          status: 'ACTIVE',
          startingBidCents: 10000,
          currency: 'USD',
          reserveCents: null,
          buyNowCents: 25000,
          startAt: new Date(Date.now() - 3600000).toISOString(),
          endAt: new Date(Date.now() + 7200000).toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          currentBidCents: 15000,
          bidCount: 3,
          listing: {
            id: 'demo',
            title: 'Demo Auction Item',
            description: 'A demo item for the auction',
            priceCents: 25000,
            currency: 'USD',
            status: 'PUBLISHED',
            sellerId: 'demo-seller',
            moderationStatus: 'APPROVED',
            images: [],
            variants: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        });
        setBids(DEMO_BIDS);
      }
    }
  }, [apiClient, auctionId, auction, navigation]);

  useEffect(() => {
    setLoading(true);
    loadAuction().finally(() => setLoading(false));
  }, []);

  // Socket.IO connection via WebSocket transport
  useEffect(() => {
    if (!auctionId) return;

    const connectSocket = async () => {
      try {
        // Socket.IO polling handshake then upgrade — use the base URL
        const baseUrl = (apiClient as any).baseUrl as string;
        const wsUrl = baseUrl
          .replace(/^http/, 'ws')
          .replace(/^https/, 'wss');

        const token = accessToken;
        const query = `auctionId=${auctionId}${token ? `&token=${token}` : ''}`;
        const ws = new WebSocket(
          `${wsUrl}/socket.io/?EIO=4&transport=websocket&${query}`
        );

        setLiveStatus('connecting');
        socketRef.current = ws;

        ws.onopen = () => setLiveStatus('connected');
        ws.onerror = () => setLiveStatus('error');
        ws.onclose = () => {
          if (liveStatus !== 'error') setLiveStatus('offline');
        };

        ws.onmessage = (event) => {
          try {
            const raw = String(event.data);
            // Socket.IO message format: digit(s) + JSON
            const jsonStart = raw.search(/[\[{]/);
            if (jsonStart === -1) return;
            const payload = JSON.parse(raw.slice(jsonStart));
            if (!Array.isArray(payload)) return;

            const [eventName, data] = payload;

            if (eventName === 'bid' && data) {
              const newBid: BidEntry = {
                id: data.id ?? String(Date.now()),
                bidderName: data.bidderName ?? 'Anonymous',
                amountCents: data.amountCents,
                currency: data.currency ?? 'USD',
                createdAt: data.createdAt ?? new Date().toISOString(),
                isAutoBid: data.isAutoBid,
              };
              setBids((prev) => [newBid, ...prev]);
              setAuction((prev) =>
                prev
                  ? { ...prev, currentBidCents: data.amountCents, bidCount: (prev.bidCount ?? 0) + 1 }
                  : prev
              );
            }

            if (eventName === 'auctionEnd' && data) {
              setAuction((prev) => (prev ? { ...prev, status: 'COMPLETED' } : prev));
              Alert.alert('Auction Ended', data.winnerId === user?.id ? '🎉 You won!' : 'This auction has ended.');
            }
          } catch {
            // ignore parse errors
          }
        };
      } catch {
        setLiveStatus('error');
      }
    };

    connectSocket();

    return () => {
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [auctionId, accessToken]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAuction();
    setRefreshing(false);
  };

  const placeBid = async () => {
    const amountCents = Math.round(parseFloat(bidAmount) * 100);
    if (!amountCents || amountCents <= 0) {
      Alert.alert('Invalid Bid', 'Please enter a valid bid amount.');
      return;
    }
    const currentBid = auction?.currentBidCents ?? auction?.startingBidCents ?? 0;
    if (amountCents <= currentBid) {
      Alert.alert('Bid Too Low', `Your bid must exceed ${formatCents(currentBid, auction?.currency)}.`);
      return;
    }

    const dto: { amountCents: number; maxAutoBidCents?: number } = { amountCents };
    if (showAutoBid && maxAutoBid) {
      const max = Math.round(parseFloat(maxAutoBid) * 100);
      if (max > amountCents) dto.maxAutoBidCents = max;
    }

    setBidding(true);
    try {
      await apiClient.auctions.placeBid(auctionId, dto);
      setBidAmount('');
      setMaxAutoBid('');
      Alert.alert('Bid Placed', `Your bid of ${formatCents(amountCents, auction?.currency)} was placed.`);
      await loadAuction();
    } catch (err: any) {
      Alert.alert('Bid Failed', err.message ?? 'Could not place bid.');
    } finally {
      setBidding(false);
    }
  };

  const buyNow = async () => {
    if (!auction?.buyNowCents) return;
    Alert.alert(
      'Buy Now',
      `Purchase for ${formatCents(auction.buyNowCents, auction.currency)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Buy Now',
          onPress: async () => {
            setBidding(true);
            try {
              await apiClient.auctions.placeBid(auctionId, { amountCents: auction.buyNowCents! });
              Alert.alert('Success', 'Item purchased!');
              navigation.goBack();
            } catch (err: any) {
              Alert.alert('Failed', err.message ?? 'Could not complete purchase.');
            } finally {
              setBidding(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center} testID="auction-detail-loading">
        <ActivityIndicator size="large" color={brandColors.primary} />
      </View>
    );
  }

  const currentBid = auction?.currentBidCents ?? auction?.startingBidCents ?? 0;
  const isActive = auction?.status === 'ACTIVE' && !isEnded;
  const isSeller = user?.id === auction?.sellerId;

  return (
    <ScrollView
      style={styles.container}
      testID="auction-detail"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{auction?.listing?.title ?? 'Auction'}</Text>
        <View style={[styles.statusBadge, { backgroundColor: isActive ? '#dcfce7' : '#f3f4f6' }]}>
          <Text style={[styles.statusText, { color: isActive ? '#16a34a' : '#6b7280' }]}>
            {auction?.status ?? 'Unknown'}
          </Text>
        </View>
      </View>

      {/* Live indicator */}
      <View style={styles.liveRow}>
        <View style={[styles.liveDot, { backgroundColor: liveStatus === 'connected' ? '#22c55e' : '#d1d5db' }]} />
        <Text style={styles.liveText}>
          {liveStatus === 'connected' ? 'Live' : liveStatus === 'connecting' ? 'Connecting…' : 'Offline'}
        </Text>
      </View>

      {/* Current bid + countdown */}
      <View style={styles.bidBox}>
        <View style={styles.bidBoxCol}>
          <Text style={styles.bidLabel}>Current Bid</Text>
          <Text style={styles.bidValue}>{formatCents(currentBid, auction?.currency)}</Text>
          <Text style={styles.bidCount}>{auction?.bidCount ?? 0} bids</Text>
        </View>
        <View style={[styles.bidBoxCol, styles.alignRight]}>
          <Text style={styles.bidLabel}>Time Left</Text>
          <Text style={[styles.bidValue, isSnipingZone && styles.snipingText]}>{remaining || '—'}</Text>
          {isSnipingZone && <Text style={styles.snipingBadge}>⚡ Anti-snipe active</Text>}
        </View>
      </View>

      {/* Anti-sniping notice */}
      {isSnipingZone && (
        <View style={styles.snipingNotice}>
          <Text style={styles.snipingNoticeText}>
            Anti-snipe: any bid in the last 2 minutes extends the auction by 2 minutes.
          </Text>
        </View>
      )}

      {/* Reserve / Buy Now */}
      {auction?.reserveCents ? (
        <Text style={styles.meta}>Reserve: {formatCents(auction.reserveCents, auction.currency)}</Text>
      ) : null}

      {/* Place bid — not shown to seller or if ended */}
      {isActive && !isSeller && (
        <View style={styles.bidForm}>
          <Text style={styles.sectionTitle}>Place a Bid</Text>
          <TextInput
            style={styles.input}
            placeholder={`Min bid: ${formatCents(currentBid + 1, auction?.currency)}`}
            value={bidAmount}
            onChangeText={setBidAmount}
            keyboardType="decimal-pad"
            testID="bid-amount-input"
          />

          <TouchableOpacity
            onPress={() => setShowAutoBid((v) => !v)}
            style={styles.autoBidToggle}
          >
            <Text style={styles.autoBidToggleText}>
              {showAutoBid ? '▼ Hide auto-bid' : '▶ Set max auto-bid'}
            </Text>
          </TouchableOpacity>

          {showAutoBid && (
            <TextInput
              style={styles.input}
              placeholder="Max auto-bid amount (optional)"
              value={maxAutoBid}
              onChangeText={setMaxAutoBid}
              keyboardType="decimal-pad"
              testID="max-auto-bid-input"
            />
          )}

          <TouchableOpacity
            style={[styles.button, bidding && styles.buttonDisabled]}
            onPress={placeBid}
            disabled={bidding}
            testID="place-bid-button"
          >
            {bidding ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Place Bid</Text>
            )}
          </TouchableOpacity>

          {auction?.buyNowCents ? (
            <TouchableOpacity
              style={[styles.button, styles.buyNowButton]}
              onPress={buyNow}
              disabled={bidding}
              testID="buy-now-button"
            >
              <Text style={styles.buttonText}>
                Buy Now — {formatCents(auction.buyNowCents, auction.currency)}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {/* Bid history */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bid History</Text>
        {bids.length === 0 ? (
          <Text style={styles.empty}>No bids yet. Be the first!</Text>
        ) : (
          bids.map((bid) => (
            <View key={bid.id} style={styles.bidRow}>
              <View>
                <Text style={styles.bidderName}>
                  {bid.bidderName ?? 'Anonymous'}
                  {bid.isAutoBid ? ' 🤖' : ''}
                </Text>
                <Text style={styles.bidTime}>
                  {new Date(bid.createdAt).toLocaleTimeString()}
                </Text>
              </View>
              <Text style={styles.bidAmountText}>{formatCents(bid.amountCents, bid.currency)}</Text>
            </View>
          ))
        )}
      </View>

      {/* Listing description */}
      {auction?.listing?.description ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Item Description</Text>
          <Text style={styles.description}>{auction.listing.description}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brandColors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: { fontSize: 20, fontWeight: '700', flex: 1 },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: '600' },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveText: { fontSize: 12, color: brandColors.muted },
  bidBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: brandColors.card,
    marginHorizontal: spacing.md,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  bidBoxCol: { gap: 4 },
  alignRight: { alignItems: 'flex-end' },
  bidLabel: { fontSize: 12, color: brandColors.muted },
  bidValue: { fontSize: 24, fontWeight: '700', color: brandColors.primary },
  bidCount: { fontSize: 12, color: brandColors.muted },
  snipingText: { color: '#ef4444' },
  snipingBadge: { fontSize: 11, color: '#ef4444', fontWeight: '600' },
  snipingNotice: {
    backgroundColor: '#fef2f2',
    marginHorizontal: spacing.md,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  snipingNoticeText: { fontSize: 12, color: '#ef4444' },
  meta: { paddingHorizontal: spacing.md, color: brandColors.muted, marginBottom: spacing.sm },
  bidForm: {
    backgroundColor: brandColors.card,
    marginHorizontal: spacing.md,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  autoBidToggle: { paddingVertical: 4 },
  autoBidToggleText: { color: brandColors.primary, fontSize: 13 },
  button: {
    backgroundColor: brandColors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  buyNowButton: { backgroundColor: '#f97316' },
  section: {
    backgroundColor: brandColors.card,
    marginHorizontal: spacing.md,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: 8,
  },
  empty: { color: brandColors.muted, textAlign: 'center', paddingVertical: 16 },
  bidRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  bidderName: { fontWeight: '600', fontSize: 14 },
  bidTime: { fontSize: 12, color: brandColors.muted },
  bidAmountText: { fontWeight: '700', color: brandColors.success },
  description: { color: brandColors.muted, lineHeight: 20 },
});
