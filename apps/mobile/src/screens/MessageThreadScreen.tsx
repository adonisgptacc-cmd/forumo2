import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { SafeMessageThread } from '@forumo/shared';
import { demoThreads } from '@forumo/config';
import { MainStackParamList } from '../navigation/types';
import { useAuth } from '../providers/AuthProvider';

const MessageBubble: React.FC<{ message: SafeMessageThread['messages'][number]; isOwn: boolean }> = ({
  message,
  isOwn,
}) => (
  <View style={[styles.message, isOwn ? styles.messageOwn : styles.messageOther]} testID={`message-${message.id}`}>
    <Text style={styles.messageAuthor}>{isOwn ? 'You' : 'Partner'}</Text>
    <Text style={styles.messageBody}>{message.body}</Text>
    <Text style={styles.messageMeta}>{new Date(message.createdAt).toLocaleString()}</Text>
  </View>
);

export const MessageThreadScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<MainStackParamList, 'Thread'>>();
  const { apiClient, user } = useAuth();
  const [thread, setThread] = useState<SafeMessageThread | undefined>(route.params.thread);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | undefined>();

  const authorId = user?.id ?? 'guest-user-id';

  const loadThread = useCallback(async () => {
    if (!route.params.threadId) return;
    setLoading(true);
    setError(undefined);
    try {
      if (user) {
        const result = await apiClient.messaging.getThread(route.params.threadId);
        setThread(result);
      } else {
        const fallback = demoThreads.find((t) => t.id === route.params.threadId);
        setThread(fallback);
      }
    } catch (err) {
      setError('Unable to load thread right now. Showing demo content.');
      const fallback = demoThreads.find((t) => t.id === route.params.threadId);
      setThread(fallback);
    } finally {
      setLoading(false);
    }
  }, [apiClient, route.params.threadId, user]);

  useEffect(() => {
    loadThread();
  }, [loadThread]);

  useEffect(() => {
    navigation.setOptions({ title: thread?.subject || 'Conversation' });
  }, [navigation, thread?.subject]);

  const handleSend = async () => {
    if (!thread || !input.trim()) return;
    setSending(true);
    setError(undefined);
    const body = input.trim();

    try {
      if (user) {
        const updated = await apiClient.messaging.sendMessage(thread.id, { authorId, body });
        setThread(updated);
      } else {
        const nextMessage = {
          id: `${Date.now()}`,
          threadId: thread.id,
          authorId,
          body,
          status: 'SENT' as const,
          moderationStatus: 'APPROVED' as const,
          moderationNotes: null,
          metadata: null,
          createdAt: new Date().toISOString(),
          attachments: [],
          receipts: [],
        };
        setThread({ ...thread, messages: [...thread.messages, nextMessage] });
      }
      setInput('');
    } catch (err) {
      setError((err as Error).message);
      Alert.alert('Message failed', 'Your reply was saved locally. Try again when online.');
      const nextMessage = {
        id: `${Date.now()}`,
        threadId: thread.id,
        authorId,
        body,
        status: 'SENT' as const,
        moderationStatus: 'APPROVED' as const,
        moderationNotes: null,
        metadata: null,
        createdAt: new Date().toISOString(),
        attachments: [],
        receipts: [],
      };
      setThread({ ...thread, messages: [...thread.messages, nextMessage] });
    } finally {
      setSending(false);
    }
  };

  const messages = useMemo(() => thread?.messages ?? [], [thread?.messages]);

  if (loading && !thread) {
    return (
      <View style={styles.center} testID="thread-loading">
        <ActivityIndicator />
      </View>
    );
  }

  if (!thread) {
    return (
      <View style={styles.center}>
        <Text>Conversation not found.</Text>
        <Button title="Back to inbox" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}
      keyboardVerticalOffset={80}
      testID="thread-screen">
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        renderItem={({ item }) => <MessageBubble message={item} isOwn={item.authorId === authorId} />}
      />
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Type a reply"
          value={input}
          onChangeText={setInput}
          editable={!sending}
          testID="message-input"
        />
        <Button
          title={sending ? 'Sending...' : 'Send'}
          onPress={handleSend}
          disabled={sending || !input.trim()}
          testID="send-message-button"
        />
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageList: {
    padding: 16,
    gap: 12,
  },
  message: {
    padding: 12,
    borderRadius: 12,
    maxWidth: '85%',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  messageOwn: {
    alignSelf: 'flex-end',
    backgroundColor: '#dbeafe',
  },
  messageOther: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
  },
  messageAuthor: {
    fontWeight: '700',
    marginBottom: 4,
  },
  messageBody: {
    fontSize: 16,
    marginBottom: 6,
  },
  messageMeta: {
    fontSize: 12,
    color: '#6b7280',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  error: {
    color: '#ef4444',
    padding: 12,
    textAlign: 'center',
  },
});
