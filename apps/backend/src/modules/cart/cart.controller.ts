import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CartService } from './cart.service';
import { AddItemDto } from './dto/add-item.dto';
import { MergeCartDto } from './dto/merge-cart.dto';
import { UpdateQuantityDto } from './dto/update-quantity.dto';

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getCart(@Req() req: any) {
    return this.cartService.getCart(req.user.id);
  }

  @Post('items')
  addItem(@Req() req: any, @Body() dto: AddItemDto) {
    return this.cartService.addItem(req.user.id, dto.listingId, dto.quantity, dto.variantId, dto.variantLabel);
  }

  @Put('items/:id')
  updateQuantity(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateQuantityDto,
  ) {
    return this.cartService.updateQuantity(req.user.id, id, dto.quantity);
  }

  @Delete('items/:id')
  removeItem(@Req() req: any, @Param('id') id: string) {
    return this.cartService.removeItem(req.user.id, id);
  }

  @Delete()
  clearCart(@Req() req: any) {
    return this.cartService.clearCart(req.user.id);
  }

  @Post('merge')
  mergeGuestCart(@Req() req: any, @Body() dto: MergeCartDto) {
    return this.cartService.mergeGuestCart(req.user.id, dto.items);
  }
}
