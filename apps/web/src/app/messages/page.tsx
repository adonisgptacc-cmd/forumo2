'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import type { Message } from '@forumo/shared';

import { useCurrentUser, useMessageThreads } from '../../lib/react-query/hooks';
import { MessagingLayer } from '../../lib/messaging-layer';

export default function MessagesPage() {
  return (
    <main className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Messages</p>
        <h1 className="text-3xl font-semibold">Inbox</h1>
        <p className="text-sm text-slate-400">Respond to buyers and sellers in real-time.</p>
      </header>
      <MessagesInbox />
    </main>
  );
}

function MessagesInbox() {
  const { user, accessToken } = useCurrentUser();
  const messaging = useMemo(() => new MessagingLayer(accessToken), [accessToken]);
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch, isFetching } = useMessageThreads(undefined, page);
  const [incoming, setIncoming] = useState<Message | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    const socket = messaging.connect(user.id);
    socket.on('messages:new', (payload: { threadId: string; message: Message }) => {
      setIncoming(payload.message);
      messaging.emitDelivered(socket, payload.message.id);
      refetch();
    });
    return () => socket.disconnect();
  }, [messaging, refetch, user?.id]);

  if (isLoading) {
    return (
      <p className="text-slate-400" role="status" aria-live="polite">
        Loading inbox…
      </p>
    );
  }

  if (isError) {
    return (
      <div className="grid-card border-red-500/40 text-red-100" role="alert">
        <p className="font-semibold">Unable to load conversations.</p>
        <p className="text-sm opacity-80">{(error as Error | undefined)?.message ?? 'Please try again.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {incoming ? (
        <div className="rounded-md border border-emerald-400/40 bg-emerald-400/10 p-3 text-sm text-emerald-100">
          New message from {incoming.authorId.slice(0, 6)}… {incoming.body.slice(0, 80)}
        </div>
      ) : null}
      {data && data.data.length > 0 ? (
        <>
          <ul className="space-y-3" aria-live="polite" aria-busy={isFetching}>
            {data.data.map((thread) => {
              const lastMessage = thread.messages.at(-1);
              const flagged = lastMessage?.moderationStatus === 'FLAGGED' || lastMessage?.metadata?.flagged;
              return (
              <li key={thread.id} className="grid-card space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{thread.subject ?? 'Conversation'}</p>
                    <p className="text-sm text-slate-400">{thread.participants.length} participants</p>
                  </div>
                  {flagged ? <ModerationBadge status="FLAGGED" /> : null}
                </div>
                <p className="text-sm text-slate-200">{lastMessage?.body ?? 'No messages yet.'}</p>
                <Link className="text-sm text-amber-300" href={`/messages/${thread.id}`}>
                  Open thread →
                </Link>
              </li>
            );
          })}
          </ul>
          <div className="flex items-center justify-between text-sm text-slate-500">
            <p>
              Page {data.page} of {data.pageCount || 1}
            </p>
            <div className="flex gap-3">
              <button
                className="rounded border border-slate-700 px-3 py-1 disabled:opacity-50"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={data.page <= 1}
              >
                Previous
              </button>
              <button
                className="rounded border border-slate-700 px-3 py-1 disabled:opacity-50"
                onClick={() => setPage((current) => current + 1)}
                disabled={data.page >= data.pageCount}
              >
                Next
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="grid-card text-slate-300" role="status" aria-live="polite">
          <p className="font-semibold">No threads found.</p>
          <p className="text-sm text-slate-500">Start a conversation from a listing or invite a buyer to chat.</p>
        </div>
      )}
    </div>
  );
}

function ModerationBadge({ status }: { status: string }) {
  if (status === 'FLAGGED') {
    return <span className="rounded-full border border-red-400 px-3 py-1 text-xs text-red-200">Flagged</span>;
  }
  if (status === 'PENDING') {
    return <span className="rounded-full border border-amber-300 px-3 py-1 text-xs text-amber-900 bg-amber-200">Pending</span>;
  }
  return <span className="rounded-full border border-emerald-400 px-3 py-1 text-xs text-emerald-200">Approved</span>;
}

