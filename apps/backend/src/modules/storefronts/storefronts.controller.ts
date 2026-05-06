import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { StorefrontsService } from './storefronts.service';
import { CreateStorefrontDto } from './dto/create-storefront.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('storefronts')
export class StorefrontsController {
  constructor(private readonly storefrontsService: StorefrontsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Request() req: { user: { id: string } }, @Body() dto: CreateStorefrontDto) {
    return this.storefrontsService.create(req.user.id, dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMyStorefront(@Request() req: { user: { id: string } }) {
    return this.storefrontsService.findByUser(req.user.id);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  update(
    @Request() req: { user: { id: string } },
    @Body() body: { name?: string; description?: string; logoUrl?: string; bannerUrl?: string },
  ) {
    return this.storefrontsService.update(req.user.id, body);
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Request() req: { user: { id: string } }) {
    return this.storefrontsService.remove(req.user.id);
  }

  @Get('me/collections')
  @UseGuards(JwtAuthGuard)
  listCollections(@Request() req: { user: { id: string } }) {
    return this.storefrontsService.listCollections(req.user.id);
  }

  @Post('me/collections')
  @UseGuards(JwtAuthGuard)
  createCollection(
    @Request() req: { user: { id: string } },
    @Body() body: { name: string; slug: string; description?: string; productIds?: string[] },
  ) {
    return this.storefrontsService.createCollection(req.user.id, body);
  }

  @Patch('me/collections/:id')
  @UseGuards(JwtAuthGuard)
  updateCollection(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string; productIds?: string[] },
  ) {
    return this.storefrontsService.updateCollection(req.user.id, id, body);
  }

  @Delete('me/collections/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteCollection(@Request() req: { user: { id: string } }, @Param('id') id: string) {
    return this.storefrontsService.deleteCollection(req.user.id, id);
  }

  @Get('seller/:userId')
  findBySeller(@Param('userId') userId: string) {
    return this.storefrontsService.findByUser(userId);
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.storefrontsService.findBySlug(slug);
  }
}
