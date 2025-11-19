import { Prisma } from '@prisma/client';

export type OrderWithRelations = Prisma.OrderGetPayload<{
  include: {
    items: true;
    shipments: true;
    timeline: true;
    payments: true;
    escrow: {
      include: {
        disputes: true;
        transactions: true;
      };
    };
  };
}>;

export type SafeOrder = OrderWithRelations;

export const serializeOrder = (order: OrderWithRelations): SafeOrder => order;
