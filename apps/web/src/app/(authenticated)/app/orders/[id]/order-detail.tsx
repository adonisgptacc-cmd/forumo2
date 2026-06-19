'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useOrder, useUpdateOrderStatus, useInitiatePayment, useOpenDispute, useEscrowDetails, useAddDisputeMessage, useShipmentMutations, useGetShippingRates, usePurchaseLabel } from '../../../../../lib/react-query/hooks';
import { useCurrentUser } from '../../../../../lib/react-query/hooks';
import { useState } from 'react';
import type { SafeOrder, ShippingRate } from '@forumo/shared';

const inputCls =
  'w-full rounded-lg border border-[color:var(--line-2)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-3)] transition-[border-color,box-shadow] focus:border-[color:var(--accent)] focus:outline-none focus:shadow-[0_0_0_3px_var(--ring-accent)]';

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'text-amber-700 border-amber-200 bg-amber-50',
  CONFIRMED: 'text-blue-700 border-blue-200 bg-blue-50',
  PROCESSING: 'text-blue-700 border-blue-200 bg-blue-50',
  SHIPPED: 'text-indigo-700 border-indigo-200 bg-indigo-50',
  DELIVERED: 'text-emerald-700 border-emerald-200 bg-emerald-50',
  COMPLETED: 'text-emerald-700 border-emerald-200 bg-emerald-50',
  CANCELLED: 'text-red-700 border-red-200 bg-red-50',
  DISPUTED: 'text-orange-700 border-orange-200 bg-orange-50',
  REFUNDED: 'text-[color:var(--ink-3)] border-[color:var(--line)] bg-[color:var(--surface-2)]',
};

