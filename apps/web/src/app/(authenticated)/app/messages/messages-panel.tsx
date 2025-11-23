'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

import type { Message } from '@forumo/shared';
import { useCurrentUser, useMessageThreads } from '../../../../lib/react-query/hooks';

export function MessagesPanel() {
  const { user } = useCurrentUser();
  const { data, isLoading, isError, error } = useMessageThreads();
  const [incoming, setIncoming] = useState<Message | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1').replace(/\/api\/v1$/, '');
    const socket: Socket = io(`${base}/messages`, {
      auth: { userId: user.id },
    });
    socket.on('messages:new', (payload: { message: Message }) => {
      setIncoming(payload.message);
    });
    return () => {
      socket.disconnect();
    };
  }, [user?.id]);

  return (
    <div className="space-y-4">
      {incoming ? (
        <div className="rounded-md border border-emerald-400/40 bg-emerald-400/10 p-3 text-sm text-emerald-100">
          New message from {incoming.authorId.slice(0, 6)}… {incoming.body.slice(0, 80)}
        </div>
      ) : null}
      {isLoading ? (
        <p className="text-slate-400" role="status" aria-live="polite">
          Loading threads…
        </p>
      ) : isError ? (
        <div className="grid-card border-red-500/40 text-red-200" role="alert">
          <p className="font-semibold">Unable to load threads.</p>
          <p className="text-sm opacity-80">{(error as Error | undefined)?.message ?? 'Please try again.'}</p>
        </div>
      ) : data && data.data.length > 0 ? (
        <ul className="space-y-3">
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
                  {flagged ? <span className="rounded-full border border-red-400 px-3 py-1 text-xs text-red-200">Flagged</span> : null}
                </div>
                <p className="text-sm text-slate-200">{lastMessage?.body ?? 'No messages yet.'}</p>
                <Link className="text-sm text-amber-300" href={`/app/messages/${thread.id}`}>
                  Open thread →
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-slate-400" role="status" aria-live="polite">
          No threads found.
        </p>
      )}
    </div>
  );
}
