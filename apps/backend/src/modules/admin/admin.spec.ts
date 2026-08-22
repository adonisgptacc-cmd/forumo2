import {
  CanActivate,
  ExecutionContext,
  INestApplication,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { ConfigModule } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AdminModule } from "./admin.module";
import { CacheService } from "../../common/services/cache.service";

class StubAuthGuard implements CanActivate {
  constructor(private readonly role: string) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = { id: "user-1", role: this.role };
    return true;
  }
}

const now = new Date();

const KYC_RECORD = {
  id: "kyc-1",
  userId: "user-kyc",
  reviewerId: null,
  status: "PENDING",
  rejectionReason: null,
  submittedAt: now,
  reviewedAt: null,
  documents: [
    {
      id: "kyc-doc-1",
      submissionId: "kyc-1",
      type: "passport",
      status: "PENDING",
      url: null,
      createdAt: now,
      metadata: null,
    },
  ],
  user: { id: "user-kyc", email: "user@example.com", name: "Example User" },
  reviewer: null,
};

const LISTING_RECORD = {
  id: "listing-1",
  sellerId: "seller-1",
  title: "Handwoven basket",
  status: "PUBLISHED",
  moderationStatus: "FLAGGED",
  moderationNotes: null,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
};

const DISPUTE_RECORD = {
  id: "dispute-1",
  escrowId: "escrow-1",
  status: "OPEN",
  reason: "Item damaged",
  resolution: null,
  openedAt: now,
  resolvedAt: null,
  messages: [{ id: "msg-1" }],
  openedBy: { id: "buyer-1", email: "buyer@example.com", name: "Buyer" },
  escrow: {
    order: {
      id: "order-1",
      orderNumber: "F-100",
      totalItemCents: 1200,
      currency: "USD",
    },
  },
};

const USER_RECORD = {
  id: "user-9",
  name: "Jane Seller",
  email: "jane@example.com",
  role: "SELLER",
  accountStatus: "ACTIVE",
  kycStatus: "APPROVED",
  createdAt: now,
  _count: { listings: 3 },
};

const prismaMock = {
  kycSubmission: {
    findMany: jest.fn().mockResolvedValue([KYC_RECORD]),
    findUnique: jest.fn().mockResolvedValue(KYC_RECORD),
    update: jest
      .fn()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      .mockImplementation(({ data }: any) =>
        Promise.resolve({ ...KYC_RECORD, ...data, reviewedAt: new Date() }),
      ),
  },
  listing: {
    findMany: jest.fn().mockResolvedValue([LISTING_RECORD]),
    findUnique: jest.fn().mockResolvedValue(LISTING_RECORD),
    update: jest
      .fn()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      .mockImplementation(({ data }: any) =>
        Promise.resolve({ ...LISTING_RECORD, ...data, updatedAt: new Date() }),
      ),
  },
  escrowDispute: {
    findMany: jest.fn().mockResolvedValue([DISPUTE_RECORD]),
    findUnique: jest.fn().mockResolvedValue(DISPUTE_RECORD),
    update: jest
      .fn()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      .mockImplementation(({ data }: any) =>
        Promise.resolve({ ...DISPUTE_RECORD, ...data }),
      ),
  },
  user: {
    count: jest.fn().mockResolvedValue(0),
    findMany: jest.fn().mockResolvedValue([USER_RECORD]),
  },
  order: {
    count: jest.fn().mockResolvedValue(0),
    findMany: jest.fn().mockResolvedValue([]),
  },
};

async function createApp(role: string): Promise<INestApplication> {
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-secret";
  process.env.GOOGLE_CLIENT_ID = "test-google-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-google-secret";

  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: ".env.test",
      }),
      AdminModule,
    ],
  })
    .overrideProvider(PrismaService)
    .useValue(prismaMock)
    .overrideProvider(CacheService)
    .useValue({ deleteByPrefix: jest.fn().mockResolvedValue(0) })
    .overrideGuard(JwtAuthGuard)
    .useValue(new StubAuthGuard(role))
    .compile();

  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

