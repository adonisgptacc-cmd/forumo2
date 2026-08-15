import React, { useCallback, useEffect, useState } from 'react';
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
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SafeListing } from '@forumo/shared';
import { brandColors, spacing } from '@forumo/config';
import { useAuth } from '../providers/AuthProvider';
import type { MainStackParamList } from '../navigation/types';
import { formatCents, LISTING_STATUS_COLORS } from '../utils/format';

type Props = NativeStackScreenProps<MainStackParamList, 'MyListings'>;



export const MyListingsScreen: React.FC<Props> = ({ navigation }) => {
  const { apiClient, user } = useAuth();
  const [listings, setListings] = useState<SafeListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const result = await apiClient.listings.search({ sellerId: user.id, pageSize: 100 });
      setListings(result.data ?? []);
    } catch {
      setListings([]);
    }
  }, [apiClient, user]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleDelete = (listing: SafeListing) => {
    Alert.alert(
      'Delete Listing',
      `Delete "${listing.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(listing.id);
            try {
              await apiClient.listings.delete(listing.id);
              setListings((prev) => prev.filter((l) => l.id !== listing.id));
            } catch {
              Alert.alert('Error', 'Could not delete listing.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  if (!user) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Sign in to manage listings</Text>
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
      data={listings}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => navigation.push('CreateListing')}
          testID="create-listing-btn"
        >
          <Text style={styles.createBtnText}>+ New Listing</Text>
        </TouchableOpacity>
      }
      ListEmptyComponent={
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>🛍</Text>
          <Text style={styles.emptyTitle}>No listings yet</Text>
          <Text style={styles.emptySub}>Create your first listing to start selling.</Text>
        </View>
      }
      renderItem={({ item }) => {
        const image = item.images?.[0];
        const isDeleting = deletingId === item.id;
        const statusColor = LISTING_STATUS_COLORS[item.status] ?? '#9ca3af';

        return (
          <View style={styles.card} testID={`my-listing-${item.id}`}>
            <TouchableOpacity
              style={styles.cardMain}
              onPress={() => navigation.push('ListingDetail', { listingId: item.id, listing: item })}
              activeOpacity={0.7}
            >
              {image?.url ? (
                <Image source={{ uri: image.url }} style={styles.image} resizeMode="cover" />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Text style={styles.imagePlaceholderText}>🖼</Text>
                </View>
              )}
              <View style={styles.info}>
                <View style={styles.titleRow}>
                  <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20`, borderColor: statusColor }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
                  </View>
                </View>
                <Text style={styles.price}>{formatCents(item.priceCents, item.currency)}</Text>
                {item.variants && item.variants.length > 0 && (
                  <Text style={styles.variantCount}>{item.variants.length} variant{item.variants.length !== 1 ? 's' : ''}</Text>
                )}
              </View>
            </TouchableOpacity>

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => navigation.push('EditListing', { listingId: item.id, listing: item })}
                testID={`edit-listing-${item.id}`}
              >
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteBtn, isDeleting && styles.btnDisabled]}
                onPress={() => handleDelete(item)}
                disabled={isDeleting}
                testID={`delete-listing-${item.id}`}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#ef4444" />
                ) : (
                  <Text style={styles.deleteBtnText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        );
      }}
    />
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brandColors.background },
  list: { padding: spacing.md, gap: spacing.sm, flexGrow: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, minHeight: 300 },
  emptyIcon: { fontSize: 52, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySub: { fontSize: 14, color: brandColors.muted, textAlign: 'center' },

  createBtn: {
    backgroundColor: brandColors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  card: {
    backgroundColor: brandColors.card,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },
  cardMain: { flexDirection: 'row', alignItems: 'center' },
  image: { width: 80, height: 80 },
  imagePlaceholder: { width: 80, height: 80, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  imagePlaceholderText: { fontSize: 24 },
  info: { flex: 1, padding: spacing.sm, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, justifyContent: 'space-between' },
  title: { flex: 1, fontSize: 14, fontWeight: '600', lineHeight: 19 },
  statusBadge: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2, flexShrink: 0 },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  price: { fontSize: 14, fontWeight: '700', color: brandColors.success },
  variantCount: { fontSize: 11, color: brandColors.muted },

  actions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  editBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRightWidth: 1, borderRightColor: '#f3f4f6' },
  editBtnText: { color: brandColors.primary, fontWeight: '600', fontSize: 13 },
  deleteBtn: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  deleteBtnText: { color: '#ef4444', fontWeight: '600', fontSize: 13 },
  btnDisabled: { opacity: 0.5 },
});
