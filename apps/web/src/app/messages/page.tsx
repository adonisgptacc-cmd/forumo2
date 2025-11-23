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
  const { data, isLoading, refetch } = useMessageThreads();
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
    return <p className="text-slate-400">Loading inbox…</p>;
  }

  return (
    <div className="space-y-4">
      {incoming ? (
        <div className="rounded-md border border-emerald-400/40 bg-emerald-400/10 p-3 text-sm text-emerald-100">
          New message from {incoming.authorId.slice(0, 6)}… {incoming.body.slice(0, 80)}
        </div>
      ) : null}
      {data && data.length > 0 ? (
        <ul className="space-y-3">
          {data.map((thread) => {
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
      ) : (
        <p className="text-slate-400">No threads found.</p>
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

