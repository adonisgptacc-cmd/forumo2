jest.mock('../notifications/notifications.gateway');

import { CanActivate, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

import { PrismaService } from '../../prisma/prisma.service';
import { KycModule } from './kyc.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { StorageService } from '../storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';

const USER_ID = 'user-kyc-1';
const ADMIN_ID = 'admin-kyc-1';
const SUBMISSION_ID = 'submission-seed-1';

// ─── Guards ───────────────────────────────────────────────────────────────────

class MockGuard implements CanActivate {
  static userId = USER_ID;
  static role = 'BUYER';
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

// ─── Mock Storage ─────────────────────────────────────────────────────────────

class MockStorageService {
  async saveKycDocument(userId: string) {
    return {
      bucket: 'local-dev',
      key: `kyc/${userId}/test-doc.jpg`,
      url: `s3://local-dev/kyc/${userId}/test-doc.jpg`,
    };
  }
}

// ─── In-Memory Prisma ─────────────────────────────────────────────────────────

class InMemoryPrismaService {
  kycSubmissions = new Map<string, any>();
  users = new Map<string, any>();

  constructor() {
    this.users.set(USER_ID, {
      id: USER_ID,
      email: 'user@test.com',
      name: 'Test User',
      kycStatus: 'NONE',
    });

    // Seed a pending submission so status/review tests work without a real submit
    this.kycSubmissions.set(SUBMISSION_ID, {
      id: SUBMISSION_ID,
      userId: USER_ID,
      status: 'PENDING',
      submittedAt: new Date(),
      documents: [],
      user: { id: USER_ID, email: 'user@test.com', name: 'Test User' },
      reviewer: null,
      reviewedAt: null,
      rejectionReason: null,
    });
  }

  get kycSubmission() {
    const self = this;
    return {
      findFirst: async ({ where }: any) => {
        for (const sub of self.kycSubmissions.values()) {
          let match = true;
          if (where.userId && sub.userId !== where.userId) match = false;
          if (where.status?.in && !where.status.in.includes(sub.status)) match = false;
          if (match) return { ...sub };
        }
        return null;
      },
      findUnique: async ({ where }: any) => {
        const sub = self.kycSubmissions.get(where.id);
        return sub ? { ...sub } : null;
      },
      findMany: async ({ where }: any) => {
        return Array.from(self.kycSubmissions.values()).filter(
          (s) => !where?.status || s.status === where.status,
        );
      },
      create: async ({ data }: any) => {
        const id = randomUUID();
        const docs = (data.documents?.create ?? []).map((d: any) => ({
          id: randomUUID(),
          ...d,
        }));
        const sub = {
          id,
          ...data,
          documents: docs,
          user: self.users.get(data.userId),
        };
        delete sub.documents?.create;
        self.kycSubmissions.set(id, sub);
        return sub;
      },
      update: async ({ where, data }: any) => {
        const sub = self.kycSubmissions.get(where.id);
        if (!sub) return null;
        const updated = { ...sub, ...data };
        self.kycSubmissions.set(where.id, updated);
        return {
          ...updated,
          user: self.users.get(updated.userId),
          reviewer: data.reviewerId
            ? { id: data.reviewerId, email: 'admin@test.com', name: 'Admin' }
            : null,
        };
      },
    };
  }

  get user() {
    const self = this;
    return {
      update: async ({ where, data }: any) => {
        const u = self.users.get(where.id);
        if (!u) return null;
        const updated = { ...u, ...data };
        self.users.set(where.id, updated);
        return updated;
      },
    };
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('KycModule', () => {
  let app: INestApplication;
  let prismaMock: InMemoryPrismaService;

  const buildApp = async (userId = USER_ID, role = 'BUYER') => {
    MockGuard.userId = userId;
    MockGuard.role = role;
    prismaMock = new InMemoryPrismaService();

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), KycModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(StorageService)
      .useClass(MockStorageService)
      .overrideProvider(NotificationsService)
      .useValue({
        notifyKycDecision: jest.fn().mockResolvedValue(undefined),
        notifyEscrowReleased: jest.fn().mockResolvedValue(undefined),
      })
      .overrideGuard(JwtAuthGuard)
      .useClass(MockGuard)
      .overrideGuard(RolesGuard)
      .useClass(AllowAllGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  };

  afterEach(async () => await app.close());

  // ── POST /kyc/submit ──

  describe('POST /kyc/submit', () => {
    it('submits KYC documents and returns a PENDING submission', async () => {
      await buildApp();
      // Clear seeded submission so the user has no existing pending/approved
      prismaMock.kycSubmissions.clear();

      const res = await request(app.getHttpServer())
        .post('/kyc/submit')
        .attach('documents', Buffer.from('fake-id-doc'), {
          filename: 'id.jpg',
          contentType: 'image/jpeg',
        })
        .field('documentTypes', JSON.stringify(['national_id']))
        .expect(201);

      expect(res.body.userId).toBe(USER_ID);
      expect(res.body.status).toBe('PENDING');
    });

    it('returns 400 when no files are uploaded', async () => {
      await buildApp();
      await request(app.getHttpServer())
        .post('/kyc/submit')
        .field('documentTypes', JSON.stringify(['national_id']))
        .expect(400);
    });

    it('returns 400 when documentTypes count does not match file count', async () => {
      await buildApp();
      prismaMock.kycSubmissions.clear();

      await request(app.getHttpServer())
        .post('/kyc/submit')
        .attach('documents', Buffer.from('fake'), {
          filename: 'id.jpg',
          contentType: 'image/jpeg',
        })
        .field('documentTypes', JSON.stringify(['national_id', 'passport']))
        .expect(400);
    });

    it('returns 400 when user already has a pending submission', async () => {
      await buildApp();
      // prismaMock already has a seeded PENDING submission
      await request(app.getHttpServer())
        .post('/kyc/submit')
        .attach('documents', Buffer.from('fake'), {
          filename: 'id.jpg',
          contentType: 'image/jpeg',
        })
        .field('documentTypes', JSON.stringify(['national_id']))
        .expect(400);
    });
  });

  // ── GET /kyc/status ──

  describe('GET /kyc/status', () => {
    it('returns the current submission status', async () => {
      await buildApp();
      const res = await request(app.getHttpServer()).get('/kyc/status').expect(200);
      expect(res.body.status).toBe('PENDING');
      expect(res.body.userId).toBe(USER_ID);
    });

    it('returns 404 when the user has no submission', async () => {
      await buildApp('user-with-no-kyc');
      await request(app.getHttpServer()).get('/kyc/status').expect(404);
    });
  });

  // ── GET /kyc/submissions (admin) ──

  describe('GET /kyc/submissions', () => {
    it('returns all pending submissions for an admin', async () => {
      await buildApp(ADMIN_ID, 'ADMIN');
      const res = await request(app.getHttpServer()).get('/kyc/submissions').expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].status).toBe('PENDING');
    });
  });

  // ── GET /kyc/submissions/:id ──

  describe('GET /kyc/submissions/:id', () => {
    it('returns the submission by id', async () => {
      await buildApp(ADMIN_ID, 'ADMIN');
      const res = await request(app.getHttpServer())
        .get(`/kyc/submissions/${SUBMISSION_ID}`)
        .expect(200);
      expect(res.body.id).toBe(SUBMISSION_ID);
    });

    it('returns 404 for unknown submission', async () => {
      await buildApp(ADMIN_ID, 'ADMIN');
      await request(app.getHttpServer())
        .get('/kyc/submissions/does-not-exist')
        .expect(404);
    });
  });

  // ── PATCH /kyc/submissions/:id/review ──

  describe('PATCH /kyc/submissions/:id/review', () => {
    it('approves a pending submission', async () => {
      await buildApp(ADMIN_ID, 'ADMIN');
      const res = await request(app.getHttpServer())
        .patch(`/kyc/submissions/${SUBMISSION_ID}/review`)
        .send({ status: 'APPROVED' })
        .expect(200);

      expect(res.body.status).toBe('APPROVED');
      expect(res.body.reviewerId).toBe(ADMIN_ID);
    });

    it('rejects a submission with a reason', async () => {
      await buildApp(ADMIN_ID, 'ADMIN');
      const res = await request(app.getHttpServer())
        .patch(`/kyc/submissions/${SUBMISSION_ID}/review`)
        .send({ status: 'REJECTED', rejectionReason: 'Document expired' })
        .expect(200);

      expect(res.body.status).toBe('REJECTED');
      expect(res.body.rejectionReason).toBe('Document expired');
    });

    it('returns 400 when reviewing an already-reviewed submission', async () => {
      await buildApp(ADMIN_ID, 'ADMIN');
      // First review
      await request(app.getHttpServer())
        .patch(`/kyc/submissions/${SUBMISSION_ID}/review`)
        .send({ status: 'APPROVED' });
      // Second review attempt
      await request(app.getHttpServer())
        .patch(`/kyc/submissions/${SUBMISSION_ID}/review`)
        .send({ status: 'REJECTED' })
        .expect(400);
    });

    it('returns 404 for an unknown submission', async () => {
      await buildApp(ADMIN_ID, 'ADMIN');
      await request(app.getHttpServer())
        .patch('/kyc/submissions/nonexistent/review')
        .send({ status: 'APPROVED' })
        .expect(404);
    });
  });
});
