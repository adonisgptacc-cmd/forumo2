"use client";

import { useEffect, useRef, useState } from "react";
import {
  useNotifications,
  useUnreadCount,
  useMarkNotificationRead,
  useMarkAllRead,
} from "../lib/react-query/hooks";
import type { SafeNotification } from "@forumo/shared";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function notificationMessage(n: SafeNotification) {
  const p = n.payload as Record<string, string | number>;
  switch (n.template) {
    case "ORDER_STATUS":
      return `Order ${p.orderNumber} is now ${p.status}`;
    case "NEW_MESSAGE":
      return `New message from ${p.senderName}: "${p.preview}"`;
    case "AUCTION_OUTBID":
      return `You were outbid on ${p.listingTitle}`;
    case "ESCROW_UPDATE":
      return `Escrow for order ${p.orderNumber} is ${p.escrowStatus}`;
    case "REVIEW_RECEIVED":
      return `New ${p.rating}★ review on ${p.listingTitle}`;
    default:
      return n.template;
  }
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: notifications } = useNotifications();
  const { data: unreadData } = useUnreadCount();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllRead();

  const unreadCount = unreadData?.count ?? 0;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center hover:outline outline-1 outline-white p-1"
        aria-label="Notifications"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-7 w-7"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-forumo-orange text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAll.mutate()}
                className="text-xs text-forumo-link hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {!notifications || notifications.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">
                No notifications yet
              </p>
            ) : (
              <ul>
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    onClick={() => {
                      if (!n.readAt) markRead.mutate(n.id);
                    }}
                    className={`px-4 py-3 border-b border-slate-50 last:border-0 cursor-pointer hover:bg-slate-50 flex gap-3 ${!n.readAt ? "bg-blue-50" : ""}`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {!n.readAt && (
                        <span className="inline-block w-2 h-2 rounded-full bg-forumo-orange mt-1.5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 leading-snug">
                        {notificationMessage(n)}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {timeAgo(n.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
