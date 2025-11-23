import { Prisma } from '@prisma/client';

export type OrderWithRelations = Prisma.OrderGetPayload<{
  include: {
    items: true;
    shipments: true;
    timeline: {
      include: { actor: true };
    };
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

export const serializeOrder = (order: OrderWithRelations): SafeOrder => ({
  ...order,
  items: order.items ?? [],
  shipments: order.shipments ?? [],
  timeline: order.timeline ?? [],
  payments: order.payments ?? [],
  escrow: order.escrow
    ? {
        ...order.escrow,
        disputes: order.escrow.disputes ?? [],
        transactions: order.escrow.transactions ?? [],
      }
    : null,
});
