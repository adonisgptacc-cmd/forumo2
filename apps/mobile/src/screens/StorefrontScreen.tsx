import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Dimensions,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Storefront, SafeListing } from '@forumo/shared';
import { brandColors, spacing } from '@forumo/config';
import { useAuth } from '../providers/AuthProvider';
import type { MainStackParamList } from '../navigation/types';
import { formatCents } from '../utils/format';

type Props = NativeStackScreenProps<MainStackParamList, 'Storefront'>;

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - spacing.md * 2 - spacing.sm) / 2;

function ListingCard({ listing, onPress }: { listing: SafeListing; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.listingCard} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.listingImageBox}>
        {listing.images && listing.images.length > 0 ? (
          <Image source={{ uri: listing.images[0].url }} style={styles.listingImage} />
        ) : (
          <View style={[styles.listingImage, styles.listingImagePlaceholder]}>
            <Text style={styles.placeholderIcon}>📷</Text>
          </View>
        )}
      </View>
      <View style={styles.listingInfo}>
        <Text style={styles.listingTitle} numberOfLines={2}>{listing.title}</Text>
        <Text style={styles.listingPrice}>
          {formatCents(listing.priceCents, listing.currency ?? 'USD')}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export const StorefrontScreen: React.FC<Props> = ({ route, navigation }) => {
  const { sellerId, slug } = route.params;
  const { apiClient } = useAuth();
  const [storefront, setStorefront] = useState<Storefront | null>(null);
  const [listings, setListings] = useState<SafeListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      let sf: Storefront | null = null;
      if (slug) {
        sf = await apiClient.storefronts.get(slug);
      } else if (sellerId) {
        sf = await apiClient.storefronts.getBySeller(sellerId);
      }
      setStorefront(sf);

      if (sf) {
        const result = await apiClient.listings.search({
          sellerId: sf.userId,
          status: 'PUBLISHED',
          pageSize: 24,
        });
        setListings(result.data ?? []);
      }
    } catch (e: any) {
      setError(e.message ?? 'Failed to load storefront');
    }
  }, [apiClient, sellerId, slug]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (storefront?.name) {
      navigation.setOptions({ title: storefront.name });
    }
  }, [storefront?.name, navigation]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={brandColors.primary} />
      </View>
    );
  }

  if (error || !storefront) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'Storefront not found'}</Text>
        <TouchableOpacity onPress={() => { setLoading(true); load().finally(() => setLoading(false)); }}>
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      data={listings}
      keyExtractor={(item) => item.id}
      numColumns={2}
      columnWrapperStyle={styles.columnWrapper}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={brandColors.primary} />}
      ListHeaderComponent={
        <View>
          {/* Banner */}
          {storefront.bannerUrl ? (
            <Image source={{ uri: storefront.bannerUrl }} style={styles.banner} />
          ) : (
            <View style={styles.bannerPlaceholder} />
          )}

          {/* Logo + info row */}
          <View style={styles.profileRow}>
            {storefront.logoUrl ? (
              <Image source={{ uri: storefront.logoUrl }} style={styles.logo} />
            ) : (
              <View style={[styles.logo, styles.logoPlaceholder]}>
                <Text style={styles.logoInitial}>{storefront.name.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.profileInfo}>
              <Text style={styles.shopName}>{storefront.name}</Text>
              {storefront.user?.name ? (
                <Text style={styles.shopSeller}>by {storefront.user.name}</Text>
              ) : null}
            </View>
          </View>

          {/* Description */}
          {storefront.description ? (
            <Text style={styles.description}>{storefront.description}</Text>
          ) : null}

          {/* Collections */}
          {storefront.collections && storefront.collections.length > 0 ? (
            <View style={styles.collectionsSection}>
              <Text style={styles.sectionTitle}>Collections</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.collectionsScroll}>
                {storefront.collections.map((col: any) => (
                  <View key={col.id} style={styles.collectionChip}>
                    <Text style={styles.collectionChipText}>{col.name}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* Listings header */}
          <View style={styles.listingsHeader}>
            <Text style={styles.sectionTitle}>Listings</Text>
            {listings.length > 0 && (
              <Text style={styles.listingsCount}>{listings.length} items</Text>
            )}
          </View>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyText}>No active listings yet</Text>
        </View>
      }
      renderItem={({ item }) => (
        <ListingCard
          listing={item}
          onPress={() => navigation.navigate('ListingDetail', { listingId: item.id, listing: item })}
        />
      )}
    />
  );
};

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  errorText: {
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  retryText: {
    color: brandColors.primary,
    fontWeight: '600',
  },
  banner: {
    width: '100%',
    height: 160,
    backgroundColor: '#1e293b',
  },
  bannerPlaceholder: {
    width: '100%',
    height: 100,
    backgroundColor: '#1e293b',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: '#0f172a',
    marginTop: -24,
    backgroundColor: '#334155',
  },
  logoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInitial: {
    fontSize: 24,
    fontWeight: '700',
    color: brandColors.primary,
  },
  profileInfo: {
    flex: 1,
  },
  shopName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f8fafc',
  },
  shopSeller: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  description: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  collectionsSection: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  collectionsScroll: {
    marginTop: spacing.xs,
  },
  collectionChip: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: spacing.sm,
    backgroundColor: '#1e293b',
  },
  collectionChipText: {
    color: '#cbd5e1',
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
  },
  listingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  listingsCount: {
    fontSize: 13,
    color: '#64748b',
  },
  listContent: {
    paddingBottom: 32,
  },
  columnWrapper: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  listingCard: {
    width: CARD_WIDTH,
    borderRadius: 12,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    overflow: 'hidden',
  },
  listingImageBox: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#1e293b',
  },
  listingImage: {
    width: '100%',
    height: '100%',
  },
  listingImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e293b',
  },
  placeholderIcon: {
    fontSize: 32,
  },
  listingInfo: {
    padding: spacing.sm,
    gap: 4,
  },
  listingTitle: {
    fontSize: 13,
    color: '#e2e8f0',
    lineHeight: 18,
  },
  listingPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: brandColors.primary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyText: {
    fontSize: 15,
    color: '#64748b',
  },
});
