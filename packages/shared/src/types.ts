import { z } from 'zod';

export const userRoleSchema = z.enum(['BUYER', 'SELLER', 'ADMIN', 'MODERATOR']);
export type UserRole = z.infer<typeof userRoleSchema>;

export const kycStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'NOT_REQUIRED']);
export type KycStatus = z.infer<typeof kycStatusSchema>;

export const disputeStatusSchema = z.enum(['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'ESCALATED']);
export type DisputeStatus = z.infer<typeof disputeStatusSchema>;

export const safeUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable().optional(),
  role: userRoleSchema,
  avatarUrl: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  trustScore: z.number().int().optional(),
  tosVersion: z.string().nullable().optional(),
  termsAcceptedAt: z.union([z.string(), z.date()]).nullable().optional(),
  deletionScheduledAt: z.union([z.string(), z.date()]).nullable().optional(),
});
export type SafeUser = z.infer<typeof safeUserSchema>;

export const listingStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'PAUSED', 'SUSPENDED']);
export type ListingStatus = z.infer<typeof listingStatusSchema>;
export const listingModerationStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'FLAGGED']);
export type ListingModerationStatus = z.infer<typeof listingModerationStatusSchema>;

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
  sellerId: z.string().optional(),
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
  url: z.string().optional().default(''),
  mimeType: z.string().nullable().optional(),
  fileSize: z.number().int().nullable().optional(),
  width: z.number().int().nullable().optional(),
  height: z.number().int().nullable().optional(),
  position: z.number().int().nullable().optional(),
  createdAt: z.string().datetime().optional(),
});
export type ListingImage = z.infer<typeof listingImageSchema>;

export const safeListingSchema = z.object({
  id: z.string(),
  sellerId: z.string(),
  title: z.string(),
  description: z.string(),
  priceCents: z.number().nonnegative(),
  currency: z.string().min(3).max(3),
  status: listingStatusSchema,
  moderationStatus: z.string().optional(),
  location: z.string().nullable().optional(),
  metadata: z.record(z.any()).nullable().optional(),
  createdAt: z.string().datetime().or(z.string()),
  updatedAt: z.string().datetime().or(z.string()),
  variants: z.array(listingVariantSchema).default([]),
  images: z.array(listingImageSchema).default([]),
});
export type SafeListing = z.infer<typeof safeListingSchema>;

export const listingSearchResponseSchema = z.object({
  data: z.array(safeListingSchema),
  total: z.coerce.number().int(),
  page: z.coerce.number().int(),
  pageSize: z.coerce.number().int(),
  pageCount: z.coerce.number().int(),
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
  labelUrl: z.string().nullable().optional(),
  estimatedDelivery: z.string().datetime().nullable().optional(),
});
export type OrderShipment = z.infer<typeof orderShipmentSchema>;

export const shippingRateSchema = z.object({
  rateId: z.string(),
  carrier: z.string(),
  service: z.string(),
  price: z.number().int(),
  currency: z.string(),
  estimatedDays: z.number().int().nullable(),
});
export type ShippingRate = z.infer<typeof shippingRateSchema>;

export const shippoAddressSchema = z.object({
  name: z.string(),
  street1: z.string(),
  city: z.string(),
  country: z.string(),
  state: z.string().optional(),
  zip: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
});
export type ShippoAddress = z.infer<typeof shippoAddressSchema>;

export const shippoParcelSchema = z.object({
  weight: z.number().positive(),
  length: z.number().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
});
export type ShippoParcel = z.infer<typeof shippoParcelSchema>;

export const purchasedLabelSchema = z.object({
  labelUrl: z.string(),
  trackingNumber: z.string(),
  carrier: z.string(),
  estimatedDelivery: z.string().datetime().nullable(),
});
export type PurchasedLabel = z.infer<typeof purchasedLabelSchema>;

export const orderTimelineSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  status: orderStatusSchema,
  note: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
});
export type OrderTimelineEvent = z.infer<typeof orderTimelineSchema>;

export const paymentTransactionSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  provider: z.string(),
  status: paymentStatusSchema,
  providerStatus: z.string().nullable().optional(),
  amountCents: z.number().int(),
  currency: z.string(),
  providerRef: z.string().nullable().optional(),
  metadata: z.record(z.any()).nullable().optional(),
  processedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime().nullable().optional(),
});
export type PaymentTransaction = z.infer<typeof paymentTransactionSchema>;

export const escrowHoldingSchema = z.object({
  id: z.string().uuid(),
  status: escrowStatusSchema,
  amountCents: z.number().int(),
  currency: z.string(),
  releaseDate: z.string().datetime().nullable().optional(),
});
export type EscrowHolding = z.infer<typeof escrowHoldingSchema>;

