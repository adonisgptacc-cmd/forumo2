'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import {
  useOrder,
  useDisputeDetails,
  useAddDisputeMessage,
  useResolveDispute,
  useCurrentUser,
} from '../../../../../lib/react-query/hooks';

// ── Local types matching the backend's getEscrowByOrderId response ──────────

type DisputeAuthor = { id: string; email: string; name: string | null };

type DisputeMessage = {
  id: string;
  disputeId: string;
  authorId: string;
  body: string;
  attachments: unknown;
  createdAt: string;
  author: DisputeAuthor;
};

type EscrowDispute = {
  id: string;
  escrowId: string;
  status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'ESCALATED';
  openedById: string;
  reason: string;
  resolution: string | null;
  openedAt: string;
  resolvedAt: string | null;
  openedBy: DisputeAuthor;
  messages: DisputeMessage[];
};

type EscrowTransaction = {
  id: string;
  type: string;
  amountCents: number;
  currency: string;
  note: string | null;
  createdAt: string;
  actor: DisputeAuthor;
};

type EscrowWithDisputes = {
  id: string;
  orderId: string;
  status: string;
  amountCents: number;
  currency: string;
  releaseAfter: string | null;
  releasedAt: string | null;
  disputes: EscrowDispute[];
  transactions: EscrowTransaction[];
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmt(cents: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}

function parseAttachments(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((u) => typeof u === 'string');
  if (typeof raw === 'object') return Object.values(raw as Record<string, string>).filter((u) => typeof u === 'string');
  return [];
}

function isImage(url: string) {
  return /\.(jpe?g|png|gif|webp|svg|avif)(\?|$)/i.test(url);
}

const DISPUTE_STATUS_BADGE: Record<string, string> = {
  OPEN: 'border-red-700 text-red-400 bg-red-950/20',
  UNDER_REVIEW: 'border-amber-700 text-amber-400 bg-amber-950/20',
  RESOLVED: 'border-emerald-700 text-emerald-400 bg-emerald-950/20',
  ESCALATED: 'border-orange-700 text-orange-400 bg-orange-950/20',
};

// ── Sub-components ───────────────────────────────────────────────────────────

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <img
        src={src}
        alt="Attachment"
        className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        className="absolute right-6 top-6 rounded-full bg-slate-800 px-3 py-1 text-sm text-white hover:bg-slate-700"
        onClick={onClose}
      >
        ✕ Close
      </button>
    </div>
  );
}

