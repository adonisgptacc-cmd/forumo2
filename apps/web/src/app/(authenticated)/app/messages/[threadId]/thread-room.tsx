'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

import type { Message, MessageAttachment } from '@forumo/shared';
import {
  useCurrentUser,
  useMarkThreadRead,
  useSendMessage,
  useThread,
} from '../../../../../lib/react-query/hooks';

// ─── helpers ────────────────────────────────────────────────────────────────

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/avif',
]);

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

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatDateHeading(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

// ─── attachment renderer ─────────────────────────────────────────────────────

function AttachmentRenderer({ attachment }: { attachment: MessageAttachment }) {
  if (isImageMime(attachment.mimeType)) {
    return (
      <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={attachment.url}
          alt={attachment.fileName}
          className="max-h-48 w-auto rounded-lg border border-[color:var(--line-2)] object-cover"
        />
        <p className="mt-1 text-xs text-[color:var(--ink-3)] truncate">{attachment.fileName}</p>
      </a>
    );
  }
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-lg border border-[color:var(--line-2)] bg-[color:var(--surface-2)]/50 px-3 py-2 text-sm text-[color:var(--accent)] hover:bg-[color:var(--surface-2)]/50"
    >
      <span className="shrink-0 text-lg">📄</span>
      <span className="min-w-0">
        <span className="block truncate font-medium">{attachment.fileName}</span>
        {attachment.fileSize != null && (
          <span className="text-xs text-[color:var(--ink-3)]">{formatBytes(attachment.fileSize)}</span>
        )}
      </span>
      <span className="ml-auto shrink-0 text-xs text-[color:var(--ink-3)]">↓</span>
    </a>
  );
}

// ─── message bubble ──────────────────────────────────────────────────────────

