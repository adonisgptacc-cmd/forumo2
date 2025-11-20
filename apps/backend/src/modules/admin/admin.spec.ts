import { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { PrismaService } from '../../prisma/prisma.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { AdminModule } from './admin.module.js';

class StubAuthGuard implements CanActivate {
  constructor(private readonly role: string) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = { id: 'user-1', role: this.role };
    return true;
  }
}

const now = new Date();
const prismaMock = {
  kycSubmission: {
    findMany: jest.fn().mockResolvedValue([
      {
        id: 'kyc-1',
        userId: 'user-kyc',
        reviewerId: null,
        status: 'PENDING',
        rejectionReason: null,
        submittedAt: now,
        reviewedAt: null,
        documents: [
          {
            id: 'kyc-doc-1',
            submissionId: 'kyc-1',
            type: 'passport',
            status: 'PENDING',
            url: null,
            createdAt: now,
            metadata: null,
          },
        ],
        user: { id: 'user-kyc', email: 'user@example.com', name: 'Example User' },
        reviewer: null,
      },
    ]),
  },
  listing: {
    findMany: jest.fn().mockResolvedValue([
      {
        id: 'listing-1',
        sellerId: 'seller-1',
        title: 'Handwoven basket',
        status: 'PUBLISHED',
        moderationStatus: 'FLAGGED',
        moderationNotes: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]),
  },
  escrowDispute: {
    findMany: jest.fn().mockResolvedValue([
      {
        id: 'dispute-1',
        escrowId: 'escrow-1',
        status: 'OPEN',
        reason: 'Item damaged',
        resolution: null,
        openedAt: now,
        resolvedAt: null,
        messages: [{ id: 'msg-1' }],
        openedBy: { id: 'buyer-1', email: 'buyer@example.com', name: 'Buyer' },
        escrow: {
          order: { id: 'order-1', orderNumber: 'F-100', totalItemCents: 1200, currency: 'USD' },
        },
      },
    ]),
  },
};

async function createApp(role: string): Promise<INestApplication> {
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
  const moduleRef = await Test.createTestingModule({
    imports: [AdminModule],
  })
    .overrideProvider(PrismaService)
    .useValue(prismaMock)
    .overrideGuard(JwtAuthGuard)
    .useValue(new StubAuthGuard(role))
    .compile();

  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

describe('AdminModule RBAC', () => {
  let app: INestApplication;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('rejects non-admin users', async () => {
    app = await createApp('SELLER');
    await request(app.getHttpServer()).get('/admin/kyc/submissions').expect(403);
  });

  it('allows admins to read dashboard data', async () => {
    app = await createApp('ADMIN');
    const res = await request(app.getHttpServer()).get('/admin/disputes').expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].status).toBe('OPEN');
    expect(prismaMock.escrowDispute.findMany).toHaveBeenCalled();
  });
});
