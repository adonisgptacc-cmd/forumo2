import React, { useState } from "react";
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
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { brandColors, spacing } from "@forumo/config";
import { useAuth } from "../providers/AuthProvider";
import type { MainStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<MainStackParamList, "CreateListing">;

interface VariantDraft {
  label: string;
  priceCents: string; // raw string input
  sku: string;
}

export const CreateListingScreen: React.FC<Props> = ({ navigation }) => {
  const { apiClient, user } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [location, setLocation] = useState("");
  const [published, setPublished] = useState(false);
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [pendingImages, setPendingImages] = useState<
    { uri: string; mimeType?: string; fileName?: string }[]
  >([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission required",
        "Please allow photo library access to add photos.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 8,
    });
    if (!result.canceled && result.assets.length > 0) {
      setPendingImages((prev) =>
        [
          ...prev,
          ...result.assets.map((a) => ({
            uri: a.uri,
            mimeType: a.mimeType,
            fileName: a.fileName ?? undefined,
          })),
        ].slice(0, 8),
      );
    }
  };

  const removeImage = (idx: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const addVariant = () => {
    setVariants((prev) => [...prev, { label: "", priceCents: "", sku: "" }]);
  };

  const updateVariant = (
    idx: number,
    field: keyof VariantDraft,
    value: string,
  ) => {
    setVariants((prev) =>
      prev.map((v, i) => (i === idx ? { ...v, [field]: value } : v)),
    );
  };

  const removeVariant = (idx: number) => {
    setVariants((prev) => prev.filter((_, i) => i !== idx));
  };

  const validate = (): string | null => {
    if (!title.trim()) return "Title is required.";
    const priceNum = parseFloat(price);
    if (!price || isNaN(priceNum) || priceNum <= 0)
      return "Enter a valid price.";
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      if (!v.label.trim()) return `Variant ${i + 1} needs a label.`;
      const vp = parseFloat(v.priceCents);
      if (!v.priceCents || isNaN(vp) || vp <= 0)
        return `Variant ${i + 1} needs a valid price.`;
    }
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      Alert.alert("Validation", err);
      return;
    }

    setSubmitting(true);
    try {
      const created = await apiClient.listings.create({
        title: title.trim(),
        description: description.trim(),
        priceCents: Math.round(parseFloat(price) * 100),
        currency,
        location: location.trim() || undefined,
        status: published ? "PUBLISHED" : "DRAFT",
        variants: variants.length
          ? variants.map((v) => ({
              label: v.label.trim(),
              priceCents: Math.round(parseFloat(v.priceCents) * 100),
              currency,
              sku: v.sku.trim() || undefined,
            }))
          : undefined,
      });

      // Upload pending images sequentially
      if (pendingImages.length > 0) {
        setUploadingImages(true);
        for (const img of pendingImages) {
          try {
            const fd = new FormData();
            fd.append("file", {
              uri: img.uri,
              type: img.mimeType ?? "image/jpeg",
              name: img.fileName ?? "photo.jpg",
            } as any);
            await apiClient.post(`/listings/${created.id}/images`, fd, {
              auth: true,
            });
          } catch {
            // non-fatal: continue
          }
        }
        setUploadingImages(false);
      }

      Alert.alert("Success", "Listing created!", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not create listing.");
    } finally {
      setSubmitting(false);
      setUploadingImages(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.heading}>New Listing</Text>

      {/* Basic fields */}
      <View style={styles.section}>
        <Text style={styles.label}>
          Title <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="What are you selling?"
          testID="listing-title"
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Describe your item…"
          multiline
          numberOfLines={4}
          testID="listing-description"
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
          testID="listing-price"
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
          testID="listing-location"
        />

        <View style={styles.switchRow}>
          <View>
            <Text style={styles.label}>Publish immediately</Text>
            <Text style={styles.switchSub}>Off = saved as draft</Text>
          </View>
          <Switch
            value={published}
            onValueChange={setPublished}
            trackColor={{ true: brandColors.primary }}
            testID="listing-publish-toggle"
          />
        </View>
      </View>

      {/* Variants */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Variants</Text>
          <TouchableOpacity onPress={addVariant} testID="add-variant-btn">
            <Text style={styles.addLink}>+ Add</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.sectionSub}>
          Add sizes, colours, or other options.
        </Text>

        {variants.map((v, idx) => (
          <View key={idx} style={styles.variantCard} testID={`variant-${idx}`}>
            <View style={styles.variantHeader}>
              <Text style={styles.variantNum}>Variant {idx + 1}</Text>
              <TouchableOpacity onPress={() => removeVariant(idx)}>
                <Text style={styles.removeVariant}>Remove</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.label}>
              Label <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={v.label}
              onChangeText={(val) => updateVariant(idx, "label", val)}
              placeholder="e.g. Large, Red, 256GB"
              testID={`variant-label-${idx}`}
            />
            <Text style={styles.label}>
              Price ({currency}) <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={v.priceCents}
              onChangeText={(val) => updateVariant(idx, "priceCents", val)}
              placeholder="0.00"
              keyboardType="decimal-pad"
              testID={`variant-price-${idx}`}
            />
            <Text style={styles.label}>SKU (optional)</Text>
            <TextInput
              style={styles.input}
              value={v.sku}
              onChangeText={(val) => updateVariant(idx, "sku", val)}
              placeholder="ABC-123"
              testID={`variant-sku-${idx}`}
            />
          </View>
        ))}

        {variants.length === 0 && (
          <Text style={styles.noVariants}>
            No variants yet. Tap "+ Add" to create one.
          </Text>
        )}
      </View>

      {/* Photos */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Photos</Text>
          <TouchableOpacity
            onPress={pickImages}
            disabled={submitting}
            testID="add-photos-btn"
          >
            <Text style={styles.addLink}>+ Add Photos</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.sectionSub}>
          Up to 8 photos. First photo is the cover.
        </Text>
        {pendingImages.length > 0 ? (
          <View style={styles.imageGrid}>
            {pendingImages.map((img, idx) => (
              <View key={idx} style={styles.imageThumb}>
                <Image source={{ uri: img.uri }} style={styles.thumbImg} />
                {idx === 0 && (
                  <View style={styles.coverBadge}>
                    <Text style={styles.coverBadgeText}>Cover</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.removeImgBtn}
                  onPress={() => removeImage(idx)}
                >
                  <Text style={styles.removeImgText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <TouchableOpacity
            style={styles.photoPlaceholder}
            onPress={pickImages}
          >
            <Text style={styles.photoPlaceholderIcon}>📷</Text>
            <Text style={styles.photoPlaceholderText}>Tap to add photos</Text>
          </TouchableOpacity>
        )}
        {uploadingImages && (
          <View style={styles.uploadingRow}>
            <ActivityIndicator size="small" color={brandColors.primary} />
            <Text style={styles.uploadingText}>Uploading photos…</Text>
          </View>
        )}
      </View>

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitBtn, submitting && styles.btnDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
        testID="create-listing-submit"
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>
            {published ? "Publish Listing" : "Save Draft"}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.cancelBtn}
        onPress={() => navigation.goBack()}
        disabled={submitting}
      >
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brandColors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  heading: { fontSize: 24, fontWeight: "800", marginBottom: spacing.md },

  section: {
    backgroundColor: brandColors.card,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  sectionSub: { fontSize: 12, color: brandColors.muted, marginBottom: 10 },
  addLink: { color: brandColors.primary, fontWeight: "700", fontSize: 14 },

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

  variantCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
    gap: 4,
  },
  variantHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  variantNum: { fontSize: 13, fontWeight: "700", color: "#374151" },
  removeVariant: { color: "#ef4444", fontSize: 13, fontWeight: "600" },
  noVariants: {
    fontSize: 13,
    color: brandColors.muted,
    textAlign: "center",
    paddingVertical: 16,
  },

  submitBtn: {
    backgroundColor: brandColors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  btnDisabled: { opacity: 0.6 },
  submitText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  cancelBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  cancelText: { color: brandColors.muted, fontWeight: "600" },

  imageGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  imageThumb: {
    width: 76,
    height: 76,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  thumbImg: { width: 76, height: 76 },
  coverBadge: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingVertical: 2,
    alignItems: "center",
  },
  coverBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  removeImgBtn: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: "rgba(0,0,0,0.55)",
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  removeImgText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  photoPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderStyle: "dashed",
    borderRadius: 10,
    paddingVertical: 24,
  },
  photoPlaceholderIcon: { fontSize: 28, marginBottom: 6 },
  photoPlaceholderText: { fontSize: 13, color: brandColors.muted },
  uploadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  uploadingText: { fontSize: 13, color: brandColors.muted },
});
