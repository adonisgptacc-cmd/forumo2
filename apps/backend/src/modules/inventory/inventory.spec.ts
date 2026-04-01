import { CanActivate, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

import { PrismaService } from '../../prisma/prisma.service';
import { InventoryModule } from './inventory.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

const VARIANT_ID = 'variant-inv-1';
const ORDER_ID = 'order-inv-1';

// ─── Guards ───────────────────────────────────────────────────────────────────

class MockGuard implements CanActivate {
  static userId = 'seller-1';
  static role = 'SELLER';
  canActivate(context: any) {
    const req = context.switchToHttp().getRequest();
    req.user = { id: MockGuard.userId, role: MockGuard.role };
    return true;
  }
}

class AllowAllGuard implements CanActivate {
  canActivate() {
    return true;
  }
}

// ─── Helper: apply Prisma increment/decrement operators ──────────────────────

function applyPrismaUpdate(current: any, data: any): any {
  const result = { ...current };
  for (const [key, val] of Object.entries(data)) {
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      const op = val as Record<string, number>;
      if ('increment' in op) result[key] = (current[key] ?? 0) + op.increment;
      else if ('decrement' in op) result[key] = (current[key] ?? 0) - op.decrement;
      else result[key] = val; // nested object (e.g. metadata)
    } else {
      result[key] = val;
    }
  }
  return result;
}

// ─── In-Memory Prisma ─────────────────────────────────────────────────────────

class InMemoryPrismaService {
  variants = new Map<string, any>();
  inventoryItems = new Map<string, any>();
  reservations = new Map<string, any>();

  constructor() {
    this.variants.set(VARIANT_ID, {
      id: VARIANT_ID,
      label: 'Size M',
      inventoryCount: 0,
      listing: { id: 'listing-1', title: 'Test Product', sellerId: 'seller-1' },
    });
  }

  get listingVariant() {
    const self = this;
    return {
      findUnique: async ({ where }: any) => self.variants.get(where.id) ?? null,
      update: async ({ where, data }: any) => {
        const v = self.variants.get(where.id);
        if (!v) return null;
        const updated = { ...v, ...data };
        self.variants.set(where.id, updated);
        return updated;
      },
    };
  }

  get inventoryItem() {
    const self = this;
    return {
      findMany: async ({ where, orderBy, take }: any) => {
        let items = Array.from(self.inventoryItems.values());
        if (where?.variantId) items = items.filter((i) => i.variantId === where.variantId);
        if (where?.availableQuantity?.gte !== undefined) {
          items = items.filter((i) => i.availableQuantity >= where.availableQuantity.gte);
        }
        if (where?.reservedQuantity?.gte !== undefined) {
          items = items.filter((i) => i.reservedQuantity >= where.reservedQuantity.gte);
        }
        // Sort: createdAt asc/desc
        if (orderBy?.createdAt === 'asc') items.sort((a, b) => a.createdAt - b.createdAt);
        if (orderBy?.createdAt === 'desc') items.sort((a, b) => b.createdAt - a.createdAt);
        if (take !== undefined) items = items.slice(0, take);
        // Attach variant with listing
        return items.map((i) => ({
          ...i,
          variant: self.variants.get(i.variantId)
            ? {
                ...self.variants.get(i.variantId),
                listing: self.variants.get(i.variantId)?.listing,
              }
            : null,
        }));
      },
      findUnique: async ({ where }: any) => self.inventoryItems.get(where.id) ?? null,
      create: async ({ data }: any) => {
        const item = { id: randomUUID(), ...data, createdAt: Date.now() };
        self.inventoryItems.set(item.id, item);
        return item;
      },
      update: async ({ where, data }: any) => {
        const item = self.inventoryItems.get(where.id);
        if (!item) return null;
        const updated = applyPrismaUpdate(item, data);
        self.inventoryItems.set(where.id, updated);
        return updated;
      },
    };
  }