function ResolveModal({
  dispute,
  orderId,
  onClose,
}: {
  dispute: EscrowDispute;
  orderId: string;
  onClose: () => void;
}) {
  const resolve = useResolveDispute();
  const [resolution, setResolution] = useState('');
  const [releaseToParty, setReleaseToParty] = useState<'seller' | 'buyer'>('seller');

  const action = releaseToParty === 'seller' ? 'RELEASE' : 'REFUND';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!resolution.trim()) return;
    await resolve.mutateAsync({ disputeId: dispute.id, orderId, resolution, action });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-950 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Resolve Dispute</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            ✕
          </button>
        </div>

        <p className="mb-4 text-sm text-slate-400">
          Reason: <span className="text-slate-200">{dispute.reason}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">
              Resolution notes <span className="text-red-400">*</span>
            </label>
            <textarea
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              rows={3}
              required
              placeholder="Explain the resolution decision…"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-slate-400">Release funds to</legend>
            {(['seller', 'buyer'] as const).map((party) => (
              <label key={party} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-800 p-3 hover:border-slate-600">
                <input
                  type="radio"
                  name="releaseToParty"
                  value={party}
                  checked={releaseToParty === party}
                  onChange={() => setReleaseToParty(party)}
                  className="accent-amber-500"
                />
                <span className="text-sm capitalize text-slate-200">{party}</span>
                <span className="ml-auto text-xs text-slate-500">
                  {party === 'seller' ? 'RELEASE escrow' : 'REFUND to buyer'}
                </span>
              </label>
            ))}
          </fieldset>

          {resolve.isError && (
            <p className="text-xs text-red-400">
              {(resolve.error as Error)?.message ?? 'Failed to resolve dispute'}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={!resolution.trim() || resolve.isPending}
              className="flex-1 rounded-lg bg-amber-500 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50"
            >
              {resolve.isPending ? 'Resolving…' : 'Confirm resolution'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function DisputeDetail({ orderId }: { orderId: string }) {
  const { user } = useCurrentUser();
  const { data: order, isLoading: orderLoading } = useOrder(orderId);
  const { data: escrowRaw, isLoading: escrowLoading } = useDisputeDetails(orderId);
  const addMessage = useAddDisputeMessage();

  const [msgText, setMsgText] = useState('');
  const [attachUrls, setAttachUrls] = useState<string[]>([]);
  const [attachInput, setAttachInput] = useState('');
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const escrow = escrowRaw as EscrowWithDisputes | undefined;
  const dispute = escrow?.disputes?.[0];
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MODERATOR';
  const canResolve = isAdmin && dispute && dispute.status !== 'RESOLVED';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dispute?.messages?.length]);

  async function sendMessage() {
    if (!dispute || !msgText.trim()) return;
    await addMessage.mutateAsync({
      disputeId: dispute.id,
      orderId,
      body: msgText.trim(),
      attachments: attachUrls.length > 0 ? attachUrls : undefined,
    });
    setMsgText('');
    setAttachUrls([]);
  }

  function addAttachUrl() {
    const url = attachInput.trim();
    if (url && !attachUrls.includes(url)) {
      setAttachUrls((prev) => [...prev, url]);
    }
    setAttachInput('');
  }

  if (orderLoading || escrowLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2].map((i) => (
          <div key={i} className="h-40 rounded-xl bg-slate-800" />
        ))}
      </div>
    );
  }

  if (!order || !escrow) {
    return (
      <div className="rounded-xl border border-red-800 bg-red-900/20 p-6 text-center">
        <p className="text-red-400">Dispute not found or no escrow for this order.</p>
        <Link href={'/app/disputes' as any} className="mt-3 inline-block text-sm text-amber-400 hover:underline">
          ← Back to disputes
        </Link>
      </div>
    );
  }

  if (!dispute) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-center">
        <p className="text-slate-400">No active dispute found for this order.</p>
        <Link href={'/app/disputes' as any} className="mt-3 inline-block text-sm text-amber-400 hover:underline">
          ← Back to disputes
        </Link>
      </div>
    );
  }

  const allAttachments = dispute.messages.flatMap((m) => parseAttachments(m.attachments));
  const badgeCls = DISPUTE_STATUS_BADGE[dispute.status] ?? 'border-slate-700 text-slate-400';
  const disputeResolved = dispute.status === 'RESOLVED';

  return (
    <>
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
      {showResolveModal && canResolve && (
        <ResolveModal
          dispute={dispute}
          orderId={orderId}
          onClose={() => setShowResolveModal(false)}
        />
      )}

      {/* Page header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={'/app/disputes' as any} className="text-xs text-slate-500 hover:text-slate-300">
            ← Disputes
          </Link>
          <h2 className="mt-1 text-xl font-semibold">
            Dispute — Order {order.orderNumber}
          </h2>
          <p className="mt-0.5 text-sm text-slate-400">
            Opened {new Date(dispute.openedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-full border px-4 py-1 text-xs font-medium ${badgeCls}`}>
            {dispute.status.replace('_', ' ')}
          </span>
          {canResolve && (
            <button
              onClick={() => setShowResolveModal(true)}
              className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-semibold text-black hover:bg-amber-400"
            >
              Resolve dispute
            </button>
          )}
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">

        {/* ── LEFT: Chat thread ──────────────────────────────────────────── */}
        <div className="flex min-h-[480px] flex-1 flex-col rounded-xl border border-slate-800 bg-slate-950/60">
          {/* Reason banner */}
          <div className="border-b border-slate-800 px-5 py-3">
            <p className="text-xs text-slate-500">
              Dispute reason:{' '}
              <span className="font-medium text-slate-200">{dispute.reason}</span>
            </p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3" style={{ maxHeight: '480px' }}>
            {dispute.messages.length === 0 && (
              <p className="text-center text-sm text-slate-500 py-8">
                No messages yet. Start the conversation below.
              </p>
            )}

            {dispute.messages.map((msg) => {
              const isMe = msg.authorId === user?.id;
              const attachments = parseAttachments(msg.attachments);
              const roleLabel =
                msg.authorId === order.buyerId
                  ? 'Buyer'
                  : msg.authorId === order.sellerId
                    ? 'Seller'
                    : 'Admin';

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <span className="text-xs text-slate-500">
                    {isMe ? 'You' : msg.author.name ?? msg.author.email} · {roleLabel} ·{' '}
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                      isMe
                        ? 'rounded-tr-sm bg-amber-500/20 text-amber-50'
                        : 'rounded-tl-sm bg-slate-800 text-slate-100'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                    {attachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {attachments.map((url, i) =>
                          isImage(url) ? (
                            <button
                              key={i}
                              onClick={() => setLightboxSrc(url)}
                              className="overflow-hidden rounded-lg border border-slate-700 hover:opacity-80"
                            >
                              <img
                                src={url}
                                alt={`Attachment ${i + 1}`}
                                className="h-24 w-24 object-cover"
                              />
                            </button>
                          ) : (
                            <a
                              key={i}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-amber-400 hover:border-amber-600"
                            >
                              📎 Attachment {i + 1}
                            </a>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Send form */}
          {!disputeResolved && (
            <div className="border-t border-slate-800 p-4 space-y-2">
              {/* Queued attachments */}
              {attachUrls.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {attachUrls.map((url, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 px-3 py-0.5 text-xs text-slate-300"
                    >
                      📎 {url.split('/').pop()?.slice(0, 20) ?? 'File'}
                      <button
                        onClick={() => setAttachUrls((prev) => prev.filter((_, j) => j !== i))}
                        className="ml-1 text-slate-500 hover:text-red-400"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <textarea
                  value={msgText}
                  onChange={(e) => setMsgText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Type a message… (Enter to send)"
                  rows={2}
                  className="flex-1 resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                />
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={sendMessage}
                    disabled={!msgText.trim() || addMessage.isPending}
                    className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50"
                  >
                    {addMessage.isPending ? '…' : 'Send'}
                  </button>
                  <button
                    onClick={() => {
                      const url = window.prompt('Paste attachment URL:');
                      if (url?.trim()) setAttachUrls((prev) => [...prev, url.trim()]);
                    }}
                    title="Attach a file URL"
                    className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-400 hover:border-slate-500 hover:text-slate-200"
                  >
                    📎
                  </button>
                </div>
              </div>
              {addMessage.isError && (
                <p className="text-xs text-red-400">
                  {(addMessage.error as Error)?.message ?? 'Failed to send message'}
                </p>
              )}
            </div>
          )}

          {disputeResolved && (
            <div className="border-t border-emerald-800 bg-emerald-950/20 px-5 py-3">
              <p className="text-sm font-medium text-emerald-400">✓ This dispute has been resolved</p>
              {dispute.resolution && (
                <p className="mt-0.5 text-xs text-slate-300">{dispute.resolution}</p>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT: Sidebar ─────────────────────────────────────────────── */}
        <div className="w-full space-y-4 lg:w-80 lg:shrink-0">

          {/* Escrow status card */}
          <div className="rounded-xl border border-amber-800/60 bg-amber-950/20 p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Funds in Escrow</p>
            <p className="text-2xl font-bold text-white">
              {fmt(escrow.amountCents, escrow.currency)}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Escrow status</span>
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                  escrow.status === 'HOLDING'
                    ? 'border-amber-700 text-amber-400'
                    : escrow.status === 'RELEASED'
                      ? 'border-emerald-700 text-emerald-400'
                      : escrow.status === 'REFUNDED'
                        ? 'border-slate-700 text-slate-400'
                        : 'border-orange-700 text-orange-400'
                }`}
              >
                {escrow.status}
              </span>
            </div>
            {escrow.releaseAfter && escrow.status === 'HOLDING' && (
              <p className="text-xs text-slate-500">
                Auto-release: {new Date(escrow.releaseAfter).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Order summary */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Order Summary</p>
            {order.items.slice(0, 3).map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-slate-200">{item.listingTitle}</p>
                  {item.variantLabel && (
                    <p className="text-xs text-slate-500">{item.variantLabel}</p>
                  )}
                  <p className="text-xs text-slate-500">Qty {item.quantity}</p>
                </div>
                <span className="shrink-0 text-slate-300">
                  {fmt(item.unitPriceCents * item.quantity, item.currency)}
                </span>
              </div>
            ))}
            {order.items.length > 3 && (
              <p className="text-xs text-slate-500">+{order.items.length - 3} more items</p>
            )}
            <div className="border-t border-slate-800 pt-2 flex justify-between text-sm font-semibold">
              <span className="text-slate-300">Total</span>
              <span className="text-white">
                {fmt(order.totalItemCents + order.shippingCents + order.feeCents, order.currency)}
              </span>
            </div>
            {order.placedAt && (
              <p className="text-xs text-slate-500">
                Placed {new Date(order.placedAt).toLocaleDateString()}
              </p>
            )}
            <Link
              href={`/app/orders/${order.id}` as any}
              className="block text-xs text-amber-400 hover:underline"
            >
              View full order →
            </Link>
          </div>

          {/* Evidence panel */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Evidence</p>
            {allAttachments.length === 0 ? (
              <p className="text-xs text-slate-500">No files attached yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {allAttachments.map((url, i) =>
                  isImage(url) ? (
                    <button
                      key={i}
                      onClick={() => setLightboxSrc(url)}
                      className="overflow-hidden rounded-lg border border-slate-700 hover:opacity-80"
                      title={url}
                    >
                      <img src={url} alt={`Evidence ${i + 1}`} className="h-16 w-16 object-cover" />
                    </button>
                  ) : (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-amber-400 hover:border-amber-600"
                    >
                      📄 File {i + 1}
                    </a>
                  )
                )}
              </div>
            )}
            <p className="text-xs text-slate-600">
              Attach evidence files by including URLs in your messages.
            </p>
          </div>

          {/* Dispute timeline */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Timeline</p>
            <ol className="relative border-l border-slate-700 pl-4 space-y-3">
              {/* Order status events */}
              {order.timeline.map((event) => (
                <li key={event.id} className="relative">
                  <span className="absolute -left-[1.35rem] top-1 h-2.5 w-2.5 rounded-full border-2 border-slate-700 bg-slate-500" />
                  <p className="text-xs font-medium text-slate-300">{event.status}</p>
                  {event.note && <p className="text-xs text-slate-500">{event.note}</p>}
                  <p className="text-xs text-slate-600">{new Date(event.createdAt).toLocaleString()}</p>
                </li>
              ))}
              {/* Dispute opened */}
              <li className="relative">
                <span className="absolute -left-[1.35rem] top-1 h-2.5 w-2.5 rounded-full border-2 border-orange-700 bg-orange-500" />
                <p className="text-xs font-medium text-orange-300">Dispute opened</p>
                <p className="text-xs text-slate-500">{dispute.reason}</p>
                <p className="text-xs text-slate-600">{new Date(dispute.openedAt).toLocaleString()}</p>
              </li>
              {/* Resolved */}
              {dispute.resolvedAt && (
                <li className="relative">
                  <span className="absolute -left-[1.35rem] top-1 h-2.5 w-2.5 rounded-full border-2 border-emerald-700 bg-emerald-500" />
                  <p className="text-xs font-medium text-emerald-300">Dispute resolved</p>
                  {dispute.resolution && (
                    <p className="text-xs text-slate-400">{dispute.resolution}</p>
                  )}
                  <p className="text-xs text-slate-600">{new Date(dispute.resolvedAt).toLocaleString()}</p>
                </li>
              )}
              {/* Escrow transactions */}
              {escrow.transactions.map((tx) => (
                <li key={tx.id} className="relative">
                  <span className="absolute -left-[1.35rem] top-1 h-2.5 w-2.5 rounded-full border-2 border-slate-700 bg-amber-500" />
                  <p className="text-xs font-medium text-slate-300">
                    Escrow {tx.type.toLowerCase()} · {fmt(tx.amountCents, tx.currency)}
                  </p>
                  {tx.note && <p className="text-xs text-slate-500">{tx.note}</p>}
                  <p className="text-xs text-slate-600">{new Date(tx.createdAt).toLocaleString()}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </>
  );
}
