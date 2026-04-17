'use client';

import Link from 'next/link';
import { useOrder, useUpdateOrderStatus, useInitiatePayment, useOpenDispute, useEscrowDetails, useAddDisputeMessage, useShipmentMutations } from '../../../../../lib/react-query/hooks';
import { useCurrentUser } from '../../../../../lib/react-query/hooks';
import { useState } from 'react';
import type { SafeOrder } from '@forumo/shared';

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'text-yellow-400 border-yellow-700',
  CONFIRMED: 'text-blue-400 border-blue-700',
  PROCESSING: 'text-blue-400 border-blue-700',
  SHIPPED: 'text-indigo-400 border-indigo-700',
  DELIVERED: 'text-emerald-400 border-emerald-700',
  COMPLETED: 'text-emerald-400 border-emerald-700',
  CANCELLED: 'text-red-400 border-red-700',
  DISPUTED: 'text-orange-400 border-orange-700',
  REFUNDED: 'text-slate-400 border-slate-700',
};

const ESCROW_COLORS: Record<string, string> = {
  HOLDING: 'text-amber-400 border-amber-700',
  RELEASED: 'text-emerald-400 border-emerald-700',
  REFUNDED: 'text-slate-400 border-slate-700',
  DISPUTED: 'text-orange-400 border-orange-700',
};