describe("AdminModule RBAC", () => {
  let app: INestApplication;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (app) {
      try {
        await app.close();
      } catch (err) {
        // Silently handle close errors in tests
        console.debug(
          "App close error (expected in tests):",
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  });

  it("rejects non-admin users", async () => {
    app = await createApp("SELLER");
    await request(app.getHttpServer())
      .get("/admin/kyc/submissions")
      .expect(403);
  });

  it("allows admins to read dashboard data", async () => {
    app = await createApp("ADMIN");
    const res = await request(app.getHttpServer())
      .get("/admin/disputes")
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].status).toBe("OPEN");
    expect(prismaMock.escrowDispute.findMany).toHaveBeenCalled();
  });

  it("PATCH /admin/kyc/submissions/:id — approves a submission", async () => {
    prismaMock.kycSubmission.update.mockResolvedValueOnce({
      ...KYC_RECORD,
      status: "APPROVED",
      reviewedAt: new Date(),
    });
    app = await createApp("ADMIN");
    const res = await request(app.getHttpServer())
      .patch("/admin/kyc/submissions/kyc-1")
      .send({ status: "APPROVED" })
      .expect(200);
    expect(res.body.status).toBe("APPROVED");
  });

  it("PATCH /admin/kyc/submissions/:id — returns 404 for unknown id", async () => {
    prismaMock.kycSubmission.findUnique.mockResolvedValueOnce(null);
    app = await createApp("ADMIN");
    await request(app.getHttpServer())
      .patch("/admin/kyc/submissions/nonexistent")
      .send({ status: "APPROVED" })
      .expect(404);
  });

  it("PATCH /admin/moderations/listings/:id — approves a listing", async () => {
    prismaMock.listing.update.mockResolvedValueOnce({
      ...LISTING_RECORD,
      moderationStatus: "APPROVED",
    });
    app = await createApp("ADMIN");
    const res = await request(app.getHttpServer())
      .patch("/admin/moderations/listings/listing-1")
      .send({ moderationStatus: "APPROVED" })
      .expect(200);
    expect(res.body.moderationStatus).toBe("APPROVED");
  });

  it("PATCH /admin/moderations/listings/:id — returns 404 for unknown listing", async () => {
    prismaMock.listing.findUnique.mockResolvedValueOnce(null);
    app = await createApp("ADMIN");
    await request(app.getHttpServer())
      .patch("/admin/moderations/listings/nonexistent")
      .send({ moderationStatus: "APPROVED" })
      .expect(404);
  });

  it("PATCH /admin/disputes/:id — moves a dispute to UNDER_REVIEW", async () => {
    prismaMock.escrowDispute.update.mockResolvedValueOnce({
      ...DISPUTE_RECORD,
      status: "UNDER_REVIEW",
    });
    app = await createApp("ADMIN");
    const res = await request(app.getHttpServer())
      .patch("/admin/disputes/dispute-1")
      .send({ status: "UNDER_REVIEW" })
      .expect(200);
    expect(res.body.status).toBe("UNDER_REVIEW");
  });

  it("PATCH /admin/disputes/:id — returns 404 for unknown dispute", async () => {
    prismaMock.escrowDispute.findUnique.mockResolvedValueOnce(null);
    app = await createApp("ADMIN");
    await request(app.getHttpServer())
      .patch("/admin/disputes/nonexistent")
      .send({ status: "RESOLVED", resolution: "Buyer confirmed" })
      .expect(404);
  });

  it("GET /admin/users — maps listingsCount and accountStatus", async () => {
    app = await createApp("ADMIN");
    const res = await request(app.getHttpServer())
      .get("/admin/users")
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      id: "user-9",
      accountStatus: "ACTIVE",
      listingsCount: 3,
    });
  });

  it("GET /admin/users — applies search, status, role filters and pagination", async () => {
    app = await createApp("ADMIN");
    await request(app.getHttpServer())
      .get(
        "/admin/users?search=jane&status=SUSPENDED&role=SELLER&page=2&limit=10",
      )
      .expect(200);

    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          accountStatus: "SUSPENDED",
          role: "SELLER",
          OR: [
            { name: { contains: "jane", mode: "insensitive" } },
            { email: { contains: "jane", mode: "insensitive" } },
          ],
        }),
        skip: 10,
        take: 10,
      }),
    );
  });

  it("GET /admin/users — ignores invalid status/role values", async () => {
    app = await createApp("ADMIN");
    await request(app.getHttpServer())
      .get("/admin/users?status=BOGUS&role=WIZARD")
      .expect(200);

    const where = prismaMock.user.findMany.mock.calls.at(-1)?.[0]?.where;
    expect(where.accountStatus).toBeUndefined();
    expect(where.role).toBeUndefined();
  });
});
