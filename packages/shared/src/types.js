"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminDisputeSchema = exports.adminListingModerationSchema = exports.adminKycSubmissionSchema = exports.adminKycDocumentSchema = exports.adminUserSummarySchema = exports.listingSearchParamsSchema = exports.createThreadSchema = exports.sendMessageSchema = exports.updateOrderStatusSchema = exports.createOrderSchema = exports.createOrderItemSchema = exports.authResponseSchema = exports.pushTokenRegistrationSchema = exports.registerPayloadSchema = exports.loginPayloadSchema = exports.messageThreadSchema = exports.participantSchema = exports.messageSchema = exports.messageReceiptSchema = exports.messageAttachmentSchema = exports.safeOrderSchema = exports.createReviewSchema = exports.listingReviewResponseSchema = exports.reviewRollupSchema = exports.reviewSchema = exports.reviewFlagSchema = exports.reviewStatusSchema = exports.escrowHoldingSchema = exports.paymentTransactionSchema = exports.orderTimelineSchema = exports.orderShipmentSchema = exports.orderItemSchema = exports.escrowStatusSchema = exports.shipmentStatusSchema = exports.paymentStatusSchema = exports.orderStatusSchema = exports.listingSearchResponseSchema = exports.safeListingSchema = exports.listingImageSchema = exports.updateListingSchema = exports.createListingSchema = exports.createListingVariantSchema = exports.listingVariantSchema = exports.listingModerationStatusSchema = exports.listingStatusSchema = exports.safeUserSchema = exports.disputeStatusSchema = exports.kycStatusSchema = exports.userRoleSchema = void 0;
const zod_1 = require("zod");
exports.userRoleSchema = zod_1.z.enum(['BUYER', 'SELLER', 'ADMIN', 'MODERATOR']);
exports.kycStatusSchema = zod_1.z.enum(['PENDING', 'APPROVED', 'REJECTED', 'NOT_REQUIRED']);
exports.disputeStatusSchema = zod_1.z.enum(['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'ESCALATED']);
exports.safeUserSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    email: zod_1.z.string().email(),
    name: zod_1.z.string().nullable().optional(),
    role: exports.userRoleSchema,
});
exports.listingStatusSchema = zod_1.z.enum(['DRAFT', 'PUBLISHED', 'PAUSED']);
exports.listingModerationStatusSchema = zod_1.z.enum(['PENDING', 'APPROVED', 'REJECTED', 'FLAGGED']);
exports.listingVariantSchema = zod_1.z.object({
    id: zod_1.z.string().uuid().optional(),
    label: zod_1.z.string(),
    priceCents: zod_1.z.number().nonnegative(),
    currency: zod_1.z.string().min(3).max(3).optional(),
    sku: zod_1.z.string().nullable().optional(),
    inventoryCount: zod_1.z.number().int().nonnegative().nullable().optional(),
    metadata: zod_1.z.record(zod_1.z.any()).nullable().optional(),
    createdAt: zod_1.z.string().datetime().optional(),
    updatedAt: zod_1.z.string().datetime().optional(),
});
exports.createListingVariantSchema = exports.listingVariantSchema.pick({
    label: true,
    priceCents: true,
    currency: true,
    sku: true,
    inventoryCount: true,
    metadata: true,
});
exports.createListingSchema = zod_1.z.object({
    sellerId: zod_1.z.string(),
    title: zod_1.z.string().min(3),
    description: zod_1.z.string().min(10),
    priceCents: zod_1.z.number().int().positive(),
    currency: zod_1.z.string().length(3).optional(),
    status: exports.listingStatusSchema.optional(),
    location: zod_1.z.string().optional(),
    metadata: zod_1.z.record(zod_1.z.any()).nullable().optional(),
    variants: zod_1.z.array(exports.createListingVariantSchema).optional(),
});
exports.updateListingSchema = exports.createListingSchema.partial();
exports.listingImageSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    bucket: zod_1.z.string().optional(),
    storageKey: zod_1.z.string().optional(),
    url: zod_1.z.string().optional(),
    mimeType: zod_1.z.string().nullable().optional(),
    fileSize: zod_1.z.number().int().nullable().optional(),
    width: zod_1.z.number().int().nullable().optional(),
    height: zod_1.z.number().int().nullable().optional(),
    position: zod_1.z.number().int().nullable().optional(),
    createdAt: zod_1.z.string().datetime().optional(),
});
exports.safeListingSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    sellerId: zod_1.z.string().uuid(),
    title: zod_1.z.string(),
    description: zod_1.z.string(),
    priceCents: zod_1.z.number().nonnegative(),
    currency: zod_1.z.string().min(3).max(3),
    status: exports.listingStatusSchema,
    moderationStatus: zod_1.z.string().optional(),
    location: zod_1.z.string().nullable().optional(),
    metadata: zod_1.z.record(zod_1.z.any()).nullable().optional(),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
    variants: zod_1.z.array(exports.listingVariantSchema).default([]),
    images: zod_1.z.array(exports.listingImageSchema).default([]),
});
exports.listingSearchResponseSchema = zod_1.z.object({
    data: zod_1.z.array(exports.safeListingSchema),
    total: zod_1.z.number().int(),
    page: zod_1.z.number().int(),
    pageSize: zod_1.z.number().int(),
    pageCount: zod_1.z.number().int(),
});
exports.orderStatusSchema = zod_1.z.enum([
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
exports.paymentStatusSchema = zod_1.z.enum(['PENDING', 'AUTHORIZED', 'CAPTURED', 'SETTLED', 'FAILED', 'REFUNDED']);
exports.shipmentStatusSchema = zod_1.z.enum([
    'PENDING',
    'LABEL_CREATED',
    'IN_TRANSIT',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'RETURNED',
    'CANCELLED',
]);
exports.escrowStatusSchema = zod_1.z.enum(['HOLDING', 'RELEASED', 'REFUNDED', 'DISPUTED']);
exports.orderItemSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    listingId: zod_1.z.string().uuid(),
    listingTitle: zod_1.z.string(),
    variantId: zod_1.z.string().uuid().nullable().optional(),
    variantLabel: zod_1.z.string().nullable().optional(),
    quantity: zod_1.z.number().int(),
    unitPriceCents: zod_1.z.number().int(),
    currency: zod_1.z.string(),
    metadata: zod_1.z.record(zod_1.z.any()).nullable().optional(),
});
exports.orderShipmentSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    carrier: zod_1.z.string().nullable().optional(),
    serviceLevel: zod_1.z.string().nullable().optional(),
    trackingNumber: zod_1.z.string().nullable().optional(),
    status: exports.shipmentStatusSchema,
    shippedAt: zod_1.z.string().datetime().nullable().optional(),
    deliveredAt: zod_1.z.string().datetime().nullable().optional(),
});
exports.orderTimelineSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    orderId: zod_1.z.string().uuid(),
    status: exports.orderStatusSchema,
    note: zod_1.z.string().nullable().optional(),
    createdAt: zod_1.z.string().datetime(),
});
exports.paymentTransactionSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    orderId: zod_1.z.string().uuid(),
    provider: zod_1.z.string(),
    status: exports.paymentStatusSchema,
    providerStatus: zod_1.z.string().nullable().optional(),
    amountCents: zod_1.z.number().int(),
    currency: zod_1.z.string(),
    providerRef: zod_1.z.string().nullable().optional(),
    metadata: zod_1.z.record(zod_1.z.any()).nullable().optional(),
    processedAt: zod_1.z.string().datetime().nullable().optional(),
    createdAt: zod_1.z.string().datetime().nullable().optional(),
});
exports.escrowHoldingSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    status: exports.escrowStatusSchema,
    amountCents: zod_1.z.number().int(),
    currency: zod_1.z.string(),
    releaseDate: zod_1.z.string().datetime().nullable().optional(),
});
exports.reviewStatusSchema = zod_1.z.enum(['PENDING', 'PUBLISHED', 'REJECTED']);
exports.reviewFlagSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    reason: zod_1.z.string(),
    notes: zod_1.z.string().nullable().optional(),
    createdAt: zod_1.z.string().datetime(),
});
exports.reviewSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    reviewerId: zod_1.z.string().uuid(),
    recipientId: zod_1.z.string().uuid(),
    listingId: zod_1.z.string().uuid(),
    orderId: zod_1.z.string().uuid(),
    rating: zod_1.z.number().int(),
    comment: zod_1.z.string().nullable().optional(),
    status: exports.reviewStatusSchema,
    moderationNotes: zod_1.z.string().nullable().optional(),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
    reviewer: exports.safeUserSchema.nullable().optional(),
    flags: zod_1.z.array(exports.reviewFlagSchema).default([]),
});
exports.reviewRollupSchema = zod_1.z.object({
    sellerId: zod_1.z.string().uuid(),
    averageRating: zod_1.z.number(),
    reviewCount: zod_1.z.number().int(),
    publishedCount: zod_1.z.number().int(),
    pendingCount: zod_1.z.number().int(),
    flaggedCount: zod_1.z.number().int(),
    lastReviewAt: zod_1.z.string().datetime().nullable().optional(),
});
exports.listingReviewResponseSchema = zod_1.z.object({
    reviews: zod_1.z.array(exports.reviewSchema),
    rollup: exports.reviewRollupSchema,
});
exports.createReviewSchema = zod_1.z.object({
    reviewerId: zod_1.z.string().uuid(),
    recipientId: zod_1.z.string().uuid(),
    listingId: zod_1.z.string().uuid(),
    orderId: zod_1.z.string().uuid(),
    rating: zod_1.z.number().int().min(1).max(5),
    comment: zod_1.z.string().nullable().optional(),
    metadata: zod_1.z.record(zod_1.z.any()).optional(),
});
exports.safeOrderSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    orderNumber: zod_1.z.string(),
    buyerId: zod_1.z.string().uuid(),
    sellerId: zod_1.z.string().uuid(),
    status: exports.orderStatusSchema,
    paymentStatus: exports.paymentStatusSchema,
    totalItemCents: zod_1.z.number().int(),
    shippingCents: zod_1.z.number().int(),
    feeCents: zod_1.z.number().int(),
    currency: zod_1.z.string(),
    metadata: zod_1.z.record(zod_1.z.any()).nullable().optional(),
    placedAt: zod_1.z.string().datetime().nullable().optional(),
    timeline: zod_1.z.array(exports.orderTimelineSchema).default([]),
    items: zod_1.z.array(exports.orderItemSchema).default([]),
    shipments: zod_1.z.array(exports.orderShipmentSchema).default([]),
    escrow: exports.escrowHoldingSchema.nullable().optional(),
    payments: zod_1.z.array(exports.paymentTransactionSchema).default([]),
});
exports.messageAttachmentSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    url: zod_1.z.string().url(),
    fileName: zod_1.z.string(),
    mimeType: zod_1.z.string().nullable().optional(),
    fileSize: zod_1.z.number().int().nullable().optional(),
    metadata: zod_1.z.record(zod_1.z.any()).nullable().optional(),
});
exports.messageReceiptSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    userId: zod_1.z.string().uuid(),
    deliveredAt: zod_1.z.string().datetime().nullable().optional(),
    readAt: zod_1.z.string().datetime().nullable().optional(),
});
exports.messageSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    threadId: zod_1.z.string().uuid(),
    authorId: zod_1.z.string().uuid(),
    body: zod_1.z.string(),
    status: zod_1.z.enum(['SENT', 'DELIVERED', 'READ', 'DELETED']).default('SENT'),
    moderationStatus: zod_1.z.enum(['PENDING', 'APPROVED', 'FLAGGED', 'REJECTED']).default('PENDING'),
    moderationNotes: zod_1.z.string().nullable().optional(),
    metadata: zod_1.z.record(zod_1.z.any()).nullable().optional(),
    createdAt: zod_1.z.string().datetime(),
    attachments: zod_1.z.array(exports.messageAttachmentSchema).default([]),
    receipts: zod_1.z.array(exports.messageReceiptSchema).default([]),
});
exports.participantSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    threadId: zod_1.z.string().uuid(),
    userId: zod_1.z.string().uuid(),
    role: zod_1.z.enum(['BUYER', 'SELLER', 'ADMIN', 'SYSTEM']).default('BUYER'),
});
exports.messageThreadSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    listingId: zod_1.z.string().uuid().nullable().optional(),
    subject: zod_1.z.string().nullable().optional(),
    metadata: zod_1.z.record(zod_1.z.any()).nullable().optional(),
    createdAt: zod_1.z.string().datetime(),
    participants: zod_1.z.array(exports.participantSchema).default([]),
    messages: zod_1.z.array(exports.messageSchema).default([]),
});
exports.loginPayloadSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string(),
});
exports.registerPayloadSchema = zod_1.z.object({
    name: zod_1.z.string(),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
    phone: zod_1.z.string().optional(),
});
exports.pushTokenRegistrationSchema = zod_1.z.object({
    token: zod_1.z.string(),
});
exports.authResponseSchema = zod_1.z.object({
    accessToken: zod_1.z.string(),
    user: zod_1.z.object({
        id: zod_1.z.string().uuid(),
        email: zod_1.z.string().email(),
        name: zod_1.z.string().nullable().optional(),
        role: zod_1.z.string().optional(),
    }),
});
exports.createOrderItemSchema = zod_1.z.object({
    listingId: zod_1.z.string().uuid(),
    variantId: zod_1.z.string().uuid().nullable().optional(),
    quantity: zod_1.z.number().int().min(1).default(1),
});
exports.createOrderSchema = zod_1.z.object({
    buyerId: zod_1.z.string().uuid(),
    sellerId: zod_1.z.string().uuid(),
    items: zod_1.z.array(exports.createOrderItemSchema).min(1),
    shippingAddressId: zod_1.z.string().uuid().nullable().optional(),
    billingAddressId: zod_1.z.string().uuid().nullable().optional(),
    shippingCents: zod_1.z.number().int().nonnegative().nullable().optional(),
    feeCents: zod_1.z.number().int().nonnegative().nullable().optional(),
    currency: zod_1.z.string().length(3).default('USD'),
    metadata: zod_1.z.record(zod_1.z.any()).nullable().optional(),
});
exports.updateOrderStatusSchema = zod_1.z.object({
    status: exports.orderStatusSchema,
    note: zod_1.z.string().max(500).nullable().optional(),
    actorId: zod_1.z.string().uuid().nullable().optional(),
    providerStatus: zod_1.z.string().max(64).nullable().optional(),
});
exports.sendMessageSchema = zod_1.z.object({
    authorId: zod_1.z.string().uuid(),
    body: zod_1.z.string().min(1).max(2000),
    metadata: zod_1.z.record(zod_1.z.any()).nullable().optional(),
});
exports.createThreadSchema = zod_1.z.object({
    listingId: zod_1.z.string().uuid().nullable().optional(),
    subject: zod_1.z.string().max(120).nullable().optional(),
    metadata: zod_1.z.record(zod_1.z.any()).nullable().optional(),
    participants: zod_1.z
        .array(zod_1.z.object({
        userId: zod_1.z.string().uuid(),
        role: zod_1.z.enum(['BUYER', 'SELLER', 'ADMIN', 'SYSTEM']).default('BUYER'),
    }))
        .min(2),
    initialMessage: exports.sendMessageSchema.nullable().optional(),
});
exports.listingSearchParamsSchema = zod_1.z.object({
    keyword: zod_1.z.string().optional(),
    sellerId: zod_1.z.string().uuid().optional(),
    status: exports.listingStatusSchema.optional(),
    page: zod_1.z.number().int().min(1).default(1),
    pageSize: zod_1.z.number().int().min(1).max(50).default(12),
    minPriceCents: zod_1.z.number().int().nonnegative().optional(),
    maxPriceCents: zod_1.z.number().int().nonnegative().optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
});
exports.adminUserSummarySchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    email: zod_1.z.string().email(),
    name: zod_1.z.string().nullable().optional(),
});
exports.adminKycDocumentSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    submissionId: zod_1.z.string().uuid(),
    type: zod_1.z.string(),
    status: exports.kycStatusSchema,
    url: zod_1.z.string().nullable().optional(),
    createdAt: zod_1.z.string().datetime().optional(),
    metadata: zod_1.z.record(zod_1.z.any()).nullable().optional(),
});
exports.adminKycSubmissionSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    userId: zod_1.z.string().uuid(),
    reviewerId: zod_1.z.string().uuid().nullable().optional(),
    status: exports.kycStatusSchema,
    rejectionReason: zod_1.z.string().nullable().optional(),
    submittedAt: zod_1.z.string().datetime(),
    reviewedAt: zod_1.z.string().datetime().nullable().optional(),
    documents: zod_1.z.array(exports.adminKycDocumentSchema).default([]),
    user: exports.adminUserSummarySchema.optional(),
    reviewer: exports.adminUserSummarySchema.nullable().optional(),
});
exports.adminListingModerationSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    sellerId: zod_1.z.string().uuid(),
    title: zod_1.z.string(),
    status: exports.listingStatusSchema,
    moderationStatus: exports.listingModerationStatusSchema,
    moderationNotes: zod_1.z.string().nullable().optional(),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
});
exports.adminDisputeSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    escrowId: zod_1.z.string().uuid(),
    orderId: zod_1.z.string().uuid().optional(),
    orderNumber: zod_1.z.string().optional(),
    status: exports.disputeStatusSchema,
    reason: zod_1.z.string(),
    resolution: zod_1.z.string().nullable().optional(),
    openedBy: exports.adminUserSummarySchema.optional(),
    openedAt: zod_1.z.string().datetime(),
    resolvedAt: zod_1.z.string().datetime().nullable().optional(),
    amountCents: zod_1.z.number().int().nonnegative().optional(),
    currency: zod_1.z.string().length(3).optional(),
    messageCount: zod_1.z.number().int().nonnegative().default(0),
});
