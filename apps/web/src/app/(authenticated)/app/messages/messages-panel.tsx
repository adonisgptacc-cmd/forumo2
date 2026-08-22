"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { io } from "socket.io-client";

import { getGatewayBaseUrl, type SafeMessageThread } from "@forumo/shared";
import {
  useCurrentUser,
  useMessageThreads,
} from "../../../../lib/react-query/hooks";
import { useQueryClient } from "@tanstack/react-query";

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Avatar({
  name,
  avatarUrl,
}: {
  name?: string | null;
  avatarUrl?: string | null;
}) {
  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={name ?? ""}
        width={40}
        height={40}
        unoptimized
        className="h-10 w-10 rounded-full object-cover shrink-0"
      />
    );
  }
  const letter = name?.charAt(0)?.toUpperCase() ?? "?";
  return (
    <div className="h-10 w-10 rounded-full bg-[color:var(--accent-bg)] flex items-center justify-center text-[color:var(--accent-2)] font-semibold text-sm shrink-0">
      {letter}
    </div>
  );
}

function ThreadRow({
  thread,
  userId,
}: {
  thread: SafeMessageThread;
  userId: string;
}) {
  const counterparty = thread.participants.find((p) => p.userId !== userId);
  const lastMsg = thread.messages.at(-1);
  const unreadCount = thread.messages.filter(
    (m) =>
      m.authorId !== userId &&
      !m.receipts.some((r) => r.userId === userId && r.readAt != null),
  ).length;

  return (
    <li>
      <Link
        href={`/app/messages/${thread.id}` as any}
        className="flex items-center gap-3 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-3 hover:border-[color:var(--line-2)] hover:bg-[color:var(--surface-2)] transition-colors"
      >
        <Avatar
          name={counterparty?.user?.name}
          avatarUrl={counterparty?.user?.avatarUrl}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <p
              className={`text-sm font-medium truncate ${unreadCount > 0 ? "text-[color:var(--ink)]" : "text-[color:var(--ink-2)]"}`}
            >
              {counterparty?.user?.name ?? "Unknown user"}
            </p>
            {lastMsg && (
              <time className="text-xs muted shrink-0">
                {formatTimestamp(lastMsg.createdAt)}
              </time>
            )}
          </div>
          {thread.subject && (
            <p className="text-xs muted truncate">{thread.subject}</p>
          )}
          <p
            className={`text-sm truncate mt-0.5 ${unreadCount > 0 ? "text-[color:var(--ink-2)]" : "text-[color:var(--ink-3)]"}`}
          >
            {lastMsg
              ? (lastMsg.authorId === userId ? "You: " : "") + lastMsg.body
              : "No messages yet."}
          </p>
        </div>

        {unreadCount > 0 && (
          <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[color:var(--accent)] px-1 text-[11px] font-bold text-white shrink-0">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Link>
    </li>
  );
}

export function MessagesPanel() {
  const { user, accessToken } = useCurrentUser();
  const { data, isLoading, isError, error } = useMessageThreads();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!accessToken) return;
    const base = getGatewayBaseUrl();
    const socket = io(`${base}/messages`, { auth: { token: accessToken } });
    socket.on("messages:new", () => {
      queryClient.invalidateQueries({ queryKey: ["threads"], exact: false });
    });
    return () => {
      socket.disconnect();
    };
  }, [accessToken, queryClient]);

  if (isLoading) {
    return (
      <p className="muted" role="status" aria-live="polite">
        Loading inbox…
      </p>
    );
  }

  if (isError) {
    return (
      <div
        className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"
        role="alert"
      >
        <p className="font-semibold">Unable to load inbox.</p>
        <p className="text-sm opacity-80 mt-1">
          {(error as Error | undefined)?.message ?? "Please try again."}
        </p>
      </div>
    );
  }

  if (!data?.data.length) {
    return (
      <div className="card py-12 text-center">
        <p className="text-2xl mb-2">💬</p>
        <p className="muted">No conversations yet.</p>
        <p className="text-sm muted mt-1">
          Message a seller from any listing page to get started.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {data.data.map((thread) => (
        <ThreadRow key={thread.id} thread={thread} userId={user?.id ?? ""} />
      ))}
    </ul>
  );
}
