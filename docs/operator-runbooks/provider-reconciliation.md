# Provider Reconciliation Runbook

## Overview

This runbook covers reconciliation procedures for payment and shipping providers when local state diverges from provider state.

---

## Stripe

### PaymentIntent Success with Local Failure

1. Query Stripe Dashboard for the PaymentIntent ID
2. Confirm the charge succeeded on Stripe side
3. Call `POST /api/v1/orders/:id/payments/webhook` with a synthetic `payment_intent.succeeded` event
4. Verify order status advances to `PAID`
5. Verify escrow holding is created

### Webhook Replay / Duplicate Events

1. Stripe sends the same event twice (retry)
2. Backend uses `timingSafeEqual` HMAC comparison — duplicate events are idempotent
3. Verify the order status does not change on second delivery
4. Check `escrow_transactions` for no duplicate entries

### Refund Flow

1. Initiate refund via Stripe Dashboard or `POST /api/v1/payments/:id/refund`
2. Verify `payment_status` transitions to `REFUND_PENDING` → `REFUNDED`
3. Verify escrow status transitions to `REFUNDED`
4. Confirm funds return to buyer

---

## Paystack

### Charge Verification with Local Failure

1. Check Paystack Dashboard for transaction reference
2. Confirm charge succeeded on Paystack side
3. Call `POST /api/v1/orders/:id/payments/verify` with the transaction reference
4. Verify order status advances to `PAID`

### Transfer Recipient Type (GHS/KES — Unverified)

1. For GHS/KES currencies, Paystack requires `transferRecipientType`
2. This is currently marked as **unverified** — do not process payouts for GHS/KES
3. If needed, create transfer recipient with `type: "bank"` and verify on Paystack dashboard

### Webhook Signature Validation

1. Verify `x-paystack-signature` header matches HMAC-SHA512 of raw body
2. Invalid signatures are rejected with 401
3. Missing signatures are rejected with 401

---

## Shippo

### Label Purchase with Local Failure

1. Check Shippo Dashboard for the label purchase
2. Confirm label was purchased and tracking number generated
3. Call `POST /webhooks/shippo` with a synthetic `tracking_updated` event
4. Verify order shipment status updates

### Tracking Status Updates

1. Shippo sends `tracking_updated` webhook with new status
2. Backend maps status: `TRANSIT` → `IN_TRANSIT`, `DELIVERED` → `DELIVERED`, etc.
3. Verify `orderShipment.status` is updated
4. If `DELIVERED`, verify escrow auto-release countdown starts (5-day window)
5. Verify buyer receives delivery notification email

### Signature Rejection

1. Send webhook with missing `x-shippo-signature` header — expect 401
2. Send webhook with invalid signature — expect 401

### Idempotency

1. Send the same tracking update event twice
2. Verify `trackingEvent` records are not duplicated (findFirst check before create)
3. Verify shipment status update is idempotent

---

## Payouts

### Stripe Connect Onboarding

1. Seller initiates Stripe Connect onboarding via `POST /api/v1/payouts/connect`
2. Verify redirect URL is generated
3. After OAuth completion, verify `account_id` is stored
4. Check `payout_status` transitions to `PENDING`

### Stripe Connect Payout Failure

1. Monitor `transfer.failed` webhook event
2. Verify payout status transitions to `FAILED`
3. Verify seller is notified
4. Run reconciliation: compare `payouts` table with Stripe Balance transactions

### Reconciliation Procedure

1. Export all Stripe Balance transactions for the date range
2. Export `payouts` and `escrow_transactions` from the database
3. Compare by `orderId` and `amountCents`
4. Flag mismatches: amounts that exist in Stripe but not in local DB, or vice versa
5. For each mismatch, determine if it's a timing issue (pending) or a real discrepancy

---

## Emergency Procedures

### Provider Outage

1. Check provider status page (Stripe Status, Paystack Status, Shippo Status)
2. If provider is down, disable non-critical payment flows
3. Queue operations for retry when provider recovers
4. Notify users of potential delays

### Duplicate Payouts

1. Query provider for the payout transaction ID
2. Verify if funds were actually transferred
3. If duplicate, contact provider support for reversal
4. Log the incident and root cause

### Webhook Backlog

1. Check `order_shipment` table for stale `PENDING` shipments
2. Compare with Shippo tracking status
3. If backlog exceeds threshold, escalate to operations
4. Manually trigger webhook replay for overdue shipments
