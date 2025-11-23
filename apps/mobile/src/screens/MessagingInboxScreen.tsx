import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl, Button } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeMessageThread } from '@forumo/shared';
import { brandColors, demoThreads } from '@forumo/config';
import { useAuth } from '../providers/AuthProvider';
import { MainStackParamList } from '../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const ThreadCard: React.FC<{ thread: SafeMessageThread; onPress: (thread: SafeMessageThread) => void }> = ({
  thread,
  onPress,
}) => {
  const latestMessage = thread.messages?.[thread.messages.length - 1];
  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(thread)} testID={`thread-card-${thread.id}`}>
      <Text style={styles.subject}>{thread.subject || 'Conversation'}</Text>
      <Text style={styles.meta}>Message count: {thread.messages.length}</Text>
      {latestMessage ? <Text numberOfLines={2}>{latestMessage.body}</Text> : <Text>No messages yet.</Text>}
    </TouchableOpacity>
  );
};

export const MessagingInboxScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { apiClient, user } = useAuth();
  const [threads, setThreads] = useState<SafeMessageThread[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const loadThreads = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      if (!user) {
        setThreads(demoThreads);
      } else {
        const response = await apiClient.messaging.listThreads();
        setThreads(response);
      }
    } catch (err) {
      setError('Unable to sync inbox. Showing cached demo threads.');
      setThreads(demoThreads);
    } finally {
      setLoading(false);
    }
  }, [apiClient, user]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  const openThread = (thread: SafeMessageThread) => {
    navigation.navigate('Thread', { threadId: thread.id, thread });
  };

  if (loading && threads.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <FlatList
      testID="messaging-inbox"
      contentContainerStyle={styles.list}
      data={threads}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ThreadCard thread={item} onPress={openThread} />}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadThreads} />}
      ListEmptyComponent={<Text style={styles.empty}>No conversations yet.</Text>}
      ListHeaderComponent={
        <View style={styles.header}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!user ? (
            <View style={styles.banner}>
              <Text style={styles.subtitle}>Sign in to reply or continue with demo threads.</Text>
              <Button title="Go to login" onPress={() => navigation.navigate('Login' as never)} />
            </View>
          ) : null}
        </View>
      }
    />
  );
};

const styles = StyleSheet.create({
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: brandColors.card,
    padding: 16,
    borderRadius: 12,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },
  subject: {
    fontWeight: '700',
    fontSize: 16,
  },
  meta: {
    color: brandColors.muted,
  },
  empty: {
    textAlign: 'center',
    marginTop: 40,
    color: brandColors.muted,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    color: '#f97316',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  subtitle: {
    color: brandColors.muted,
    textAlign: 'center',
    marginBottom: 12,
  },
  header: {
    gap: 8,
  },
  banner: {
    paddingHorizontal: 16,
  },
});