export const reviewStatusSchema = z.enum(['PENDING', 'PUBLISHED', 'REJECTED']);
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;

export const reviewFlagSchema = z.object({
  id: z.string().uuid(),
  reason: z.string(),
  notes: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
});
export type ReviewFlag = z.infer<typeof reviewFlagSchema>;

export const reviewSchema = z.object({
  id: z.string().uuid(),
  reviewerId: z.string().uuid(),
  recipientId: z.string().uuid(),
  listingId: z.string().uuid(),
  orderId: z.string().uuid(),
  rating: z.number().int(),
  comment: z.string().nullable().optional(),
  status: reviewStatusSchema,
  moderationNotes: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  verifiedPurchase: z.boolean().default(false),
  reviewer: safeUserSchema.nullable().optional(),
  flags: z.array(reviewFlagSchema).default([]),
  helpfulCount: z.number().int().min(0).default(0),
  userVoted: z.boolean().default(false),
});
export type SafeReview = z.infer<typeof reviewSchema>;

export const reviewRollupSchema = z.object({
  sellerId: z.string().uuid(),
  averageRating: z.number(),
  reviewCount: z.number().int(),
  publishedCount: z.number().int(),
  pendingCount: z.number().int(),
  flaggedCount: z.number().int(),
  lastReviewAt: z.string().datetime().nullable().optional(),
  star1: z.number().int().optional(),
  star2: z.number().int().optional(),
  star3: z.number().int().optional(),
  star4: z.number().int().optional(),
  star5: z.number().int().optional(),
});
export type ReviewRollup = z.infer<typeof reviewRollupSchema>;

export const listingReviewResponseSchema = z.object({
  reviews: z.array(reviewSchema),
  rollup: reviewRollupSchema,
});
export type ListingReviewResponse = z.infer<typeof listingReviewResponseSchema>;

export const createReviewSchema = z.object({
  reviewerId: z.string().uuid(),
  recipientId: z.string().uuid(),
  listingId: z.string().uuid(),
  orderId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable().optional(),
  metadata: z.record(z.any()).optional(),
});
export type CreateReviewDto = z.infer<typeof createReviewSchema>;

export const feeScheduleSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  categoryId: z.string().uuid().nullable(),
  feePercent: z.number(),
  fixedFeeCents: z.number().int(),
  minFeeCents: z.number().int(),
  maxFeeCents: z.number().int().nullable(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  createdBy: z.string().uuid(),
  category: z.object({ id: z.string(), name: z.string(), slug: z.string() }).nullable().optional(),
});
export type FeeSchedule = z.infer<typeof feeScheduleSchema>;

export const createFeeScheduleSchema = z.object({
  name: z.string().min(1),
  categoryId: z.string().uuid().nullable().optional(),
  feePercent: z.number().min(0).max(50),
  fixedFeeCents: z.number().int().nonnegative().optional(),
  minFeeCents: z.number().int().nonnegative().optional(),
  maxFeeCents: z.number().int().nonnegative().nullable().optional(),
});
export type CreateFeeScheduleDto = z.infer<typeof createFeeScheduleSchema>;

export const updateFeeScheduleSchema = createFeeScheduleSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateFeeScheduleDto = z.infer<typeof updateFeeScheduleSchema>;

export const feePreviewSchema = z.object({
  feeAmountCents: z.number().int(),
  feePercent: z.number(),
  breakdown: z.object({ percentPart: z.number().int(), fixedPart: z.number().int() }),
});
export type FeePreview = z.infer<typeof feePreviewSchema>;

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
  feePercent: z.number().default(0),
  currency: z.string(),
  metadata: z.record(z.any()).nullable().optional(),
  placedAt: z.string().datetime().nullable().optional(),
  timeline: z.array(orderTimelineSchema).default([]),
  items: z.array(orderItemSchema).default([]),
  shipments: z.array(orderShipmentSchema).default([]),
  escrow: escrowHoldingSchema.nullable().optional(),
  payments: z.array(paymentTransactionSchema).default([]),
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

export const pushTokenRegistrationSchema = z.object({
  token: z.string(),
});
export type PushTokenRegistration = z.infer<typeof pushTokenRegistrationSchema>;

export const authResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string().nullable().optional(),
    role: z.string().optional(),
    tosVersion: z.string().nullable().optional(),
    termsAcceptedAt: z.union([z.string(), z.date()]).nullable().optional(),
    deletionScheduledAt: z.union([z.string(), z.date()]).nullable().optional(),
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

export const notificationTemplateSchema = z.enum([
  'ORDER_STATUS',
  'NEW_MESSAGE',
  'AUCTION_OUTBID',
  'ESCROW_UPDATE',
  'REVIEW_RECEIVED',
]);
export type NotificationTemplate = z.infer<typeof notificationTemplateSchema>;