function MessageBubble({
  message,
  senderName,
  isMine,
}: {
  message: Message;
  senderName: string;
  isMine: boolean;
}) {
  const isFlagged =
    message.moderationStatus === 'FLAGGED' ||
    Boolean(message.metadata?.flagged || (message.metadata?.moderationScore as number) > 0.8);

  return (
    <div className={`flex flex-col gap-1 ${isMine ? 'items-end' : 'items-start'}`}>
      <div className={`flex items-end gap-2 max-w-[75%] ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* sender initial */}
        <div
          className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
            isMine ? 'bg-[color:var(--accent-bg)] text-[color:var(--accent)]' : 'bg-[color:var(--surface-2)] text-[color:var(--ink-2)]'
          }`}
        >
          {senderName.charAt(0).toUpperCase()}
        </div>

        {/* bubble */}
        <div
          className={`rounded-2xl px-4 py-2.5 space-y-1 ${
            isMine
              ? 'rounded-br-sm bg-[color:var(--accent-bg)] border border-transparent'
              : 'rounded-bl-sm bg-[color:var(--surface-2)] border border-[color:var(--line)]'
          }`}
        >
          {!isMine && (
            <p className="text-[11px] font-medium text-[color:var(--ink-3)] uppercase tracking-wide">
              {senderName}
            </p>
          )}
          <p className="text-sm text-[color:var(--ink)] whitespace-pre-wrap break-words">{message.body}</p>

          {message.attachments?.length ? (
            <div className="mt-2 space-y-2">
              {message.attachments.map((a) => (
                <AttachmentRenderer key={a.id} attachment={a} />
              ))}
            </div>
          ) : null}

          {isFlagged && (
            <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
              <span>⚠️</span>
              <span>Flagged for review — this message may violate our content policy.</span>
            </p>
          )}
        </div>
      </div>

      <time className={`text-[11px] text-[color:var(--ink-3)] px-9 ${isMine ? 'text-right' : 'text-left'}`}>
        {formatTime(message.createdAt)}
      </time>
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export function ThreadRoom({ threadId }: { threadId: string }) {
  const { user, accessToken } = useCurrentUser();
  const { data, isLoading, refetch } = useThread(threadId);
  const sendMessage = useSendMessage(threadId);
  const { mutate: markRead } = useMarkThreadRead();

  const [body, setBody] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const markedReadRef = useRef(false);

  // scroll to bottom when messages change
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [data?.messages.length]);

  // mark thread as read once when data first loads
  useEffect(() => {
    if (data && !markedReadRef.current) {
      markedReadRef.current = true;
      markRead(threadId);
    }
  }, [data, markRead, threadId]);

  // real-time: single socket, listen for new messages in this thread
  useEffect(() => {
    if (!accessToken) return;
    const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1').replace(
      /\/api\/v1$/,
      '',
    );
    const socket = io(`${base}/messages`, { auth: { token: accessToken } });
    socket.on('messages:new', (payload: { threadId: string }) => {
      if (payload.threadId === threadId) {
        refetch().then(() => {
          // mark newly arrived messages as read
          markRead(threadId);
        });
      }
    });
    return () => {
      socket.disconnect();
    };
  }, [accessToken, markRead, refetch, threadId]);

  // generate object-URL previews for image files
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
      return [...prev, ...files.filter((f) => !existingNames.has(f.name))];
    });
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
  }

  if (isLoading) {
    return <p className="text-[color:var(--ink-3)]">Loading conversation…</p>;
  }
  if (!data) {
    return <p className="text-[color:var(--ink-3)]">Conversation not found.</p>;
  }

  // build a userId → display name lookup from participants
  const nameById: Record<string, string> = {};
  for (const p of data.participants) {
    nameById[p.userId] = p.user?.name ?? p.userId.slice(0, 8);
  }

  // group messages by calendar day for date dividers
  const messagesByDay: Array<{ label: string; messages: typeof data.messages }> = [];
  for (const msg of data.messages) {
    const label = formatDateHeading(msg.createdAt);
    const last = messagesByDay.at(-1);
    if (last && last.label === label) {
      last.messages.push(msg);
    } else {
      messagesByDay.push({ label, messages: [msg] });
    }
  }

  // counterparty info for the header
  const counterparty = data.participants.find((p) => p.userId !== user?.id);
  const counterpartyName = counterparty?.user?.name ?? 'Conversation';

  return (
    <div className="flex flex-col gap-4">
      {/* header */}
      <div className="card card-pad flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-[color:var(--accent-bg)] flex items-center justify-center text-[color:var(--accent)] font-semibold shrink-0">
          {counterpartyName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h1 className="text-base font-semibold truncate">{counterpartyName}</h1>
          {data.subject && (
            <p className="text-xs text-[color:var(--ink-3)] truncate">{data.subject}</p>
          )}
        </div>
      </div>

      {/* message list */}
      <div className="space-y-4">
        {data.messages.length === 0 ? (
          <p className="text-center text-[color:var(--ink-3)] py-8">No messages yet — say hello!</p>
        ) : (
          messagesByDay.map(({ label, messages }) => (
            <div key={label} className="space-y-3">
              {/* date divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-[color:var(--line)]" />
                <span className="text-xs text-[color:var(--ink-3)] px-2">{label}</span>
                <div className="flex-1 h-px bg-[color:var(--line)]" />
              </div>

              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  senderName={nameById[message.authorId] ?? message.authorId.slice(0, 8)}
                  isMine={message.authorId === user?.id}
                />
              ))}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      {/* compose form */}
      <form
        onSubmit={handleSend}
        className="card card-pad space-y-3"
      >
        <textarea
          className="input-forumo w-full resize-none"
          placeholder="Type a message… (Ctrl+Enter to send)"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          rows={3}
        />

        {/* pending file preview strip */}
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {pendingFiles.map((file) => (
              <div
                key={file.name}
                className="relative flex items-center gap-2 rounded-lg border border-[color:var(--line-2)] bg-[color:var(--surface-2)] px-2 py-1.5"
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
                  <p className="max-w-[120px] truncate text-xs text-[color:var(--ink-2)]">{file.name}</p>
                  <p className="text-xs text-[color:var(--ink-3)]">{formatBytes(file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(file.name)}
                  className="ml-1 rounded-full p-0.5 text-[color:var(--ink-3)] hover:bg-[color:var(--surface-2)] hover:text-[color:var(--ink-2)]"
                  aria-label={`Remove ${file.name}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* toolbar */}
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="sr-only"
            aria-label="Attach files"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg p-2 text-[color:var(--ink-3)] hover:bg-[color:var(--surface-2)] hover:text-[color:var(--accent)] transition-colors"
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
            <span className="text-xs text-[color:var(--ink-3)]">
              {pendingFiles.length} file{pendingFiles.length !== 1 ? 's' : ''} attached
            </span>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={sendMessage.isPending || body.trim().length === 0}
          >
            {sendMessage.isPending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
}
