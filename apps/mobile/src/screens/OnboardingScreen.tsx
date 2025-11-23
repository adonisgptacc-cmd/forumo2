import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { onboardingHighlights } from '@forumo/config';
import { AuthStackParamList } from '../navigation/types';

export type OnboardingScreenProps = NativeStackScreenProps<AuthStackParamList, 'Onboarding'>;

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ navigation }) => {
  return (
    <View style={styles.container} testID="onboarding-screen">
      <Text style={styles.title}>Welcome to Forumo</Text>
      <Text style={styles.subtitle}>Discover listings, message sellers, and stay on top of your orders.</Text>
      <View style={styles.callouts}>
        {onboardingHighlights.map((highlight) => (
          <Text key={highlight} style={styles.callout}>
            • {highlight}
          </Text>
        ))}
      </View>
      <Button title="Get started" onPress={() => navigation.navigate('Login')} testID="get-started-button" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#4b5563',
    marginBottom: 24,
  },
  callouts: {
    alignSelf: 'stretch',
    gap: 8,
    marginBottom: 24,
  },
  callout: {
    color: '#0f172a',
    fontSize: 14,
    lineHeight: 20,
  },
});
