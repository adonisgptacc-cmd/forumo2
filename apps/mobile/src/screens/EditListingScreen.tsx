import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { brandColors, spacing } from "@forumo/config";
import { useAuth } from "../providers/AuthProvider";
import type { MainStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<MainStackParamList, "EditListing">;

export const EditListingScreen: React.FC<Props> = ({ route, navigation }) => {
  const { listingId, listing: initialListing } = route.params;
  const { apiClient } = useAuth();

  const [loading, setLoading] = useState(!initialListing);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState(initialListing?.title ?? "");
  const [description, setDescription] = useState(
    initialListing?.description ?? "",
  );
  const [price, setPrice] = useState(
    initialListing ? String(initialListing.priceCents / 100) : "",
  );
  const [currency, setCurrency] = useState(initialListing?.currency ?? "USD");
  const [location, setLocation] = useState(initialListing?.location ?? "");
  const [published, setPublished] = useState(
    initialListing?.status === "PUBLISHED",
  );

  // Fetch if no initial data
  useEffect(() => {
    if (initialListing) return;
    apiClient.listings
      .get(listingId)
      .then((l) => {
        setTitle(l.title);
        setDescription(l.description ?? "");
        setPrice(String(l.priceCents / 100));
        setCurrency(l.currency);
        setLocation(l.location ?? "");
        setPublished(l.status === "PUBLISHED");
      })
      .catch(() => {
        Alert.alert("Error", "Could not load listing.");
        navigation.goBack();
      })
      .finally(() => setLoading(false));
  }, []);

  const validate = (): string | null => {
    if (!title.trim()) return "Title is required.";
    const p = parseFloat(price);
    if (!price || isNaN(p) || p <= 0) return "Enter a valid price.";
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      Alert.alert("Validation", err);
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.listings.update(listingId, {
        title: title.trim(),
        description: description.trim() || undefined,
        priceCents: Math.round(parseFloat(price) * 100),
        currency,
        location: location.trim() || undefined,
        status: published ? "PUBLISHED" : "DRAFT",
      });
      Alert.alert("Saved", "Listing updated successfully.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not update listing.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={brandColors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.heading}>Edit Listing</Text>

      <View style={styles.section}>
        <Text style={styles.label}>
          Title <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="What are you selling?"
          testID="edit-title"
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Describe your item…"
          multiline
          numberOfLines={4}
          testID="edit-description"
        />

        <Text style={styles.label}>
          Price ({currency}) <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={styles.input}
          value={price}
          onChangeText={setPrice}
          placeholder="0.00"
          keyboardType="decimal-pad"
          testID="edit-price"
        />

        <Text style={styles.label}>Currency</Text>
        <View style={styles.currencyRow}>
          {["USD", "EUR", "GBP"].map((c) => (
            <TouchableOpacity
              key={c}
              style={[
                styles.currencyBtn,
                currency === c && styles.currencyBtnActive,
              ]}
              onPress={() => setCurrency(c)}
            >
              <Text
                style={[
                  styles.currencyBtnText,
                  currency === c && styles.currencyBtnTextActive,
                ]}
              >
                {c}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Location</Text>
        <TextInput
          style={styles.input}
          value={location}
          onChangeText={setLocation}
          placeholder="City, country"
          testID="edit-location"
        />

        <View style={styles.switchRow}>
          <View>
            <Text style={styles.label}>Published</Text>
            <Text style={styles.switchSub}>
              Off = draft (not visible to buyers)
            </Text>
          </View>
          <Switch
            value={published}
            onValueChange={setPublished}
            trackColor={{ true: brandColors.primary }}
            testID="edit-publish-toggle"
          />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, submitting && styles.btnDisabled]}
        onPress={handleSave}
        disabled={submitting}
        testID="save-listing-btn"
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveBtnText}>Save Changes</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.cancelBtn}
        onPress={() => navigation.goBack()}
        disabled={submitting}
      >
        <Text style={styles.cancelBtnText}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brandColors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  heading: { fontSize: 24, fontWeight: "800", marginBottom: spacing.md },
  section: {
    backgroundColor: brandColors.card,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: brandColors.muted,
    marginTop: 10,
    marginBottom: 4,
  },
  required: { color: "#ef4444" },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: "#f9fafb",
  },
  textArea: { height: 100, textAlignVertical: "top" },
  currencyRow: { flexDirection: "row", gap: 8 },
  currencyBtn: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  currencyBtnActive: {
    borderColor: brandColors.primary,
    backgroundColor: `${brandColors.primary}15`,
  },
  currencyBtnText: { fontSize: 14, color: "#374151" },
  currencyBtnTextActive: { color: brandColors.primary, fontWeight: "700" },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  switchSub: { fontSize: 12, color: brandColors.muted },
  saveBtn: {
    backgroundColor: brandColors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  btnDisabled: { opacity: 0.6 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  cancelBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  cancelBtnText: { color: brandColors.muted, fontWeight: "600" },
});
