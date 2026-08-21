import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { SafeReview, ReviewRollup } from "@forumo/shared";
import { brandColors, spacing } from "@forumo/config";
import { useAuth } from "../providers/AuthProvider";
import type { MainStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<MainStackParamList, "Reviews">;

function StarRow({ rating, size = 16 }: { rating: number; size?: number }) {
  const full = Math.round(rating);
  return (
    <Text style={{ fontSize: size, color: brandColors.primary }}>
      {"★".repeat(full)}
      {"☆".repeat(5 - full)}
    </Text>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function ReviewCard({ review }: { review: SafeReview }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.reviewer}>
          {review.reviewer?.name ?? "Anonymous"}
        </Text>
        <Text style={styles.date}>{formatDate(review.createdAt)}</Text>
      </View>
      <StarRow rating={review.rating} />
      {review.comment ? (
        <Text style={styles.comment}>{review.comment}</Text>
      ) : null}
    </View>
  );
}

export const ReviewsScreen: React.FC<Props> = ({ route }) => {
  const { sellerId, listingId } = route.params;
  const { apiClient, user } = useAuth();

  const [reviews, setReviews] = useState<SafeReview[]>([]);
  const [rollup, setRollup] = useState<ReviewRollup | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [orderId, setOrderId] = useState("");

  const load = useCallback(async () => {
    try {
      const params = listingId
        ? await apiClient.reviews.forListing(listingId)
        : null;
      if (params) {
        setReviews(params.reviews);
        setRollup(params.rollup);
      }
      if (sellerId) {
        const r = await apiClient.reviews.rollup(sellerId);
        setRollup(r);
      }
    } catch {
      setReviews([]);
    }
  }, [apiClient, sellerId, listingId]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleSubmit = async () => {
    if (!user || !listingId || !orderId.trim()) {
      Alert.alert(
        "Missing info",
        "Please enter the Order ID to submit a review.",
      );
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.reviews.create({
        reviewerId: user.id,
        recipientId: sellerId,
        listingId,
        orderId: orderId.trim(),
        rating,
        comment: comment.trim() || undefined,
      });
      setComment("");
      setOrderId("");
      setRating(5);
      setShowForm(false);
      await load();
      Alert.alert("Review submitted", "Thank you for your feedback!");
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to submit review.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={brandColors.primary} />
      </View>
    );
  }

  const pct = (n: number) =>
    rollup && rollup.reviewCount > 0
      ? Math.round((n / rollup.reviewCount) * 100)
      : 0;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={brandColors.primary}
        />
      }
    >
      {/* Rollup summary */}
      {rollup && rollup.publishedCount > 0 && (
        <View style={styles.rollup}>
          <View style={styles.rollupScore}>
            <Text style={styles.scoreNumber}>
              {rollup.averageRating.toFixed(1)}
            </Text>
            <StarRow rating={rollup.averageRating} size={20} />
            <Text style={styles.reviewCount}>
              {rollup.publishedCount} review
              {rollup.publishedCount !== 1 ? "s" : ""}
            </Text>
          </View>
          <View style={styles.rollupBars}>
            {[5, 4, 3, 2, 1].map((star) => (
              <View key={star} style={styles.barRow}>
                <Text style={styles.barLabel}>{star}★</Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${pct(rollup.reviewCount)}%` as any },
                    ]}
                  />
                </View>
                <Text style={styles.barPct}>{pct(rollup.reviewCount)}%</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Write a review */}
      {listingId && user && (
        <View style={styles.section}>
          {!showForm ? (
            <TouchableOpacity
              style={styles.writeBtn}
              onPress={() => setShowForm(true)}
            >
              <Text style={styles.writeBtnText}>Write a review</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.form}>
              <Text style={styles.formTitle}>Your Review</Text>

              {/* Star picker */}
              <View style={styles.starPicker}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <TouchableOpacity key={s} onPress={() => setRating(s)}>
                    <Text
                      style={[
                        styles.starPickerStar,
                        {
                          color: s <= rating ? brandColors.primary : "#cbd5e1",
                        },
                      ]}
                    >
                      ★
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={styles.input}
                placeholder="Order ID (required)"
                placeholderTextColor="#94a3b8"
                value={orderId}
                onChangeText={setOrderId}
              />
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="Share your experience (optional)"
                placeholderTextColor="#94a3b8"
                value={comment}
                onChangeText={setComment}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <View style={styles.formButtons}>
                <TouchableOpacity
                  style={[styles.submitBtn, submitting && styles.disabledBtn]}
                  onPress={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.submitBtnText}>Submit</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    setShowForm(false);
                    setComment("");
                    setOrderId("");
                    setRating(5);
                  }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Review list */}
      <View style={styles.section}>
        {reviews.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No reviews yet.</Text>
          </View>
        ) : (
          reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  rollup: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: "#fff",
    padding: spacing.md,
    margin: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  rollupScore: { alignItems: "center", minWidth: 80 },
  scoreNumber: { fontSize: 40, fontWeight: "700", color: "#0f172a" },
  reviewCount: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  rollupBars: { flex: 1, gap: 4 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  barLabel: { width: 24, fontSize: 11, color: "#64748b", textAlign: "right" },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: "#e2e8f0",
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    backgroundColor: brandColors.primary,
    borderRadius: 4,
  },
  barPct: { width: 32, fontSize: 10, color: "#94a3b8", textAlign: "right" },
  section: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 4,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  reviewer: { fontWeight: "600", fontSize: 14, color: "#0f172a" },
  date: { fontSize: 11, color: "#94a3b8" },
  comment: { fontSize: 14, color: "#475569", lineHeight: 20, marginTop: 4 },
  empty: { paddingVertical: 40, alignItems: "center" },
  emptyText: { color: "#94a3b8", fontSize: 14 },
  writeBtn: {
    backgroundColor: brandColors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: "flex-start",
    marginBottom: spacing.sm,
  },
  writeBtnText: { color: "#000", fontWeight: "600", fontSize: 14 },
  form: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  formTitle: { fontWeight: "600", fontSize: 16, color: "#0f172a" },
  starPicker: { flexDirection: "row", gap: 6 },
  starPickerStar: { fontSize: 32 },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
  },
  textarea: { minHeight: 80 },
  formButtons: { flexDirection: "row", gap: spacing.sm },
  submitBtn: {
    flex: 1,
    backgroundColor: brandColors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledBtn: { opacity: 0.6 },
  submitBtnText: { color: "#000", fontWeight: "700", fontSize: 14 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  cancelBtnText: { color: "#64748b", fontSize: 14 },
});
