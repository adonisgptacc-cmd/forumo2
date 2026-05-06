import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { ReturnsService } from './returns.service';
import { InitiateReturnDto } from './dto/initiate-return.dto';
import { RejectReturnDto } from './dto/reject-return.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '@prisma/client';

interface AuthRequest {
  user: { id: string; role: UserRole };
}

@ApiTags('returns')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller()
export class ReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  @Post('orders/:id/return')
  @ApiOperation({ summary: 'Initiate a return request (buyer)' })
  initiateReturn(
    @Request() req: AuthRequest,
    @Param('id') orderId: string,
    @Body() dto: InitiateReturnDto,
  ) {
    return this.returnsService.initiateReturn(req.user.id, orderId, dto);
  }

  @Get('returns')
  @ApiOperation({ summary: 'List my returns' })
  findAll(@Request() req: AuthRequest) {
    const role = req.user.role === UserRole.ADMIN ? 'admin' : 'buyer';
    return this.returnsService.findAll(req.user.id, role);
  }

  @Get('returns/:id')
  @ApiOperation({ summary: 'Get return details' })
  findOne(@Request() req: AuthRequest, @Param('id') id: string) {
    const isAdmin = req.user.role === UserRole.ADMIN;
    return this.returnsService.findById(id, req.user.id, isAdmin);
  }

  @Put('returns/:id/approve')
  @ApiOperation({ summary: 'Approve a return (seller)' })
  approve(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.returnsService.approveReturn(req.user.id, id);
  }

  @Put('returns/:id/reject')
  @ApiOperation({ summary: 'Reject a return (seller)' })
  reject(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: RejectReturnDto,
  ) {
    return this.returnsService.rejectReturn(req.user.id, id, dto);
  }

  @Put('returns/:id/received')
  @ApiOperation({ summary: 'Confirm return item received (seller)' })
  confirmReceived(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.returnsService.confirmReceived(req.user.id, id);
  }

  @Post('admin/returns/:id/force-refund')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: force-issue a refund for a return' })
  forceRefund(@Param('id') id: string) {
    return this.returnsService.forceRefund(id);
  }
}
