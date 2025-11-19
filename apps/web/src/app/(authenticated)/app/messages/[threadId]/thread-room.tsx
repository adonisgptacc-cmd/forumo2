'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

import type { Message } from '@forumo/shared';
import { useCurrentUser, useSendMessage, useThread } from '../../../../../lib/react-query/hooks';

export function ThreadRoom({ threadId }: { threadId: string }) {
  const { user } = useCurrentUser();
  const { data, isLoading, refetch } = useThread(threadId);
  const sendMessage = useSendMessage(threadId);
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [data?.messages.length]);

  useEffect(() => {
    if (!user?.id) return;
    const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1').replace(/\/api\/v1$/, '');
    const socket: Socket = io(`${base}/messages`, { auth: { userId: user.id } });
    socket.on('messages:new', (payload: { threadId: string }) => {
      if (payload.threadId === threadId) {
        refetch();
      }
    });
    return () => {
      socket.disconnect();
    };
  }, [refetch, threadId, user?.id]);

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
          <div key={message.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{message.authorId === user?.id ? 'You' : message.authorId.slice(0, 6)}</span>
              <span>{new Date(message.createdAt).toLocaleString()}</span>
            </div>
            <p className="mt-2 text-sm text-slate-100">{message.body}</p>
            {message.attachments?.length ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {message.attachments.map((attachment) => (
                  <div key={attachment.id} className="rounded-lg border border-slate-800 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={attachment.url} alt={attachment.fileName} className="h-40 w-full rounded-md object-cover" />
                  </div>
                ))}
              </div>
            ) : null}
            {isFlagged(message) ? (
              <p className="mt-2 text-xs text-red-300">Moderation flag triggered. Review before replying.</p>
            ) : null}
          </div>
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
        <input type="file" accept="image/*" multiple onChange={(event) => setAttachments(event.target.files ? Array.from(event.target.files) : [])} />
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

function isFlagged(message: Message) {
  return message.moderationStatus === 'FLAGGED' || Boolean(message.metadata?.flagged || message.metadata?.moderationScore > 0.8);
}
