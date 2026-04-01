import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SafeNotification } from '@forumo/shared';
import { brandColors, spacing } from '@forumo/config';
import { useAuth } from '../providers/AuthProvider';
import type { MainStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'Notifications'>;

const DEMO_NOTIFICATIONS: SafeNotification[] = [
  {
    id: 'notif-1',
    userId: 'demo',
    channel: 'IN_APP',
    template: 'AUCTION_OUTBID',
    payload: { message: 'You have been outbid on Vintage Camera. Current bid: $95.00' },
    status: 'SENT',
    sentAt: new Date(Date.now() - 600000).toISOString(),
    readAt: null,
    createdAt: new Date(Date.now() - 600000).toISOString(),
  },
  {
    id: 'notif-2',
    userId: 'demo',
    channel: 'IN_APP',
    template: 'ORDER_STATUS',
    payload: { message: 'Your order #ORD-001 has been shipped.' },
    status: 'SENT',
    sentAt: new Date(Date.now() - 3600000).toISOString(),
    readAt: new Date(Date.now() - 1800000).toISOString(),
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'notif-3',
    userId: 'demo',
    channel: 'IN_APP',
    template: 'NEW_MESSAGE',
    payload: { message: 'Alice sent you a message about your listing.' },
    status: 'SENT',
    sentAt: new Date(Date.now() - 7200000).toISOString(),
    readAt: null,
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
];

const TEMPLATE_ICONS: Record<string, string> = {
  ORDER_STATUS: '📦',
  NEW_MESSAGE: '💬',
  AUCTION_OUTBID: '⚡',
  ESCROW_UPDATE: '🔒',
  REVIEW_RECEIVED: '⭐',
};

function formatTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface NotifCardProps {
  notif: SafeNotification;
  onRead: (id: string) => void;
}

const NotifCard: React.FC<NotifCardProps> = ({ notif, onRead }) => {
  const isUnread = !notif.readAt;
  const icon = TEMPLATE_ICONS[notif.template] ?? '🔔';
  const message =
    typeof notif.payload?.message === 'string'
      ? notif.payload.message
      : notif.template;

  return (
    <TouchableOpacity
      style={[styles.card, isUnread && styles.cardUnread]}
      onPress={() => { if (isUnread) onRead(notif.id); }}
      testID={`notif-card-${notif.id}`}
      activeOpacity={isUnread ? 0.7 : 1}
    >
      <View style={styles.iconBox}>
        <Text style={styles.icon}>{icon}</Text>
        {isUnread && <View style={styles.unreadDot} />}
      </View>
      <View style={styles.content}>
        <Text style={[styles.message, isUnread && styles.messageUnread]} numberOfLines={3}>
          {message}
        </Text>
        <Text style={styles.time}>
          {notif.sentAt ? formatTime(notif.sentAt) : formatTime(notif.createdAt)}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

export const NotificationsScreen: React.FC<Props> = () => {
  const { apiClient, accessToken } = useAuth();
  const [notifications, setNotifications] = useState<SafeNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiClient.notifications.list();
      setNotifications(Array.isArray(data) ? data : []);
    } catch {
      setNotifications(DEMO_NOTIFICATIONS);
    }
  }, [apiClient]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, []);

  // Real-time notifications via Socket.IO WebSocket
  useEffect(() => {
    try {
      const baseUrl = (apiClient as any).baseUrl as string;
      const wsUrl = baseUrl.replace(/^http/, 'ws').replace(/^https/, 'wss');
      const token = accessToken;
      const query = token ? `token=${token}` : '';
      const ws = new WebSocket(
        `${wsUrl}/socket.io/?EIO=4&transport=websocket&${query}&namespace=/notifications`
      );
      socketRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const raw = String(event.data);
          const jsonStart = raw.search(/[\[{]/);
          if (jsonStart === -1) return;
          const payload = JSON.parse(raw.slice(jsonStart));
          if (!Array.isArray(payload)) return;
          const [eventName, data] = payload;
          if (eventName === 'notification' && data) {
            setNotifications((prev) => [data as SafeNotification, ...prev]);
          }
        } catch {
          // ignore
        }
      };
    } catch {
      // WebSocket not available in all envs
    }

    return () => {
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [accessToken]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleRead = async (id: string) => {
    try {
      await apiClient.notifications.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
      );
    } catch {
      // optimistic update already applied
    }
  };

  const handleMarkAll = async () => {
    setMarkingAll(true);
    try {
      await apiClient.notifications.markAllAsRead();
      const now = new Date().toISOString();
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? now })));
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not mark all as read.');
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <View style={styles.container} testID="notifications-screen">
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.heading}>Notifications</Text>
          {unreadCount > 0 && (
            <Text style={styles.unreadCount}>{unreadCount} unread</Text>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity
            onPress={handleMarkAll}
            disabled={markingAll}
            testID="mark-all-read-btn"
          >
            {markingAll ? (
              <ActivityIndicator size="small" color={brandColors.primary} />
            ) : (
              <Text style={styles.markAllText}>Mark all read</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={brandColors.primary} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NotifCard notif={item} onRead={handleRead} />
          )}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyText}>No notifications yet.</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brandColors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.md,
    paddingBottom: 8,
  },
  heading: { fontSize: 22, fontWeight: '700' },
  unreadCount: { fontSize: 13, color: brandColors.primary, marginTop: 2 },
  markAllText: { color: brandColors.primary, fontWeight: '600', fontSize: 14 },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: 8 },
  card: {
    backgroundColor: brandColors.card,
    borderRadius: 12,
    padding: spacing.md,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: brandColors.primary },
  iconBox: { position: 'relative' },
  icon: { fontSize: 24 },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: brandColors.primary,
  },
  content: { flex: 1, gap: 4 },
  message: { fontSize: 14, color: '#374151', lineHeight: 20 },
  messageUnread: { fontWeight: '600', color: '#111827' },
  time: { fontSize: 12, color: brandColors.muted },
  emptyBox: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: brandColors.muted, fontSize: 16 },
});
