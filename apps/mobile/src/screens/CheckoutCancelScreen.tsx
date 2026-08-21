import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { brandColors, spacing } from "@forumo/config";
import type { MainStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<MainStackParamList, "CheckoutCancel">;

export const CheckoutCancelScreen: React.FC<Props> = ({ navigation }) => (
  <View style={styles.container} testID="checkout-cancel-screen">
    <Text style={styles.icon}>↩️</Text>
    <Text style={styles.heading}>Payment Cancelled</Text>
    <Text style={styles.text}>
      Your payment was not completed. Your cart has been saved — you can try
      again whenever you're ready.
    </Text>
    <TouchableOpacity
      style={styles.primaryBtn}
      onPress={() => navigation.navigate("Cart")}
      testID="return-to-cart-button"
    >
      <Text style={styles.primaryBtnText}>Return to Cart</Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={styles.secondaryBtn}
      onPress={() => navigation.navigate("Tabs")}
    >
      <Text style={styles.secondaryBtnText}>Continue Shopping</Text>
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    backgroundColor: brandColors.background,
  },
  icon: { fontSize: 64, marginBottom: spacing.md },
  heading: { fontSize: 24, fontWeight: "700", marginBottom: spacing.sm },
  text: {
    fontSize: 15,
    color: brandColors.muted,
    textAlign: "center",
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  primaryBtn: {
    backgroundColor: brandColors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginBottom: spacing.sm,
    width: "100%",
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  secondaryBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: "100%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  secondaryBtnText: {
    color: brandColors.muted,
    fontWeight: "600",
    fontSize: 15,
  },
});