  get inventoryReservation() {
    const self = this;
    return {
      findUnique: async ({ where }: any) => self.reservations.get(where.id) ?? null,
      findMany: async ({ where }: any) => {
        let items = Array.from(self.reservations.values());
        if (where?.orderId) items = items.filter((r) => r.orderId === where.orderId);
        if (where?.status) items = items.filter((r) => r.status === where.status);
        if (where?.expiresAt?.lte) {
          items = items.filter((r) => new Date(r.expiresAt) <= where.expiresAt.lte);
        }
        return items.map((r) => ({
          ...r,
          variant: self.variants.get(r.variantId)
            ? { ...self.variants.get(r.variantId) }
            : null,
        }));
      },
      create: async ({ data }: any) => {
        const r = { id: randomUUID(), ...data, createdAt: new Date() };
        self.reservations.set(r.id, r);
        return r;
      },
      update: async ({ where, data }: any) => {
        const r = self.reservations.get(where.id);
        if (!r) return null;
        const updated = { ...r, ...data };
        self.reservations.set(where.id, updated);
        return updated;
      },
    };
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('InventoryModule', () => {
  let app: INestApplication;
  let prismaMock: InMemoryPrismaService;

  const buildApp = async (role = 'SELLER') => {
    MockGuard.role = role;
    prismaMock = new InMemoryPrismaService();

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), InventoryModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideGuard(JwtAuthGuard)
      .useClass(MockGuard)
      .overrideGuard(RolesGuard)
      .useClass(AllowAllGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  };

  afterEach(async () => await app.close());

  // ── GET /inventory/variant/:variantId ──

  describe('GET /inventory/variant/:variantId', () => {
    it('returns inventory summary for a variant with no stock', async () => {
      await buildApp();
      const res = await request(app.getHttpServer())
        .get(`/inventory/variant/${VARIANT_ID}`)
        .expect(200);

      expect(res.body.variantId).toBe(VARIANT_ID);
      expect(res.body.summary.totalQuantity).toBe(0);
      expect(res.body.summary.availableQuantity).toBe(0);
    });

    it('reflects stock added via addStock', async () => {
      await buildApp();
      await request(app.getHttpServer())
        .post(`/inventory/variant/${VARIANT_ID}/add`)
        .send({ quantity: 10 });

      const res = await request(app.getHttpServer())
        .get(`/inventory/variant/${VARIANT_ID}`)
        .expect(200);

      expect(res.body.summary.totalQuantity).toBe(10);
      expect(res.body.summary.availableQuantity).toBe(10);
    });
  });

  // ── POST /inventory/variant/:variantId/add ──

  describe('POST /inventory/variant/:variantId/add', () => {
    it('adds stock and returns the inventory item', async () => {
      await buildApp();
      const res = await request(app.getHttpServer())
        .post(`/inventory/variant/${VARIANT_ID}/add`)
        .send({ quantity: 5, location: 'warehouse-A' })
        .expect(201);

      expect(res.body.variantId).toBe(VARIANT_ID);
      expect(res.body.quantity).toBe(5);
      expect(res.body.availableQuantity).toBe(5);
      expect(res.body.location).toBe('warehouse-A');
    });

    it('returns 404 for an unknown variant', async () => {
      await buildApp();
      await request(app.getHttpServer())
        .post('/inventory/variant/nonexistent/add')
        .send({ quantity: 5 })
        .expect(404);
    });

    it('updates the variant inventoryCount after adding stock', async () => {
      await buildApp();
      await request(app.getHttpServer())
        .post(`/inventory/variant/${VARIANT_ID}/add`)
        .send({ quantity: 8 });

      expect(prismaMock.variants.get(VARIANT_ID)!.inventoryCount).toBe(8);
    });
  });

  // ── POST /inventory/variant/:variantId/reserve ──

  describe('POST /inventory/variant/:variantId/reserve', () => {
    let itemId: string;

    beforeEach(async () => {
      await buildApp();
      const addRes = await request(app.getHttpServer())
        .post(`/inventory/variant/${VARIANT_ID}/add`)
        .send({ quantity: 10 });
      itemId = addRes.body.id;
    });

    it('creates a reservation and decrements available stock', async () => {
      const res = await request(app.getHttpServer())
        .post(`/inventory/variant/${VARIANT_ID}/reserve`)
        .send({ quantity: 3, orderId: ORDER_ID })
        .expect(201);

      expect(res.body.variantId).toBe(VARIANT_ID);
      expect(res.body.quantity).toBe(3);
      expect(res.body.status).toBe('PENDING');
      // Available should be decremented, reserved incremented
      const item = prismaMock.inventoryItems.get(itemId)!;
      expect(item.availableQuantity).toBe(7);
      expect(item.reservedQuantity).toBe(3);
    });

    it('returns 400 when there is insufficient stock', async () => {
      await request(app.getHttpServer())
        .post(`/inventory/variant/${VARIANT_ID}/reserve`)
        .send({ quantity: 999, orderId: ORDER_ID })
        .expect(400);
    });
  });

  // ── PATCH /inventory/reservations/:reservationId/confirm ──

  describe('PATCH /inventory/reservations/:reservationId/confirm', () => {
    let reservationId: string;
    let itemId: string;

    beforeEach(async () => {
      await buildApp();
      const addRes = await request(app.getHttpServer())
        .post(`/inventory/variant/${VARIANT_ID}/add`)
        .send({ quantity: 10 });
      itemId = addRes.body.id;
      const resRes = await request(app.getHttpServer())
        .post(`/inventory/variant/${VARIANT_ID}/reserve`)
        .send({ quantity: 2, orderId: ORDER_ID });
      reservationId = resRes.body.id;
    });

    it('confirms a pending reservation and deducts from stock', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/inventory/reservations/${reservationId}/confirm`)
        .expect(200);

      expect(res.body.status).toBe('CONFIRMED');
      // Stock should be deducted from reserved and total
      const item = prismaMock.inventoryItems.get(itemId)!;
      expect(item.reservedQuantity).toBe(0);
      expect(item.quantity).toBe(8);
    });

    it('returns 400 when confirming an already-confirmed reservation', async () => {
      await request(app.getHttpServer())
        .patch(`/inventory/reservations/${reservationId}/confirm`);
      await request(app.getHttpServer())
        .patch(`/inventory/reservations/${reservationId}/confirm`)
        .expect(400);
    });

    it('returns 404 for an unknown reservation', async () => {
      await request(app.getHttpServer())
        .patch('/inventory/reservations/nonexistent/confirm')
        .expect(404);
    });
  });

  // ── PATCH /inventory/reservations/:reservationId/release ──

  describe('PATCH /inventory/reservations/:reservationId/release', () => {
    let reservationId: string;
    let itemId: string;

    beforeEach(async () => {
      await buildApp();
      const addRes = await request(app.getHttpServer())
        .post(`/inventory/variant/${VARIANT_ID}/add`)
        .send({ quantity: 10 });
      itemId = addRes.body.id;
      const resRes = await request(app.getHttpServer())
        .post(`/inventory/variant/${VARIANT_ID}/reserve`)
        .send({ quantity: 4, orderId: ORDER_ID });
      reservationId = resRes.body.id;
    });

    it('releases a pending reservation and restores available stock', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/inventory/reservations/${reservationId}/release`)
        .expect(200);

      expect(res.body.status).toBe('RELEASED');
      const item = prismaMock.inventoryItems.get(itemId)!;
      expect(item.availableQuantity).toBe(10);
      expect(item.reservedQuantity).toBe(0);
    });

    it('returns 400 when releasing an already-released reservation', async () => {
      await request(app.getHttpServer())
        .patch(`/inventory/reservations/${reservationId}/release`);
      await request(app.getHttpServer())
        .patch(`/inventory/reservations/${reservationId}/release`)
        .expect(400);
    });
  });

  // ── POST /inventory/items/:itemId/damage ──

  describe('POST /inventory/items/:itemId/damage', () => {
    let itemId: string;

    beforeEach(async () => {
      await buildApp();
      const addRes = await request(app.getHttpServer())
        .post(`/inventory/variant/${VARIANT_ID}/add`)
        .send({ quantity: 10 });
      itemId = addRes.body.id;
    });

    it('marks items as damaged and reduces available stock', async () => {
      const res = await request(app.getHttpServer())
        .post(`/inventory/items/${itemId}/damage`)
        .send({ quantity: 2, reason: 'Warehouse accident' })
        .expect(201);

      expect(res.body.availableQuantity).toBe(8);
      expect(res.body.damagedQuantity).toBe(2);
    });

    it('returns 400 when damaged quantity exceeds available stock', async () => {
      await request(app.getHttpServer())
        .post(`/inventory/items/${itemId}/damage`)
        .send({ quantity: 999 })
        .expect(400);
    });

    it('returns 404 for an unknown inventory item', async () => {
      await request(app.getHttpServer())
        .post('/inventory/items/nonexistent/damage')
        .send({ quantity: 1 })
        .expect(404);
    });
  });

  // ── POST /inventory/variant/:variantId/adjust ──

  describe('POST /inventory/variant/:variantId/adjust', () => {
    it('creates stock via adjust when no inventory exists yet', async () => {
      await buildApp();
      const res = await request(app.getHttpServer())
        .post(`/inventory/variant/${VARIANT_ID}/adjust`)
        .send({ adjustment: 15, reason: 'Initial stock count' })
        .expect(201);

      expect(res.body.quantity).toBe(15);
    });

    it('increments existing stock by adjustment amount', async () => {
      await buildApp();
      await request(app.getHttpServer())
        .post(`/inventory/variant/${VARIANT_ID}/add`)
        .send({ quantity: 10 });

      const res = await request(app.getHttpServer())
        .post(`/inventory/variant/${VARIANT_ID}/adjust`)
        .send({ adjustment: 5, reason: 'Recount correction' })
        .expect(201);

      expect(res.body.quantity).toBe(15);
      expect(res.body.availableQuantity).toBe(15);
    });
  });

  // ── GET /inventory/orders/:orderId/reservations ──

  describe('GET /inventory/orders/:orderId/reservations', () => {
    it('returns reservations for a given order', async () => {
      await buildApp();
      await request(app.getHttpServer())
        .post(`/inventory/variant/${VARIANT_ID}/add`)
        .send({ quantity: 10 });
      await request(app.getHttpServer())
        .post(`/inventory/variant/${VARIANT_ID}/reserve`)
        .send({ quantity: 2, orderId: ORDER_ID });

      const res = await request(app.getHttpServer())
        .get(`/inventory/orders/${ORDER_ID}/reservations`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].orderId).toBe(ORDER_ID);
    });

    it('returns an empty list for an order with no reservations', async () => {
      await buildApp();
      const res = await request(app.getHttpServer())
        .get('/inventory/orders/no-such-order/reservations')
        .expect(200);

      expect(res.body).toHaveLength(0);
    });
  });

  // ── POST /inventory/cleanup-expired ──

  describe('POST /inventory/cleanup-expired', () => {
    it('releases expired reservations and reports count', async () => {
      await buildApp('ADMIN');
      await request(app.getHttpServer())
        .post(`/inventory/variant/${VARIANT_ID}/add`)
        .send({ quantity: 10 });
      const resRes = await request(app.getHttpServer())
        .post(`/inventory/variant/${VARIANT_ID}/reserve`)
        .send({ quantity: 3, orderId: ORDER_ID });

      // Manually expire the reservation
      const r = prismaMock.reservations.get(resRes.body.id)!;
      prismaMock.reservations.set(resRes.body.id, {
        ...r,
        expiresAt: new Date(Date.now() - 1000),
      });

      const res = await request(app.getHttpServer())
        .post('/inventory/cleanup-expired')
        .expect(201);

      expect(res.body.released).toBe(1);
    });

    it('returns zero when there are no expired reservations', async () => {
      await buildApp('ADMIN');
      const res = await request(app.getHttpServer())
        .post('/inventory/cleanup-expired')
        .expect(201);

      expect(res.body.released).toBe(0);
    });
  });
});