export function OrderDetail({ id }: { id: string }) {
  const { data: order, isLoading, isError } = useOrder(id);
  const { user } = useCurrentUser();
  const updateStatus = useUpdateOrderStatus();
  const initiatePayment = useInitiatePayment();
  const openDispute = useOpenDispute();
  const { data: escrowDetails } = useEscrowDetails(order?.status === 'DISPUTED' ? id : null);
  const addDisputeMessage = useAddDisputeMessage();
  const { createShipment, updateShipment } = useShipmentMutations(id);
  const [statusNote, setStatusNote] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeMsg, setDisputeMsg] = useState('');
  const [showShipForm, setShowShipForm] = useState(false);
  const [shipCarrier, setShipCarrier] = useState('');
  const [shipTracking, setShipTracking] = useState('');
  const [shipEta, setShipEta] = useState('');

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl bg-slate-800" />)}
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="rounded-xl border border-red-800 bg-red-900/20 p-6 text-center">
        <p className="text-red-400">Order not found or you don&apos;t have access.</p>
        <Link href={"/app/orders" as any} className="mt-3 inline-block text-sm text-amber-400 hover:underline">
          ← Back to orders
        </Link>
      </div>
    );
  }

  const isBuyer = user?.id === order.buyerId;
  const isSeller = user?.id === order.sellerId;
  const totalCents = order.totalItemCents + order.shippingCents + order.feeCents;
  const statusColor = STATUS_COLORS[order.status] ?? 'text-slate-400 border-slate-700';

  const canConfirm = isSeller && order.status === 'PENDING';
  const canShip = isSeller && order.status === 'CONFIRMED';
  const canDeliver = isSeller && order.status === 'FULFILLED';
  const canComplete = isBuyer && order.status === 'DELIVERED';
  const canCancel = order.status === 'PENDING' || order.status === 'CONFIRMED';
  const canDispute =
    (isBuyer || isSeller) &&
    order.status !== 'DISPUTED' &&
    order.status !== 'CANCELLED' &&
    order.status !== 'REFUNDED' &&
    order.status !== 'COMPLETED' &&
    order.status !== 'PENDING' &&
    order.escrow != null &&
    order.escrow.status === 'HOLDING';
  const needsPayment =
    isBuyer &&
    order.status !== 'CANCELLED' &&
    order.status !== 'REFUNDED' &&
    (!order.payments || order.payments.length === 0 || order.payments.every((p) => p.status !== 'SETTLED' && p.status !== 'CAPTURED'));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={"/app/orders" as any} className="text-xs text-slate-500 hover:text-slate-300">
            ← Orders
          </Link>
          <h2 className="mt-1 text-2xl font-semibold">Order {order.orderNumber}</h2>
          <p className="text-sm text-slate-400">
            Placed {order.placedAt ? new Date(order.placedAt).toLocaleString() : 'N/A'}
          </p>
        </div>
        <span className={`rounded-full border px-4 py-1 text-sm font-medium ${statusColor}`}>
          {order.status}
        </span>
      </div>

      {/* Items */}
      <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-300">Items</h3>
        <ul className="divide-y divide-slate-800">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium">{item.listingTitle}</p>
                {item.variantLabel && (
                  <p className="text-xs text-slate-500">{item.variantLabel}</p>
                )}
                <p className="text-xs text-slate-500">Qty: {item.quantity}</p>
              </div>
              <p className="text-sm text-slate-300">
                {(item.unitPriceCents * item.quantity / 100).toFixed(2)} {item.currency}
              </p>
            </li>
          ))}
        </ul>
        <div className="border-t border-slate-800 pt-3 space-y-1 text-sm">
          <div className="flex justify-between text-slate-400">
            <span>Items subtotal</span>
            <span>{(order.totalItemCents / 100).toFixed(2)} {order.currency}</span>
          </div>
          {order.shippingCents > 0 && (
            <div className="flex justify-between text-slate-400">
              <span>Shipping</span>
              <span>{(order.shippingCents / 100).toFixed(2)} {order.currency}</span>
            </div>
          )}
          {order.feeCents > 0 && (
            <div className="flex justify-between text-slate-400">
              <span>Platform fee</span>
              <span>{(order.feeCents / 100).toFixed(2)} {order.currency}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-white pt-1">
            <span>Total</span>
            <span>{(totalCents / 100).toFixed(2)} {order.currency}</span>
          </div>
        </div>
      </section>

      {/* Escrow */}
      {order.escrow && (
        <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-2">
          <h3 className="text-sm font-semibold text-slate-300">Escrow</h3>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">
              {(order.escrow.amountCents / 100).toFixed(2)} {order.escrow.currency}
            </span>
            <span className={`rounded-full border px-3 py-0.5 text-xs font-medium ${ESCROW_COLORS[order.escrow.status] ?? 'text-slate-400 border-slate-700'}`}>
              {order.escrow.status}
            </span>
          </div>
          {order.escrow.releaseDate && (
            <p className="text-xs text-slate-500">
              Release date: {new Date(order.escrow.releaseDate).toLocaleString()}
            </p>
          )}
        </section>
      )}

      {/* Dispute thread */}
      {order.status === 'DISPUTED' && escrowDetails && (() => {
        const details = escrowDetails as any;
        const dispute = details?.disputes?.[0];
        if (!dispute) return null;
        return (
          <section className="rounded-xl border border-orange-800 bg-orange-950/20 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-orange-300">Active Dispute</h3>
              <span className="text-xs rounded-full border border-orange-700 px-2 py-0.5 text-orange-400">{dispute.status}</span>
            </div>
            <p className="text-xs text-slate-400">Reason: <span className="text-slate-200">{dispute.reason}</span></p>

            {/* Messages */}
            <div className="space-y-2">
              {(dispute.messages ?? []).length === 0 && (
                <p className="text-xs text-slate-500">No messages yet. Add a message below to communicate with the admin.</p>
              )}
              {(dispute.messages ?? []).map((msg: any) => (
                <div
                  key={msg.id}
                  className={`rounded-lg p-3 text-sm ${msg.authorId === user?.id ? 'bg-orange-900/30 ml-8' : 'bg-slate-800 mr-8'}`}
                >
                  <p className="text-xs text-slate-400 mb-1">{msg.author?.name ?? 'Unknown'}</p>
                  <p className="text-slate-200">{msg.body}</p>
                  <p className="text-xs text-slate-500 mt-1">{new Date(msg.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>

            {/* Resolution banner */}
            {dispute.status === 'RESOLVED' && (
              <div className="rounded-lg border border-emerald-700 bg-emerald-950/30 px-4 py-3 space-y-1">
                <p className="text-sm font-semibold text-emerald-400">✅ Dispute resolved</p>
                {dispute.resolutionNotes && (
                  <p className="text-xs text-slate-300">{dispute.resolutionNotes}</p>
                )}
                <p className="text-xs text-slate-400">
                  Resolved {dispute.resolvedAt ? new Date(dispute.resolvedAt).toLocaleString() : ''}
                </p>
              </div>
            )}

            {/* Send message — only while active */}
            {dispute.status !== 'RESOLVED' && (
              <div className="flex gap-2">
                <textarea
                  value={disputeMsg}
                  onChange={(e) => setDisputeMsg(e.target.value)}
                  placeholder="Add a message to the dispute…"
                  rows={2}
                  className="flex-1 rounded-lg border border-orange-800 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
                />
                <button
                  onClick={async () => {
                    if (!disputeMsg.trim()) return;
                    await addDisputeMessage.mutateAsync({ disputeId: dispute.id, orderId: id, body: disputeMsg });
                    setDisputeMsg('');
                  }}
                  disabled={!disputeMsg.trim() || addDisputeMessage.isPending}
                  className="self-end rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-500 disabled:opacity-50"
                >
                  {addDisputeMessage.isPending ? '…' : 'Send'}
                </button>
              </div>
            )}
          </section>
        );
      })()}

      {/* Payments */}
      {order.payments && order.payments.length > 0 && (
        <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-2">
          <h3 className="text-sm font-semibold text-slate-300">Payments</h3>
          <ul className="space-y-2">
            {order.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-400 capitalize">{p.provider}</span>
                <span className={p.status === 'SETTLED' || p.status === 'CAPTURED' ? 'text-emerald-400' : p.status === 'FAILED' ? 'text-red-400' : 'text-yellow-400'}>
                  {p.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Shipment tracking */}
      {(order.status === 'FULFILLED' || order.status === 'DELIVERED' || order.status === 'COMPLETED' || (order.shipments && order.shipments.length > 0)) && (
        <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-300">Shipment &amp; Tracking</h3>
            {isSeller && order.shipments && order.shipments.length > 0 && !showShipForm && (
              <button
                onClick={() => {
                  const s = order.shipments[0];
                  setShipCarrier(s.carrier ?? '');
                  setShipTracking(s.trackingNumber ?? '');
                  setShipEta(s.estimatedDelivery ? new Date(s.estimatedDelivery).toISOString().split('T')[0] : '');
                  setShowShipForm(true);
                }}
                className="text-xs text-amber-400 hover:underline"
              >
                Edit tracking
              </button>
            )}
          </div>

          {/* Existing shipment display */}
          {order.shipments && order.shipments.length > 0 && !showShipForm && (
            order.shipments.map((s) => (
              <div key={s.id} className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                    s.status === 'DELIVERED' ? 'border-emerald-700 text-emerald-400' :
                    s.status === 'IN_TRANSIT' ? 'border-blue-700 text-blue-400' :
                    'border-slate-700 text-slate-400'
                  }`}>{s.status}</span>
                </div>
                {s.carrier && (
                  <p className="text-slate-400">Carrier: <span className="text-white">{s.carrier}</span></p>
                )}
                {s.trackingNumber && (
                  <p className="text-slate-400">
                    Tracking #:{' '}
                    <span className="font-mono text-white">{s.trackingNumber}</span>
                  </p>
                )}
                {s.estimatedDelivery && (
                  <p className="text-xs text-slate-500">
                    Estimated delivery: {new Date(s.estimatedDelivery).toLocaleDateString()}
                  </p>
                )}
                {s.deliveredAt && (
                  <p className="text-xs text-emerald-400">
                    Delivered: {new Date(s.deliveredAt).toLocaleString()}
                  </p>
                )}
              </div>
            ))
          )}

          {/* No shipment yet — seller add form trigger */}
          {isSeller && (!order.shipments || order.shipments.length === 0) && !showShipForm && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">No tracking info added yet.</p>
              <button
                onClick={() => setShowShipForm(true)}
                className="rounded-lg border border-dashed border-slate-600 px-4 py-2 text-sm text-slate-400 hover:border-amber-500 hover:text-amber-400"
              >
                + Add tracking info
              </button>
            </div>
          )}

          {/* Buyer with no shipment */}
          {isBuyer && (!order.shipments || order.shipments.length === 0) && (
            <p className="text-xs text-slate-500">The seller hasn&apos;t added tracking info yet.</p>
          )}

          {/* Seller tracking form */}
          {showShipForm && (
            <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-900 p-4">
              <p className="text-sm font-medium text-slate-200">
                {order.shipments && order.shipments.length > 0 ? 'Update tracking' : 'Add tracking info'}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Carrier</label>
                  <input
                    value={shipCarrier}
                    onChange={(e) => setShipCarrier(e.target.value)}
                    placeholder="e.g. DHL, FedEx, GIG"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Tracking number</label>
                  <input
                    value={shipTracking}
                    onChange={(e) => setShipTracking(e.target.value)}
                    placeholder="e.g. 1Z999AA10123456784"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Estimated delivery date</label>
                <input
                  type="date"
                  value={shipEta}
                  onChange={(e) => setShipEta(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                />
              </div>
              {(createShipment.isError || updateShipment.isError) && (
                <p className="text-xs text-red-400">
                  {((createShipment.error ?? updateShipment.error) as Error)?.message}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    const payload = {
                      carrier: shipCarrier || undefined,
                      trackingNumber: shipTracking || undefined,
                      estimatedDelivery: shipEta || undefined,
                    };
                    if (order.shipments && order.shipments.length > 0) {
                      await updateShipment.mutateAsync(payload);
                    } else {
                      await createShipment.mutateAsync(payload);
                    }
                    setShowShipForm(false);
                  }}
                  disabled={createShipment.isPending || updateShipment.isPending}
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50"
                >
                  {createShipment.isPending || updateShipment.isPending ? 'Saving…' : 'Save tracking'}
                </button>
                <button
                  onClick={() => setShowShipForm(false)}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Timeline */}
      <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-300">Timeline</h3>
        <ol className="relative border-l border-slate-700 pl-4 space-y-4">
          {order.timeline.map((event) => (
            <li key={event.id} className="relative">
              <span className="absolute -left-[1.35rem] top-0.5 h-3 w-3 rounded-full border-2 border-slate-700 bg-amber-500" />
              <p className="text-sm font-medium">{event.status}</p>
              {event.note && <p className="text-xs text-slate-500">{event.note}</p>}
              <p className="text-xs text-slate-500">{new Date(event.createdAt).toLocaleString()}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Actions */}
      <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-300">Actions</h3>

        {needsPayment && (
          <div className="rounded-lg border border-amber-700 bg-amber-900/20 p-4 space-y-2">
            <p className="text-sm text-amber-300">Payment required to proceed</p>
            <button
              onClick={() => initiatePayment.mutate(order.id)}
              disabled={initiatePayment.isPending}
              className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50"
            >
              {initiatePayment.isPending ? 'Processing…' : 'Pay now'}
            </button>
          </div>
        )}

        <div className="space-y-2">
          <textarea
            value={statusNote}
            onChange={(e) => setStatusNote(e.target.value)}
            placeholder="Optional note for this status change"
            rows={2}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
          />
          <div className="flex flex-wrap gap-2">
            {canConfirm && (
              <ActionButton
                label="Confirm order"
                pending={updateStatus.isPending}
                onClick={() => updateStatus.mutate({ id: order.id, status: 'CONFIRMED', note: statusNote })}
              />
            )}
            {canShip && (
              <ActionButton
                label="Mark as fulfilled"
                pending={updateStatus.isPending}
                onClick={() => updateStatus.mutate({ id: order.id, status: 'FULFILLED', note: statusNote })}
              />
            )}
            {canDeliver && (
              <ActionButton
                label="Mark as delivered"
                pending={updateStatus.isPending}
                onClick={() => updateStatus.mutate({ id: order.id, status: 'DELIVERED', note: statusNote })}
              />
            )}
            {canComplete && (
              <ActionButton
                label="Complete order"
                pending={updateStatus.isPending}
                variant="success"
                onClick={() => updateStatus.mutate({ id: order.id, status: 'COMPLETED', note: statusNote })}
              />
            )}
            {canCancel && (
              <ActionButton
                label="Cancel order"
                pending={updateStatus.isPending}
                variant="danger"
                onClick={() => updateStatus.mutate({ id: order.id, status: 'CANCELLED', note: statusNote })}
              />
            )}
          </div>
        </div>

        {/* Dispute */}
        {canDispute && !showDisputeForm && (
          <button
            onClick={() => setShowDisputeForm(true)}
            className="text-sm text-orange-400 hover:text-orange-300 hover:underline"
          >
            Open a dispute →
          </button>
        )}

        {showDisputeForm && (
          <div className="rounded-lg border border-orange-800 bg-orange-950/30 p-4 space-y-3">
            <p className="text-sm font-medium text-orange-300">Open Dispute</p>
            <p className="text-xs text-slate-400">
              Describe the issue in detail. An admin will review and mediate within 2 business days.
            </p>
            <textarea
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="e.g. Item not received, item significantly not as described…"
              rows={3}
              className="w-full rounded-lg border border-orange-800 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
            />
            {openDispute.isError && (
              <p className="text-xs text-red-400">{(openDispute.error as Error)?.message}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (!disputeReason.trim()) return;
                  await openDispute.mutateAsync({ orderId: order.id, reason: disputeReason });
                  setShowDisputeForm(false);
                  setDisputeReason('');
                }}
                disabled={!disputeReason.trim() || openDispute.isPending}
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-500 disabled:opacity-50"
              >
                {openDispute.isPending ? 'Submitting…' : 'Submit dispute'}
              </button>
              <button
                onClick={() => { setShowDisputeForm(false); setDisputeReason(''); }}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <Link
          href={`/app/messages?orderId=${order.id}` as any}
          className="inline-block text-sm text-amber-400 hover:underline"
        >
          Message about this order →
        </Link>
      </section>
    </div>
  );
}

function ActionButton({
  label,
  pending,
  variant = 'default',
  onClick,
}: {
  label: string;
  pending: boolean;
  variant?: 'default' | 'success' | 'danger';
  onClick: () => void;
}) {
  const cls =
    variant === 'success'
      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
      : variant === 'danger'
        ? 'bg-red-700 hover:bg-red-600 text-white'
        : 'bg-slate-700 hover:bg-slate-600 text-white';
  return (
    <button
      onClick={onClick}
      disabled={pending}
      className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 ${cls}`}
    >
      {pending ? '…' : label}
    </button>
  );
}
