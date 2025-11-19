import { z } from 'zod';

export const listingStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'PAUSED']);
export type ListingStatus = z.infer<typeof listingStatusSchema>;

export const listingVariantSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string(),
  priceCents: z.number().nonnegative(),
  currency: z.string().min(3).max(3).optional(),
  sku: z.string().nullable().optional(),
  inventoryCount: z.number().int().nonnegative().nullable().optional(),
  metadata: z.record(z.any()).nullable().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});
export type ListingVariant = z.infer<typeof listingVariantSchema>;

export const createListingVariantSchema = listingVariantSchema.pick({
  label: true,
  priceCents: true,
  currency: true,
  sku: true,
  inventoryCount: true,
  metadata: true,
});
export type CreateListingVariantDto = z.infer<typeof createListingVariantSchema>;

export const createListingSchema = z.object({
  sellerId: z.string(),
  title: z.string().min(3),
  description: z.string().min(10),
  priceCents: z.number().int().positive(),
  currency: z.string().length(3).optional(),
  status: listingStatusSchema.optional(),
  location: z.string().optional(),
  metadata: z.record(z.any()).nullable().optional(),
  variants: z.array(createListingVariantSchema).optional(),
});
export type CreateListingDto = z.infer<typeof createListingSchema>;

export const updateListingSchema = createListingSchema.partial();
export type UpdateListingDto = z.infer<typeof updateListingSchema>;

export const listingImageSchema = z.object({
  id: z.string().uuid(),
  bucket: z.string().optional(),
  storageKey: z.string().optional(),
  url: z.string().optional(),
  mimeType: z.string().nullable().optional(),
  fileSize: z.number().int().nullable().optional(),
  width: z.number().int().nullable().optional(),
  height: z.number().int().nullable().optional(),
  position: z.number().int().nullable().optional(),
  createdAt: z.string().datetime().optional(),
});
export type ListingImage = z.infer<typeof listingImageSchema>;

export const safeListingSchema = z.object({
  id: z.string().uuid(),
  sellerId: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  priceCents: z.number().nonnegative(),
  currency: z.string().min(3).max(3),
  status: listingStatusSchema,
  moderationStatus: z.string().optional(),
  location: z.string().nullable().optional(),
  metadata: z.record(z.any()).nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  variants: z.array(listingVariantSchema).default([]),
  images: z.array(listingImageSchema).default([]),
});
export type SafeListing = z.infer<typeof safeListingSchema>;

export const listingSearchResponseSchema = z.object({
  data: z.array(safeListingSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  pageCount: z.number().int(),
});
export type ListingSearchResponse = z.infer<typeof listingSearchResponseSchema>;

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export const orderStatusSchema = z.enum([
  'PENDING',
  'CONFIRMED',
  'PAID',
  'FULFILLED',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
  'REFUNDED',
  'DISPUTED',
]);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const paymentStatusSchema = z.enum(['PENDING', 'AUTHORIZED', 'CAPTURED', 'SETTLED', 'FAILED', 'REFUNDED']);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export const shipmentStatusSchema = z.enum([
  'PENDING',
  'LABEL_CREATED',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'RETURNED',
  'CANCELLED',
]);
export type ShipmentStatus = z.infer<typeof shipmentStatusSchema>;

export const escrowStatusSchema = z.enum(['HOLDING', 'RELEASED', 'REFUNDED', 'DISPUTED']);
export type EscrowStatus = z.infer<typeof escrowStatusSchema>;

export const orderItemSchema = z.object({
  id: z.string().uuid(),
  listingId: z.string().uuid(),
  listingTitle: z.string(),
  variantId: z.string().uuid().nullable().optional(),
  variantLabel: z.string().nullable().optional(),
  quantity: z.number().int(),
  unitPriceCents: z.number().int(),
  currency: z.string(),
  metadata: z.record(z.any()).nullable().optional(),
});
export type OrderItem = z.infer<typeof orderItemSchema>;

export const orderShipmentSchema = z.object({
  id: z.string().uuid(),
  carrier: z.string().nullable().optional(),
  serviceLevel: z.string().nullable().optional(),
  trackingNumber: z.string().nullable().optional(),
  status: shipmentStatusSchema,
  shippedAt: z.string().datetime().nullable().optional(),
  deliveredAt: z.string().datetime().nullable().optional(),
});
export type OrderShipment = z.infer<typeof orderShipmentSchema>;

export const orderTimelineSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  status: orderStatusSchema,
  note: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
});
export type OrderTimelineEvent = z.infer<typeof orderTimelineSchema>;

export const escrowHoldingSchema = z.object({
  id: z.string().uuid(),
  status: escrowStatusSchema,
  amountCents: z.number().int(),
  currency: z.string(),
  releaseDate: z.string().datetime().nullable().optional(),
});
export type EscrowHolding = z.infer<typeof escrowHoldingSchema>;

