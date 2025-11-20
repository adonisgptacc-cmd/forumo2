import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeMessageThread } from '@forumo/shared';
import { useAuth } from '../providers/AuthProvider';

const ThreadCard: React.FC<{ thread: SafeMessageThread }> = ({ thread }) => {
  const latestMessage = thread.messages?.[thread.messages.length - 1];
  return (
    <View style={styles.card}>
      <Text style={styles.subject}>{thread.subject || 'Conversation'}</Text>
      <Text style={styles.meta}>Participants: {thread.participants.map((p) => p.name || p.id).join(', ')}</Text>
      {latestMessage ? <Text numberOfLines={2}>{latestMessage.body}</Text> : <Text>No messages yet.</Text>}
    </View>
  );
};

export const MessagingInboxScreen: React.FC = () => {
  const { apiClient } = useAuth();
  const [threads, setThreads] = useState<SafeMessageThread[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadThreads = async () => {
      setLoading(true);
      const response = await apiClient.messaging.listThreads();
      setThreads(response);
      setLoading(false);
    };

    loadThreads();
  }, [apiClient]);

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
      renderItem={({ item }) => <ThreadCard thread={item} />}
      ListEmptyComponent={<Text style={styles.empty}>No conversations yet.</Text>}
    />
  );
};

const styles = StyleSheet.create({
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#fff',
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
    color: '#6b7280',
  },
  empty: {
    textAlign: 'center',
    marginTop: 40,
    color: '#6b7280',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
