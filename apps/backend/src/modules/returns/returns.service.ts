import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { OrderStatus, Return, ReturnStatus } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { OrdersService } from "../orders/orders.service";
import { InitiateReturnDto } from "./dto/initiate-return.dto";
import { RejectReturnDto } from "./dto/reject-return.dto";

const RETURN_WINDOW_DAYS = 30;

type ReturnWithRelations = Return & {
  order: {
    id: string;
    orderNumber: string;
    deliveredAt: Date | null;
    totalItemCents: number;
    currency: string;
    escrow: { id: string; amountCents: number } | null;
  };
  buyer: { id: string; name: string; email: string };
  seller: { id: string; name: string; email: string };
};

@Injectable()
export class ReturnsService {
  private readonly logger = new Logger(ReturnsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly ordersService: OrdersService,
  ) {}

  async initiateReturn(
    buyerId: string,
    orderId: string,
    dto: InitiateReturnDto,
  ): Promise<ReturnWithRelations> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, buyerId },
      include: { escrow: true },
    });

    if (!order) throw new NotFoundException("Order not found");
    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException(
        "Order must be in DELIVERED status to request a return",
      );
    }

    const deliveredAt = order.deliveredAt ?? order.updatedAt;
    const windowEnd = new Date(deliveredAt);
    windowEnd.setDate(windowEnd.getDate() + RETURN_WINDOW_DAYS);
    if (new Date() > windowEnd) {
      throw new BadRequestException(
        "Return window has expired (30 days from delivery)",
      );
    }

    const existing = await this.prisma.return.findFirst({
      where: {
        orderId,
        status: { notIn: [ReturnStatus.rejected, ReturnStatus.refunded] },
      },
    });
    if (existing) {
      throw new BadRequestException(
        "A return request already exists for this order",
      );
    }

    const deadline = new Date();
    deadline.setHours(deadline.getHours() + 48);

    const returnRecord = (await this.prisma.return.create({
      data: {
        orderId,
        buyerId,
        sellerId: order.sellerId,
        reason: dto.reason,
        conditionNotes: dto.conditionNotes,
        items: dto.items ? (dto.items as any) : undefined,
        refundAmount: order.escrow?.amountCents ?? order.totalItemCents,
        sellerResponseDeadline: deadline,
        status: ReturnStatus.awaiting_seller,
      },
      include: this.defaultInclude,
    })) as ReturnWithRelations;

    this.sendReturnInitiatedNotifications(returnRecord).catch((err) =>
      this.logger.error("Return initiation notification failed", err),
    );

    return returnRecord;
  }

  async approveReturn(
    sellerId: string,
    returnId: string,
  ): Promise<ReturnWithRelations> {
    const ret = await this.findReturnForSeller(sellerId, returnId);

    if (
      ret.status !== ReturnStatus.awaiting_seller &&
      ret.status !== ReturnStatus.requested
    ) {
      throw new BadRequestException(
        "Return is not in a state that can be approved",
      );
    }

    const updated = (await this.prisma.return.update({
      where: { id: returnId },
      data: { status: ReturnStatus.approved },
      include: this.defaultInclude,
    })) as ReturnWithRelations;

    this.notifications
      .sendEmail(
        updated.buyer.email,
        `Return approved — Order ${updated.order.orderNumber}`,
        `<p>Hi ${updated.buyer.name},</p><p>Your return request for order <strong>${updated.order.orderNumber}</strong> has been approved. Please ship the item(s) back and update your tracking number.</p>`,
      )
      .catch(() => {});

    this.notifications
      .createInApp(updated.buyerId, "RETURN_APPROVED", {
        returnId: updated.id,
        orderId: updated.orderId,
        orderNumber: updated.order.orderNumber,
      })
      .catch(() => {});

    return updated;
  }

  async rejectReturn(
    sellerId: string,
    returnId: string,
    dto: RejectReturnDto,
  ): Promise<ReturnWithRelations> {
    const ret = await this.findReturnForSeller(sellerId, returnId);

    if (
      ret.status !== ReturnStatus.awaiting_seller &&
      ret.status !== ReturnStatus.requested
    ) {
      throw new BadRequestException(
        "Return is not in a state that can be rejected",
      );
    }

    const updated = (await this.prisma.return.update({
      where: { id: returnId },
      data: {
        status: ReturnStatus.rejected,
        rejectionReason: dto.reason,
        resolvedAt: new Date(),
      },
      include: this.defaultInclude,
    })) as ReturnWithRelations;

    this.notifications
      .sendEmail(
        updated.buyer.email,
        `Return declined — Order ${updated.order.orderNumber}`,
        `<p>Hi ${updated.buyer.name},</p><p>Your return request for order <strong>${updated.order.orderNumber}</strong> has been declined.</p><p>Reason: <em>${dto.reason}</em></p><p>If you believe this decision is incorrect, you can <a href="https://forumo.app/returns/${updated.id}">escalate to a dispute</a>.</p>`,
      )
      .catch(() => {});

    this.notifications
      .createInApp(updated.buyerId, "RETURN_REJECTED", {
        returnId: updated.id,
        orderId: updated.orderId,
        orderNumber: updated.order.orderNumber,
        reason: dto.reason,
      })
      .catch(() => {});

    return updated;
  }

  async confirmReceived(
    sellerId: string,
    returnId: string,
  ): Promise<ReturnWithRelations> {
    const ret = await this.findReturnForSeller(sellerId, returnId);

    if (ret.status !== ReturnStatus.shipped) {
      throw new BadRequestException("Return has not been shipped yet");
    }

    const updated = (await this.prisma.return.update({
      where: { id: returnId },
      data: { status: ReturnStatus.received },
      include: this.defaultInclude,
    })) as ReturnWithRelations;

    await this.processRefund(updated);

    return (await this.prisma.return.findUniqueOrThrow({
      where: { id: returnId },
      include: this.defaultInclude,
    })) as ReturnWithRelations;
  }

  async forceRefund(returnId: string): Promise<ReturnWithRelations> {
    const ret = (await this.prisma.return.findUnique({
      where: { id: returnId },
      include: this.defaultInclude,
    })) as ReturnWithRelations | null;
    if (!ret) throw new NotFoundException("Return not found");

    if (ret.status === ReturnStatus.refunded) {
      throw new BadRequestException("Already refunded");
    }

    await this.processRefund(ret);

    return (await this.prisma.return.findUniqueOrThrow({
      where: { id: returnId },
      include: this.defaultInclude,
    })) as ReturnWithRelations;
  }

  async findAll(
    userId: string,
    role: "buyer" | "seller" | "admin",
  ): Promise<ReturnWithRelations[]> {
    const where =
      role === "admin"
        ? {}
        : role === "buyer"
          ? { buyerId: userId }
          : { sellerId: userId };

    return this.prisma.return.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: this.defaultInclude,
    }) as Promise<ReturnWithRelations[]>;
  }

  async findById(
    returnId: string,
    userId: string,
    isAdmin = false,
  ): Promise<ReturnWithRelations> {
    const ret = (await this.prisma.return.findUnique({
      where: { id: returnId },
      include: this.defaultInclude,
    })) as ReturnWithRelations | null;

    if (!ret) throw new NotFoundException("Return not found");
    if (!isAdmin && ret.buyerId !== userId && ret.sellerId !== userId) {
      throw new ForbiddenException("Access denied");
    }
    return ret;
  }

  @Cron(CronExpression.EVERY_HOUR)
  async autoApproveExpiredReturns(): Promise<void> {
    const expired = await this.prisma.return.findMany({
      where: {
        status: ReturnStatus.awaiting_seller,
        sellerResponseDeadline: { lt: new Date() },
      },
      include: this.defaultInclude,
    });

    for (const ret of expired as ReturnWithRelations[]) {
      try {
        await this.prisma.return.update({
          where: { id: ret.id },
          data: { status: ReturnStatus.approved },
        });

        this.notifications
          .sendEmail(
            ret.buyer.email,
            `Return auto-approved — Order ${ret.order.orderNumber}`,
            `<p>Hi ${ret.buyer.name},</p><p>Your return request for order <strong>${ret.order.orderNumber}</strong> was automatically approved because the seller did not respond within 48 hours. Please ship the item(s) back and update your tracking number.</p>`,
          )
          .catch(() => {});

        this.notifications
          .createInApp(ret.buyerId, "RETURN_AUTO_APPROVED", {
            returnId: ret.id,
            orderId: ret.orderId,
            orderNumber: ret.order.orderNumber,
          })
          .catch(() => {});
      } catch (err) {
        this.logger.error(`Auto-approve failed for return ${ret.id}`, err);
      }
    }

    if (expired.length > 0) {
      this.logger.log(`Auto-approved ${expired.length} expired return(s)`);
    }
  }

  private async processRefund(ret: ReturnWithRelations): Promise<void> {
    const existing = await this.prisma.return.findUnique({
      where: { id: ret.id },
      select: { status: true },
    });
    if (existing?.status === ReturnStatus.refunded) return;

    const order = await this.ordersService.requestRefund(ret.orderId, {
      status: OrderStatus.REFUNDED,
      note: `Return refund — return ${ret.id}`,
    });
    if (order.status !== OrderStatus.REFUNDED) {
      this.logger.warn(
        `Return ${ret.id} remains ${existing?.status ?? ret.status}; provider refund is ${order.status}`,
      );
      return;
    }

    await this.prisma.return.update({
      where: { id: ret.id },
      data: { status: ReturnStatus.refunded, resolvedAt: new Date() },
    });

    this.notifications
      .sendEmail(
        ret.buyer.email,
        `Refund issued — Order ${ret.order.orderNumber}`,
        `<p>Hi ${ret.buyer.name},</p><p>Your refund of <strong>${ret.order.currency.toUpperCase()} ${(ret.refundAmount / 100).toFixed(2)}</strong> for order <strong>${ret.order.orderNumber}</strong> has been processed and will appear on your original payment method within 5–10 business days.</p>`,
      )
      .catch(() => {});

    this.notifications
      .createInApp(ret.buyerId, "RETURN_REFUNDED", {
        returnId: ret.id,
        orderId: ret.orderId,
        orderNumber: ret.order.orderNumber,
        refundAmount: ret.refundAmount,
        currency: ret.order.currency,
      })
      .catch(() => {});
  }

  private async sendReturnInitiatedNotifications(
    ret: ReturnWithRelations,
  ): Promise<void> {
    await Promise.all([
      this.notifications.sendEmail(
        ret.seller.email,
        `New return request — Order ${ret.order.orderNumber}`,
        `<p>Hi ${ret.seller.name},</p><p>A return has been requested for order <strong>${ret.order.orderNumber}</strong>.</p><p>Reason: <em>${ret.reason.replace(/_/g, " ")}</em></p><p>You have <strong>48 hours</strong> to approve or decline. If no action is taken the return will be auto-approved.</p><p><a href="https://forumo.app/dashboard/returns">Review return request</a></p>`,
      ),
      this.notifications.createInApp(ret.sellerId, "RETURN_REQUESTED", {
        returnId: ret.id,
        orderId: ret.orderId,
        orderNumber: ret.order.orderNumber,
        reason: ret.reason,
      }),
    ]);
  }

  private async findReturnForSeller(
    sellerId: string,
    returnId: string,
  ): Promise<ReturnWithRelations> {
    const ret = (await this.prisma.return.findUnique({
      where: { id: returnId },
      include: this.defaultInclude,
    })) as ReturnWithRelations | null;

    if (!ret) throw new NotFoundException("Return not found");
    if (ret.sellerId !== sellerId)
      throw new ForbiddenException("Access denied");
    return ret;
  }

  private readonly defaultInclude = {
    order: {
      select: {
        id: true,
        orderNumber: true,
        deliveredAt: true,
        totalItemCents: true,
        currency: true,
        escrow: { select: { id: true, amountCents: true } },
      },
    },
    buyer: { select: { id: true, name: true, email: true } },
    seller: { select: { id: true, name: true, email: true } },
  } as const;
}
