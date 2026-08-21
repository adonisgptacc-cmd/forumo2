import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  Request,
} from "@nestjs/common";
import { OffersService } from "./offers.service";
import { CreateOfferDto } from "./dto/create-offer.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";

@ApiTags("offers")
@Controller("offers")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Post()
  @ApiOperation({ summary: "Make an offer on a listing" })
  create(
    @Request() req: { user: { id: string } },
    @Body() dto: CreateOfferDto,
  ) {
    return this.offersService.create(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: "Get my offers (sent and received)" })
  findAll(@Request() req: { user: { id: string } }) {
    return this.offersService.findAllForUser(req.user.id);
  }

  @Post(":id/accept")
  @ApiOperation({ summary: "Accept an offer (Seller only)" })
  accept(@Request() req: { user: { id: string } }, @Param("id") id: string) {
    return this.offersService.accept(req.user.id, id);
  }

  @Post(":id/decline")
  @ApiOperation({ summary: "Decline an offer (Seller only)" })
  decline(@Request() req: { user: { id: string } }, @Param("id") id: string) {
    return this.offersService.decline(req.user.id, id);
  }
}
