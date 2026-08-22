import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  Modal,
} from "react-native";
import type { SafeListing, ListingCategory } from "@forumo/shared";
import { brandColors, demoListings, spacing } from "@forumo/config";
import { useAuth } from "../providers/AuthProvider";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../navigation/types";

// ---- Listing card ----
const ListingItem: React.FC<{ item: SafeListing }> = ({ item }) => {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const image = item.images?.[0];

  return (
    <TouchableOpacity
      style={styles.card}
      testID={`listing-card-${item.id}`}
      onPress={() =>
        navigation.push("ListingDetail", { listingId: item.id, listing: item })
      }
      activeOpacity={0.7}
    >
      {image?.url ? (
        <Image
          source={{ uri: image.url }}
          style={styles.cardImage}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.cardImagePlaceholder}>
          <Text style={styles.cardImagePlaceholderText}>🖼</Text>
        </View>
      )}
      <View style={styles.cardBody}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.price}>
          {item.currency} {(item.priceCents / 100).toFixed(2)}
        </Text>
        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>
        {item.location ? (
          <Text style={styles.location} numberOfLines={1}>
            📍 {item.location}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

// ---- Filter modal ----
interface Filters {
  categories: string[]; // category slugs
  minPrice: string;
  maxPrice: string;
  sort: "date_new" | "price_asc" | "price_desc" | undefined;
}

const SORT_OPTIONS: { label: string; value: Filters["sort"] }[] = [
  { label: "Newest", value: "date_new" },
  { label: "Price ↑", value: "price_asc" },
  { label: "Price ↓", value: "price_desc" },
];

const FilterModal: React.FC<{
  visible: boolean;
  filters: Filters;
  categories: ListingCategory[];
  onApply: (f: Filters) => void;
  onClose: () => void;
}> = ({ visible, filters, categories, onApply, onClose }) => {
  const [local, setLocal] = useState<Filters>(filters);

  useEffect(() => {
    setLocal(filters);
  }, [filters, visible]);

  const toggleCategory = (slug: string) => {
    setLocal((prev) => ({
      ...prev,
      categories: prev.categories.includes(slug)
        ? prev.categories.filter((s) => s !== slug)
        : [...prev.categories, slug],
    }));
  };

  const clearAll = () =>
    setLocal({ categories: [], minPrice: "", maxPrice: "", sort: undefined });

  const activeCount =
    local.categories.length +
    (local.minPrice ? 1 : 0) +
    (local.maxPrice ? 1 : 0) +
    (local.sort ? 1 : 0);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.filterOverlay}>
        <View style={styles.filterSheet}>
          <View style={styles.filterHeader}>
            <Text style={styles.filterTitle}>Filters</Text>
            <TouchableOpacity onPress={clearAll}>
              <Text style={styles.filterClear}>Clear all</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Sort */}
            <Text style={styles.filterSectionLabel}>Sort by</Text>
            <View style={styles.chipRow}>
              {SORT_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.chip,
                    local.sort === opt.value && styles.chipActive,
                  ]}
                  onPress={() =>
                    setLocal((p) => ({
                      ...p,
                      sort: local.sort === opt.value ? undefined : opt.value,
                    }))
                  }
                >
                  <Text
                    style={[
                      styles.chipText,
                      local.sort === opt.value && styles.chipTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Categories */}
            {categories.length > 0 && (
              <>
                <Text style={styles.filterSectionLabel}>Category</Text>
                <View style={styles.chipRow}>
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.chip,
                        local.categories.includes(cat.slug) &&
                          styles.chipActive,
                      ]}
                      onPress={() => toggleCategory(cat.slug)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          local.categories.includes(cat.slug) &&
                            styles.chipTextActive,
                        ]}
                      >
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Price range */}
            <Text style={styles.filterSectionLabel}>Price range</Text>
            <View style={styles.priceRow}>
              <TextInput
                style={[styles.priceInput, { flex: 1 }]}
                value={local.minPrice}
                onChangeText={(v) => setLocal((p) => ({ ...p, minPrice: v }))}
                placeholder="Min"
                keyboardType="numeric"
                testID="filter-min-price"
              />
              <Text style={styles.priceSep}>—</Text>
              <TextInput
                style={[styles.priceInput, { flex: 1 }]}
                value={local.maxPrice}
                onChangeText={(v) => setLocal((p) => ({ ...p, maxPrice: v }))}
                placeholder="Max"
                keyboardType="numeric"
                testID="filter-max-price"
              />
            </View>
          </ScrollView>

          <View style={styles.filterActions}>
            <TouchableOpacity
              style={styles.filterApplyBtn}
              onPress={() => onApply(local)}
              testID="apply-filters"
            >
              <Text style={styles.filterApplyText}>
                Show results{activeCount > 0 ? ` (${activeCount} active)` : ""}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.filterCancelBtn} onPress={onClose}>
              <Text style={styles.filterCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ---- Main screen ----
const DEFAULT_FILTERS: Filters = {
  categories: [],
  minPrice: "",
  maxPrice: "",
  sort: undefined,
};

export const ListingDiscoveryScreen: React.FC = () => {
  const { apiClient } = useAuth();
  const [listings, setListings] = useState<SafeListing[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [keyword, setKeyword] = useState("");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [categories, setCategories] = useState<ListingCategory[]>([]);

  // Load categories once
  useEffect(() => {
    apiClient.categories
      .list()
      .then(setCategories)
      .catch(() => {});
  }, [apiClient]);

  const activeFilterCount =
    filters.categories.length +
    (filters.minPrice ? 1 : 0) +
    (filters.maxPrice ? 1 : 0) +
    (filters.sort ? 1 : 0);

  // Track search/filter state in ref to avoid stale closure in loadPage
  const searchRef = useRef({ keyword, filters });
  useEffect(() => {
    searchRef.current = { keyword, filters };
  }, [keyword, filters]);

  const loadPage = useCallback(
    async (pageToLoad: number, append = true) => {
      if (loading || (!hasMore && append)) return;
      setLoading(true);
      setError(undefined);
      const { keyword: kw, filters: f } = searchRef.current;
      try {
        const response = await apiClient.listings.search({
          page: pageToLoad,
          pageSize: 10,
          keyword: kw || undefined,
          categories: f.categories.length ? f.categories : undefined,
          minPriceCents: f.minPrice
            ? Math.round(parseFloat(f.minPrice) * 100)
            : undefined,
          maxPriceCents: f.maxPrice
            ? Math.round(parseFloat(f.maxPrice) * 100)
            : undefined,
          sort: f.sort,
        });
        setHasMore(response.page < response.pageCount);
        setListings((prev) =>
          append ? [...prev, ...response.data] : response.data,
        );
        setPage(pageToLoad);
      } catch {
        setHasMore(false);
        setListings(demoListings);
        setError("Using demo listings while we reconnect.");
      } finally {
        setLoading(false);
      }
    },
    [apiClient, loading, hasMore],
  );

  // Reload when keyword or filters change
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setHasMore(true);
    loadPage(1, false);
  }, [keyword, filters, loadPage]);

  // Initial load
  useEffect(() => {
    loadPage(1, false);
  }, [loadPage]);

  const onEndReached = () => {
    if (hasMore && !loading) loadPage(page + 1);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setHasMore(true);
    await loadPage(1, false);
    setRefreshing(false);
  };

  const handleApplyFilters = (f: Filters) => {
    setFilters(f);
    setFilterModalVisible(false);
  };

  return (
    <View style={styles.container}>
      {/* Search bar + filter button */}
      <View style={styles.searchRow}>
        <TextInput
          placeholder="Search listings"
          value={keyword}
          onChangeText={setKeyword}
          onSubmitEditing={() => loadPage(1, false)}
          style={styles.search}
          returnKeyType="search"
          testID="listing-search"
        />
        <TouchableOpacity
          style={[
            styles.filterBtn,
            activeFilterCount > 0 && styles.filterBtnActive,
          ]}
          onPress={() => setFilterModalVisible(true)}
          testID="open-filters"
        >
          <Text
            style={[
              styles.filterBtnText,
              activeFilterCount > 0 && styles.filterBtnTextActive,
            ]}
          >
            {activeFilterCount > 0
              ? `Filters (${activeFilterCount})`
              : "⚙ Filters"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.activeChips}
        >
          {filters.sort && (
            <View style={styles.activeChip}>
              <Text style={styles.activeChipText}>
                {SORT_OPTIONS.find((o) => o.value === filters.sort)?.label}
              </Text>
            </View>
          )}
          {filters.categories.map((slug) => (
            <View key={slug} style={styles.activeChip}>
              <Text style={styles.activeChipText}>
                {categories.find((c) => c.slug === slug)?.name ?? slug}
              </Text>
            </View>
          ))}
          {filters.minPrice ? (
            <View style={styles.activeChip}>
              <Text style={styles.activeChipText}>
                Min: ${filters.minPrice}
              </Text>
            </View>
          ) : null}
          {filters.maxPrice ? (
            <View style={styles.activeChip}>
              <Text style={styles.activeChipText}>
                Max: ${filters.maxPrice}
              </Text>
            </View>
          ) : null}
          <TouchableOpacity
            onPress={() => setFilters(DEFAULT_FILTERS)}
            style={styles.clearChip}
          >
            <Text style={styles.clearChipText}>✕ Clear</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        testID="listing-discovery"
        contentContainerStyle={styles.list}
        data={listings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ListingItem item={item} />}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>No listings found.</Text> : null
        }
        ListFooterComponent={
          loading ? (
            <View style={styles.footer}>
              <ActivityIndicator />
            </View>
          ) : null
        }
      />

      <FilterModal
        visible={filterModalVisible}
        filters={filters}
        categories={categories}
        onApply={handleApplyFilters}
        onClose={() => setFilterModalVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brandColors.background },
  list: { padding: spacing.md, gap: spacing.sm },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  search: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  filterBtn: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  filterBtnActive: {
    borderColor: brandColors.primary,
    backgroundColor: `${brandColors.primary}15`,
  },
  filterBtnText: { fontSize: 13, color: "#374151", fontWeight: "500" },
  filterBtnTextActive: { color: brandColors.primary, fontWeight: "700" },

  activeChips: { paddingHorizontal: spacing.md, paddingVertical: 8, gap: 6 },
  activeChip: {
    backgroundColor: `${brandColors.primary}20`,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  activeChipText: {
    fontSize: 12,
    color: brandColors.primary,
    fontWeight: "600",
  },
  clearChip: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  clearChipText: { fontSize: 12, color: brandColors.muted },

  card: {
    backgroundColor: brandColors.card,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
    overflow: "hidden",
  },
  cardImage: { width: "100%", height: 160 },
  cardImagePlaceholder: {
    width: "100%",
    height: 100,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  cardImagePlaceholderText: { fontSize: 28 },
  cardBody: { padding: spacing.md, gap: 4 },
  title: { fontSize: 16, fontWeight: "600" },
  price: { color: brandColors.success, fontWeight: "700", fontSize: 15 },
  description: { color: brandColors.muted, fontSize: 13 },
  location: { fontSize: 12, color: brandColors.muted },
  empty: { textAlign: "center", marginTop: 40, color: brandColors.muted },
  footer: { padding: 16, alignItems: "center" },
  error: { color: "#f97316", paddingHorizontal: spacing.md, paddingBottom: 4 },

  // Filter modal
  filterOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  filterSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: "80%",
  },
  filterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  filterTitle: { fontSize: 18, fontWeight: "700" },
  filterClear: { color: "#ef4444", fontWeight: "600" },
  filterSectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: brandColors.muted,
    marginBottom: 10,
    marginTop: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipActive: {
    borderColor: brandColors.primary,
    backgroundColor: `${brandColors.primary}15`,
  },
  chipText: { fontSize: 14, color: "#374151" },
  chipTextActive: { color: brandColors.primary, fontWeight: "700" },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: spacing.md,
  },
  priceInput: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: "#f9fafb",
  },
  priceSep: { color: brandColors.muted, fontSize: 16 },
  filterActions: { gap: 8, marginTop: spacing.md },
  filterApplyBtn: {
    backgroundColor: brandColors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
  },
  filterApplyText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  filterCancelBtn: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  filterCancelText: { color: brandColors.muted, fontWeight: "600" },
});
