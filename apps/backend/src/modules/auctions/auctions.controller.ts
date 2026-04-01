import { Body, Controller, Get, Param, Post, Query, UseGuards, Request } from '@nestjs/common';
import { AuctionsService } from './auctions.service';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { PlaceBidDto } from './dto/place-bid.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

@ApiTags('auctions')
@Controller('auctions')
export class AuctionsController {
    constructor(private readonly auctionsService: AuctionsService) { }

    @Get()
    @ApiOperation({ summary: 'List active auctions' })
    @ApiQuery({ name: 'status', required: false, enum: ['ACTIVE', 'ENDED', 'CANCELLED'] })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'pageSize', required: false, type: Number })
    findAll(
        @Query('status') status?: string,
        @Query('page') page?: string,
        @Query('pageSize') pageSize?: string,
    ) {
        return this.auctionsService.findAll({
            status,
            page: page ? parseInt(page, 10) : 1,
            pageSize: pageSize ? parseInt(pageSize, 10) : 12,
        });
    }

    @Post()
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create a new auction from a draft listing' })
    create(@Request() req: { user: { id: string } }, @Body() dto: CreateAuctionDto) {
        return this.auctionsService.create(req.user.id, dto);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get auction details' })
    findOne(@Param('id') id: string) {
        return this.auctionsService.findOne(id);
    }

    @Post(':id/bids')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Place a bid on an auction' })
    placeBid(@Request() req: { user: { id: string } }, @Param('id') id: string, @Body() dto: PlaceBidDto) {
        return this.auctionsService.placeBid(req.user.id, id, dto);
    }
}
