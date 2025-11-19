import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  EscrowStatus,
  EscrowTransactionType,
  Listing,
  ListingStatus,
  Order,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

import { PrismaService } from '../../prisma/prisma.service.js';
import { OrdersModule } from './orders.module.js';

const BUYER_ID = 'buyer-1';
const SELLER_ID = 'seller-1';
const LISTING_ID = 'listing-1';

describe('OrdersModule flows', () => {
  let app: INestApplication;
  let prismaMock: InMemoryPrismaService;

  beforeEach(async () => {
    prismaMock = new InMemoryPrismaService();
    const moduleRef = await Test.createTestingModule({
      imports: [OrdersModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('runs the pay → fulfill → release happy path', async () => {
    const orderPayload = {
      buyerId: BUYER_ID,
      sellerId: SELLER_ID,
      items: [{ listingId: LISTING_ID, quantity: 1 }],
      shippingCents: 500,
      feeCents: 250,
    };

    const createRes = await request(app.getHttpServer()).post('/orders').send(orderPayload).expect(201);
    const orderId = createRes.body.id;
    expect(createRes.body.payments[0].providerStatus).toBeDefined();

    await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .send({ status: OrderStatus.PAID, providerStatus: 'succeeded' })
      .expect(200);

    const paidRes = await request(app.getHttpServer()).get(`/orders/${orderId}`).expect(200);
    expect(paidRes.body.status).toBe(OrderStatus.PAID);
    expect(paidRes.body.paymentStatus).toBe(PaymentStatus.CAPTURED);
    expect(paidRes.body.escrow.status).toBe(EscrowStatus.HOLDING);

    await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .send({ status: OrderStatus.FULFILLED })
      .expect(200);

    const releaseRes = await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .send({ status: OrderStatus.COMPLETED })
      .expect(200);

    expect(releaseRes.body.escrow.status).toBe(EscrowStatus.RELEASED);
    expect(releaseRes.body.escrow.transactions[0].type).toBe(EscrowTransactionType.RELEASE);
    expect(prismaMock.auditLogs).toHaveLength(1);
  });

  it('cancels and refunds via webhook + cancellation', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/orders')
      .send({ buyerId: BUYER_ID, sellerId: SELLER_ID, items: [{ listingId: LISTING_ID }] })
      .expect(201);

    const orderId = createRes.body.id;

    await request(app.getHttpServer())
      .post('/orders/payments/stripe/webhook')
      .send({
        type: 'payment_intent.succeeded',
        data: { object: { metadata: { orderId }, status: 'succeeded' } },
      })
      .expect(200);

    const paidRes = await request(app.getHttpServer()).get(`/orders/${orderId}`).expect(200);
    expect(paidRes.body.status).toBe(OrderStatus.PAID);

    const cancelRes = await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .send({ status: OrderStatus.CANCELLED, providerStatus: 'canceled' })
      .expect(200);

    expect(cancelRes.body.paymentStatus).toBe(PaymentStatus.REFUNDED);
    expect(cancelRes.body.escrow.status).toBe(EscrowStatus.REFUNDED);
    expect(cancelRes.body.escrow.transactions[0].type).toBe(EscrowTransactionType.REFUND);
    expect(prismaMock.auditLogs[0]?.action).toBe('order.escrow.refund');
  });
});

class InMemoryPrismaService {
  private users = new Map<string, { id: string; deletedAt: Date | null }>();
  private listings = new Map<string, ListingRecord>();
  private orders = new Map<string, OrderRecord>();
  private items = new Map<string, OrderItemRecord>();
  private timelines = new Map<string, OrderTimelineRecord[]>();
  private payments = new Map<string, PaymentTransactionRecord[]>();
  private escrows = new Map<string, EscrowHoldingRecord>();
  private escrowTransactions = new Map<string, EscrowTransactionRecord[]>();
  private auditLogStore: AuditLogRecord[] = [];

  constructor() {
    this.users.set(BUYER_ID, { id: BUYER_ID, deletedAt: null });
    this.users.set(SELLER_ID, { id: SELLER_ID, deletedAt: null });
    this.listings.set(LISTING_ID, {
      id: LISTING_ID,
      sellerId: SELLER_ID,
      title: 'Sample listing',
      priceCents: 1000,
      currency: 'USD',
      status: ListingStatus.PUBLISHED,
      variants: [],
    });
  }

  get auditLogs(): AuditLogRecord[] {
    return this.auditLogStore;
  }

  async $transaction<T>(fn: (tx: this) => Promise<T>): Promise<T> {
    return fn(this);
  }

  user = {
    findFirst: async ({ where }: { where: { id: string; deletedAt: null } }) => {
      const record = this.users.get(where.id);
      return record && record.deletedAt === null ? record : null;
    },
  };

  listing = {
    findMany: async ({ where }: { where: { id: { in: string[] }; deletedAt: null } }) => {
      return where.id.in
        .map((id) => this.listings.get(id))
        .filter((value): value is ListingRecord => Boolean(value));
    },
  };

  order = {
    findMany: async ({ include }: { include: Prisma.OrderInclude }) => {
      return Array.from(this.orders.values())
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((order) => this.buildOrder(order, include));
    },
    findFirst: async ({ where, include }: { where: { id?: string }; include: Prisma.OrderInclude }) => {
      const order = where.id ? this.orders.get(where.id) : undefined;
      return order ? this.buildOrder(order, include) : null;
    },
    findUnique: async ({ where, include }: { where: { id: string }; include: Prisma.OrderInclude }) => {
      const order = this.orders.get(where.id);
      return order ? this.buildOrder(order, include) : null;
    },
    create: async ({ data }: { data: any }) => {
      const id = randomUUID();
      const now = new Date();
      const record: OrderRecord = {
        id,
        orderNumber: data.orderNumber!,
        buyerId: data.buyerId!,
        sellerId: data.sellerId!,
        status: data.status ?? OrderStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        totalItemCents: data.totalItemCents!,
        shippingCents: data.shippingCents as number,
        feeCents: data.feeCents as number,
        currency: data.currency!,
        shippingAddressId: (data.shippingAddressId as string | null) ?? null,
        billingAddressId: (data.billingAddressId as string | null) ?? null,
        metadata: (data.metadata as Prisma.JsonValue | null) ?? null,
        placedAt: data.placedAt as Date,
        paidAt: null,
        fulfilledAt: null,
        deliveredAt: null,
        cancelledAt: null,
        createdAt: now,
        updatedAt: now,
      };
      this.orders.set(id, record);
      if (data.items?.create) {
        const createdItems = Array.isArray(data.items.create) ? data.items.create : [data.items.create];
        createdItems.forEach((item: any) => this.createOrderItem(id, item));
      }
      if (data.timeline?.create) {
        const events = Array.isArray(data.timeline.create) ? data.timeline.create : [data.timeline.create];
        this.timelines.set(id, events.map((event: any) => this.createTimelineRecord(id, event)));
      }
      return record;
    },
    update: async ({ where, data, include }: { where: { id: string }; data: any; include: Prisma.OrderInclude }) => {
      const record = this.orders.get(where.id);
      if (!record) {
        throw new Error('Order not found');
      }
      Object.assign(record, {
        status: data.status ?? record.status,
        paymentStatus: data.paymentStatus ?? record.paymentStatus,
        paidAt: (data as any).paidAt ?? record.paidAt,
        fulfilledAt: (data as any).fulfilledAt ?? record.fulfilledAt,
        deliveredAt: (data as any).deliveredAt ?? record.deliveredAt,
        cancelledAt: (data as any).cancelledAt ?? record.cancelledAt,
      });
      record.updatedAt = new Date();
      if (data.timeline?.create) {
        const existing = this.timelines.get(record.id) ?? [];
        const events = Array.isArray(data.timeline.create) ? data.timeline.create : [data.timeline.create];
        events.forEach((event: any) => existing.push(this.createTimelineRecord(record.id, event)));
        this.timelines.set(record.id, existing);
      }
      return this.buildOrder(record, include);
    },
  };

  paymentTransaction = {
    create: async ({ data }: { data: any }) => {
      const record: PaymentTransactionRecord = {
        id: randomUUID(),
        orderId: data.orderId,
        provider: data.provider ?? PaymentProvider.STRIPE,
        status: data.status ?? PaymentStatus.PENDING,
        providerStatus: data.providerStatus ?? null,
        amountCents: data.amountCents,
        currency: data.currency ?? 'USD',
        providerRef: data.providerRef ?? null,
        metadata: (data.metadata as Prisma.JsonValue | null) ?? null,
        processedAt: (data.processedAt as Date) ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const list = this.payments.get(data.orderId) ?? [];
      list.push(record);
      this.payments.set(data.orderId, list);
      return record;
    },
    updateMany: async ({ where, data }: { where: { orderId: string }; data: Prisma.PaymentTransactionUpdateManyMutationInput }) => {
      const records = this.payments.get(where.orderId) ?? [];
      records.forEach((record) => {
        record.status = (data.status as PaymentStatus) ?? record.status;
        record.providerStatus = (data.providerStatus as string) ?? record.providerStatus;
        record.processedAt = (data.processedAt as Date) ?? record.processedAt;
        record.updatedAt = new Date();
      });
      this.payments.set(where.orderId, records);
      return { count: records.length };
    },
    findFirst: async ({ where }: { where: { orderId: string } }) => {
      const records = this.payments.get(where.orderId) ?? [];
      return records[0] ?? null;
    },
  };

  escrowHolding = {
    create: async ({ data }: { data: any }) => {
      const record: EscrowHoldingRecord = {
        id: randomUUID(),
        orderId: data.orderId,
        status: data.status ?? EscrowStatus.HOLDING,
        amountCents: data.amountCents,
        currency: data.currency ?? 'USD',
        releaseAfter: null,
        releasedAt: null,
        metadata: null,
      };
      this.escrows.set(data.orderId, record);
      return record;
    },
    findUnique: async ({ where }: { where: { orderId?: string; id?: string } }) => {
      if (where.orderId) {
        return this.escrows.get(where.orderId) ?? null;
      }
      const record = Array.from(this.escrows.values()).find((escrow) => escrow.id === where.id);
      return record ?? null;
    },
    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      const record = Array.from(this.escrows.values()).find((escrow) => escrow.id === where.id);
      if (!record) {
        throw new Error('Escrow not found');
      }
      record.status = (data.status as EscrowStatus) ?? record.status;
      record.releasedAt = (data.releasedAt as Date) ?? record.releasedAt;
      return record;
    },
  };

  escrowTransaction = {
    create: async ({ data }: { data: any }) => {
      const record: EscrowTransactionRecord = {
        id: randomUUID(),
        escrowId: data.escrowId,
        type: data.type as EscrowTransactionType,
        amountCents: data.amountCents,
        currency: data.currency ?? 'USD',
        note: data.note ?? null,
        actorId: data.actorId ?? null,
        createdAt: new Date(),
      };
      const list = this.escrowTransactions.get(data.escrowId) ?? [];
      list.push(record);
      this.escrowTransactions.set(data.escrowId, list);
      return record;
    },
  };

  auditLog = {
    create: async ({ data }: { data: any }) => {
      const record: AuditLogRecord = {
        id: randomUUID(),
        actorId: data.actorId ?? null,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId ?? null,
        payload: (data.payload as Prisma.JsonValue | null) ?? null,
      };
      this.auditLogStore.push(record);
      return record;
    },
  };

  private createOrderItem(orderId: string, item: any) {
    const id = randomUUID();
    this.items.set(id, {
      id,
      orderId,
      listingId: item.listingId!,
      listingTitle: item.listingTitle!,
      variantId: (item.variantId as string | null) ?? null,
      variantLabel: item.variantLabel ?? null,
      quantity: item.quantity!,
      unitPriceCents: item.unitPriceCents!,
      currency: item.currency!,
    });
  }

  private createTimelineRecord(orderId: string, event: any): OrderTimelineRecord {
    return {
      id: randomUUID(),
      orderId,
      status: event.status as OrderStatus,
      note: event.note ?? null,
      actorId: event.actorId ?? null,
      metadata: (event.metadata as Prisma.JsonValue | null) ?? null,
      createdAt: new Date(),
    };
  }

  private buildOrder(record: OrderRecord, include: Prisma.OrderInclude) {
    return {
      ...record,
      items: include.items ? this.getItems(record.id) : undefined,
      shipments: [],
      timeline: include.timeline ? this.getTimeline(record.id) : undefined,
      payments: include.payments ? this.getPayments(record.id) : undefined,
      escrow: include.escrow ? this.getEscrow(record.id) : null,
    };
  }

  private getItems(orderId: string) {
    return Array.from(this.items.values()).filter((item) => item.orderId === orderId);
  }

  private getTimeline(orderId: string) {
    return (this.timelines.get(orderId) ?? []).slice();
  }

  private getPayments(orderId: string) {
    return (this.payments.get(orderId) ?? []).slice();
  }

  private getEscrow(orderId: string) {
    const escrow = this.escrows.get(orderId) ?? null;
    if (!escrow) {
      return null;
    }
    return {
      ...escrow,
      disputes: [],
      transactions: (this.escrowTransactions.get(escrow.id) ?? []).slice(),
    };
  }
}

type ListingRecord = Pick<Listing, 'id' | 'sellerId' | 'title' | 'priceCents' | 'currency' | 'status'> & {
  variants: { id: string; label: string; priceCents: number; currency: string }[];
};

type OrderRecord = Pick<
  Order,
  | 'id'
  | 'orderNumber'
  | 'buyerId'
  | 'sellerId'
  | 'status'
  | 'paymentStatus'
  | 'totalItemCents'
  | 'shippingCents'
  | 'feeCents'
  | 'currency'
  | 'shippingAddressId'
  | 'billingAddressId'
  | 'metadata'
  | 'placedAt'
  | 'paidAt'
  | 'fulfilledAt'
  | 'deliveredAt'
  | 'cancelledAt'
  | 'createdAt'
  | 'updatedAt'
>;

type OrderItemRecord = {
  id: string;
  orderId: string;
  listingId: string;
  listingTitle: string;
  variantId: string | null;
  variantLabel: string | null;
  quantity: number;
  unitPriceCents: number;
  currency: string;
};

type OrderTimelineRecord = {
  id: string;
  orderId: string;
  status: OrderStatus;
  note: string | null;
  actorId: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
};

type PaymentTransactionRecord = {
  id: string;
  orderId: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  providerStatus: string | null;
  amountCents: number;
  currency: string;
  providerRef: string | null;
  metadata: Prisma.JsonValue | null;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type EscrowHoldingRecord = {
  id: string;
  orderId: string;
  status: EscrowStatus;
  amountCents: number;
  currency: string;
  releaseAfter: Date | null;
  releasedAt: Date | null;
  metadata: Prisma.JsonValue | null;
};

type EscrowTransactionRecord = {
  id: string;
  escrowId: string;
  type: EscrowTransactionType;
  amountCents: number;
  currency: string;
  note: string | null;
  actorId: string | null;
  createdAt: Date;
};

type AuditLogRecord = {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  payload: Prisma.JsonValue | null;
};
