import { CanActivate, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { NotificationChannel } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsModule } from './notifications.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

const USER_ID = 'user-1';
const OTHER_USER_ID = 'user-2';

class MockGuard implements CanActivate {
  static userId = USER_ID;
  canActivate(context: any) {
    const req = context.switchToHttp().getRequest();
    req.user = { id: MockGuard.userId, role: 'BUYER' };
    return true;
  }
}

// ─── In-Memory Prisma ────────────────────────────────────────────────────────

class InMemoryPrismaService {
  notifications = new Map<string, any>();

  constructor() {
    // Seed some notifications for USER_ID
    const n1 = {
      id: 'notif-1',
      userId: USER_ID,
      channel: NotificationChannel.IN_APP,
      template: 'ORDER_STATUS',
      payload: { message: 'Your order shipped' },
      status: 'SENT',
      sentAt: new Date(),
      readAt: null,
      createdAt: new Date(Date.now() - 3600000),
    };
    const n2 = {
      id: 'notif-2',
      userId: USER_ID,
      channel: NotificationChannel.IN_APP,
      template: 'AUCTION_OUTBID',
      payload: { message: 'You were outbid' },
      status: 'SENT',
      sentAt: new Date(),
      readAt: new Date(), // already read
      createdAt: new Date(Date.now() - 7200000),
    };
    // Notification for OTHER_USER
    const n3 = {
      id: 'notif-3',
      userId: OTHER_USER_ID,
      channel: NotificationChannel.IN_APP,
      template: 'NEW_MESSAGE',
      payload: { message: 'You have a new message' },
      status: 'SENT',
      sentAt: new Date(),
      readAt: null,
      createdAt: new Date(),
    };
    this.notifications.set(n1.id, n1);
    this.notifications.set(n2.id, n2);
    this.notifications.set(n3.id, n3);
  }

  get notification() {
    const self = this;
    return {
      findMany: async ({ where, orderBy, take }: any) => {
        let results = Array.from(self.notifications.values()).filter((n) => {
          if (where.userId && n.userId !== where.userId) return false;
          if (where.channel && n.channel !== where.channel) return false;
          return true;
        });
        results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return take ? results.slice(0, take) : results;
      },
      count: async ({ where }: any) => {
        return Array.from(self.notifications.values()).filter((n) => {
          if (where.userId && n.userId !== where.userId) return false;
          if (where.channel && n.channel !== where.channel) return false;
          if ('readAt' in where && where.readAt === null && n.readAt !== null) return false;
          return true;
        }).length;
      },
      create: async ({ data }: any) => {
        const notif = { id: randomUUID(), ...data, createdAt: new Date() };
        self.notifications.set(notif.id, notif);
        return notif;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const [id, n] of self.notifications.entries()) {
          if (where.userId && n.userId !== where.userId) continue;
          if (where.id && n.id !== where.id) continue;
          if (where.channel && n.channel !== where.channel) continue;
          if ('readAt' in where && where.readAt === null && n.readAt !== null) continue;
          self.notifications.set(id, { ...n, ...data });
          count++;
        }
        return { count };
      },
    };
  }
}

// Mock the NotificationsGateway (WebSocket) to avoid needing real sockets
jest.mock('./notifications.gateway', () => ({
  NotificationsGateway: jest.fn().mockImplementation(() => ({
    server: null,
    emit: jest.fn(),
  })),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('NotificationsModule', () => {
  let app: INestApplication;
  let prismaMock: InMemoryPrismaService;

  const buildApp = async (userId = USER_ID) => {
    MockGuard.userId = userId;
    prismaMock = new InMemoryPrismaService();
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), NotificationsModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideGuard(JwtAuthGuard)
      .useClass(MockGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  };

  afterEach(async () => await app.close());

  // ── List ──

  describe('GET /notifications', () => {
    it('returns only the authenticated user\'s in-app notifications', async () => {
      await buildApp();
      const res = await request(app.getHttpServer())
        .get('/notifications')
        .expect(200);

      expect(res.body).toHaveLength(2);
      expect(res.body.every((n: any) => n.userId === USER_ID)).toBe(true);
    });

    it('does not return other users\' notifications', async () => {
      await buildApp(OTHER_USER_ID);
      const res = await request(app.getHttpServer())
        .get('/notifications')
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].userId).toBe(OTHER_USER_ID);
    });
  });

  // ── Unread count ──

  describe('GET /notifications/unread-count', () => {
    it('returns correct unread count', async () => {
      await buildApp();
      const res = await request(app.getHttpServer())
        .get('/notifications/unread-count')
        .expect(200);

      // notif-1 is unread, notif-2 is read
      expect(res.body.count).toBe(1);
    });
  });

  // ── Mark one as read ──

  describe('PATCH /notifications/:id/read', () => {
    it('marks a notification as read', async () => {
      await buildApp();
      await request(app.getHttpServer())
        .patch('/notifications/notif-1/read')
        .expect(200);

      const n = prismaMock.notifications.get('notif-1')!;
      expect(n.readAt).not.toBeNull();
    });

    it('only marks notifications belonging to the user', async () => {
      await buildApp(OTHER_USER_ID);
      // Try to mark notif-1 (belongs to USER_ID) as read
      await request(app.getHttpServer())
        .patch('/notifications/notif-1/read')
        .expect(200);

      // notif-1 should NOT be marked read because other user doesn't own it
      const n = prismaMock.notifications.get('notif-1')!;
      expect(n.readAt).toBeNull();
    });
  });

  // ── Mark all as read ──

  describe('POST /notifications/mark-all-read', () => {
    it('marks all unread notifications as read for the user', async () => {
      await buildApp();
      await request(app.getHttpServer())
        .post('/notifications/mark-all-read')
        .expect(201);

      const userNotifs = Array.from(prismaMock.notifications.values())
        .filter((n) => n.userId === USER_ID);
      expect(userNotifs.every((n) => n.readAt !== null)).toBe(true);
    });

    it('does not affect other users\' notifications', async () => {
      await buildApp();
      await request(app.getHttpServer()).post('/notifications/mark-all-read');

      const otherNotif = prismaMock.notifications.get('notif-3')!;
      expect(otherNotif.readAt).toBeNull();
    });
  });
});
