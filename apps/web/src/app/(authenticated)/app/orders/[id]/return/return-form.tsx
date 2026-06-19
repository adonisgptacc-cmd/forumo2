'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { ReturnReason } from '@forumo/shared';
import { useOrder, useInitiateReturn } from '../../../../../../lib/react-query/hooks';

const REASON_LABELS: Record<ReturnReason, string> = {
  not_as_described: 'Not as described',
  damaged: 'Item arrived damaged',
  not_received: 'Item not received',
  changed_mind: 'Changed my mind',
  other: 'Other',
};

export function ReturnForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { data: order, isLoading } = useOrder(orderId);
  const { mutateAsync: initiateReturn, isPending } = useInitiateReturn(orderId);

  const [reason, setReason] = useState<ReturnReason | ''>('');
  const [conditionNotes, setConditionNotes] = useState('');
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[color:var(--accent)] border-t-transparent" />
      </div>
    );
  }

  if (!order) {
    return <p className="text-[color:var(--ink-3)]">Order not found.</p>;
  }

  const items = order.items ?? [];

  function toggleItem(itemId: string) {
    setSelectedItems((prev) => {
      if (prev[itemId]) {
        const next = { ...prev };
        delete next[itemId];
        return next;
      }
      return { ...prev, [itemId]: 1 };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) return;
    setError(null);

    const itemsPayload =
      Object.keys(selectedItems).length > 0
        ? Object.entries(selectedItems).map(([orderItemId, quantity]) => ({ orderItemId, quantity }))
        : undefined;

    try {
      await initiateReturn({
        reason,
        conditionNotes: conditionNotes.trim() || undefined,
        items: itemsPayload,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-12 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-[color:var(--escrow)] text-4xl">
          ✓
        </div>
        <h2 className="text-xl font-semibold">Return requested</h2>
        <p className="text-[color:var(--ink-3)]">
          The seller has <strong className="text-[color:var(--ink-2)]">48 hours</strong> to respond. If they
          don&apos;t, your return will be automatically approved.
        </p>
        <div className="flex justify-center gap-3">
          <Link
            href={'/app/returns' as any}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            View my returns
          </Link>
          <Link
            href={`/app/orders/${orderId}` as any}
            className="rounded-md border border-[color:var(--line-2)] px-4 py-2 text-sm font-medium text-[color:var(--ink-2)] hover:bg-[color:var(--surface-2)]"
          >
            Back to order
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <Link
          href={`/app/orders/${orderId}` as any}
          className="text-sm text-[color:var(--ink-3)] hover:text-[color:var(--ink-2)]"
        >
          ← Back to order
        </Link>
        <h2 className="mt-2 text-xl font-semibold">Request a return</h2>
        <p className="text-sm text-[color:var(--ink-3)]">Order #{order.orderNumber}</p>
      </div>

      {/* Return policy callout */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
        <strong>Return policy:</strong> Items can be returned within <strong>30 days</strong> of
        delivery. The seller has 48 hours to approve or decline your request. If they don&apos;t
        respond, the return is automatically approved.
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Reason */}
        <div>
          <label className="mb-2 block text-sm font-medium text-[color:var(--ink-2)]">
            Reason for return <span className="text-red-600">*</span>
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as ReturnReason)}
            required
            className="w-full rounded-md border border-[color:var(--line-2)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--ink)] focus:border-[color:var(--accent)] focus:outline-none"
          >
            <option value="">Select a reason…</option>
            {(Object.entries(REASON_LABELS) as [ReturnReason, string][]).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Item selection (partial returns) */}
        {items.length > 1 && (
          <div>
            <label className="mb-2 block text-sm font-medium text-[color:var(--ink-2)]">
              Select items to return{' '}
              <span className="font-normal text-[color:var(--ink-3)]">(leave all unchecked to return everything)</span>
            </label>
            <div className="divide-y divide-[color:var(--line)] rounded-md border border-[color:var(--line-2)]">
              {items.map((item: any) => (
                <label
                  key={item.id}
                  className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-[color:var(--surface-2)]"
                >
                  <input
                    type="checkbox"
                    checked={!!selectedItems[item.id]}
                    onChange={() => toggleItem(item.id)}
                    className="h-4 w-4 rounded border-[color:var(--line-2)] accent-[var(--accent)]"
                  />
                  <span className="flex-1 text-sm text-[color:var(--ink-2)]">{item.listingTitle}</span>
                  <span className="text-sm text-[color:var(--ink-3)]">
                    {item.currency} {(item.unitPriceCents / 100).toFixed(2)} × {item.quantity}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Condition notes */}
        <div>
          <label className="mb-2 block text-sm font-medium text-[color:var(--ink-2)]">
            Condition notes{' '}
            <span className="font-normal text-[color:var(--ink-3)]">(describe the issue in detail)</span>
          </label>
          <textarea
            value={conditionNotes}
            onChange={(e) => setConditionNotes(e.target.value)}
            rows={4}
            maxLength={1000}
            placeholder="e.g. The item arrived with a cracked screen and scratches on the back panel…"
            className="w-full resize-none rounded-md border border-[color:var(--line-2)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-3)] focus:border-[color:var(--accent)] focus:outline-none"
          />
          <p className="mt-1 text-right text-xs text-[color:var(--ink-3)]">{conditionNotes.length}/1000</p>
        </div>

        {/* Photo upload note */}
        <div className="rounded-md border border-[color:var(--line-2)] bg-[color:var(--surface)]/50 px-4 py-3 text-sm text-[color:var(--ink-3)]">
          📷 Photo evidence helps speed up approval. You can share photos with the seller via{' '}
          <Link href="/app/messages" className="text-[color:var(--accent)] hover:underline">
            messages
          </Link>{' '}
          after submitting.
        </div>

        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <Link
            href={`/app/orders/${orderId}` as any}
            className="rounded-md border border-[color:var(--line-2)] px-4 py-2 text-sm font-medium text-[color:var(--ink-2)] hover:bg-[color:var(--surface-2)]"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={!reason || isPending}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {isPending ? 'Submitting…' : 'Submit return request'}
          </button>
        </div>
      </form>
    </div>
  );
}
