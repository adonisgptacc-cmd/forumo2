import { Body, Controller, ForbiddenException, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

import { CreateOrderDto } from "./dto/create-order.dto";
import { UpdateOrderStatusDto } from "./dto/update-order-status.dto";
import { SafeOrder } from "./order.serializer";
import { OrdersService } from "./orders.service";
import { TaxService, CartLineItem, TaxShippingAddress } from "./tax.service";

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly taxService: TaxService,
  ) { }

  @Post(':id/initiate-payment')
  @HttpCode(HttpStatus.OK)
  initiatePayment(@Param('id') id: string, @Request() req: { user: { id: string } }) {
    return this.ordersService.initiatePayment(id, req.user.id);
  }

  /**
   * POST /orders/tax-estimate
   * Estimate tax for a cart before the order is created. Returns { available: false }
   * when Stripe Tax is not enabled for the buyer's region — display
   * "Tax calculated at checkout" in that case.
   */
  @Post('tax-estimate')
  @HttpCode(HttpStatus.OK)
  async estimateTax(
    @Body()
    body: {
      cartItems: CartLineItem[];
      shippingAddress: TaxShippingAddress;
      currency?: string;
    },
  ) {
    if (!body.cartItems?.length) {
      throw new BadRequestException('cartItems is required');
    }
    if (!body.shippingAddress?.country) {
      throw new BadRequestException('shippingAddress.country is required');
    }
    return this.taxService.estimateTax(
      body.cartItems,
      body.shippingAddress,
      body.currency ?? 'usd',
    );
  }

  /**
   * GET /orders/:id/receipt
   * Returns the tax receipt for an order. Accessible by buyer or seller only.
   */
  @Get(':id/receipt')
  getReceipt(@Param('id') id: string, @Request() req: { user: { id: string } }) {
    return this.ordersService.getReceipt(id, req.user.id);
  }

  @Get()
  findAll(
    @Request() req: { user: { id: string } },
    @Query('listingId') listingId?: string,
    @Query('status') status?: string,
  ): Promise<SafeOrder[]> {
    return this.ordersService.findAll(req.user.id, { listingId, status });
  }

  @Get('seller/analytics')
  getSellerAnalytics(@Request() req: { user: { id: string } }) {
    return this.ordersService.getSellerAnalytics(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: { user: { id: string } }): Promise<SafeOrder> {
    return this.ordersService.findById(id, req.user.id);
  }

  @Post()
  create(@Body() dto: CreateOrderDto, @Request() req: { user: { id: string } }): Promise<SafeOrder> {
    // Enforce that the authenticated user is the buyer — prevents impersonation
    return this.ordersService.create({ ...dto, buyerId: req.user.id });
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @Request() req: { user: { id: string } },
  ): Promise<SafeOrder> {
    // Verify the caller is a party to the order; actorId is always the authenticated user
    const order = await this.ordersService.findById(id, req.user.id);
    const isBuyer = order.buyerId === req.user.id;
    const isSeller = order.sellerId === req.user.id;

    // Status-level permission gates
    if (dto.status === OrderStatus.COMPLETED && !isBuyer) {
      throw new ForbiddenException('Only the buyer can release escrow');
    }
    if ((dto.status === OrderStatus.REFUNDED || dto.status === OrderStatus.CANCELLED) && !isBuyer && !isSeller) {
      throw new ForbiddenException('Access denied');
    }
    if (dto.status === OrderStatus.FULFILLED && !isSeller) {
      throw new ForbiddenException('Only the seller can mark an order as fulfilled');
    }

    return this.ordersService.updateStatus(id, { ...dto, actorId: req.user.id });
  }

  @Post(':id/release')
  @HttpCode(HttpStatus.OK)
  async releaseEscrow(
    @Param('id') id: string,
    @Body() body: { note?: string },
    @Request() req: { user: { id: string } },
  ): Promise<SafeOrder> {
    const order = await this.ordersService.findById(id, req.user.id);
    if (order.buyerId !== req.user.id) {
      throw new ForbiddenException('Only the buyer can release escrow');
    }
    return this.ordersService.updateStatus(id, {
      status: OrderStatus.COMPLETED,
      note: body.note ?? 'Escrow released by buyer',
      actorId: req.user.id,
    });
  }

  @Post(':id/refund')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  refundEscrow(
    @Param('id') id: string,
    @Body() body: { note?: string; providerStatus?: string },
    @Request() req: { user: { id: string } },
  ): Promise<SafeOrder> {
    return this.ordersService.updateStatus(id, {
      status: OrderStatus.REFUNDED,
      note: body.note ?? 'Escrow refunded by admin',
      actorId: req.user.id,
      providerStatus: body.providerStatus,
    });
  }

  /**
   * POST /orders/:id/label
   * Seller purchases a Shippo shipping label for the selected rate (obtained from POST /shipping/rates).
   * Returns the PDF label URL and tracking number.
   */
  @Post(':id/label')
  @HttpCode(HttpStatus.CREATED)
  purchaseLabel(
    @Param('id') id: string,
    @Body() body: { rateId: string },
    @Request() req: { user: { id: string } },
  ) {
    return this.ordersService.purchaseLabel(id, req.user.id, body.rateId);
  }

  /**
   * GET /orders/:id/tracking
   * Returns carrier, tracking number, estimated delivery, and all tracking events.
   * Accessible by buyer or seller.
   */
  @Get(':id/tracking')
  getTracking(@Param('id') id: string, @Request() req: { user: { id: string } }) {
    return this.ordersService.getTrackingEvents(id, req.user.id);
  }

  @Post(':id/shipment')
  @HttpCode(HttpStatus.CREATED)
  createShipment(
    @Param('id') id: string,
    @Body() body: { carrier?: string; trackingNumber?: string; serviceLevel?: string; estimatedDelivery?: string },
    @Request() req: { user: { id: string } },
  ) {
    return this.ordersService.createShipment(id, req.user.id, body);
  }

  @Patch(':id/shipment')
  @HttpCode(HttpStatus.OK)
  updateShipment(
    @Param('id') id: string,
    @Body() body: { carrier?: string; trackingNumber?: string; serviceLevel?: string; status?: string; estimatedDelivery?: string; deliveredAt?: string },
    @Request() req: { user: { id: string } },
  ) {
    return this.ordersService.updateShipment(id, req.user.id, body);
  }
}
