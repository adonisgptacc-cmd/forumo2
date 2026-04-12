'use client';

import { useNotifications, useMarkNotificationRead, useMarkAllRead, useUnreadCount } from '../../../../lib/react-query/hooks';
import type { SafeNotification } from '@forumo/shared';

const TEMPLATE_LABELS: Record<string, string> = {
  ORDER_PLACED: 'Order Placed',
  ORDER_STATUS_CHANGED: 'Order Update',
  PAYMENT_RECEIVED: 'Payment Received',
  OFFER_RECEIVED: 'New Offer',
  OFFER_ACCEPTED: 'Offer Accepted',
  OFFER_DECLINED: 'Offer Declined',
  MESSAGE_RECEIVED: 'New Message',
  KYC_STATUS_CHANGED: 'Verification Update',
  LISTING_PUBLISHED: 'Listing Published',
  LISTING_MODERATED: 'Listing Moderated',
  AUCTION_OUTBID: 'You Were Outbid',
  ESCROW_UPDATE: 'Escrow Update',
  REVIEW_RECEIVED: 'New Review',
};

const TEMPLATE_ICONS: Record<string, string> = {
  ORDER_PLACED: '📦',
  ORDER_STATUS_CHANGED: '🔄',
  PAYMENT_RECEIVED: '💰',
  OFFER_RECEIVED: '🤝',
  OFFER_ACCEPTED: '✅',
  OFFER_DECLINED: '❌',
  MESSAGE_RECEIVED: '💬',
  KYC_STATUS_CHANGED: '🪪',
  LISTING_PUBLISHED: '🏷️',
  LISTING_MODERATED: '🚩',
  AUCTION_OUTBID: '🔔',
  ESCROW_UPDATE: '🔒',
  REVIEW_RECEIVED: '⭐',
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function NotificationItem({ notification, onRead }: { notification: SafeNotification; onRead: (id: string) => void }) {
  const isUnread = !notification.readAt;
  const label = TEMPLATE_LABELS[notification.template] ?? notification.template;
  const icon = TEMPLATE_ICONS[notification.template] ?? '🔔';
  const payload = notification.payload as Record<string, unknown>;

  // Build a human-readable body from the payload
  const body = payload.message
    ? String(payload.message)
    : payload.orderId
    ? `Order #${String(payload.orderId).slice(0, 8)}`
    : payload.listingTitle
    ? String(payload.listingTitle)
    : null;

  return (
    <li
      className={`flex items-start gap-4 p-4 rounded-xl border transition-colors cursor-pointer ${
        isUnread
          ? 'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10'
          : 'border-slate-800 bg-slate-900/40 hover:bg-slate-900/70'
      }`}
      onClick={() => isUnread && onRead(notification.id)}
    >
      <span className="text-2xl flex-shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-sm font-medium ${isUnread ? 'text-white' : 'text-slate-300'}`}>{label}</p>
          <span className="text-xs text-slate-500 flex-shrink-0">{timeAgo(notification.createdAt)}</span>
        </div>
        {body && <p className="text-xs text-slate-400 mt-0.5 truncate">{body}</p>}
        {isUnread && (
          <span className="inline-block mt-1.5 w-2 h-2 rounded-full bg-amber-400" />
        )}
      </div>
    </li>
  );
}

export function NotificationsView() {
  const { data: notifications, isLoading } = useNotifications();
  const { data: unread } = useUnreadCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllRead();

  const unreadCount = unread?.count ?? 0;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-slate-800 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!notifications || notifications.length === 0) {
    return (
      <div className="py-20 text-center border border-dashed border-slate-800 rounded-2xl">
        <p className="text-4xl mb-3">🔔</p>
        <p className="text-slate-400 font-medium">No notifications yet</p>
        <p className="text-sm text-slate-500 mt-1">We'll notify you about orders, offers, messages and more.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          {unreadCount > 0 ? (
            <span className="font-medium text-amber-400">{unreadCount} unread</span>
          ) : (
            'All caught up'
          )}
          {' '}· {notifications.length} total
        </p>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="text-xs text-amber-400 hover:text-amber-300 disabled:opacity-50 transition-colors"
          >
            {markAllRead.isPending ? 'Marking…' : 'Mark all as read'}
          </button>
        )}
      </div>

      {/* List */}
      <ul className="space-y-2">
        {notifications.map((n) => (
          <NotificationItem
            key={n.id}
            notification={n}
            onRead={(id) => markRead.mutate(id)}
          />
        ))}
      </ul>
    </div>
  );
}
