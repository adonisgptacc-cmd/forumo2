import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import type { SafeUser } from "@forumo/shared";
import { brandColors, spacing } from "@forumo/config";
import { useAuth } from "../providers/AuthProvider";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../navigation/types";

export const ProfileTab: React.FC = () => {
  const { apiClient, user: authUser, logout } = useAuth();
  const navigation =
    useNavigation<NativeStackNavigationProp<MainStackParamList>>();

  const [profile, setProfile] = useState<SafeUser | undefined>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const loadProfile = useCallback(async () => {
    try {
      const data = await apiClient.users.getProfile();
      const u: SafeUser = data.user ?? (data as any);
      setProfile(u);
      setName(u.name ?? "");
      setPhone(u.phone ?? "");
    } catch {
      // fall back to auth user
      if (authUser) {
        setProfile(authUser as SafeUser);
        setName(authUser.name ?? "");
      }
    }
  }, [apiClient, authUser]);

  useEffect(() => {
    setLoading(true);
    loadProfile().finally(() => setLoading(false));
  }, [loadProfile]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      await apiClient.users.updateProfile({ name, phone: phone || undefined });
      setProfile((prev) => (prev ? { ...prev, name, phone } : prev));
      setEditing(false);
      Alert.alert("Saved", "Profile updated successfully.");
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const pickAndUploadAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission required",
        "Please allow photo library access to update your avatar.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    setUploadingAvatar(true);
    try {
      const asset = result.assets[0];
      const formData = new FormData();
      formData.append("avatar", {
        uri: asset.uri,
        type: asset.mimeType ?? "image/jpeg",
        name: asset.fileName ?? "avatar.jpg",
      } as any);
      await apiClient.post("/users/me/avatar", formData, { auth: true });
      await loadProfile();
      Alert.alert("Updated", "Avatar updated successfully.");
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not upload avatar.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: logout },
    ]);
  };

  const displayUser = profile ?? authUser;

  return (
    <ScrollView
      style={styles.container}
      testID="profile-tab"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Avatar */}
      <View style={styles.avatarSection}>
        <TouchableOpacity
          onPress={pickAndUploadAvatar}
          disabled={uploadingAvatar}
          testID="avatar-upload-btn"
        >
          <View style={styles.avatarWrapper}>
            {displayUser?.avatarUrl ? (
              <Image
                source={{ uri: displayUser.avatarUrl }}
                style={styles.avatarImage}
              />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarLetter}>
                  {(displayUser?.name ??
                    displayUser?.email ??
                    "U")[0].toUpperCase()}
                </Text>
              </View>
            )}
            {uploadingAvatar ? (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : (
              <View style={styles.avatarEditBadge}>
                <Text style={styles.avatarEditBadgeText}>✏️</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        <Text style={styles.userName}>{displayUser?.name ?? "Anonymous"}</Text>
        <Text style={styles.userEmail}>{displayUser?.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>
            {displayUser?.role ?? "BUYER"}
          </Text>
        </View>
      </View>

      {/* Trust score — only available on full SafeUser profile */}
      {profile?.trustScore !== undefined && (
        <View style={styles.trustBox}>
          <Text style={styles.trustLabel}>Trust Score</Text>
          <Text style={styles.trustScore}>{profile.trustScore}</Text>
          <Text style={styles.trustSub}>out of 100</Text>
        </View>
      )}

      {/* Edit form */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={brandColors.primary} />
        </View>
      ) : (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Personal Info</Text>
            {!editing ? (
              <TouchableOpacity
                onPress={() => setEditing(true)}
                testID="edit-profile-btn"
              >
                <Text style={styles.editLink}>Edit</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Full Name</Text>
            {editing ? (
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                testID="profile-name-input"
              />
            ) : (
              <Text style={styles.fieldValue}>{profile?.name ?? "—"}</Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Email</Text>
            <Text style={styles.fieldValue}>{displayUser?.email ?? "—"}</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Phone</Text>
            {editing ? (
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+1 555 000 0000"
                keyboardType="phone-pad"
                testID="profile-phone-input"
              />
            ) : (
              <Text style={styles.fieldValue}>{profile?.phone ?? "—"}</Text>
            )}
          </View>

          {editing && (
            <View style={styles.editActions}>
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.btnDisabled]}
                onPress={saveProfile}
                disabled={saving}
                testID="save-profile-btn"
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setEditing(false);
                  setName(profile?.name ?? "");
                  setPhone(profile?.phone ?? "");
                }}
                disabled={saving}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Quick links */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Activity</Text>
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => navigation.push("MyListings")}
          testID="profile-my-listings-link"
        >
          <Text style={styles.linkText}>My Listings</Text>
          <Text style={styles.linkChevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => navigation.push("CreateListing")}
          testID="profile-create-listing-link"
        >
          <Text style={styles.linkText}>+ Create Listing</Text>
          <Text style={styles.linkChevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => navigation.push("Offers")}
          testID="profile-offers-link"
        >
          <Text style={styles.linkText}>My Offers</Text>
          <Text style={styles.linkChevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => navigation.push("Notifications")}
          testID="profile-notifications-link"
        >
          <Text style={styles.linkText}>Notifications</Text>
          <Text style={styles.linkChevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => navigation.push("Wishlist")}
          testID="profile-wishlist-link"
        >
          <Text style={styles.linkText}>Wishlist</Text>
          <Text style={styles.linkChevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => navigation.push("Cart")}
          testID="profile-cart-link"
        >
          <Text style={styles.linkText}>Cart</Text>
          <Text style={styles.linkChevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => navigation.push("SellerDashboard")}
          testID="profile-seller-dashboard-link"
        >
          <Text style={styles.linkText}>Seller Dashboard</Text>
          <Text style={styles.linkChevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => navigation.push("KYC")}
          testID="profile-kyc-link"
        >
          <Text style={styles.linkText}>Identity Verification (KYC)</Text>
          <Text style={styles.linkChevron}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Sign out */}
      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={handleLogout}
        testID="logout-button"
      >
        <Text style={styles.logoutBtnText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brandColors.background },
  avatarSection: { alignItems: "center", paddingVertical: spacing.lg },
  avatarWrapper: { position: "relative", marginBottom: 12 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: brandColors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: { width: 80, height: 80, borderRadius: 40 },
  avatarOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 40,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarEditBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  avatarEditBadgeText: { fontSize: 12 },
  avatarLetter: { color: "#fff", fontSize: 32, fontWeight: "700" },
  userName: { fontSize: 20, fontWeight: "700", marginBottom: 4 },
  userEmail: { fontSize: 14, color: brandColors.muted, marginBottom: 8 },
  roleBadge: {
    backgroundColor: "#f3f4f6",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  roleBadgeText: { fontSize: 12, fontWeight: "600", color: "#374151" },
  trustBox: {
    backgroundColor: brandColors.card,
    marginHorizontal: spacing.md,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: "center",
    marginBottom: spacing.md,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  trustLabel: { fontSize: 14, color: brandColors.muted },
  trustScore: { fontSize: 28, fontWeight: "800", color: brandColors.primary },
  trustSub: {
    fontSize: 13,
    color: brandColors.muted,
    alignSelf: "flex-end",
    paddingBottom: 4,
  },
  loadingBox: { alignItems: "center", padding: spacing.lg },
  section: {
    backgroundColor: brandColors.card,
    marginHorizontal: spacing.md,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: "600" },
  editLink: { color: brandColors.primary, fontWeight: "600" },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, color: brandColors.muted, marginBottom: 4 },
  fieldValue: { fontSize: 15, color: "#111827" },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    backgroundColor: "#fff",
  },
  editActions: { gap: 8, marginTop: 4 },
  saveBtn: {
    backgroundColor: brandColors.primary,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.6 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  cancelBtn: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  cancelBtnText: { color: brandColors.muted, fontWeight: "600" },
  linkRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  linkText: { fontSize: 15 },
  linkChevron: { fontSize: 20, color: brandColors.muted },
  logoutBtn: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#fee2e2",
  },
  logoutBtnText: { color: "#dc2626", fontWeight: "700", fontSize: 15 },
});