export const safeNotificationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  channel: z.string(),
  template: z.string(),
  payload: z.record(z.any()),
  status: z.string(),
  sentAt: z.string().nullable().optional(),
  readAt: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type SafeNotification = z.infer<typeof safeNotificationSchema>;

export const listingSearchParamsSchema = z.object({
  keyword: z.string().optional(),
  sellerId: z.string().optional(),
  status: listingStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
  minPriceCents: z.coerce.number().int().nonnegative().optional(),
  maxPriceCents: z.coerce.number().int().nonnegative().optional(),
  tags: z.array(z.string()).optional(),
  sort: z.enum(['relevance', 'price_asc', 'price_desc', 'date_new', 'date_old', 'title']).optional(),
  categories: z.array(z.string()).optional(),
});
export type ListingSearchParams = z.infer<typeof listingSearchParamsSchema>;

export interface UploadResult {
  message: string;
  image?: ListingImage;
}

export const adminUserSummarySchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().nullable().optional(),
});
export type AdminUserSummary = z.infer<typeof adminUserSummarySchema>;

export const adminKycDocumentSchema = z.object({
  id: z.string().uuid(),
  submissionId: z.string().uuid(),
  type: z.string(),
  status: kycStatusSchema,
  url: z.string().nullable().optional(),
  createdAt: z.string().datetime().optional(),
  metadata: z.record(z.any()).nullable().optional(),
});
export type AdminKycDocument = z.infer<typeof adminKycDocumentSchema>;

export const adminKycSubmissionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  reviewerId: z.string().uuid().nullable().optional(),
  status: kycStatusSchema,
  rejectionReason: z.string().nullable().optional(),
  submittedAt: z.string().datetime(),
  reviewedAt: z.string().datetime().nullable().optional(),
  documents: z.array(adminKycDocumentSchema).default([]),
  user: adminUserSummarySchema.optional(),
  reviewer: adminUserSummarySchema.nullable().optional(),
});
export type AdminKycSubmission = z.infer<typeof adminKycSubmissionSchema>;

export const adminListingModerationSchema = z.object({
  id: z.string().uuid(),
  sellerId: z.string().uuid(),
  title: z.string(),
  status: listingStatusSchema,
  moderationStatus: listingModerationStatusSchema,
  moderationNotes: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AdminListingModeration = z.infer<typeof adminListingModerationSchema>;

export const adminDisputeSchema = z.object({
  id: z.string().uuid(),
  escrowId: z.string().uuid(),
  orderId: z.string().uuid().optional(),
  orderNumber: z.string().optional(),
  status: disputeStatusSchema,
  reason: z.string(),
  resolution: z.string().nullable().optional(),
  openedBy: adminUserSummarySchema.optional(),
  openedAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable().optional(),
  amountCents: z.number().int().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  messageCount: z.number().int().nonnegative().default(0),
});
export type AdminDisputeSummary = z.infer<typeof adminDisputeSchema>;

export const adminUserDetailSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  role: z.string(),
  kycStatus: z.string(),
  listingsCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});
export type AdminUserDetail = z.infer<typeof adminUserDetailSchema>;

export const adminOrderSummarySchema = z.object({
  id: z.string().uuid(),
  orderNumber: z.string(),
  buyerName: z.string().nullable().optional(),
  buyerEmail: z.string().nullable().optional(),
  totalItemCents: z.number().int().nonnegative(),
  currency: z.string(),
  status: z.string(),
  paymentStatus: z.string(),
  placedAt: z.string().datetime().nullable().optional(),
});
export type AdminOrderSummary = z.infer<typeof adminOrderSummarySchema>;

// --- Storefronts ---

export const storefrontSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable().optional(),
  logoUrl: z.string().nullable().optional(),
  bannerUrl: z.string().nullable().optional(),
  themeConfig: z.record(z.any()).nullable().optional(),
  status: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  user: adminUserSummarySchema.optional(),
  collections: z.array(z.any()).default([]),
});
export type Storefront = z.infer<typeof storefrontSchema>;

export const createStorefrontSchema = z.object({
  name: z.string().min(1).max(50),
  slug: z
    .string()
    .min(1)
    .max(30)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional(),
});
export type CreateStorefrontDto = z.infer<typeof createStorefrontSchema>;

// --- Auctions ---

export const auctionStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED']);
export type AuctionStatus = z.infer<typeof auctionStatusSchema>;

