import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';

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
    return this.ordersService.create(dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto): Promise<SafeOrder> {
    return this.ordersService.updateStatus(id, dto);
  }
}
