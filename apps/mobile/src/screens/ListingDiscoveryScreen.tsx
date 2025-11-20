import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeListing } from '@forumo/shared';
import { useAuth } from '../providers/AuthProvider';

interface ListingItemProps {
  item: SafeListing;
}

const ListingItem: React.FC<ListingItemProps> = ({ item }) => {
  return (
    <View style={styles.card}>
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

  const loadPage = useCallback(
    async (pageToLoad: number, append = true) => {
      if (loading || (!hasMore && append)) return;
      setLoading(true);
      const response = await apiClient.listings.search({ page: pageToLoad, pageSize: 10 });
      setHasMore(response.page < response.pageCount);
      setListings((prev) => (append ? [...prev, ...response.data] : response.data));
      setPage(pageToLoad);
      setLoading(false);
    },
    [apiClient, hasMore, loading],
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

  return (
    <FlatList
      testID="listing-discovery"
      contentContainerStyle={styles.list}
      data={listings}
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
  );
};

const styles = StyleSheet.create({
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#fff',
    padding: 16,
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
    color: '#16a34a',
    fontWeight: '700',
  },
  description: {
    color: '#4b5563',
  },
  empty: {
    textAlign: 'center',
    marginTop: 40,
    color: '#6b7280',
  },
  footer: {
    padding: 16,
    alignItems: 'center',
  },
});