export const auctionSchema = z.object({
  id: z.string().uuid(),
  listingId: z.string().uuid(),
  sellerId: z.string().uuid(),
  status: auctionStatusSchema,
  startingBidCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  reserveCents: z.number().int().nonnegative().nullable(),
  buyNowCents: z.number().int().nonnegative().nullable(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  currentBidCents: z.number().int().nonnegative().optional(),
  bidCount: z.number().int().nonnegative().optional(),
  listing: safeListingSchema.optional(),
});
export type Auction = z.infer<typeof auctionSchema>;

export const createAuctionSchema = z.object({
  listingId: z.string().uuid(),
  startingBidCents: z.number().int().nonnegative(),
  durationDays: z.number().int().min(1),
  reserveCents: z.number().int().nonnegative().optional(),
  buyNowCents: z.number().int().nonnegative().optional(),
});
export type CreateAuctionDto = z.infer<typeof createAuctionSchema>;

export const placeBidSchema = z.object({
  amountCents: z.number().int().positive(),
  maxAutoBidCents: z.number().int().positive().optional(),
});
export type PlaceBidDto = z.infer<typeof placeBidSchema>;

export const offerStatusSchema = z.enum(['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED']);
export type OfferStatus = z.infer<typeof offerStatusSchema>;

export const safeOfferSchema = z.object({
  id: z.string().uuid(),
  listingId: z.string().uuid(),
  buyerId: z.string().uuid(),
  sellerId: z.string().uuid(),
  amountCents: z.number().int(),
  currency: z.string(),
  message: z.string().nullable().optional(),
  status: offerStatusSchema,
  expiresAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  listing: z.object({
    id: z.string().uuid(),
    title: z.string(),
    images: z.array(z.object({ url: z.string() })).optional(),
  }).optional(),
  buyer: z.object({ id: z.string(), name: z.string().nullable().optional() }).optional(),
  seller: z.object({ id: z.string(), name: z.string().nullable().optional() }).optional(),
});
export type SafeOffer = z.infer<typeof safeOfferSchema>;

export const createOfferSchema = z.object({
  listingId: z.string().uuid(),
  amountCents: z.number().int().positive(),
  message: z.string().max(500).optional(),
});
export type CreateOfferDto = z.infer<typeof createOfferSchema>;

export const listingCategorySchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  position: z.number().int(),
  createdAt: z.string().datetime(),
  children: z.array(z.lazy((): z.ZodTypeAny => listingCategorySchema)).optional(),
});
export type ListingCategory = z.infer<typeof listingCategorySchema>;

export const listingTagSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  label: z.string(),
  createdAt: z.string().datetime(),
});
export type ListingTag = z.infer<typeof listingTagSchema>;

export const savedListingSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  listingId: z.string().uuid(),
  createdAt: z.string().datetime(),
  listing: z.object({
    id: z.string().uuid(),
    title: z.string(),
    priceCents: z.number().int(),
    currency: z.string(),
    status: z.string(),
    images: z.array(z.object({ url: z.string() })).optional(),
  }).optional(),
});
export type SavedListing = z.infer<typeof savedListingSchema>;

// --- Returns ---

export const returnReasonSchema = z.enum([
  'not_as_described',
  'damaged',
  'not_received',
  'changed_mind',
  'other',
]);
export type ReturnReason = z.infer<typeof returnReasonSchema>;

export const returnStatusSchema = z.enum([
  'requested',
  'awaiting_seller',
  'approved',
  'rejected',
  'shipped',
  'received',
  'refunded',
]);
export type ReturnStatus = z.infer<typeof returnStatusSchema>;

export const safeReturnSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  buyerId: z.string().uuid(),
  sellerId: z.string().uuid(),
  reason: returnReasonSchema,
  conditionNotes: z.string().nullable().optional(),
  items: z.array(z.object({ orderItemId: z.string(), quantity: z.number() })).nullable().optional(),
  status: returnStatusSchema,
  trackingNumber: z.string().nullable().optional(),
  refundAmount: z.number().int(),
  sellerResponseDeadline: z.string().datetime(),
  rejectionReason: z.string().nullable().optional(),
  resolvedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  order: z.object({
    id: z.string(),
    orderNumber: z.string(),
    deliveredAt: z.string().nullable().optional(),
    totalItemCents: z.number().int(),
    currency: z.string(),
  }).optional(),
  buyer: z.object({ id: z.string(), name: z.string().nullable().optional() }).optional(),
  seller: z.object({ id: z.string(), name: z.string().nullable().optional() }).optional(),
});
export type SafeReturn = z.infer<typeof safeReturnSchema>;

export const initiateReturnSchema = z.object({
  reason: returnReasonSchema,
  conditionNotes: z.string().max(1000).optional(),
  items: z.array(z.object({ orderItemId: z.string(), quantity: z.number().int().positive() })).optional(),
  photos: z.array(z.string()).max(5).optional(),
});
export type InitiateReturnDto = z.infer<typeof initiateReturnSchema>;
