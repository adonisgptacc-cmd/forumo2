import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { brandColors, spacing } from '@forumo/config';
import type { AuthStackParamList } from '../navigation/types';
import { useAuth } from '../providers/AuthProvider';

type Props = NativeStackScreenProps<AuthStackParamList, 'VerifyEmail'>;

export const VerifyEmailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { token } = route.params ?? {};
  const { apiClient } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token provided.');
      return;
    }

    (async () => {
      try {
        await apiClient.auth.verifyEmail(token);
        setStatus('success');
        setMessage('Your email has been verified. You can now sign in.');
      } catch (err: any) {
        setStatus('error');
        setMessage(err?.message ?? 'Verification failed. The link may have expired.');
      }
    })();
  }, [token, apiClient]);

  return (
    <View style={styles.container} testID="verify-email-screen">
      {status === 'loading' && (
        <>
          <ActivityIndicator size="large" color={brandColors.primary} />
          <Text style={styles.text}>Verifying your email…</Text>
        </>
      )}
      {status === 'success' && (
        <>
          <Text style={styles.icon}>✅</Text>
          <Text style={styles.heading}>Email Verified</Text>
          <Text style={styles.text}>{message}</Text>
          <Text style={styles.link} onPress={() => navigation.navigate('Login')}>
            Go to Sign In
          </Text>
        </>
      )}
      {status === 'error' && (
        <>
          <Text style={styles.icon}>❌</Text>
          <Text style={styles.heading}>Verification Failed</Text>
          <Text style={styles.text}>{message}</Text>
          <Text style={styles.link} onPress={() => navigation.navigate('Login')}>
            Back to Sign In
          </Text>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: brandColors.background,
  },
  icon: { fontSize: 48, marginBottom: spacing.md },
  heading: { fontSize: 22, fontWeight: '700', marginBottom: spacing.sm },
  text: { fontSize: 15, color: brandColors.muted, textAlign: 'center', marginTop: spacing.sm },
  link: { marginTop: spacing.lg, color: brandColors.primary, fontWeight: '600', fontSize: 15 },
});