export const safeOrderSchema = z.object({
  id: z.string().uuid(),
  orderNumber: z.string(),
  buyerId: z.string().uuid(),
  sellerId: z.string().uuid(),
  status: orderStatusSchema,
  paymentStatus: paymentStatusSchema,
  totalItemCents: z.number().int(),
  shippingCents: z.number().int(),
  feeCents: z.number().int(),
  currency: z.string(),
  metadata: z.record(z.any()).nullable().optional(),
  placedAt: z.string().datetime().nullable().optional(),
  timeline: z.array(orderTimelineSchema).default([]),
  items: z.array(orderItemSchema).default([]),
  shipments: z.array(orderShipmentSchema).default([]),
  escrow: escrowHoldingSchema.nullable().optional(),
});
export type SafeOrder = z.infer<typeof safeOrderSchema>;

export const messageAttachmentSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  fileName: z.string(),
  mimeType: z.string().nullable().optional(),
  fileSize: z.number().int().nullable().optional(),
  metadata: z.record(z.any()).nullable().optional(),
});
export type MessageAttachment = z.infer<typeof messageAttachmentSchema>;

export const messageReceiptSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  deliveredAt: z.string().datetime().nullable().optional(),
  readAt: z.string().datetime().nullable().optional(),
});
export type MessageReceipt = z.infer<typeof messageReceiptSchema>;

export const messageSchema = z.object({
  id: z.string().uuid(),
  threadId: z.string().uuid(),
  authorId: z.string().uuid(),
  body: z.string(),
  status: z.enum(['SENT', 'DELIVERED', 'READ', 'DELETED']).default('SENT'),
  moderationStatus: z.enum(['PENDING', 'APPROVED', 'FLAGGED', 'REJECTED']).default('PENDING'),
  moderationNotes: z.string().nullable().optional(),
  metadata: z.record(z.any()).nullable().optional(),
  createdAt: z.string().datetime(),
  attachments: z.array(messageAttachmentSchema).default([]),
  receipts: z.array(messageReceiptSchema).default([]),
});
export type Message = z.infer<typeof messageSchema>;

export const participantSchema = z.object({
  id: z.string().uuid(),
  threadId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(['BUYER', 'SELLER', 'ADMIN', 'SYSTEM']).default('BUYER'),
});
export type ThreadParticipant = z.infer<typeof participantSchema>;

export const messageThreadSchema = z.object({
  id: z.string().uuid(),
  listingId: z.string().uuid().nullable().optional(),
  subject: z.string().nullable().optional(),
  metadata: z.record(z.any()).nullable().optional(),
  createdAt: z.string().datetime(),
  participants: z.array(participantSchema).default([]),
  messages: z.array(messageSchema).default([]),
});
export type SafeMessageThread = z.infer<typeof messageThreadSchema>;

export const loginPayloadSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});
export type LoginPayload = z.infer<typeof loginPayloadSchema>;

export const registerPayloadSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
});
export type RegisterPayload = z.infer<typeof registerPayloadSchema>;

export const authResponseSchema = z.object({
  accessToken: z.string(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string().nullable().optional(),
    role: z.string().optional(),
  }),
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

export const createOrderItemSchema = z.object({
  listingId: z.string().uuid(),
  variantId: z.string().uuid().nullable().optional(),
  quantity: z.number().int().min(1).default(1),
});
export const createOrderSchema = z.object({
  buyerId: z.string().uuid(),
  sellerId: z.string().uuid(),
  items: z.array(createOrderItemSchema).min(1),
  shippingAddressId: z.string().uuid().nullable().optional(),
  billingAddressId: z.string().uuid().nullable().optional(),
  shippingCents: z.number().int().nonnegative().nullable().optional(),
  feeCents: z.number().int().nonnegative().nullable().optional(),
  currency: z.string().length(3).default('USD'),
  metadata: z.record(z.any()).nullable().optional(),
});
export type CreateOrderDto = z.infer<typeof createOrderSchema>;

export const updateOrderStatusSchema = z.object({
  status: orderStatusSchema,
  note: z.string().max(500).nullable().optional(),
  actorId: z.string().uuid().nullable().optional(),
  providerStatus: z.string().max(64).nullable().optional(),
});
export type UpdateOrderStatusDto = z.infer<typeof updateOrderStatusSchema>;

export const sendMessageSchema = z.object({
  authorId: z.string().uuid(),
  body: z.string().min(1).max(2000),
  metadata: z.record(z.any()).nullable().optional(),
});
export type SendMessageDto = z.infer<typeof sendMessageSchema>;

export const createThreadSchema = z.object({
  listingId: z.string().uuid().nullable().optional(),
  subject: z.string().max(120).nullable().optional(),
  metadata: z.record(z.any()).nullable().optional(),
  participants: z
    .array(
      z.object({
        userId: z.string().uuid(),
        role: z.enum(['BUYER', 'SELLER', 'ADMIN', 'SYSTEM']).default('BUYER'),
      }),
    )
    .min(2),
  initialMessage: sendMessageSchema.nullable().optional(),
});
export type CreateThreadDto = z.infer<typeof createThreadSchema>;

export const listingSearchParamsSchema = z.object({
  keyword: z.string().optional(),
  sellerId: z.string().uuid().optional(),
  status: listingStatusSchema.optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(12),
});
export type ListingSearchParams = z.infer<typeof listingSearchParamsSchema>;

export interface UploadResult {
  message: string;
  image?: ListingImage;
}
