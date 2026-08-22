import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";

interface AuditInput {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  payload?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

type AuditClient = Pick<PrismaService, "auditLog">;

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(event: AuditInput, client: AuditClient = this.prisma) {
    await client.auditLog.create({
      data: {
        actorId: event.actorId ?? null,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId ?? null,
        payload:
          event.payload != null
            ? (event.payload as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        ipAddress: event.ipAddress ?? null,
        userAgent: event.userAgent ?? null,
      },
    });
  }
}
