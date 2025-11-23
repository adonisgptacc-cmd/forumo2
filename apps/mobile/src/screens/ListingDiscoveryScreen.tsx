import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, TextInput } from 'react-native';
import { SafeListing } from '@forumo/shared';
import { brandColors, demoListings, spacing } from '@forumo/config';
import { useAuth } from '../providers/AuthProvider';

interface ListingItemProps {
  item: SafeListing;
}

const ListingItem: React.FC<ListingItemProps> = ({ item }) => {
  return (
    <View style={styles.card} testID={`listing-card-${item.id}`}>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.price}>
        {item.currency} {(item.priceCents / 100).toFixed(2)}
      </Text>
      <Text style={styles.description} numberOfLines={2}>
        {item.description}
      </Text>
    </View>
  );
};

export const ListingDiscoveryScreen: React.FC = () => {
  const { apiClient } = useAuth();
  const [listings, setListings] = useState<SafeListing[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [keyword, setKeyword] = useState('');

  const loadPage = useCallback(
    async (pageToLoad: number, append = true) => {
      if (loading || (!hasMore && append)) return;
      setLoading(true);
      setError(undefined);
      try {
        const response = await apiClient.listings.search({ page: pageToLoad, pageSize: 10, keyword: keyword || undefined });
        setHasMore(response.page < response.pageCount);
        setListings((prev) => (append ? [...prev, ...response.data] : response.data));
        setPage(pageToLoad);
      } catch (err) {
        setHasMore(false);
        setListings(demoListings);
        setError('Using demo listings while we reconnect.');
      } finally {
        setLoading(false);
      }
    },
    [apiClient, hasMore, keyword, loading],
  );

  useEffect(() => {
    loadPage(1, false);
  }, [loadPage]);

  const onEndReached = () => {
    if (hasMore && !loading) {
      loadPage(page + 1);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPage(1, false);
    setRefreshing(false);
  };

  const filteredListings = useMemo(() => {
    if (!keyword) return listings;
    const term = keyword.toLowerCase();
    return listings.filter((listing) =>
      listing.title.toLowerCase().includes(term) || listing.description.toLowerCase().includes(term),
    );
  }, [keyword, listings]);

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="Search listings"
        value={keyword}
        onChangeText={setKeyword}
        onSubmitEditing={() => loadPage(1, false)}
        style={styles.search}
        returnKeyType="search"
        testID="listing-search"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        testID="listing-discovery"
        contentContainerStyle={styles.list}
        data={filteredListings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ListingItem item={item} />}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No listings yet.</Text> : null}
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
  container: {
    flex: 1,
    backgroundColor: brandColors.background,
  },
  list: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  card: {
    backgroundColor: brandColors.card,
    padding: spacing.md,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
    gap: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  price: {
    color: brandColors.success,
    fontWeight: '700',
  },
  description: {
    color: brandColors.muted,
  },
  empty: {
    textAlign: 'center',
    marginTop: 40,
    color: brandColors.muted,
  },
  footer: {
    padding: 16,
    alignItems: 'center',
  },
  search: {
    margin: spacing.md,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  error: {
    color: '#f97316',
    paddingHorizontal: spacing.md,
  },
});
