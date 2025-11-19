import { Prisma } from '@prisma/client';

export type OrderWithRelations = Prisma.OrderGetPayload<{
  include: {
    items: true;
    shipments: true;
    timeline: true;
  };
}>;

export type SafeOrder = OrderWithRelations;

export const serializeOrder = (order: OrderWithRelations): SafeOrder => order;
