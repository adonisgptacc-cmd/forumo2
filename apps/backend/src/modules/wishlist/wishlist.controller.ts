import { Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('wishlist')
@UseGuards(JwtAuthGuard)
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  getWishlist(@Req() req: any) {
    return this.wishlistService.getWishlist(req.user.id);
  }

  @Post(':listingId')
  save(@Req() req: any, @Param('listingId') listingId: string) {
    return this.wishlistService.save(req.user.id, listingId);
  }

  @Delete(':listingId')
  remove(@Req() req: any, @Param('listingId') listingId: string) {
    return this.wishlistService.remove(req.user.id, listingId);
  }

  @Get(':listingId/check')
  check(@Req() req: any, @Param('listingId') listingId: string) {
    return this.wishlistService.isSaved(req.user.id, listingId).then((saved) => ({ saved }));
  }
}
