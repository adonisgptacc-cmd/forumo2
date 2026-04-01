import { CanActivate, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

import { PrismaService } from '../../prisma/prisma.service';
import { UsersModule } from './users.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

const USER_ID = '00000000-0000-0000-0000-000000000001';
const OTHER_USER_ID = '00000000-0000-0000-0000-000000000002';

class MockGuard implements CanActivate {
  static userId = USER_ID;
  static role = 'ADMIN';
  canActivate(context: any) {
    const req = context.switchToHttp().getRequest();
    req.user = { id: MockGuard.userId, role: MockGuard.role };
    return true;
  }
}

class AllowAllGuard implements CanActivate {
  canActivate() { return true; }
}

// ─── In-Memory Prisma ────────────────────────────────────────────────────────

class InMemoryPrismaService {
  users = new Map<string, any>();
  profiles = new Map<string, any>();
  trustSeeds: any[] = [];

  constructor() {
    this.users.set(USER_ID, {
      id: USER_ID,
      email: 'user@test.com',
      name: 'Test User',
      role: 'BUYER',
      avatarUrl: 'https://example.com/avatar.png',
      phone: null,
      trustScore: 0,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    this.users.set(OTHER_USER_ID, {
      id: OTHER_USER_ID,
      email: 'other@test.com',
      name: 'Other User',
      role: 'BUYER',
      avatarUrl: null,
      phone: null,
      trustScore: 0,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    this.profiles.set(USER_ID, {
      userId: USER_ID,
      bio: 'Hello world',
      website: null,
      location: 'Nairobi',
      socialLinks: null,
    });
  }

  get user() {
    const self = this;
    return {
      findMany: async ({ where }: any) => {
        return Array.from(self.users.values()).filter((u) => !u.deletedAt);
      },
      findFirst: async ({ where }: any) => {
        const u = self.users.get(where.id);
        return u && !u.deletedAt ? u : null;
      },
      findUnique: async ({ where }: any) => {
        return self.users.get(where.id) ?? null;
      },
      update: async ({ where, data }: any) => {
        const u = self.users.get(where.id);
        if (!u) return null;
        const updated = { ...u, ...data, updatedAt: new Date() };
        self.users.set(where.id, updated);
        return updated;
      },
    };
  }

  get userProfile() {
    const self = this;
    return {
      findUnique: async ({ where }: any) => self.profiles.get(where.userId) ?? null,
      upsert: async ({ where, create, update }: any) => {
        const existing = self.profiles.get(where.userId);
        const result = existing ? { ...existing, ...update } : { ...create };
        self.profiles.set(where.userId, result);
        return result;
      },
    };
  }

  get trustScoreSeed() {
    const self = this;
    return {
      findMany: async ({ where }: any) => self.trustSeeds.filter((s) => s.userId === where.userId),
      findFirst: async ({ where }: any) => self.trustSeeds.find((s) => s.id === where.id && s.userId === where.userId) ?? null,
      create: async ({ data }: any) => {
        const seed = { id: randomUUID(), ...data, createdAt: new Date() };
        self.trustSeeds.push(seed);
        return seed;
      },
      delete: async ({ where }: any) => {
        const idx = self.trustSeeds.findIndex((s) => s.id === where.id);
        if (idx !== -1) self.trustSeeds.splice(idx, 1);
      },
      aggregate: async ({ where }: any) => {
        const seeds = self.trustSeeds.filter((s) => s.userId === where.userId);
        const sum = seeds.reduce((acc, s) => acc + s.value, 0);
        return { _sum: { value: sum } };
      },
    };
  }

  $transaction = async (queries: any[]) => {
    return Promise.all(queries);
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('UsersModule', () => {
  let app: INestApplication;
  let prismaMock: InMemoryPrismaService;

  const buildApp = async (userId = USER_ID, role = 'ADMIN') => {
    MockGuard.userId = userId;
    MockGuard.role = role;
    prismaMock = new InMemoryPrismaService();
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), UsersModule],
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

  // ── GET /users/me/profile ──

  describe('GET /users/me/profile', () => {
    it('returns full profile for authenticated user', async () => {
      await buildApp();
      const res = await request(app.getHttpServer())
        .get('/users/me/profile')
        .expect(200);

      expect(res.body.user.id).toBe(USER_ID);
      expect(res.body.user.email).toBe('user@test.com');
      expect(res.body.profile.bio).toBe('Hello world');
      expect(res.body.trustSeeds).toBeDefined();
    });

    it('does not expose password hash', async () => {
      await buildApp();
      const res = await request(app.getHttpServer())
        .get('/users/me/profile')
        .expect(200);

      // sanitizeUser strips passwordHash but retains other fields
      expect(res.body.user.passwordHash).toBeUndefined();
    });
  });

  // ── PATCH /users/me/profile ──

  describe('PATCH /users/me/profile', () => {
    it('updates name and phone', async () => {
      await buildApp();
      const res = await request(app.getHttpServer())
        .patch('/users/me/profile')
        .send({ name: 'Updated Name', phone: '+233201234567' })
        .expect(200);

      expect(res.body.name).toBe('Updated Name');
      expect(res.body.phone).toBe('+233201234567');
      expect(prismaMock.users.get(USER_ID)!.name).toBe('Updated Name');
    });

    it('returns 404 if user not found', async () => {
      await buildApp('ghost-user');
      await request(app.getHttpServer())
        .patch('/users/me/profile')
        .send({ name: 'Ghost' })
        .expect(404);
    });
  });

  // ── DELETE /users/me/avatar ──

  describe('DELETE /users/me/avatar', () => {
    it('removes avatar URL', async () => {
      await buildApp();
      const res = await request(app.getHttpServer())
        .delete('/users/me/avatar')
        .expect(200);

      expect(res.body.avatarUrl).toBeNull();
      expect(prismaMock.users.get(USER_ID)!.avatarUrl).toBeNull();
    });
  });

  // ── GET /users ──

  describe('GET /users', () => {
    it('returns all non-deleted users', async () => {
      await buildApp();
      const res = await request(app.getHttpServer()).get('/users').expect(200);
      expect(res.body).toHaveLength(2);
      expect(res.body.every((u: any) => !u.deletedAt)).toBe(true);
    });
  });

  // ── Trust score seeds ──

  describe('POST /users/:id/trust-seeds', () => {
    it('adds a trust seed and recalculates score', async () => {
      await buildApp();
      const res = await request(app.getHttpServer())
        .post(`/users/${USER_ID}/trust-seeds`)
        .send({ label: 'Verified ID', value: 30 })
        .expect(201);

      expect(res.body.label).toBe('Verified ID');
      expect(res.body.value).toBe(30);
      // Trust score should be updated on the user
      expect(prismaMock.users.get(USER_ID)!.trustScore).toBe(30);
    });
  });
});
