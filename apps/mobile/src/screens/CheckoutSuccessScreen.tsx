import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { brandColors, spacing } from '@forumo/config';
import type { MainStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'CheckoutSuccess'>;

export const CheckoutSuccessScreen: React.FC<Props> = ({ navigation }) => (
  <View style={styles.container} testID="checkout-success-screen">
    <Text style={styles.icon}>🎉</Text>
    <Text style={styles.heading}>Payment Successful</Text>
    <Text style={styles.text}>
      Your payment was received. We'll notify you when the seller confirms your order.
    </Text>
    <TouchableOpacity
      style={styles.primaryBtn}
      onPress={() => navigation.navigate('Tabs')}
      testID="continue-shopping-button"
    >
      <Text style={styles.primaryBtnText}>Continue Shopping</Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={styles.secondaryBtn}
      onPress={() => navigation.navigate('Tabs')}
    >
      <Text style={styles.secondaryBtnText}>View Orders</Text>
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: brandColors.background,
  },
  icon: { fontSize: 64, marginBottom: spacing.md },
  heading: { fontSize: 24, fontWeight: '700', marginBottom: spacing.sm },
  text: {
    fontSize: 15,
    color: brandColors.muted,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  primaryBtn: {
    backgroundColor: brandColors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginBottom: spacing.sm,
    width: '100%',
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondaryBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  secondaryBtnText: { color: brandColors.muted, fontWeight: '600', fontSize: 15 },
});
