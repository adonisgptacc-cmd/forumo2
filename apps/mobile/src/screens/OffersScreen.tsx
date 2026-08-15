import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SafeOffer } from '@forumo/shared';
import { brandColors, spacing } from '@forumo/config';
import { useAuth } from '../providers/AuthProvider';
import type { MainStackParamList } from '../navigation/types';
import { formatCents, formatDate, OFFER_STATUS_COLORS } from '../utils/format';

type Props = NativeStackScreenProps<MainStackParamList, 'Offers'>;

const DEMO_OFFERS: SafeOffer[] = [
  {
    id: 'offer-1',
    listingId: 'listing-1',
    buyerId: 'demo-buyer',
    sellerId: 'demo-seller',
    amountCents: 9500,
    currency: 'USD',
    message: 'Would you accept this price?',
    status: 'PENDING',
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    listing: { id: 'listing-1', title: 'Vintage Camera' },
    buyer: { id: 'demo-buyer', name: 'Demo Buyer' },
    seller: { id: 'demo-seller', name: 'Demo Seller' },
  },
  {
    id: 'offer-2',
    listingId: 'listing-2',
    buyerId: 'buyer-2',
    sellerId: 'demo-seller',
    amountCents: 4500,
    currency: 'USD',
    status: 'ACCEPTED',
    expiresAt: null,
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    listing: { id: 'listing-2', title: 'Leather Bag' },
    buyer: { id: 'buyer-2', name: 'Alice' },
    seller: { id: 'demo-seller', name: 'Demo Seller' },
  },
];



interface OfferCardProps {
  offer: SafeOffer;
  userId?: string;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  accepting: string | null;
}

const OfferCard: React.FC<OfferCardProps> = ({ offer, userId, onAccept, onDecline, accepting }) => {
  const colors = OFFER_STATUS_COLORS[offer.status] ?? { bg: '#f3f4f6', text: '#6b7280' };
  const isSeller = userId === offer.sellerId;
  const isBuyer = userId === offer.buyerId;
  const isPending = offer.status === 'PENDING';
  const isActing = accepting === offer.id;

  return (
    <View style={styles.card} testID={`offer-card-${offer.id}`}>
      <View style={styles.cardHeader}>
        <Text style={styles.listingTitle} numberOfLines={1}>
          {offer.listing?.title ?? offer.listingId.slice(0, 8)}
        </Text>
        <View style={[styles.badge, { backgroundColor: colors.bg }]}>
          <Text style={[styles.badgeText, { color: colors.text }]}>{offer.status}</Text>
        </View>
      </View>

      <View style={styles.amountRow}>
        <Text style={styles.amount}>{formatCents(offer.amountCents, offer.currency)}</Text>
        <Text style={styles.meta}>
          {isBuyer ? `To: ${offer.seller?.name ?? 'Seller'}` : `From: ${offer.buyer?.name ?? 'Buyer'}`}
        </Text>
      </View>

      {offer.message ? (
        <Text style={styles.message} numberOfLines={2}>"{offer.message}"</Text>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.date}>{formatDate(offer.createdAt)}</Text>
        {offer.expiresAt && isPending ? (
          <Text style={styles.expires}>Expires {formatDate(offer.expiresAt)}</Text>
        ) : null}
      </View>

      {/* Actions — only seller can accept/decline pending offers */}
      {isSeller && isPending && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.acceptBtn, isActing && styles.btnDisabled]}
            onPress={() => onAccept(offer.id)}
            disabled={!!accepting}
            testID={`accept-offer-${offer.id}`}
          >
            {isActing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.acceptBtnText}>Accept</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.declineBtn, isActing && styles.btnDisabled]}
            onPress={() => onDecline(offer.id)}
            disabled={!!accepting}
            testID={`decline-offer-${offer.id}`}
          >
            <Text style={styles.declineBtnText}>Decline</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

type Tab = 'all' | 'received' | 'sent';

export const OffersScreen: React.FC<Props> = () => {
  const { apiClient, user } = useAuth();
  const [offers, setOffers] = useState<SafeOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('all');
  const [error, setError] = useState<string | undefined>();

  const load = useCallback(async () => {
    setError(undefined);
    try {
      const data = await apiClient.offers.list();
      setOffers(Array.isArray(data) ? data : []);
    } catch {
      setOffers(DEMO_OFFERS);
      setError('Showing demo offers.');
    }
  }, [apiClient]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleAccept = async (offerId: string) => {
    setAccepting(offerId);
    try {
      const updated = await apiClient.offers.accept(offerId);
      setOffers((prev) => prev.map((o) => (o.id === offerId ? { ...o, status: 'ACCEPTED' } : o)));
      Alert.alert('Offer Accepted', 'The offer has been accepted.');
    } catch (err: any) {
      Alert.alert('Failed', err.message ?? 'Could not accept offer.');
    } finally {
      setAccepting(null);
    }
  };

  const handleDecline = (offerId: string) => {
    Alert.alert('Decline Offer', 'Are you sure you want to decline this offer?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline',
        style: 'destructive',
        onPress: async () => {
          setAccepting(offerId);
          try {
            await apiClient.offers.decline(offerId);
            setOffers((prev) => prev.map((o) => (o.id === offerId ? { ...o, status: 'DECLINED' } : o)));
          } catch (err: any) {
            Alert.alert('Failed', err.message ?? 'Could not decline offer.');
          } finally {
            setAccepting(null);
          }
        },
      },
    ]);
  };

  const filtered = offers.filter((o) => {
    if (tab === 'received') return o.sellerId === user?.id;
    if (tab === 'sent') return o.buyerId === user?.id;
    return true;
  });

  return (
    <View style={styles.container} testID="offers-screen">
      {/* Tabs */}
      <View style={styles.tabs}>
        {(['all', 'received', 'sent'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
            testID={`offers-tab-${t}`}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={brandColors.primary} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <OfferCard
              offer={item}
              userId={user?.id}
              onAccept={handleAccept}
              onDecline={handleDecline}
              accepting={accepting}
            />
          )}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>🤝</Text>
              <Text style={styles.emptyText}>No offers here.</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brandColors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: 8 },
  tab: { flex: 1, borderRadius: 8, paddingVertical: 8, alignItems: 'center', backgroundColor: '#f3f4f6' },
  tabActive: { backgroundColor: brandColors.primary },
  tabText: { fontWeight: '600', color: '#374151', fontSize: 13 },
  tabTextActive: { color: '#fff' },
  error: { color: '#f97316', paddingHorizontal: spacing.md, marginTop: 8 },
  list: { padding: spacing.md, gap: spacing.sm },
  card: {
    backgroundColor: brandColors.card,
    borderRadius: 12,
    padding: spacing.md,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  listingTitle: { fontWeight: '600', fontSize: 15, flex: 1, marginRight: 8 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amount: { fontSize: 20, fontWeight: '700', color: brandColors.primary },
  meta: { fontSize: 12, color: brandColors.muted },
  message: { fontSize: 13, color: '#374151', fontStyle: 'italic' },
  footer: { flexDirection: 'row', justifyContent: 'space-between' },
  date: { fontSize: 12, color: brandColors.muted },
  expires: { fontSize: 12, color: '#f97316' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  acceptBtn: { flex: 1, backgroundColor: brandColors.primary, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  acceptBtnText: { color: '#fff', fontWeight: '700' },
  declineBtn: { flex: 1, backgroundColor: '#fff', borderRadius: 8, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#fca5a5' },
  declineBtnText: { color: '#ef4444', fontWeight: '700' },
  emptyBox: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: brandColors.muted, fontSize: 16 },
});
