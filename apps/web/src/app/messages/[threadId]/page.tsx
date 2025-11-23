'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { Message } from '@forumo/shared';

import { useCurrentUser, useSendMessage, useThread } from '../../../lib/react-query/hooks';
import { MessagingLayer } from '../../../lib/messaging-layer';

export default function ThreadPage({ params }: { params: { threadId: string } }) {
  return (
    <main className="space-y-6">
      <ThreadRoom threadId={params.threadId} />
    </main>
  );
}

function ThreadRoom({ threadId }: { threadId: string }) {
  const { user, accessToken } = useCurrentUser();
  const messaging = useMemo(() => new MessagingLayer(accessToken), [accessToken]);
  const { data, isLoading, refetch } = useThread(threadId);
  const sendMessage = useSendMessage(threadId);
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<ReturnType<MessagingLayer['connect']> | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [data?.messages.length]);

  useEffect(() => {
    if (!user?.id) return;
    const socket = messaging.connect(user.id);
    socketRef.current = socket;
    socket.on('messages:new', (payload: { threadId: string; message: Message }) => {
      if (payload.threadId === threadId) {
        messaging.emitDelivered(socket, payload.message.id);
        refetch();
      }
    });
    return () => socket.disconnect();
  }, [messaging, refetch, threadId, user?.id]);

  useEffect(() => {
    if (!data || !user?.id) return;
    data.messages
      .filter((message) => message.authorId !== user.id)
      .forEach((message) => {
        messaging.emitRead(socketRef.current, message.id);
      });
  }, [data, messaging, user?.id]);

  if (isLoading) {
    return <p className="text-slate-400">Loading thread…</p>;
  }

  if (!data) {
    return <p className="text-slate-400">Thread not found.</p>;
  }

  async function handleSend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user?.id || body.trim().length === 0) return;
    await sendMessage.mutateAsync({
      payload: { authorId: user.id, body: body.trim() },
      attachments,
    });
    setBody('');
    setAttachments([]);
    await refetch();
  }

  return (
    <div className="space-y-4">
      <div className="grid-card space-y-1">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Thread</p>
        <h1 className="text-2xl font-semibold">{data.subject ?? 'Conversation'}</h1>
        <p className="text-sm text-slate-400">{data.participants.length} participants</p>
      </div>
      <div className="space-y-3">
        {data.messages.map((message) => (
          <article key={message.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span>{message.authorId === user?.id ? 'You' : message.authorId.slice(0, 6)}</span>
                <ModerationBadge status={message.moderationStatus} />
              </div>
              <span>{new Date(message.createdAt).toLocaleString()}</span>
            </div>
            <p className="mt-2 text-sm text-slate-100">{message.body}</p>
            {message.attachments?.length ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {message.attachments.map((attachment) => (
                  <div key={attachment.id} className="rounded-lg border border-slate-800 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={attachment.url} alt={attachment.fileName} className="h-40 w-full rounded-md object-cover" />
                    <p className="mt-2 truncate text-xs text-slate-400">{attachment.fileName}</p>
                  </div>
                ))}
              </div>
            ) : null}
            {isFlagged(message) ? (
              <p className="mt-2 text-xs text-red-300">Moderation flag triggered. Review before replying.</p>
            ) : null}
          </article>
        ))}
        <div ref={endRef} />
      </div>
      <form onSubmit={handleSend} className="space-y-2 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
        <textarea
          className="input"
          placeholder="Type a message"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={3}
        />
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => setAttachments(event.target.files ? Array.from(event.target.files) : [])}
        />
        <button
          type="submit"
          className="rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-300"
          disabled={sendMessage.isPending}
        >
          {sendMessage.isPending ? 'Sending…' : 'Send message'}
        </button>
      </form>
    </div>
  );
}

function ModerationBadge({ status }: { status: string }) {
  if (status === 'FLAGGED') {
    return <span className="rounded-full border border-red-400 px-2 py-0.5 text-[10px] uppercase text-red-200">Flagged</span>;
  }
  if (status === 'PENDING') {
    return <span className="rounded-full border border-amber-200 px-2 py-0.5 text-[10px] uppercase text-amber-900 bg-amber-200">Pending</span>;
  }
  return <span className="rounded-full border border-emerald-200 px-2 py-0.5 text-[10px] uppercase text-emerald-200">Approved</span>;
}

function isFlagged(message: Message) {
  return message.moderationStatus === 'FLAGGED' || Boolean(message.metadata?.flagged || message.metadata?.moderationScore > 0.8);
}

