import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';

import { CreateOrderDto } from './dto/create-order.dto.js';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto.js';
import { SafeOrder } from './order.serializer.js';
import { OrdersService } from './orders.service.js';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  findAll(): Promise<SafeOrder[]> {
    return this.ordersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<SafeOrder> {
    return this.ordersService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateOrderDto): Promise<SafeOrder> {
    return this.ordersService.create(dto as any);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto): Promise<SafeOrder> {
    return this.ordersService.updateStatus(id, dto);
  }

  @Post(':id/release')
  @HttpCode(HttpStatus.OK)
  releaseEscrow(
    @Param('id') id: string,
    @Body() dto: Pick<UpdateOrderStatusDto, 'note' | 'actorId'>,
  ): Promise<SafeOrder> {
    return this.ordersService.updateStatus(id, {
      status: OrderStatus.COMPLETED,
      note: dto.note ?? 'Escrow released',
      actorId: dto.actorId,
    });
  }

  @Post(':id/refund')
  @HttpCode(HttpStatus.OK)
  refundEscrow(
    @Param('id') id: string,
    @Body() dto: Pick<UpdateOrderStatusDto, 'note' | 'actorId' | 'providerStatus'>,
  ): Promise<SafeOrder> {
    return this.ordersService.updateStatus(id, {
      status: OrderStatus.REFUNDED,
      note: dto.note ?? 'Escrow refunded',
      actorId: dto.actorId,
      providerStatus: dto.providerStatus,
    });
  }
}
