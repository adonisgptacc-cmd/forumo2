'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';

import type { Message, MessageAttachment } from '@forumo/shared';
import { useCurrentUser, useSendMessage, useThread } from '../../../../../lib/react-query/hooks';

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/avif']);

function isImageMime(mimeType: string | null | undefined): boolean {
  if (!mimeType) return false;
  return IMAGE_MIME_TYPES.has(mimeType) || mimeType.startsWith('image/');
}

function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || bytes === 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentRenderer({ attachment }: { attachment: MessageAttachment }) {
  if (isImageMime(attachment.mimeType)) {
    return (
      <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={attachment.url}
          alt={attachment.fileName}
          className="max-h-48 w-auto rounded-lg border border-slate-700 object-cover"
        />
        <p className="mt-1 text-xs text-slate-500 truncate">{attachment.fileName}</p>
      </a>
    );
  }
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-amber-400 hover:bg-slate-700/50"
    >
      <span className="shrink-0 text-lg">📄</span>
      <span className="min-w-0">
        <span className="block truncate font-medium">{attachment.fileName}</span>
        {attachment.fileSize != null && (
          <span className="text-xs text-slate-500">{formatBytes(attachment.fileSize)}</span>
        )}
      </span>
      <span className="ml-auto shrink-0 text-xs text-slate-500">↓</span>
    </a>
  );
}

export function ThreadRoom({ threadId }: { threadId: string }) {
  const { user } = useCurrentUser();
  const { data, isLoading, refetch } = useThread(threadId);
  const sendMessage = useSendMessage(threadId);
  const [body, setBody] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    if (!user?.id || !data?.messages.length) return;
    const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1').replace(/\/api\/v1$/, '');
    const socket: Socket = io(`${base}/messages`, { auth: { userId: user.id } });
    const unread = data.messages.filter(
      (m) => m.authorId !== user.id && !m.receipts.some((r) => r.userId === user.id && r.readAt != null),
    );
    for (const msg of unread) {
      socket.emit('messages:read', { messageId: msg.id });
    }
    socket.disconnect();
  }, [data?.messages, user?.id]);

  // Generate object-URL previews for image files so we can show thumbnails
  useEffect(() => {
    const newPreviews: Record<string, string> = {};
    for (const file of pendingFiles) {
      if (isImageMime(file.type) && !(file.name in filePreviews)) {
        newPreviews[file.name] = URL.createObjectURL(file);
      }
    }
    if (Object.keys(newPreviews).length > 0) {
      setFilePreviews((prev) => ({ ...prev, ...newPreviews }));
    }
    return () => {
      Object.values(newPreviews).forEach(URL.revokeObjectURL);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFiles]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length === 0) return;
    setPendingFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      const next = [...prev, ...files.filter((f) => !existingNames.has(f.name))];
      return next;
    });
    // Reset input so the same file can be re-added after removal
    event.target.value = '';
  }, []);

  const removeFile = useCallback((fileName: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.name !== fileName));
    setFilePreviews((prev) => {
      const next = { ...prev };
      const url = next[fileName];
      if (url) URL.revokeObjectURL(url);
      delete next[fileName];
      return next;
    });
  }, []);

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
      attachments: pendingFiles,
    });
    setBody('');
    setPendingFiles([]);
    setFilePreviews((prev) => {
      Object.values(prev).forEach(URL.revokeObjectURL);
      return {};
    });
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
          <div
            key={message.id}
            className={`rounded-2xl border p-4 ${
              message.authorId === user?.id
                ? 'border-amber-800/30 bg-amber-900/10 ml-8'
                : 'border-slate-800 bg-slate-950/60 mr-8'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-medium">
                {message.authorId === user?.id ? 'You' : message.authorId.slice(0, 8)}
              </span>
              <span>{new Date(message.createdAt).toLocaleString()}</span>
            </div>
            <p className="mt-2 text-sm text-slate-100 whitespace-pre-wrap">{message.body}</p>
            {message.attachments?.length ? (
              <div className="mt-3 space-y-2">
                {message.attachments.map((attachment) => (
                  <AttachmentRenderer key={attachment.id} attachment={attachment} />
                ))}
              </div>
            ) : null}
            {isFlagged(message) ? (
              <p className="mt-2 flex items-center gap-1 text-xs text-red-300">
                <span>⚠️</span>
                <span>Flagged for review. This message may violate our content policy.</span>
              </p>
            ) : null}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form onSubmit={handleSend} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
        <textarea
          className="input w-full resize-none"
          placeholder="Type a message…"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          rows={3}
        />

        {/* Pending file preview strip */}
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {pendingFiles.map((file) => (
              <div
                key={file.name}
                className="relative flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5"
              >
                {isImageMime(file.type) && filePreviews[file.name] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={filePreviews[file.name]}
                    alt={file.name}
                    className="h-10 w-10 rounded object-cover"
                  />
                ) : (
                  <span className="text-xl">📄</span>
                )}
                <div className="min-w-0">
                  <p className="max-w-[120px] truncate text-xs text-slate-200">{file.name}</p>
                  <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(file.name)}
                  className="ml-1 rounded-full p-0.5 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                  aria-label={`Remove ${file.name}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Toolbar row */}
        <div className="flex items-center gap-2">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="sr-only"
            aria-label="Attach files"
            onChange={handleFileChange}
          />
          {/* Paperclip button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-amber-400 transition-colors"
            title="Attach files"
            aria-label="Attach files"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path
                fillRule="evenodd"
                d="M15.621 4.379a3 3 0 0 0-4.242 0l-7 7a1.5 1.5 0 0 0 2.122 2.121L13.243 7.5a.75.75 0 0 1 1.06 1.061l-6.742 6.742a3 3 0 0 1-4.243-4.242l7-7a4.5 4.5 0 0 1 6.364 6.364l-7 7a6 6 0 0 1-8.485-8.485l7-7a.75.75 0 0 1 1.06 1.06l-7 7a4.5 4.5 0 0 0 6.364 6.364l7-7a3 3 0 0 0 0-4.243Z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          <span className="flex-1" />

          {pendingFiles.length > 0 && (
            <span className="text-xs text-slate-500">
              {pendingFiles.length} file{pendingFiles.length !== 1 ? 's' : ''} attached
            </span>
          )}

          <button
            type="submit"
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50"
            disabled={sendMessage.isPending || body.trim().length === 0}
          >
            {sendMessage.isPending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
}

function isFlagged(message: Message) {
  return message.moderationStatus === 'FLAGGED' || Boolean(message.metadata?.flagged || message.metadata?.moderationScore > 0.8);
}