const ESCROW_COLORS: Record<string, string> = {
  HOLDING: 'text-amber-700 border-amber-200 bg-amber-50',
  RELEASED: 'text-emerald-700 border-emerald-200 bg-emerald-50',
  REFUNDED: 'text-[color:var(--ink-3)] border-[color:var(--line)] bg-[color:var(--surface-2)]',
  DISPUTED: 'text-orange-700 border-orange-200 bg-orange-50',
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
  const getShippingRates = useGetShippingRates();
  const purchaseLabel = usePurchaseLabel(id);
  const [statusNote, setStatusNote] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeMsg, setDisputeMsg] = useState('');
  const [showShipForm, setShowShipForm] = useState(false);
  const [shipCarrier, setShipCarrier] = useState('');
  const [shipTracking, setShipTracking] = useState('');
  const [shipEta, setShipEta] = useState('');
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [showLabelPanel, setShowLabelPanel] = useState(false);
  const [labelFromName, setLabelFromName] = useState('');
  const [labelFromStreet, setLabelFromStreet] = useState('');
  const [labelFromCity, setLabelFromCity] = useState('');
  const [labelFromCountry, setLabelFromCountry] = useState('');
  const [labelWeight, setLabelWeight] = useState('500');
  const [labelLength, setLabelLength] = useState('20');
  const [labelWidth, setLabelWidth] = useState('15');
  const [labelHeight, setLabelHeight] = useState('10');
  const [shippingRates, setShippingRates] = useState<ShippingRate[]>([]);
  const [selectedRateId, setSelectedRateId] = useState<string | null>(null);
  const [labelResult, setLabelResult] = useState<{ labelUrl: string; trackingNumber: string; carrier: string } | null>(null);
  const searchParams = useSearchParams();
  const stripeRedirectStatus = searchParams?.get('redirect_status');

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="skeleton h-24 rounded-[14px]" />)}
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-700">Order not found or you don&apos;t have access.</p>
        <Link href={"/app/orders" as any} className="mt-3 inline-block text-sm text-[color:var(--accent)] hover:underline">
          ← Back to orders
        </Link>
      </div>
    );
  }

  const isBuyer = user?.id === order.buyerId;
  const isSeller = user?.id === order.sellerId;
  const totalCents = order.totalItemCents + order.shippingCents + order.feeCents;
  const statusColor = STATUS_COLORS[order.status] ?? 'text-[color:var(--ink-3)] border-[color:var(--line)]';

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
  const canRequestRefund =
    isBuyer &&
    order.escrow?.status === 'HOLDING' &&
    !['CANCELLED', 'REFUNDED', 'DISPUTED', 'COMPLETED', 'PENDING'].includes(order.status);

  const canReturn = isBuyer && order.status === 'DELIVERED';

  const needsPayment =
    isBuyer &&
    order.status !== 'CANCELLED' &&
    order.status !== 'REFUNDED' &&
    (!order.payments || order.payments.length === 0 || order.payments.every((p) => p.status !== 'SETTLED' && p.status !== 'CAPTURED'));

  return (
    <div className="space-y-6">
      {stripeRedirectStatus === 'succeeded' && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3 fade-up">
          <span className="text-2xl text-[color:var(--escrow)]">✓</span>
          <div>
            <p className="font-semibold text-[color:var(--escrow)]">Payment confirmed</p>
            <p className="text-sm muted">Your payment was processed successfully. The order will update shortly.</p>
          </div>
        </div>
      )}
      {stripeRedirectStatus === 'failed' && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 fade-up">
          <p className="font-semibold text-red-700">Payment failed</p>
          <p className="text-sm muted">Your card was not charged. Please try again from your order page.</p>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={"/app/orders" as any} className="text-xs muted hover:text-[color:var(--ink)]">
            ← Orders
          </Link>
          <h2 className="mt-1 h2">Order {order.orderNumber}</h2>
          <p className="text-sm muted">
            Placed {order.placedAt ? new Date(order.placedAt).toLocaleString() : 'N/A'}
          </p>
        </div>
        <span className={`rounded-full border px-4 py-1 text-sm font-medium ${statusColor}`}>
          {order.status}
        </span>
      </div>

      {/* Items */}
      <section className="card card-pad space-y-3">
        <h3 className="h3">Items</h3>
        <ul className="divide-y divide-[color:var(--line)]">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium">{item.listingTitle}</p>
                {item.variantLabel && (
                  <p className="text-xs muted">{item.variantLabel}</p>
                )}
                <p className="text-xs muted">Qty: {item.quantity}</p>
              </div>
              <p className="text-sm subtle">
                {(item.unitPriceCents * item.quantity / 100).toFixed(2)} {item.currency}
              </p>
            </li>
          ))}
        </ul>
        <div className="border-t border-[color:var(--line)] pt-3 space-y-1 text-sm">
          <div className="flex justify-between muted">
            <span>Items subtotal</span>
            <span>{(order.totalItemCents / 100).toFixed(2)} {order.currency}</span>
          </div>
          {order.shippingCents > 0 && (
            <div className="flex justify-between muted">
              <span>Shipping</span>
              <span>{(order.shippingCents / 100).toFixed(2)} {order.currency}</span>
            </div>
          )}
          {order.feeCents > 0 && (
            <div className="flex justify-between muted">
              <span>Platform fee</span>
              <span>{(order.feeCents / 100).toFixed(2)} {order.currency}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-[color:var(--ink)] pt-1">
            <span>Total</span>
            <span>{(totalCents / 100).toFixed(2)} {order.currency}</span>
          </div>
        </div>
      </section>

      {/* Escrow */}
      {order.escrow && (
        <section className="card card-pad space-y-2">
          <h3 className="h3">Escrow</h3>
          <div className="flex items-center justify-between">
            <span className="text-sm muted">
              {(order.escrow.amountCents / 100).toFixed(2)} {order.escrow.currency}
            </span>
            <span className={`rounded-full border px-3 py-0.5 text-xs font-medium ${ESCROW_COLORS[order.escrow.status] ?? 'text-[color:var(--ink-3)] border-[color:var(--line)]'}`}>
              {order.escrow.status}
            </span>
          </div>
          {order.escrow.releaseDate && (
            <p className="text-xs muted">
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
          <section className="rounded-xl border border-orange-200 bg-orange-50 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-orange-700">Active Dispute</h3>
              <span className="text-xs rounded-full border border-orange-300 px-2 py-0.5 text-orange-700">{dispute.status}</span>
            </div>
            <p className="text-xs muted">Reason: <span className="subtle">{dispute.reason}</span></p>

            {/* Messages */}
            <div className="space-y-2">
              {(dispute.messages ?? []).length === 0 && (
                <p className="text-xs muted">No messages yet. Add a message below to communicate with the admin.</p>
              )}
              {(dispute.messages ?? []).map((msg: any) => (
                <div
                  key={msg.id}
                  className={`rounded-lg p-3 text-sm ${msg.authorId === user?.id ? 'bg-orange-100 ml-8' : 'bg-[color:var(--surface-2)] mr-8'}`}
                >
                  <p className="text-xs muted mb-1">{msg.author?.name ?? 'Unknown'}</p>
                  <p className="subtle">{msg.body}</p>
                  <p className="text-xs muted mt-1">{new Date(msg.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>

            {/* Resolution banner */}
            {dispute.status === 'RESOLVED' && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 space-y-1">
                <p className="text-sm font-semibold text-[color:var(--escrow)]">✅ Dispute resolved</p>
                {dispute.resolutionNotes && (
                  <p className="text-xs subtle">{dispute.resolutionNotes}</p>
                )}
                <p className="text-xs muted">
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
                  className={`flex-1 ${inputCls}`}
                />
                <button
                  onClick={async () => {
                    if (!disputeMsg.trim()) return;
                    await addDisputeMessage.mutateAsync({ disputeId: dispute.id, orderId: id, body: disputeMsg });
                    setDisputeMsg('');
                  }}
                  disabled={!disputeMsg.trim() || addDisputeMessage.isPending}
                  className="self-end rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
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
        <section className="card card-pad space-y-2">
          <h3 className="h3">Payments</h3>
          <ul className="space-y-2">
            {order.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between text-sm">
                <span className="muted capitalize">{p.provider}</span>
                <span className={p.status === 'SETTLED' || p.status === 'CAPTURED' ? 'text-[color:var(--escrow)]' : p.status === 'FAILED' ? 'text-red-600' : 'text-amber-700'}>
                  {p.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Shipment tracking */}
      {(order.status === 'FULFILLED' || order.status === 'DELIVERED' || order.status === 'COMPLETED' || (order.shipments && order.shipments.length > 0)) && (
        <section className="card card-pad space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="h3">Shipment &amp; Tracking</h3>
            {isSeller && order.shipments && order.shipments.length > 0 && !showShipForm && (
              <button
                onClick={() => {
                  const s = order.shipments[0];
                  setShipCarrier(s.carrier ?? '');
                  setShipTracking(s.trackingNumber ?? '');
                  setShipEta(s.estimatedDelivery ? new Date(s.estimatedDelivery).toISOString().split('T')[0] : '');
                  setShowShipForm(true);
                }}
                className="text-xs text-[color:var(--accent)] hover:underline"
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
                    s.status === 'DELIVERED' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                    s.status === 'IN_TRANSIT' ? 'border-blue-200 bg-blue-50 text-blue-700' :
                    'border-[color:var(--line)] text-[color:var(--ink-3)]'
                  }`}>{s.status}</span>
                </div>
                {s.carrier && (
                  <p className="muted">Carrier: <span className="text-[color:var(--ink)]">{s.carrier}</span></p>
                )}
                {s.trackingNumber && (
                  <p className="muted">
                    Tracking #:{' '}
                    <span className="font-mono text-[color:var(--ink)]">{s.trackingNumber}</span>
                  </p>
                )}
                {s.estimatedDelivery && (
                  <p className="text-xs muted">
                    Estimated delivery: {new Date(s.estimatedDelivery).toLocaleDateString()}
                  </p>
                )}
                {s.deliveredAt && (
                  <p className="text-xs text-[color:var(--escrow)]">
                    Delivered: {new Date(s.deliveredAt).toLocaleString()}
                  </p>
                )}
              </div>
            ))
          )}

          {/* No shipment yet — seller add form trigger */}
          {isSeller && (!order.shipments || order.shipments.length === 0) && !showShipForm && (
            <div className="space-y-2">
              <p className="text-xs muted">No tracking info added yet.</p>
              <button
                onClick={() => setShowShipForm(true)}
                className="rounded-lg border border-dashed border-[color:var(--line-2)] px-4 py-2 text-sm muted transition-colors hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
              >
                + Add tracking info
              </button>
            </div>
          )}

          {/* Buyer with no shipment */}
          {isBuyer && (!order.shipments || order.shipments.length === 0) && (
            <p className="text-xs muted">The seller hasn&apos;t added tracking info yet.</p>
          )}

          {/* Seller tracking form */}
          {showShipForm && (
            <div className="space-y-3 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface-2)] p-4">
              <p className="text-sm font-medium subtle">
                {order.shipments && order.shipments.length > 0 ? 'Update tracking' : 'Add tracking info'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs muted">Carrier</label>
                  <input
                    value={shipCarrier}
                    onChange={(e) => setShipCarrier(e.target.value)}
                    placeholder="e.g. DHL, FedEx, GIG"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs muted">Tracking number</label>
                  <input
                    value={shipTracking}
                    onChange={(e) => setShipTracking(e.target.value)}
                    placeholder="e.g. 1Z999AA10123456784"
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs muted">Estimated delivery date</label>
                <input
                  type="date"
                  value={shipEta}
                  onChange={(e) => setShipEta(e.target.value)}
                  className={inputCls + ' w-auto'}
                />
              </div>
              {(createShipment.isError || updateShipment.isError) && (
                <p className="text-xs text-red-600">
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
                  className="btn btn-primary btn-sm"
                >
                  {createShipment.isPending || updateShipment.isPending ? 'Saving…' : 'Save tracking'}
                </button>
                <button
                  onClick={() => setShowShipForm(false)}
                  className="btn btn-ghost btn-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Purchase / Print Label — seller only, when order is CONFIRMED or PAID */}
      {isSeller && (order.status === 'CONFIRMED' || order.status === 'PAID') && (
        <section className="card card-pad space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="h3">Shipping Label</h3>
            {/* Show existing label URL if present */}
            {order.shipments?.[0]?.labelUrl && (
              <a
                href={order.shipments[0].labelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[color:var(--accent)] hover:underline"
              >
                Download label ↗
              </a>
            )}
          </div>

          {labelResult && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-2">
              <p className="text-sm font-semibold text-[color:var(--escrow)]">Label purchased!</p>
              <p className="text-xs muted">
                Carrier: <span className="text-[color:var(--ink)]">{labelResult.carrier}</span> ·
                Tracking: <span className="font-mono text-[color:var(--ink)]">{labelResult.trackingNumber}</span>
              </p>
              <a
                href={labelResult.labelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-sm"
              >
                Download Label PDF ↗
              </a>
            </div>
          )}

          {!labelResult && !showLabelPanel && (
            <button
              onClick={() => setShowLabelPanel(true)}
              className="rounded-lg border border-dashed border-[color:var(--line-2)] px-4 py-2 text-sm muted transition-colors hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
            >
              + Purchase shipping label via Shippo
            </button>
          )}

          {!labelResult && showLabelPanel && (
            <div className="space-y-4 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface-2)] p-4">
              <p className="text-xs muted">Enter your address and parcel info to get carrier rates from Shippo.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs muted">Your name / business</label>
                  <input
                    value={labelFromName}
                    onChange={(e) => setLabelFromName(e.target.value)}
                    placeholder="Forumo Seller"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs muted">Street address</label>
                  <input
                    value={labelFromStreet}
                    onChange={(e) => setLabelFromStreet(e.target.value)}
                    placeholder="123 Main St"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs muted">City</label>
                  <input
                    value={labelFromCity}
                    onChange={(e) => setLabelFromCity(e.target.value)}
                    placeholder="Accra"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs muted">Country (2-letter code)</label>
                  <input
                    value={labelFromCountry}
                    onChange={(e) => setLabelFromCountry(e.target.value.toUpperCase())}
                    placeholder="GH"
                    maxLength={2}
                    className={inputCls + ' uppercase'}
                  />
                </div>
              </div>

              <p className="text-xs font-medium subtle">Parcel dimensions</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Weight (g)', value: labelWeight, setter: setLabelWeight },
                  { label: 'Length (cm)', value: labelLength, setter: setLabelLength },
                  { label: 'Width (cm)', value: labelWidth, setter: setLabelWidth },
                  { label: 'Height (cm)', value: labelHeight, setter: setLabelHeight },
                ].map(({ label, value, setter }) => (
                  <div key={label}>
                    <label className="mb-1 block text-xs muted">{label}</label>
                    <input
                      type="number"
                      min="1"
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                ))}
              </div>

              {getShippingRates.isError && (
                <p className="text-xs text-red-600">{(getShippingRates.error as Error)?.message}</p>
              )}

              {shippingRates.length === 0 && (
                <button
                  disabled={getShippingRates.isPending || !labelFromName || !labelFromStreet || !labelFromCity || !labelFromCountry}
                  onClick={async () => {
                    const toAddr = (order as any).shippingAddress as any;
                    const rates = await getShippingRates.mutateAsync({
                      fromAddress: {
                        name: labelFromName,
                        street1: labelFromStreet,
                        city: labelFromCity,
                        country: labelFromCountry,
                      },
                      toAddress: {
                        name: toAddr?.fullName ?? 'Buyer',
                        street1: toAddr?.line1 ?? 'Unknown',
                        city: toAddr?.city ?? 'Unknown',
                        country: toAddr?.country ?? 'GH',
                      },
                      parcel: {
                        weight: Number(labelWeight) || 500,
                        length: Number(labelLength) || 20,
                        width: Number(labelWidth) || 15,
                        height: Number(labelHeight) || 10,
                      },
                    });
                    setShippingRates(rates);
                  }}
                  className="btn btn-ink btn-sm"
                >
                  {getShippingRates.isPending ? 'Getting rates…' : 'Get Shipping Rates'}
                </button>
              )}

              {shippingRates.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium subtle">Select a carrier</p>
                  {shippingRates.map((rate) => (
                    <button
                      key={rate.rateId}
                      type="button"
                      onClick={() => setSelectedRateId(rate.rateId)}
                      className={`w-full text-left rounded-lg border p-3 text-sm transition-colors ${
                        selectedRateId === rate.rateId
                          ? 'border-[color:var(--accent)] bg-[color:var(--accent-bg)]'
                          : 'border-[color:var(--line-2)] hover:border-[color:var(--ink-3)]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-[color:var(--ink)]">{rate.carrier} — {rate.service}</span>
                        <span className="text-[color:var(--accent)] font-semibold">
                          {(rate.price / 100).toFixed(2)} {rate.currency}
                        </span>
                      </div>
                      {rate.estimatedDays != null && (
                        <p className="text-xs muted mt-0.5">{rate.estimatedDays} day{rate.estimatedDays !== 1 ? 's' : ''} estimated</p>
                      )}
                    </button>
                  ))}
                  {purchaseLabel.isError && (
                    <p className="text-xs text-red-600">{(purchaseLabel.error as Error)?.message}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      disabled={!selectedRateId || purchaseLabel.isPending}
                      onClick={async () => {
                        if (!selectedRateId) return;
                        const result = await purchaseLabel.mutateAsync(selectedRateId);
                        setLabelResult(result);
                        setShowLabelPanel(false);
                      }}
                      className="btn btn-primary btn-sm"
                    >
                      {purchaseLabel.isPending ? 'Purchasing…' : 'Purchase Label'}
                    </button>
                    <button
                      onClick={() => { setShippingRates([]); setSelectedRateId(null); }}
                      className="btn btn-ghost btn-sm"
                    >
                      Change details
                    </button>
                  </div>
                </div>
              )}

              {shippingRates.length === 0 && (
                <button
                  onClick={() => setShowLabelPanel(false)}
                  className="text-xs muted hover:text-[color:var(--ink)]"
                >
                  Cancel
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {/* Timeline */}
      <section className="card card-pad space-y-3">
        <h3 className="h3">Timeline</h3>
        <ol className="relative border-l border-[color:var(--line-2)] pl-4 space-y-4">
          {order.timeline.map((event) => (
            <li key={event.id} className="relative">
              <span className="absolute -left-[1.35rem] top-0.5 h-3 w-3 rounded-full border-2 border-[color:var(--surface)] bg-[color:var(--accent)]" />
              <p className="text-sm font-medium">{event.status}</p>
              {event.note && <p className="text-xs muted">{event.note}</p>}
              <p className="text-xs muted">{new Date(event.createdAt).toLocaleString()}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Actions */}
      <section className="card card-pad space-y-4">
        <h3 className="h3">Actions</h3>

        {needsPayment && (
          <div className="rounded-lg p-4 space-y-2" style={{ background: 'var(--accent-bg)' }}>
            <p className="text-sm text-[color:var(--accent-2)] font-medium">Payment required to proceed</p>
            <button
              onClick={() => initiatePayment.mutate(order.id)}
              disabled={initiatePayment.isPending}
              className="btn btn-primary btn-sm"
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
            className={inputCls}
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

        {/* Return request */}
        {canReturn && (
          <Link
            href={`/app/orders/${order.id}/return` as any}
            className="inline-block text-sm text-indigo-600 hover:text-indigo-700 hover:underline"
          >
            Request a return →
          </Link>
        )}

        {/* Dispute */}
        {canDispute && !showDisputeForm && (
          <button
            onClick={() => setShowDisputeForm(true)}
            className="text-sm text-orange-600 hover:text-orange-700 hover:underline"
          >
            Open a dispute →
          </button>
        )}

        {showDisputeForm && (
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 space-y-3">
            <p className="text-sm font-medium text-orange-700">Open Dispute</p>
            <p className="text-xs muted">
              Describe the issue in detail. An admin will review and mediate within 2 business days.
            </p>
            <textarea
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="e.g. Item not received, item significantly not as described…"
              rows={3}
              className={inputCls}
            />
            {openDispute.isError && (
              <p className="text-xs text-red-600">{(openDispute.error as Error)?.message}</p>
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
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
              >
                {openDispute.isPending ? 'Submitting…' : 'Submit dispute'}
              </button>
              <button
                onClick={() => { setShowDisputeForm(false); setDisputeReason(''); }}
                className="btn btn-ghost btn-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Refund request */}
        {canRequestRefund && !showRefundForm && (
          <button
            onClick={() => setShowRefundForm(true)}
            className="text-sm text-red-600 hover:text-red-700 hover:underline"
          >
            Request a refund →
          </button>
        )}

        {showRefundForm && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
            <p className="text-sm font-medium text-red-700">Request Refund</p>
            <p className="text-xs muted">
              Describe the issue. The seller will be notified and an admin may review the request.
            </p>
            <textarea
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="e.g. Item not as described, damaged on arrival, never received…"
              rows={3}
              className={inputCls}
            />
            {updateStatus.isError && (
              <p className="text-xs text-red-600">{(updateStatus.error as Error)?.message}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (!refundReason.trim()) return;
                  updateStatus.mutate({ id: order.id, status: 'REFUNDED', note: refundReason });
                }}
                disabled={!refundReason.trim() || updateStatus.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {updateStatus.isPending ? 'Processing…' : 'Submit refund request'}
              </button>
              <button
                onClick={() => { setShowRefundForm(false); setRefundReason(''); }}
                className="btn btn-ghost btn-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <Link
          href={`/app/messages?orderId=${order.id}` as any}
          className="inline-block text-sm text-[color:var(--accent)] hover:underline"
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
      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
      : variant === 'danger'
        ? 'bg-red-600 hover:bg-red-700 text-white'
        : 'bg-[color:var(--ink)] hover:bg-[oklch(0.30_0.012_50)] text-white';
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
