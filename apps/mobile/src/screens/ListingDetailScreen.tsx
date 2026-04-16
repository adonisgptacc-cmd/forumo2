import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SafeListing, ListingVariant } from '@forumo/shared';
import { brandColors, spacing } from '@forumo/config';
import { useAuth } from '../providers/AuthProvider';
import type { MainStackParamList } from '../navigation/types';
import { cartStore } from './CartScreen';

type Props = NativeStackScreenProps<MainStackParamList, 'ListingDetail'>;

function formatCents(cents: number, currency = 'USD') {
  return `${currency} ${(cents / 100).toFixed(2)}`;
}

export const ListingDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { listingId, listing: initialListing } = route.params;
  const { apiClient, user } = useAuth();

  const [listing, setListing] = useState<SafeListing | undefined>(initialListing);
  const [loading, setLoading] = useState(!initialListing);
  const [selectedVariant, setSelectedVariant] = useState<ListingVariant | undefined>(
    initialListing?.variants?.[0]
  );

  // Wishlist state
  const [saved, setSaved] = useState(false);
  const [savingWishlist, setSavingWishlist] = useState(false);

  // Add to cart feedback
  const [addedToCart, setAddedToCart] = useState(false);

  // Offer modal
  const [offerModalVisible, setOfferModalVisible] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerMessage, setOfferMessage] = useState('');
  const [submittingOffer, setSubmittingOffer] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const result = await apiClient.listings.get(listingId);
      setListing(result);
      if (!selectedVariant && result.variants?.length) {
        setSelectedVariant(result.variants[0]);
      }
    } catch {
      // keep initialListing if available
    } finally {
      setLoading(false);
    }
  }, [apiClient, listingId]);

  useEffect(() => {
    if (!initialListing) load();
  }, []);

  // Check wishlist status
  useEffect(() => {
    if (!user || !listingId) return;
    apiClient.wishlist.check(listingId).then((r) => setSaved(r.saved)).catch(() => {});
  }, [user, listingId]);

  const handleAddToCart = () => {
    if (!listing) return;
    cartStore.addItem(listing, 1);
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  const handleWishlistToggle = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to save listings.');
      return;
    }
    setSavingWishlist(true);
    try {
      if (saved) {
        await apiClient.wishlist.remove(listingId);
        setSaved(false);
      } else {
        await apiClient.wishlist.save(listingId);
        setSaved(true);
      }
    } catch {
      Alert.alert('Error', 'Could not update wishlist. Please try again.');
    } finally {
      setSavingWishlist(false);
    }
  };

  const handleSubmitOffer = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to make an offer.');
      return;
    }
    const cents = Math.round(parseFloat(offerAmount) * 100);
    if (!offerAmount || isNaN(cents) || cents <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid offer amount.');
      return;
    }
    setSubmittingOffer(true);
    try {
      await apiClient.offers.create({
        listingId,
        amountCents: cents,
        currency: listing?.currency ?? 'USD',
        message: offerMessage.trim() || undefined,
      });
      setOfferModalVisible(false);
      setOfferAmount('');
      setOfferMessage('');
      Alert.alert('Offer Sent', 'Your offer has been submitted to the seller.');
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not submit offer.');
    } finally {
      setSubmittingOffer(false);
    }
  };

  const activePriceCents = selectedVariant?.priceCents ?? listing?.priceCents ?? 0;
  const currency = selectedVariant?.currency ?? listing?.currency ?? 'USD';

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={brandColors.primary} />
      </View>
    );
  }

  if (!listing) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Listing not found.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backLink}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const images = listing.images ?? [];
  const variants = listing.variants ?? [];

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Image */}
        {images.length > 0 ? (
          <Image
            source={{ uri: images[0].url }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.imagePlaceholderText}>No Image</Text>
          </View>
        )}

        {/* Title + Wishlist */}
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={3}>{listing.title}</Text>
          <TouchableOpacity
            onPress={handleWishlistToggle}
            disabled={savingWishlist}
            style={styles.heartBtn}
            testID="wishlist-toggle"
          >
            <Text style={[styles.heartIcon, saved && styles.heartSaved]}>
              {saved ? '♥' : '♡'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Price */}
        <Text style={styles.price}>{formatCents(activePriceCents, currency)}</Text>

        {/* Variants */}
        {variants.length > 1 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Options</Text>
            <View style={styles.variantRow}>
              {variants.map((v) => (
                <TouchableOpacity
                  key={v.id}
                  style={[
                    styles.variantBtn,
                    selectedVariant?.id === v.id && styles.variantBtnActive,
                  ]}
                  onPress={() => setSelectedVariant(v)}
                >
                  <Text
                    style={[
                      styles.variantLabel,
                      selectedVariant?.id === v.id && styles.variantLabelActive,
                    ]}
                  >
                    {v.label}
                  </Text>
                  {v.priceCents !== listing.priceCents && (
                    <Text style={styles.variantPrice}>{formatCents(v.priceCents, v.currency ?? currency)}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Description */}
        {listing.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Description</Text>
            <Text style={styles.description}>{listing.description}</Text>
          </View>
        ) : null}

        {/* Location */}
        {listing.location ? (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>📍 Location</Text>
            <Text style={styles.metaValue}>{listing.location}</Text>
          </View>
        ) : null}

        {/* Seller */}
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>🛍 Seller</Text>
          <Text style={styles.metaValue}>{listing.sellerId.slice(0, 8)}…</Text>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.cartBtn, addedToCart && styles.cartBtnAdded]}
            onPress={handleAddToCart}
            testID="add-to-cart-btn"
          >
            <Text style={styles.cartBtnText}>
              {addedToCart ? '✓ Added to Cart' : 'Add to Cart'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.offerBtn}
            onPress={() => setOfferModalVisible(true)}
            testID="make-offer-btn"
          >
            <Text style={styles.offerBtnText}>Make an Offer</Text>
          </TouchableOpacity>
        </View>

        {/* Contact seller */}
        <TouchableOpacity
          style={styles.contactBtn}
          onPress={() => navigation.push('Thread', { threadId: listing.sellerId, thread: undefined })}
        >
          <Text style={styles.contactBtnText}>💬 Contact Seller</Text>
        </TouchableOpacity>

        {/* Reviews */}
        <TouchableOpacity
          style={styles.contactBtn}
          onPress={() => navigation.push('Reviews', { sellerId: listing.sellerId, listingId: listing.id })}
        >
          <Text style={styles.contactBtnText}>⭐ View Reviews</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Offer modal */}
      <Modal
        visible={offerModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setOfferModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Make an Offer</Text>
            <Text style={styles.modalSub}>Listed at {formatCents(listing.priceCents, listing.currency)}</Text>

            <Text style={styles.inputLabel}>Your offer ({listing.currency})</Text>
            <TextInput
              style={styles.input}
              value={offerAmount}
              onChangeText={setOfferAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              testID="offer-amount-input"
            />

            <Text style={styles.inputLabel}>Message (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={offerMessage}
              onChangeText={setOfferMessage}
              multiline
              numberOfLines={3}
              placeholder="Explain your offer…"
              testID="offer-message-input"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, submittingOffer && styles.btnDisabled]}
                onPress={handleSubmitOffer}
                disabled={submittingOffer}
                testID="submit-offer-btn"
              >
                {submittingOffer ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalSubmitText}>Send Offer</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setOfferModalVisible(false)}
                disabled={submittingOffer}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brandColors.background },
  content: { paddingBottom: spacing.xl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  errorText: { fontSize: 16, color: brandColors.muted, marginBottom: 12 },
  backLink: { color: brandColors.primary, fontWeight: '600' },

  image: { width: '100%', height: 280, backgroundColor: '#f3f4f6' },
  imagePlaceholder: {
    width: '100%',
    height: 200,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: { color: '#9ca3af', fontSize: 14 },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: 8,
  },
  title: { flex: 1, fontSize: 22, fontWeight: '700', lineHeight: 28 },
  heartBtn: { padding: 4, marginTop: 2 },
  heartIcon: { fontSize: 28, color: '#9ca3af' },
  heartSaved: { color: '#ef4444' },

  price: {
    fontSize: 26,
    fontWeight: '800',
    color: brandColors.success,
    paddingHorizontal: spacing.md,
    marginTop: 4,
    marginBottom: spacing.sm,
  },

  section: { paddingHorizontal: spacing.md, marginBottom: spacing.md },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: brandColors.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },

  variantRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  variantBtn: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },
  variantBtnActive: { borderColor: brandColors.primary, backgroundColor: `${brandColors.primary}15` },
  variantLabel: { fontSize: 14, fontWeight: '500', color: '#374151' },
  variantLabelActive: { color: brandColors.primary, fontWeight: '700' },
  variantPrice: { fontSize: 12, color: brandColors.muted, marginTop: 2 },

  description: { fontSize: 15, color: '#374151', lineHeight: 22 },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: 8,
    gap: 8,
  },
  metaLabel: { fontSize: 13, color: brandColors.muted, width: 80 },
  metaValue: { fontSize: 14, color: '#374151' },

  actions: { padding: spacing.md, gap: spacing.sm },
  cartBtn: {
    backgroundColor: brandColors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  cartBtnAdded: { backgroundColor: brandColors.success },
  cartBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  offerBtn: {
    borderWidth: 1.5,
    borderColor: brandColors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  offerBtnText: { color: brandColors.primary, fontWeight: '700', fontSize: 16 },

  contactBtn: {
    marginHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  contactBtnText: { color: '#374151', fontWeight: '600', fontSize: 14 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  modalSub: { fontSize: 13, color: brandColors.muted, marginBottom: spacing.md },
  inputLabel: { fontSize: 13, fontWeight: '600', color: brandColors.muted, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: spacing.md,
    backgroundColor: '#f9fafb',
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  modalActions: { gap: spacing.sm },
  modalSubmitBtn: {
    backgroundColor: brandColors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  modalSubmitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  modalCancelBtn: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  modalCancelText: { color: brandColors.muted, fontWeight: '600' },
});
