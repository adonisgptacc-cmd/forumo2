"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import {
  useOrder,
  useDisputeDetails,
  useAddDisputeMessage,
  useResolveDispute,
  useCurrentUser,
} from "../../../../../lib/react-query/hooks";

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
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "ESCALATED";
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

function fmt(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    cents / 100,
  );
}

function parseAttachments(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((u) => typeof u === "string");
  if (typeof raw === "object")
    return Object.values(raw as Record<string, string>).filter(
      (u) => typeof u === "string",
    );
  return [];
}

function isImage(url: string) {
  return /\.(jpe?g|png|gif|webp|svg|avif)(\?|$)/i.test(url);
}

const DISPUTE_STATUS_BADGE: Record<string, string> = {
  OPEN: "border-red-200    bg-red-50    text-red-700",
  UNDER_REVIEW: "border-amber-200  bg-amber-50  text-amber-700",
  RESOLVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ESCALATED: "border-orange-200  bg-orange-50  text-orange-700",
};

// ── Sub-components ───────────────────────────────────────────────────────────

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
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
        className="absolute right-6 top-6 rounded-full bg-white/90 px-3 py-1 text-sm text-[color:var(--ink)] hover:bg-white shadow"
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
  const [resolution, setResolution] = useState("");
  const [releaseToParty, setReleaseToParty] = useState<"seller" | "buyer">(
    "seller",
  );

  const action = releaseToParty === "seller" ? "RELEASE" : "REFUND";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!resolution.trim()) return;
    await resolve.mutateAsync({
      disputeId: dispute.id,
      orderId,
      resolution,
      action,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[oklch(0.20_0.012_50_/_0.45)] backdrop-blur-sm p-4">
      <div
        className="w-full max-w-md card p-6 space-y-4 shadow-[var(--shadow-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[color:var(--ink)]">
            Resolve Dispute
          </h3>
          <button
            onClick={onClose}
            className="text-[color:var(--ink-3)] hover:text-[color:var(--ink)]"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-[color:var(--ink-3)]">
          Reason:{" "}
          <span className="text-[color:var(--ink)]">{dispute.reason}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[color:var(--ink-3)]">
              Resolution notes <span className="text-red-600">*</span>
            </label>
            <textarea
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              rows={3}
              required
              placeholder="Explain the resolution decision…"
              className="w-full rounded-lg border border-[color:var(--line-2)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-3)] transition-[border-color,box-shadow] focus:border-[color:var(--accent)] focus:outline-none focus:shadow-[0_0_0_3px_var(--ring-accent)]"
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-[color:var(--ink-3)]">
              Release funds to
            </legend>
            {(["seller", "buyer"] as const).map((party) => (
              <label
                key={party}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-[color:var(--line)] p-3 hover:border-[color:var(--accent)] transition-colors"
              >
                <input
                  type="radio"
                  name="releaseToParty"
                  value={party}
                  checked={releaseToParty === party}
                  onChange={() => setReleaseToParty(party)}
                  className="accent-[color:var(--accent)]"
                />
                <span className="text-sm capitalize text-[color:var(--ink)]">
                  {party}
                </span>
                <span className="ml-auto text-xs text-[color:var(--ink-3)]">
                  {party === "seller" ? "RELEASE escrow" : "REFUND to buyer"}
                </span>
              </label>
            ))}
          </fieldset>

          {resolve.isError && (
            <p className="text-xs text-red-600">
              {(resolve.error as Error)?.message ?? "Failed to resolve dispute"}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={!resolution.trim() || resolve.isPending}
              className="btn btn-primary flex-1"
            >
              {resolve.isPending ? "Resolving…" : "Confirm resolution"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost px-4"
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
  const { data: escrowRaw, isLoading: escrowLoading } =
    useDisputeDetails(orderId);
  const addMessage = useAddDisputeMessage();

  const [msgText, setMsgText] = useState("");
  const [attachUrls, setAttachUrls] = useState<string[]>([]);
  const [attachInput, setAttachInput] = useState("");
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const escrow = escrowRaw as EscrowWithDisputes | undefined;
  const dispute = escrow?.disputes?.[0];
  const isAdmin = user?.role === "ADMIN" || user?.role === "MODERATOR";
  const canResolve = isAdmin && dispute && dispute.status !== "RESOLVED";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [dispute?.messages?.length]);

  async function sendMessage() {
    if (!dispute || !msgText.trim()) return;
    await addMessage.mutateAsync({
      disputeId: dispute.id,
      orderId,
      body: msgText.trim(),
      attachments: attachUrls.length > 0 ? attachUrls : undefined,
    });
    setMsgText("");
    setAttachUrls([]);
  }

  function addAttachUrl() {
    const url = attachInput.trim();
    if (url && !attachUrls.includes(url)) {
      setAttachUrls((prev) => [...prev, url]);
    }
    setAttachInput("");
  }

  if (orderLoading || escrowLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="skeleton h-40 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!order || !escrow) {
    return (
      <div className="alert alert-error rounded-xl p-6 text-center">
        <p>Dispute not found or no escrow for this order.</p>
        <Link
          href={"/app/disputes" as any}
          className="mt-3 inline-block text-sm text-[color:var(--accent)] hover:underline"
        >
          ← Back to disputes
        </Link>
      </div>
    );
  }

  if (!dispute) {
    return (
      <div className="card p-6 text-center">
        <p className="text-[color:var(--ink-3)]">
          No active dispute found for this order.
        </p>
        <Link
          href={"/app/disputes" as any}
          className="mt-3 inline-block text-sm text-[color:var(--accent)] hover:underline"
        >
          ← Back to disputes
        </Link>
      </div>
    );
  }

  const allAttachments = dispute.messages.flatMap((m) =>
    parseAttachments(m.attachments),
  );
  const badgeCls =
    DISPUTE_STATUS_BADGE[dispute.status] ??
    "border-[color:var(--line)] bg-[color:var(--surface-2)] text-[color:var(--ink-3)]";
  const disputeResolved = dispute.status === "RESOLVED";

  return (
    <>
      {lightboxSrc && (
        <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      )}
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
          <Link
            href={"/app/disputes" as any}
            className="text-xs text-[color:var(--ink-3)] hover:text-[color:var(--ink)]"
          >
            ← Disputes
          </Link>
          <h2 className="mt-1 text-xl font-semibold text-[color:var(--ink)]">
            Dispute — Order {order.orderNumber}
          </h2>
          <p className="mt-0.5 text-sm text-[color:var(--ink-3)]">
            Opened {new Date(dispute.openedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full border px-4 py-1 text-xs font-medium ${badgeCls}`}
          >
            {dispute.status.replace("_", " ")}
          </span>
          {canResolve && (
            <button
              onClick={() => setShowResolveModal(true)}
              className="btn btn-primary btn-sm"
            >
              Resolve dispute
            </button>
          )}
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        {/* ── LEFT: Chat thread ──────────────────────────────────────────── */}
        <div className="flex min-h-[480px] flex-1 flex-col card">
          {/* Reason banner */}
          <div className="border-b border-[color:var(--line)] px-5 py-3">
            <p className="text-xs text-[color:var(--ink-3)]">
              Dispute reason:{" "}
              <span className="font-medium text-[color:var(--ink)]">
                {dispute.reason}
              </span>
            </p>
          </div>

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto px-5 py-4 space-y-3"
            style={{ maxHeight: "480px" }}
          >
            {dispute.messages.length === 0 && (
              <p className="text-center text-sm text-[color:var(--ink-3)] py-8">
                No messages yet. Start the conversation below.
              </p>
            )}

            {dispute.messages.map((msg) => {
              const isMe = msg.authorId === user?.id;
              const attachments = parseAttachments(msg.attachments);
              const roleLabel =
                msg.authorId === order.buyerId
                  ? "Buyer"
                  : msg.authorId === order.sellerId
                    ? "Seller"
                    : "Admin";

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col gap-1 ${isMe ? "items-end" : "items-start"}`}
                >
                  <span className="text-xs text-[color:var(--ink-3)]">
                    {isMe ? "You" : (msg.author.name ?? msg.author.email)} ·{" "}
                    {roleLabel} ·{" "}
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                      isMe
                        ? "rounded-tr-sm bg-[color:var(--accent)]/10 text-[color:var(--ink)] border border-[color:var(--accent)]/20"
                        : "rounded-tl-sm bg-[color:var(--surface-2)] text-[color:var(--ink)] border border-[color:var(--line)]"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">
                      {msg.body}
                    </p>
                    {attachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {attachments.map((url, i) =>
                          isImage(url) ? (
                            <button
                              key={i}
                              onClick={() => setLightboxSrc(url)}
                              className="overflow-hidden rounded-lg border border-[color:var(--line)] hover:opacity-80"
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
                              className="flex items-center gap-1.5 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface-2)] px-3 py-1.5 text-xs text-[color:var(--accent)] hover:border-[color:var(--accent)] transition-colors"
                            >
                              📎 Attachment {i + 1}
                            </a>
                          ),
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
            <div className="border-t border-[color:var(--line)] p-4 space-y-2">
              {/* Queued attachments */}
              {attachUrls.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {attachUrls.map((url, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 rounded-full border border-[color:var(--line)] bg-[color:var(--surface-2)] px-3 py-0.5 text-xs text-[color:var(--ink-2)]"
                    >
                      📎 {url.split("/").pop()?.slice(0, 20) ?? "File"}
                      <button
                        onClick={() =>
                          setAttachUrls((prev) =>
                            prev.filter((_, j) => j !== i),
                          )
                        }
                        className="ml-1 text-[color:var(--ink-3)] hover:text-red-600"
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
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Type a message… (Enter to send)"
                  rows={2}
                  className="flex-1 resize-none rounded-xl border border-[color:var(--line-2)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-3)] transition-[border-color,box-shadow] focus:border-[color:var(--accent)] focus:outline-none focus:shadow-[0_0_0_3px_var(--ring-accent)]"
                />
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={sendMessage}
                    disabled={!msgText.trim() || addMessage.isPending}
                    className="btn btn-primary px-4 py-2"
                  >
                    {addMessage.isPending ? "…" : "Send"}
                  </button>
                  <button
                    onClick={() => {
                      const url = window.prompt("Paste attachment URL:");
                      if (url?.trim())
                        setAttachUrls((prev) => [...prev, url.trim()]);
                    }}
                    title="Attach a file URL"
                    className="btn btn-ghost px-4 py-2"
                  >
                    📎
                  </button>
                </div>
              </div>
              {addMessage.isError && (
                <p className="text-xs text-red-600">
                  {(addMessage.error as Error)?.message ??
                    "Failed to send message"}
                </p>
              )}
            </div>
          )}

          {disputeResolved && (
            <div className="border-t border-emerald-200 bg-emerald-50 px-5 py-3 rounded-b-xl">
              <p className="text-sm font-medium text-emerald-700">
                ✓ This dispute has been resolved
              </p>
              {dispute.resolution && (
                <p className="mt-0.5 text-xs text-[color:var(--ink-2)]">
                  {dispute.resolution}
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT: Sidebar ─────────────────────────────────────────────── */}
        <div className="w-full space-y-4 lg:w-80 lg:shrink-0">
          {/* Escrow status card */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
            <p className="eyebrow text-amber-700">Funds in Escrow</p>
            <p className="text-2xl font-bold text-[color:var(--ink)]">
              {fmt(escrow.amountCents, escrow.currency)}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[color:var(--ink-3)]">
                Escrow status
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                  escrow.status === "HOLDING"
                    ? "border-amber-200 bg-amber-100 text-amber-700"
                    : escrow.status === "RELEASED"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : escrow.status === "REFUNDED"
                        ? "border-[color:var(--line)] bg-[color:var(--surface-2)] text-[color:var(--ink-3)]"
                        : "border-orange-200 bg-orange-50 text-orange-700"
                }`}
              >
                {escrow.status}
              </span>
            </div>
            {escrow.releaseAfter && escrow.status === "HOLDING" && (
              <p className="text-xs text-[color:var(--ink-3)]">
                Auto-release:{" "}
                {new Date(escrow.releaseAfter).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Order summary */}
          <div className="card p-4 space-y-3">
            <p className="eyebrow">Order Summary</p>
            {order.items.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate text-[color:var(--ink)]">
                    {item.listingTitle}
                  </p>
                  {item.variantLabel && (
                    <p className="text-xs text-[color:var(--ink-3)]">
                      {item.variantLabel}
                    </p>
                  )}
                  <p className="text-xs text-[color:var(--ink-3)]">
                    Qty {item.quantity}
                  </p>
                </div>
                <span className="shrink-0 text-[color:var(--ink-2)]">
                  {fmt(item.unitPriceCents * item.quantity, item.currency)}
                </span>
              </div>
            ))}
            {order.items.length > 3 && (
              <p className="text-xs text-[color:var(--ink-3)]">
                +{order.items.length - 3} more items
              </p>
            )}
            <div className="border-t border-[color:var(--line)] pt-2 flex justify-between text-sm font-semibold">
              <span className="text-[color:var(--ink-2)]">Total</span>
              <span className="text-[color:var(--ink)]">
                {fmt(
                  order.totalItemCents + order.shippingCents + order.feeCents,
                  order.currency,
                )}
              </span>
            </div>
            {order.placedAt && (
              <p className="text-xs text-[color:var(--ink-3)]">
                Placed {new Date(order.placedAt).toLocaleDateString()}
              </p>
            )}
            <Link
              href={`/app/orders/${order.id}` as any}
              className="block text-xs text-[color:var(--accent)] hover:underline"
            >
              View full order →
            </Link>
          </div>

          {/* Evidence panel */}
          <div className="card p-4 space-y-3">
            <p className="eyebrow">Evidence</p>
            {allAttachments.length === 0 ? (
              <p className="text-xs text-[color:var(--ink-3)]">
                No files attached yet.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {allAttachments.map((url, i) =>
                  isImage(url) ? (
                    <button
                      key={i}
                      onClick={() => setLightboxSrc(url)}
                      className="overflow-hidden rounded-lg border border-[color:var(--line)] hover:opacity-80 transition-opacity"
                      title={url}
                    >
                      <img
                        src={url}
                        alt={`Evidence ${i + 1}`}
                        className="h-16 w-16 object-cover"
                      />
                    </button>
                  ) : (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface-2)] px-3 py-2 text-xs text-[color:var(--accent)] hover:border-[color:var(--accent)] transition-colors"
                    >
                      📄 File {i + 1}
                    </a>
                  ),
                )}
              </div>
            )}
            <p className="text-xs text-[color:var(--ink-3)]">
              Attach evidence files by including URLs in your messages.
            </p>
          </div>

          {/* Dispute timeline */}
          <div className="card p-4 space-y-3">
            <p className="eyebrow">Timeline</p>
            <ol className="relative border-l border-[color:var(--line)] pl-4 space-y-3">
              {/* Order status events */}
              {order.timeline.map((event) => (
                <li key={event.id} className="relative">
                  <span className="absolute -left-[1.35rem] top-1 h-2.5 w-2.5 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--surface-2)]" />
                  <p className="text-xs font-medium text-[color:var(--ink)]">
                    {event.status}
                  </p>
                  {event.note && (
                    <p className="text-xs text-[color:var(--ink-3)]">
                      {event.note}
                    </p>
                  )}
                  <p className="text-xs text-[color:var(--ink-3)]">
                    {new Date(event.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
              {/* Dispute opened */}
              <li className="relative">
                <span className="absolute -left-[1.35rem] top-1 h-2.5 w-2.5 rounded-full border-2 border-orange-300 bg-orange-500" />
                <p className="text-xs font-medium text-orange-700">
                  Dispute opened
                </p>
                <p className="text-xs text-[color:var(--ink-3)]">
                  {dispute.reason}
                </p>
                <p className="text-xs text-[color:var(--ink-3)]">
                  {new Date(dispute.openedAt).toLocaleString()}
                </p>
              </li>
              {/* Resolved */}
              {dispute.resolvedAt && (
                <li className="relative">
                  <span className="absolute -left-[1.35rem] top-1 h-2.5 w-2.5 rounded-full border-2 border-emerald-300 bg-emerald-500" />
                  <p className="text-xs font-medium text-emerald-700">
                    Dispute resolved
                  </p>
                  {dispute.resolution && (
                    <p className="text-xs text-[color:var(--ink-3)]">
                      {dispute.resolution}
                    </p>
                  )}
                  <p className="text-xs text-[color:var(--ink-3)]">
                    {new Date(dispute.resolvedAt).toLocaleString()}
                  </p>
                </li>
              )}
              {/* Escrow transactions */}
              {escrow.transactions.map((tx) => (
                <li key={tx.id} className="relative">
                  <span className="absolute -left-[1.35rem] top-1 h-2.5 w-2.5 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--accent)]" />
                  <p className="text-xs font-medium text-[color:var(--ink)]">
                    Escrow {tx.type.toLowerCase()} ·{" "}
                    {fmt(tx.amountCents, tx.currency)}
                  </p>
                  {tx.note && (
                    <p className="text-xs text-[color:var(--ink-3)]">
                      {tx.note}
                    </p>
                  )}
                  <p className="text-xs text-[color:var(--ink-3)]">
                    {new Date(tx.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </>
  );
}
