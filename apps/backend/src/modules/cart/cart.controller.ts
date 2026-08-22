import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CartService } from "./cart.service";
import { AddItemDto } from "./dto/add-item.dto";
import { MergeCartDto } from "./dto/merge-cart.dto";
import { UpdateQuantityDto } from "./dto/update-quantity.dto";
import type { Request as ExpressRequest } from "express";

@Controller("cart")
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getCart(
    @Req()
    req: ExpressRequest &
      Record<string, unknown> & { user: { id: string; role: string } },
  ) {
    return this.cartService.getCart(req.user.id);
  }

  @Post("items")
  addItem(
    @Req()
    req: ExpressRequest &
      Record<string, unknown> & { user: { id: string; role: string } },
    @Body() dto: AddItemDto,
  ) {
    return this.cartService.addItem(
      req.user.id,
      dto.listingId,
      dto.quantity,
      dto.variantId,
      dto.variantLabel,
    );
  }

  @Put("items/:listingId")
  updateQuantity(
    @Req()
    req: ExpressRequest &
      Record<string, unknown> & { user: { id: string; role: string } },
    @Param("listingId") listingId: string,
    @Query("variantId") variantId: string | undefined,
    @Body() dto: UpdateQuantityDto,
  ) {
    return this.cartService.updateQuantityByKey(
      req.user.id,
      listingId,
      dto.quantity,
      variantId,
    );
  }

  @Delete("items/:listingId")
  removeItem(
    @Req()
    req: ExpressRequest &
      Record<string, unknown> & { user: { id: string; role: string } },
    @Param("listingId") listingId: string,
    @Query("variantId") variantId: string | undefined,
  ) {
    return this.cartService.removeItemByKey(req.user.id, listingId, variantId);
  }

  @Delete()
  clearCart(
    @Req()
    req: ExpressRequest &
      Record<string, unknown> & { user: { id: string; role: string } },
  ) {
    return this.cartService.clearCart(req.user.id);
  }

  @Post("merge")
  mergeGuestCart(
    @Req()
    req: ExpressRequest &
      Record<string, unknown> & { user: { id: string; role: string } },
    @Body() dto: MergeCartDto,
  ) {
    return this.cartService.mergeGuestCart(req.user.id, dto.items);
  }
}
